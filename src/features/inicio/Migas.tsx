export interface Miga {
  rotulo: string
  /** Sin `onIr`, la miga es el lugar actual y no se puede tocar. */
  onIr?: () => void
}

interface Props {
  migas: Miga[]
}

/**
 * Miga de pan: dónde está parado el usuario y el camino para volver.
 *
 * Con tres niveles (operación → modalidad → etapa), el botón "atrás" del navegador no sirve
 * dentro del iframe de monday y en el celular directamente no existe. Sin esto, salir de
 * ANTICIPADO para ir a VISTA obligaría a recargar la app.
 */
export function Migas({ migas }: Props) {
  return (
    <nav className="migas" aria-label="Ubicación">
      <div className="view migas-in">
        {migas.map((m, i) => {
          const ultima = i === migas.length - 1
          return (
            <span key={m.rotulo} className="migas-paso">
              {i > 0 && <i className="fa-solid fa-chevron-right migas-sep" aria-hidden="true" />}
              {m.onIr && !ultima ? (
                <button type="button" className="migas-link" onClick={m.onIr}>
                  {i === 0 && <i className="fa-solid fa-house" aria-hidden="true" />}
                  {m.rotulo}
                </button>
              ) : (
                <span className="migas-actual" aria-current={ultima ? 'page' : undefined}>
                  {i === 0 && <i className="fa-solid fa-house" aria-hidden="true" />}
                  {m.rotulo}
                </span>
              )}
            </span>
          )
        })}
      </div>
    </nav>
  )
}
