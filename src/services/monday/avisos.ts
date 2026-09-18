/**
 * El aviso a BERGER cuando una OP pasa a "Próxima a Arribar".
 *
 * Ese estado es el disparador de todo lo que tiene que hacer BERGER antes de que la carga llegue:
 * definir forma de pago, fondeo, banco, VEP, transporte y entrega. El despachante lo marca desde la
 * app, y de ahí en adelante la pelota es de BERGER, así que el aviso tiene que salir solo.
 *
 * Salen **dos cosas** por cada OP, y no una:
 *
 * - Un **update en el item**, que queda como registro de qué se pidió y cuándo.
 * - Una **notificación personal** a cada una, porque monday **descarta el marcado de las menciones**
 *   dentro del cuerpo de un update: se guarda el texto pero la persona nunca se entera. Probado
 *   contra la API: el `data-mention-id` desaparece al guardar.
 */
import { AVISO_PROXIMA_ARRIBAR, URL_TABLERO_CONTENEDORES } from './columns'
import type { ContenedorDespacho, DespachoOP } from '@/types'
import { mondayApi } from './sdk'

/** Cómo se nombra la OP en el aviso: su nombre y el número que le puso el despachante. */
const rotuloOp = (op: DespachoOP): string => (op.nroOp ? `${op.nombre} - (${op.nroOp})` : op.nombre)

/** Lo que BERGER tiene que completar en el item de la OP. */
const PENDIENTES_BERGER =
  'forma de pago, fondeo, banco de origen del pago de la mercadería, forma de pago del WEB ' +
  '(interbanking u otro), banco para declarar en el despacho, transporte a utilizar, ' +
  'lugar/ubicación de entrega y gestión de DNRPA.'

/**
 * El cuerpo del update.
 *
 * Cuando los contenedores ya están armados se suman sus links, porque la ubicación de entrega y el
 * transportista se cargan **en cada contenedor** y no en la OP: sin el link habría que ir a
 * buscarlos a mano al tablero.
 */
export function cuerpoDelAviso(op: DespachoOP, contenedores: ContenedorDespacho[]): string {
  const saludo =
    `<p>Hola, la siguiente OP: "${rotuloOp(op)}" EL DESPACHANTE LA MARCO en Estado de carga como ` +
    `"Próxima a Arribar", deben ingresar a completar los campos de ese ítem correspondientes a: ` +
    `${PENDIENTES_BERGER}</p>`

  if (contenedores.length === 0) return saludo

  const items = contenedores
    .map(
      (c) =>
        `<li><a href="${URL_TABLERO_CONTENEDORES}/pulses/${c.id}">` +
        `${c.numero || c.nombre}</a> — ${c.tractorIds.length} tractor` +
        `${c.tractorIds.length === 1 ? '' : 'es'}</li>`,
    )
    .join('')

  return (
    saludo +
    `<p>Los contenedores de esta OP ya están armados (${contenedores.length}). ` +
    `Entren al tablero de Contenedores a completar el <b>Transportista</b> y la ` +
    `<b>Ubicación de entrega</b> de cada uno:</p><ul>${items}</ul>`
  )
}

/** El texto de la notificación. Va sin formato: monday la muestra como una línea. */
export function textoDeLaNotificacion(op: DespachoOP, contenedores: ContenedorDespacho[]): string {
  const base =
    `La OP "${rotuloOp(op)}" pasó a "Próxima a Arribar". Hay que completar forma de pago, fondeo, ` +
    `banco, VEP, transporte, entrega y DNRPA.`
  if (contenedores.length === 0) return base
  const cuantos =
    contenedores.length === 1
      ? 'El contenedor ya está armado'
      : `Los ${contenedores.length} contenedores ya están armados`
  return `${base} ${cuantos}: falta cargarles transportista y ubicación de entrega.`
}

/**
 * Deja el aviso en el item y notifica a cada persona.
 *
 * Ninguna de las dos cosas aborta nada: para cuando se llega acá, la OP ya quedó actualizada en el
 * tablero. Si el aviso falla, se devuelve el motivo para mostrarlo como advertencia —y el estado,
 * que es lo que de verdad importa, ya está escrito—.
 */
export async function avisarProximaArribar(
  op: DespachoOP,
  contenedores: ContenedorDespacho[],
): Promise<string[]> {
  const advertencias: string[] = []

  try {
    await mondayApi('crearUpdate', { item: op.id, cuerpo: cuerpoDelAviso(op, contenedores) })
  } catch (e) {
    advertencias.push(
      `No se pudo dejar el update en ${op.nombre}: ${e instanceof Error ? e.message : String(e)}`,
    )
  }

  const texto = textoDeLaNotificacion(op, contenedores)
  for (const persona of AVISO_PROXIMA_ARRIBAR) {
    try {
      await mondayApi('notificar', { usuario: persona.id, item: op.id, texto })
    } catch (e) {
      advertencias.push(
        `No se pudo notificar a ${persona.nombre}: ${e instanceof Error ? e.message : String(e)}`,
      )
    }
  }

  return advertencias
}
