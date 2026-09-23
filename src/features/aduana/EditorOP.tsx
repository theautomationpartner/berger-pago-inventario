import { FilaArchivo } from '@/components/ui/FilaArchivo'
import { NACIONALIZADO, ROTULOS, faltaNroDespacho } from '@/lib/despachos'
import { fechaCorta } from '@/lib/format'
import { ESTADO_CARGA, PROXIMA_A_ARRIBAR, VIA_TRANSPORTE } from '@/services/monday/columns'
import { ARCHIVOS_OP, ROTULO_ARCHIVO, archivosDeColumna } from '@/services/monday/despachos'
import type { ArchivosDespacho, CambioDespacho, DespachoOP, EdicionDespacho } from '@/types'
import { EtiquetasOP } from './EtiquetasOP'

/**
 * Los comprobantes, en el orden en que el despachante los consigue.
 *
 * El VEP va último y es el que más peso tiene: hasta que no está subido, BERGER no puede marcar
 * el pago ni adjuntar su comprobante. Es la llave de esa parte del circuito.
 */
const CAMPOS_ARCHIVO: {
  columna: string
  campo: keyof ArchivosDespacho
  /** Si admite más de un archivo por vez. Hoy sólo Senasa. */
  varios?: boolean
}[] = [
  { columna: ARCHIVOS_OP[0], campo: 'fcTransporteImpo' },
  { columna: ARCHIVOS_OP[1], campo: 'despachoImpo' },
  { columna: ARCHIVOS_OP[2], campo: 'fcTerminal' },
  { columna: ARCHIVOS_OP[3], campo: 'gastosVarios' },
  { columna: ARCHIVOS_OP[4], campo: 'facturaSenasa', varios: true },
  { columna: ARCHIVOS_OP[5], campo: 'facturaModoc' },
  { columna: ARCHIVOS_OP[6], campo: 'facturaPrecintos' },
  { columna: ARCHIVOS_OP[7], campo: 'vepDespachante' },
]

interface Props {
  op: DespachoOP
  edicion: EdicionDespacho
  cambios: CambioDespacho[]
  onCambiar: (edicion: EdicionDespacho) => void
  onQuitar: () => void
  onDeshacer: () => void
  /** Los archivos que se van a subir al guardar. */
  archivos: ArchivosDespacho
  onArchivo: (campo: keyof ArchivosDespacho, archivos: File[]) => void
  /**
   * Tractores de la OP que todavía no tienen contenedor. Con alguno pendiente, la OP no puede
   * pasar a "Próxima a Arribar": el aviso a BERGER sale con los links de los contenedores, y sin
   * contenedores no hay nada que mandar.
   */
  sinContenedor: number
  /** Para ofrecer armar los contenedores desde el mismo lugar donde se bloquea. */
  onArmarContenedores: () => void
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
export function EditorOP({
  op,
  edicion,
  cambios,
  onCambiar,
  onQuitar,
  onDeshacer,
  archivos,
  onArchivo,
  sinContenedor,
  onArmarContenedores,
}: Props) {
  /* El bloqueo se muestra acá, pegado al campo que lo provoca, y no sólo al pie: el que elige el
     estado tiene que enterarse en el momento, no al apretar guardar. */
  const faltanContenedores = edicion.estadoCarga === PROXIMA_A_ARRIBAR && sinContenedor > 0
  /* Con tractores sueltos, "Próxima a Arribar" directamente NO se puede elegir: la opción queda
     deshabilitada en el desplegable. Dejar elegir algo que después el guardado rechaza es hacerle
     completar el formulario entero a alguien para decirle que no al final. */
  const bloqueaProxima = sinContenedor > 0 && edicion.estadoCarga !== PROXIMA_A_ARRIBAR
  /* Nacionalizar sin el número del despacho deja un estado que no se puede respaldar con nada.
     Se avisa apenas se elige el estado, no al guardar: el campo está en la misma pantalla. */
  const faltaDespacho = faltaNroDespacho(edicion)
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
    <div
      className={`card card--flush op-editor${cambios.length === 0 ? ' op-editor--pendiente' : ''}`}
    >
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
              {ESTADO_CARGA.map((estado) => {
                const vedado = estado === PROXIMA_A_ARRIBAR && bloqueaProxima
                return (
                  <option key={estado} value={estado} disabled={vedado}>
                    {estado}
                    {vedado ? ' — faltan contenedores' : ''}
                  </option>
                )
              })}
            </select>
            {ayuda('estadoCarga')}
            {bloqueaProxima && (
              <span className="campo-ayuda campo-ayuda--falta">
                <i className="fa-solid fa-lock" aria-hidden="true" /> "{PROXIMA_A_ARRIBAR}" no se
                puede elegir: quedan {sinContenedor} tractor{sinContenedor === 1 ? '' : 'es'} sin
                contenedor.
              </span>
            )}
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
            <span className="campo-lbl">
              {ROTULOS.nroDespachoImpo}
              {edicion.estadoCarga === NACIONALIZADO && (
                <span className="campo-req"> · obligatorio</span>
              )}
            </span>
            <input
              className={`input${faltaDespacho ? ' input--error' : ''}`}
              value={edicion.nroDespachoImpo}
              placeholder="Ej: 26 001 IC04 000123 A"
              onChange={(e) => set('nroDespachoImpo', e.target.value)}
            />
            {ayuda('nroDespachoImpo')}
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

        {faltaDespacho && (
          <div className="aviso aviso--error" style={{ marginTop: 12, marginBottom: 0 }}>
            <i className="fa-solid fa-file-circle-exclamation" aria-hidden="true" />
            <span>
              <b>
                Para pasar a "{NACIONALIZADO}" hace falta el {ROTULOS.nroDespachoImpo}.
              </b>{' '}
              Es el número del trámite ante la aduana.
            </span>
          </div>
        )}

        {sinContenedor > 0 && (
          <div
            className={`aviso ${faltanContenedores ? 'aviso--error' : 'aviso--alerta'}`}
            style={{ marginTop: 12, marginBottom: 0 }}
          >
            <i className="fa-solid fa-boxes-packing" aria-hidden="true" />
            <span>
              <b>Para pasar a "{PROXIMA_A_ARRIBAR}" hay que armar los contenedores primero.</b>{' '}
              Quedan {sinContenedor} tractor{sinContenedor === 1 ? '' : 'es'} sin contenedor. El
              aviso a BERGER lleva los links de los contenedores para que carguen transportista y
              entrega, así que sin armarlos ese aviso no sirve.
              <span className="aviso-chips">
                <button
                  type="button"
                  className="btn btn--borde btn--chico"
                  onClick={onArmarContenedores}
                >
                  <i className="fa-solid fa-boxes-packing" aria-hidden="true" /> Armar contenedores
                </button>
              </span>
            </span>
          </div>
        )}

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

        <div className="archivos">
          <div className="archivos-tit">
            <i className="fa-solid fa-paperclip" aria-hidden="true" /> Comprobantes del trámite
            <span className="archivos-nota">Sólo PDF · nada se sube hasta que guardes</span>
          </div>
          {/* Una lista y no ocho recuadros: lo que hay que ver de un vistazo es qué está subido y
              qué falta, y eso en ocho cajas iguales se pierde. */}
          <div className="archivos-lista">
            {CAMPOS_ARCHIVO.map(({ columna, campo, varios }) => (
              <FilaArchivo
                key={columna}
                rotulo={ROTULO_ARCHIVO[columna]}
                yaSubidos={archivosDeColumna(op.archivos?.[columna] ?? '')}
                pendientes={archivos[campo]}
                onCambiar={(lista) => onArchivo(campo, lista)}
                varios={varios}
              />
            ))}
          </div>
        </div>

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
