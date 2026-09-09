import { fechaCorta, importe, periodoLargo } from '@/lib/format'
import type { PeriodoMes, Tractor } from '@/types'
import { ListaSeleccionados } from './ListaSeleccionados'

interface Props {
  periodo: PeriodoMes
  onCambiarPeriodo: (periodo: PeriodoMes) => void
  tractores: Tractor[]
  seleccionados: Set<string>
  onAlternar: (id: string) => void
  onTodos: (ids: string[]) => void
  onNinguno: () => void
  cargando: boolean
  error: string | null
  onReintentar: () => void
}

/** Doce meses hacia atrás y tres hacia adelante, contados desde hoy. */
function opcionesDePeriodo(): PeriodoMes[] {
  const hoy = new Date()
  const opciones: PeriodoMes[] = []
  for (let delta = 3; delta >= -12; delta -= 1) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + delta, 1)
    opciones.push({ anio: d.getFullYear(), mes: d.getMonth() + 1 })
  }
  return opciones
}

const clavePeriodo = (p: PeriodoMes) => `${p.anio}-${String(p.mes).padStart(2, '0')}`

/**
 * Paso 1: qué tractores entran en la transferencia.
 *
 * La lista de arriba son los candidatos —Estado Pago en "Listo para Pagar" Y Fecha de Prod dentro
 * del mes elegido—; la de abajo, los ya elegidos con su detalle desplegable. Son dos listas y no
 * una con filtro porque son dos preguntas distintas: "qué puedo pagar" y "qué estoy pagando".
 */
export function Paso1Seleccion({
  periodo,
  onCambiarPeriodo,
  tractores,
  seleccionados,
  onAlternar,
  onTodos,
  onNinguno,
  cargando,
  error,
  onReintentar,
}: Props) {
  const elegidos = tractores.filter((t) => seleccionados.has(t.id))
  const total = elegidos.reduce((suma, t) => suma + (t.valorNeto ?? 0), 0)
  const sinImporte = elegidos.filter((t) => t.valorNeto == null).length
  const todosMarcados = tractores.length > 0 && elegidos.length === tractores.length

  return (
    <>
      <div className="sec-head">
        <span className="sec-num">1</span>
        <span className="sec-txt">
          <span className="sec-tit">Tractores listos para pagar</span>
          <span className="sec-det">
            Del tablero de Inventario, con Estado Pago en <b>Listo para Pagar</b> y Fecha de Prod
            dentro de <b>{periodoLargo(periodo.anio, periodo.mes)}</b>.
          </span>
        </span>
      </div>

      <div className="periodo">
        <label className="campo periodo-sel">
          <span className="campo-lbl">Mes de la operación</span>
          <select
            className="select"
            value={clavePeriodo(periodo)}
            onChange={(e) => {
              const [anio, mes] = e.target.value.split('-')
              onCambiarPeriodo({ anio: Number(anio), mes: Number(mes) })
            }}
          >
            {opcionesDePeriodo().map((p) => (
              <option key={clavePeriodo(p)} value={clavePeriodo(p)}>
                {periodoLargo(p.anio, p.mes)}
              </option>
            ))}
          </select>
        </label>
        <span className="periodo-nota">
          <i className="fa-solid fa-rotate" aria-hidden="true" />
          Datos en vivo del tablero de Inventario
          <button type="button" className="btn btn--borde btn--chico" onClick={onReintentar}>
            Actualizar
          </button>
        </span>
      </div>

      {error && (
        <div className="aviso aviso--error">
          <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
          <span>
            No se pudo leer el Inventario: {error}{' '}
            <button type="button" className="btn btn--texto btn--chico" onClick={onReintentar}>
              Reintentar
            </button>
          </span>
        </div>
      )}

      <div className="lista">
        <div className="lista-head">
          <span>Tractor</span>
          <span className="lista-head-acciones">
            <button
              type="button"
              className="btn btn--borde btn--chico"
              disabled={tractores.length === 0}
              onClick={() => (todosMarcados ? onNinguno() : onTodos(tractores.map((t) => t.id)))}
            >
              {todosMarcados ? 'Desmarcar todos' : 'Marcar todos'}
            </button>
          </span>
        </div>

        <div className="lista-body">
          {cargando && (
            <div className="vacio">
              <span className="spin spin--oscuro" aria-hidden="true" />
              <span className="vacio-tit">Buscando tractores en el Inventario…</span>
            </div>
          )}

          {!cargando && tractores.length === 0 && !error && (
            <div className="vacio">
              <span className="vacio-ic">
                <i className="fa-solid fa-tractor" aria-hidden="true" />
              </span>
              <span className="vacio-tit">No hay tractores para pagar en este mes</span>
              <span className="vacio-det">
                Ninguno tiene el Estado Pago en "Listo para Pagar" con la Fecha de Prod dentro de{' '}
                {periodoLargo(periodo.anio, periodo.mes)}. Probá con otro mes o revisá el tablero de
                Inventario.
              </span>
            </div>
          )}

          {!cargando &&
            tractores.map((t) => {
              const marcado = seleccionados.has(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={marcado}
                  className={`trow${marcado ? ' trow--sel' : ''}`}
                  onClick={() => onAlternar(t.id)}
                >
                  <span className="trow-check">
                    {marcado && <i className="fa-solid fa-check" aria-hidden="true" />}
                  </span>
                  <span className="trow-nom">
                    <span className="trow-nom-txt">{t.nombre}</span>
                    {t.numInterno && <span className="chip chip--interno">N° {t.numInterno}</span>}
                    {t.formaPago && <span className="chip chip--gris">{t.formaPago}</span>}
                  </span>
                  <span className="trow-meta">
                    <span className="trow-fecha">{fechaCorta(t.fechaProd)}</span>
                    <span className="trow-neto">{importe(t.valorNeto)}</span>
                  </span>
                </button>
              )
            })}
        </div>
      </div>

      {elegidos.length > 0 && (
        <>
          <div className="card card--data" style={{ marginTop: 16 }}>
            <div className="ctitle">
              <i className="fa-solid fa-list-check" aria-hidden="true" />
              Tractores de esta transferencia
              <span className="ctitle-cont">
                {elegidos.length} seleccionado{elegidos.length === 1 ? '' : 's'}
              </span>
            </div>
            <ListaSeleccionados tractores={elegidos} onQuitar={onAlternar} />
          </div>

          <div className="total">
            <span className="total-ic">
              <i className="fa-solid fa-coins" aria-hidden="true" />
            </span>
            <span className="total-txt">
              <span className="total-lbl">Total valor neto</span>
              <span className="total-val">{importe(total)}</span>
            </span>
            <span className="total-detalle">
              <span>
                {elegidos.length} tractor{elegidos.length === 1 ? '' : 'es'} de{' '}
                {periodoLargo(periodo.anio, periodo.mes)}
              </span>
              {sinImporte > 0 && (
                <span className="total-parcial">
                  <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />{' '}
                  {sinImporte} sin valor neto cargado: el total está incompleto
                </span>
              )}
            </span>
          </div>
        </>
      )}
    </>
  )
}
