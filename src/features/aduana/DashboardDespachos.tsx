import { useMemo, useState } from 'react'
import { tonoEstadoCarga, tonoEta, type Tono } from '@/lib/chips'
import { DIAS_SIN_ACTUALIZAR, diasHastaEta, resumirDespachos, textoEta } from '@/lib/despachos'
import { fechaCorta } from '@/lib/format'
import { ESTADO_PAGO_VEP, URL_TABLERO_DESPACHANTE } from '@/services/monday/columns'
import { contenedoresDeOp, tractoresDeOps } from '@/services/monday/contenedoresDespacho'
import type { ContenedorDespacho, DespachoOP, TractorDeOp } from '@/types'
import { EtiquetasOP } from './EtiquetasOP'
import { FichaOP } from './FichaOP'
import { useDespachos } from './useDespachos'

/** Cuántas OP de cada lista se muestran antes de cortar. Un dashboard no es un tablero. */
const TOPE_LISTA = 6

interface TarjetaProps {
  rotulo: string
  valor: number | string
  detalle?: string
  icono: string
  tono: Tono
  /** Si la tarjeta tiene OP detrás, se puede abrir. */
  onAbrir?: () => void
  abierta?: boolean
}

/**
 * Una tarjeta del dashboard.
 *
 * El color no decora: es el mismo que lleva ese estado —o esa urgencia— en el resto de la app, así
 * que la pared de tarjetas se lee antes de leerla. Ninguna va en gris, ni siquiera las que valen
 * cero: un cero en gris parece un widget apagado, y es un dato.
 */
function Tarjeta({ rotulo, valor, detalle, icono, tono, onAbrir, abierta }: TarjetaProps) {
  const clases = `tarjeta ${tono.replace('chip--', 'tarjeta--')}${onAbrir ? ' tarjeta--boton' : ''}${
    abierta ? ' tarjeta--abierta' : ''
  }`
  const contenido = (
    <>
      <span className="tarjeta-ic">
        <i className={`fa-solid ${icono}`} aria-hidden="true" />
      </span>
      <span className="tarjeta-val">{valor}</span>
      <span className="tarjeta-rot">{rotulo}</span>
      {detalle && <span className="tarjeta-det">{detalle}</span>}
      {onAbrir && (
        <span className="tarjeta-ver">
          <i className={`fa-solid fa-chevron-${abierta ? 'up' : 'down'}`} aria-hidden="true" />{' '}
          {abierta ? 'Ocultar' : 'Ver OP'}
        </span>
      )}
    </>
  )

  /* Las tarjetas con OP detrás son botones de verdad y no divs con onClick: así se llega con el
     teclado y el lector de pantalla las anuncia como lo que son. */
  return onAbrir ? (
    <button type="button" className={clases} aria-expanded={abierta} onClick={onAbrir}>
      {contenido}
    </button>
  ) : (
    <div className={clases}>{contenido}</div>
  )
}

/** Una lista corta de OP, con lo mínimo para reconocerlas. */
function ListaOP({
  titulo,
  icono,
  ops,
  vacio,
  extra,
  tonoExtra = (op) => tonoEta(diasHastaEta(op.eta)),
}: {
  titulo: string
  icono: string
  ops: DespachoOP[]
  vacio: string
  extra?: (op: DespachoOP) => string
  /** Color del dato extra. Por defecto, el de la cercanía del arribo. */
  tonoExtra?: (op: DespachoOP) => Tono
}) {
  return (
    <div className="card card--flush">
      <div className="ctitle">
        <i className={`fa-solid ${icono}`} aria-hidden="true" />
        {titulo}
        {ops.length > 0 && <span className="chip chip--indigo">{ops.length}</span>}
      </div>
      <div className="lista-body">
        {ops.length === 0 ? (
          <div className="vacio">
            <span className="vacio-ic">
              <i className="fa-solid fa-circle-check" aria-hidden="true" />
            </span>
            <span className="vacio-tit">{vacio}</span>
          </div>
        ) : (
          ops.slice(0, TOPE_LISTA).map((op) => (
            <div key={op.id} className="opfila">
              <div className="opfila-head">
                <span className="opfila-nom">{op.nombre}</span>
                <span className="opfila-chips">
                  <EtiquetasOP op={op} />
                  {extra && <span className={`chip ${tonoExtra(op)}`}>{extra(op)}</span>}
                </span>
              </div>
            </div>
          ))
        )}
        {ops.length > TOPE_LISTA && (
          <div className="opfila">
            <div className="opfila-head">
              <span className="xs">y {ops.length - TOPE_LISTA} más…</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Dashboard de Despachos: el tablero del despachante, leído de un vistazo.
 *
 * Está armado alrededor de dos preguntas, que son las que se hacen todos los días:
 *
 *   ¿En qué estado está cada carga?  →  la fila de estados, con el color del circuito.
 *   ¿Qué tengo que mirar HOY?        →  lo vencido, lo que llega esta semana, y lo que quedó sin
 *                                       actualizar o sin datos que el despachante tiene que cargar.
 *
 * Los cortes "sin ETA", "sin N° de OP" y "sin actualizar" no son estadística: son trabajo pendiente
 * del propio despachante, y son los que hacen que el dashboard sirva para algo más que mirar.
 *
 * Todo se calcula sobre las OP que ya están en pantalla, sin una consulta aparte: el número de
 * arriba y la lista de abajo salen del mismo dato, así que no pueden contradecirse.
 */
export function DashboardDespachos() {
  const { despachos, cargando, error, recargar } = useDespachos()
  const r = useMemo(() => resumirDespachos(despachos), [despachos])

  /** Qué tarjeta está abierta, y los tractores y contenedores de las OP que muestra. */
  const [corte, setCorte] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<
    Record<string, { tractores: TractorDeOp[]; contenedores: ContenedorDespacho[] }>
  >({})
  const [cargandoDetalle, setCargandoDetalle] = useState(false)

  const estaSemana = r.proximosArribos.filter((op) => (diasHastaEta(op.eta) ?? 99) <= 7)

  /** Las OP de cada corte. Es lo que se despliega al abrir una tarjeta. */
  const cortes: Record<string, { titulo: string; ops: DespachoOP[] }> = {
    ...Object.fromEntries(
      r.porEstado.map(({ estado }) => [
        estado,
        { titulo: estado, ops: despachos.filter((op) => op.estadoCarga === estado) },
      ]),
    ),
    vencidas: { titulo: 'Con ETA vencida', ops: r.vencidas },
    semana: { titulo: 'Llegan esta semana', ops: estaSemana },
    sinEta: { titulo: 'Sin ETA cargada', ops: r.sinEta },
    sinNroOp: { titulo: 'Sin N° de OP', ops: r.sinNroOp },
    sinActualizar: { titulo: `Sin actualizar ${DIAS_SIN_ACTUALIZAR}+ días`, ops: r.sinActualizar },
    contenedores: {
      titulo: 'Contenedores en curso',
      ops: despachos.filter((op) => op.estadoCarga !== 'Nacionalizado' && op.estadoCarga !== ''),
    },
  }

  /**
   * Abre un corte y trae los contenedores de sus OP.
   *
   * Los contenedores se piden SÓLO al abrir, y sólo de las OP de ese corte: traerlos todos al
   * cargar el dashboard sería una consulta por OP del tablero para dibujar unos números que casi
   * siempre se miran sin abrir nada.
   */
  const abrir = async (clave: string) => {
    if (corte === clave) return setCorte(null)
    setCorte(clave)

    const ops = cortes[clave]?.ops ?? []
    const faltan = ops.filter((op) => !detalle[op.id])
    if (faltan.length === 0) return

    setCargandoDetalle(true)
    try {
      const porOp = await tractoresDeOps(faltan.map((op) => op.id))
      const nuevo: Record<
        string,
        { tractores: TractorDeOp[]; contenedores: ContenedorDespacho[] }
      > = {}
      for (const [opId, tractores] of porOp) {
        nuevo[opId] = { tractores, contenedores: await contenedoresDeOp(tractores) }
      }
      setDetalle((a) => ({ ...a, ...nuevo }))
    } catch {
      // El detalle es un extra: si falla, las tarjetas y los números siguen sirviendo.
    } finally {
      setCargandoDetalle(false)
    }
  }

  if (cargando) {
    return (
      <div className="scroll">
        <div className="view">
          <div className="vacio">
            <span className="spin spin--oscuro" aria-hidden="true" />
            <span className="vacio-tit">Cargando los despachos…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="scroll">
      <div className="view">
        <div className="sec-head">
          <span className="sec-num">
            <i className="fa-solid fa-chart-simple" aria-hidden="true" />
          </span>
          <span className="sec-txt">
            <span className="sec-tit">Dashboard de Despachos</span>
            <span className="sec-det">
              Estado de las {r.total} OP del tablero, al día de hoy. Se actualiza con cada cambio
              que carga el despachante.
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
          <span className="filtros-nota filtros-nota--sola">
            <i className="fa-solid fa-rotate" aria-hidden="true" />
            {r.actualizadasHoy} OP actualizada{r.actualizadasHoy === 1 ? '' : 's'} hoy
            <button
              type="button"
              className="btn btn--borde btn--chico"
              onClick={() => void recargar()}
            >
              Actualizar
            </button>
          </span>
        </div>

        {/* Los estados del circuito, en el orden en que avanza la carga. */}
        <div className="tarjetas">
          {r.porEstado.map(({ estado, cantidad }) => (
            <Tarjeta
              key={estado}
              rotulo={estado}
              valor={cantidad}
              onAbrir={cantidad > 0 ? () => void abrir(estado) : undefined}
              abierta={corte === estado}
              icono={
                estado === 'Nacionalizado'
                  ? 'fa-flag-checkered'
                  : estado === 'Próxima a Arribar'
                    ? 'fa-anchor'
                    : estado === 'En Transito'
                      ? 'fa-ship'
                      : estado === 'Pendiente de Embarque'
                        ? 'fa-box'
                        : 'fa-file-circle-plus'
              }
              tono={tonoEstadoCarga(estado)}
            />
          ))}
        </div>

        {/* Lo que hay que mirar hoy. */}
        <div className="tarjetas" style={{ marginTop: 14 }}>
          <Tarjeta
            rotulo="Con ETA vencida"
            onAbrir={r.vencidas.length > 0 ? () => void abrir('vencidas') : undefined}
            abierta={corte === 'vencidas'}
            valor={r.vencidas.length}
            detalle="La fecha pasó y la OP sigue abierta"
            icono="fa-triangle-exclamation"
            tono="chip--rojo"
          />
          <Tarjeta
            rotulo="Llegan esta semana"
            onAbrir={estaSemana.length > 0 ? () => void abrir('semana') : undefined}
            abierta={corte === 'semana'}
            valor={estaSemana.length}
            detalle="Arribo dentro de 7 días"
            icono="fa-calendar-day"
            tono="chip--naranja"
          />
          <Tarjeta
            rotulo="Sin ETA cargada"
            onAbrir={r.sinEta.length > 0 ? () => void abrir('sinEta') : undefined}
            abierta={corte === 'sinEta'}
            valor={r.sinEta.length}
            detalle="OP en curso sin fecha de arribo"
            icono="fa-calendar-xmark"
            tono="chip--ambar"
          />
          <Tarjeta
            rotulo="Sin N° de OP"
            onAbrir={r.sinNroOp.length > 0 ? () => void abrir('sinNroOp') : undefined}
            abierta={corte === 'sinNroOp'}
            valor={r.sinNroOp.length}
            detalle="Falta el número del despachante"
            icono="fa-hashtag"
            tono="chip--magenta"
          />
          <Tarjeta
            rotulo={`Sin actualizar ${DIAS_SIN_ACTUALIZAR}+ días`}
            onAbrir={r.sinActualizar.length > 0 ? () => void abrir('sinActualizar') : undefined}
            abierta={corte === 'sinActualizar'}
            valor={r.sinActualizar.length}
            detalle="Nadie actualizó sus datos en una semana"
            icono="fa-hourglass-half"
            tono="chip--violeta"
          />
          <Tarjeta
            rotulo="Contenedores en curso"
            onAbrir={r.contenedoresEnCurso > 0 ? () => void abrir('contenedores') : undefined}
            abierta={corte === 'contenedores'}
            valor={r.contenedoresEnCurso}
            detalle="En OP todavía no nacionalizadas"
            icono="fa-cubes"
            tono="chip--teal"
          />
        </div>

        {/* Lo que se despliega al tocar una tarjeta: las OP de ese corte, con sus contenedores. */}
        {corte && (
          <div className="corte-abierto">
            <div className="ctitle">
              <i className="fa-solid fa-layer-group" aria-hidden="true" />
              {cortes[corte]?.titulo} · {cortes[corte]?.ops.length ?? 0} OP
              <button
                type="button"
                className="btn btn--texto btn--chico"
                style={{ marginLeft: 'auto' }}
                onClick={() => setCorte(null)}
              >
                <i className="fa-solid fa-xmark" aria-hidden="true" /> Cerrar
              </button>
            </div>

            {cargandoDetalle && (
              <div className="vacio">
                <span className="spin spin--oscuro" aria-hidden="true" />
                <span className="vacio-tit">Leyendo los contenedores…</span>
              </div>
            )}

            <div className="lista-body">
              {(cortes[corte]?.ops ?? []).map((op) => {
                const info = detalle[op.id]
                const conts = info?.contenedores ?? []
                const sinCont = (info?.tractores ?? []).filter((t) => !t.contenedorId).length
                return (
                  <div key={op.id} className="opfila">
                    <div className="opfila-head">
                      <span className="opfila-nom">{op.nombre}</span>
                      <span className="opfila-chips">
                        <EtiquetasOP op={op} conEta />
                        <span
                          className={`chip ${
                            op.estadoPagoVepArca === ESTADO_PAGO_VEP.PAGADO
                              ? 'chip--verde'
                              : 'chip--rojo'
                          }`}
                        >
                          VEP {op.estadoPagoVepArca || 'sin estado'}
                        </span>
                        {info && (
                          <span
                            className={`chip ${sinCont === 0 && conts.length > 0 ? 'chip--verde' : 'chip--ambar'}`}
                          >
                            <i className="fa-solid fa-boxes-packing" aria-hidden="true" />{' '}
                            {conts.length === 0
                              ? 'Sin contenedores armados'
                              : sinCont === 0
                                ? `${conts.length} contenedor${conts.length === 1 ? '' : 'es'} armados`
                                : `${conts.length} armados · faltan ${sinCont}`}
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="opfila-cuerpo">
                      <FichaOP op={op} />

                      {conts.length > 0 && (
                        <div className="conts-linea">
                          {conts.map((c) => {
                            const dentro = (info?.tractores ?? []).filter(
                              (t) => t.contenedorId === c.id,
                            )
                            return (
                              <div key={c.id} className="cont-tarjeta">
                                <span className="cont-num">
                                  <i className="fa-solid fa-box" aria-hidden="true" />{' '}
                                  {c.numero || c.nombre}
                                </span>
                                <span className="cont-chips">
                                  <span className="chip chip--indigo">
                                    {dentro.length} tractor{dentro.length === 1 ? '' : 'es'}
                                  </span>
                                  {c.estadoArribo && (
                                    <span className="chip chip--teal">{c.estadoArribo}</span>
                                  )}
                                  {c.transportista && (
                                    <span className="chip chip--azul">{c.transportista}</span>
                                  )}
                                  {c.ubicacion && (
                                    <span className="chip chip--lima">{c.ubicacion}</span>
                                  )}
                                  {c.fechaTurno && (
                                    <span className="chip chip--violeta">
                                      Turno {fechaCorta(c.fechaTurno)}
                                    </span>
                                  )}
                                </span>
                                <span className="cont-tractores">
                                  {dentro.map((t) => (
                                    <span key={t.id} className="chasis chasis--chico">
                                      {t.chasis || t.nombre}
                                    </span>
                                  ))}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {r.porPais.length > 0 && (
          <div className="card card--flush" style={{ marginTop: 14 }}>
            <div className="ctitle">
              <i className="fa-solid fa-earth-americas" aria-hidden="true" />
              OP por país de origen
            </div>
            <div className="paises">
              {r.porPais.map(({ pais, cantidad }) => (
                <span key={pais} className="chip chip--magenta">
                  {pais}: <b>{cantidad}</b>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="tablas" style={{ marginTop: 14 }}>
          <ListaOP
            titulo="Próximos arribos"
            icono="fa-ship"
            ops={r.proximosArribos}
            vacio="No hay arribos programados"
            extra={(op) => `${fechaCorta(op.eta)} · ${textoEta(diasHastaEta(op.eta))}`}
          />
          <ListaOP
            titulo="ETA vencida"
            icono="fa-triangle-exclamation"
            ops={r.vencidas}
            vacio="Ninguna OP quedó pasada de fecha"
            extra={(op) => textoEta(diasHastaEta(op.eta))}
          />
          <ListaOP
            titulo={`Sin actualizar hace ${DIAS_SIN_ACTUALIZAR} días o más`}
            icono="fa-hourglass-half"
            ops={r.sinActualizar}
            vacio="Todas las OP se actualizaron esta semana"
          />
          <ListaOP
            titulo="Sin fecha de arribo"
            icono="fa-calendar-xmark"
            ops={r.sinEta}
            vacio="Todas las OP en curso tienen ETA"
          />
        </div>

        <div className="final-acciones" style={{ marginTop: 16 }}>
          <a
            className="btn btn--borde"
            href={URL_TABLERO_DESPACHANTE}
            target="_blank"
            rel="noreferrer"
          >
            <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /> Abrir el
            tablero en monday
          </a>
        </div>
      </div>
    </div>
  )
}
