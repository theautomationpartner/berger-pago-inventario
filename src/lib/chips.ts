import { INV_ESTADO, PAGO_ESTADO, PAGO_OPERACION, RODADO } from '@/services/monday/columns'

/**
 * Color de cada etiqueta de la app.
 *
 * Ninguna etiqueta va en gris: el gris se lee como "desactivado" y acá todas las etiquetas son
 * información vigente. Los colores tampoco son decorativos —siguen el avance del circuito, así
 * que el color solo ya dice en qué punto está cada cosa:
 *
 *   ámbar → recién empezado    azul → a mitad de camino    verde → cerrado
 *
 * El rojo queda reservado para lo que está mal (un subitem sin conexión, un tractor sin estado).
 * Los atributos del tractor —que no son una etapa del circuito— llevan cada uno su color fijo,
 * para reconocerlos de un vistazo sin leer: índigo el número interno, magenta el modelo, violeta
 * la forma de pago, y el rodado en lima o naranja según lo tenga o no.
 */
export type Tono =
  | 'chip--verde'
  | 'chip--azul'
  | 'chip--ambar'
  | 'chip--rojo'
  | 'chip--violeta'
  | 'chip--teal'
  | 'chip--indigo'
  | 'chip--magenta'
  | 'chip--lima'
  | 'chip--naranja'

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

/**
 * Estado de carga de una OP en el Despachante de aduana.
 *
 * Sigue el mismo criterio que el resto: el color avanza con la carga, de lo recién empezado a lo
 * cerrado. Así el dashboard se lee sin leer: una pared de verde es un mes tranquilo, una de ámbar
 * es un mes con todo por salir.
 */
export function tonoEstadoCarga(estado: string): Tono {
  switch (estado) {
    case 'Nacionalizado':
      return 'chip--verde'
    case 'Próxima a Arribar':
      return 'chip--teal'
    case 'En Transito':
      return 'chip--azul'
    case 'Pendiente de Embarque':
      return 'chip--ambar'
    case 'Nueva OP':
      return 'chip--violeta'
    /* Una OP sin estado no es un caso más: alguien la vació a mano en el tablero, y sin estado no
       entra en ningún filtro ni en ningún widget. */
    case '':
      return 'chip--rojo'
    default:
      return 'chip--indigo'
  }
}

/**
 * Cercanía de la fecha de arribo.
 *
 * Es la otra lectura de un tablero de despachos: no importa sólo en qué estado está cada OP, sino
 * cuál llega primero. Vencida va en rojo porque es lo único que está mal —la fecha pasó y la OP
 * sigue abierta—; lo que llega esta semana en naranja, y lo lejano en azul.
 */
export function tonoEta(dias: number | null): Tono {
  if (dias == null) return 'chip--violeta'
  if (dias < 0) return 'chip--rojo'
  if (dias <= 7) return 'chip--naranja'
  if (dias <= 21) return 'chip--ambar'
  return 'chip--azul'
}

/**
 * Estado Rodado del tractor.
 *
 * "Sin Rodado" va en naranja y no en rojo: no es un error del dato, es una condición del tractor
 * que conviene ver antes de despacharlo. El rojo queda para cuando el dato directamente falta.
 */
export function tonoRodado(estado: string): Tono {
  switch (estado) {
    case RODADO.CON:
      return 'chip--lima'
    case RODADO.SIN:
      return 'chip--naranja'
    case '':
      return 'chip--rojo'
    default:
      return 'chip--violeta'
  }
}
