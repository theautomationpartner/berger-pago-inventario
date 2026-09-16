/**
 * El envío de la planificación al proveedor.
 *
 * Crea un item en 📬Confirmación y Planificación con los drafts conectados, y recién cuando todo
 * quedó escrito deja el estado de envío en "Enviar": de esa columna sale el mail a DEUTZ con los
 * PDF y los períodos sugeridos, y dispararlo antes sería mandar una planificación a medio armar.
 *
 * El mail es lo único irreversible de la operación, así que es lo último. Si falla, el item ya
 * está bien creado: se informa como advertencia y se puede mandar desde el tablero.
 */
import { fechaCorta, hoyISO } from '@/lib/format'
import type { Draft, ResultadoEnvio } from '@/types'
import { COL_PLANIF, EMAIL_ENVIAR, PLANIF_TIPO } from './columns'
import { mondayApi } from './sdk'

const motivo = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/** Nombre del item: se lee solo en el tablero, con la fecha de emisión. */
export const nombreDePlanificacion = (fecha: string): string => `Planificación ${fechaCorta(fecha)}`

export async function enviarPlanificacion(drafts: Draft[]): Promise<ResultadoEnvio> {
  if (drafts.length === 0) throw new Error('No hay drafts seleccionados.')

  const fecha = hoyISO()
  const nombre = nombreDePlanificacion(fecha)
  const advertencias: string[] = []

  const creado = await mondayApi<{ create_item: { id: string } }>('crearPlanificacion', {
    nombre,
    valores: JSON.stringify({
      [COL_PLANIF.tipo]: { label: PLANIF_TIPO },
      [COL_PLANIF.fecha]: { date: fecha },
      [COL_PLANIF.drafts]: { item_ids: drafts.map((d) => d.id) },
    }),
  })
  const planificacionId = creado.create_item.id

  try {
    await mondayApi('actualizarPlanificacion', {
      item: planificacionId,
      valores: JSON.stringify({ [COL_PLANIF.estadoEnvio]: { label: EMAIL_ENVIAR } }),
    })
  } catch (e) {
    advertencias.push(
      `La planificación se creó, pero no se pudo disparar el envío: ${motivo(e)}. ` +
        'Podés mandarla desde el tablero.',
    )
  }

  return { planificacionId, nombre, drafts: drafts.length, advertencias }
}
