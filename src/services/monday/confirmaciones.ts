/**
 * Las confirmaciones que manda el proveedor.
 *
 * Cada item de tipo CONFIRMACION junta los tractores cuyas fechas DEUTZ confirmó, y una
 * automatización vuelca esas fechas al Inventario y arma una planilla de Google con el detalle.
 *
 * La app no crea confirmaciones: las lee para mostrar qué se va a confirmar y qué se va a proponer,
 * y —cuando el Inventario ya está actualizado y la planilla creada— deja el envío en "Enviar".
 */
import type { Confirmacion } from '@/types'
import {
  COL_CONFIRMACION,
  CONFIRMACION_TIPO,
  CONFIRMACION_TIPO_INDEX,
  EMAIL_ENVIAR,
} from './columns'
import { tractoresPorIds } from './fechas'
import { fechaISO, porId, texto, type ColumnaCruda } from './parse'
import { mondayApi } from './sdk'

interface ColumnaRica extends ColumnaCruda {
  linked_item_ids?: string[] | null
  url?: string | null
}

interface ItemCrudo {
  id: string
  name: string
  column_values: ColumnaRica[]
}

const COLUMNAS = [
  COL_CONFIRMACION.tipo,
  COL_CONFIRMACION.fecha,
  COL_CONFIRMACION.inventario,
  COL_CONFIRMACION.estadoActInventario,
  COL_CONFIRMACION.creacionSheet,
  COL_CONFIRMACION.estadoPropuesta,
  COL_CONFIRMACION.driveLink,
  COL_CONFIRMACION.idConfirmacion,
]

function aConfirmacion(item: ItemCrudo): Confirmacion {
  const c = porId(item.column_values) as Record<string, ColumnaRica | undefined>
  const link = c[COL_CONFIRMACION.driveLink]
  return {
    id: item.id,
    nombre: item.name,
    idConfirmacion: texto(c[COL_CONFIRMACION.idConfirmacion]),
    fecha: fechaISO(c[COL_CONFIRMACION.fecha]),
    estadoActInventario: texto(c[COL_CONFIRMACION.estadoActInventario]),
    creacionSheet: texto(c[COL_CONFIRMACION.creacionSheet]),
    estadoPropuesta: texto(c[COL_CONFIRMACION.estadoPropuesta]),
    // La columna `link` trae la URL en `url`; el `text` a veces repite la URL y a veces el rótulo.
    driveLink: link?.url ?? texto(link),
    inventarioIds: c[COL_CONFIRMACION.inventario]?.linked_item_ids ?? [],
    tractores: [],
  }
}

/**
 * Las confirmaciones del proveedor, con sus tractores ya cargados.
 *
 * Los tractores se piden en UNA sola consulta para todas las confirmaciones de la pantalla: con
 * seis confirmaciones de seis tractores serían treinta y seis viajes a monday si se pidieran de a
 * uno.
 */
export async function confirmacionesDelProveedor(): Promise<Confirmacion[]> {
  const datos = await mondayApi<{ boards: { items_page: { items: ItemCrudo[] } }[] }>(
    'confirmaciones',
    { tipo: [CONFIRMACION_TIPO_INDEX], columnas: COLUMNAS, limite: 200 },
  )

  const items = (datos.boards?.[0]?.items_page.items ?? [])
    // El índice ya filtró en monday; la etiqueta decide de verdad, por si mañana cambia el orden.
    .filter((item) => {
      const c = porId(item.column_values) as Record<string, ColumnaRica | undefined>
      return texto(c[COL_CONFIRMACION.tipo]) === CONFIRMACION_TIPO
    })
    .map(aConfirmacion)

  const ids = [...new Set(items.flatMap((c) => c.inventarioIds))]
  const tractores = await tractoresPorIds(ids)
  const porTractorId = new Map(tractores.map((t) => [t.id, t]))

  return items
    .map((c) => ({
      ...c,
      tractores: c.inventarioIds
        .map((id) => porTractorId.get(id))
        .filter((t): t is NonNullable<typeof t> => Boolean(t)),
    }))
    .sort((a, b) => b.id.localeCompare(a.id))
}

/**
 * Deja la confirmación lista para salir.
 *
 * Es lo único que la app le escribe, y es irreversible: de esa columna sale la propuesta al
 * proveedor. Por eso la pantalla exige antes que el Inventario esté actualizado, que la planilla
 * exista y que alguien la haya revisado.
 */
export async function enviarConfirmacion(id: string): Promise<string> {
  await mondayApi('actualizarConfirmacion', {
    item: id,
    valores: JSON.stringify({ [COL_CONFIRMACION.estadoPropuesta]: { label: EMAIL_ENVIAR } }),
  })
  return id
}
