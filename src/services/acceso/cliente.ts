/**
 * Cliente del endpoint de ingreso (`/api/acceso`).
 *
 * El navegador no decide nada: pregunta qué falta y muestra la pantalla que corresponde. Toda la
 * lógica —Lista Blanca, perfiles, autenticador, límites— vive en el servidor, que es el único
 * lugar donde no se puede saltear.
 */
import { sesionDelDia } from './sesionDelDia'

export interface PerfilIngreso {
  id: string
  nombre: string
}

export interface PerfilElegible extends PerfilIngreso {
  detalle: string
  configurado: boolean
}

/** Lo que devuelve el servidor, ya traducido a un paso de la pantalla. */
export type RespuestaIngreso =
  | { estado: 'sin_acceso' }
  | { estado: 'error' }
  | { estado: 'elegir_perfil'; perfiles: PerfilElegible[] }
  | { estado: 'configurar'; perfil: PerfilIngreso; otpauth?: string; secreto?: string }
  | { estado: 'verificar'; perfil: PerfilIngreso }
  | {
      estado: 'listo'
      perfil: PerfilIngreso
      sesion: string
      codigosRecuperacion?: string[]
      recuperacionRestantes?: number
    }
  | { estado: 'codigo_incorrecto'; intentosRestantes?: number }
  | { estado: 'bloqueado' }

export interface PedidoIngreso {
  accion: 'estado' | 'iniciar' | 'confirmar' | 'verificar'
  perfilId?: string
  codigo?: string
  recuperacion?: boolean
}

export interface ClienteIngreso {
  pedir: (pedido: PedidoIngreso) => Promise<RespuestaIngreso>
}

/** Cliente real: habla con el servidor con la sesión de monday y la del día. */
export const clienteIngreso: ClienteIngreso = {
  async pedir(pedido) {
    const { obtenerSessionToken } = await import('@/services/monday/sesion')

    let res: Response
    try {
      const sesion = sesionDelDia()
      res = await fetch('/api/acceso', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await obtenerSessionToken()}`,
          ...(sesion ? { 'X-Sesion-App': sesion } : {}),
        },
        body: JSON.stringify(pedido),
      })
    } catch {
      return { estado: 'error' }
    }

    const cuerpo = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (res.status === 403) return { estado: 'sin_acceso' }
    if (res.status === 429) return { estado: 'bloqueado' }
    if (cuerpo.error === 'codigo_incorrecto') {
      return { estado: 'codigo_incorrecto', intentosRestantes: cuerpo.intentosRestantes as number | undefined }
    }
    // 409: el estado cambió entre dos pasos (por ejemplo, ya estaba configurado). La respuesta
    // trae el estado correcto, así que se sigue desde ahí.
    if ((res.ok || res.status === 409) && typeof cuerpo.estado === 'string') {
      return cuerpo as unknown as RespuestaIngreso
    }
    return { estado: 'error' }
  },
}
