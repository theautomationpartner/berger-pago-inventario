/**
 * Acceso a la API de Monday.
 *
 * El cliente NO arma consultas GraphQL: pide una operación por NOMBRE, de las que están en
 * `operaciones.ts`. En producción viaja sólo ese nombre más las variables, y el texto de la
 * consulta lo pone el proxy, que además valida las variables. Así `/api/monday` deja de ser una
 * API abierta de la cuenta: lo que no está en el catálogo, no se puede pedir.
 *
 * - En desarrollo pega contra `/monday-api` (y `/monday-file` para los binarios), los proxies de
 *   Vite hacia api.monday.com. Sin el proxy el navegador bloquea la request por CORS. Ahí la
 *   consulta se resuelve localmente, contra el mismo catálogo, y el token sale de `.env.local`
 *   —archivo que está en `.gitignore` y nunca llega al repositorio—.
 * - En producción pega contra `/api/monday` y `/api/monday-file`, funciones serverless que
 *   inyectan el token del lado del servidor (`MONDAY_TOKEN`), para que el secreto no quede
 *   incrustado en el bundle que descarga el navegador.
 */
import {
  MUTATION_ARCHIVO,
  resolverOperacion,
  type NombreOperacion,
  type Variables,
} from './operaciones'

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
 * Un `HTTP 500` pelado esconde justamente los errores más útiles: cuando falta una variable de
 * entorno, el proxy contesta con el motivo escrito en el JSON.
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

/**
 * Ejecuta una operación del catálogo y devuelve `data`.
 *
 * El cuerpo cambia según el entorno, y esa es toda la diferencia: en desarrollo se le manda a
 * monday la consulta ya resuelta —del otro lado está la API, que no sabe de nombres de
 * operación—; en producción se manda el nombre, y el que la resuelve y valida es el proxy.
 */
export async function mondayApi<T>(
  operacion: NombreOperacion,
  variables: Variables = {},
): Promise<T> {
  let cabecera: string
  try {
    cabecera = await autorizacion()
  } catch {
    throw new SinAcceso('No hay una sesión de monday activa.')
  }

  const cuerpo = import.meta.env.DEV
    ? (() => {
        const { query, validar } = resolverOperacion(operacion)
        // Se valida también en desarrollo: si una variable no pasa el filtro del servidor,
        // conviene enterarse acá y no recién cuando la app está publicada.
        return { query, variables: validar(variables) }
      })()
    : { operacion, variables }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: cabecera,
      'API-Version': API_VERSION,
    },
    body: JSON.stringify(cuerpo),
  })
  if (res.status === 401) throw new SinAcceso(await motivoDelFallo(res))
  if (!res.ok) throw new Error(await motivoDelFallo(res))

  const json = (await res.json()) as Respuesta<T>
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join(' · '))
  if (!json.data) throw new Error('Monday no devolvió datos.')
  return json.data
}

/**
 * Sube un archivo a una de las columnas de comprobante del circuito.
 *
 * Va por un endpoint aparte (`/v2/file`) y como `multipart/form-data`. El formato NO es el de la
 * especificación de GraphQL multipart: Monday espera la mutation en un campo `query` —con
 * `operations` contesta "query not found in multipart form"—, las variables como
 * `variables[nombre]`, y un `map` que asocia la parte binaria con la variable de archivo. Ese
 * `map` va como texto plano (`"variables.file"`), no como el array que pide la especificación.
 *
 * En producción el formulario NO lleva la mutation: lleva el item y la columna, y el proxy arma
 * el resto después de comprobar que la columna sea una de las tres de comprobante. El
 * `Content-Type` no se pone a mano en ningún caso: lo tiene que escribir el navegador, porque es
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

  const form = new FormData()
  if (import.meta.env.DEV) {
    form.append('query', MUTATION_ARCHIVO)
    form.append('map', JSON.stringify({ archivo: 'variables.file' }))
  }
  form.append('variables[itemId]', itemId)
  form.append('variables[columnId]', columnId)
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
