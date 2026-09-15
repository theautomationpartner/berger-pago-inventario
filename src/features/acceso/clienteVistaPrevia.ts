/**
 * Cliente de mentira del ingreso, SÓLO para ver las pantallas en localhost.
 *
 * En desarrollo no corren las funciones de `api/` —Vite no las ejecuta— y fuera de monday no hay
 * sesión, así que el ingreso real no se puede recorrer en local. Con `?vista-previa` en la URL se
 * usa este cliente, que simula las respuestas del servidor para revisar el diseño.
 *
 * No verifica nada ni genera secretos reales: el QR es de una clave al azar que no se guarda. Se
 * importa sólo dentro de una rama `import.meta.env.DEV`, así que no llega al build de producción.
 *
 * Para probar los mensajes: `000000` es siempre un código incorrecto.
 */
import type { ClienteIngreso, RespuestaIngreso } from '@/services/acceso/cliente'

const PERFILES = [
  { id: '1', nombre: 'Camila TAP', detalle: 'Administrador', configurado: false },
  { id: '2', nombre: 'Pamela TAP', detalle: 'Administrador', configurado: true },
]

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const azar = (n: number) =>
  Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => ALFABETO[b % 32]).join('')

const pausa = () => new Promise((r) => setTimeout(r, 450))

export const clienteVistaPrevia: ClienteIngreso = {
  async pedir(pedido): Promise<RespuestaIngreso> {
    await pausa()
    const perfil = PERFILES.find((p) => p.id === pedido.perfilId)

    if (!perfil) return { estado: 'elegir_perfil', perfiles: PERFILES }
    const publico = { id: perfil.id, nombre: perfil.nombre }

    switch (pedido.accion) {
      case 'estado':
        return perfil.configurado ? { estado: 'verificar', perfil: publico } : { estado: 'configurar', perfil: publico }

      case 'iniciar': {
        const secreto = azar(32)
        return {
          estado: 'configurar',
          perfil: publico,
          secreto,
          otpauth: `otpauth://totp/BERGER%20S.A.%3A${encodeURIComponent(perfil.nombre)}?secret=${secreto}&issuer=BERGER%20S.A.`,
        }
      }

      case 'confirmar':
        if (pedido.codigo === '000000') return { estado: 'codigo_incorrecto', intentosRestantes: 2 }
        return {
          estado: 'listo',
          perfil: publico,
          sesion: 'vista-previa',
          codigosRecuperacion: Array.from({ length: 10 }, () => `${azar(5)}-${azar(5)}`),
        }

      case 'verificar':
        if (pedido.codigo === '000000') return { estado: 'codigo_incorrecto', intentosRestantes: 4 }
        return {
          estado: 'listo',
          perfil: publico,
          sesion: 'vista-previa',
          ...(pedido.recuperacion ? { recuperacionRestantes: 9 } : {}),
        }
    }
  },
}
