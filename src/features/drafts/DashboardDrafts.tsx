import { useCallback, useMemo } from 'react'
import type { Tono } from '@/lib/chips'
import { resumirDrafts, unidadesDe, type Corte } from '@/lib/drafts'
import { importe } from '@/lib/format'
import { DRAFT_ESTADO } from '@/services/monday/columns'
import { draftsDePlanificacion, URL_TABLERO_DRAFTS } from '@/services/monday/drafts'
import type { Draft } from '@/types'
import { useDrafts } from './useDrafts'

/** El color de cada estado del draft. El circuito avanza de ámbar a verde, como en el resto. */
function tonoEstadoDraft(estado: string): Tono {
  switch (estado) {
    case DRAFT_ESTADO.CONFIRMADO:
      return 'chip--verde'
    case DRAFT_ESTADO.PLANIFICADA:
      return 'chip--teal'
    case DRAFT_ESTADO.PEND_CONFIRMAR:
      return 'chip--azul'
    case DRAFT_ESTADO.PEND_PLANIFICAR:
      return 'chip--ambar'
    case DRAFT_ESTADO.CANCELADO:
      return 'chip--rojo'
    default:
      return 'chip--violeta'
  }
}

function Tarjeta({
  rotulo,
  valor,
  detalle,
  icono,
  tono,
}: {
  rotulo: string
  valor: number | string
  detalle?: string
  icono: string
  tono: Tono
}) {
  return (
    <div className={`tarjeta ${tono.replace('chip--', 'tarjeta--')}`}>
      <span className="tarjeta-ic">
        <i className={`fa-solid ${icono}`} aria-hidden="true" />
      </span>
      <span className="tarjeta-val">{valor}</span>
      <span className="tarjeta-rot">{rotulo}</span>
      {detalle && <span className="tarjeta-det">{detalle}</span>}
    </div>
  )
}

/** Una tabla de cortes: cuántos drafts, unidades y dinero por cada valor de una columna. */
function TablaCorte({
  titulo,
  icono,
  cortes,
  vacio,
}: {
  titulo: string
  icono: string
  cortes: Corte[]
  vacio: string
}) {
  return (
    <div className="card card--flush">
      <div className="ctitle">
        <i className={`fa-solid ${icono}`} aria-hidden="true" />
        {titulo}
      </div>
      <div className="lista-body">
        {cortes.length === 0 ? (
          <div className="vacio">
            <span className="vacio-tit">{vacio}</span>
          </div>
        ) : (
          cortes.map((c) => (
            <div key={c.clave} className="corte">
              <span className="corte-clave">{c.clave}</span>
              <span className="corte-datos">
                <span className="chip chip--indigo">
                  {c.drafts} draft{c.drafts === 1 ? '' : 's'}
                </span>
                <span className="chip chip--lima">{c.unidades} u.</span>
                {/* Con divisas mezcladas el importe no se muestra: sumar euros con dólares daría
                    un número que no existe. */}
                {c.divisa && (
                  <span className="chip chip--verde">
                    {importe(c.total)} {c.divisa}
                  </span>
                )}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

/**
 * Dashboard de Drafts.
 *
 * Responde tres preguntas, en este orden:
 *
 *   ¿Cómo viene el circuito?   →  la fila de estados.
 *   ¿Qué tengo que hacer YO?   →  cuántos esperan período, cuántos esperan envío, y cuáles quedaron
 *                                 trabados porque el PDF no se leyó.
 *   ¿Qué le pedimos al proveedor? → el reparto por período, por forma de pago y por condición de
 *                                 entrega, con unidades y dinero.
 *
 * El corte por período es el que más se mira: es la carga de fábrica que BERGER está sugiriendo, y
 * ver diez drafts amontonados en un mismo mes es la señal de que hay que repartirlos antes de
 * mandar la planificación.
 */
export function DashboardDrafts() {
  const cargador = useCallback(() => draftsDePlanificacion(), [])
  const { drafts, cargando, error, recargar } = useDrafts('', cargador)
  const r = useMemo(() => resumirDrafts(drafts), [drafts])

  const unidadesPorPlanificar = r.paraPlanificar.reduce((n, d: Draft) => n + unidadesDe(d), 0)

  if (cargando) {
    return (
      <div className="scroll">
        <div className="view">
          <div className="vacio">
            <span className="spin spin--oscuro" aria-hidden="true" />
            <span className="vacio-tit">Cargando los drafts…</span>
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
            <span className="sec-tit">Dashboard de Drafts</span>
            <span className="sec-det">
              Los {r.total} drafts del circuito de planificación, al día de hoy.
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
            Datos en vivo del tablero de Drafts
            <button
              type="button"
              className="btn btn--borde btn--chico"
              onClick={() => void recargar()}
            >
              Actualizar
            </button>
          </span>
        </div>

        <div className="tarjetas">
          {r.porEstado.map(({ estado, cantidad }) => (
            <Tarjeta
              key={estado}
              rotulo={estado}
              valor={cantidad}
              icono={
                estado === DRAFT_ESTADO.CONFIRMADO
                  ? 'fa-circle-check'
                  : estado === DRAFT_ESTADO.PLANIFICADA
                    ? 'fa-industry'
                    : estado === DRAFT_ESTADO.CANCELADO
                      ? 'fa-ban'
                      : estado === DRAFT_ESTADO.PEND_CONFIRMAR
                        ? 'fa-hourglass-half'
                        : 'fa-calendar-plus'
              }
              tono={tonoEstadoDraft(estado)}
            />
          ))}
        </div>

        <div className="tarjetas" style={{ marginTop: 14 }}>
          <Tarjeta
            rotulo="Esperan período"
            valor={r.paraPlanificar.length}
            detalle={`${unidadesPorPlanificar} unidades sin planificar`}
            icono="fa-calendar-plus"
            tono="chip--ambar"
          />
          <Tarjeta
            rotulo="Listos para enviar"
            valor={r.paraEnviar.length}
            detalle="Planificados y con período"
            icono="fa-paper-plane"
            tono="chip--teal"
          />
          <Tarjeta
            rotulo="Trabados por lectura"
            valor={r.sinLeer.length}
            detalle="El PDF todavía no se leyó bien"
            icono="fa-file-circle-xmark"
            tono="chip--rojo"
          />
          <Tarjeta
            rotulo="Unidades en curso"
            valor={r.unidadesEnCurso}
            detalle="En drafts todavía no confirmados"
            icono="fa-tractor"
            tono="chip--indigo"
          />
          {r.porDivisa.map((d) => (
            <Tarjeta
              key={d.clave}
              rotulo={`Total en ${d.clave}`}
              valor={importe(d.total)}
              detalle={`${d.drafts} draft${d.drafts === 1 ? '' : 's'} en curso`}
              icono="fa-coins"
              tono="chip--verde"
            />
          ))}
        </div>

        <div className="tablas" style={{ marginTop: 14 }}>
          <TablaCorte
            titulo="Carga sugerida por período"
            icono="fa-industry"
            cortes={r.porPeriodo}
            vacio="Todavía no hay drafts con período asignado"
          />
          <TablaCorte
            titulo="Por forma de pago"
            icono="fa-money-bill-transfer"
            cortes={r.porFormaPago}
            vacio="Sin drafts en curso"
          />
          <TablaCorte
            titulo="Por condición de entrega"
            icono="fa-ship"
            cortes={r.porCondicionEntrega}
            vacio="Sin drafts en curso"
          />
        </div>

        {r.sinLeer.length > 0 && (
          <div className="aviso aviso--alerta" style={{ marginTop: 14 }}>
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
            <span>
              <b>
                {r.sinLeer.length} draft{r.sinLeer.length === 1 ? '' : 's'} sin leer
              </b>{' '}
              no aparecen para planificar hasta que la automatización termine de leer el PDF:
              <span className="aviso-chips">
                {r.sinLeer.map((d) => (
                  <span key={d.id} className="chip chip--rojo">
                    Draft {d.nombre} · {d.lectura || 'sin estado de lectura'}
                  </span>
                ))}
              </span>
            </span>
          </div>
        )}

        <div className="final-acciones" style={{ marginTop: 16 }}>
          <a className="btn btn--borde" href={URL_TABLERO_DRAFTS} target="_blank" rel="noreferrer">
            <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /> Abrir el
            tablero en monday
          </a>
        </div>
      </div>
    </div>
  )
}
