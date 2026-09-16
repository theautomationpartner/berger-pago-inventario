/**
 * Lectura del Catálogo de Productos: el puerto de carga de cada modelo.
 *
 * El puerto no está en el tractor sino en su producto del Catálogo, así que se pide aparte, por
 * los ids que salieron de la conexión de cada tractor. Va en UNA consulta para todos: un despacho
 * de quince tractores suele tener tres o cuatro modelos distintos.
 */
import { COL_CATALOGO } from './columns'
import { porId, texto, type ColumnaCruda } from './parse'
import { mondayApi } from './sdk'

interface ItemCrudo {
  id: string
  column_values: ColumnaCruda[]
}

/**
 * Puertos por id de producto del Catálogo.
 *
 * La columna es un dropdown: con varias opciones elegidas Monday devuelve el texto separado por
 * comas, que es lo que se vuelve a partir acá.
 */
export async function puertosDeCatalogo(ids: string[]): Promise<Map<string, string[]>> {
  const puertos = new Map<string, string[]>()
  const unicos = [...new Set(ids.filter(Boolean))]
  if (unicos.length === 0) return puertos

  const r = await mondayApi<{ items: ItemCrudo[] }>('puertosDeCatalogo', { ids: unicos })
  for (const item of r.items ?? []) {
    const c = porId(item.column_values)
    const lista = texto(c[COL_CATALOGO.puerto])
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
    puertos.set(item.id, lista)
  }
  return puertos
}
