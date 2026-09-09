import { ZonaArchivo } from '@/components/ui/ZonaArchivo'
import { aNumero, importe } from '@/lib/format'
import type { DatosTransferencia, Tractor } from '@/types'

interface Props {
  tractores: Tractor[]
  datos: DatosTransferencia
  onCambiar: (datos: DatosTransferencia) => void
  /** Suma de los valores netos. Es la referencia contra la que se compara el monto tipeado. */
  total: number
}

/**
 * Paso 2: el comprobante y los datos de la transferencia.
 *
 * El monto arranca en el total de los valores netos pero queda EDITABLE: la transferencia real
 * puede diferir por redondeo, gastos bancarios o un pago parcial acordado, y forzar el total
 * calculado obligaría a corregirlo después a mano en monday. Cuando difieren, la app lo dice en
 * vez de decidir por su cuenta cuál de los dos tiene razón.
 */
export function Paso2Transferencia({ tractores, datos, onCambiar, total }: Props) {
  const montoNumero = aNumero(datos.monto)
  const difiere = montoNumero != null && Math.abs(montoNumero - total) > 0.005

  return (
    <>
      <div className="sec-head">
        <span className="sec-num">2</span>
        <span className="sec-txt">
          <span className="sec-tit">Transferencia</span>
          <span className="sec-det">
            Adjuntá el PDF de la transferencia y confirmá el monto y la fecha de emisión.
          </span>
        </span>
      </div>

      <div className="card card--flush" style={{ marginBottom: 16 }}>
        <div className="ctitle">
          <i className="fa-solid fa-paperclip" aria-hidden="true" />
          Comprobante de la transferencia
        </div>
        <ZonaArchivo
          archivo={datos.archivo}
          onElegir={(archivo) => onCambiar({ ...datos, archivo })}
          titulo="Arrastrá la transferencia acá o hacé clic para buscarla"
        />
      </div>

      <div className="grid2">
        <div className="card card--input card--flush">
          <label className="campo">
            <span className="campo-lbl">Monto de la transferencia</span>
            <input
              className="input input--num"
              inputMode="decimal"
              value={datos.monto}
              onChange={(e) => onCambiar({ ...datos, monto: e.target.value })}
            />
            <span className="campo-ayuda">
              Total de los valores netos: <b>{importe(total)}</b>
            </span>
          </label>
          {difiere && (
            <div className="aviso aviso--alerta" style={{ marginTop: 12, marginBottom: 0 }}>
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
              <span>
                El monto no coincide con la suma de los valores netos. Se va a registrar el monto
                que escribiste.
              </span>
            </div>
          )}
        </div>

        <div className="card card--input card--flush">
          <label className="campo">
            <span className="campo-lbl">Fecha de emisión de la transferencia</span>
            <input
              className="input"
              type="date"
              value={datos.fechaEmision}
              onChange={(e) => onCambiar({ ...datos, fechaEmision: e.target.value })}
            />
            <span className="campo-ayuda">
              Es la fecha que queda registrada en el tablero de Pagos del Inventario.
            </span>
          </label>
        </div>
      </div>

      <div className="card card--data" style={{ marginTop: 16 }}>
        <div className="ctitle">
          <i className="fa-solid fa-tractor" aria-hidden="true" />
          Qué se va a registrar
          <span className="ctitle-cont">
            {tractores.length} tractor{tractores.length === 1 ? '' : 'es'}
          </span>
        </div>
        <div className="resumen">
          {tractores.map((t) => (
            <div key={t.id} className="resumen-fila">
              <span className="resumen-nom">{t.nombre}</span>
              {t.numInterno && <span className="chip chip--interno">N° {t.numInterno}</span>}
              <span className="resumen-val">{importe(t.valorNeto)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="aviso aviso--info" style={{ marginTop: 16, marginBottom: 0 }}>
        <i className="fa-solid fa-circle-info" aria-hidden="true" />
        <span>
          Al cargar el pago se crea un item en <b>Pagos del Inventario</b> con la transferencia
          adjunta, un subitem por cada tractor conectado a su item del Inventario, y cada tractor
          pasa a <b>Transf Cargada</b>.
        </span>
      </div>
    </>
  )
}
