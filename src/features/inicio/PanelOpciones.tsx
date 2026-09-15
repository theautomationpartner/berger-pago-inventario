import type { OpcionPanel } from '@/types'

interface Props<T extends string> {
  titulo: string
  detalle: string
  opciones: OpcionPanel<T>[]
  onElegir: (id: T) => void
}

/**
 * Panel de elección con tarjetas grandes. Es la misma pieza para los dos niveles de entrada: la
 * operación principal (DESPACHO) y la modalidad (ANTICIPADO / VISTA).
 *
 * Las tarjetas son grandes a propósito: es una decisión que se toma una vez por visita y abre un
 * circuito entero, así que tiene que leerse sin esfuerzo y tocarse sin puntería, también en el
 * celular.
 */
export function PanelOpciones<T extends string>({ titulo, detalle, opciones, onElegir }: Props<T>) {
  return (
    <div className="scroll">
      <div className="view">
        <div className="panel-head">
          <h1 className="panel-tit">{titulo}</h1>
          <p className="panel-det">{detalle}</p>
        </div>

        <div className="panel-opciones">
          {opciones.map((op) => (
            <button
              key={op.id}
              type="button"
              className="panel-opcion"
              onClick={() => onElegir(op.id)}
            >
              <span className="panel-opcion-ic">
                <i className={op.icono} aria-hidden="true" />
              </span>
              <span className="panel-opcion-txt">
                <span className="panel-opcion-tit">{op.titulo}</span>
                <span className="panel-opcion-det">{op.detalle}</span>
              </span>
              <i className="fa-solid fa-chevron-right panel-opcion-flecha" aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
