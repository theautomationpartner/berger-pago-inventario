/**
 * Los períodos de producción, tal como están cargados en la columna del tablero de Drafts.
 *
 * Son 120 etiquetas —de Enero 2026 a Diciembre 2035— y se generan en vez de escribirlas una por
 * una: escritas a mano, alcanzaría con una tilde de más para que monday rechace la escritura
 * entera, y el error aparecería recién al guardar.
 *
 * La contracara es que esta lista TIENE que coincidir con la del tablero: monday no crea etiquetas
 * nuevas al escribir, así que un período que no exista ahí hace fallar la asignación. Si alguien
 * extiende la columna a 2036, hay que mover `ANIO_FIN`.
 */
const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const

const ANIO_INICIO = 2026
const ANIO_FIN = 2035

export const PERIODOS: string[] = Array.from(
  { length: ANIO_FIN - ANIO_INICIO + 1 },
  (_, i) => ANIO_INICIO + i,
).flatMap((anio) => MESES.map((mes) => `${mes} ${anio}`))

/** ¿Es un período de los que acepta la columna? */
export const esPeriodoValido = (periodo: string): boolean => PERIODOS.includes(periodo.trim())
