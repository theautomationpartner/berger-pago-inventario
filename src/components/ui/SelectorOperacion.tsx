import { OPERACIONES } from '@/lib/operaciones'
import type { Operacion } from '@/types'

interface Props {
  activa: Operacion
  onCambiar: (op: Operacion) => void
}

/**
 * Las tres operaciones del circuito, siempre a la vista.
 *
 * Son botones y no un `select`: con tres opciones fijas, un desplegable esconde justamente lo
 * que hay que entender de la pantalla —que el pago tiene tres etapas y quién hace cada una—.
 */
export function SelectorOperacion({ activa, onCambiar }: Props) {
  const elegir = (op: (typeof OPERACIONES)[number]) => {
    if (!op.disponible || op.id === activa) return
    onCambiar(op.id)
  }

  return (
    <div className="ops" role="tablist" aria-label="Operación">
      {OPERACIONES.map((op) => {
        const esActiva = op.id === activa
        return (
          <button
            key={op.id}
            type="button"
            role="tab"
            aria-selected={esActiva}
            disabled={!op.disponible}
            className={`op${esActiva ? ' op--activa' : ''}${op.disponible ? '' : ' op--off'}`}
            onClick={() => elegir(op)}
          >
            <span className="op-ic">
              <i className={op.icono} aria-hidden="true" />
            </span>
            <span className="op-txt">
              <span className="op-tit">{op.titulo}</span>
              <span className="op-det">{op.detalle}</span>
              {!op.disponible && <span className="op-pron">Próximamente</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
