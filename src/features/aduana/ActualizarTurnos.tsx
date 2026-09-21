import { useCallback, useEffect, useMemo, useState } from 'react'
import { fechaCorta, hoyISO } from '@/lib/format'
import { URL_TABLERO_CONTENEDORES } from '@/services/monday/columns'
import { asignarTurnoDeCarga, contenedoresDelTablero } from '@/services/monday/contenedoresDespacho'
import { SinAcceso } from '@/services/monday/sdk'
import type { ContenedorDespacho, EdicionTurno } from '@/types'

const mensaje = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/** Un contenedor sin turno es uno que todavía no tiene camión citado. */
const sinTurno = (c: ContenedorDespacho): boolean => !c.fechaTurno

/**
 * ¿Hay a quién citar?
 *
 * El turno es una cita **con alguien**: se coordina con la empresa que va a mandar el camión. Sin
 * transportista asignado (`board_relation_mm7axy2m`) no hay con quién coordinar, y una fecha
 * cargada ahí es una fecha que nadie va a cumplir. Ese dato lo carga BERGER, no el despachante,
 * así que acá sólo se puede avisar.
 */
const tieneTransportista = (c: ContenedorDespacho): boolean => Boolean(c.transportistaId)

/** Busca por cualquiera de los nombres con los que se llama a un contenedor. */
const coincide = (c: ContenedorDespacho, busqueda: string): boolean => {
  const texto = busqueda.trim().toLowerCase()
  if (!texto) return true
  return [c.numero, c.nombre, c.nroOpDespachante, c.idOp, c.chasis, c.estadoCargaOp]
    .filter(Boolean)
    .some((campo) => campo.toLowerCase().includes(texto))
}

/**
 * Actualizar Fecha de Carga Contenedor · DESPACHANTE.
 *
 * El despachante es el que consigue el turno en la terminal, así que es el que lo carga. La
 * pantalla arranca mostrando **los que todavía no lo tienen**, que es exactamente su lista de
 * pendientes: cada contenedor sin turno es un camión que nadie citó.
 *
 * Fecha y hora se cargan **juntas y en una sola escritura**. Son el mismo dato: un turno "el
 * jueves" sin hora no le sirve a nadie, y dejarlas en dos pasos permitía guardar la mitad.
 *
 * Lo demás del contenedor se muestra pero no se toca: la ubicación de entrega y el transportista
 * son de BERGER, y el arribo se marca cuando la carga llega. Acá sólo se cita el camión.
 */
export function ActualizarTurnos() {
  const [contenedores, setContenedores] = useState<ContenedorDespacho[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [busqueda, setBusqueda] = useState('')
  const [soloPendientes, setSoloPendientes] = useState(true)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [turnos, setTurnos] = useState<Record<string, EdicionTurno>>({})

  const [guardando, setGuardando] = useState<string | null>(null)
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)
  const [guardados, setGuardados] = useState<string[]>([])

  const recargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      setContenedores(await contenedoresDelTablero('contenedoresDelTableroDespachante'))
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

  const pendientes = useMemo(() => contenedores.filter(sinTurno), [contenedores])

  const visibles = useMemo(
    () => (soloPendientes ? pendientes : contenedores).filter((c) => coincide(c, busqueda)),
    [soloPendientes, pendientes, contenedores, busqueda],
  )

  const turnoDe = (c: ContenedorDespacho): EdicionTurno =>
    turnos[c.id] ?? { fecha: c.fechaTurno, hora: c.horaTurno }

  const cambiar = (c: ContenedorDespacho, cambio: Partial<EdicionTurno>) =>
    setTurnos((a) => ({ ...a, [c.id]: { ...turnoDe(c), ...cambio } }))

  const guardar = async (c: ContenedorDespacho) => {
    const t = turnoDe(c)
    setGuardando(c.id)
    setErrorGuardar(null)
    try {
      await asignarTurnoDeCarga(c.id, t.fecha, t.hora)
      setGuardados((a) => [...a, c.id])
      /* La fila se actualiza en memoria en vez de recargar todo: el contenedor recién citado
         desaparecería de la lista de pendientes justo cuando se lo está mirando. */
      setContenedores((a) =>
        a.map((x) => (x.id === c.id ? { ...x, fechaTurno: t.fecha, horaTurno: t.hora } : x)),
      )
      setTurnos((a) => {
        const { [c.id]: _, ...resto } = a
        return resto
      })
    } catch (e) {
      setErrorGuardar(`No se pudo guardar el turno de ${c.numero || c.nombre}: ${mensaje(e)}`)
    } finally {
      setGuardando(null)
    }
  }

  return (
    <div className="scroll">
      <div className="view">
        <div className="sec-head">
          <span className="sec-num">
            <i className="fa-solid fa-calendar-day" aria-hidden="true" />
          </span>
          <span className="sec-txt">
            <span className="sec-tit">Fecha de carga de los contenedores</span>
            <span className="sec-det">
              Citá el camión de cada contenedor: día y hora del turno de carga. Se muestran primero
              los que todavía no tienen turno.
            </span>
          </span>
          <button
            type="button"
            className="btn btn--borde btn--chico"
            style={{ marginLeft: 'auto' }}
            disabled={cargando}
            onClick={() => void recargar()}
          >
            <i className={`fa-solid fa-rotate${cargando ? ' fa-spin' : ''}`} aria-hidden="true" />{' '}
            Actualizar
          </button>
        </div>

        <div className="filtros">
          <div className="filtros-fila">
            <label className="campo campo--busqueda">
              <span className="campo-lbl">Buscar</span>
              <input
                className="input"
                value={busqueda}
                placeholder="Buscar un contenedor…"
                onChange={(e) => setBusqueda(e.target.value)}
              />
              <span className="campo-ayuda campo-ayuda--ejemplo">
                N° de contenedor, N° de OP, chasis o estado de carga
              </span>
            </label>
          </div>
          <div className="filtros-fila">
            <button
              type="button"
              className={`chip chip--boton${soloPendientes ? ' chip--activo' : ''}`}
              onClick={() => setSoloPendientes(true)}
            >
              Sin turno ({pendientes.length})
            </button>
            <button
              type="button"
              className={`chip chip--boton${soloPendientes ? '' : ' chip--activo'}`}
              onClick={() => setSoloPendientes(false)}
            >
              Todos ({contenedores.length})
            </button>
          </div>
        </div>

        {error && (
          <div className="aviso aviso--error">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
            <span>No se pudieron leer los contenedores: {error}</span>
          </div>
        )}

        {errorGuardar && (
          <div className="aviso aviso--error">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
            <span>{errorGuardar}</span>
          </div>
        )}

        {cargando && (
          <div className="vacio">
            <span className="spin spin--oscuro" aria-hidden="true" />
            <span className="vacio-tit">Leyendo los contenedores…</span>
          </div>
        )}

        {!cargando && !error && visibles.length === 0 && (
          <div className="vacio">
            <span className="vacio-ic">
              <i className="fa-solid fa-calendar-check" aria-hidden="true" />
            </span>
            <span className="vacio-tit">
              {busqueda.trim()
                ? 'Ningún contenedor coincide con la búsqueda'
                : 'Todos los contenedores tienen turno'}
            </span>
            <span className="vacio-det">
              {busqueda.trim()
                ? 'Probá con el N° de contenedor, el de la OP o una matrícula.'
                : 'Cuando el despachante arme uno nuevo, va a aparecer acá.'}
            </span>
          </div>
        )}

        <div className="op-editores">
          {!cargando &&
            visibles.map((c) => {
              const t = turnoDe(c)
              const cambio = t.fecha !== c.fechaTurno || t.hora !== c.horaTurno
              const completo = Boolean(t.fecha && t.hora)
              const conTransportista = tieneTransportista(c)
              const guardado = guardados.includes(c.id)
              const desplegado = abierto === c.id

              return (
                <div key={c.id} className="card card--flush op-editor">
                  <div className="ctitle op-editor-head">
                    <span className="op-editor-nom">
                      <i className="fa-solid fa-box" aria-hidden="true" /> {c.nombre}
                    </span>
                    <span className="op-editor-chips">
                      {c.nroOpDespachante && (
                        <span className="chip chip--azul">OP {c.nroOpDespachante}</span>
                      )}
                      {c.estadoCargaOp && (
                        <span className="chip chip--teal">{c.estadoCargaOp}</span>
                      )}
                      {!conTransportista && (
                        <span className="chip chip--rojo">Sin transportista</span>
                      )}
                      {c.fechaTurno ? (
                        <span className="chip chip--verde">
                          Turno {fechaCorta(c.fechaTurno)}
                          {c.horaTurno ? ` ${c.horaTurno}` : ''}
                        </span>
                      ) : (
                        <span className="chip chip--ambar">Sin turno</span>
                      )}
                      {guardado && !cambio && (
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
                    </div>

                    {!conTransportista && (
                      <div className="aviso aviso--error" style={{ marginBottom: 10 }}>
                        <i className="fa-solid fa-truck-fast" aria-hidden="true" />
                        <span>
                          <b>Este contenedor todavía no tiene transportista asignado.</b> El turno
                          es una cita con alguien: hasta que Administración de BERGER S.A. no le
                          asocie el transportista, no hay con quién coordinar la carga. Pediles que
                          lo carguen y volvé a entrar.
                        </span>
                      </div>
                    )}

                    <div className="datos datos--form">
                      <label className="campo campo--chico">
                        <span className="campo-lbl">Fecha del turno</span>
                        <input
                          className="input"
                          type="date"
                          value={t.fecha}
                          disabled={!conTransportista}
                          onChange={(e) => cambiar(c, { fecha: e.target.value })}
                        />
                      </label>
                      <label className="campo campo--chico">
                        <span className="campo-lbl">Hora del turno</span>
                        <input
                          className="input"
                          type="time"
                          value={t.hora}
                          disabled={!conTransportista}
                          onChange={(e) => cambiar(c, { hora: e.target.value })}
                        />
                      </label>
                    </div>

                    {cambio && !completo && (
                      <span className="campo-ayuda campo-ayuda--falta">
                        <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> Hacen
                        falta las dos cosas: un turno sin hora no le sirve al transportista.
                      </span>
                    )}

                    {/* El detalle de la OP, plegado. Se abre cuando hace falta confirmar de qué
                        carga se trata, y el resto del tiempo no ocupa la pantalla. */}
                    <button
                      type="button"
                      className="btn btn--texto btn--chico"
                      onClick={() => setAbierto(desplegado ? null : c.id)}
                    >
                      <i
                        className={`fa-solid ${desplegado ? 'fa-chevron-up' : 'fa-chevron-down'}`}
                        aria-hidden="true"
                      />{' '}
                      {desplegado ? 'Ocultar el detalle' : 'Ver el detalle de la OP'}
                    </button>

                    {desplegado && (
                      <div className="datos datos--lectura" style={{ marginTop: 8 }}>
                        <Dato rotulo="N° de contenedor" valor={c.numero} />
                        <Dato rotulo="N° Op Despachante" valor={c.nroOpDespachante} />
                        <Dato rotulo="ID de la OP" valor={c.idOp} />
                        <Dato rotulo="Estado de carga" valor={c.estadoCargaOp} />
                        <Dato rotulo="Matrícula / chasis" valor={c.chasis} />
                        <Dato
                          rotulo="Armado el"
                          valor={c.fechaCreacion ? fechaCorta(c.fechaCreacion) : ''}
                        />
                        <Dato rotulo="Estado de arribo" valor={c.estadoArribo} />
                        <Dato
                          rotulo="Ubicación de entrega"
                          valor={c.ubicacion || 'La carga BERGER'}
                        />
                        <Dato rotulo="Patente del camión" valor={c.patente} />
                      </div>
                    )}

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
                        className="btn btn--primario btn--chico"
                        disabled={!cambio || !completo || !conTransportista || guardando === c.id}
                        onClick={() => void guardar(c)}
                      >
                        {guardando === c.id ? (
                          <>
                            <span className="spin" aria-hidden="true" /> Guardando…
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-calendar-day" aria-hidden="true" /> Guardar el
                            turno
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
        </div>

        {!cargando && visibles.length > 0 && (
          <span className="filtros-nota filtros-nota--sola">
            <i className="fa-solid fa-clock" aria-hidden="true" /> Hoy es {fechaCorta(hoyISO())}
          </span>
        )}
      </div>
    </div>
  )
}

/** Un dato de sólo lectura del contenedor. Vacío se dice, no se esconde. */
function Dato({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="campo">
      <span className="campo-lbl">{rotulo}</span>
      <span className="campo-fijo">{valor || '—'}</span>
    </div>
  )
}
