interface Paso {
  id: string
  nombre: string
  /** Nombre corto para pantallas de celular, donde el largo no entra. */
  corto: string
}

/**
 * Las tres etapas de cada operación.
 *
 * La operación 1 crea un pago; las 2 y 3 avanzan uno que ya existe. Son los mismos tres tiempos
 * —elegir, adjuntar, confirmar— con distinto sustantivo, así que comparten componente.
 */
const PASOS: Record<'carga' | 'avance', Paso[]> = {
  carga: [
    { id: 'seleccion', nombre: 'Selección de tractores', corto: 'Tractores' },
    { id: 'transferencia', nombre: 'Transferencia', corto: 'Transferencia' },
    { id: 'listo', nombre: 'Registrado', corto: 'Listo' },
  ],
  avance: [
    { id: 'seleccion', nombre: 'Selección del pago', corto: 'Pago' },
    { id: 'archivo', nombre: 'Comprobante', corto: 'Comprobante' },
    { id: 'listo', nombre: 'Registrado', corto: 'Listo' },
  ],
}

interface Props {
  actual: string
  variante?: 'carga' | 'avance'
  /** Volver atrás sólo se permite a etapas ya recorridas; `undefined` deja el stepper de lectura. */
  onIr?: (etapa: string) => void
}

/**
 * Avance del asistente.
 *
 * El estado de cada nodo lo decide la POSICIÓN respecto de la etapa actual, no un flag por paso:
 * con tres etapas lineales, guardar "cuáles ya pasaron" es una segunda fuente de verdad que se
 * desincroniza en cuanto alguien vuelve atrás.
 */
export function Stepper({ actual, variante = 'carga', onIr }: Props) {
  const pasos = PASOS[variante]
  const iActual = pasos.findIndex((p) => p.id === actual)

  return (
    <nav className="stepper" aria-label="Avance de la operación">
      {pasos.map((paso, i) => {
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
              {/* Dos rótulos, uno visible por vez según el ancho: el corto es lo único que entra
                  en un celular, y recortar el largo con puntos suspensivos dejaría "Selección
                  de…" en los tres pasos, que no distingue nada. */}
              <span className="step-nom step-nom--largo">{paso.nombre}</span>
              <span className="step-nom step-nom--corto">{paso.corto}</span>
            </button>
          </div>
        )
      })}
    </nav>
  )
}
