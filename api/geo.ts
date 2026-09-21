/**
 * Buscador de direcciones, para que la ubicación de entrega viaje a monday con coordenadas.
 *
 * Una columna de tipo *location* de monday **exige latitud y longitud**: con sólo la dirección
 * rechaza la escritura entera. Hasta acá la app mandaba las coordenadas en 0, así que la dirección
 * se leía bien pero el punto del mapa quedaba en el Golfo de Guinea y había que corregirlo a mano.
 *
 * Con este endpoint la app hace lo mismo que hace monday cuando se escribe en esa columna: ofrece
 * direcciones reales, la persona elige una, y se guarda con SUS coordenadas. El resultado en el
 * tablero es indistinguible de haberla elegido a mano —probado contra la API—.
 *
 * **Por qué Nominatim (OpenStreetMap)** y no Google: no necesita clave ni facturación, que es lo
 * único que hacía falta evitar acá. A cambio pide identificarse y no abusar (su política habla de
 * 1 pedido por segundo), y de eso se ocupan el `User-Agent` de abajo y el retardo del buscador en
 * la pantalla.
 *
 * **Qué sale de acá hacia afuera:** el texto que se escribe en el campo de dirección, nada más.
 * Ni el usuario, ni la cuenta, ni el contenedor, ni la OP.
 */
import { porton } from './_seguridad/porton'

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'

/** Nominatim pide identificar a quien consulta; sin esto puede devolver 403. */
const IDENTIFICACION = 'ImportacionBergerSA/1.0 (app de BERGER S.A. sobre monday.com)'

export const config = { runtime: 'edge' }

const error = (status: number, message: string): Response =>
  new Response(JSON.stringify({ errors: [{ message }] }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

/** Una dirección candidata, ya recortada a lo único que la app usa. */
interface Sugerencia {
  direccion: string
  lat: string
  lng: string
}

interface ResultadoNominatim {
  lat?: string
  lon?: string
  display_name?: string
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return error(405, 'Método no permitido.')

  // El mismo portón que el proxy de datos: sesión de monday, sesión del día y Lista Blanca.
  const paso = await porton(req)
  if (paso.rechazo) return paso.rechazo

  /* La ubicación de entrega la carga BERGER, así que este buscador es de ese módulo. Un
     despachante con sesión válida no puede usarlo para geocodificar lo que se le ocurra. */
  if (!paso.modulos.includes('aduanaBerger')) {
    return error(403, 'No tenés acceso a esta aplicación. Contactá al administrador.')
  }

  const consulta = (new URL(req.url).searchParams.get('q') ?? '').trim()
  // Con menos de tres letras cualquier búsqueda devuelve ruido: no vale el viaje.
  if (consulta.length < 3) return Response.json({ ubicaciones: [] })
  if (consulta.length > 200) return error(400, 'La dirección es demasiado larga.')

  const url = new URL(NOMINATIM)
  url.searchParams.set('q', consulta)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '6')
  /* Las entregas son en Argentina. Acotarlo mejora mucho los resultados: sin esto, "Córdoba"
     devuelve primero la de España. Si algún día hay que entregar afuera, se saca esta línea. */
  url.searchParams.set('countrycodes', 'ar')
  url.searchParams.set('accept-language', 'es')

  let respuesta: Response
  try {
    respuesta = await fetch(url, { headers: { 'User-Agent': IDENTIFICACION } })
  } catch {
    return error(502, 'No se pudo consultar el buscador de direcciones.')
  }
  if (!respuesta.ok) return error(502, 'El buscador de direcciones no está disponible.')

  const crudo = (await respuesta.json().catch(() => [])) as ResultadoNominatim[]
  const ubicaciones: Sugerencia[] = (Array.isArray(crudo) ? crudo : [])
    .filter((r) => r.lat && r.lon && r.display_name)
    .map((r) => ({ direccion: r.display_name!, lat: r.lat!, lng: r.lon! }))

  return Response.json({ ubicaciones })
}
