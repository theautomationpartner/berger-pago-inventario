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

/** URL del tablero de pagos, para los enlaces "ver en monday". */
export const URL_TABLERO_PAGOS = 'https://maquinariasagricolas.monday.com/boards/18430295445'

/** 🚜 Inventario (18428578101) — columnas que lee y escribe esta app. */
export const COL_INV = {
  /** N° Interno del tractor. Se muestra al lado del nombre. */
  numInterno: 'text_mm6n7mk6',
  /** N° de Draft. Viaja al subitem del pago (`text_mm71atj2`). */
  numDraft: 'text_mm6ne4br',
  /** Fecha de Prod. Su MES y AÑO son los que deciden qué tractores entran a la operación 1. */
  fechaProd: 'date_mm6nymx',
  /** Estado Pago. Es lo que la app va avanzando en las tres operaciones. */
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
 * Etiquetas de "Estado Pago" del Inventario (`color_mm6v6532`).
 *
 * Marcan el recorrido del tractor por las tres operaciones: `LISTO` → `TRANSF_CARGADA` →
 * `TRANSF_APROBADA` → `PAGADO`.
 */
export const INV_ESTADO = {
  LISTO: 'Listo para Pagar',
  TRANSF_CARGADA: 'Transf Cargada',
  TRANSF_APROBADA: 'Transf Aprobada',
  PAGADO: 'Pagado',
} as const

/**
 * Índice de "Listo para Pagar" dentro de la columna de estado del Inventario.
 *
 * Monday filtra los `status` por índice, no por texto: mandar la etiqueta devuelve una lista
 * vacía sin error, que es la forma más silenciosa posible de romper una pantalla. El índice se
 * usa sólo para pedirle menos filas a la API; el filtro que decide de verdad se vuelve a aplicar
 * en el cliente comparando la etiqueta, así que un cambio de índice no cuelga la app.
 */
export const INV_ESTADO_LISTO_INDEX = 2

/** 💸 Pagos del Inventario (18430295445) — columnas que lee y completa esta app. */
export const COL_PAGO = {
  /** Operación 1: PDF de la transferencia emitida. */
  transferencia: 'file_mm71eqv5',
  /** Operación 2: PDF de la transferencia CON número, la que se le manda al proveedor. */
  transferenciaConNumero: 'file_mm71s567',
  /** Operación 3: comprobante del banco que acredita el depósito. */
  comprobanteBanco: 'file_mm713dbc',

  montoTransferencia: 'numeric_mm714xb2',
  fechaEmision: 'date_mm71jrsz',

  /** Estado Pago: CARGADO → APROBADO → CONFIRMADO. */
  estadoPago: 'color_mm71p4rf',
  /** Operación Pendiente: es la columna que dice quién tiene que actuar a continuación. */
  operacionPend: 'color_mm71e2wc',

  /** Fecha en que se completó cada operación. */
  fechaCargado: 'date_mm71zare',
  fechaAprobado: 'date_mm71xrq5',
  fechaConfirmado: 'date_mm71q4qa',

  /** Disparadores de los avisos por mail al proveedor; los manda la automatización del tablero. */
  estadoEmail1: 'color_mm71tfkp',
  estadoEmail2: 'color_mm71bk6h',
} as const

/** Etiquetas de "Estado Pago" del tablero de Pagos (`color_mm71p4rf`). */
export const PAGO_ESTADO = {
  CARGADO: 'CARGADO',
  APROBADO: 'APROBADO',
  CONFIRMADO: 'CONFIRMADO',
} as const

/**
 * Etiquetas de "Operacion Pend" (`color_mm71e2wc`).
 *
 * Es la columna que la app usa para saber qué pagos ofrecer en cada operación: la 2 trabaja sobre
 * los `PEND_APROBAR` y la 3 sobre los `PEND_CONFIRMAR`.
 */
export const PAGO_OPERACION = {
  PEND_APROBAR: 'Pend de Aprobar Transf',
  PEND_CONFIRMAR: 'Pend de Confirmar Transf',
  PAGADO: 'Pagado',
} as const

/**
 * Índices de "Operacion Pend", para pedirle menos filas a la API. Igual que en el Inventario, el
 * filtro definitivo se aplica después comparando la etiqueta.
 */
export const PAGO_OPERACION_INDEX: Record<string, number> = {
  [PAGO_OPERACION.PEND_APROBAR]: 0,
  [PAGO_OPERACION.PAGADO]: 1,
  [PAGO_OPERACION.PEND_CONFIRMAR]: 2,
}

/**
 * Etiqueta que dispara el envío del mail.
 *
 * La app sólo la pone en `Enviar`; el resto del ciclo (`Enviando`, `Enviado`, `Error - Ver
 * Update`) lo maneja la automatización del tablero y no tiene sentido que lo escriba la app.
 */
export const EMAIL_ENVIAR = 'Enviar'

/** 💸 Subelementos de Pagos del Inventario (18430295515) — un subitem por tractor. */
export const COL_PAGO_SUB = {
  valorNeto: 'numeric_mm71c5je',
  numDraft: 'text_mm71atj2',
  codProducto: 'text_mm71zgys',
  /** Conexión al item del tractor en el tablero de Inventario. */
  inventario: 'board_relation_mm718zjg',
  /** Mirror del N° Interno del tractor conectado. Sólo lectura. */
  numInterno: 'lookup_mm71zb7h',
} as const
