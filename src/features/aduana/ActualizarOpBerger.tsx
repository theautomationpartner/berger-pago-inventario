import { useCallback, useEffect, useMemo, useState } from 'react'
import { Stepper } from '@/components/ui/Stepper'
import { fechaCorta } from '@/lib/format'
import {
  BANCO_DECLARAR,
  ESTADO_PAGO_VEP,
  FONDEO,
  FORMA_PAGO_OP,
  PROXIMA_A_ARRIBAR,
  URL_TABLERO_CONTENEDORES,
  URL_TABLERO_DESPACHANTE,
  VEP_POR_DONDE,
} from '@/services/monday/columns'
import {
  actualizarContenedor,
  contenedoresDeOp,
  listarContactos,
  tractoresDeOps,
} from '@/services/monday/contenedoresDespacho'
import { actualizarOpBerger } from '@/services/monday/despachos'
import type {
  Contacto,
  ContenedorDespacho,
  DespachoOP,
  EdicionBerger,
  EdicionContenedor,
  EtapaBerger,
  TractorDeOp,
} from '@/types'
import { EtiquetasOP } from './EtiquetasOP'
import { useDespachos } from './useDespachos'

const mensaje = (e: unknown): string => (e instanceof Error ? e.message : String(e))

const valoresBerger = (op: DespachoOP): EdicionBerger => ({
  formaPago: op.formaPago,
  fondeo: op.fondeo,
  bancoDeclarar: op.bancoDeclarar,
  vepPorDonde: op.vepPorDonde,
  estadoPagoVep: op.estadoPagoVep,
})

/** Un `<select>` con las etiquetas del tablero y la opción de dejarlo vacío. */
function Selector({
  rotulo,
  valor,
  opciones,
  onCambiar,
}: {
  rotulo: string
  valor: string
  opciones: readonly string[]
  onCambiar: (v: string) => void
}) {
  return (
    <label className="campo">
      <span className="campo-lbl">{rotulo}</span>
      <select className="select" value={valor} onChange={(e) => onCambiar(e.target.value)}>
        <option value="">(sin definir)</option>
        {opciones.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  )
}

/**
 * Actualizar OP · BERGER S.A.
 *
 * El otro lado de "Próxima a Arribar". Cuando el despachante marca ese estado, BERGER recibe el
 * aviso y tiene que definir cómo se paga y cómo se entrega. Esta operación es exactamente ese
 * trabajo, y por eso **sólo muestra las OP en ese estado**: antes no hay nada que decidir, y
 * después ya se decidió.
 *
 * Son dos cosas en la misma pantalla porque se deciden juntas:
 *
 * - De la **OP**: forma de pago, fondeo, banco a declarar, por dónde va el VEP y si ya se pagó.
 * - De **cada contenedor**: el transportista y la ubicación de entrega. Van en el contenedor y no
 *   en la OP porque cada uno puede ir a un lugar distinto y con un transportista distinto.
 *
 * Se puede completar sólo una parte: nada obliga a llenar todo de una vez, porque el banco suele
 * definirse antes que el transporte.
 */
export function ActualizarOpBerger() {
  const { despachos, cargando, error, recargar } = useDespachos()

  const [busqueda, setBusqueda] = useState('')
  /** Tractores de las OP listadas: hacen falta para poder buscar por tractor o por modelo. */
  const [tractoresPorOp, setTractoresPorOp] = useState<Record<string, TractorDeOp[]>>({})

  const [etapa, setEtapa] = useState<EtapaBerger>('seleccion')
  const [elegidaId, setElegidaId] = useState<string | null>(null)
  const [edicion, setEdicion] = useState<EdicionBerger | null>(null)
  const [contenedores, setContenedores] = useState<ContenedorDespacho[]>([])
  const [tractores, setTractores] = useState<TractorDeOp[]>([])
  const [ediciones, setEdiciones] = useState<Record<string, EdicionContenedor>>({})
  const [contactos, setContactos] = useState<Contacto[]>([])
  const [cargandoDetalle, setCargandoDetalle] = useState(false)

  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [resultado, setResultado] = useState<{ nombre: string; advertencias: string[] } | null>(
    null,
  )

  /* Sólo las que están por llegar: es el momento en que BERGER tiene que definir estos datos. */
  const porLlegar = useMemo(
    () => despachos.filter((op) => op.estadoCarga === PROXIMA_A_ARRIBAR),
    [despachos],
  )
  const elegida = porLlegar.find((op) => op.id === elegidaId) ?? null

  /* Los tractores de todas las OP listadas, en UNA consulta. Se traen para que la búsqueda pueda
     mirar también adentro: quien busca una carga suele acordarse del tractor, no del N° de OP. */
  useEffect(() => {
    if (porLlegar.length === 0) return
    tractoresDeOps(porLlegar.map((op) => op.id))
      .then((porOp) => setTractoresPorOp(Object.fromEntries(porOp)))
      .catch(() => setTractoresPorOp({}))
  }, [porLlegar])

  /** Busca por N° de OP del despachante, nombre de la OP, y nombre o modelo de sus tractores. */
  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    if (!texto) return porLlegar
    return porLlegar.filter((op) => {
      const tractores = tractoresPorOp[op.id] ?? []
      return [
        op.nombre,
        op.nroOp,
        op.idDespacho,
        ...tractores.map((t) => t.nombre),
        ...tractores.map((t) => t.modelo),
      ]
        .filter(Boolean)
        .some((campo) => campo.toLowerCase().includes(texto))
    })
  }, [porLlegar, busqueda, tractoresPorOp])

  const cargarDetalle = useCallback(async (op: DespachoOP) => {
    setCargandoDetalle(true)
    try {
      const porOp = await tractoresDeOps([op.id])
      const lista = porOp.get(op.id) ?? []
      setTractores(lista)
      const conts = await contenedoresDeOp(lista)
      setContenedores(conts)
      setEdiciones(
        Object.fromEntries(
          conts.map((c) => [c.id, { ubicacion: c.ubicacion, transportistaId: null }]),
        ),
      )
    } catch (e) {
      setErrorEnvio(`No se pudieron leer los contenedores: ${mensaje(e)}`)
    } finally {
      setCargandoDetalle(false)
    }
  }, [])

  // Los contactos se piden una sola vez: es la lista de transportistas y cambia cada tanto.
  useEffect(() => {
    listarContactos()
      .then(setContactos)
      .catch(() => setContactos([]))
  }, [])

  const abrir = (op: DespachoOP) => {
    setElegidaId(op.id)
    setEdicion(valoresBerger(op))
    setErrorEnvio(null)
    setEtapa('edicion')
    void cargarDetalle(op)
  }

  const reiniciar = () => {
    setElegidaId(null)
    setEdicion(null)
    setContenedores([])
    setTractores([])
    setEdiciones({})
    setResultado(null)
    setErrorEnvio(null)
    setEtapa('seleccion')
    void recargar()
  }

  /** Lo que cambió de la OP respecto de lo que hay en monday. */
  const cambiosDeOp = (): Partial<EdicionBerger> => {
    if (!elegida || !edicion) return {}
    const actual = valoresBerger(elegida)
    const parcial: Partial<EdicionBerger> = {}
    for (const campo of Object.keys(actual) as (keyof EdicionBerger)[]) {
      if ((edicion[campo] ?? '') !== (actual[campo] ?? '')) parcial[campo] = edicion[campo]
    }
    return parcial
  }

  /** Lo que cambió de cada contenedor. */
  const cambiosDeContenedor = (c: ContenedorDespacho): Partial<EdicionContenedor> => {
    const e = ediciones[c.id]
    if (!e) return {}
    const parcial: Partial<EdicionContenedor> = {}
    if ((e.ubicacion ?? '') !== (c.ubicacion ?? '')) parcial.ubicacion = e.ubicacion
    if (e.transportistaId) parcial.transportistaId = e.transportistaId
    return parcial
  }

  const hayCambios =
    Object.keys(cambiosDeOp()).length > 0 ||
    contenedores.some((c) => Object.keys(cambiosDeContenedor(c)).length > 0)

  const guardar = async () => {
    if (!elegida) return
    setEnviando(true)
    setErrorEnvio(null)
    const advertencias: string[] = []

    const cambios = cambiosDeOp()
    if (Object.keys(cambios).length > 0) {
      try {
        await actualizarOpBerger(elegida.id, cambios)
      } catch (e) {
        advertencias.push(`No se pudo actualizar la OP: ${mensaje(e)}`)
      }
    }

    /* Los contenedores, uno por uno: si el tercero falla, los dos anteriores ya quedaron bien. */
    for (const c of contenedores) {
      const cambio = cambiosDeContenedor(c)
      if (Object.keys(cambio).length === 0) continue
      try {
        await actualizarContenedor(c.id, cambio)
      } catch (e) {
        advertencias.push(
          `No se pudo actualizar el contenedor ${c.numero || c.nombre}: ${mensaje(e)}`,
        )
      }
    }

    setEnviando(false)
    if (advertencias.length > 0 && Object.keys(cambios).length === 0) {
      setErrorEnvio(advertencias.join(' · '))
      return
    }
    setResultado({ nombre: elegida.nombre, advertencias })
    setEtapa('listo')
  }

  /* ------------------------------------------------------------------ */
  if (etapa === 'listo' && resultado) {
    const conProblemas = resultado.advertencias.length > 0
    return (
      <div className="scroll">
        <div className="view">
          <Stepper variante="berger" actual="listo" />

          {conProblemas && (
            <div className="aviso aviso--alerta">
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
              <span>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
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
            <span className="final-tit">OP actualizada</span>
            <span className="final-det">
              Se guardaron los datos de <b>{resultado.nombre}</b> y de sus contenedores.
            </span>

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
            variante="berger"
            actual={etapa}
            onIr={enviando ? undefined : (e) => setEtapa(e as EtapaBerger)}
          />

          {errorEnvio && (
            <div className="aviso aviso--error">
              <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
              <span>{errorEnvio}</span>
            </div>
          )}

          {etapa === 'seleccion' && (
            <>
              <div className="sec-head">
                <span className="sec-num">1</span>
                <span className="sec-txt">
                  <span className="sec-tit">OP próximas a arribar</span>
                  <span className="sec-det">
                    Las que el despachante marcó como <b>{PROXIMA_A_ARRIBAR}</b>: son las que
                    esperan que BERGER defina pago, banco y entrega.
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
                      placeholder="N° de OP, nombre, tractor o modelo…"
                      onChange={(e) => setBusqueda(e.target.value)}
                    />
                  </label>
                </div>
                <span className="filtros-nota filtros-nota--sola">
                  <i className="fa-solid fa-anchor" aria-hidden="true" />
                  {visibles.length} de {porLlegar.length} OP próximas a arribar
                </span>
              </div>

              <div className="lista">
                <div className="lista-head">
                  <span>Orden de pago</span>
                  <span className="lista-head-acciones">
                    <button
                      type="button"
                      className="btn btn--borde btn--chico"
                      onClick={() => void recargar()}
                    >
                      <i className="fa-solid fa-rotate" aria-hidden="true" /> Actualizar
                    </button>
                  </span>
                </div>

                <div className="lista-body">
                  {cargando && (
                    <div className="vacio">
                      <span className="spin spin--oscuro" aria-hidden="true" />
                      <span className="vacio-tit">Buscando OP…</span>
                    </div>
                  )}

                  {!cargando && !error && visibles.length === 0 && porLlegar.length > 0 && (
                    <div className="vacio">
                      <span className="vacio-ic">
                        <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
                      </span>
                      <span className="vacio-tit">Ninguna OP coincide con la búsqueda</span>
                      <span className="vacio-det">
                        Probá con el N° de OP, el nombre, o el modelo de alguno de sus tractores.
                      </span>
                    </div>
                  )}

                  {!cargando && !error && porLlegar.length === 0 && (
                    <div className="vacio">
                      <span className="vacio-ic">
                        <i className="fa-solid fa-anchor" aria-hidden="true" />
                      </span>
                      <span className="vacio-tit">No hay OP próximas a arribar</span>
                      <span className="vacio-det">
                        Cuando el despachante marque una carga como {PROXIMA_A_ARRIBAR}, aparece
                        acá.
                      </span>
                    </div>
                  )}

                  {!cargando &&
                    visibles.map((op) => (
                      <div key={op.id} className="opfila">
                        <div className="opfila-head">
                          <span className="opfila-nom">{op.nombre}</span>
                          <span className="opfila-chips">
                            <EtiquetasOP op={op} conEta />
                            <span
                              className={`chip ${
                                op.estadoPagoVep === ESTADO_PAGO_VEP.PAGADO
                                  ? 'chip--verde'
                                  : 'chip--rojo'
                              }`}
                            >
                              VEP {op.estadoPagoVep || 'sin estado'}
                            </span>
                            {(tractoresPorOp[op.id] ?? []).length > 0 && (
                              <span className="chip chip--indigo">
                                {(tractoresPorOp[op.id] ?? []).length} tractor
                                {(tractoresPorOp[op.id] ?? []).length === 1 ? '' : 'es'}
                              </span>
                            )}
                          </span>
                          <button
                            type="button"
                            className="btn btn--primario btn--chico opfila-ver"
                            onClick={() => abrir(op)}
                          >
                            <i className="fa-solid fa-pen-to-square" aria-hidden="true" /> Completar
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </>
          )}

          {etapa === 'edicion' && elegida && edicion && (
            <>
              <div className="sec-head">
                <span className="sec-num">2</span>
                <span className="sec-txt">
                  <span className="sec-tit">{elegida.nombre}</span>
                  <span className="sec-det">
                    Completá lo que ya esté definido. Lo que dejes sin tocar queda como está.
                  </span>
                </span>
              </div>

              <div className="card card--flush op-editor">
                <div className="ctitle op-editor-head">
                  <span className="op-editor-nom">
                    <i className="fa-solid fa-file-invoice-dollar" aria-hidden="true" /> Datos del
                    despacho
                  </span>
                  <span className="op-editor-chips">
                    <EtiquetasOP op={elegida} conEta />
                  </span>
                </div>

                <div className="op-editor-cuerpo">
                  <div className="datos datos--form">
                    <Selector
                      rotulo="Forma de pago"
                      valor={edicion.formaPago}
                      opciones={FORMA_PAGO_OP}
                      onCambiar={(v) => setEdicion({ ...edicion, formaPago: v })}
                    />
                    <Selector
                      rotulo="Fondeo"
                      valor={edicion.fondeo}
                      opciones={FONDEO}
                      onCambiar={(v) => setEdicion({ ...edicion, fondeo: v })}
                    />
                    <Selector
                      rotulo="Banco a declarar"
                      valor={edicion.bancoDeclarar}
                      opciones={BANCO_DECLARAR}
                      onCambiar={(v) => setEdicion({ ...edicion, bancoDeclarar: v })}
                    />
                    <Selector
                      rotulo="VEP por dónde"
                      valor={edicion.vepPorDonde}
                      opciones={VEP_POR_DONDE}
                      onCambiar={(v) => setEdicion({ ...edicion, vepPorDonde: v })}
                    />
                    <Selector
                      rotulo="Estado Pago VEP"
                      valor={edicion.estadoPagoVep}
                      opciones={[ESTADO_PAGO_VEP.NO_PAGADO, ESTADO_PAGO_VEP.PAGADO]}
                      onCambiar={(v) => setEdicion({ ...edicion, estadoPagoVep: v })}
                    />
                  </div>
                </div>
              </div>

              <div className="sec-head" style={{ marginTop: 18 }}>
                <span className="sec-num">
                  <i className="fa-solid fa-truck" aria-hidden="true" />
                </span>
                <span className="sec-txt">
                  <span className="sec-tit">Contenedores de esta OP</span>
                  <span className="sec-det">
                    Cada contenedor puede ir a un lugar distinto y con un transportista distinto,
                    así que se cargan de a uno.
                  </span>
                </span>
              </div>

              {cargandoDetalle && (
                <div className="vacio">
                  <span className="spin spin--oscuro" aria-hidden="true" />
                  <span className="vacio-tit">Leyendo los contenedores…</span>
                </div>
              )}

              {!cargandoDetalle && contenedores.length === 0 && (
                <div className="aviso aviso--alerta">
                  <i className="fa-solid fa-boxes-packing" aria-hidden="true" />
                  <span>
                    Esta OP todavía no tiene contenedores armados. Los arma el despachante desde su
                    operación; hasta entonces no hay dónde cargar transportista ni entrega.
                  </span>
                </div>
              )}

              <div className="op-editores">
                {contenedores.map((c) => {
                  const e = ediciones[c.id] ?? { ubicacion: c.ubicacion, transportistaId: null }
                  const dentro = tractores.filter((t) => t.contenedorId === c.id)
                  return (
                    <div key={c.id} className="card card--flush op-editor">
                      <div className="ctitle op-editor-head">
                        <span className="op-editor-nom">
                          <i className="fa-solid fa-box" aria-hidden="true" />{' '}
                          {c.numero || c.nombre}
                        </span>
                        <span className="op-editor-chips">
                          <span className="chip chip--indigo">
                            {dentro.length} tractor{dentro.length === 1 ? '' : 'es'}
                          </span>
                          {c.estadoArribo && (
                            <span className="chip chip--teal">{c.estadoArribo}</span>
                          )}
                          {c.fechaTurno && (
                            <span className="chip chip--azul">
                              Turno {fechaCorta(c.fechaTurno)}
                            </span>
                          )}
                          <a
                            className="btn btn--texto btn--chico"
                            href={`${URL_TABLERO_CONTENEDORES}/pulses/${c.id}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <i
                              className="fa-solid fa-arrow-up-right-from-square"
                              aria-hidden="true"
                            />{' '}
                            Ver
                          </a>
                        </span>
                      </div>

                      <div className="op-editor-cuerpo">
                        {dentro.length > 0 && (
                          <div className="tractores-cont" style={{ marginBottom: 12 }}>
                            {dentro.map((t) => (
                              <div key={t.id} className="tractor-fila tractor-fila--lectura">
                                <span className="chasis">{t.chasis || 'Sin chasis'}</span>
                                <span className="tractor-nom">{t.nombre}</span>
                                {t.modelo && <span className="chip chip--magenta">{t.modelo}</span>}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="datos datos--form">
                          <label className="campo">
                            <span className="campo-lbl">Ubicación de entrega</span>
                            <input
                              className="input"
                              value={e.ubicacion}
                              placeholder="Dirección o depósito"
                              onChange={(ev) =>
                                setEdiciones((a) => ({
                                  ...a,
                                  [c.id]: { ...e, ubicacion: ev.target.value },
                                }))
                              }
                            />
                          </label>

                          <label className="campo">
                            <span className="campo-lbl">Transportista</span>
                            <select
                              className="select"
                              value={e.transportistaId ?? ''}
                              onChange={(ev) =>
                                setEdiciones((a) => ({
                                  ...a,
                                  [c.id]: { ...e, transportistaId: ev.target.value || null },
                                }))
                              }
                            >
                              <option value="">
                                {c.transportista ? `Actual: ${c.transportista}` : '(sin asignar)'}
                              </option>
                              {contactos.map((x) => (
                                <option key={x.id} value={x.id}>
                                  {x.nombre}
                                </option>
                              ))}
                            </select>
                            {contactos.length === 0 && (
                              <span className="campo-ayuda">
                                No se pudieron leer los contactos. Podés cargarlo desde el tablero.
                              </span>
                            )}
                          </label>
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

      {etapa === 'edicion' && (
        <footer className="pie">
          <div className="pie-info">
            <span className="font-b">{elegida?.nombre}</span>
            <span className="xs">
              {hayCambios ? 'Hay cambios sin guardar' : 'Todavía no cambiaste nada'}
            </span>
          </div>

          <div className="pie-acciones">
            <button
              type="button"
              className="btn btn--texto"
              disabled={enviando}
              onClick={() => setEtapa('seleccion')}
            >
              <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Volver
            </button>
            <button
              type="button"
              className="btn btn--marca"
              disabled={!hayCambios || enviando}
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
          </div>
        </footer>
      )}
    </>
  )
}
