/**
 * Proxy server-side hacia la API de Monday.
 *
 * Cumple tres funciones, y las tres son de seguridad:
 *
 * 1. El token de la API NO viaja en el bundle del navegador. En desarrollo lo resuelve el proxy
 *    de Vite con `VITE_MONDAY_TOKEN` (archivo local, fuera del repositorio); acá lo pone
 *    `MONDAY_TOKEN`, una variable de entorno del deploy que el cliente nunca ve.
 *
 * 2. Comprueba QUIÉN pregunta: sin un `sessionToken` de monday válido y de la cuenta habilitada,
 *    la request no llega a Monday. Abrir la URL del deploy en un navegador suelto no devuelve
 *    nada.
 *
 * 3. Comprueba QUÉ se pregunta. Antes reenviaba el cuerpo tal cual, y eso convertía a este
 *    endpoint en una API completa de la cuenta: cualquier usuario de BERGER con sesión —incluso
 *    uno de sólo lectura— podía abrir las herramientas del navegador y ejecutar la consulta que
 *    quisiera con el token de la cuenta. Ahora el cliente manda el NOMBRE de una operación del
 *    catálogo y el texto de la consulta lo pone este archivo, así que no se puede falsificar.
 *    Las variables, que sí siguen viniendo de afuera, las valida el propio catálogo.
 */
import { porton } from './_seguridad/porton'
import { OperacionInvalida, resolverOperacion } from '../src/services/monday/operaciones'

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

  // Portón: sesión de monday, sesión del día y Lista Blanca, ANTES de leer el cuerpo o de tocar el
  // token de la API. Devuelve además los módulos habilitados de quien pregunta.
  const paso = await porton(req)
  if (paso.rechazo) return paso.rechazo

  const token = process.env.MONDAY_TOKEN
  if (!token) return error(500, 'Falta MONDAY_TOKEN en el entorno.')

  let pedido: { operacion?: unknown; variables?: unknown }
  try {
    pedido = (await req.json()) as typeof pedido
  } catch {
    return error(400, 'El cuerpo del pedido no es JSON válido.')
  }

  /* Acá está el candado: la consulta sale del catálogo, no del cuerpo. Un cliente que mande su
     propio GraphQL no obtiene nada, porque este archivo no lee ningún campo `query`. */
  let query: string
  let variables: Record<string, unknown>
  let version = API_VERSION
  try {
    const operacion = resolverOperacion(pedido.operacion)
    /* Y acá está el segundo candado, el que separa a las dos poblaciones: la operación existe,
       pero tiene que pertenecer a un módulo que este perfil tenga habilitado. Un despachante que
       pida los pagos del inventario se choca con esto, aunque su pantalla no ofrezca el botón. */
    if (!paso.modulos.includes(operacion.modulo)) {
      return error(403, 'No tenés acceso a esta aplicación. Contactá al administrador.')
    }
    query = operacion.query
    version = operacion.apiVersion ?? API_VERSION
    variables = operacion.validar((pedido.variables ?? {}) as Record<string, unknown>)
  } catch (e: unknown) {
    if (e instanceof OperacionInvalida) return error(400, e.message)
    return error(400, 'Pedido inválido.')
  }

  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // El token del usuario NO se reenvía: acá se cambia por el de la cuenta, del lado servidor.
      Authorization: token,
      'API-Version': version,
    },
    body: JSON.stringify({ query, variables }),
  })

  return new Response(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
