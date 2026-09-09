/**
 * Lectura del tablero de Inventario: qué tractores se pueden pagar este mes.
 */
import { COL_INV, INV_ESTADO, INV_ESTADO_LISTO_INDEX, TABLEROS } from './columns'
import { aNumeroEspejo, espejo, fechaISO, porId, texto, type ColumnaCruda } from './parse'
import { mondayApi } from './sdk'
import type { PeriodoMes, Tractor } from '@/types'

interface ItemCrudo {
  id: string
  name: string
  column_values: ColumnaCruda[]
}

interface RespuestaItems {
  boards: { items_page: { cursor: string | null; items: ItemCrudo[] } }[]
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
]

/*
 * El tipo de `$estado` es `CompareValue!`, no `[String]`: Monday rechaza la query ENTERA si se
 * declara distinto. Y el valor va como NÚMERO —el índice de la etiqueta—, porque los filtros de
 * `status` comparan por índice y mandar el texto devuelve una lista vacía sin dar error.
 */

/**
 * El fragmento `... on MirrorValue { display_value }` no es opcional: sin él las cuatro columnas
 * espejo (costo de flete, precio unitario, valor neto y código de producto) vuelven vacías.
 */
const CAMPOS_COLUMNA = `
  id
  type
  text
  ... on MirrorValue { display_value }
`

const QUERY_PRIMERA = `
  query ($tablero: ID!, $columnas: [String!], $estado: CompareValue!, $limite: Int!) {
    boards(ids: [$tablero]) {
      items_page(
        limit: $limite
        query_params: { rules: [{ column_id: "${COL_INV.estadoPago}", compare_value: $estado, operator: any_of }] }
      ) {
        cursor
        items { id name column_values(ids: $columnas) { ${CAMPOS_COLUMNA} } }
      }
    }
  }
`

/**
 * Páginas siguientes. Monday NO acepta `query_params` junto a un cursor —el filtro ya quedó
 * grabado en el cursor de la primera página—, así que la paginación tiene su propia query.
 */
const QUERY_SIGUIENTE = `
  query ($cursor: String!, $columnas: [String!], $limite: Int!) {
    next_items_page(cursor: $cursor, limit: $limite) {
      cursor
      items { id name column_values(ids: $columnas) { ${CAMPOS_COLUMNA} } }
    }
  }
`

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
  }
}

/** ¿La Fecha de Prod del tractor cae en el mes de la operación? */
export function esDelPeriodo(tractor: Tractor, periodo: PeriodoMes): boolean {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(tractor.fechaProd)
  if (!m) return false
  return Number(m[1]) === periodo.anio && Number(m[2]) === periodo.mes
}

/**
 * Tractores listos para pagar en el mes indicado.
 *
 * El filtro por estado se manda a Monday (por índice, que es lo único que entiende) para traer
 * menos filas, pero la decisión final se toma acá comparando la ETIQUETA y el mes de la Fecha de
 * Prod. Si mañana cambia el orden de las etiquetas de la columna, la app trae de más y filtra
 * bien; nunca muestra un tractor que no corresponde.
 */
export async function tractoresListosParaPagar(periodo: PeriodoMes): Promise<Tractor[]> {
  const items: ItemCrudo[] = []

  const primera = await mondayApi<RespuestaItems>(QUERY_PRIMERA, {
    tablero: TABLEROS.inventario,
    columnas: COLUMNAS,
    estado: [INV_ESTADO_LISTO_INDEX],
    limite: PAGINA,
  })

  const pagina = primera.boards?.[0]?.items_page
  if (!pagina) return []
  items.push(...pagina.items)

  let cursor = pagina.cursor
  for (let i = 0; cursor && i < MAX_PAGINAS; i += 1) {
    const siguiente = await mondayApi<{
      next_items_page: { cursor: string | null; items: ItemCrudo[] }
    }>(QUERY_SIGUIENTE, { cursor, columnas: COLUMNAS, limite: PAGINA })
    items.push(...siguiente.next_items_page.items)
    cursor = siguiente.next_items_page.cursor
  }

  return items
    .map(aTractor)
    .filter((t) => t.estadoPago === INV_ESTADO.LISTO && esDelPeriodo(t, periodo))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}
