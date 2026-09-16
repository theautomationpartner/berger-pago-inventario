/**
 * Estructuras de datos de la app.
 *
 * Todo lo que llega de Monday se normaliza acá antes de entrar a la interfaz: los componentes
 * nunca ven un `column_values` crudo. Eso es lo que permite que un cambio de columna se resuelva
 * en `services/monday/` sin tocar una sola vista.
 */

/**
 * Navegación de la app, en tres niveles:
 *
 *   Operación principal  →  Modalidad  →  Etapa
 *   DESPACHO             →  ANTICIPADO →  Cargar / Aprobar / Confirmar
 *                        →  VISTA      →  (paso único)
 *
 * El primer nivel hoy tiene una sola opción, pero existe desde ya: es donde se van a sumar los
 * próximos tipos de operación sin tener que rearmar la pantalla de entrada.
 */
export type OperacionPrincipal = 'despacho'

/** Las dos formas de despachar: con el circuito de pago previo, o a la vista (contra VL). */
export type ModalidadDespacho = 'anticipado' | 'vista'

/** Las tres etapas del circuito de pago del despacho ANTICIPADO. */
export type EtapaAnticipado = 'cargar' | 'aprobar' | 'confirmar'

/** Tarjeta de un panel de elección (operación principal o modalidad). */
export interface OpcionPanel<T extends string> {
  id: T
  titulo: string
  /** Rótulo corto, para la miga de pan y las pantallas angostas. */
  corto: string
  detalle: string
  icono: string
}

export interface DefinicionEtapa {
  id: EtapaAnticipado
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
  /** Modelo, espejado del Catálogo de Productos. `''` si el item no está conectado. */
  modelo: string
  /** "Con Rodado" / "Sin Rodado", o `''` si no está cargado. */
  estadoRodado: string
  /** Producto del Catálogo al que está conectado. Es la llave para saber en qué contenedor entra. */
  catalogoId: string | null
  /**
   * Puertos de carga del modelo, leídos del Catálogo. Vacío si el item no está conectado o el
   * modelo no tiene puerto cargado. Un modelo puede salir por más de uno.
   */
  puertos: string[]
  /** Etiqueta de la confirmación de la Fecha de Producción. */
  confirmacionFecha: string
}

/**
 * Una combinación del tablero de Contenedores: qué productos viajan juntos, en qué contenedor,
 * cuántos entran y con qué rodado.
 *
 * Un mismo grupo de productos puede tener varias opciones. Por ejemplo los 6205/6175/6155: uno
 * solo en un 40 H con ruedas, dos en un 20 H + 40 H con ruedas, o dos sin ruedas en un 40 H.
 */
export interface OpcionContenedor {
  id: string
  /** Nombre de la fila, como "6205 - 6175 - 6155". */
  nombre: string
  /** Ids de los productos del catálogo que entran combinados. */
  catalogo: string[]
  /** Etiqueta del contenedor: "40 H", "20 H + 40 H", "CUALQUIER CONTENEDOR"… */
  tipo: string
  /** Cuántos contenedores FÍSICOS ocupa esta opción: el "+" de la etiqueta suma uno. */
  contenedores: number
  /** Cuántos tractores entran en total. */
  capacidad: number
  /** "Con Ruedas", "Sin Ruedas" o "Con y Sin Ruedas". */
  ruedas: string
}

/** Un contenedor (o par de contenedores) ya armado con tractores concretos. */
export interface ContenedorArmado {
  opcion: OpcionContenedor
  tractores: Tractor[]
  /** Lugares que quedan sin usar. */
  libres: number
  /** Otros tractores disponibles que podrían completarlo. */
  sugerencias: Tractor[]
}

/** Un tractor que no se puede ubicar, con el motivo. */
export interface TractorSinContenedor {
  tractor: Tractor
  motivo: string
}

/** Lo que la app le muestra al usuario mientras selecciona, y lo que después queda como reporte. */
export interface ResumenContenedores {
  armados: ContenedorArmado[]
  sinContenedor: TractorSinContenedor[]
  /** Contenedores físicos en total. */
  totalContenedores: number
  /** Lugares libres sumando todos los contenedores armados. */
  totalLibres: number
}

/** Un mes del calendario. `mes` es 1-12, no el 0-11 de `Date`. */
export interface MesAnio {
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
  /**
   * Modelo y rodado del tractor. El tablero de subitems NO tiene estas columnas: se leen del item
   * del Inventario al que apunta la conexión, en la misma consulta que trae su estado.
   */
  modelo: string
  estadoRodado: string
  /** Producto del Catálogo del tractor conectado: de ahí cuelga el puerto de carga. */
  catalogoId: string | null
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
  /**
   * Reporte de contenedores que dejó escrito la operación que creó el pago. La operación 3 lo lee
   * —no lo vuelve a calcular— para saber cuántos contenedores declarar ante el despachante: lo que
   * se informa tiene que ser lo mismo que ya se reportó, aunque el tablero de Contenedores haya
   * cambiado desde entonces.
   */
  reporteContenedores: string
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
  /** Item creado en el Despachante de aduana, cuando la etapa cierra el despacho. */
  itemDespachanteId?: string | null
}

/**
 * Un despachante: alguien del equipo "Despachantes" de monday.
 *
 * Es quien recibe el mail con la información del despacho y a quien queda asignado el item del
 * Despachante de aduana.
 */
export interface Despachante {
  /** Id de usuario de monday: es lo que se escribe en la columna de persona. */
  id: string
  nombre: string
  email: string
  /** Foto de perfil, o `''` si no tiene. */
  foto: string
}

/** Un tractor, como se lo carga en el tablero del Despachante de aduana. */
export interface TractorDeDespacho {
  nombre: string
  valorNeto: number | null
  numDraft: string
  codProducto: string
  /** Item del Inventario al que se conecta el subitem, o `null` si no se sabe cuál es. */
  tractorId: string | null
}

/** Etapa del asistente de la operación 1. */
export type Etapa = 'seleccion' | 'transferencia' | 'listo'

/**
 * Etapa del asistente de las operaciones 2 y 3.
 *
 * `despachante` sólo existe en la operación que CIERRA el despacho (la 3): ahí se elige a quién se
 * le manda y se ve qué se le manda, antes de confirmar.
 */
export type EtapaAvance = 'seleccion' | 'archivo' | 'despachante' | 'listo'

/** Etapa del asistente del despacho a la VISTA. */
export type EtapaVista = 'seleccion' | 'despachante' | 'listo'

/**
 * Configuración de una operación que avanza un pago ya existente (las número 2 y 3).
 *
 * Las dos hacen exactamente lo mismo —elegir un pago pendiente, adjuntar un comprobante y
 * empujar el circuito un casillero— y sólo cambian en QUÉ estados leen y escriben. Describirlas
 * como datos, en vez de duplicar el flujo en dos componentes casi iguales, es lo que garantiza
 * que un arreglo en el manejo de errores valga para las dos.
 */
export interface FlujoAvance {
  etapa: EtapaAnticipado
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
  /**
   * Si esta etapa cierra el despacho: crea el item en el tablero del Despachante de aduana y deja
   * el aviso al despachante en "Enviar". En ANTICIPADO eso pasa recién al confirmar el SWIFT.
   */
  cierraDespacho?: boolean
}
