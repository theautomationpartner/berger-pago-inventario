import { OPERACIONES } from '@/lib/operaciones'
import type { Operacion } from '@/types'

interface Props {
  operacion: Operacion
}

/** Qué va a hacer cada operación cuando esté implementada. */
const ANTICIPO: Record<Operacion, string> = {
  cargar: '',
  aprobar:
    'Va a listar las transferencias con Estado Pago en CARGADO para revisarlas, aprobarlas y ' +
    'dejar los tractores en Transf Aprobada.',
  confirmar:
    'Va a cerrar el circuito: comprobante del banco, número de transferencia y los tractores ' +
    'pasan a Pagado.',
}

/**
 * Marcador de las operaciones 2 y 3.
 *
 * Existe para que el circuito completo se vea desde el primer día. Decir qué va a hacer cada
 * etapa —y no sólo "próximamente"— es lo que permite que quien la use hoy sepa dónde termina lo
 * que está cargando.
 */
export function Proximamente({ operacion }: Props) {
  const def = OPERACIONES.find((o) => o.id === operacion)
  if (!def) return null

  return (
    <div className="pronto">
      <span className="pronto-ic">
        <i className={def.icono} aria-hidden="true" />
      </span>
      <span className="pronto-tit">{def.titulo}</span>
      <span className="pronto-det">{ANTICIPO[operacion]}</span>
      <span className="chip chip--ambar" style={{ marginTop: 6 }}>
        <i className="fa-solid fa-clock" aria-hidden="true" /> En desarrollo
      </span>
    </div>
  )
}
