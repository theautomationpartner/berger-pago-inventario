/**
 * Lectura del tablero de Inventario, para las dos modalidades de despacho:
 *
 * - ANTICIPADO: los tractores con Estado Pago en "Listo para Pagar".
 * - VISTA: los tractores con Forma de Pago en "VISTA".
 *
 * Las dos piden lo mismo —un tractor con todos sus datos— y sólo cambian en por qué columna se
 * filtra. Por eso comparten la paginación y la normalización, y cada una se reduce a decir qué
 * filtro manda y qué etiqueta vuelve a comprobar.
 */
import type { MesAnio, Tractor } from '@/types'
import {
  COL_INV,
  FECHA_CONFIRMADA,
  FORMA_PAGO,
  INV_ESTADO,
  INV_ESTADO_LISTO_INDEX,
} from './columns'
import type { NombreOperacion } from './operaciones'
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

/** Columnas que se piden. Pedir sólo estas es lo que mantiene la respuesta chica. */
const COLUMNAS = [
  COL_INV.numInterno,
  COL_INV.numDraft,
  COL_INV.fechaProd,
  COL_INV.estadoPago,
  COL_INV.costoFlete,
  COL_INV.precioUnitario,
  COL_INV.valorNeto,
  COL_INV.formaPago,
  COL_INV.codProducto,
  COL_INV.modelo,
  COL_INV.estadoRodado,
  COL_INV.confirmacionFecha,
  COL_INV.catalogo,
]

const PAGINA = 200
/** Tope de seguridad: si algo sale mal con los cursores, la app no gira para siempre. */
const MAX_PAGINAS = 25

function aTractor(item: ItemCrudo): Tractor {
  const c = porId(item.column_values)
  return {
    id: item.id,
    nombre: item.name,
    numInterno: texto(c[COL_INV.numInterno]),
    numDraft: texto(c[COL_INV.numDraft]),
    codProducto: espejo(c[COL_INV.codProducto]),
    fechaProd: fechaISO(c[COL_INV.fechaProd]),
    estadoPago: texto(c[COL_INV.estadoPago]),
    costoFlete: aNumeroEspejo(espejo(c[COL_INV.costoFlete])),
    precioUnitario: aNumeroEspejo(espejo(c[COL_INV.precioUnitario])),
    valorNeto: aNumeroEspejo(espejo(c[COL_INV.valorNeto])),
    formaPago: texto(c[COL_INV.formaPago]),
    modelo: espejo(c[COL_INV.modelo]),
    estadoRodado: texto(c[COL_INV.estadoRodado]),
    catalogoId: (c[COL_INV.catalogo] as ColumnaConexion | undefined)?.linked_item_ids?.[0] ?? null,
    confirmacionFecha: texto(c[COL_INV.confirmacionFecha]),
  }
}

/**
 * Sólo se puede despachar lo que tiene la Fecha de Producción CONFIRMADA.
 *
 * Vale para las dos modalidades. Un tractor con la fecha a confirmar no se muestra en ninguna
 * lista: ofrecerlo sería armar un despacho sobre una fecha que todavía puede cambiar.
 */
const conFechaConfirmada = (t: Tractor): boolean => t.confirmacionFecha === FECHA_CONFIRMADA

/**
 * Trae todas las páginas de una consulta filtrada del Inventario.
 *
 * `query_params` no se puede combinar con un cursor —el filtro ya quedó grabado en el cursor de
 * la primera página—, así que la primera página y las siguientes son operaciones distintas.
 */
async function traerTodos(operacion: NombreOperacion, filtro: Record<string, unknown>): Promise<Tractor[]> {
  const primera = await mondayApi<{ boards: { items_page: PaginaCruda }[] }>(operacion, {
    ...filtro,
    columnas: COLUMNAS,
    limite: PAGINA,
  })

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

  return items.map(aTractor).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/**
 * TODOS los tractores listos para pagar, sin importar el mes.
 *
 * El filtro por mes de producción ya no vive acá: lo aplica la pantalla sobre esta lista, así
 * que combinar o quitar meses es instantáneo y no vuelve a consultar monday.
 *
 * El filtro por estado se manda a Monday por índice —que es lo único que entiende— para traer
 * menos filas, pero la decisión final se toma acá comparando la ETIQUETA: si mañana cambia el
 * orden de las etiquetas de la columna, la app trae de más y filtra bien, y nunca muestra un
 * tractor que no corresponde.
 */
export async function tractoresListosParaPagar(): Promise<Tractor[]> {
  const tractores = await traerTodos('inventarioPorEstadoPago', { estado: [INV_ESTADO_LISTO_INDEX] })
  return tractores.filter((t) => t.estadoPago === INV_ESTADO.LISTO && conFechaConfirmada(t))
}

/**
 * Tractores con Forma de Pago en VISTA: los que se pueden pedir sin pago previo.
 *
 * Mismo criterio que arriba: se filtra por id en Monday y se vuelve a comprobar la etiqueta acá.
 * La columna es un `dropdown` y admite más de una opción, por eso se busca "VISTA" entre las
 * elegidas en vez de comparar el texto completo.
 */
export async function tractoresParaDespachoVista(): Promise<Tractor[]> {
  const tractores = await traerTodos('inventarioPorFormaDePago', { forma: [FORMA_PAGO.VISTA.id] })
  return tractores.filter(
    (t) =>
      conFechaConfirmada(t) &&
      t.formaPago
        .split(',')
        .map((f) => f.trim())
        .includes(FORMA_PAGO.VISTA.etiqueta),
  )
}

/** Mes de la Fecha de Prod del tractor, o `null` si no la tiene cargada. */
export function mesDeProduccion(tractor: Tractor): MesAnio | null {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(tractor.fechaProd)
  return m ? { anio: Number(m[1]), mes: Number(m[2]) } : null
}
