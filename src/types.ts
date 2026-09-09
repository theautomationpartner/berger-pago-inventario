/**
 * Estructuras de datos de la app.
 *
 * Todo lo que llega de Monday se normaliza acá antes de entrar a la interfaz: los componentes
 * nunca ven un `column_values` crudo. Eso es lo que permite que un cambio de columna se resuelva
 * en `services/monday/` sin tocar una sola vista.
 */

/** Las tres operaciones del circuito de pago. */
export type Operacion = 'cargar' | 'aprobar' | 'confirmar'

export interface DefinicionOperacion {
  id: Operacion
  titulo: string
  detalle: string
  icono: string
}

/**
 * Un tractor del tablero de Inventario, ya normalizado.
 *
 * Los importes vienen de columnas MIRROR: Monday las devuelve como texto en `display_value` y
 * nunca como número, así que se parsean una sola vez acá. `null` significa "el espejo no trajo
 * valor", que no es lo mismo que cero y por eso no se colapsa a 0.
 */
export interface Tractor {
  id: string
  /** Nombre del item: ya trae el N° de draft y el código de producto. */
  nombre: string
  numInterno: string
  numDraft: string
  codProducto: string
  /** Fecha de Prod en ISO (`YYYY-MM-DD`), o `''` si el item no la tiene cargada. */
  fechaProd: string
  estadoPago: string
  costoFlete: number | null
  precioUnitario: number | null
  valorNeto: number | null
  formaPago: string
}

/** Mes de trabajo de la operación 1. `mes` es 1-12, no el 0-11 de `Date`. */
export interface PeriodoMes {
  anio: number
  mes: number
}

/** Datos de la transferencia que completa el usuario en la operación 1. */
export interface DatosTransferencia {
  archivo: File | null
  /**
   * Monto tipeado, TAL CUAL lo escribió el usuario.
   *
   * Se guarda como texto y no como número a propósito: parsear en cada tecla y volver a
   * imprimir el resultado borra la coma decimal apenas se escribe ("1234," vuelve como "1234")
   * y deja el campo imposible de completar. La conversión a número ocurre una sola vez, al
   * confirmar.
   */
  monto: string
  /** Fecha de emisión en ISO (`YYYY-MM-DD`). */
  fechaEmision: string
}

/**
 * Un tractor dentro de un pago ya registrado: el subitem del tablero de Pagos.
 *
 * `tractorId` es la conexión al item del Inventario. Es el dato que hace posible que las
 * operaciones 2 y 3 avancen el estado del tractor sin tener que volver a buscarlo por nombre.
 */
export interface SubitemPago {
  id: string
  nombre: string
  numDraft: string
  codProducto: string
  numInterno: string
  valorNeto: number | null
  /** Item del Inventario conectado, o `null` si el subitem quedó sin conexión. */
  tractorId: string | null
  /** Estado Pago actual del tractor en el Inventario. */
  estadoTractor: string
}

/** Un pago del tablero de Pagos del Inventario, con sus tractores. */
export interface Pago {
  id: string
  nombre: string
  monto: number | null
  fechaEmision: string
  estadoPago: string
  operacionPend: string
  fechaCargado: string
  fechaAprobado: string
  /** URL del archivo adjunto en cada etapa, o `''` si todavía no hay. */
  urlTransferencia: string
  urlTransferenciaConNumero: string
  urlComprobanteBanco: string
  tractores: SubitemPago[]
}

/** Resultado de la operación 1. */
export interface ResultadoCarga {
  /** Item creado en el tablero de Pagos del Inventario. */
  pagoId: string
  /** Subitems creados, uno por tractor. */
  subitemIds: string[]
  /** Tractores cuyo estado quedó en `Transf Cargada`. */
  tractoresActualizados: number
  /**
   * Pasos que fallaron sin abortar la operación (por ejemplo, un estado que no se pudo
   * actualizar). El pago ya está creado: la app lo informa en vez de fingir que salió todo bien.
   */
  advertencias: string[]
}

/** Resultado de las operaciones 2 y 3. */
export interface ResultadoAvance {
  pagoId: string
  tractoresActualizados: number
  advertencias: string[]
}

/** Etapa del asistente de la operación 1. */
export type Etapa = 'seleccion' | 'transferencia' | 'listo'

/** Etapa del asistente de las operaciones 2 y 3. */
export type EtapaAvance = 'seleccion' | 'archivo' | 'listo'

/**
 * Configuración de una operación que avanza un pago ya existente (las número 2 y 3).
 *
 * Las dos hacen exactamente lo mismo —elegir un pago pendiente, adjuntar un comprobante y
 * empujar el circuito un casillero— y sólo cambian en QUÉ estados leen y escriben. Describirlas
 * como datos, en vez de duplicar el flujo en dos componentes casi iguales, es lo que garantiza
 * que un arreglo en el manejo de errores valga para las dos.
 */
export interface FlujoAvance {
  operacion: Operacion
  /** Qué pagos se ofrecen: etiqueta de "Operacion Pend" y, si hace falta, de "Estado Pago". */
  filtroOperacionPend: string
  filtroEstadoPago?: string

  /** Textos de la pantalla. */
  tituloSeleccion: string
  detalleSeleccion: string
  vacioTitulo: string
  vacioDetalle: string
  tituloArchivo: string
  detalleArchivo: string
  zonaTitulo: string
  botonAccion: string
  finalTitulo: string
  finalDetalle: string

  /** Dónde se guarda el comprobante que sube el usuario. */
  columnaArchivo: string
  /** Estados y fecha que quedan en el pago. */
  nuevoEstadoPago: string
  nuevaOperacionPend: string
  columnaFecha: string
  /** Estado al que pasan los tractores del pago en el Inventario. */
  nuevoEstadoInventario: string
  /** Columna del aviso por mail que se deja en "Enviar". */
  columnaEmail: string
  /** Qué hace ese mail, para poder contarlo en pantalla. */
  detalleEmail: string
}
