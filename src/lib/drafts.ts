import { DRAFT_ESTADO, DRAFT_ESTADOS } from '@/services/monday/columns'
import type { Draft } from '@/types'

/**
 * Las cuentas de la planificación de drafts: qué transporte corresponde, qué drafts entran en una
 * búsqueda y qué dice el tablero en conjunto.
 *
 * Sin nada de monday ni de React adentro, así que se prueba solo.
 */

/**
 * Qué costo de transporte corresponde según la condición de entrega.
 *
 * La condición no siempre es exactamente "FOB" o "FCA": el tablero tiene también
 * "FOB PUERTO EN INDIA" y "FCA LAUINGEN". Por eso se busca la palabra dentro del texto y no se
 * compara la etiqueta entera —comparar entera dejaría a esos dos sin costo, que es justamente el
 * caso más frecuente—.
 */
export function condicionDeTransporte(condicionEntrega: string): 'FOB' | 'FCA' | null {
  const texto = condicionEntrega.toUpperCase()
  if (texto.includes('FOB')) return 'FOB'
  if (texto.includes('FCA')) return 'FCA'
  return null
}

/** Cómo se rotula ese costo en pantalla. */
export const rotuloTransporte = (condicionEntrega: string): string => {
  const cual = condicionDeTransporte(condicionEntrega)
  return cual ? `Transporte ${cual}` : 'Transporte'
}

/**
 * ¿Entra este draft en lo que se está buscando?
 *
 * Se busca por número de draft —que es el nombre del item y la forma en que todos lo nombran—, y
 * también por el ID de monday y por el número de orden de pedido, que son los otros dos papeles
 * donde ese mismo draft aparece.
 */
export function coincideDraft(draft: Draft, busqueda: string): boolean {
  const texto = busqueda.trim().toLowerCase()
  if (!texto) return true
  return [draft.nombre, draft.idDraft, draft.ordenPedido]
    .filter(Boolean)
    .some((campo) => campo.toLowerCase().includes(texto))
}

/** Los drafts que se pueden planificar: leídos, pendientes y todavía sin período. */
export const sePuedePlanificar = (d: Draft): boolean =>
  d.estado === DRAFT_ESTADO.PEND_PLANIFICAR && !d.periodo.trim()

/** Los drafts que se pueden mandar al proveedor: ya planificados y con período puesto. */
export const sePuedeEnviar = (d: Draft): boolean =>
  d.estado === DRAFT_ESTADO.PLANIFICADA && Boolean(d.periodo.trim())

/** Suma de una columna de importes, salteando los que no tienen dato. */
const suma = (drafts: Draft[]): number =>
  drafts.reduce((n, d) => n + (d.total ?? 0), 0)

/** Cuántas unidades pidió un draft, sumando sus productos. */
export const unidadesDe = (d: Draft): number =>
  d.productos.reduce((n, p) => n + (p.cantidad ?? 0), 0)

/** Un corte del tablero: cuántos drafts, cuántas unidades y cuánto dinero. */
export interface Corte {
  clave: string
  drafts: number
  unidades: number
  total: number
  /** Divisa del corte, o \`''\` si mezcla varias (en ese caso el total no se muestra). */
  divisa: string
}

/** Agrupa drafts por lo que devuelva `clave`, de mayor a menor. */
function agrupar(drafts: Draft[], clave: (d: Draft) => string): Corte[] {
  const grupos = new Map<string, Draft[]>()
  for (const d of drafts) {
    const k = clave(d) || '(sin dato)'
    grupos.set(k, [...(grupos.get(k) ?? []), d])
  }
  return [...grupos.entries()]
    .map(([clave, lista]) => {
      const divisas = new Set(lista.map((d) => d.divisa).filter(Boolean))
      return {
        clave,
        drafts: lista.length,
        unidades: lista.reduce((n, d) => n + unidadesDe(d), 0),
        total: suma(lista),
        // Sumar euros con dólares daría un número que no existe. Con divisas mezcladas se informa
        // la cantidad y se calla el importe.
        divisa: divisas.size === 1 ? [...divisas][0] : '',
      }
    })
    .sort((a, b) => b.drafts - a.drafts)
}

/** Lo que resume el tablero de Drafts, para el dashboard. */
export interface ResumenDrafts {
  total: number
  /** Cuántos drafts hay en cada estado, en el orden del circuito. */
  porEstado: { estado: string; cantidad: number }[]
  /** Listos para planificar: leídos, pendientes y sin período. */
  paraPlanificar: Draft[]
  /** Planificados y listos para mandarle al proveedor. */
  paraEnviar: Draft[]
  /**
   * Pendientes de planificar que NO se pueden planificar todavía porque el PDF no se leyó bien.
   * Es un problema de la automatización, no del planificador, y por eso va aparte.
   */
  sinLeer: Draft[]
  /** Cuántos drafts hay en cada período sugerido, del más próximo al más lejano. */
  porPeriodo: Corte[]
  porFormaPago: Corte[]
  porCondicionEntrega: Corte[]
  /** Unidades pedidas en los drafts todavía no confirmados. */
  unidadesEnCurso: number
  /** Total por divisa de los drafts en curso. */
  porDivisa: Corte[]
}

/** Orden de los períodos: "Marzo 2026" va antes que "Abril 2026". */
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

/** Un período como número comparable (2026-03 → 202603). `0` si no tiene forma de período. */
export function ordenDePeriodo(periodo: string): number {
  const m = /^(\p{L}+)\s+(\d{4})$/u.exec(periodo.trim())
  if (!m) return 0
  const mes = MESES.indexOf(m[1].toLowerCase())
  return mes < 0 ? 0 : Number(m[2]) * 100 + mes + 1
}

/** Un draft está "en curso" mientras no se canceló ni se confirmó en una orden. */
const enCurso = (d: Draft): boolean =>
  d.estado !== DRAFT_ESTADO.CANCELADO && d.estado !== DRAFT_ESTADO.CONFIRMADO

export function resumirDrafts(drafts: Draft[]): ResumenDrafts {
  const abiertos = drafts.filter(enCurso)
  const conPeriodo = drafts.filter((d) => d.periodo.trim())

  return {
    total: drafts.length,
    porEstado: DRAFT_ESTADOS.map((estado) => ({
      estado,
      cantidad: drafts.filter((d) => d.estado === estado).length,
    })),
    paraPlanificar: drafts.filter(sePuedePlanificar),
    paraEnviar: drafts.filter(sePuedeEnviar),
    sinLeer: drafts.filter(
      (d) => d.estado === DRAFT_ESTADO.PEND_PLANIFICAR && d.lectura !== 'Leido',
    ),
    porPeriodo: agrupar(conPeriodo, (d) => d.periodo).sort(
      (a, b) => ordenDePeriodo(a.clave) - ordenDePeriodo(b.clave),
    ),
    porFormaPago: agrupar(abiertos, (d) => d.formaPago),
    porCondicionEntrega: agrupar(abiertos, (d) => d.condicionEntrega),
    unidadesEnCurso: abiertos.reduce((n, d) => n + unidadesDe(d), 0),
    porDivisa: agrupar(abiertos, (d) => d.divisa),
  }
}
