/**
 * Proxy server-side hacia la API de Monday para el deploy.
 *
 * Cumple dos funciones, y las dos son de seguridad:
 *
 * 1. El token de la API NO viaja en el bundle del navegador. En desarrollo lo resuelve el proxy
 *    de Vite con `VITE_MONDAY_TOKEN` (archivo local, fuera del repositorio); acá lo pone
 *    `MONDAY_TOKEN`, una variable de entorno del deploy que el cliente nunca ve.
 *
 * 2. Es el único camino a los datos, así que es el lugar donde se comprueba quién pregunta. Sin
 *    un `sessionToken` de monday válido y de la cuenta habilitada, la request no llega a Monday:
 *    abrir la URL del deploy en un navegador suelto no devuelve nada.
 */
import { MalConfigurado, NoAutorizado, verificarSesion } from './_guard'

const API = 'https://api.monday.com/v2'
const API_VERSION = '2024-10'

/**
 * Runtime declarado a mano. Sin esto Vercel toma el runtime de Node, que espera la firma
 * `(req, res)` de Express y no la de `Request`/`Response` que usa este handler: el deploy
 * compila igual y la función falla recién en la primera llamada.
 */
export const config = { runtime: 'edge' }

/** Respuesta de error con la forma que ya entiende el cliente (`{ errors: [{ message }] }`). */
const error = (status: number, message: string): Response =>
  new Response(JSON.stringify({ errors: [{ message }] }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return error(405, 'Método no permitido.')

  // Portón: se verifica ANTES de leer el cuerpo o de tocar el token de la API.
  try {
    await verificarSesion(req.headers.get('authorization'))
  } catch (e: unknown) {
    if (e instanceof NoAutorizado) return error(401, e.message)
    if (e instanceof MalConfigurado) return error(500, e.message)
    return error(401, 'No se pudo validar la sesión de monday.')
  }

  const token = process.env.MONDAY_TOKEN
  if (!token) return error(500, 'Falta MONDAY_TOKEN en el entorno.')

  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // El token del usuario NO se reenvía: acá se cambia por el de la cuenta, del lado servidor.
      Authorization: token,
      'API-Version': API_VERSION,
    },
    body: await req.text(),
  })

  return new Response(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
