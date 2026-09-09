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
 * que hay que entender de la pantalla —que el pago tiene tres etapas y que cada una toma lo que
 * dejó la anterior—.
 *
 * En celular las tarjetas se convierten en pestañas (una fila que scrollea en horizontal): tres
 * tarjetas apiladas con su descripción comen la pantalla entera antes de que aparezca un solo
 * dato.
 */
export function SelectorOperacion({ activa, onCambiar }: Props) {
  return (
    <div className="ops" role="tablist" aria-label="Operación">
      {OPERACIONES.map((op, i) => {
        const esActiva = op.id === activa
        return (
          <button
            key={op.id}
            type="button"
            role="tab"
            aria-selected={esActiva}
            className={`op${esActiva ? ' op--activa' : ''}`}
            onClick={() => op.id !== activa && onCambiar(op.id)}
          >
            <span className="op-ic">
              <i className={op.icono} aria-hidden="true" />
            </span>
            <span className="op-txt">
              <span className="op-tit">
                <span className="op-nro">{i + 1}.</span> {op.titulo}
              </span>
              <span className="op-det">{op.detalle}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
