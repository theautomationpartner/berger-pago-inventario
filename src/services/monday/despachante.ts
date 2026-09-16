/**
 * Alta del despacho en el tablero del Despachante de aduana.
 *
 * Es el último movimiento de las dos modalidades, y el mismo en las dos: cuando el pago ya quedó
 * completo —confirmado el SWIFT en ANTICIPADO, registrado el pedido en VISTA— se crea acá un item
 * conectado a ese pago, con lo que el despachante necesita para empezar a trabajar: cuántos
 * contenedores, de qué país salen, quién provee y quién importa; y un subitem por tractor con los
 * mismos datos que ya tenía el subitem del pago.
 *
 * Ninguna de sus fallas aborta la operación de la que cuelga: para cuando se llega acá el pago ya
 * está escrito y los tractores ya avanzaron, así que lo que salga mal se informa como advertencia
 * y queda a la vista, en vez de deshacer un circuito que ya ocurrió.
 */
import { aTextoMonday } from '@/lib/format'
import type { TractorDeDespacho } from '@/types'
import {
  COL_DESPACHANTE,
  COL_DESPACHANTE_SUB,
  IMPORTADOR_DESPACHO,
  PROVEEDOR_DESPACHO,
} from './columns'
import { mondayApi } from './sdk'

const motivo = (e: unknown): string => (e instanceof Error ? e.message : String(e))

interface Entrada {
  /** Item de Pagos del Inventario que originó el despacho. */
  pagoId: string
  /**
   * Nombre del item.
   *
   * El pedido era crearlo sin nombre, pero Monday no acepta items con el nombre vacío —los rechaza
   * con `InvalidItemNameException`—, así que lleva el del pago: es lo que permite reconocerlo en
   * el tablero sin abrir la conexión.
   */
  nombre: string
  /** Contenedores declarados. `null` cuando no se pudo saber: se avisa y la columna queda vacía. */
  cantidadContenedores: number | null
  /** Países de los puertos de carga. Puede haber más de uno si el despacho mezcla orígenes. */
  paises: string[]
  tractores: TractorDeDespacho[]
}

export interface ResultadoDespachante {
  despachanteId: string
  subitemIds: string[]
  advertencias: string[]
}

export async function crearDespachoDeAduana({
  pagoId,
  nombre,
  cantidadContenedores,
  paises,
  tractores,
}: Entrada): Promise<ResultadoDespachante> {
  const advertencias: string[] = []

  /* El proveedor y el importador son fijos: hoy este circuito despacha un solo proveedor para un
     solo importador. El día que haya otro, sale de un dato del pago y no de una constante. */
  const valores: Record<string, unknown> = {
    [COL_DESPACHANTE.pago]: { item_ids: [pagoId] },
    [COL_DESPACHANTE.proveedor]: { labels: [PROVEEDOR_DESPACHO] },
    [COL_DESPACHANTE.importador]: { label: IMPORTADOR_DESPACHO },
  }
  if (cantidadContenedores != null) {
    valores[COL_DESPACHANTE.cantidadContenedores] = aTextoMonday(cantidadContenedores)
  }
  // Un dropdown con una etiqueta que no existe hace fallar la escritura ENTERA, así que si no hay
  // países la columna ni se manda: el resto del despacho se carga igual.
  if (paises.length > 0) valores[COL_DESPACHANTE.paisOrigen] = { labels: paises }

  const creado = await mondayApi<{ create_item: { id: string } }>('crearItemDeDespachante', {
    nombre,
    valores: JSON.stringify(valores),
  })
  const despachanteId = creado.create_item.id

  const subitemIds: string[] = []
  for (const t of tractores) {
    const valoresSub: Record<string, unknown> = {
      [COL_DESPACHANTE_SUB.valorNeto]: t.valorNeto == null ? '' : aTextoMonday(t.valorNeto),
      [COL_DESPACHANTE_SUB.numDraft]: t.numDraft,
      [COL_DESPACHANTE_SUB.codProducto]: t.codProducto,
    }
    // Sin item del Inventario no hay a qué conectar: se crea igual con los datos que sí están, y
    // la conexión faltante se informa arriba, en la advertencia que ya dio quien lo llamó.
    if (t.tractorId) valoresSub[COL_DESPACHANTE_SUB.inventario] = { item_ids: [t.tractorId] }

    try {
      const sub = await mondayApi<{ create_subitem: { id: string } }>('crearSubitemDeDespachante', {
        padre: despachanteId,
        nombre: t.nombre,
        valores: JSON.stringify(valoresSub),
      })
      subitemIds.push(sub.create_subitem.id)
    } catch (e) {
      advertencias.push(
        `No se pudo crear el subitem de ${t.nombre} en el Despachante: ${motivo(e)}`,
      )
    }
  }

  return { despachanteId, subitemIds, advertencias }
}
