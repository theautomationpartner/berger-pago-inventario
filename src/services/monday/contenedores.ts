/**
 * Lectura del tablero de Contenedores: qué modelos del catálogo viajan juntos y cuántos entran.
 *
 * Son pocas filas y cambian poco, así que se traen todas de una vez al abrir la pantalla. El
 * armado de los contenedores después ocurre en el navegador, con cada tractor que el usuario
 * marca: si hubiera que consultar monday por cada clic, el resumen llegaría tarde y la selección
 * dejaría de sentirse inmediata.
 */
import { contenedoresDelTipo } from '@/lib/contenedores'
import type { OpcionContenedor } from '@/types'
import { COL_CONTENEDOR } from './columns'
import { aNumeroEspejo, porId, texto, type ColumnaCruda } from './parse'
import { mondayApi } from './sdk'

interface ColumnaConexion extends ColumnaCruda {
  linked_item_ids?: string[] | null
}

interface ItemCrudo {
  id: string
  name: string
  column_values: ColumnaConexion[]
}

const COLUMNAS = Object.values(COL_CONTENEDOR)

/** Todas las combinaciones cargadas, listas para armar contenedores. */
export async function opcionesDeContenedor(): Promise<OpcionContenedor[]> {
  const datos = await mondayApi<{ boards: { items_page: { items: ItemCrudo[] } }[] }>(
    'contenedores',
    {
      columnas: COLUMNAS,
      limite: 200,
    },
  )

  return (
    (datos.boards?.[0]?.items_page.items ?? [])
      .map((item): OpcionContenedor => {
        const c = porId(item.column_values) as Record<string, ColumnaConexion | undefined>
        const tipo = texto(c[COL_CONTENEDOR.tipo])
        return {
          id: item.id,
          nombre: item.name.trim(),
          catalogo: c[COL_CONTENEDOR.catalogo]?.linked_item_ids ?? [],
          tipo,
          contenedores: contenedoresDelTipo(tipo),
          capacidad: Math.max(
            0,
            Math.trunc(aNumeroEspejo(texto(c[COL_CONTENEDOR.capacidad])) ?? 0),
          ),
          ruedas: texto(c[COL_CONTENEDOR.ruedas]),
        }
      })
      // Una fila sin productos conectados o sin capacidad no puede recibir a nadie: se descarta acá
      // para que el armado no tenga que defenderse de datos a medio cargar.
      .filter((o) => o.catalogo.length > 0 && o.capacidad > 0)
  )
}
