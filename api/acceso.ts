/**
 * Ingreso a la app: Lista Blanca, elección de perfil y autenticador (TOTP).
 *
 * Un solo endpoint con cuatro acciones, que el frontend recorre como un asistente:
 *
 *   estado     → ¿qué le falta a este usuario para entrar? (elegir perfil / configurar / código / nada)
 *   iniciar    → primera vez: genera el secreto y devuelve lo necesario para el QR
 *   confirmar  → primera vez: valida el primer código, activa el secreto y entrega los códigos de
 *                recuperación
 *   verificar  → cada día: valida el código de 6 dígitos (o uno de recuperación)
 *
 * Las que terminan bien devuelven la sesión del día, que después exigen los proxies de datos.
 *
 * Hacia afuera, cualquier rechazo de acceso es el mismo `{ estado: 'sin_acceso' }`, sin importar
 * el motivo. El motivo real queda en el Registro de Accesos.
 */
import { MalConfigurado, NoAutorizado, verificarSesion, type SesionMonday } from './_guard'
import { AccesoDenegado, perfilesHabilitados, sesionAlcanza } from './_seguridad/acceso'
import {
  consumirCodigoRecuperacion,
  estaBloqueado,
  generarCodigosRecuperacion,
  guardarAutenticador,
  intentosVigentes,
  leerAutenticador,
  type EstadoAutenticador,
} from './_seguridad/autenticador'
import { configSeguridad, MAX_INTENTOS } from './_seguridad/config'
import {
  cifrar,
  descifrar,
  ErrorDeConfiguracion,
  nuevoSecretoTotp,
  verificarTotp,
} from './_seguridad/cripto'
import { emailDeUsuario, type Perfil } from './_seguridad/listaBlanca'
import { ipDe, registrar } from './_seguridad/registro'
import { emitirSesion, verificarSesionApp } from './_seguridad/sesionApp'

export const config = { runtime: 'edge' }

const EMISOR = 'BERGER S.A.'

type Accion = 'estado' | 'iniciar' | 'confirmar' | 'verificar'

interface Pedido {
  accion?: Accion
  perfilId?: string
  codigo?: string
  /** `true` si `codigo` es un código de recuperación y no uno de 6 dígitos. */
  recuperacion?: boolean
}

const json = (status: number, cuerpo: unknown): Response =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })

/** El único rechazo que ve el usuario. Idéntico para todos los motivos. */
const sinAcceso = () => json(403, { estado: 'sin_acceso' })

/** Lo mínimo de un perfil que necesita la pantalla. Nada de la configuración de acceso. */
const publico = (p: Perfil) => ({ id: p.id, nombre: p.nombre })

const detalleTipo = (tipo: string): string =>
  ({ ADMIN: 'Administrador', MIEMBRO: 'Miembro', INVITADO: 'Invitado' })[tipo] ?? tipo

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { estado: 'error' })
  const ip = ipDe(req)

  let pedido: Pedido
  try {
    pedido = (await req.json()) as Pedido
  } catch {
    return json(400, { estado: 'error' })
  }

  /* 1. ¿Viene de monday, con un usuario real de la cuenta de BERGER? */
  let sesionMonday: SesionMonday
  try {
    sesionMonday = await verificarSesion(req.headers.get('authorization'))
  } catch (e) {
    if (e instanceof MalConfigurado) {
      console.error('[acceso] configuración:', e.message)
      return json(500, { estado: 'error' })
    }
    const rechazo = e instanceof NoAutorizado ? e : null
    await registrar('Acceso denegado', {
      usuarioId: rechazo?.usuarioId,
      cuentaId: rechazo?.cuentaId,
      ip,
      detalle: rechazo?.message ?? 'Token de sesión de monday inválido.',
    })
    return sinAcceso()
  }

  const usuarioId = String(sesionMonday.userId)

  try {
    const { appId } = configSeguridad()

    /* 2. ¿Está en la Lista Blanca, activo y con esta app? */
    let habilitados: Perfil[]
    try {
      habilitados = await perfilesHabilitados(usuarioId)
    } catch (e) {
      if (!(e instanceof AccesoDenegado)) throw e
      await registrar('Acceso denegado', {
        usuarioId,
        email: await emailDeUsuario(usuarioId),
        cuentaId: sesionMonday.accountId,
        ip,
        detalle: e.detalle,
      })
      return sinAcceso()
    }

    const tokenPrevio = req.headers.get('x-sesion-app')
    const previa = await verificarSesionApp(tokenPrevio, usuarioId, appId)

    /* 3. ¿Con qué perfil? */
    let perfil: Perfil | undefined
    if (pedido.perfilId) {
      perfil = habilitados.find((p) => p.id === pedido.perfilId)
      if (!perfil) {
        await registrar('Acceso denegado', {
          usuarioId,
          cuentaId: sesionMonday.accountId,
          ip,
          detalle: `Eligió un perfil que no le corresponde (${String(pedido.perfilId).slice(0, 20)}).`,
        })
        return sinAcceso()
      }
    } else if (habilitados.length === 1) {
      perfil = habilitados[0]
    } else if (previa) {
      // Con varios perfiles, la sesión del día recuerda cuál eligió: no se pregunta de nuevo.
      perfil = habilitados.find((p) => p.id === previa.pid)
    }

    if (!perfil) {
      if (pedido.accion !== 'estado') return json(400, { estado: 'error' })
      const estados = await Promise.all(habilitados.map((p) => leerAutenticador(p.id)))
      return json(200, {
        estado: 'elegir_perfil',
        perfiles: habilitados.map((p, i) => ({
          ...publico(p),
          detalle: detalleTipo(p.tipoUsuario),
          configurado: p.autenticadorDesactivado || Boolean(estados[i]?.secretoCifrado),
        })),
      })
    }

    const base = {
      usuarioId,
      perfil: perfil.nombre,
      email: perfil.email,
      cuentaId: sesionMonday.accountId,
      ip,
    }
    const nuevaSesion = (mfa: boolean) => emitirSesion({ uid: usuarioId, pid: perfil.id, app: appId, mfa })

    /* 4. ¿Ya entró hoy? */
    if (previa && sesionAlcanza(previa, perfil)) {
      return json(200, { estado: 'listo', perfil: publico(perfil), sesion: tokenPrevio })
    }

    /* 5. Autenticador desactivado por el admin: entra sin código, y queda registrado. */
    if (perfil.autenticadorDesactivado) {
      await registrar('Ingreso sin autenticador', { ...base, detalle: 'Autenticador desactivado en la Lista Blanca.' })
      return json(200, { estado: 'listo', perfil: publico(perfil), sesion: await nuevaSesion(false) })
    }

    const autenticador = await leerAutenticador(perfil.id)

    switch (pedido.accion) {
      case 'estado':
        return json(200, {
          estado: autenticador?.secretoCifrado ? 'verificar' : 'configurar',
          perfil: publico(perfil),
        })

      case 'iniciar':
        return iniciar(perfil, autenticador)

      case 'confirmar':
        return confirmar(perfil, autenticador, pedido.codigo ?? '', base, nuevaSesion)

      case 'verificar':
        return verificar(perfil, autenticador, pedido, base, nuevaSesion)

      default:
        return json(400, { estado: 'error' })
    }
  } catch (e) {
    // Errores de configuración o de monday: se registran en el log del servidor y hacia afuera
    // se contesta sin detalles. Un stack trace en la respuesta es un mapa del sistema.
    console.error('[acceso]', e instanceof ErrorDeConfiguracion ? e.message : e)
    return json(500, { estado: 'error' })
  }
}

type Base = Parameters<typeof registrar>[1]
type EmitirSesion = (mfa: boolean) => Promise<string>

/* ------------------------------------------------------------------ *
 * Primera vez: QR y confirmación
 * ------------------------------------------------------------------ */

async function iniciar(perfil: Perfil, autenticador: EstadoAutenticador | null): Promise<Response> {
  // Con un secreto ya confirmado NO se genera otro: si se pudiera, cualquiera con la sesión de
  // monday de esta persona podría registrar su propio celular. Resetearlo es tarea del admin
  // (borrando la fila del perfil en el tablero del autenticador).
  if (autenticador?.secretoCifrado) return json(409, { estado: 'verificar', perfil: publico(perfil) })

  const secreto = nuevoSecretoTotp()
  await guardarAutenticador(perfil, autenticador, { pendienteCifrado: await cifrar(secreto) })

  const cuenta = perfil.nombreCompleto || perfil.nombre
  const etiqueta = encodeURIComponent(`${EMISOR}:${cuenta}`)
  const otpauth =
    `otpauth://totp/${etiqueta}?secret=${secreto}&issuer=${encodeURIComponent(EMISOR)}` +
    '&algorithm=SHA1&digits=6&period=30'

  return json(200, { estado: 'configurar', perfil: publico(perfil), otpauth, secreto })
}

async function confirmar(
  perfil: Perfil,
  autenticador: EstadoAutenticador | null,
  codigo: string,
  base: Base,
  nuevaSesion: EmitirSesion,
): Promise<Response> {
  if (autenticador?.secretoCifrado) return json(409, { estado: 'verificar', perfil: publico(perfil) })
  if (!autenticador?.pendienteCifrado) return json(409, { estado: 'configurar', perfil: publico(perfil) })

  if (estaBloqueado(autenticador)) {
    await registrar('Bloqueado por intentos', { ...base, detalle: 'Al configurar el autenticador.' })
    return json(429, { error: 'bloqueado' })
  }

  const periodo = await verificarTotp(await descifrar(autenticador.pendienteCifrado), codigo)
  if (periodo === null) {
    return fallo(perfil, autenticador, base, 'Código incorrecto al configurar el autenticador.')
  }

  const { codigos, hashes } = await generarCodigosRecuperacion()
  await guardarAutenticador(perfil, autenticador, {
    // El secreto confirmado es el MISMO texto cifrado que estaba pendiente: no hace falta
    // descifrarlo y volver a cifrarlo para moverlo de columna.
    secretoCifrado: autenticador.pendienteCifrado,
    pendienteCifrado: '',
    recuperacion: hashes,
    ultimoPeriodo: periodo,
    intentos: [],
    configuradoHoy: true,
  })
  await registrar('Autenticador configurado', base)

  return json(200, {
    estado: 'listo',
    perfil: publico(perfil),
    sesion: await nuevaSesion(true),
    codigosRecuperacion: codigos,
  })
}

/* ------------------------------------------------------------------ *
 * Cada día: código de 6 dígitos o de recuperación
 * ------------------------------------------------------------------ */

async function verificar(
  perfil: Perfil,
  autenticador: EstadoAutenticador | null,
  pedido: Pedido,
  base: Base,
  nuevaSesion: EmitirSesion,
): Promise<Response> {
  if (!autenticador?.secretoCifrado) return json(409, { estado: 'configurar', perfil: publico(perfil) })

  if (estaBloqueado(autenticador)) {
    await registrar('Bloqueado por intentos', { ...base, detalle: 'Intentó ingresar estando bloqueado.' })
    return json(429, { error: 'bloqueado' })
  }

  const codigo = pedido.codigo ?? ''

  if (pedido.recuperacion) {
    const restantes = await consumirCodigoRecuperacion(autenticador, codigo)
    if (!restantes) return fallo(perfil, autenticador, base, 'Código de recuperación incorrecto.')

    await guardarAutenticador(perfil, autenticador, { recuperacion: restantes, intentos: [] })
    await registrar('Código de recuperación usado', {
      ...base,
      detalle: `Le quedan ${restantes.length} códigos de recuperación.`,
    })
    return json(200, {
      estado: 'listo',
      perfil: publico(perfil),
      sesion: await nuevaSesion(true),
      recuperacionRestantes: restantes.length,
    })
  }

  const periodo = await verificarTotp(await descifrar(autenticador.secretoCifrado), codigo)
  if (periodo === null) return fallo(perfil, autenticador, base, 'Código incorrecto.')

  // Anti-reutilización: un código ya aceptado —o uno anterior— no vuelve a servir. Sin esto,
  // alguien que vea el código por encima del hombro tiene 30 segundos para usarlo también.
  if (periodo <= autenticador.ultimoPeriodo) {
    return fallo(perfil, autenticador, base, 'Código ya utilizado.')
  }

  await guardarAutenticador(perfil, autenticador, { ultimoPeriodo: periodo, intentos: [] })
  await registrar('Ingreso OK', base)
  return json(200, { estado: 'listo', perfil: publico(perfil), sesion: await nuevaSesion(true) })
}

/**
 * Código rechazado: suma el intento, lo registra y avisa si con éste quedó bloqueado.
 *
 * El motivo exacto —incorrecto, ya usado, de recuperación— queda en el registro; al usuario le
 * llega siempre "código incorrecto". Distinguir "ya usado" le diría a un atacante que acertó.
 */
async function fallo(
  perfil: Perfil,
  autenticador: EstadoAutenticador,
  base: Base,
  detalle: string,
): Promise<Response> {
  const intentos = [...intentosVigentes(autenticador), Date.now()]
  await guardarAutenticador(perfil, autenticador, { intentos })
  await registrar('Código incorrecto', { ...base, detalle })

  if (intentos.length >= MAX_INTENTOS) {
    await registrar('Bloqueado por intentos', { ...base, detalle: `${intentos.length} intentos en 15 minutos.` })
    return json(429, { error: 'bloqueado' })
  }
  return json(400, { error: 'codigo_incorrecto', intentosRestantes: MAX_INTENTOS - intentos.length })
}
