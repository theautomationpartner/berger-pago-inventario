import { useMemo, useState } from 'react'
import { Stepper } from '@/components/ui/Stepper'
import { coincideDraft, unidadesDe } from '@/lib/drafts'
import { DRAFT_ESTADO } from '@/services/monday/columns'
import { planificarDraft, URL_TABLERO_DRAFTS } from '@/services/monday/drafts'
import { PERIODOS } from '@/lib/periodos'
import type { Draft, EtapaPlanificacion, ResultadoPlanificacion } from '@/types'
import { EtiquetasDraft, ImportesDraft, ListaDrafts } from './ListaDrafts'
import { useDrafts } from './useDrafts'

const mensaje = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/**
 * Planificar Período de Producción.
 *
 * Trae del tablero de Drafts los que están en "Pend de Planificar", ya leídos y todavía sin
 * período: son exactamente los que esperan esta decisión. Un draft que ya tiene período no
 * aparece, porque volver a asignárselo sería pisar una planificación hecha.
 *
 * Dos pasos:
 *
 *   1. Selección — ver los datos del draft y sus productos, y marcar cuáles se van a planificar.
 *   2. Períodos  — a cada uno el suyo. Se puede aplicar el mismo a todos de una vez, que es el
 *      caso más común, y después corregir los que difieran.
 *
 * Un draft seleccionado SIN período frena la carga y se ofrece quitarlo: guardar sin período lo
 * dejaría en "Periodo Prod Planificada" sin nada que planificar, que es justo lo que la operación
 * de envío no sabría mandar.
 */
export function PlanificarPeriodo() {
  const { drafts, cargando, error, recargar } = useDrafts(DRAFT_ESTADO.PEND_PLANIFICAR)

  const [etapa, setEtapa] = useState<EtapaPlanificacion>('seleccion')
  const [busqueda, setBusqueda] = useState('')
  const [seleccion, setSeleccion] = useState<string[]>([])
  const [periodos, setPeriodos] = useState<Record<string, string>>({})
  const [enTodos, setEnTodos] = useState('')

  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoPlanificacion | null>(null)

  /* Sólo los que esperan un período. El estado ya lo filtró monday; lo que se comprueba acá es que
     no tengan uno puesto, que es lo que distingue "pendiente" de "ya planificado a mano". */
  const pendientes = useMemo(() => drafts.filter((d) => !d.periodo.trim()), [drafts])
  const visibles = useMemo(
    () => pendientes.filter((d) => coincideDraft(d, busqueda)),
    [pendientes, busqueda],
  )
  const elegidos = useMemo(
    () => seleccion.map((id) => pendientes.find((d) => d.id === id)).filter((d): d is Draft => Boolean(d)),
    [seleccion, pendientes],
  )

  const sinPeriodo = elegidos.filter((d) => !periodos[d.id])

  const alternar = (draft: Draft) =>
    setSeleccion((actual) =>
      actual.includes(draft.id) ? actual.filter((id) => id !== draft.id) : [...actual, draft.id],
    )

  const quitar = (id: string) => setSeleccion((actual) => actual.filter((x) => x !== id))

  const aplicarATodos = (periodo: string) => {
    setEnTodos(periodo)
    if (!periodo) return
    setPeriodos((actual) => {
      const nuevos = { ...actual }
      for (const d of elegidos) nuevos[d.id] = periodo
      return nuevos
    })
  }

  const reiniciar = () => {
    setSeleccion([])
    setPeriodos({})
    setEnTodos('')
    setResultado(null)
    setErrorEnvio(null)
    setEtapa('seleccion')
    void recargar()
  }

  const guardar = async () => {
    setEnviando(true)
    setErrorEnvio(null)
    const planificados: string[] = []
    const advertencias: string[] = []

    /* Uno por uno: si el quinto falla, los cuatro anteriores ya quedaron planificados y no hay
       nada que deshacer. Lo que falle se informa con el número de draft. */
    for (const draft of elegidos) {
      const periodo = periodos[draft.id]
      if (!periodo) continue
      try {
        await planificarDraft(draft.id, periodo)
        planificados.push(`${draft.nombre} · ${periodo}`)
      } catch (e) {
        advertencias.push(`No se pudo planificar el draft ${draft.nombre}: ${mensaje(e)}`)
      }
    }

    setEnviando(false)
    if (planificados.length === 0 && advertencias.length > 0) {
      setErrorEnvio(advertencias.join(' · '))
      return
    }
    setResultado({ planificados, advertencias })
    setEtapa('listo')
  }

  /* ------------------------------------------------------------------ */
  if (etapa === 'listo' && resultado) {
    const conProblemas = resultado.advertencias.length > 0
    return (
      <div className="scroll">
        <div className="view">
          <Stepper variante="planificar" actual="listo" />

          {conProblemas && (
            <div className="aviso aviso--alerta">
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
              <span>
                <b>Algunos drafts no se pudieron planificar.</b> Revisalos en monday:
                <ul style={{ margin: '6px 0 0 18px' }}>
                  {resultado.advertencias.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </span>
            </div>
          )}

          <div className="final">
            <span className="final-ic">
              <i
                className={`fa-solid ${conProblemas ? 'fa-circle-exclamation' : 'fa-check'}`}
                aria-hidden="true"
              />
            </span>
            <span className="final-tit">
              {conProblemas ? 'Planificación con observaciones' : 'Períodos asignados'}
            </span>
            <span className="final-det">
              {resultado.planificados.length} draft
              {resultado.planificados.length === 1 ? '' : 's'} quedaron en{' '}
              <b>Periodo Prod Planificada</b>. Ya se pueden mandar al proveedor desde{' '}
              <b>Enviar Planificación</b>.
            </span>

            <div className="final-datos">
              {resultado.planificados.map((p) => (
                <span key={p} className="chip chip--verde">
                  <i className="fa-solid fa-industry" aria-hidden="true" /> {p}
                </span>
              ))}
            </div>

            <div className="final-acciones">
              <a className="btn btn--borde" href={URL_TABLERO_DRAFTS} target="_blank" rel="noreferrer">
                <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /> Ver en
                monday
              </a>
              <button type="button" className="btn btn--primario" onClick={reiniciar}>
                <i className="fa-solid fa-list" aria-hidden="true" /> Volver a la lista
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="scroll">
        <div className="view">
          <Stepper
            variante="planificar"
            actual={etapa}
            onIr={enviando ? undefined : (e) => setEtapa(e as EtapaPlanificacion)}
          />

          {errorEnvio && (
            <div className="aviso aviso--error">
              <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
              <span>No se pudieron guardar los períodos: {errorEnvio}</span>
            </div>
          )}

          {etapa === 'seleccion' && (
            <>
              <div className="sec-head">
                <span className="sec-num">1</span>
                <span className="sec-txt">
                  <span className="sec-tit">Drafts pendientes de planificar</span>
                  <span className="sec-det">
                    Drafts ya leídos, en <b>Pend de Planificar</b> y todavía sin período de
                    producción. Desplegá cada uno para ver sus productos.
                  </span>
                </span>
              </div>

              <div className="filtros">
                <div className="filtros-fila">
                  <label className="campo campo--busqueda">
                    <span className="campo-lbl">Buscar por número de draft</span>
                    <input
                      className="input"
                      value={busqueda}
                      placeholder="4455007, DRAFT-014, N° de pedido…"
                      onChange={(e) => setBusqueda(e.target.value)}
                    />
                  </label>
                </div>
                <span className="filtros-nota filtros-nota--sola">
                  <i className="fa-solid fa-rotate" aria-hidden="true" />
                  {visibles.length} de {pendientes.length} draft
                  {pendientes.length === 1 ? '' : 's'} sin período
                </span>
              </div>

              <ListaDrafts
                drafts={visibles}
                seleccion={seleccion}
                onAlternar={alternar}
                cargando={cargando}
                error={error}
                onReintentar={() => void recargar()}
                vacioTitulo="No hay drafts para planificar"
                vacioDetalle='Ningún draft está en "Pend de Planificar" sin período de producción.'
              />
            </>
          )}

          {etapa === 'periodos' && (
            <>
              <div className="sec-head">
                <span className="sec-num">2</span>
                <span className="sec-txt">
                  <span className="sec-tit">Período de producción de cada draft</span>
                  <span className="sec-det">
                    Un período por draft. Si van todos al mismo, asignalo de una vez y corregí los
                    que difieran.
                  </span>
                </span>
              </div>

              {sinPeriodo.length > 0 && (
                <div className="aviso aviso--alerta">
                  <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
                  <span>
                    <b>
                      {sinPeriodo.length === 1
                        ? 'Hay 1 draft sin período.'
                        : `Hay ${sinPeriodo.length} drafts sin período.`}
                    </b>{' '}
                    Asignáselo o quitalo de la selección para poder continuar:
                    <span className="aviso-chips">
                      {sinPeriodo.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          className="chip chip--boton chip--ambar"
                          onClick={() => quitar(d.id)}
                        >
                          Draft {d.nombre} <i className="fa-solid fa-xmark" aria-hidden="true" />
                        </button>
                      ))}
                    </span>
                  </span>
                </div>
              )}

              <div className="card card--input card--flush" style={{ marginBottom: 14 }}>
                <label className="campo">
                  <span className="campo-lbl">Aplicar el mismo período a los {elegidos.length}</span>
                  <select
                    className="select"
                    value={enTodos}
                    onChange={(e) => aplicarATodos(e.target.value)}
                  >
                    <option value="">Elegir período…</option>
                    {PERIODOS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <span className="campo-ayuda">
                    Pisa lo que hayas elegido arriba. Después podés corregir draft por draft.
                  </span>
                </label>
              </div>

              <div className="op-editores">
                {elegidos.map((draft) => {
                  const periodo = periodos[draft.id] ?? ''
                  return (
                    <div
                      key={draft.id}
                      className={`card card--flush op-editor${periodo ? '' : ' op-editor--pendiente'}`}
                    >
                      <div className="ctitle op-editor-head">
                        <span className="op-editor-nom">
                          <i className="fa-solid fa-file-invoice" aria-hidden="true" /> Draft{' '}
                          {draft.nombre}
                        </span>
                        <span className="op-editor-chips">
                          <span className="chip chip--indigo">
                            {unidadesDe(draft)} u. · {draft.productos.length} producto
                            {draft.productos.length === 1 ? '' : 's'}
                          </span>
                          {periodo ? (
                            <span className="chip chip--verde">{periodo}</span>
                          ) : (
                            <span className="chip chip--ambar">Sin período</span>
                          )}
                        </span>
                      </div>

                      <div className="op-editor-cuerpo">
                        <div className="opfila-chips" style={{ marginBottom: 10 }}>
                          <EtiquetasDraft draft={draft} />
                        </div>
                        <ImportesDraft draft={draft} />

                        <label className="campo" style={{ marginTop: 12 }}>
                          <span className="campo-lbl">Período de producción sugerido</span>
                          <select
                            className="select"
                            value={periodo}
                            onChange={(e) =>
                              setPeriodos((a) => ({ ...a, [draft.id]: e.target.value }))
                            }
                          >
                            <option value="">Elegir período…</option>
                            {PERIODOS.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </label>

                        <div className="op-editor-acciones">
                          <button
                            type="button"
                            className="btn btn--borde btn--chico"
                            onClick={() => quitar(draft.id)}
                          >
                            <i className="fa-solid fa-xmark" aria-hidden="true" /> Quitar de la
                            selección
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <footer className="pie">
        <div className="pie-info">
          <span className="font-b">
            {elegidos.length} draft{elegidos.length === 1 ? '' : 's'} seleccionado
            {elegidos.length === 1 ? '' : 's'}
          </span>
          <span className="xs">
            {elegidos.length === 0
              ? 'Elegí los drafts a los que les vas a poner período'
              : `${elegidos.reduce((n, d) => n + unidadesDe(d), 0)} unidades en total`}
          </span>
        </div>

        <div className="pie-acciones">
          {etapa === 'periodos' && (
            <button
              type="button"
              className="btn btn--texto"
              disabled={enviando}
              onClick={() => setEtapa('seleccion')}
            >
              <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Volver
            </button>
          )}

          {etapa === 'seleccion' ? (
            <button
              type="button"
              className="btn btn--primario"
              disabled={elegidos.length === 0}
              onClick={() => {
                setErrorEnvio(null)
                setEtapa('periodos')
              }}
            >
              Continuar <i className="fa-solid fa-arrow-right" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--marca"
              disabled={elegidos.length === 0 || sinPeriodo.length > 0 || enviando}
              onClick={() => void guardar()}
            >
              {enviando ? (
                <>
                  <span className="spin" aria-hidden="true" /> Guardando en monday…
                </>
              ) : (
                <>
                  <i className="fa-solid fa-industry" aria-hidden="true" /> Asignar períodos
                </>
              )}
            </button>
          )}
        </div>
      </footer>
    </>
  )
}
