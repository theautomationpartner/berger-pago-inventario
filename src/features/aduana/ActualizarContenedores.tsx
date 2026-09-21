import { useCallback, useEffect, useMemo, useState } from 'react'
import { SelectorUbicacion } from '@/components/ui/SelectorUbicacion'
import { fechaCorta, hoyISO } from '@/lib/format'
import {
  ESTADO_ARRIBO,
  ESTADOS_CON_ARRIBO,
  URL_TABLERO_CONTENEDORES,
} from '@/services/monday/columns'
import {
  actualizarContenedor,
  contenedoresDelTablero,
  listarTransportistas,
} from '@/services/monday/contenedoresDespacho'
import { SinAcceso } from '@/services/monday/sdk'
import type { Contacto, ContenedorDespacho, EdicionContenedor } from '@/types'

const mensaje = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/** Lo que falta cargarle a un contenedor. Es lo que decide si aparece en la lista de pendientes. */
const pendienteDeArribo = (c: ContenedorDespacho): boolean =>
  c.estadoArribo !== ESTADO_ARRIBO.ARRIBADO
const sinUbicacion = (c: ContenedorDespacho): boolean => !c.ubicacion.trim()

/**
 * ¿La carga de este contenedor ya llegó o está por llegar?
 *
 * Antes de "Próxima a Arribar" la mercadería todavía está navegando: marcar un arribo ahí sería
 * anotar un hecho que no pasó. El estado se lee del espejo de la OP, que el contenedor trae por su
 * conexión a nivel item.
 */
const enEtapaDeArribo = (c: ContenedorDespacho): boolean =>
  ESTADOS_CON_ARRIBO.some((estado) => c.estadoCargaOp.includes(estado))

/** Busca por cualquiera de los nombres con los que se llama a un contenedor. */
const coincide = (c: ContenedorDespacho, busqueda: string): boolean => {
  const texto = busqueda.trim().toLowerCase()
  if (!texto) return true
  return [c.numero, c.nombre, c.nroOpDespachante, c.idOp, c.chasis]
    .filter(Boolean)
    .some((campo) => campo.toLowerCase().includes(texto))
}

/**
 * Actualizar Contenedores · BERGER S.A.
 *
 * Cuando la carga llega, el trabajo deja de ser por OP y pasa a ser **por contenedor**: un camión
 * llega y se descarga de a uno, con su propia entrega y su propio arribo. Por eso esta pantalla
 * entra por el tablero de 🚚Contenedores y no por la OP.
 *
 * Dos cosas por contenedor, que son las dos que se resuelven en el momento:
 *
 * - **Marcarlo como arribado** (`color_mm7ar9rc`).
 * - **Cargarle la ubicación de entrega** (`location_mm7a16dx`), y de paso el transportista.
 *
 * Por defecto muestra sólo los **pendientes**: los de una OP que ya está por llegar o nacionalizada
 * a los que les falta el arribo o la entrega. Lo demás está a un clic, porque corregir algo ya
 * cargado es tan legítimo como cargarlo la primera vez.
 */
export function ActualizarContenedores() {
  const [contenedores, setContenedores] = useState<ContenedorDespacho[]>([])
  const [contactos, setContactos] = useState<Contacto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [busqueda, setBusqueda] = useState('')
  const [soloPendientes, setSoloPendientes] = useState(true)
  const [ediciones, setEdiciones] = useState<Record<string, EdicionContenedor>>({})

  const [guardando, setGuardando] = useState<string | null>(null)
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)
  const [guardados, setGuardados] = useState<string[]>([])

  const recargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      setContenedores(await contenedoresDelTablero())
    } catch (e) {
      setContenedores([])
      setError(
        e instanceof SinAcceso
          ? 'la app tiene que abrirse desde monday para leer el tablero.'
          : mensaje(e),
      )
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void recargar()
  }, [recargar])

  useEffect(() => {
    listarTransportistas()
      .then(setContactos)
      .catch(() => setContactos([]))
  }, [])

  /** Los que esperan algo: de una OP en etapa de arribo, sin arribo marcado o sin entrega. */
  const pendientes = useMemo(
    () =>
      contenedores.filter((c) => enEtapaDeArribo(c) && (pendienteDeArribo(c) || sinUbicacion(c))),
    [contenedores],
  )

  const visibles = useMemo(
    () => (soloPendientes ? pendientes : contenedores).filter((c) => coincide(c, busqueda)),
    [soloPendientes, pendientes, contenedores, busqueda],
  )

  const edicionDe = (c: ContenedorDespacho): EdicionContenedor =>
    ediciones[c.id] ?? {
      ubicacion: c.ubicacion,
      coordenadas: c.coordenadas,
      transportistaId: c.transportistaId,
      estadoArribo: c.estadoArribo,
      fechaArribo: c.fechaArribo,
    }

  const cambiar = (c: ContenedorDespacho, cambio: Partial<EdicionContenedor>) =>
    setEdiciones((a) => ({ ...a, [c.id]: { ...edicionDe(c), ...cambio } }))

  /** Qué cambió respecto de lo que hay en monday. Sólo eso viaja. */
  const cambiosDe = (c: ContenedorDespacho): Partial<EdicionContenedor> => {
    const e = ediciones[c.id]
    if (!e) return {}
    const parcial: Partial<EdicionContenedor> = {}
    if ((e.ubicacion ?? '') !== (c.ubicacion ?? '')) {
      parcial.ubicacion = e.ubicacion
      parcial.coordenadas = e.coordenadas ?? null
    }
    if ((e.transportistaId ?? null) !== (c.transportistaId ?? null)) {
      parcial.transportistaId = e.transportistaId ?? null
    }
    if ((e.estadoArribo ?? '') !== (c.estadoArribo ?? '')) parcial.estadoArribo = e.estadoArribo
    if ((e.fechaArribo ?? '') !== (c.fechaArribo ?? '')) parcial.fechaArribo = e.fechaArribo
    return parcial
  }

  const guardar = async (c: ContenedorDespacho) => {
    const cambios = cambiosDe(c)
    if (Object.keys(cambios).length === 0) return

    setGuardando(c.id)
    setErrorGuardar(null)
    try {
      await actualizarContenedor(c.id, cambios)
      setGuardados((a) => [...a, c.id])
      /* Se actualiza la fila en memoria en vez de recargar el tablero entero: el resto de lo que
         está en pantalla no cambió, y recargar haría desaparecer de golpe el que se acaba de
         completar. Sale de la lista recién cuando la persona recarga. */
      setContenedores((a) =>
        a.map((x) =>
          x.id === c.id
            ? {
                ...x,
                ubicacion: cambios.ubicacion ?? x.ubicacion,
                coordenadas:
                  cambios.ubicacion !== undefined ? (cambios.coordenadas ?? null) : x.coordenadas,
                estadoArribo: cambios.estadoArribo ?? x.estadoArribo,
                fechaArribo: cambios.fechaArribo ?? x.fechaArribo,
                transportistaId:
                  cambios.transportistaId !== undefined
                    ? cambios.transportistaId
                    : x.transportistaId,
                transportista: cambios.transportistaId
                  ? (contactos.find((k) => k.id === cambios.transportistaId)?.nombre ??
                    x.transportista)
                  : x.transportista,
              }
            : x,
        ),
      )
      setEdiciones((a) => {
        const { [c.id]: _, ...resto } = a
        return resto
      })
    } catch (e) {
      setErrorGuardar(`No se pudo guardar ${c.numero || c.nombre}: ${mensaje(e)}`)
    } finally {
      setGuardando(null)
    }
  }

  return (
    <div className="scroll">
      <div className="view">
        <div className="sec-head">
          <span className="sec-num">
            <i className="fa-solid fa-truck-ramp-box" aria-hidden="true" />
          </span>
          <span className="sec-txt">
            <span className="sec-tit">Contenedores</span>
            <span className="sec-det">
              Marcá los que ya llegaron y cargales la ubicación de entrega. Se muestran los de las
              OP <b>próximas a arribar</b> y <b>nacionalizadas</b> a las que todavía les falta algo.
            </span>
          </span>
        </div>

        {error && (
          <div className="aviso aviso--error">
            <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
            <span>
              No se pudo leer el tablero de Contenedores: {error}{' '}
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

        {errorGuardar && (
          <div className="aviso aviso--error">
            <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
            <span>{errorGuardar}</span>
          </div>
        )}

        <div className="filtros">
          <div className="filtros-fila">
            <label className="campo campo--busqueda">
              <span className="campo-lbl">Buscar</span>
              <input
                className="input"
                value={busqueda}
                placeholder="N° de contenedor, N° de OP, ID del despacho o chasis…"
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </label>
          </div>

          <div className="filtros-tags">
            <button
              type="button"
              aria-pressed={soloPendientes}
              className={`chip chip--boton chip--ambar${soloPendientes ? ' chip--activo' : ''}`}
              onClick={() => setSoloPendientes(true)}
            >
              Pendientes ({pendientes.length})
            </button>
            <button
              type="button"
              aria-pressed={!soloPendientes}
              className={`chip chip--boton chip--azul${!soloPendientes ? ' chip--activo' : ''}`}
              onClick={() => setSoloPendientes(false)}
            >
              Todos ({contenedores.length})
            </button>
          </div>

          <span className="filtros-nota filtros-nota--sola">
            <i className="fa-solid fa-rotate" aria-hidden="true" />
            {visibles.length} contenedor{visibles.length === 1 ? '' : 'es'} en pantalla
            <button
              type="button"
              className="btn btn--borde btn--chico"
              onClick={() => void recargar()}
            >
              Actualizar
            </button>
          </span>
        </div>

        {cargando && (
          <div className="vacio">
            <span className="spin spin--oscuro" aria-hidden="true" />
            <span className="vacio-tit">Leyendo los contenedores…</span>
          </div>
        )}

        {!cargando && !error && visibles.length === 0 && (
          <div className="vacio">
            <span className="vacio-ic">
              <i className="fa-solid fa-circle-check" aria-hidden="true" />
            </span>
            <span className="vacio-tit">
              {soloPendientes ? 'No hay contenedores pendientes' : 'No hay contenedores'}
            </span>
            <span className="vacio-det">
              {soloPendientes
                ? 'Los de las OP por llegar ya tienen su arribo y su entrega cargados.'
                : 'El despachante todavía no armó ningún contenedor.'}
            </span>
          </div>
        )}

        <div className="op-editores">
          {visibles.map((c) => {
            const e = edicionDe(c)
            const cambios = Object.keys(cambiosDe(c)).length > 0
            const arribado = e.estadoArribo === ESTADO_ARRIBO.ARRIBADO
            const guardado = guardados.includes(c.id)
            return (
              <div key={c.id} className="card card--flush op-editor">
                <div className="ctitle op-editor-head">
                  <span className="op-editor-nom">
                    <i className="fa-solid fa-box" aria-hidden="true" /> {c.numero || c.nombre}
                  </span>
                  <span className="op-editor-chips">
                    {c.numero && c.nombre !== c.numero && (
                      <span className="chip chip--indigo">{c.nombre}</span>
                    )}
                    {c.idOp && <span className="chip chip--teal">{c.idOp}</span>}
                    {c.nroOpDespachante && (
                      <span className="chip chip--magenta">OP {c.nroOpDespachante}</span>
                    )}
                    {c.estadoCargaOp && <span className="chip chip--azul">{c.estadoCargaOp}</span>}
                    <span className={`chip ${arribado ? 'chip--verde' : 'chip--ambar'}`}>
                      {e.estadoArribo || 'Sin estado de arribo'}
                    </span>
                    {guardado && !cambios && (
                      <span className="chip chip--verde">
                        <i className="fa-solid fa-check" aria-hidden="true" /> Guardado
                      </span>
                    )}
                  </span>
                </div>

                <div className="op-editor-cuerpo">
                  <div className="opfila-chips" style={{ marginBottom: 10 }}>
                    {c.chasis
                      .split(',')
                      .map((x) => x.trim())
                      .filter(Boolean)
                      .map((chasis) => (
                        <span key={chasis} className="chasis chasis--chico">
                          {chasis}
                        </span>
                      ))}
                    {c.fechaCreacion && (
                      <span className="chip chip--violeta">
                        Armado {fechaCorta(c.fechaCreacion)}
                      </span>
                    )}
                    {c.transportista && <span className="chip chip--lima">{c.transportista}</span>}
                  </div>

                  {/* El arribo es un interruptor y no un desplegable: es la acción del día, y tiene
                      que ser un solo toque. */}
                  <div className="decision">
                    <button
                      type="button"
                      aria-pressed={arribado}
                      className={`opcion opcion--confirmar${arribado ? ' opcion--elegida' : ''}`}
                      onClick={() =>
                        /* Al marcar el arribo se propone HOY, que es lo que pasa el 95% de las
                           veces: se marca el día que llega. Queda editable justo abajo para el
                           otro 5%, el contenedor que llegó el viernes y se marca el lunes. */
                        cambiar(
                          c,
                          arribado
                            ? { estadoArribo: ESTADO_ARRIBO.PENDIENTE, fechaArribo: '' }
                            : {
                                estadoArribo: ESTADO_ARRIBO.ARRIBADO,
                                fechaArribo: e.fechaArribo || hoyISO(),
                              },
                        )
                      }
                    >
                      <span className="opcion-ic">
                        <i
                          className={`fa-solid ${arribado ? 'fa-circle-check' : 'fa-circle'}`}
                          aria-hidden="true"
                        />
                      </span>
                      <span className="opcion-txt">
                        <span className="opcion-tit">
                          {arribado ? 'Arribado' : 'Marcar como arribado'}
                        </span>
                        <span className="opcion-det">
                          {arribado
                            ? 'Tocá de nuevo si te equivocaste'
                            : 'El contenedor ya llegó a destino'}
                        </span>
                      </span>
                    </button>
                  </div>

                  {arribado && (
                    <div className="arribo-fecha">
                      <label className="campo campo--chico">
                        <span className="campo-lbl">Fecha de arribo</span>
                        <input
                          className="input"
                          type="date"
                          value={e.fechaArribo ?? ''}
                          max={hoyISO()}
                          onChange={(ev) => cambiar(c, { fechaArribo: ev.target.value })}
                        />
                      </label>
                      <span className="arribo-nota">
                        {(e.fechaArribo ?? '') === hoyISO() ? (
                          <>
                            <i className="fa-solid fa-circle-info" aria-hidden="true" /> Se va a
                            guardar con la fecha de <b>hoy</b>. Si llegó antes y recién ahora lo
                            marcás, cambiála.
                          </>
                        ) : e.fechaArribo ? (
                          <>
                            <i className="fa-solid fa-calendar-check" aria-hidden="true" /> Llegó el{' '}
                            <b>{fechaCorta(e.fechaArribo)}</b>, no hoy.
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> Va
                            a quedar arribado sin fecha.
                          </>
                        )}
                      </span>
                    </div>
                  )}

                  <div className="datos datos--form" style={{ marginTop: 12 }}>
                    <div className="campo">
                      <span className="campo-lbl">
                        Ubicación de entrega {sinUbicacion(c) && '· pendiente'}
                      </span>
                      <SelectorUbicacion
                        valor={e.ubicacion}
                        coordenadas={e.coordenadas}
                        direccionGuardada={c.ubicacion}
                        onCambiar={(direccion, coordenadas) =>
                          cambiar(c, { ubicacion: direccion, coordenadas })
                        }
                      />
                    </div>

                    <label className="campo">
                      <span className="campo-lbl">Transportista</span>
                      <select
                        className="select"
                        value={e.transportistaId ?? ''}
                        onChange={(ev) => cambiar(c, { transportistaId: ev.target.value || null })}
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
                    </label>
                  </div>

                  <div className="op-editor-acciones">
                    <a
                      className="btn btn--texto btn--chico"
                      href={`${URL_TABLERO_CONTENEDORES}/pulses/${c.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />{' '}
                      Ver en monday
                    </a>
                    <button
                      type="button"
                      className="btn btn--marca btn--chico"
                      disabled={!cambios || guardando === c.id}
                      onClick={() => void guardar(c)}
                    >
                      {guardando === c.id ? (
                        <>
                          <span className="spin" aria-hidden="true" /> Guardando…
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-cloud-arrow-up" aria-hidden="true" /> Guardar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
