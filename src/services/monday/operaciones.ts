/**
 * Catálogo de las operaciones que la app puede hacer contra monday.
 *
 * Antes el cliente le mandaba al proxy una consulta GraphQL y el proxy la reenviaba tal cual. Eso
 * convertía a `/api/monday` en una API completa de la cuenta: cualquier usuario de BERGER con
 * sesión —incluso uno de sólo lectura— podía abrir las herramientas del navegador y ejecutar la
 * consulta que quisiera con el token de la cuenta. El guard comprobaba QUIÉN preguntaba, pero
 * nunca QUÉ preguntaba.
 *
 * Ahora el cliente manda sólo el NOMBRE de una operación de este catálogo. El texto de la consulta
 * lo pone el servidor, así que no se puede falsificar: lo que no está acá, no se puede pedir.
 *
 * Las variables sí siguen viniendo del cliente, y por eso cada operación las valida. Sin esa parte
 * el candado no cerraría: `change_multiple_column_values` con variables libres escribe en
 * cualquier tablero de la cuenta aunque el texto de la mutation esté fijo.
 *
 * Este archivo lo importan las DOS puntas —el cliente para desarrollo, el proxy para producción—
 * a propósito. Con el texto duplicado en los dos lados, un cambio en uno solo compila igual y
 * falla nada más que en producción, que es donde peor se detecta.
 */
import {
  COL_INV,
  COL_PAGO,
  COL_PAGO_SUB,
  TABLEROS,
} from './columns'

/** Nombre de cada operación. Es lo único que viaja del cliente al servidor. */
export type NombreOperacion =
  | 'inventarioListos'
  | 'inventarioPaginaSiguiente'
  | 'pagosPendientes'
  | 'estadoDeTractores'
  | 'crearPago'
  | 'crearSubitemDePago'
  | 'actualizarColumnas'

export type Variables = Record<string, unknown>

/** El pedido no corresponde a ninguna operación válida, o sus variables no pasan la validación. */
export class OperacionInvalida extends Error {}

interface Operacion {
  query: string
  /**
   * Comprueba y normaliza las variables. Puede devolver otras: cuando un valor lo decide el
   * servidor —los ids de tablero, por ejemplo— se reemplaza acá en vez de confiar en el que
   * llegó.
   */
  validar: (v: Variables) => Variables
}

/* ------------------------------------------------------------------ *
 * Validaciones compartidas
 * ------------------------------------------------------------------ */

const TABLEROS_ESCRIBIBLES = new Set<string>([TABLEROS.inventario, TABLEROS.pagos])

/** Columnas que la app puede escribir, por tablero. Cualquier otra se rechaza. */
const COLUMNAS_ESCRIBIBLES: Record<string, Set<string>> = {
  [TABLEROS.inventario]: new Set([COL_INV.estadoPago]),
  [TABLEROS.pagos]: new Set([
    COL_PAGO.montoTransferencia,
    COL_PAGO.fechaEmision,
    COL_PAGO.estadoPago,
    COL_PAGO.operacionPend,
    COL_PAGO.fechaCargado,
    COL_PAGO.fechaAprobado,
    COL_PAGO.fechaConfirmado,
    COL_PAGO.estadoEmail1,
    COL_PAGO.estadoEmail2,
  ]),
  [TABLEROS.pagosSubitems]: new Set([
    COL_PAGO_SUB.valorNeto,
    COL_PAGO_SUB.numDraft,
    COL_PAGO_SUB.codProducto,
    COL_PAGO_SUB.inventario,
  ]),
}

/** Columnas de archivo que se pueden completar, y en qué etapa. */
export const COLUMNAS_ARCHIVO = new Set<string>([
  COL_PAGO.transferencia,
  COL_PAGO.transferenciaConNumero,
  COL_PAGO.comprobanteBanco,
])

/** Un id de monday es una cadena de dígitos. Sirve para items, subitems y tableros. */
function idMonday(valor: unknown, campo: string): string {
  const texto = String(valor ?? '')
  if (!/^\d{1,20}$/.test(texto)) throw new OperacionInvalida(`"${campo}" no es un id válido.`)
  return texto
}

/**
 * Entero dentro de un rango.
 *
 * El mínimo es explícito y NO vale 1 por defecto: los índices de las etiquetas de estado empiezan
 * en 0 —"Pend de Aprobar Transf" es justamente el 0—, así que exigir 1 dejaba la operación 2 sin
 * poder pedir nada. Los tamaños de página sí arrancan en 1.
 */
function entero(valor: unknown, campo: string, min: number, max: number): number {
  const n = Number(valor)
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new OperacionInvalida(`"${campo}" fuera de rango.`)
  }
  return n
}

/**
 * Valida el JSON de `column_values` contra las columnas escribibles del tablero.
 *
 * Es la comprobación que de verdad acota el daño: sin ella, la mutation de actualizar —cuyo texto
 * es fijo— igual podría escribir en la columna de sueldos de un item del inventario.
 */
function valoresDeColumnas(valor: unknown, tablero: string): string {
  const permitidas = COLUMNAS_ESCRIBIBLES[tablero]
  if (!permitidas) throw new OperacionInvalida('Tablero no habilitado para escritura.')

  let objeto: unknown
  try {
    objeto = JSON.parse(String(valor ?? ''))
  } catch {
    throw new OperacionInvalida('"column_values" no es JSON válido.')
  }
  if (!objeto || typeof objeto !== 'object' || Array.isArray(objeto)) {
    throw new OperacionInvalida('"column_values" tiene que ser un objeto.')
  }

  const claves = Object.keys(objeto as Record<string, unknown>)
  if (claves.length === 0) throw new OperacionInvalida('"column_values" está vacío.')
  for (const clave of claves) {
    if (!permitidas.has(clave)) {
      throw new OperacionInvalida(`La columna "${clave}" no se puede escribir desde la app.`)
    }
  }
  // Se vuelve a serializar lo YA validado: así no se reenvía el texto original del cliente.
  return JSON.stringify(objeto)
}

/** Nombre del item o subitem. Se acota el largo para no reenviar cualquier cosa. */
function nombre(valor: unknown): string {
  const texto = String(valor ?? '').trim()
  if (!texto) throw new OperacionInvalida('Falta el nombre del item.')
  if (texto.length > 255) throw new OperacionInvalida('El nombre del item es demasiado largo.')
  return texto
}

/** Lista de ids de columnas a LEER. No hace falta acotarla: leer una columna de estos tableros
    es exactamente lo que la app hace, y restringirla obligaría a tocar dos archivos por cada
    columna nueva sin cerrar ningún riesgo que no cierre ya la lista de tableros. */
function idsDeColumnas(valor: unknown): string[] {
  if (!Array.isArray(valor)) throw new OperacionInvalida('Faltan las columnas a leer.')
  return valor.map((c) => {
    const texto = String(c)
    if (!/^[A-Za-z0-9_]{1,64}$/.test(texto)) {
      throw new OperacionInvalida(`Id de columna inválido: "${texto}".`)
    }
    return texto
  })
}

/* ------------------------------------------------------------------ *
 * Fragmentos reutilizados por las consultas
 * ------------------------------------------------------------------ */

/**
 * `... on MirrorValue` y `... on BoardRelationValue` no son opcionales: sin ellos los importes
 * espejados vuelven vacíos y la conexión al Inventario vuelve en `null`.
 */
const CAMPOS_COLUMNA = `
  id
  type
  text
  ... on MirrorValue { display_value }
  ... on BoardRelationValue { linked_item_ids }
`

/* ------------------------------------------------------------------ *
 * El catálogo
 * ------------------------------------------------------------------ */

export const OPERACIONES: Record<NombreOperacion, Operacion> = {
  /**
   * Tractores del Inventario filtrados por Estado Pago.
   *
   * El tablero lo pone el servidor. El índice del estado sí viene del cliente, y no hace falta
   * acotarlo a uno solo: pedir otro estado del mismo tablero no muestra nada que la app no pueda
   * mostrar igual.
   */
  inventarioListos: {
    query: `
      query ($tablero: ID!, $columnas: [String!], $estado: CompareValue!, $limite: Int!) {
        boards(ids: [$tablero]) {
          items_page(
            limit: $limite
            query_params: {
              rules: [{ column_id: "${COL_INV.estadoPago}", compare_value: $estado, operator: any_of }]
            }
          ) {
            cursor
            items { id name column_values(ids: $columnas) { ${CAMPOS_COLUMNA} } }
          }
        }
      }
    `,
    validar: (v) => ({
      tablero: TABLEROS.inventario,
      columnas: idsDeColumnas(v.columnas),
      estado: [entero(Array.isArray(v.estado) ? v.estado[0] : v.estado, 'estado', 0, 999)],
      limite: entero(v.limite, 'limite', 1, 500),
    }),
  },

  /**
   * Páginas siguientes. Monday NO acepta `query_params` junto a un cursor —el filtro ya quedó
   * grabado en el cursor de la primera página—, así que la paginación tiene su propia consulta.
   */
  inventarioPaginaSiguiente: {
    query: `
      query ($cursor: String!, $columnas: [String!], $limite: Int!) {
        next_items_page(cursor: $cursor, limit: $limite) {
          cursor
          items { id name column_values(ids: $columnas) { ${CAMPOS_COLUMNA} } }
        }
      }
    `,
    validar: (v) => {
      const cursor = String(v.cursor ?? '')
      if (!cursor || cursor.length > 4096) throw new OperacionInvalida('Cursor inválido.')
      return { cursor, columnas: idsDeColumnas(v.columnas), limite: entero(v.limite, 'limite', 1, 500) }
    },
  },

  /** Pagos pendientes de una operación, con sus subitems. */
  pagosPendientes: {
    query: `
      query ($tablero: ID!, $operacion: CompareValue!, $cols: [String!], $colsSub: [String!], $limite: Int!) {
        boards(ids: [$tablero]) {
          items_page(
            limit: $limite
            query_params: {
              rules: [{ column_id: "${COL_PAGO.operacionPend}", compare_value: $operacion, operator: any_of }]
            }
          ) {
            items {
              id
              name
              column_values(ids: $cols) { id type text }
              subitems { id name column_values(ids: $colsSub) { ${CAMPOS_COLUMNA} } }
            }
          }
        }
      }
    `,
    validar: (v) => ({
      tablero: TABLEROS.pagos,
      operacion: [entero(Array.isArray(v.operacion) ? v.operacion[0] : v.operacion, 'operacion', 0, 999)],
      cols: idsDeColumnas(v.cols),
      colsSub: idsDeColumnas(v.colsSub),
      limite: entero(v.limite, 'limite', 1, 500),
    }),
  },

  /**
   * Estado Pago de los tractores conectados a los subitems de un pago.
   *
   * Los ids los elige el cliente, así que en teoría podría pedir items de otro tablero. La
   * consulta devuelve UNA sola columna, la de estado de pago del Inventario, que en cualquier otro
   * item vuelve vacía: no hay nada que sacar por acá.
   */
  estadoDeTractores: {
    query: `
      query ($ids: [ID!]!) {
        items(ids: $ids) {
          id
          column_values(ids: ["${COL_INV.estadoPago}"]) { id text }
        }
      }
    `,
    validar: (v) => {
      if (!Array.isArray(v.ids) || v.ids.length === 0) {
        throw new OperacionInvalida('Faltan los ids de los tractores.')
      }
      if (v.ids.length > 500) throw new OperacionInvalida('Demasiados ids.')
      return { ids: v.ids.map((id) => idMonday(id, 'ids')) }
    },
  },

  /** Item del pago. Sólo en el tablero de Pagos del Inventario. */
  crearPago: {
    query: `
      mutation ($tablero: ID!, $nombre: String!, $valores: JSON!) {
        create_item(board_id: $tablero, item_name: $nombre, column_values: $valores) { id }
      }
    `,
    validar: (v) => ({
      tablero: TABLEROS.pagos,
      nombre: nombre(v.nombre),
      valores: valoresDeColumnas(v.valores, TABLEROS.pagos),
    }),
  },

  /** Un subitem por tractor, colgando del item de pago. */
  crearSubitemDePago: {
    query: `
      mutation ($padre: ID!, $nombre: String!, $valores: JSON!) {
        create_subitem(parent_item_id: $padre, item_name: $nombre, column_values: $valores) { id }
      }
    `,
    validar: (v) => ({
      padre: idMonday(v.padre, 'padre'),
      nombre: nombre(v.nombre),
      valores: valoresDeColumnas(v.valores, TABLEROS.pagosSubitems),
    }),
  },

  /**
   * Escritura de columnas sobre un item existente: estados del pago y del tractor, y fechas.
   *
   * Es la operación más sensible del catálogo —es la que escribe— y por eso es la que más se
   * valida: el tablero tiene que ser uno de los dos del circuito, y cada columna tocada tiene que
   * estar en la lista de escribibles DE ESE tablero.
   */
  actualizarColumnas: {
    query: `
      mutation ($tablero: ID!, $item: ID!, $valores: JSON!) {
        change_multiple_column_values(board_id: $tablero, item_id: $item, column_values: $valores) { id }
      }
    `,
    validar: (v) => {
      const tablero = idMonday(v.tablero, 'tablero')
      if (!TABLEROS_ESCRIBIBLES.has(tablero)) {
        throw new OperacionInvalida('Ese tablero no se puede escribir desde la app.')
      }
      return {
        tablero,
        item: idMonday(v.item, 'item'),
        valores: valoresDeColumnas(v.valores, tablero),
      }
    },
  },
}

/** Resuelve una operación por nombre. Lanza si no existe: no hay consultas fuera del catálogo. */
export function resolverOperacion(nombreOperacion: unknown): Operacion {
  const clave = String(nombreOperacion ?? '')
  const operacion = (OPERACIONES as Record<string, Operacion | undefined>)[clave]
  if (!operacion) throw new OperacionInvalida(`Operación desconocida: "${clave}".`)
  return operacion
}

/** Mutation de subida de archivos. El texto lo pone el servidor, igual que el resto. */
export const MUTATION_ARCHIVO =
  'mutation ($itemId: ID!, $columnId: String!, $file: File!) {' +
  ' add_file_to_column (item_id: $itemId, column_id: $columnId, file: $file) { id } }'

/** Valida el destino de un archivo: sólo las tres columnas de comprobante del circuito. */
export function validarDestinoArchivo(itemId: unknown, columnId: unknown): {
  itemId: string
  columnId: string
} {
  const columna = String(columnId ?? '')
  if (!COLUMNAS_ARCHIVO.has(columna)) {
    throw new OperacionInvalida('Esa columna no admite archivos desde la app.')
  }
  return { itemId: idMonday(itemId, 'itemId'), columnId: columna }
}
