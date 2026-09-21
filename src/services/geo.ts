/**
 * Búsqueda de direcciones para la ubicación de entrega.
 *
 * La columna *location* de monday no acepta una dirección suelta: exige latitud y longitud. Para
 * que el punto caiga donde tiene que caer, la dirección se ELIGE de una lista en vez de
 * escribirse libre, igual que cuando se carga desde monday.
 *
 * En producción la consulta pasa por `/api/geo`, que aplica el mismo control de acceso que el
 * resto y le pone al pedido la identificación que exige OpenStreetMap. En desarrollo va por el
 * proxy de Vite, porque las funciones de `api/` no corren con `npm run dev`.
 */
import { sesionDelDia } from './acceso/sesionDelDia'

/** Una dirección candidata, con las coordenadas que monday necesita. */
export interface Ubicacion {
  direccion: string
  lat: string
  lng: string
}

export async function buscarUbicaciones(consulta: string): Promise<Ubicacion[]> {
  const texto = consulta.trim()
  if (texto.length < 3) return []

  if (import.meta.env.DEV) {
    const url =
      '/geo-api/search?format=jsonv2&limit=6&countrycodes=ar&accept-language=es&q=' +
      encodeURIComponent(texto)
    const res = await fetch(url)
    if (!res.ok) throw new Error('No se pudo buscar la dirección.')
    const crudo = (await res.json()) as { lat?: string; lon?: string; display_name?: string }[]
    return (Array.isArray(crudo) ? crudo : [])
      .filter((r) => r.lat && r.lon && r.display_name)
      .map((r) => ({ direccion: r.display_name!, lat: r.lat!, lng: r.lon! }))
  }

  const { obtenerSessionToken } = await import('./monday/sesion')
  const sesion = sesionDelDia()
  const res = await fetch(`/api/geo?q=${encodeURIComponent(texto)}`, {
    headers: {
      Authorization: `Bearer ${await obtenerSessionToken()}`,
      ...(sesion ? { 'X-Sesion-App': sesion } : {}),
    },
  })
  if (!res.ok) throw new Error('No se pudo buscar la dirección.')
  const json = (await res.json()) as { ubicaciones?: Ubicacion[] }
  return json.ubicaciones ?? []
}
