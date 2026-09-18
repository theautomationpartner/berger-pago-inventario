/**
 * El aviso a BERGER cuando una OP pasa a "Próxima a Arribar".
 *
 * Ese estado es el disparador de todo lo que tiene que hacer BERGER antes de que la carga llegue:
 * definir forma de pago, fondeo, banco, VEP, transporte y entrega. El despachante lo marca desde la
 * app, y de ahí en adelante la pelota es de BERGER, así que el aviso tiene que salir solo.
 *
 * El aviso es **un update con menciones de verdad**: `create_update` acepta un `mentions_list`, y
 * eso es lo que hace que a la persona le llegue. Incrustar el marcado de la mención dentro del
 * `body` NO sirve —monday lo descarta al guardar, el texto queda y nadie se entera—, y `mentions_list`
 * no existe en la versión de la API que usa el resto de la app, así que esa operación declara una
 * versión propia.
 *
 * Si el update falla, se cae a **notificaciones personales**: es menos prolijo —no queda registro en
 * el item— pero la gente se entera igual, que es lo que no se puede perder.
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

  /* monday agrega las menciones AL FINAL del cuerpo, como enlaces. Por eso el texto no las nombra
     adentro y termina con esta línea: sin ella, los "@" aparecerían sueltos sin decir para qué. */
  const cierre = `<p>Aviso para:</p>`

  if (contenedores.length === 0) return saludo + cierre

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
    `<b>Ubicación de entrega</b> de cada uno:</p><ul>${items}</ul>` +
    cierre
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
 * Deja el aviso en el item, mencionando a las dos.
 *
 * No aborta nada: para cuando se llega acá, la OP ya quedó actualizada en el tablero. Si el update
 * falla, se intenta la notificación personal —el camino de atrás— y recién si eso también falla se
 * devuelve el motivo para mostrarlo como advertencia.
 */
export async function avisarProximaArribar(
  op: DespachoOP,
  contenedores: ContenedorDespacho[],
): Promise<string[]> {
  const advertencias: string[] = []

  try {
    await mondayApi('crearUpdate', {
      item: op.id,
      cuerpo: cuerpoDelAviso(op, contenedores),
      menciones: AVISO_PROXIMA_ARRIBAR.map((p) => ({ id: p.id })),
    })
    return advertencias
  } catch (e) {
    advertencias.push(
      `No se pudo dejar el update en ${op.nombre}: ${e instanceof Error ? e.message : String(e)}. ` +
        'Se avisa por notificación.',
    )
  }

  /* Camino de atrás: sin update, al menos que les llegue la notificación. Es lo que no se puede
     perder, porque de este aviso depende que BERGER complete el despacho antes de que llegue. */
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
