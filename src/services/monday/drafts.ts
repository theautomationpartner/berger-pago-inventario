/**
 * El tablero de Drafts: lo que el proveedor va a fabricar, antes de que el tractor exista.
 *
 * La app lee los drafts con sus productos y escribe DOS columnas: el período de producción
 * sugerido y el estado. Todo lo demás —importes, condición de entrega, transporte— lo cargó la
 * automatización que lee el PDF, y corregirlo desde acá taparía un problema de lectura.
 */
import { condicionDeTransporte, rotuloTransporte } from '@/lib/drafts'
import type { Draft, ProductoDraft } from '@/types'
import {
  COL_DRAFT,
  COL_DRAFT_SUB,
  DRAFT_ESTADO,
  DRAFT_ESTADO_INDEX,
  TABLEROS,
} from './columns'
import { aNumeroEspejo, fechaISO, porId, texto, type ColumnaCruda } from './parse'
import { mondayApi } from './sdk'

interface SubitemCrudo {
  id: string
  name: string
  column_values: ColumnaCruda[]
}

interface ItemCrudo {
  id: string
  name: string
  column_values: ColumnaCruda[]
  subitems: SubitemCrudo[] | null
}

interface PaginaCruda {
  cursor: string | null
  items: ItemCrudo[]
}

const COLUMNAS = [
  COL_DRAFT.idDraft,
  COL_DRAFT.estado,
  COL_DRAFT.lectura,
  COL_DRAFT.periodo,
  COL_DRAFT.fecha,
  COL_DRAFT.ordenPedido,
  COL_DRAFT.condicionEntrega,
  COL_DRAFT.transporte,
  COL_DRAFT.formaPago,
  COL_DRAFT.divisa,
  COL_DRAFT.transporteFob,
  COL_DRAFT.transporteFca,
  COL_DRAFT.total,
]

const COLUMNAS_SUB = [
  COL_DRAFT_SUB.rodado,
  COL_DRAFT_SUB.cantidad,
  COL_DRAFT_SUB.precioUnitario,
  COL_DRAFT_SUB.costoFob,
  COL_DRAFT_SUB.costoFca,
  COL_DRAFT_SUB.valorNeto,
  COL_DRAFT_SUB.subtotal,
]

const PAGINA = 200
const MAX_PAGINAS = 25

/** El costo de transporte del producto, según la condición de entrega del draft que lo contiene. */
function aProducto(s: SubitemCrudo, condicion: 'FOB' | 'FCA' | null): ProductoDraft {
  const c = porId(s.column_values)
  const costo =
    condicion === 'FCA' ? c[COL_DRAFT_SUB.costoFca] : condicion === 'FOB' ? c[COL_DRAFT_SUB.costoFob] : undefined
  return {
    id: s.id,
    nombre: s.name,
    rodado: texto(c[COL_DRAFT_SUB.rodado]),
    cantidad: aNumeroEspejo(texto(c[COL_DRAFT_SUB.cantidad])),
    precioUnitario: aNumeroEspejo(texto(c[COL_DRAFT_SUB.precioUnitario])),
    costoTransporte: costo ? aNumeroEspejo(texto(costo)) : null,
    valorNeto: aNumeroEspejo(texto(c[COL_DRAFT_SUB.valorNeto])),
    subtotal: aNumeroEspejo(texto(c[COL_DRAFT_SUB.subtotal])),
  }
}

function aDraft(item: ItemCrudo): Draft {
  const c = porId(item.column_values)
  const condicionEntrega = texto(c[COL_DRAFT.condicionEntrega])
  const cual = condicionDeTransporte(condicionEntrega)

  return {
    id: item.id,
    nombre: item.name,
    idDraft: texto(c[COL_DRAFT.idDraft]),
    estado: texto(c[COL_DRAFT.estado]),
    lectura: texto(c[COL_DRAFT.lectura]),
    periodo: texto(c[COL_DRAFT.periodo]),
    fecha: fechaISO(c[COL_DRAFT.fecha]),
    ordenPedido: texto(c[COL_DRAFT.ordenPedido]),
    condicionEntrega,
    transporte: texto(c[COL_DRAFT.transporte]),
    formaPago: texto(c[COL_DRAFT.formaPago]),
    divisa: texto(c[COL_DRAFT.divisa]),
    costoTransporte:
      cual === 'FCA'
        ? aNumeroEspejo(texto(c[COL_DRAFT.transporteFca]))
        : cual === 'FOB'
          ? aNumeroEspejo(texto(c[COL_DRAFT.transporteFob]))
          : null,
    rotuloTransporte: rotuloTransporte(condicionEntrega),
    total: aNumeroEspejo(texto(c[COL_DRAFT.total])),
    productos: (item.subitems ?? []).map((s) => aProducto(s, cual)),
  }
}

/**
 * Los drafts que están en un estado, con sus productos.
 *
 * Como en el resto de la app, el filtro se manda a monday por ÍNDICE —que es lo único que
 * entiende— y la etiqueta se vuelve a comparar acá: si cambia el orden de las etiquetas, la app
 * trae de más y filtra bien, y nunca muestra un draft que no corresponde.
 */
export async function draftsPorEstado(estado: string): Promise<Draft[]> {
  const indice = DRAFT_ESTADO_INDEX[estado]
  const primera = await mondayApi<{ boards: { items_page: PaginaCruda }[] }>('draftsPorEstado', {
    estado: indice == null ? [] : [indice],
    columnas: COLUMNAS,
    colsSub: COLUMNAS_SUB,
    limite: PAGINA,
  })

  const pagina = primera.boards?.[0]?.items_page
  if (!pagina) return []
  const items = [...pagina.items]

  let cursor = pagina.cursor
  for (let i = 0; cursor && i < MAX_PAGINAS; i += 1) {
    const siguiente = await mondayApi<{ next_items_page: PaginaCruda }>('draftsPaginaSiguiente', {
      cursor,
      columnas: COLUMNAS,
      colsSub: COLUMNAS_SUB,
      limite: PAGINA,
    })
    items.push(...siguiente.next_items_page.items)
    cursor = siguiente.next_items_page.cursor
  }

  return items
    .map(aDraft)
    .filter((d) => d.estado === estado)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }))
}

/** Los drafts de las dos etapas, para el dashboard: pendientes y ya planificados. */
export async function draftsDePlanificacion(): Promise<Draft[]> {
  const [pendientes, planificados] = await Promise.all([
    draftsPorEstado(DRAFT_ESTADO.PEND_PLANIFICAR),
    draftsPorEstado(DRAFT_ESTADO.PLANIFICADA),
  ])
  return [...pendientes, ...planificados]
}

/**
 * Le pone el período a un draft y lo pasa a "Periodo Prod Planificada".
 *
 * Las dos cosas van en la MISMA escritura: son dos lecturas del mismo hecho —para cuándo se pidió
 * y en qué etapa quedó—, y separarlas abre una ventana en la que el draft figura planificado sin
 * período, que es justamente lo que la operación siguiente no sabría mandar.
 */
export async function planificarDraft(id: string, periodo: string): Promise<string> {
  await mondayApi('actualizarDraft', {
    item: id,
    valores: JSON.stringify({
      [COL_DRAFT.periodo]: { labels: [periodo] },
      [COL_DRAFT.estado]: { label: DRAFT_ESTADO.PLANIFICADA },
    }),
  })
  return id
}

/** El tablero de Drafts, por si hace falta enlazarlo. */
export const URL_TABLERO_DRAFTS = `https://maquinariasagricolas.monday.com/boards/${TABLEROS.drafts}`
