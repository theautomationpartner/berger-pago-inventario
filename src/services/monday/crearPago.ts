/**
 * Impacto en Monday de la operación "Cargar Transferencia".
 *
 * Es la única escritura de la app y toca TRES tableros, así que el orden importa:
 *
 *   1. Se crea el item en Pagos del Inventario (monto, fecha de emisión, estado `CARGADO`).
 *   2. Se sube el PDF de la transferencia a su columna de archivo.
 *   3. Se crea un subitem por tractor, conectado al item del Inventario.
 *   4. Se pasa el Estado Pago de cada tractor a `Transf Cargada`.
 *
 * Los pasos 1 y 2 son los únicos que abortan la operación: sin item o sin comprobante no hay
 * nada que registrar. Del 3 en adelante los fallos se juntan como ADVERTENCIAS y se devuelven,
 * porque el pago ya existe en Monday: esconder que un subitem no se creó dejaría al usuario
 * creyendo que cargó algo que no está.
 */
import { aTextoMonday, hoyISO } from '@/lib/format'
import type { ResultadoCarga, Tractor } from '@/types'
import {
  COL_INV,
  COL_PAGO,
  COL_PAGO_SUB,
  INV_ESTADO,
  PAGO_ESTADO,
  PAGO_OPERACION,
  TABLEROS,
} from './columns'
import { mondayApi, subirArchivoAColumna } from './sdk'

/** Nombre del item de pago. Se lee solo en el tablero: fecha de la transferencia y volumen. */
export function nombreDelPago(fechaEmision: string, cantidad: number): string {
  const [anio, mes, dia] = fechaEmision.split('-')
  const unidad = cantidad === 1 ? 'tractor' : 'tractores'
  return `Transferencia ${dia}/${mes}/${anio} · ${cantidad} ${unidad}`
}

interface Entrada {
  tractores: Tractor[]
  archivo: File
  monto: number
  /** ISO `YYYY-MM-DD`. */
  fechaEmision: string
}

/** Texto corto de un error desconocido, para las advertencias. */
const motivo = (e: unknown): string => (e instanceof Error ? e.message : String(e))

export async function cargarTransferencia({
  tractores,
  archivo,
  monto,
  fechaEmision,
}: Entrada): Promise<ResultadoCarga> {
  if (tractores.length === 0) throw new Error('No hay tractores seleccionados.')

  /* 1. Item del pago.
     `Operacion Pend` queda en "Pend de Aprobar Transf" en el mismo movimiento que el estado: son
     dos lecturas distintas del mismo hecho —en qué etapa está el pago, y quién tiene que actuar—
     y dejarlas para dos escrituras separadas abre una ventana en la que el pago existe sin dueño.
     `Fecha CARGADO` es la fecha en que se completó ESTA operación, que no tiene por qué coincidir
     con la fecha de emisión de la transferencia. */
  const valoresPago = {
    [COL_PAGO.montoTransferencia]: aTextoMonday(monto),
    [COL_PAGO.fechaEmision]: { date: fechaEmision },
    [COL_PAGO.estadoPago]: { label: PAGO_ESTADO.CARGADO },
    [COL_PAGO.operacionPend]: { label: PAGO_OPERACION.PEND_APROBAR },
    [COL_PAGO.fechaCargado]: { date: hoyISO() },
  }
  const creado = await mondayApi<{ create_item: { id: string } }>('crearPago', {
    nombre: nombreDelPago(fechaEmision, tractores.length),
    valores: JSON.stringify(valoresPago),
  })
  const pagoId = creado.create_item.id

  // 2. Comprobante. Va inmediatamente después de crear el item: un pago sin transferencia
  //    adjunta no se puede aprobar en la operación siguiente.
  await subirArchivoAColumna(pagoId, COL_PAGO.transferencia, archivo)

  const advertencias: string[] = []
  const subitemIds: string[] = []

  // 3. Un subitem por tractor, conectado a su item del Inventario.
  for (const t of tractores) {
    const valoresSub = {
      [COL_PAGO_SUB.valorNeto]: t.valorNeto == null ? '' : aTextoMonday(t.valorNeto),
      [COL_PAGO_SUB.numDraft]: t.numDraft,
      [COL_PAGO_SUB.codProducto]: t.codProducto,
      [COL_PAGO_SUB.inventario]: { item_ids: [t.id] },
    }
    try {
      const sub = await mondayApi<{ create_subitem: { id: string } }>('crearSubitemDePago', {
        padre: pagoId,
        nombre: t.nombre,
        valores: JSON.stringify(valoresSub),
      })
      subitemIds.push(sub.create_subitem.id)
    } catch (e) {
      advertencias.push(`No se pudo crear el subitem de ${t.nombre}: ${motivo(e)}`)
    }
  }

  // 4. Estado del tractor en el Inventario.
  let tractoresActualizados = 0
  for (const t of tractores) {
    try {
      await mondayApi('actualizarColumnas', {
        tablero: TABLEROS.inventario,
        item: t.id,
        valores: JSON.stringify({
          [COL_INV.estadoPago]: { label: INV_ESTADO.TRANSF_CARGADA },
        }),
      })
      tractoresActualizados += 1
    } catch (e) {
      advertencias.push(`No se pudo pasar ${t.nombre} a "${INV_ESTADO.TRANSF_CARGADA}": ${motivo(e)}`)
    }
  }

  return { pagoId, subitemIds, tractoresActualizados, advertencias }
}
