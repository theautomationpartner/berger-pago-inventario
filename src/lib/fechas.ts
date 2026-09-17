import { CONFIRMACION_LISTA, ESTADO_PROPUESTA } from '@/services/monday/columns'
import type { Confirmacion, TractorFecha } from '@/types'

/**
 * Las cuentas del módulo de fechas de producción.
 *
 * Dos preguntas, y las dos son de negocio, no de pantalla: qué se puede decidir sobre un tractor, y
 * qué va a pasar cuando se mande una confirmación. Por eso viven acá y se prueban solas.
 */

/**
 * ¿Se puede decidir sobre la fecha de este tractor?
 *
 * Hace falta una **confirmación conectada**: es la prueba de que DEUTZ mandó esa fecha por mail y
 * el circuito la registró. Sin ella, confirmar sería dar por buena una fecha que no se sabe de
 * dónde salió, y proponer sería responderle a un mail que nadie recibió.
 */
export const tieneConfirmacion = (t: TractorFecha): boolean => Boolean(t.confirmacionId)

/** El motivo por el que un tractor no se puede decidir, para mostrarlo tal cual. */
export const MOTIVO_SIN_CONFIRMACION =
  'No se detectó ninguna confirmación enviada por DEUTZ para este producto. Revisá el tablero ' +
  '📬Confirmación y Planificación de Fecha de Producción y la casilla de correo para asegurarte ' +
  'de que haya una confirmación vinculada.'

/** ¿Entra este tractor en lo que se está buscando? */
export function coincideTractor(t: TractorFecha, busqueda: string): boolean {
  const texto = busqueda.trim().toLowerCase()
  if (!texto) return true
  return [t.nombre, t.numInterno, t.modelo]
    .filter(Boolean)
    .some((campo) => campo.toLowerCase().includes(texto))
}

/**
 * Qué le va a pasar a cada tractor de una confirmación cuando se mande.
 *
 * - **Se confirma** el que no tiene fecha propuesta, y también el que tiene una propuesta IGUAL a
 *   la del proveedor: proponer la misma fecha es aceptarla, aunque el tablero la haya guardado como
 *   propuesta.
 * - **Se propone** el que tiene una fecha propuesta distinta de la del proveedor.
 */
export const seConfirma = (t: TractorFecha): boolean =>
  !t.fechaPropuesta.trim() || t.fechaPropuesta === t.fechaProd

export const sePropone = (t: TractorFecha): boolean => !seConfirma(t)

/** El reparto de una confirmación: qué se acepta y qué se le devuelve al proveedor. */
export interface ResumenConfirmacion {
  confirmados: TractorFecha[]
  propuestos: TractorFecha[]
  /** Los dos estados del tablero que tienen que estar listos para poder mandar. */
  inventarioActualizado: boolean
  planillaCreada: boolean
  /** Si el circuito ya está en condiciones de mandarse. */
  listaParaEnviar: boolean
  /** Si ya salió. Una confirmación enviada ni siquiera llega a la lista, pero el dato se informa. */
  yaEnviada: boolean
  /** Si el envío está en curso o detenido: se puede mirar, pero volver a mandarlo no ayuda. */
  enCurso: boolean
}

export function resumirConfirmacion(c: Confirmacion): ResumenConfirmacion {
  const inventarioActualizado = c.estadoActInventario === CONFIRMACION_LISTA.INVENTARIO_ACTUALIZADO
  const planillaCreada = c.creacionSheet === CONFIRMACION_LISTA.SHEET_CREADO

  return {
    confirmados: c.tractores.filter(seConfirma),
    propuestos: c.tractores.filter(sePropone),
    inventarioActualizado,
    planillaCreada,
    listaParaEnviar: inventarioActualizado && planillaCreada,
    yaEnviada: c.estadoPropuesta === ESTADO_PROPUESTA.ENVIADO,
    enCurso:
      c.estadoPropuesta === ESTADO_PROPUESTA.ENVIANDO ||
      c.estadoPropuesta === ESTADO_PROPUESTA.ENVIAR,
  }
}

/**
 * La URL con la que se puede INCRUSTAR una planilla de Google.
 *
 * La URL normal (`/edit`) no se puede meter en un iframe: Google la bloquea con
 * `X-Frame-Options`. La de `/preview` sí, siempre que quien mira tenga acceso al archivo con la
 * sesión de Google que ya tiene abierta en ese navegador.
 *
 * Devuelve `''` si el link no es una planilla reconocible; en ese caso la pantalla muestra sólo el
 * botón para abrirla aparte, en vez de un recuadro vacío.
 */
export function urlIncrustable(link: string): string {
  const m = /docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]+)/.exec(link ?? '')
  return m ? `https://docs.google.com/spreadsheets/d/${m[1]}/preview` : ''
}
