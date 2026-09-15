import { ETAPAS_ANTICIPADO } from '@/lib/etapas'
import type { EtapaAnticipado } from '@/types'

interface Props {
  activa: EtapaAnticipado
  onCambiar: (etapa: EtapaAnticipado) => void
}

/**
 * Las tres etapas del despacho ANTICIPADO, siempre a la vista.
 *
 * Son botones y no un `select`: con tres opciones fijas, un desplegable esconde justamente lo
 * que hay que entender de la pantalla —que el pago tiene tres etapas y que cada una toma lo que
 * dejó la anterior—.
 *
 * En celular las tarjetas se convierten en pestañas (una fila que scrollea en horizontal): tres
 * tarjetas apiladas con su descripción comen la pantalla entera antes de que aparezca un solo
 * dato.
 */
export function SelectorEtapa({ activa, onCambiar }: Props) {
  return (
    <div className="ops" role="tablist" aria-label="Etapa del despacho anticipado">
      {ETAPAS_ANTICIPADO.map((etapa, i) => {
        const esActiva = etapa.id === activa
        return (
          <button
            key={etapa.id}
            type="button"
            role="tab"
            aria-selected={esActiva}
            className={`op${esActiva ? ' op--activa' : ''}`}
            onClick={() => etapa.id !== activa && onCambiar(etapa.id)}
          >
            <span className="op-ic">
              <i className={etapa.icono} aria-hidden="true" />
            </span>
            <span className="op-txt">
              <span className="op-tit">
                <span className="op-nro">{i + 1}.</span> {etapa.titulo}
              </span>
              <span className="op-det">{etapa.detalle}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
