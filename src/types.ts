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
  /** Las operaciones 2 y 3 todavía no están implementadas. */
  disponible: boolean
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

/** Mes de trabajo de la operación. `mes` es 1-12, no el 0-11 de `Date`. */
export interface PeriodoMes {
  anio: number
  mes: number
}

/** Datos de la transferencia que completa el usuario antes de impactar en Monday. */
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

/** Resultado de impactar la operación en Monday. */
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

/** Etapa del asistente de la operación "Cargar Transferencia". */
export type Etapa = 'seleccion' | 'transferencia' | 'listo'
