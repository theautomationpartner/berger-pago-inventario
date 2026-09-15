/**
 * Sesión de la app: la prueba de que un perfil pasó la Lista Blanca y el autenticador HOY.
 *
 * Es un token firmado por el servidor (HMAC-SHA256 con una clave derivada de la maestra), no un
 * registro en una base de datos. Lleva adentro quién es, qué perfil eligió, para qué app, si pasó
 * por el autenticador, y el DÍA en que se emitió. Vale sólo ese día calendario en Argentina: al día
 * siguiente, el primer ingreso vuelve a pedir el código.
 *
 * Se guarda en el `localStorage` del navegador y viaja en la cabecera `X-Sesion-App`, NO en una
 * cookie. Dentro del iframe de monday la app corre en otro dominio, y los navegadores bloquean o
 * aíslan las cookies de terceros de forma distinta cada uno —Safari la primera—: con una cookie la
 * sesión funcionaría en una computadora y se perdería en otra sin explicación.
 *
 * Que el token esté firmado no reemplaza revisar la Lista Blanca: cada pedido vuelve a leer el
 * perfil, así que dar de baja a alguien corta su acceso en el acto, aunque tenga el token del día.
 */
import { aBase64Url, claveDerivada, desdeBase64Url, hmacSha256, igualesSeguro } from './cripto'
import { ZONA_HORARIA } from './config'

export interface SesionApp {
  v: 1
  /** ID de usuario de monday. */
  uid: string
  /** ID del perfil en la Lista Blanca. */
  pid: string
  app: string
  /** Día de emisión, `AAAA-MM-DD` en hora de Argentina. */
  dia: string
  /** Si el perfil pasó por el autenticador. `false` sólo cuando el admin lo tiene desactivado. */
  mfa: boolean
  /** Momento de emisión, en segundos. */
  iat: number
}

/** Día calendario de hoy en Argentina. */
export function hoyArgentina(ahora = new Date()): string {
  // `en-CA` formatea como AAAA-MM-DD, que es justo la forma que se compara.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora)
}

const encoder = new TextEncoder()

async function firmar(datos: string): Promise<string> {
  return aBase64Url(await hmacSha256(await claveDerivada('sesion-app'), encoder.encode(datos)))
}

export async function emitirSesion(datos: Omit<SesionApp, 'v' | 'dia' | 'iat'>): Promise<string> {
  const sesion: SesionApp = {
    v: 1,
    ...datos,
    dia: hoyArgentina(),
    iat: Math.floor(Date.now() / 1000),
  }
  const cuerpo = aBase64Url(encoder.encode(JSON.stringify(sesion)))
  return `${cuerpo}.${await firmar(cuerpo)}`
}

/**
 * Verifica una sesión y devuelve su contenido, o `null`.
 *
 * Tiene que coincidir TODO: la firma, el día de hoy, el usuario de monday que hace el pedido y la
 * app. Una sesión válida de ayer, de otro usuario o de otra app es exactamente igual a no tener
 * sesión.
 */
export async function verificarSesionApp(
  token: string | null | undefined,
  usuarioId: string,
  appId: string,
): Promise<SesionApp | null> {
  if (!token) return null
  const [cuerpo, firma] = token.split('.')
  if (!cuerpo || !firma) return null
  if (!igualesSeguro(firma, await firmar(cuerpo))) return null

  let sesion: SesionApp
  try {
    sesion = JSON.parse(new TextDecoder().decode(desdeBase64Url(cuerpo))) as SesionApp
  } catch {
    return null
  }

  if (sesion.v !== 1) return null
  if (sesion.dia !== hoyArgentina()) return null
  if (sesion.uid !== usuarioId) return null
  if (sesion.app !== appId) return null
  return sesion
}
