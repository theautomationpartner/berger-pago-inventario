import { INV_ESTADO, PAGO_ESTADO, PAGO_OPERACION } from '@/services/monday/columns'

/**
 * Color de cada etiqueta de la app.
 *
 * Ninguna etiqueta va en gris: el gris se lee como "desactivado" y acá todas las etiquetas son
 * información vigente. Los colores tampoco son decorativos —siguen el avance del circuito, así
 * que el color solo ya dice en qué punto está cada cosa:
 *
 *   ámbar → recién empezado    azul → a mitad de camino    verde → cerrado
 *
 * El rojo queda reservado para lo que está mal (un subitem sin conexión, un tractor sin estado) y
 * el violeta para lo que no es un estado sino un atributo: forma de pago, número interno.
 */
export type Tono =
  | 'chip--verde'
  | 'chip--azul'
  | 'chip--ambar'
  | 'chip--rojo'
  | 'chip--violeta'
  | 'chip--teal'
  | 'chip--indigo'

/** Estado Pago del tablero de Pagos: CARGADO → APROBADO → CONFIRMADO. */
export function tonoEstadoPago(estado: string): Tono {
  switch (estado) {
    case PAGO_ESTADO.CONFIRMADO:
      return 'chip--verde'
    case PAGO_ESTADO.APROBADO:
      return 'chip--azul'
    case PAGO_ESTADO.CARGADO:
      return 'chip--ambar'
    default:
      return 'chip--violeta'
  }
}

/** Estado Pago del Inventario: el recorrido del tractor por las tres operaciones. */
export function tonoEstadoInventario(estado: string): Tono {
  switch (estado) {
    case INV_ESTADO.PAGADO:
      return 'chip--verde'
    case INV_ESTADO.TRANSF_APROBADA:
      return 'chip--azul'
    case INV_ESTADO.TRANSF_CARGADA:
      return 'chip--ambar'
    case INV_ESTADO.LISTO:
      return 'chip--teal'
    /* Un tractor sin estado dentro de un pago no es un caso más: significa que alguien lo sacó
       del circuito por fuera de la app, y avanzarlo así deja el tablero inconsistente. */
    case '':
      return 'chip--rojo'
    default:
      return 'chip--violeta'
  }
}

/** Operación Pendiente: quién tiene que actuar sobre el pago. */
export function tonoOperacionPend(operacion: string): Tono {
  switch (operacion) {
    case PAGO_OPERACION.PAGADO:
      return 'chip--verde'
    case PAGO_OPERACION.PEND_CONFIRMAR:
      return 'chip--azul'
    case PAGO_OPERACION.PEND_APROBAR:
      return 'chip--ambar'
    default:
      return 'chip--violeta'
  }
}
