/**
 * IDs reales de tableros y columnas de la cuenta de BERGER S.A. (36618349).
 *
 * Relevados con `boards { columns { id title type settings_str } }`: son la ÚNICA fuente de
 * verdad de los identificadores. Ninguna query los escribe sueltos, así que cuando Monday cambie
 * una columna se toca un solo archivo.
 */

export const TABLEROS = {
  /** Inventario: un item por tractor. */
  inventario: '18428578101',
  /** Pagos del Inventario: un item por transferencia. */
  pagos: '18430295445',
  /** Subelementos de Pagos del Inventario: un subitem por tractor pagado. */
  pagosSubitems: '18430295515',
} as const

/** 🚜 Inventario (18428578101) — columnas que lee y escribe esta app. */
export const COL_INV = {
  /** N° Interno del tractor. Se muestra al lado del nombre. */
  numInterno: 'text_mm6n7mk6',
  /** N° de Draft. Viaja al subitem del pago (`text_mm71atj2`). */
  numDraft: 'text_mm6ne4br',
  /** Fecha de Prod. Su MES y AÑO son los que deciden qué tractores entran a la operación. */
  fechaProd: 'date_mm6nymx',
  /** Estado Pago. Filtra la selección y es lo que la app avanza al cargar la transferencia. */
  estadoPago: 'color_mm6v6532',
  /** Mirror del Costo de Flete (viene de Importación – Drafts). Sólo lectura. */
  costoFlete: 'lookup_mm6vg317',
  /** Mirror del Precio Unitario. Sólo lectura. */
  precioUnitario: 'lookup_mm6vfwgy',
  /** Mirror del Valor Neto. Es el importe que se suma para el total de la transferencia. */
  valorNeto: 'lookup_mm6vj4cp',
  /** Forma de Pago (ANTICIPADO / VISTA / VENCIDO). Sólo lectura en esta app. */
  formaPago: 'dropdown_mm6v2sa0',
  /** Mirror del Cod. de Producto. Viaja al subitem del pago (`text_mm71zgys`). */
  codProducto: 'lookup_mm6z4hd1',
} as const

/**
 * Etiquetas de "Estado Pago" (`color_mm6v6532`) que le importan a la app.
 *
 * `LISTO` es el único estado desde el que se puede cargar una transferencia; `TRANSF_CARGADA` es
 * el estado al que la app lo lleva. Los demás (`Pend de Pago`, `A Pagar Prox Mes`, `Transf
 * Aprobada`, `Pagado`) los maneja el resto del circuito.
 */
export const INV_ESTADO = {
  LISTO: 'Listo para Pagar',
  TRANSF_CARGADA: 'Transf Cargada',
  TRANSF_APROBADA: 'Transf Aprobada',
  PAGADO: 'Pagado',
} as const

/**
 * Índice de "Listo para Pagar" dentro de la columna de estado.
 *
 * Monday filtra los `status` por índice, no por texto: mandar la etiqueta devuelve una lista
 * vacía sin error, que es la forma más silenciosa posible de romper una pantalla. El índice se
 * usa sólo para pedirle menos filas a la API; el filtro que decide de verdad se vuelve a aplicar
 * en el cliente comparando la etiqueta, así que un cambio de índice no cuelga la app.
 */
export const INV_ESTADO_LISTO_INDEX = 2

/** 💸 Pagos del Inventario (18430295445) — columnas que completa esta app. */
export const COL_PAGO = {
  /** Archivo PDF de la transferencia. */
  transferencia: 'file_mm71eqv5',
  montoTransferencia: 'numeric_mm714xb2',
  fechaEmision: 'date_mm71jrsz',
  estadoPago: 'color_mm71p4rf',
} as const

/** Etiquetas de "Estado Pago" del tablero de Pagos (`color_mm71p4rf`). */
export const PAGO_ESTADO = {
  CARGADO: 'CARGADO',
  APROBADO: 'APROBADO',
  CONFIRMADO: 'CONFIRMADO',
} as const

/** 💸 Subelementos de Pagos del Inventario (18430295515) — un subitem por tractor. */
export const COL_PAGO_SUB = {
  valorNeto: 'numeric_mm71c5je',
  numDraft: 'text_mm71atj2',
  codProducto: 'text_mm71zgys',
  /** Conexión al item del tractor en el tablero de Inventario. */
  inventario: 'board_relation_mm718zjg',
} as const
