import { ESTADO_CARGA } from '@/services/monday/columns'
import type { CambioDespacho, DespachoOP, EdicionDespacho } from '@/types'
import { fechaCorta } from './format'

/**
 * Las cuentas del módulo de Aduana: qué cambió en una OP, qué OP entran en un filtro y qué dice el
 * tablero en conjunto.
 *
 * Todo esto es aritmética y comparación de texto, sin nada de monday ni de React adentro, así que
 * vive acá y se prueba solo.
 */

/** Cómo se llama cada campo editable en pantalla y en el resumen. */
export const ROTULOS: Record<keyof EdicionDespacho, string> = {
  nroOp: 'N° Op Despachante',
  viaTransporte: 'Vía de transporte',
  nroDocTransporte: 'Nro doc de transporte',
  contenedorRef: 'Contenedor de referencia',
  eta: 'ETA',
  buque: 'Buque',
  estadoCarga: 'Estado de carga',
  observaciones: 'Observaciones de la carga',
}

/** Los campos, en el orden en que se muestran: primero lo que más se toca. */
export const CAMPOS_EDITABLES: (keyof EdicionDespacho)[] = [
  'estadoCarga',
  'eta',
  'nroOp',
  'viaTransporte',
  'buque',
  'nroDocTransporte',
  'contenedorRef',
  'observaciones',
]

/** Los valores actuales de una OP, como los recibe el formulario. */
export const valoresActuales = (op: DespachoOP): EdicionDespacho => ({
  nroOp: op.nroOp,
  viaTransporte: op.viaTransporte,
  nroDocTransporte: op.nroDocTransporte,
  contenedorRef: op.contenedorRef,
  eta: op.eta,
  buque: op.buque,
  estadoCarga: op.estadoCarga,
  observaciones: op.observaciones,
})

/** Cómo se lee un valor vacío. Nunca se muestra en blanco: en blanco no se distingue de un error. */
const comoTexto = (campo: keyof EdicionDespacho, valor: string): string => {
  if (!valor) return '(vacío)'
  return campo === 'eta' ? fechaCorta(valor) : valor
}

/**
 * Qué cambió entre lo que está en monday y lo que escribió el despachante.
 *
 * Se compara con el texto recortado: un espacio de más al final de un número de documento no es un
 * cambio, y dejar que lo sea obligaría a guardar una OP que en realidad quedó igual.
 */
export function cambiosDe(op: DespachoOP, edicion: EdicionDespacho): CambioDespacho[] {
  const actual = valoresActuales(op)
  const cambios: CambioDespacho[] = []

  for (const campo of CAMPOS_EDITABLES) {
    const antes = (actual[campo] ?? '').trim()
    const despues = (edicion[campo] ?? '').trim()
    if (antes === despues) continue
    cambios.push({
      campo,
      rotulo: ROTULOS[campo],
      antes: comoTexto(campo, antes),
      despues: comoTexto(campo, despues),
    })
  }

  return cambios
}

/** Sólo los campos que cambiaron, listos para mandar a monday. */
export function soloLoCambiado(
  op: DespachoOP,
  edicion: EdicionDespacho,
): Partial<EdicionDespacho> {
  const parcial: Partial<EdicionDespacho> = {}
  for (const { campo } of cambiosDe(op, edicion)) parcial[campo] = (edicion[campo] ?? '').trim()
  return parcial
}

/**
 * ¿Entra esta OP en lo que el despachante está buscando?
 *
 * Los estados se combinan como los meses del otro módulo: ninguno elegido es "todos". La búsqueda
 * mira el nombre, el N° de OP y el ID del despacho, porque el despachante identifica una carga por
 * cualquiera de los tres según con quién esté hablando.
 */
export function coincide(op: DespachoOP, estados: string[], busqueda: string): boolean {
  if (estados.length > 0 && !estados.includes(op.estadoCarga)) return false

  const texto = busqueda.trim().toLowerCase()
  if (!texto) return true
  return [op.nombre, op.nroOp, op.idDespacho, op.buque, op.nroDocTransporte, op.contenedorRef]
    .filter(Boolean)
    .some((campo) => campo.toLowerCase().includes(texto))
}

/** Cuántos días faltan para el arribo. Negativo = la fecha ya pasó. `null` si no tiene ETA. */
export function diasHastaEta(eta: string, hoy = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eta)) return null
  const dia = new Date(`${eta}T00:00:00`)
  const desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  return Math.round((dia.getTime() - desde.getTime()) / 86_400_000)
}

/** Cómo se lee esa distancia: "en 3 días", "hoy", "hace 2 días". */
export function textoEta(dias: number | null): string {
  if (dias == null) return 'Sin ETA'
  if (dias === 0) return 'Llega hoy'
  if (dias === 1) return 'Llega mañana'
  if (dias > 1) return `En ${dias} días`
  if (dias === -1) return 'Venció ayer'
  return `Venció hace ${Math.abs(dias)} días`
}

/** Días desde la última vez que alguien tocó la OP. `null` si monday no lo informa. */
export function diasSinNovedades(ultimaActualizacion: string, hoy = new Date()): number | null {
  const t = Date.parse(ultimaActualizacion)
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((hoy.getTime() - t) / 86_400_000))
}

/** Una OP que está en la calle: ni recién creada ni ya nacionalizada. */
const enCurso = (op: DespachoOP): boolean =>
  op.estadoCarga !== 'Nacionalizado' && op.estadoCarga !== ''

/** Lo que resume el tablero, para el dashboard. */
export interface ResumenDespachos {
  total: number
  /** Cuántas OP hay en cada estado, en el orden del circuito. */
  porEstado: { estado: string; cantidad: number }[]
  /** OP en curso ordenadas por ETA, de la más próxima a la más lejana. */
  proximosArribos: DespachoOP[]
  /** En curso con la ETA ya pasada: es lo primero que hay que mirar. */
  vencidas: DespachoOP[]
  /** En curso sin fecha de arribo cargada. */
  sinEta: DespachoOP[]
  /** En curso sin N° de OP del despachante. */
  sinNroOp: DespachoOP[]
  /** En curso sin novedades hace una semana o más. */
  sinNovedades: DespachoOP[]
  /** Contenedores declarados en las OP que están en curso. */
  contenedoresEnCurso: number
  /** Cuántas OP por país de origen, de mayor a menor. */
  porPais: { pais: string; cantidad: number }[]
  /** Cuántas OP se actualizaron hoy. */
  actualizadasHoy: number
}

/** Días sin novedades a partir de los cuales una OP en curso se considera dormida. */
export const DIAS_SIN_NOVEDADES = 7

/** Cuántas OP entran en cada corte del tablero. */
export function resumirDespachos(ops: DespachoOP[], hoy = new Date()): ResumenDespachos {
  const abiertas = ops.filter(enCurso)

  const conEta = abiertas
    .map((op) => ({ op, dias: diasHastaEta(op.eta, hoy) }))
    .filter((x): x is { op: DespachoOP; dias: number } => x.dias != null)
    .sort((a, b) => a.dias - b.dias)

  const paises = new Map<string, number>()
  for (const op of ops) {
    for (const pais of op.paisOrigen.split(',').map((p) => p.trim()).filter(Boolean)) {
      paises.set(pais, (paises.get(pais) ?? 0) + 1)
    }
  }

  return {
    total: ops.length,
    porEstado: ESTADO_CARGA.map((estado) => ({
      estado,
      cantidad: ops.filter((op) => op.estadoCarga === estado).length,
    })),
    proximosArribos: conEta.filter((x) => x.dias >= 0).map((x) => x.op),
    vencidas: conEta.filter((x) => x.dias < 0).map((x) => x.op),
    sinEta: abiertas.filter((op) => diasHastaEta(op.eta, hoy) == null),
    sinNroOp: abiertas.filter((op) => !op.nroOp.trim()),
    sinNovedades: abiertas.filter((op) => {
      const dias = diasSinNovedades(op.ultimaActualizacion, hoy)
      return dias != null && dias >= DIAS_SIN_NOVEDADES
    }),
    contenedoresEnCurso: abiertas.reduce((n, op) => n + (op.cantidadContenedores ?? 0), 0),
    porPais: [...paises.entries()]
      .map(([pais, cantidad]) => ({ pais, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad),
    actualizadasHoy: ops.filter((op) => diasSinNovedades(op.ultimaActualizacion, hoy) === 0).length,
  }
}
