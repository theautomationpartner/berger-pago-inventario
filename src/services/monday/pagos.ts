/**
 * Lectura del tablero de Pagos del Inventario: qué pagos esperan una operación.
 *
 * Es la fuente de las operaciones 2 y 3. A diferencia del Inventario, acá cada fila trae sus
 * subitems, porque el detalle de un pago SON los tractores que lo componen: mostrar el pago sin
 * ellos obligaría a abrir monday para saber qué se está aprobando.
 */
import type { Pago, SubitemPago } from '@/types'
import { COL_INV, COL_PAGO, COL_PAGO_SUB, PAGO_OPERACION_INDEX } from './columns'
import { aNumeroEspejo, espejo, fechaISO, porId, texto, type ColumnaCruda } from './parse'
import { mondayApi } from './sdk'

/** Una board_relation expone los items conectados sólo con este fragmento. */
interface ColumnaConexion extends ColumnaCruda {
  linked_item_ids?: string[] | null
}

interface SubitemCrudo {
  id: string
  name: string
  column_values: ColumnaConexion[]
}

interface PagoCrudo {
  id: string
  name: string
  column_values: ColumnaCruda[]
  subitems: SubitemCrudo[] | null
}

const COLUMNAS_PAGO = [
  COL_PAGO.montoTransferencia,
  COL_PAGO.fechaEmision,
  COL_PAGO.estadoPago,
  COL_PAGO.operacionPend,
  COL_PAGO.fechaCargado,
  COL_PAGO.fechaAprobado,
  COL_PAGO.transferencia,
  COL_PAGO.transferenciaConNumero,
  COL_PAGO.comprobanteBanco,
  COL_PAGO.contenedores,
]

const COLUMNAS_SUB = [
  COL_PAGO_SUB.valorNeto,
  COL_PAGO_SUB.numDraft,
  COL_PAGO_SUB.codProducto,
  COL_PAGO_SUB.numInterno,
  COL_PAGO_SUB.inventario,
]

/**
 * El tablero de pagos no crece como el de inventario: un item por transferencia. 200 alcanza de
 * sobra para los pendientes de una operación, así que no se pagina.
 */
const LIMITE = 200

/** Lo que se lee del item del Inventario al que apunta cada subitem. */
interface DatosTractor {
  estado: string
  modelo: string
  estadoRodado: string
  /** Producto del Catálogo: de ahí sale el puerto, y del puerto el país de origen del despacho. */
  catalogoId: string | null
}

function aSubitem(s: SubitemCrudo, datosTractores: Map<string, DatosTractor>): SubitemPago {
  const c = porId(s.column_values) as Record<string, ColumnaConexion | undefined>
  const conectados = c[COL_PAGO_SUB.inventario]?.linked_item_ids ?? []
  const tractorId = conectados[0] ?? null
  const delInventario = tractorId ? datosTractores.get(tractorId) : undefined
  return {
    id: s.id,
    nombre: s.name,
    numDraft: texto(c[COL_PAGO_SUB.numDraft]),
    codProducto: texto(c[COL_PAGO_SUB.codProducto]),
    numInterno: espejo(c[COL_PAGO_SUB.numInterno]),
    valorNeto: aNumeroEspejo(texto(c[COL_PAGO_SUB.valorNeto])),
    tractorId,
    estadoTractor: delInventario?.estado ?? '',
    modelo: delInventario?.modelo ?? '',
    estadoRodado: delInventario?.estadoRodado ?? '',
    catalogoId: delInventario?.catalogoId ?? null,
  }
}

function aPago(item: PagoCrudo, datosTractores: Map<string, DatosTractor>): Pago {
  const c = porId(item.column_values)
  return {
    id: item.id,
    nombre: item.name,
    monto: aNumeroEspejo(texto(c[COL_PAGO.montoTransferencia])),
    fechaEmision: fechaISO(c[COL_PAGO.fechaEmision]),
    estadoPago: texto(c[COL_PAGO.estadoPago]),
    operacionPend: texto(c[COL_PAGO.operacionPend]),
    fechaCargado: fechaISO(c[COL_PAGO.fechaCargado]),
    fechaAprobado: fechaISO(c[COL_PAGO.fechaAprobado]),
    urlTransferencia: texto(c[COL_PAGO.transferencia]),
    urlTransferenciaConNumero: texto(c[COL_PAGO.transferenciaConNumero]),
    urlComprobanteBanco: texto(c[COL_PAGO.comprobanteBanco]),
    reporteContenedores: texto(c[COL_PAGO.contenedores]),
    tractores: (item.subitems ?? []).map((s) => aSubitem(s, datosTractores)),
  }
}

/**
 * Pagos que esperan una operación.
 *
 * `operacionPend` filtra por la columna que dice quién tiene que actuar; `estadoPago`, cuando se
 * pasa, agrega la segunda condición (la operación 3 pide además que el pago ya esté `APROBADO`).
 * Como en el Inventario, el filtro se manda a Monday por índice para traer menos filas y se
 * vuelve a aplicar acá por etiqueta, que es lo que decide de verdad.
 */
export async function pagosPendientes(
  operacionPend: string,
  estadoPago?: string,
): Promise<Pago[]> {
  const indice = PAGO_OPERACION_INDEX[operacionPend]
  const datos = await mondayApi<{ boards: { items_page: { items: PagoCrudo[] } }[] }>('pagosPendientes', {
    operacion: indice == null ? [] : [indice],
    cols: COLUMNAS_PAGO,
    colsSub: COLUMNAS_SUB,
    limite: LIMITE,
  })

  const items = datos.boards?.[0]?.items_page.items ?? []

  /* Estado, modelo y rodado de los tractores se piden en UNA sola query para todos los pagos de la
     pantalla, no una por subitem: con diez pagos de seis tractores serían sesenta viajes a la API. */
  const idsTractores = [
    ...new Set(
      items.flatMap((p) =>
        (p.subitems ?? []).flatMap((s) => {
          const c = porId(s.column_values) as Record<string, ColumnaConexion | undefined>
          return c[COL_PAGO_SUB.inventario]?.linked_item_ids ?? []
        }),
      ),
    ),
  ]

  const datosTractores = new Map<string, DatosTractor>()
  if (idsTractores.length > 0) {
    const r = await mondayApi<{ items: { id: string; column_values: ColumnaConexion[] }[] }>(
      'datosDeTractores',
      { ids: idsTractores },
    )
    for (const it of r.items) {
      const c = porId(it.column_values) as Record<string, ColumnaConexion | undefined>
      datosTractores.set(it.id, {
        estado: texto(c[COL_INV.estadoPago]),
        // El modelo es un mirror: su valor viene en `display_value`, nunca en `text`.
        modelo: espejo(c[COL_INV.modelo]),
        estadoRodado: texto(c[COL_INV.estadoRodado]),
        catalogoId: c[COL_INV.catalogo]?.linked_item_ids?.[0] ?? null,
      })
    }
  }

  return items
    .map((p) => aPago(p, datosTractores))
    .filter((p) => p.operacionPend === operacionPend)
    .filter((p) => !estadoPago || p.estadoPago === estadoPago)
    .sort((a, b) => b.id.localeCompare(a.id))
}
