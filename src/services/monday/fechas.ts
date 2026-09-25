/**
 * Fechas de producción: el ida y vuelta con el proveedor.
 *
 * El proveedor informa una fecha de producción para cada tractor. BERGER la acepta —y el tractor
 * queda listo para despacharse— o le propone otra, y la pelota vuelve al proveedor.
 *
 * La app escribe TRES columnas del Inventario y ninguna más: el estado de confirmación, el estado
 * de la fecha y la fecha propuesta. Todo lo demás de ese tablero lo manejan otros circuitos.
 */
import type { DecisionFecha, TractorFecha } from '@/types'
import { COL_INV, ESTADO_FECHA, ESTADO_FECHA_INDEX, ESTADO_FECHA_PROD } from './columns'
import { aNumeroEspejo, espejo, fechaISO, porId, texto, type ColumnaCruda } from './parse'
import { mondayApi } from './sdk'

/** Una board_relation expone los items conectados sólo con este fragmento. */
interface ColumnaConexion extends ColumnaCruda {
  linked_item_ids?: string[] | null
}

interface ItemCrudo {
  id: string
  name: string
  column_values: ColumnaConexion[]
}

interface PaginaCruda {
  cursor: string | null
  items: ItemCrudo[]
}

const COLUMNAS = [
  COL_INV.modelo,
  COL_INV.numInterno,
  COL_INV.primaryStatus,
  COL_INV.primaryStatusEsp,
  COL_INV.tipoRodado,
  COL_INV.precioUnitario,
  COL_INV.fechaProd,
  COL_INV.fechaPropuesta,
  COL_INV.confirmacionFecha,
  COL_INV.estadoFechaProd,
  COL_INV.confirmacion,
]

const PAGINA = 200
const MAX_PAGINAS = 25

export function aTractorFecha(item: ItemCrudo): TractorFecha {
  const c = porId(item.column_values) as Record<string, ColumnaConexion | undefined>
  return {
    id: item.id,
    nombre: item.name,
    // Modelo y precio son mirrors: su valor vive en `display_value`, nunca en `text`.
    modelo: espejo(c[COL_INV.modelo]),
    numInterno: texto(c[COL_INV.numInterno]),
    primaryStatus: texto(c[COL_INV.primaryStatus]),
    primaryStatusEsp: texto(c[COL_INV.primaryStatusEsp]),
    tipoRodado: texto(c[COL_INV.tipoRodado]),
    precioUnitario: aNumeroEspejo(espejo(c[COL_INV.precioUnitario])),
    fechaProd: fechaISO(c[COL_INV.fechaProd]),
    fechaPropuesta: fechaISO(c[COL_INV.fechaPropuesta]),
    estadoConfirmacion: texto(c[COL_INV.confirmacionFecha]),
    estadoFecha: texto(c[COL_INV.estadoFechaProd]),
    confirmacionId: c[COL_INV.confirmacion]?.linked_item_ids?.[0] ?? null,
  }
}

/** Las columnas que lee este módulo. También las usa la lectura por ids. */
export const COLUMNAS_FECHA = COLUMNAS

/**
 * Los tractores que esperan una decisión sobre su fecha.
 *
 * Se piden por índice a monday —lo único que entiende— y se vuelve a comprobar la etiqueta acá.
 * Los que NO tienen fecha de producción se dejan afuera: no hay nada que confirmar ni contra qué
 * comparar una propuesta, y ofrecerlos sería invitar a decidir sobre un dato que no existe.
 */
export async function tractoresPendientesDeFecha(): Promise<TractorFecha[]> {
  const primera = await mondayApi<{ boards: { items_page: PaginaCruda }[] }>(
    'inventarioPorEstadoFecha',
    {
      columnas: COLUMNAS,
      estado: [ESTADO_FECHA_INDEX[ESTADO_FECHA.PEND_CONFIRMAR]],
      limite: PAGINA,
    },
  )

  const pagina = primera.boards?.[0]?.items_page
  if (!pagina) return []
  const items = [...pagina.items]

  let cursor = pagina.cursor
  for (let i = 0; cursor && i < MAX_PAGINAS; i += 1) {
    const siguiente = await mondayApi<{ next_items_page: PaginaCruda }>(
      'inventarioPaginaSiguiente',
      { cursor, columnas: COLUMNAS, limite: PAGINA },
    )
    items.push(...siguiente.next_items_page.items)
    cursor = siguiente.next_items_page.cursor
  }

  return items
    .map(aTractorFecha)
    .filter((t) => t.estadoConfirmacion === ESTADO_FECHA.PEND_CONFIRMAR && Boolean(t.fechaProd))
    .sort(
      (a, b) => a.fechaProd.localeCompare(b.fechaProd) || a.nombre.localeCompare(b.nombre, 'es'),
    )
}

/** Tractores del Inventario por id: los que cuelgan de una confirmación. */
export async function tractoresPorIds(ids: string[]): Promise<TractorFecha[]> {
  const unicos = [...new Set(ids.filter(Boolean))]
  if (unicos.length === 0) return []
  const r = await mondayApi<{ items: ItemCrudo[] }>('inventarioPorIds', {
    ids: unicos,
    columnas: COLUMNAS,
  })
  return (r.items ?? []).map(aTractorFecha)
}

/**
 * Escribe la decisión sobre un tractor.
 *
 * Los dos estados y la fecha van en la MISMA escritura: son una sola decisión, y separarlas deja
 * al tractor con un estado que no se corresponde con su fecha aunque sea por un instante.
 *
 * - **Confirmar**: la fecha del proveedor se acepta tal cual. No se toca la fecha propuesta: no hay
 *   ninguna propuesta que hacer.
 * - **Proponer**: se guarda la fecha nueva y el tractor vuelve a quedar esperando al proveedor.
 */
export async function decidirFecha(
  tractor: TractorFecha,
  decision: DecisionFecha,
): Promise<string> {
  const valores =
    decision.tipo === 'confirmar'
      ? {
          [COL_INV.confirmacionFecha]: { label: ESTADO_FECHA.CONFIRMADA },
          [COL_INV.estadoFechaProd]: { label: ESTADO_FECHA_PROD.ACEPTADA },
        }
      : {
          [COL_INV.fechaPropuesta]: { date: decision.fecha },
          [COL_INV.confirmacionFecha]: { label: ESTADO_FECHA.A_CONFIRMAR },
          [COL_INV.estadoFechaProd]: { label: ESTADO_FECHA_PROD.PROPUESTA },
        }

  await mondayApi('actualizarFechaProduccion', {
    item: tractor.id,
    valores: JSON.stringify(valores),
  })
  return tractor.id
}

/** URL del Inventario, para los enlaces "ver en monday". */
export const URL_TABLERO_INVENTARIO = 'https://maquinariasagricolas.monday.com/boards/18428578101'
