/**
 * IDs reales de tableros y columnas de la cuenta de BERGER S.A. (36618349).
 *
 * Relevados con `boards { columns { id title type settings_str } }`: son la ÚNICA fuente de
 * verdad de los identificadores. Ninguna query los escribe sueltos, así que cuando Monday cambie
 * una columna se toca un solo archivo.
 */

/**
 * Cuenta de monday habilitada: BERGER S.A. (slug `maquinariasagricolas`).
 *
 * La app se puede instalar en cualquier cuenta que tenga el link, así que el permiso NO puede
 * depender de dónde esté instalada. Este id es el que decide: el token de sesión que firma monday
 * dice de qué cuenta viene el usuario, y cualquier otra queda afuera.
 *
 * Del lado del cliente esto sólo evita mostrar una pantalla que no va a funcionar. La barrera de
 * verdad está en `api/_guard.ts`, del lado del servidor, con la misma comprobación: sin ella,
 * cualquiera podría pedirle datos al proxy salteándose la interfaz.
 */
export const CUENTA_BERGER = 36618349

export const TABLEROS = {
  /** Inventario: un item por tractor. */
  inventario: '18428578101',
  /** Pagos del Inventario: un item por transferencia. */
  pagos: '18430295445',
  /** Subelementos de Pagos del Inventario: un subitem por tractor pagado. */
  pagosSubitems: '18430295515',
  /** Contenedores: qué modelos viajan juntos y en qué contenedor. */
  contenedores: '18430565324',
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
  /** Mirror del Modelo (viene del Catálogo de Productos). Se muestra como etiqueta en todos los pasos. */
  modelo: 'lookup_mm726zx1',
  /** Estado Rodado: "Con Rodado" / "Sin Rodado". Se muestra como etiqueta en todos los pasos. */
  estadoRodado: 'color_mm72mfyd',
  /**
   * Confirmación de la Fecha de Producción. Sólo los tractores con la fecha CONFIRMADA se pueden
   * despachar: los demás no aparecen en ninguna de las dos modalidades.
   */
  confirmacionFecha: 'color_mm6s8xp2',
  /** Conexión al Catálogo de Productos. Es lo que permite saber en qué contenedor entra. */
  catalogo: 'board_relation_mm6sxre2',
} as const

/** Etiquetas de "Estado Confirmación Fecha Producción" (`color_mm6s8xp2`). */
export const FECHA_CONFIRMADA = 'Fecha Confirmada'

/**
 * Opciones de "Forma de Pago" (`dropdown_mm6v2sa0`), con el id de cada etiqueta.
 *
 * Es la columna que separa las dos modalidades de despacho: ANTICIPADO pasa por el circuito de
 * pago de tres operaciones; VISTA se pide sin pago previo. Como en los `status`, Monday filtra
 * los `dropdown` por id y no por texto, así que el id viaja a la consulta y la etiqueta se vuelve
 * a comprobar en el cliente.
 */
export const FORMA_PAGO = {
  ANTICIPADO: { etiqueta: 'ANTICIPADO', id: 1 },
  VISTA: { etiqueta: 'VISTA', id: 2 },
  VENCIDO: { etiqueta: 'VENCIDO', id: 3 },
} as const

/** Etiquetas de "Estado Rodado" (`color_mm72mfyd`). */
export const RODADO = {
  CON: 'Con Rodado',
  SIN: 'Sin Rodado',
} as const

/**
 * Etiquetas de "Estado Pago" del Inventario (`color_mm6v6532`).
 *
 * Marcan el recorrido del tractor por las tres operaciones: `LISTO` → `TRANSF_CARGADA` →
 * `TRANSF_APROBADA` → `PAGADO`.
 */
export const INV_ESTADO = {
  LISTO: 'Listo para Pagar',
  /** En el que quedan los tractores pedidos a la vista: se despachan sin pago previo. */
  PENDIENTE_PAGO: 'Pendiente de Pago',
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

  /** Fecha del pedido a la vista. */
  fechaPagoVista: 'date_mm77cwrs',
  /** Reporte de los contenedores que armó la app. Es lo que después va al mail del proveedor. */
  contenedores: 'long_text_mm77ydg9',

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
  /** Pedido a la vista: se despachó sin pago, y el pago queda pendiente. */
  PENDIENTE_PAGO: 'Pendiente de Pago',
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
  [PAGO_OPERACION.PENDIENTE_PAGO]: 3,
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

/**
 * 📦 Contenedores (18430565324): qué modelos del catálogo viajan juntos, en qué contenedor y
 * cuántos entran.
 *
 * Cada fila es una COMBINACIÓN posible: los productos conectados pueden compartir contenedor hasta
 * la cantidad indicada. Un mismo grupo de productos puede tener varias filas —distinto contenedor,
 * distinto rodado, distinta capacidad— y la app elige entre ellas al armar el despacho.
 */
export const COL_CONTENEDOR = {
  /** Productos del catálogo que entran combinados en esta fila. */
  catalogo: 'board_relation_mm77crvy',
  tipo: 'status',
  capacidad: 'numeric_mm77r45y',
  ruedas: 'color_mm77eeke',
} as const

/**
 * Tipos de contenedor. El "+" no es decorativo: dice que esa combinación ocupa DOS contenedores,
 * y por eso la cantidad de contenedores se cuenta partiendo la etiqueta.
 */
export const CONTENEDOR_CUALQUIERA = 'CUALQUIER CONTENEDOR'

/**
 * Etiquetas de la columna "Ruedas" de Contenedores.
 *
 * Ojo con los nombres: el Inventario dice "Con Rodado" / "Sin Rodado" y Contenedores dice "Con
 * Ruedas" / "Sin Ruedas". Son la misma idea con distinta palabra, y hay una tercera —"Con y Sin
 * Ruedas"— que sirve para los dos.
 */
export const RUEDAS_CONTENEDOR = {
  CON: 'Con Ruedas',
  SIN: 'Sin Ruedas',
  AMBAS: 'Con y Sin Ruedas',
} as const
