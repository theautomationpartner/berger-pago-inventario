import { useMemo, useState } from 'react'
import { Stepper } from '@/components/ui/Stepper'
import { cambiosDe, coincide, soloLoCambiado, valoresActuales } from '@/lib/despachos'
import { ESTADO_CARGA, URL_TABLERO_DESPACHANTE } from '@/services/monday/columns'
import { actualizarDespacho } from '@/services/monday/despachos'
import { tonoEstadoCarga } from '@/lib/chips'
import type {
  CambioDespacho,
  DespachoOP,
  EdicionDespacho,
  EtapaAduana,
  ResultadoActualizacion,
} from '@/types'
import { EditorOP } from './EditorOP'
import { EtiquetasOP } from './EtiquetasOP'
import { FichaOP } from './FichaOP'
import { useDespachos } from './useDespachos'

const mensaje = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/**
 * Actualizar Despacho OP: lo que hace el despachante de aduana todos los días.
 *
 * Tres pasos, y cada uno existe por un motivo distinto:
 *
 *   1. Selección — encontrar las OP. Se filtra por estado, se busca por número, y antes de marcar
 *      una se puede desplegar para ver cómo está hoy.
 *   2. Edición   — cargar las novedades. Cada OP arranca con sus valores actuales y sólo viaja lo
 *      que se cambió.
 *   3. Resumen   — leer, campo por campo, qué va a quedar distinto antes de escribir en monday.
 *
 * El paso 3 no es un trámite: acá se editan varias OP de una vez, y una fila equivocada se nota
 * mucho más leyendo "ETA: 12/10 → 12/11" que releyendo siete formularios.
 */
export function ActualizarDespachos() {
  const { despachos, cargando, error, recargar } = useDespachos()

  const [etapa, setEtapa] = useState<EtapaAduana>('seleccion')
  const [estados, setEstados] = useState<string[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [abierta, setAbierta] = useState<string | null>(null)

  /** Lo elegido y lo editado viven juntos: una OP seleccionada siempre tiene su formulario. */
  const [seleccion, setSeleccion] = useState<string[]>([])
  const [ediciones, setEdiciones] = useState<Record<string, EdicionDespacho>>({})

  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoActualizacion | null>(null)

  const visibles = useMemo(
    () => despachos.filter((op) => coincide(op, estados, busqueda)),
    [despachos, estados, busqueda],
  )

  const elegidas = useMemo(
    () =>
      seleccion
        .map((id) => despachos.find((op) => op.id === id))
        .filter((op): op is DespachoOP => Boolean(op)),
    [seleccion, despachos],
  )

  /** Los cambios de cada OP elegida, calculados una vez y usados en los tres lugares. */
  const cambiosPorOp = useMemo(() => {
    const mapa = new Map<string, CambioDespacho[]>()
    for (const op of elegidas) {
      const edicion = ediciones[op.id] ?? valoresActuales(op)
      mapa.set(op.id, cambiosDe(op, edicion))
    }
    return mapa
  }, [elegidas, ediciones])

  const sinCambios = elegidas.filter((op) => (cambiosPorOp.get(op.id) ?? []).length === 0)
  const totalCambios = elegidas.reduce((n, op) => n + (cambiosPorOp.get(op.id) ?? []).length, 0)

  const alternar = (op: DespachoOP) => {
    setSeleccion((actual) =>
      actual.includes(op.id) ? actual.filter((id) => id !== op.id) : [...actual, op.id],
    )
    setEdiciones((actual) =>
      actual[op.id] ? actual : { ...actual, [op.id]: valoresActuales(op) },
    )
  }

  const quitar = (id: string) => setSeleccion((actual) => actual.filter((x) => x !== id))

  const alternarEstado = (estado: string) =>
    setEstados((actual) =>
      actual.includes(estado) ? actual.filter((e) => e !== estado) : [...actual, estado],
    )

  const reiniciar = () => {
    setSeleccion([])
    setEdiciones({})
    setResultado(null)
    setErrorEnvio(null)
    setEtapa('seleccion')
    void recargar()
  }

  const guardar = async () => {
    setEnviando(true)
    setErrorEnvio(null)
    const actualizadas: string[] = []
    const advertencias: string[] = []

    /* Una por una y no todo o nada: si la quinta falla, las cuatro anteriores ya quedaron bien
       guardadas y no hay nada que deshacer. Lo que falló se informa con nombre y apellido. */
    for (const op of elegidas) {
      const edicion = ediciones[op.id] ?? valoresActuales(op)
      const cambios = soloLoCambiado(op, edicion)
      if (Object.keys(cambios).length === 0) continue
      try {
        await actualizarDespacho(op.id, cambios)
        actualizadas.push(op.nombre || op.idDespacho || op.id)
      } catch (e) {
        advertencias.push(`No se pudo actualizar ${op.nombre || op.id}: ${mensaje(e)}`)
      }
    }

    setEnviando(false)
    if (actualizadas.length === 0 && advertencias.length > 0) {
      setErrorEnvio(advertencias.join(' · '))
      return
    }
    setResultado({ actualizadas, advertencias })
    setEtapa('listo')
  }

  /* ------------------------------------------------------------------ *
   * Pantalla final
   * ------------------------------------------------------------------ */
  if (etapa === 'listo' && resultado) {
    const conProblemas = resultado.advertencias.length > 0
    return (
      <div className="scroll">
        <div className="view">
          <Stepper variante="aduana" actual="listo" />

          {conProblemas && (
            <div className="aviso aviso--alerta">
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
              <span>
                <b>Algunas OP no se pudieron actualizar.</b> Revisalas en monday:
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
              {conProblemas ? 'Actualización con observaciones' : 'OP actualizadas'}
            </span>
            <span className="final-det">
              Se guardaron los cambios de {resultado.actualizadas.length} OP en el tablero del
              Despachante de aduana.
            </span>

            <div className="final-datos">
              {resultado.actualizadas.map((nombre) => (
                <span key={nombre} className="chip chip--verde">
                  <i className="fa-solid fa-check" aria-hidden="true" /> {nombre}
                </span>
              ))}
            </div>

            <div className="final-acciones">
              <a
                className="btn btn--borde"
                href={URL_TABLERO_DESPACHANTE}
                target="_blank"
                rel="noreferrer"
              >
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
            variante="aduana"
            actual={etapa}
            onIr={enviando ? undefined : (e) => setEtapa(e as EtapaAduana)}
          />

          {errorEnvio && (
            <div className="aviso aviso--error">
              <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
              <span>No se pudieron guardar los cambios: {errorEnvio}</span>
            </div>
          )}

          {/* ---------------- Paso 1 · Selección ---------------- */}
          {etapa === 'seleccion' && (
            <>
              <div className="sec-head">
                <span className="sec-num">1</span>
                <span className="sec-txt">
                  <span className="sec-tit">OP a actualizar</span>
                  <span className="sec-det">
                    Filtrá por estado de carga o buscá por nombre, N° de OP o ID del despacho.
                    Desplegá una OP para ver cómo está hoy antes de elegirla.
                  </span>
                </span>
              </div>

              {error && (
                <div className="aviso aviso--error">
                  <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
                  <span>
                    No se pudo leer el tablero: {error}{' '}
                    <button
                      type="button"
                      className="btn btn--texto btn--chico"
                      onClick={() => void recargar()}
                    >
                      Reintentar
                    </button>
                  </span>
                </div>
              )}

              <div className="filtros">
                <div className="filtros-fila">
                  <label className="campo campo--busqueda">
                    <span className="campo-lbl">Buscar</span>
                    <input
                      className="input"
                      value={busqueda}
                      placeholder="PAGOINV-019, N° de OP, buque…"
                      onChange={(e) => setBusqueda(e.target.value)}
                    />
                  </label>
                </div>

                <div className="filtros-tags">
                  {ESTADO_CARGA.map((estado) => {
                    const activo = estados.includes(estado)
                    const cuantos = despachos.filter((op) => op.estadoCarga === estado).length
                    return (
                      <button
                        key={estado}
                        type="button"
                        aria-pressed={activo}
                        className={`chip chip--boton ${tonoEstadoCarga(estado)}${activo ? ' chip--activo' : ''}`}
                        onClick={() => alternarEstado(estado)}
                      >
                        {estado} ({cuantos})
                        {activo && <i className="fa-solid fa-xmark" aria-hidden="true" />}
                      </button>
                    )
                  })}
                  {estados.length > 0 && (
                    <button
                      type="button"
                      className="btn btn--texto btn--chico"
                      onClick={() => setEstados([])}
                    >
                      Quitar filtros
                    </button>
                  )}
                </div>

                <span className="filtros-nota filtros-nota--sola">
                  <i className="fa-solid fa-rotate" aria-hidden="true" />
                  {visibles.length} de {despachos.length} OP
                  <button
                    type="button"
                    className="btn btn--borde btn--chico"
                    onClick={() => void recargar()}
                  >
                    Actualizar
                  </button>
                </span>
              </div>

              <div className="lista">
                <div className="lista-head">
                  <span>Orden de pago</span>
                </div>

                <div className="lista-body">
                  {cargando && (
                    <div className="vacio">
                      <span className="spin spin--oscuro" aria-hidden="true" />
                      <span className="vacio-tit">Buscando OP…</span>
                    </div>
                  )}

                  {!cargando && visibles.length === 0 && !error && (
                    <div className="vacio">
                      <span className="vacio-ic">
                        <i className="fa-solid fa-inbox" aria-hidden="true" />
                      </span>
                      <span className="vacio-tit">No hay OP que coincidan</span>
                      <span className="vacio-det">
                        Probá quitando filtros o buscando por otro número.
                      </span>
                    </div>
                  )}

                  {!cargando &&
                    visibles.map((op) => {
                      const marcada = seleccion.includes(op.id)
                      const desplegada = abierta === op.id
                      return (
                        <div key={op.id} className={`opfila${marcada ? ' opfila--sel' : ''}`}>
                          <div className="opfila-head">
                            <button
                              type="button"
                              aria-pressed={marcada}
                              className="opfila-marca"
                              onClick={() => alternar(op)}
                            >
                              <span className={`trow-check${marcada ? ' trow-check--sel' : ''}`}>
                                {marcada && <i className="fa-solid fa-check" aria-hidden="true" />}
                              </span>
                              <span className="opfila-nom">{op.nombre}</span>
                            </button>

                            <span className="opfila-chips">
                              <EtiquetasOP op={op} conEta />
                            </span>

                            <button
                              type="button"
                              className="btn btn--texto btn--chico opfila-ver"
                              aria-expanded={desplegada}
                              onClick={() => setAbierta(desplegada ? null : op.id)}
                            >
                              <i
                                className={`fa-solid fa-chevron-${desplegada ? 'up' : 'down'}`}
                                aria-hidden="true"
                              />{' '}
                              {desplegada ? 'Ocultar' : 'Ver datos'}
                            </button>
                          </div>

                          {desplegada && (
                            <div className="opfila-cuerpo">
                              <FichaOP op={op} />
                            </div>
                          )}
                        </div>
                      )
                    })}
                </div>
              </div>
            </>
          )}

          {/* ---------------- Paso 2 · Edición ---------------- */}
          {etapa === 'edicion' && (
            <>
              <div className="sec-head">
                <span className="sec-num">2</span>
                <span className="sec-txt">
                  <span className="sec-tit">Novedades de cada OP</span>
                  <span className="sec-det">
                    Cada campo viene con lo que hay hoy en monday. Lo que no toques queda como
                    está: sólo se guarda lo que cambies.
                  </span>
                </span>
              </div>

              {sinCambios.length > 0 && (
                <div className="aviso aviso--alerta">
                  <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
                  <span>
                    <b>
                      {sinCambios.length === 1
                        ? 'Hay 1 OP sin editar.'
                        : `Hay ${sinCambios.length} OP sin editar.`}
                    </b>{' '}
                    Cargales alguna novedad o quitalas de la selección para poder continuar:
                    <span className="aviso-chips">
                      {sinCambios.map((op) => (
                        <button
                          key={op.id}
                          type="button"
                          className="chip chip--boton chip--ambar"
                          onClick={() => quitar(op.id)}
                        >
                          {op.nombre} <i className="fa-solid fa-xmark" aria-hidden="true" />
                        </button>
                      ))}
                    </span>
                  </span>
                </div>
              )}

              <div className="op-editores">
                {elegidas.map((op) => (
                  <EditorOP
                    key={op.id}
                    op={op}
                    edicion={ediciones[op.id] ?? valoresActuales(op)}
                    cambios={cambiosPorOp.get(op.id) ?? []}
                    onCambiar={(edicion) => setEdiciones((a) => ({ ...a, [op.id]: edicion }))}
                    onDeshacer={() =>
                      setEdiciones((a) => ({ ...a, [op.id]: valoresActuales(op) }))
                    }
                    onQuitar={() => quitar(op.id)}
                  />
                ))}
              </div>
            </>
          )}

          {/* ---------------- Paso 3 · Resumen ---------------- */}
          {etapa === 'resumen' && (
            <>
              <div className="sec-head">
                <span className="sec-num">3</span>
                <span className="sec-txt">
                  <span className="sec-tit">Resumen de los cambios</span>
                  <span className="sec-det">
                    Esto es lo que se va a escribir en monday. Lo que no aparece acá queda tal cual
                    está.
                  </span>
                </span>
              </div>

              <div className="op-editores">
                {elegidas.map((op) => {
                  const cambios = cambiosPorOp.get(op.id) ?? []
                  return (
                    <div key={op.id} className="card card--flush">
                      <div className="ctitle op-editor-head">
                        <span className="op-editor-nom">
                          <i className="fa-solid fa-file-lines" aria-hidden="true" /> {op.nombre}
                        </span>
                        <span className="op-editor-chips">
                          <EtiquetasOP op={op} />
                          <span className="chip chip--verde">
                            {cambios.length} cambio{cambios.length === 1 ? '' : 's'}
                          </span>
                        </span>
                      </div>
                      <ul className="cambios">
                        {cambios.map((c) => (
                          <li key={c.campo} className="cambio">
                            <span className="cambio-campo">{c.rotulo}</span>
                            <span className="cambio-antes">{c.antes}</span>
                            <i className="fa-solid fa-arrow-right-long" aria-hidden="true" />
                            <span className="cambio-despues">{c.despues}</span>
                          </li>
                        ))}
                      </ul>
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
            {elegidas.length} OP seleccionada{elegidas.length === 1 ? '' : 's'}
          </span>
          <span className="xs">
            {totalCambios === 0
              ? 'Todavía no hay cambios cargados'
              : `${totalCambios} campo${totalCambios === 1 ? '' : 's'} por actualizar`}
          </span>
        </div>

        <div className="pie-acciones">
          {etapa !== 'seleccion' && (
            <button
              type="button"
              className="btn btn--texto"
              disabled={enviando}
              onClick={() => setEtapa(etapa === 'resumen' ? 'edicion' : 'seleccion')}
            >
              <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Volver
            </button>
          )}

          {etapa === 'seleccion' && (
            <button
              type="button"
              className="btn btn--primario"
              disabled={elegidas.length === 0}
              onClick={() => {
                setErrorEnvio(null)
                setEtapa('edicion')
              }}
            >
              Continuar <i className="fa-solid fa-arrow-right" aria-hidden="true" />
            </button>
          )}

          {etapa === 'edicion' && (
            <button
              type="button"
              className="btn btn--primario"
              /* No se puede seguir con una OP sin editar: o se le carga algo, o se saca. Guardarla
                 igual escribiría una actualización vacía y la dejaría "tocada" sin novedades. */
              disabled={elegidas.length === 0 || sinCambios.length > 0}
              onClick={() => setEtapa('resumen')}
            >
              Ver resumen <i className="fa-solid fa-arrow-right" aria-hidden="true" />
            </button>
          )}

          {etapa === 'resumen' && (
            <button
              type="button"
              className="btn btn--marca"
              disabled={enviando || totalCambios === 0}
              onClick={() => void guardar()}
            >
              {enviando ? (
                <>
                  <span className="spin" aria-hidden="true" /> Guardando en monday…
                </>
              ) : (
                <>
                  <i className="fa-solid fa-cloud-arrow-up" aria-hidden="true" /> Guardar cambios
                </>
              )}
            </button>
          )}
        </div>
      </footer>
    </>
  )
}
