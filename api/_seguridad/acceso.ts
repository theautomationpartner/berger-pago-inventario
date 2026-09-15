/**
 * Decisiones de acceso, compartidas por el endpoint de ingreso (`/api/acceso`) y por los proxies
 * de datos (`/api/monday`, `/api/monday-file`).
 *
 * La regla de oro de este archivo: el MOTIVO de un rechazo es para el Registro de Accesos, nunca
 * para quien intenta entrar. Hacia afuera todos los rechazos son iguales. Decir "tu usuario está
 * inactivo" o "no tenés esta app habilitada" le confirma a alguien que está tanteando que el
 * usuario existe y qué hay adentro.
 */
import type { SesionMonday } from '../_guard'
import { configSeguridad, ETIQUETA } from './config'
import { habilitadoParaApp, leerPerfil, perfilesDeUsuario, type Perfil } from './listaBlanca'
import { registrar } from './registro'
import { verificarSesionApp, type SesionApp } from './sesionApp'

/** Rechazo de acceso. `detalle` va al registro; al usuario le llega un mensaje genérico. */
export class AccesoDenegado extends Error {
  constructor(readonly detalle: string) {
    super('Acceso denegado')
  }
}

/** La sesión del día falta, venció o no alcanza: hay que volver a pasar por el ingreso. */
export class SesionRequerida extends Error {}

/**
 * Perfiles con los que este usuario de monday puede entrar a ESTA app.
 *
 * Varias filas con el mismo ID de usuario sólo son válidas si TODAS son perfiles de administrador
 * (Tipo Usuario = ADMIN y Perfiles = SI). Si no, es un error de carga en la Lista Blanca —dos
 * personas distintas con el mismo usuario— y se rechaza: elegir una al azar le daría a alguien los
 * permisos de otro.
 */
export async function perfilesHabilitados(usuarioId: string): Promise<Perfil[]> {
  const { appId } = configSeguridad()
  const todos = await perfilesDeUsuario(usuarioId)
  const habilitados = todos.filter((p) => habilitadoParaApp(p, appId))

  if (todos.length === 0) throw new AccesoDenegado('No figura en la Lista Blanca.')
  if (habilitados.length === 0) {
    throw new AccesoDenegado(
      todos.some((p) => p.activo) ? 'No tiene esta app habilitada.' : 'Usuario inactivo.',
    )
  }
  if (
    habilitados.length > 1 &&
    !habilitados.every((p) => p.conPerfiles && p.tipoUsuario === ETIQUETA.ADMIN)
  ) {
    throw new AccesoDenegado(
      'Varias filas con el mismo ID de usuario sin ser todas ADMIN con Perfiles = SI.',
    )
  }
  return habilitados
}

/** ¿Esta sesión cumple lo que el perfil exige HOY? */
export const sesionAlcanza = (sesion: SesionApp, perfil: Perfil): boolean =>
  sesion.pid === perfil.id && (sesion.mfa || perfil.autenticadorDesactivado)

/**
 * Guardián de los proxies de datos: exige una sesión del día válida para un perfil habilitado.
 *
 * Vuelve a leer el perfil en CADA pedido. Es un viaje más a monday, y es lo que hace que dar de
 * baja a alguien —pasarlo a Inactivo, quitarle la app— corte su acceso en el acto y no recién
 * mañana, cuando venza su sesión. Lo mismo si el admin vuelve a encender el autenticador de alguien
 * que había entrado sin él.
 */
export async function exigirSesionApp(
  req: Request,
  sesionMonday: SesionMonday,
  ip: string,
): Promise<Perfil> {
  const { appId } = configSeguridad()
  const usuarioId = String(sesionMonday.userId)

  const sesion = await verificarSesionApp(req.headers.get('x-sesion-app'), usuarioId, appId)
  if (!sesion) throw new SesionRequerida('Falta la sesión del día.')

  const perfil = await leerPerfil(sesion.pid)
  if (!perfil || perfil.usuarioId !== usuarioId || !habilitadoParaApp(perfil, appId)) {
    await registrar('Acceso denegado', {
      usuarioId,
      perfil: perfil?.nombre,
      email: perfil?.email,
      cuentaId: sesionMonday.accountId,
      ip,
      detalle: 'Perfil dado de baja o sin la app mientras tenía una sesión abierta.',
    })
    throw new AccesoDenegado('Perfil dado de baja durante la sesión.')
  }

  if (!sesionAlcanza(sesion, perfil)) throw new SesionRequerida('El perfil ahora exige el autenticador.')
  return perfil
}
