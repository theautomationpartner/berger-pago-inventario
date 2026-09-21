/**
 * Impacto en Monday del despacho a la VISTA: el pedido se registra SIN pago previo.
 *
 * Es el mismo movimiento que la carga de una transferencia, con dos diferencias: no hay
 * comprobante que adjuntar, y en vez de quedar "Listo para Pagar" cada tractor queda en
 * "Pendiente de Pago", que es lo que dice que se despachó y todavía no se cobró.
 *
 * El orden importa, y por el mismo motivo que en el anticipado: los pasos 1 y 2 abortan —sin item
 * y sin sus tractores no hay pedido—; del 3 en adelante los fallos se juntan como advertencias,
 * porque el pedido ya existe en Monday y esconderlo dejaría al usuario creyendo que cargó algo que
 * no está completo.
 */
import { paisesDePuertos, puertosDeTractores } from '@/lib/puertos'
import { aTextoMonday, fechaCorta, hoyISO } from '@/lib/format'
import type { ResultadoCarga, Tractor } from '@/types'
import { crearDespachoDeAduana } from './despachante'
import {
  COL_INV,
  COL_PAGO,
  COL_PAGO_SUB,
  EMAIL_ENVIAR,
  INV_ESTADO,
  PAGO_OPERACION,
  TABLEROS,
  TIPO_PAGO,
} from './columns'
import { mondayApi } from './sdk'

const motivo = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/** Nombre del item del pedido. Se lee solo en el tablero: modalidad y fecha. */
export const nombreDelPedidoVista = (fecha: string): string => `PAGO VISTA - ${fechaCorta(fecha)}`

interface Entrada {
  tractores: Tractor[]
  /** Lo que queda por cobrar: la suma de los valores netos de lo que se despacha. */
  montoPendiente: number
  /** Contenedores que armó la app para este pedido: es lo que se le declara al despachante. */
  totalContenedores: number
  /** Despachante elegido: recibe el mail y queda asignado al item del Despachante de aduana. */
  despachanteId: string | null
  /** Reporte de contenedores que queda guardado para el mail al proveedor. */
  reporteContenedores: string
}

export async function crearPedidoVista({
  tractores,
  montoPendiente,
  totalContenedores,
  despachanteId,
  reporteContenedores,
}: Entrada): Promise<ResultadoCarga> {
  if (tractores.length === 0) throw new Error('No hay tractores seleccionados.')

  const fecha = hoyISO()

  // 1. Item del pedido.
  const creado = await mondayApi<{ create_item: { id: string } }>('crearPago', {
    nombre: nombreDelPedidoVista(fecha),
    valores: JSON.stringify({
      [COL_PAGO.tipoPago]: { label: TIPO_PAGO.VISTA },
      [COL_PAGO.fechaPagoVista]: { date: fecha },
      [COL_PAGO.montoPendienteVista]: aTextoMonday(montoPendiente),
      [COL_PAGO.operacionPend]: { label: PAGO_OPERACION.PENDIENTE_PAGO },
      [COL_PAGO.contenedores]: { text: reporteContenedores },
    }),
  })
  const pagoId = creado.create_item.id

  const advertencias: string[] = []
  const subitemIds: string[] = []

  // 2. Un subitem por tractor, conectado a su item del Inventario.
  for (const t of tractores) {
    try {
      const sub = await mondayApi<{ create_subitem: { id: string } }>('crearSubitemDePago', {
        padre: pagoId,
        nombre: t.nombre,
        valores: JSON.stringify({
          [COL_PAGO_SUB.valorNeto]: t.valorNeto == null ? '' : aTextoMonday(t.valorNeto),
          [COL_PAGO_SUB.numDraft]: t.numDraft,
          [COL_PAGO_SUB.codProducto]: t.codProducto,
          [COL_PAGO_SUB.inventario]: { item_ids: [t.id] },
        }),
      })
      subitemIds.push(sub.create_subitem.id)
    } catch (e) {
      advertencias.push(`No se pudo crear el subitem de ${t.nombre}: ${motivo(e)}`)
    }
  }

  // 3. Estado del tractor en el Inventario.
  let tractoresActualizados = 0
  for (const t of tractores) {
    try {
      await mondayApi('actualizarColumnas', {
        tablero: TABLEROS.inventario,
        item: t.id,
        valores: JSON.stringify({
          [COL_INV.estadoPago]: { label: INV_ESTADO.PENDIENTE_PAGO },
        }),
      })
      tractoresActualizados += 1
    } catch (e) {
      advertencias.push(
        `No se pudo pasar ${t.nombre} a "${INV_ESTADO.PENDIENTE_PAGO}": ${motivo(e)}`,
      )
    }
  }

  /* 4. El despacho, en el tablero del Despachante de aduana. En la vista el pedido se cierra acá
     mismo: no hay pago posterior que esperar, así que el despachante ya puede trabajar. */
  let hayDespacho = false
  try {
    const despacho = await crearDespachoDeAduana({
      pagoId,
      nombre: nombreDelPedidoVista(fecha),
      cantidadContenedores: totalContenedores,
      paises: paisesDePuertos(puertosDeTractores(tractores)),
      puertos: puertosDeTractores(tractores),
      despachanteId,
      tractores: tractores.map((t) => ({
        nombre: t.nombre,
        valorNeto: t.valorNeto,
        numDraft: t.numDraft,
        codProducto: t.codProducto,
        tractorId: t.id,
      })),
    })
    advertencias.push(...despacho.advertencias)
    hayDespacho = true
  } catch (e) {
    advertencias.push(`No se pudo crear el despacho en el Despachante de aduana: ${motivo(e)}`)
  }

  /* 5. Aviso al despachante, con todo ya escrito. Va ÚLTIMO a propósito: de esa columna sale el
     mail, y es lo único de la operación que no se puede deshacer.

     Si el despacho NO se pudo crear, el aviso no sale: sería mandarle al despachante la
     información de una OP que no existe en su tablero, y el mail no se puede volver atrás. Se
     avisa en pantalla para resolverlo y mandarlo desde monday. */
  if (hayDespacho) {
    try {
      await mondayApi('actualizarColumnas', {
        tablero: TABLEROS.pagos,
        item: pagoId,
        valores: JSON.stringify({ [COL_PAGO.emailDespacho]: { label: EMAIL_ENVIAR } }),
      })
    } catch (e) {
      advertencias.push(`No se pudo avisar al despachante: ${motivo(e)}`)
    }
  } else {
    advertencias.push(
      'No se avisó al despachante: sin el despacho creado, el mail le llegaría sobre una OP que ' +
        'no existe. Revisá el motivo de arriba y disparalo desde el tablero.',
    )
  }

  return { pagoId, subitemIds, tractoresActualizados, advertencias }
}
