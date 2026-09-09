/**
 * Impacto en Monday de las operaciones 2 (Aprobar Transferencia) y 3 (Confirmar Pago).
 *
 * Las dos empujan el MISMO circuito un casillero, y sólo cambian en qué estados escriben y en qué
 * columna guardan el comprobante. Por eso comparten esta función y se diferencian por el `flujo`
 * que reciben: un arreglo en el manejo de errores vale para las dos, en vez de tener que
 * acordarse de aplicarlo dos veces.
 *
 * El orden importa:
 *
 *   1. Se sube el comprobante a su columna.
 *   2. Se escriben estado, operación pendiente y fecha del pago EN UNA SOLA mutation.
 *   3. Se avanza el Estado Pago de cada tractor conectado, en el Inventario.
 *   4. Recién al final se deja el aviso por mail en "Enviar".
 *
 * El paso 1 es el único que aborta: sin comprobante no hay nada que aprobar ni que confirmar, y
 * dejar el pago avanzado con la columna de archivo vacía es peor que no haber hecho nada. El mail
 * va ÚLTIMO a propósito: es lo único irreversible de la operación —una vez que la automatización
 * lo manda, el proveedor ya lo recibió—, así que no se dispara hasta que todo lo demás quedó
 * escrito.
 */
import { hoyISO } from '@/lib/format'
import type { FlujoAvance, Pago, ResultadoAvance } from '@/types'
import { COL_INV, COL_PAGO, EMAIL_ENVIAR, TABLEROS } from './columns'
import { mondayApi, subirArchivoAColumna } from './sdk'

const M_ACTUALIZAR = `
  mutation ($tablero: ID!, $item: ID!, $valores: JSON!) {
    change_multiple_column_values(board_id: $tablero, item_id: $item, column_values: $valores) { id }
  }
`

const motivo = (e: unknown): string => (e instanceof Error ? e.message : String(e))

interface Entrada {
  pago: Pago
  archivo: File
  flujo: FlujoAvance
}

export async function avanzarPago({ pago, archivo, flujo }: Entrada): Promise<ResultadoAvance> {
  // 1. Comprobante.
  await subirArchivoAColumna(pago.id, flujo.columnaArchivo, archivo)

  const advertencias: string[] = []

  // 2. Estado, operación pendiente y fecha del pago.
  await mondayApi(M_ACTUALIZAR, {
    tablero: TABLEROS.pagos,
    item: pago.id,
    valores: JSON.stringify({
      [COL_PAGO.estadoPago]: { label: flujo.nuevoEstadoPago },
      [COL_PAGO.operacionPend]: { label: flujo.nuevaOperacionPend },
      [flujo.columnaFecha]: { date: hoyISO() },
    }),
  })

  // 3. Los tractores del pago, en el Inventario.
  let tractoresActualizados = 0
  for (const t of pago.tractores) {
    if (!t.tractorId) {
      advertencias.push(
        `${t.nombre} no está conectado a ningún item del Inventario: su estado quedó sin cambiar.`,
      )
      continue
    }
    try {
      await mondayApi(M_ACTUALIZAR, {
        tablero: TABLEROS.inventario,
        item: t.tractorId,
        valores: JSON.stringify({
          [COL_INV.estadoPago]: { label: flujo.nuevoEstadoInventario },
        }),
      })
      tractoresActualizados += 1
    } catch (e) {
      advertencias.push(
        `No se pudo pasar ${t.nombre} a "${flujo.nuevoEstadoInventario}": ${motivo(e)}`,
      )
    }
  }

  // 4. Aviso por mail. Va al final: es lo único que sale de monday y no se puede deshacer.
  try {
    await mondayApi(M_ACTUALIZAR, {
      tablero: TABLEROS.pagos,
      item: pago.id,
      valores: JSON.stringify({ [flujo.columnaEmail]: { label: EMAIL_ENVIAR } }),
    })
  } catch (e) {
    advertencias.push(`No se pudo disparar el aviso por mail: ${motivo(e)}`)
  }

  return { pagoId: pago.id, tractoresActualizados, advertencias }
}
