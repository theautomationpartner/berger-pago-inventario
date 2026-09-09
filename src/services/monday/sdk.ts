/**
 * Acceso a la API de Monday por HTTP.
 *
 * - En desarrollo pega contra `/monday-api` (y `/monday-file` para los binarios), los proxies de
 *   Vite hacia api.monday.com. Sin el proxy el navegador bloquea la request por CORS. El token
 *   sale de `.env.local` (`VITE_MONDAY_TOKEN`), archivo que está en `.gitignore` y nunca llega
 *   al repositorio.
 * - En producción pega contra `/api/monday` y `/api/monday-file`, funciones serverless que
 *   inyectan el token del lado del servidor (`MONDAY_TOKEN`), para que el secreto no quede
 *   incrustado en el bundle que descarga el navegador.
 */
const TOKEN = (import.meta.env.VITE_MONDAY_TOKEN as string | undefined)?.trim() || undefined

const ENDPOINT = import.meta.env.DEV ? '/monday-api' : '/api/monday'
const ENDPOINT_ARCHIVO = import.meta.env.DEV ? '/monday-file' : '/api/monday-file'
const API_VERSION = '2024-10'

/**
 * En desarrollo hay acceso real sólo si hay token local. En producción la autenticación la
 * resuelve el proxy server-side, así que se asume habilitado.
 */
export const mondayHabilitado = (): boolean => (import.meta.env.DEV ? Boolean(TOKEN) : true)

interface ApiError {
  message: string
}

interface Respuesta<T> {
  data?: T
  errors?: ApiError[]
}

/** Falla de autorización: el pedido no viene de una sesión válida de monday. */
export class SinAcceso extends Error {}

/**
 * Saca el motivo real de una respuesta fallida.
 *
 * Un `HTTP 500` pelado esconde justamente los errores más útiles: cuando falta la variable de
 * entorno del token, el proxy contesta 500 con el motivo escrito en el JSON.
 */
async function motivoDelFallo(res: Response): Promise<string> {
  const cuerpo = await res.text().catch(() => '')
  try {
    const json = JSON.parse(cuerpo) as Respuesta<unknown>
    const mensajes = json.errors?.map((e) => e.message).filter(Boolean)
    if (mensajes?.length) return mensajes.join(' · ')
  } catch {
    // Cuerpo que no es JSON (una página de error del hosting): se usa tal cual.
  }
  const recorte = cuerpo.trim().slice(0, 200)
  return recorte ? `HTTP ${res.status} · ${recorte}` : `HTTP ${res.status}`
}

/**
 * Cabecera de autorización.
 *
 * En desarrollo va el token personal de `.env.local`, porque el pedido sale directo contra la
 * API por el proxy de Vite. En producción va el `sessionToken` de monday, que NO sirve para
 * consultar la API: sirve para que el proxy compruebe que del otro lado hay un usuario real de
 * la cuenta habilitada, y recién ahí lo cambia por el token de la cuenta.
 */
async function autorizacion(): Promise<string> {
  if (import.meta.env.DEV) return TOKEN ?? ''
  const { obtenerSessionToken } = await import('./sesion')
  return `Bearer ${await obtenerSessionToken()}`
}

/** Ejecuta una query/mutation y devuelve `data`; lanza con el mensaje de Monday si falla. */
export async function mondayApi<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  let cabecera: string
  try {
    cabecera = await autorizacion()
  } catch {
    throw new SinAcceso('No hay una sesión de monday activa.')
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: cabecera,
      'API-Version': API_VERSION,
    },
    body: JSON.stringify({ query, variables: variables ?? {} }),
  })
  if (res.status === 401) throw new SinAcceso(await motivoDelFallo(res))
  if (!res.ok) throw new Error(await motivoDelFallo(res))

  const json = (await res.json()) as Respuesta<T>
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join(' · '))
  if (!json.data) throw new Error('Monday no devolvió datos.')
  return json.data
}

/**
 * Sube un archivo a una columna de tipo `file`.
 *
 * Va por un endpoint aparte (`/v2/file`) y como `multipart/form-data`. El formato NO es el de la
 * especificación de GraphQL multipart: Monday espera la mutation en un campo `query` —con
 * `operations` contesta "query not found in multipart form"—, las variables como
 * `variables[nombre]`, y un `map` que asocia la parte binaria con la variable de archivo. Ese
 * `map` va como texto plano (`"variables.file"`), no como el array que pide la especificación.
 *
 * El `Content-Type` no se pone a mano a propósito: lo tiene que escribir el navegador, porque es
 * lo único que incluye el `boundary` del multipart.
 */
export async function subirArchivoAColumna(
  itemId: string,
  columnId: string,
  archivo: File,
): Promise<string> {
  let cabecera: string
  try {
    cabecera = await autorizacion()
  } catch {
    throw new SinAcceso('No hay una sesión de monday activa.')
  }

  const query =
    'mutation ($itemId: ID!, $columnId: String!, $file: File!) {' +
    ' add_file_to_column (item_id: $itemId, column_id: $columnId, file: $file) { id } }'

  const form = new FormData()
  form.append('query', query)
  form.append('variables[itemId]', itemId)
  form.append('variables[columnId]', columnId)
  form.append('map', JSON.stringify({ archivo: 'variables.file' }))
  form.append('archivo', archivo, archivo.name)

  const res = await fetch(ENDPOINT_ARCHIVO, {
    method: 'POST',
    headers: { Authorization: cabecera, 'API-Version': API_VERSION },
    body: form,
  })
  if (res.status === 401) throw new SinAcceso(await motivoDelFallo(res))
  if (!res.ok) throw new Error(await motivoDelFallo(res))

  const json = (await res.json()) as Respuesta<{ add_file_to_column: { id: string } | null }>
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join(' · '))
  const id = json.data?.add_file_to_column?.id
  if (!id) throw new Error('Monday no confirmó la subida del archivo.')
  return id
}
