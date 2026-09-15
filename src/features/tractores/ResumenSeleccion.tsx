import { importe } from '@/lib/format'
import type { Tractor } from '@/types'
import { ListaSeleccionados } from './ListaSeleccionados'

interface Props {
  tractores: Tractor[]
  onQuitar: (id: string) => void
  /** "Tractores de esta transferencia" / "Tractores de este pedido". */
  titulo: string
  /** Texto de la línea de detalle del total, debajo de la cantidad. */
  detalleTotal?: string
}

/**
 * Lo elegido: la lista desplegable con el detalle de cada tractor y el total del valor neto.
 *
 * Muestra TODOS los seleccionados, estén o no dentro del filtro de meses activo. La lista de
 * arriba responde "qué puedo agregar"; ésta responde "qué estoy despachando", y si un tractor ya
 * elegido desapareciera de acá por cambiar de mes, el total dejaría de coincidir con lo que se ve.
 */
export function ResumenSeleccion({ tractores, onQuitar, titulo, detalleTotal }: Props) {
  if (tractores.length === 0) return null

  const total = tractores.reduce((suma, t) => suma + (t.valorNeto ?? 0), 0)
  const sinImporte = tractores.filter((t) => t.valorNeto == null).length

  return (
    <>
      <div className="card card--data" style={{ marginTop: 16 }}>
        <div className="ctitle">
          <i className="fa-solid fa-list-check" aria-hidden="true" />
          {titulo}
          <span className="ctitle-cont">
            {tractores.length} seleccionado{tractores.length === 1 ? '' : 's'}
          </span>
        </div>
        <ListaSeleccionados tractores={tractores} onQuitar={onQuitar} />
      </div>

      <div className="total">
        <span className="total-ic">
          <i className="fa-solid fa-coins" aria-hidden="true" />
        </span>
        <span className="total-detalle">
          <span>
            {tractores.length} tractor{tractores.length === 1 ? '' : 'es'}
            {detalleTotal ? ` · ${detalleTotal}` : ''}
          </span>
          {sinImporte > 0 && (
            <span className="total-parcial">
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {sinImporte} sin
              valor neto cargado: el total está incompleto
            </span>
          )}
        </span>
        {/* El importe va a la derecha, alineado con la columna de importes de las listas de
            arriba: así el total queda debajo de los números que suma. */}
        <span className="total-txt">
          <span className="total-lbl">Total valor neto</span>
          <span className="total-val">{importe(total)}</span>
        </span>
      </div>
    </>
  )
}
