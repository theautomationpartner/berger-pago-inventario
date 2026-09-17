import { ROTULOS } from '@/lib/despachos'
import { fechaCorta } from '@/lib/format'
import { ESTADO_CARGA, VIA_TRANSPORTE } from '@/services/monday/columns'
import type { CambioDespacho, DespachoOP, EdicionDespacho } from '@/types'
import { EtiquetasOP } from './EtiquetasOP'

interface Props {
  op: DespachoOP
  edicion: EdicionDespacho
  cambios: CambioDespacho[]
  onCambiar: (edicion: EdicionDespacho) => void
  onQuitar: () => void
  onDeshacer: () => void
}

/** El valor que tenía antes, para mostrar debajo del campo que se tocó. */
const antesDe = (campo: keyof EdicionDespacho, op: DespachoOP): string => {
  const valor = campo === 'eta' ? (op.eta ? fechaCorta(op.eta) : '') : String(op[campo] ?? '')
  return valor || '(vacío)'
}

/**
 * El formulario de UNA OP, con sus valores actuales ya cargados.
 *
 * Lo que no se toca no se manda a monday: cada campo arranca con lo que hay hoy en el tablero y
 * sólo viaja lo que quedó distinto. Eso hace que dos despachantes trabajando el mismo día no se
 * pisen los datos que el otro cargó, aunque tengan la OP abierta al mismo tiempo.
 *
 * Cada campo modificado avisa qué decía antes. No es decoración: el error más caro acá es
 * sobreescribir un dato bueno por haber tipeado en la fila equivocada, y verlo al lado es lo que
 * lo evita antes de guardar.
 */
export function EditorOP({ op, edicion, cambios, onCambiar, onQuitar, onDeshacer }: Props) {
  const cambiado = (campo: keyof EdicionDespacho) => cambios.some((c) => c.campo === campo)
  const set = (campo: keyof EdicionDespacho, valor: string) =>
    onCambiar({ ...edicion, [campo]: valor })

  /** Ayuda del campo: qué decía antes si se tocó, y nada si no. */
  const ayuda = (campo: keyof EdicionDespacho) =>
    cambiado(campo) ? (
      <span className="campo-ayuda campo-ayuda--cambio">
        <i className="fa-solid fa-arrow-right-long" aria-hidden="true" /> antes:{' '}
        <b>{antesDe(campo, op)}</b>
      </span>
    ) : null

  return (
    <div className={`card card--flush op-editor${cambios.length === 0 ? ' op-editor--pendiente' : ''}`}>
      <div className="ctitle op-editor-head">
        <span className="op-editor-nom">
          <i className="fa-solid fa-file-lines" aria-hidden="true" /> {op.nombre}
        </span>
        <span className="op-editor-chips">
          <EtiquetasOP op={op} />
          {cambios.length > 0 ? (
            <span className="chip chip--verde">
              {cambios.length} cambio{cambios.length === 1 ? '' : 's'}
            </span>
          ) : (
            <span className="chip chip--ambar">Sin cambios</span>
          )}
        </span>
      </div>

      <div className="op-editor-cuerpo">
        <div className="datos datos--form">
          <label className="campo">
            <span className="campo-lbl">{ROTULOS.estadoCarga}</span>
            <select
              className="select"
              value={edicion.estadoCarga}
              onChange={(e) => set('estadoCarga', e.target.value)}
            >
              <option value="">(sin estado)</option>
              {ESTADO_CARGA.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </select>
            {ayuda('estadoCarga')}
          </label>

          <label className="campo">
            <span className="campo-lbl">{ROTULOS.eta}</span>
            <input
              className="input"
              type="date"
              value={edicion.eta}
              onChange={(e) => set('eta', e.target.value)}
            />
            {ayuda('eta')}
          </label>

          <label className="campo">
            <span className="campo-lbl">{ROTULOS.nroOp}</span>
            <input
              className="input"
              value={edicion.nroOp}
              placeholder="Ej: 2026-0143"
              onChange={(e) => set('nroOp', e.target.value)}
            />
            {ayuda('nroOp')}
          </label>

          <label className="campo">
            <span className="campo-lbl">{ROTULOS.viaTransporte}</span>
            <select
              className="select"
              value={edicion.viaTransporte}
              onChange={(e) => set('viaTransporte', e.target.value)}
            >
              <option value="">(sin vía)</option>
              {VIA_TRANSPORTE.map((via) => (
                <option key={via} value={via}>
                  {via}
                </option>
              ))}
            </select>
            {ayuda('viaTransporte')}
          </label>

          <label className="campo">
            <span className="campo-lbl">{ROTULOS.buque}</span>
            <input
              className="input"
              value={edicion.buque}
              onChange={(e) => set('buque', e.target.value)}
            />
            {ayuda('buque')}
          </label>

          <label className="campo">
            <span className="campo-lbl">{ROTULOS.nroDocTransporte}</span>
            <input
              className="input"
              value={edicion.nroDocTransporte}
              onChange={(e) => set('nroDocTransporte', e.target.value)}
            />
            {ayuda('nroDocTransporte')}
          </label>

          <label className="campo">
            <span className="campo-lbl">{ROTULOS.contenedorRef}</span>
            <input
              className="input"
              value={edicion.contenedorRef}
              onChange={(e) => set('contenedorRef', e.target.value)}
            />
            {ayuda('contenedorRef')}
          </label>
        </div>

        <label className="campo" style={{ marginTop: 10 }}>
          <span className="campo-lbl">{ROTULOS.observaciones}</span>
          <textarea
            className="input textarea"
            rows={3}
            value={edicion.observaciones}
            placeholder="Actualización de la carga: demoras, transbordos, lo que haya que dejar asentado."
            onChange={(e) => set('observaciones', e.target.value)}
          />
          {ayuda('observaciones')}
        </label>

        <div className="op-editor-acciones">
          {cambios.length > 0 && (
            <button type="button" className="btn btn--texto btn--chico" onClick={onDeshacer}>
              <i className="fa-solid fa-rotate-left" aria-hidden="true" /> Deshacer cambios
            </button>
          )}
          <button type="button" className="btn btn--borde btn--chico" onClick={onQuitar}>
            <i className="fa-solid fa-xmark" aria-hidden="true" /> Quitar de la selección
          </button>
        </div>
      </div>
    </div>
  )
}
