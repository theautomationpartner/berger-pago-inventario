import type { Etapa } from '@/types'

interface Paso {
  id: Etapa
  nombre: string
}

const PASOS: Paso[] = [
  { id: 'seleccion', nombre: 'Selección de tractores' },
  { id: 'transferencia', nombre: 'Transferencia' },
  { id: 'listo', nombre: 'Registrado' },
]

interface Props {
  actual: Etapa
  /** Volver atrás sólo se permite a etapas ya recorridas; `undefined` deja el stepper de lectura. */
  onIr?: (etapa: Etapa) => void
}

/**
 * Avance del asistente.
 *
 * El estado de cada nodo lo decide la POSICIÓN respecto de la etapa actual, no un flag por paso:
 * con tres etapas lineales, guardar "cuáles ya pasaron" es una segunda fuente de verdad que se
 * desincroniza en cuanto alguien vuelve atrás.
 */
export function Stepper({ actual, onIr }: Props) {
  const iActual = PASOS.findIndex((p) => p.id === actual)

  return (
    <nav className="stepper" aria-label="Avance de la operación">
      {PASOS.map((paso, i) => {
        const estado = i < iActual ? 'done' : i === iActual ? 'cur' : 'off'
        const navegable = Boolean(onIr) && i < iActual
        return (
          <div key={paso.id} style={{ display: 'contents' }}>
            {i > 0 && <span className={`sline${i <= iActual ? ' done' : ''}`} aria-hidden="true" />}
            <button
              type="button"
              className={`step ${estado} ${navegable ? 'step--nav' : 'step--off'}`}
              disabled={!navegable}
              aria-current={estado === 'cur' ? 'step' : undefined}
              onClick={() => navegable && onIr?.(paso.id)}
            >
              <span className="sic">
                {estado === 'done' ? <i className="fa-solid fa-check" aria-hidden="true" /> : i + 1}
              </span>
              <span className="step-nom">{paso.nombre}</span>
            </button>
          </div>
        )
      })}
    </nav>
  )
}
