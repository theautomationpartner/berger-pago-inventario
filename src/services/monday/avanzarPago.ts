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
 *   4. Si la etapa CIERRA el despacho (la 3), se crea el item en el Despachante de aduana.
 *   5. Recién al final se dejan los avisos por mail en "Enviar".
 *
 * El paso 1 es el único que aborta: sin comprobante no hay nada que aprobar ni que confirmar, y
 * dejar el pago avanzado con la columna de archivo vacía es peor que no haber hecho nada. El mail
 * va ÚLTIMO a propósito: es lo único irreversible de la operación —una vez que la automatización
 * lo manda, el proveedor ya lo recibió—, así que no se dispara hasta que todo lo demás quedó
 * escrito.
 */
import { cantidadDeContenedoresDelReporte } from '@/lib/contenedores'
import { hoyISO } from '@/lib/format'
import { paisesDePuertos } from '@/lib/puertos'
import type { FlujoAvance, Pago, ResultadoAvance } from '@/types'
import { puertosDeCatalogo } from './catalogo'
import { COL_INV, COL_PAGO, EMAIL_ENVIAR, TABLEROS } from './columns'
import { crearDespachoDeAduana } from './despachante'
import { mondayApi, subirArchivoAColumna } from './sdk'

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
  await mondayApi('actualizarColumnas', {
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
      await mondayApi('actualizarColumnas', {
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

  /* 4. El despacho, sólo en la etapa que lo cierra. En ANTICIPADO es ésta: hasta que el pago no
     está confirmado, la transferencia todavía puede caerse y no hay despacho que informar. */
  let despachanteId: string | null = null
  if (flujo.cierraDespacho) {
    try {
      despachanteId = await crearDespacho(pago, advertencias)
    } catch (e) {
      advertencias.push(`No se pudo crear el despacho en el Despachante de aduana: ${motivo(e)}`)
    }
  }

  /* 5. Avisos por mail. Van al final: son lo único que sale de monday y no se puede deshacer. El
     del despachante se suma en la etapa que cierra el despacho, junto con el del proveedor. */
  const emails: Record<string, { label: string }> = {
    [flujo.columnaEmail]: { label: EMAIL_ENVIAR },
  }
  if (flujo.cierraDespacho) emails[COL_PAGO.emailDespacho] = { label: EMAIL_ENVIAR }
  try {
    await mondayApi('actualizarColumnas', {
      tablero: TABLEROS.pagos,
      item: pago.id,
      valores: JSON.stringify(emails),
    })
  } catch (e) {
    advertencias.push(`No se pudo disparar el aviso por mail: ${motivo(e)}`)
  }

  return { pagoId: pago.id, tractoresActualizados, advertencias, despachanteId }
}

/**
 * Crea el item del despacho a partir de un pago ya confirmado.
 *
 * Los dos datos que no están en el pago se buscan acá:
 *
 * - **Cuántos contenedores**: se LEE del reporte que dejó la operación 1, no se vuelve a calcular.
 *   Entre cargar la transferencia y confirmar el SWIFT pueden pasar semanas, y si en el medio
 *   cambió una combinación del tablero de Contenedores, recalcular declararía un número distinto
 *   del que ya se reportó.
 * - **De qué país sale**: del puerto del Catálogo de cada tractor del pago.
 */
async function crearDespacho(pago: Pago, advertencias: string[]): Promise<string> {
  const cantidadContenedores = cantidadDeContenedoresDelReporte(pago.reporteContenedores)
  if (cantidadContenedores == null) {
    advertencias.push(
      'El pago no tiene el reporte de contenedores de la app, así que el despacho quedó sin la ' +
        'cantidad de contenedores: completala a mano en el Despachante de aduana.',
    )
  }

  const idsCatalogo = pago.tractores
    .map((t) => t.catalogoId)
    .filter((id): id is string => Boolean(id))

  let paises: string[] = []
  try {
    const puertos = await puertosDeCatalogo(idsCatalogo)
    paises = paisesDePuertos([...puertos.values()].flat())
  } catch (e) {
    advertencias.push(`No se pudo leer el puerto de carga del Catálogo: ${motivo(e)}`)
  }
  if (paises.length === 0) {
    advertencias.push(
      'El despacho quedó sin país de origen: los tractores no tienen puerto cargado en el Catálogo.',
    )
  }

  const despacho = await crearDespachoDeAduana({
    pagoId: pago.id,
    nombre: pago.nombre,
    cantidadContenedores,
    paises,
    tractores: pago.tractores.map((t) => ({
      nombre: t.nombre,
      valorNeto: t.valorNeto,
      numDraft: t.numDraft,
      codProducto: t.codProducto,
      tractorId: t.tractorId,
    })),
  })
  advertencias.push(...despacho.advertencias)
  return despacho.despachanteId
}
