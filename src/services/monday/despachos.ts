/**
 * El tablero del Despachante de aduana, visto desde el módulo de Aduana.
 *
 * Acá el despachante no crea nada: toma las OP que ya existen —las creó el circuito de despacho—
 * y les va cargando cómo avanza la carga. Por eso este archivo sólo lee y actualiza.
 *
 * Se traen TODAS las OP y el filtro por estado o por número lo hace la pantalla: es un tablero que
 * crece de a una fila por despacho, así que filtrar en el navegador es instantáneo y no cuesta un
 * viaje a monday por cada tecla.
 */
import type { DespachoOP, EdicionDespacho } from '@/types'
import { COL_DESPACHANTE } from './columns'
import { aNumeroEspejo, fechaISO, porId, texto, type ColumnaCruda } from './parse'
import { mondayApi } from './sdk'

interface ItemCrudo {
  id: string
  name: string
  column_values: ColumnaCruda[]
}

interface PaginaCruda {
  cursor: string | null
  items: ItemCrudo[]
}

const COLUMNAS = [
  COL_DESPACHANTE.idDespacho,
  COL_DESPACHANTE.nroOp,
  COL_DESPACHANTE.estadoCarga,
  COL_DESPACHANTE.viaTransporte,
  COL_DESPACHANTE.nroDocTransporte,
  COL_DESPACHANTE.contenedorRef,
  COL_DESPACHANTE.eta,
  COL_DESPACHANTE.buque,
  COL_DESPACHANTE.observaciones,
  COL_DESPACHANTE.paisOrigen,
  COL_DESPACHANTE.proveedor,
  COL_DESPACHANTE.cantidadContenedores,
  COL_DESPACHANTE.despachante,
  COL_DESPACHANTE.ultimaActualizacion,
]

const PAGINA = 200
const MAX_PAGINAS = 25

function aDespacho(item: ItemCrudo): DespachoOP {
  const c = porId(item.column_values)
  return {
    id: item.id,
    nombre: item.name,
    idDespacho: texto(c[COL_DESPACHANTE.idDespacho]),
    nroOp: texto(c[COL_DESPACHANTE.nroOp]),
    estadoCarga: texto(c[COL_DESPACHANTE.estadoCarga]),
    viaTransporte: texto(c[COL_DESPACHANTE.viaTransporte]),
    nroDocTransporte: texto(c[COL_DESPACHANTE.nroDocTransporte]),
    contenedorRef: texto(c[COL_DESPACHANTE.contenedorRef]),
    eta: fechaISO(c[COL_DESPACHANTE.eta]),
    buque: texto(c[COL_DESPACHANTE.buque]),
    observaciones: texto(c[COL_DESPACHANTE.observaciones]),
    paisOrigen: texto(c[COL_DESPACHANTE.paisOrigen]),
    proveedor: texto(c[COL_DESPACHANTE.proveedor]),
    cantidadContenedores: aNumeroEspejo(texto(c[COL_DESPACHANTE.cantidadContenedores])),
    despachante: texto(c[COL_DESPACHANTE.despachante]),
    ultimaActualizacion: texto(c[COL_DESPACHANTE.ultimaActualizacion]),
  }
}

/** Todas las OP del tablero, de la más nueva a la más vieja. */
export async function despachosDeAduana(): Promise<DespachoOP[]> {
  const primera = await mondayApi<{ boards: { items_page: PaginaCruda }[] }>('despachosDeAduana', {
    columnas: COLUMNAS,
    limite: PAGINA,
  })

  const pagina = primera.boards?.[0]?.items_page
  if (!pagina) return []
  const items = [...pagina.items]

  let cursor = pagina.cursor
  for (let i = 0; cursor && i < MAX_PAGINAS; i += 1) {
    const siguiente = await mondayApi<{ next_items_page: PaginaCruda }>('despachosPaginaSiguiente', {
      cursor,
      columnas: COLUMNAS,
      limite: PAGINA,
    })
    items.push(...siguiente.next_items_page.items)
    cursor = siguiente.next_items_page.cursor
  }

  // El id de monday crece con el tiempo: ordenar por él descendente deja arriba lo último creado,
  // que es donde el despachante suele tener trabajo.
  return items.map(aDespacho).sort((a, b) => b.id.localeCompare(a.id))
}

/**
 * Traduce lo que el despachante editó al formato de cada tipo de columna de monday.
 *
 * Sólo viajan los campos que CAMBIARON: lo que no tocó no se manda, así que no puede pisar un
 * valor que alguien más haya actualizado en el tablero mientras tanto.
 */
export function valoresDeEdicion(cambios: Partial<EdicionDespacho>): Record<string, unknown> {
  const valores: Record<string, unknown> = {}

  if (cambios.nroOp !== undefined) valores[COL_DESPACHANTE.nroOp] = cambios.nroOp
  if (cambios.nroDocTransporte !== undefined) {
    valores[COL_DESPACHANTE.nroDocTransporte] = cambios.nroDocTransporte
  }
  if (cambios.contenedorRef !== undefined) {
    valores[COL_DESPACHANTE.contenedorRef] = cambios.contenedorRef
  }
  if (cambios.buque !== undefined) valores[COL_DESPACHANTE.buque] = cambios.buque
  if (cambios.observaciones !== undefined) {
    valores[COL_DESPACHANTE.observaciones] = { text: cambios.observaciones }
  }
  // Un dropdown o una fecha se VACÍAN con el objeto vacío, no con una cadena vacía: mandar `''`
  // devuelve un error de tipo y tira abajo toda la actualización del item.
  if (cambios.viaTransporte !== undefined) {
    valores[COL_DESPACHANTE.viaTransporte] = cambios.viaTransporte
      ? { labels: [cambios.viaTransporte] }
      : {}
  }
  if (cambios.eta !== undefined) {
    valores[COL_DESPACHANTE.eta] = cambios.eta ? { date: cambios.eta } : {}
  }
  if (cambios.estadoCarga !== undefined) {
    valores[COL_DESPACHANTE.estadoCarga] = cambios.estadoCarga ? { label: cambios.estadoCarga } : {}
  }

  return valores
}

/** Escribe los cambios de UNA OP. Devuelve el id, o lanza con el motivo. */
export async function actualizarDespacho(
  id: string,
  cambios: Partial<EdicionDespacho>,
): Promise<string> {
  const valores = valoresDeEdicion(cambios)
  if (Object.keys(valores).length === 0) throw new Error('No hay cambios para guardar.')

  await mondayApi('actualizarDespacho', { item: id, valores: JSON.stringify(valores) })
  return id
}
