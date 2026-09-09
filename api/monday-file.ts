/**
 * Proxy server-side para la SUBIDA DE ARCHIVOS a Monday.
 *
 * Es un handler aparte de `/api/monday` porque Monday separa los binarios de la API GraphQL: van
 * a `/v2/file` como `multipart/form-data`. La diferencia práctica es que acá el cuerpo NO se
 * puede leer como texto ni volver a serializar —eso rompería el `boundary` del multipart—, así
 * que se reenvía el stream tal cual y se copia el `Content-Type` original, que es el único lugar
 * donde viaja ese `boundary`.
 *
 * El control de acceso es el mismo que el del otro proxy: sin `sessionToken` válido de la cuenta
 * habilitada, no se sube nada.
 */
import { MalConfigurado, NoAutorizado, verificarSesion } from './_guard'

const API_ARCHIVO = 'https://api.monday.com/v2/file'
const API_VERSION = '2024-10'

export const config = { runtime: 'edge' }

const error = (status: number, message: string): Response =>
  new Response(JSON.stringify({ errors: [{ message }] }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return error(405, 'Método no permitido.')

  try {
    await verificarSesion(req.headers.get('authorization'))
  } catch (e: unknown) {
    if (e instanceof NoAutorizado) return error(401, e.message)
    if (e instanceof MalConfigurado) return error(500, e.message)
    return error(401, 'No se pudo validar la sesión de monday.')
  }

  const token = process.env.MONDAY_TOKEN
  if (!token) return error(500, 'Falta MONDAY_TOKEN en el entorno.')

  const contentType = req.headers.get('content-type')
  if (!contentType?.startsWith('multipart/form-data')) {
    return error(400, 'La subida de archivos tiene que ser multipart/form-data.')
  }

  const res = await fetch(API_ARCHIVO, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      Authorization: token,
      'API-Version': API_VERSION,
    },
    body: req.body,
    // Requerido por `fetch` cuando el cuerpo es un stream y no un valor ya materializado.
    duplex: 'half',
  } as RequestInit & { duplex: 'half' })

  return new Response(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
