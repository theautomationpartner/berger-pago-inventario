import { PAIS_POR_PUERTO } from '@/services/monday/columns'

/**
 * Puertos de carga: de dónde sale la mercadería.
 *
 * El dato vive en el Catálogo de Productos, una sola vez por modelo, y de ahí lo heredan todos los
 * tractores de ese modelo. Un modelo puede tener más de un puerto —los 6205 salen por Bremerhaven
 * o por Hamburgo—: son alternativas, no un recorrido, y así se informan.
 *
 * Son cuentas de texto, sin nada de monday adentro, así que se prueban solas.
 */

/** El país del puerto, o `''` si es un puerto que no está en el mapa. */
export const paisDePuerto = (puerto: string): string => PAIS_POR_PUERTO[puerto.trim()] ?? ''

/**
 * Los puertos de una selección de tractores, sin repetir.
 *
 * Se ordenan por PAÍS y después por puerto: los dos puertos alemanes de un despacho tienen que
 * quedar juntos en el reporte, no separados por uno de la India en el medio.
 */
export function puertosDeTractores(tractores: { puertos: string[] }[]): string[] {
  return [...new Set(tractores.flatMap((t) => t.puertos))]
    .filter(Boolean)
    .sort((a, b) => `${paisDePuerto(a)} ${a}`.localeCompare(`${paisDePuerto(b)} ${b}`, 'es'))
}

/**
 * Los países de esos puertos, sin repetir.
 *
 * Es lo que va al tablero del Despachante. Un puerto que no esté en el mapa se deja afuera en vez
 * de inventarle un país: la columna es un dropdown de etiquetas fijas y una que no exista la
 * rechaza monday entera, perdiendo también las que sí estaban bien.
 */
export const paisesDePuertos = (puertos: string[]): string[] => [
  ...new Set(puertos.map(paisDePuerto).filter(Boolean)),
]

/** Un puerto con su país: "Alemania (Bremerhaven)". Sin país, la ciudad sola. */
const puertoConPais = (puerto: string): string => {
  const pais = paisDePuerto(puerto)
  return pais ? `${pais} (${puerto})` : puerto
}

/**
 * El origen, como se lee en el reporte del despachante.
 *
 * Con un solo puerto va derecho. Con varios se numeran —"Puerto 1 … ó Puerto 2 …"— porque son
 * opciones entre las que todavía hay que elegir, y esa elección no la hace la app.
 */
export function textoOrigen(puertos: string[]): string {
  if (puertos.length === 0) return '(sin puerto cargado en el Catálogo)'
  if (puertos.length === 1) return puertoConPais(puertos[0])
  return puertos.map((p, i) => `Puerto ${i + 1}: ${puertoConPais(p)}`).join(' ó ')
}
