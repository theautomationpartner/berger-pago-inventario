/**
 * Los contenedores reales de un despacho: los que arma el despachante.
 *
 * No confundir con 📦Contenedores (`18430565324`), que dice qué modelos PUEDEN viajar juntos y se
 * usa para estimar cuántos harían falta. Éste es el contenedor de verdad, con su número y los
 * tractores que efectivamente lo ocupan: **el dato que vale es cómo los armó el despachante**, no
 * la estimación que hizo la app al crear el despacho.
 */
import { nombreDeContenedor } from '@/lib/despachos'
import { hoyISO } from '@/lib/format'
import type { Contacto, ContenedorDespacho, TractorDeOp } from '@/types'
import {
  CATEGORIA_CONTACTO,
  COL_CONTACTOS,
  COL_CONT_DESPACHO,
  COL_DESPACHANTE_SUB,
} from './columns'
import { espejo, fechaISO, porId, texto, type ColumnaCruda } from './parse'
import { mondayApi } from './sdk'

interface ColumnaRica extends ColumnaCruda {
  linked_item_ids?: string[] | null
}

interface SubitemCrudo {
  id: string
  name: string
  column_values: ColumnaRica[]
}

const COLUMNAS_TRACTOR = [
  COL_DESPACHANTE_SUB.chasis,
  COL_DESPACHANTE_SUB.modelo,
  COL_DESPACHANTE_SUB.rodado,
  COL_DESPACHANTE_SUB.numDraft,
  COL_DESPACHANTE_SUB.contenedor,
  COL_DESPACHANTE_SUB.valorNeto,
  COL_DESPACHANTE_SUB.nroFactCompra,
]

const COLUMNAS_CONTENEDOR = [
  COL_CONT_DESPACHO.numero,
  COL_CONT_DESPACHO.fechaCreacion,
  COL_CONT_DESPACHO.ubicacion,
  COL_CONT_DESPACHO.transportista,
  COL_CONT_DESPACHO.patente,
  COL_CONT_DESPACHO.fechaTurno,
  COL_CONT_DESPACHO.estadoArribo,
  COL_CONT_DESPACHO.tractores,
  COL_CONT_DESPACHO.opDespacho,
  COL_CONT_DESPACHO.nroOpDespachante,
  COL_CONT_DESPACHO.idOp,
  COL_CONT_DESPACHO.estadoCargaOp,
  COL_CONT_DESPACHO.chasis,
]

/** Un item del tablero de contenedores, ya normalizado. */
function aContenedor(item: {
  id: string
  name: string
  column_values: ColumnaRica[]
}): ContenedorDespacho {
  const c = porId(item.column_values) as Record<string, ColumnaRica | undefined>
  return {
    id: item.id,
    nombre: item.name,
    numero: texto(c[COL_CONT_DESPACHO.numero]),
    fechaCreacion: fechaISO(c[COL_CONT_DESPACHO.fechaCreacion]),
    ubicacion: texto(c[COL_CONT_DESPACHO.ubicacion]),
    transportista: texto(c[COL_CONT_DESPACHO.transportista]),
    patente: texto(c[COL_CONT_DESPACHO.patente]),
    fechaTurno: fechaISO(c[COL_CONT_DESPACHO.fechaTurno]),
    estadoArribo: texto(c[COL_CONT_DESPACHO.estadoArribo]),
    tractorIds: c[COL_CONT_DESPACHO.tractores]?.linked_item_ids ?? [],
    opId: c[COL_CONT_DESPACHO.opDespacho]?.linked_item_ids?.[0] ?? null,
    // Los espejos traen su valor en `display_value`, nunca en `text`.
    nroOpDespachante: espejo(c[COL_CONT_DESPACHO.nroOpDespachante]),
    idOp: espejo(c[COL_CONT_DESPACHO.idOp]),
    estadoCargaOp: espejo(c[COL_CONT_DESPACHO.estadoCargaOp]),
    chasis: espejo(c[COL_CONT_DESPACHO.chasis]),
  }
}

function aTractor(s: SubitemCrudo): TractorDeOp {
  const c = porId(s.column_values) as Record<string, ColumnaRica | undefined>
  return {
    id: s.id,
    nombre: s.name,
    // Chasis, modelo y rodado son espejos del Inventario: su valor vive en `display_value`.
    chasis: espejo(c[COL_DESPACHANTE_SUB.chasis]),
    modelo: espejo(c[COL_DESPACHANTE_SUB.modelo]),
    rodado: espejo(c[COL_DESPACHANTE_SUB.rodado]),
    numDraft: texto(c[COL_DESPACHANTE_SUB.numDraft]),
    contenedorId: c[COL_DESPACHANTE_SUB.contenedor]?.linked_item_ids?.[0] ?? null,
    /* El valor neto es una columna propia del subitem; la factura es otro espejo del Inventario,
       así que se leen distinto: una del texto de la columna y la otra del valor espejado. */
    valorNeto: texto(c[COL_DESPACHANTE_SUB.valorNeto]),
    nroFactCompra: espejo(c[COL_DESPACHANTE_SUB.nroFactCompra]),
  }
}

/** Los tractores de una o varias OP, por id de la OP. */
export async function tractoresDeOps(opIds: string[]): Promise<Map<string, TractorDeOp[]>> {
  const porOp = new Map<string, TractorDeOp[]>()
  const unicos = [...new Set(opIds.filter(Boolean))]
  if (unicos.length === 0) return porOp

  const r = await mondayApi<{ items: { id: string; subitems: SubitemCrudo[] | null }[] }>(
    'tractoresDeOp',
    { ids: unicos, columnas: COLUMNAS_TRACTOR },
  )
  for (const item of r.items ?? []) {
    porOp.set(item.id, (item.subitems ?? []).map(aTractor))
  }
  return porOp
}

/** Los contenedores ya armados, por id. */
export async function contenedoresPorIds(ids: string[]): Promise<ContenedorDespacho[]> {
  const unicos = [...new Set(ids.filter(Boolean))]
  if (unicos.length === 0) return []

  const r = await mondayApi<{
    items: { id: string; name: string; column_values: ColumnaRica[] }[]
  }>('contenedoresDeDespacho', { ids: unicos, columnas: COLUMNAS_CONTENEDOR })
  return (r.items ?? []).map(aContenedor)
}

/**
 * TODOS los contenedores del tablero.
 *
 * Es lo que mira BERGER para marcar arribos y cargar entregas: no se entra por la OP sino por el
 * contenedor, porque un camión llega y se descarga de a uno. El filtro por estado lo hace la
 * pantalla, que es instantáneo: el tablero crece de a un puñado de filas por despacho.
 */
export async function contenedoresDelTablero(): Promise<ContenedorDespacho[]> {
  const r = await mondayApi<{
    boards: {
      items_page: { items: { id: string; name: string; column_values: ColumnaRica[] }[] }
    }[]
  }>('contenedoresDelTablero', { columnas: COLUMNAS_CONTENEDOR, limite: 500 })

  return (
    (r.boards?.[0]?.items_page.items ?? [])
      .map(aContenedor)
      // Los más nuevos arriba: el id de monday crece con el tiempo.
      .sort((a, b) => b.id.localeCompare(a.id))
  )
}

/** Los contenedores de una OP, a partir de sus tractores. */
export async function contenedoresDeOp(tractores: TractorDeOp[]): Promise<ContenedorDespacho[]> {
  const ids = tractores.map((t) => t.contenedorId).filter((id): id is string => Boolean(id))
  return contenedoresPorIds(ids)
}

/**
 * Crea un contenedor con los tractores que van adentro.
 *
 * Sólo se escribe el lado del contenedor: la conexión con el subitem es de doble vía y monday
 * completa el otro lado solo. Escribir los dos sería pisar el mismo dato dos veces, y dejaría la
 * puerta abierta a que queden distintos si una de las dos escrituras falla.
 *
 * El nombre del item es el número de contenedor: es como se lo nombra en el puerto, en el buque y
 * en el remito, así que es lo que tiene que leerse en el tablero.
 */
export async function crearContenedor(
  numero: string,
  tractores: TractorDeOp[],
  opId: string,
): Promise<string> {
  const r = await mondayApi<{ create_item: { id: string } }>('crearContenedorDespacho', {
    // El nombre dice QUÉ lleva; el número va en su columna. En el tablero se ve primero el nombre,
    // y "2 x 6205 G AGROTRON" identifica la carga mucho antes que una matrícula de contenedor.
    nombre: nombreDeContenedor(tractores),
    valores: JSON.stringify({
      [COL_CONT_DESPACHO.numero]: numero,
      [COL_CONT_DESPACHO.fechaCreacion]: { date: hoyISO() },
      [COL_CONT_DESPACHO.tractores]: { item_ids: tractores.map((t) => t.id) },
      /* La conexión al ITEM de la OP, además de la de los subitems: es la que le da al contenedor
         el número de OP y el estado de carga espejados, que es con lo que después se lo busca. */
      [COL_CONT_DESPACHO.opDespacho]: { item_ids: [opId] },
    }),
  })
  return r.create_item.id
}

/** Ubicación, transportista y arribo: lo que completa BERGER de cada contenedor. */
export async function actualizarContenedor(
  id: string,
  cambios: {
    ubicacion?: string
    coordenadas?: { lat: string; lng: string } | null
    transportistaId?: string | null
    estadoArribo?: string
  },
): Promise<string> {
  const valores: Record<string, unknown> = {}
  if (cambios.ubicacion !== undefined) {
    /* Una columna de ubicación de monday EXIGE latitud y longitud: con sólo la dirección rechaza
       la escritura entera —probado contra la API—. Cuando la dirección se eligió del buscador van
       SUS coordenadas, y el tablero queda igual que si se hubiera cargado a mano desde monday.
       Cuando se escribió libre —una entrega que el buscador no encuentra— van en 0: la dirección
       se lee bien, que es lo que necesita el transportista, y el punto del mapa se ajusta después.
       Se limpia con el objeto vacío, igual que una fecha o un dropdown. */
    valores[COL_CONT_DESPACHO.ubicacion] = cambios.ubicacion
      ? {
          lat: cambios.coordenadas?.lat ?? '0',
          lng: cambios.coordenadas?.lng ?? '0',
          address: cambios.ubicacion,
        }
      : {}
  }
  if (cambios.transportistaId !== undefined) {
    valores[COL_CONT_DESPACHO.transportista] = cambios.transportistaId
      ? { item_ids: [cambios.transportistaId] }
      : { item_ids: [] }
  }
  if (cambios.estadoArribo !== undefined) {
    valores[COL_CONT_DESPACHO.estadoArribo] = cambios.estadoArribo
      ? { label: cambios.estadoArribo }
      : {}
  }
  if (Object.keys(valores).length === 0) throw new Error('No hay cambios para guardar.')

  await mondayApi('actualizarContenedorDespacho', { item: id, valores: JSON.stringify(valores) })
  return id
}

/** Los contactos, para elegir el transportista. */
export async function listarContactos(): Promise<Contacto[]> {
  const r = await mondayApi<{
    boards: {
      items_page: { items: { id: string; name: string; column_values: ColumnaRica[] }[] }
    }[]
  }>('contactos', { columnas: [COL_CONTACTOS.categoria], limite: 500 })

  return (r.boards?.[0]?.items_page.items ?? [])
    .map((i) => ({
      id: i.id,
      nombre: i.name,
      /* La categoría es un dropdown de selección múltiple: monday devuelve las etiquetas en una
         sola cadena separada por comas, no como lista. */
      categorias: texto(porId(i.column_values)[COL_CONTACTOS.categoria] as ColumnaRica | undefined)
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/**
 * Los contactos que pueden llevar un contenedor.
 *
 * El tablero de Contactos es la agenda entera —clientes, proveedores, despachantes—, así que sin
 * filtrar el desplegable ofrece gente a la que no se le puede asignar un flete. Se filtra por la
 * categoría del propio tablero y no por una lista en el código: alta un transportista nuevo y
 * aparece, sin tocar la app.
 */
export async function listarTransportistas(): Promise<Contacto[]> {
  const todos = await listarContactos()
  return todos.filter((c) => c.categorias.includes(CATEGORIA_CONTACTO.TRANSPORTISTA))
}
