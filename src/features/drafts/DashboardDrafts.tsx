import { useCallback, useMemo, useState } from 'react'
import type { Tono } from '@/lib/chips'
import { enCurso, resumirDrafts, unidadesDe, type Corte } from '@/lib/drafts'
import { importe } from '@/lib/format'
import { DRAFT_ESTADO } from '@/services/monday/columns'
import { draftsDePlanificacion, URL_TABLERO_DRAFTS } from '@/services/monday/drafts'
import type { Draft } from '@/types'
import { EtiquetasDraft, ImportesDraft, ProductosDraft } from './ListaDrafts'
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

/**
 * Una tarjeta del dashboard.
 *
 * Con drafts detrás se puede abrir, y entonces es un **botón de verdad** y no un div con
 * `onClick`: así se llega con el teclado y el lector de pantalla la anuncia como lo que es. Un
 * número sin la lista que lo compone obliga a ir a monday a buscarla, y al volver ya se perdió de
 * vista el tablero.
 */
function Tarjeta({
  rotulo,
  valor,
  detalle,
  icono,
  tono,
  onAbrir,
  abierta,
}: {
  rotulo: string
  valor: number | string
  detalle?: string
  icono: string
  tono: Tono
  onAbrir?: () => void
  abierta?: boolean
}) {
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
          {abierta ? 'Ocultar' : 'Ver drafts'}
        </span>
      )}
    </>
  )

  return onAbrir ? (
    <button type="button" className={clases} aria-expanded={abierta} onClick={onAbrir}>
      {contenido}
    </button>
  ) : (
    <div className={clases}>{contenido}</div>
  )
}

/** Un draft desplegado: todo lo que tiene, sin ir a monday. */
function FichaDraft({ draft }: { draft: Draft }) {
  return (
    <div className="draft-ficha">
      <div className="draft-ficha-head">
        <span className="draft-ficha-nom">
          <i className="fa-solid fa-file-lines" aria-hidden="true" /> Draft {draft.nombre}
        </span>
        <span className="opfila-chips">
          <span className={`chip ${tonoEstadoDraft(draft.estado)}`}>
            {draft.estado || 'Sin estado'}
          </span>
          <span className="chip chip--indigo">{unidadesDe(draft)} u.</span>
          {draft.lectura && draft.lectura !== 'Leido' && (
            <span className="chip chip--rojo">Lectura: {draft.lectura}</span>
          )}
        </span>
        <a
          className="btn btn--texto btn--chico"
          style={{ marginLeft: 'auto' }}
          href={`${URL_TABLERO_DRAFTS}/pulses/${draft.id}`}
          target="_blank"
          rel="noreferrer"
        >
          <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /> Ver
        </a>
      </div>

      <div className="opfila-chips" style={{ marginBottom: 8 }}>
        <EtiquetasDraft draft={draft} />
      </div>

      <ImportesDraft draft={draft} />
      <ProductosDraft draft={draft} />
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

  /** Qué tarjeta está abierta. Una por vez: dos listas largas abiertas no se comparan, se pierden. */
  const [corte, setCorte] = useState<string | null>(null)

  /**
   * Los drafts detrás de cada tarjeta.
   *
   * Se arma acá y no en el resumen porque es exactamente la misma población que ya está contada:
   * si el número y la lista salieran de dos cálculos distintos, tarde o temprano se contradicen.
   */
  const cortes = useMemo(() => {
    const abiertos = drafts.filter(enCurso)
    const mapa: Record<string, { titulo: string; drafts: Draft[] }> = {
      planificar: { titulo: 'Esperan período', drafts: r.paraPlanificar },
      enviar: { titulo: 'Listos para enviar', drafts: r.paraEnviar },
      sinLeer: { titulo: 'Trabados por lectura', drafts: r.sinLeer },
      enCurso: { titulo: 'Drafts en curso', drafts: abiertos },
    }
    for (const { estado } of r.porEstado) {
      mapa[`estado:${estado}`] = {
        titulo: estado,
        drafts: drafts.filter((d) => d.estado === estado),
      }
    }
    for (const d of r.porDivisa) {
      mapa[`divisa:${d.clave}`] = {
        titulo: `En curso · ${d.clave}`,
        drafts: abiertos.filter((x) => x.divisa === d.clave),
      }
    }
    return mapa
  }, [drafts, r])

  /** Abre una tarjeta, o la cierra si ya estaba abierta. */
  const alternar = (clave: string) => setCorte((a) => (a === clave ? null : clave))

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
              onAbrir={cantidad > 0 ? () => alternar(`estado:${estado}`) : undefined}
              abierta={corte === `estado:${estado}`}
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
            onAbrir={r.paraPlanificar.length > 0 ? () => alternar('planificar') : undefined}
            abierta={corte === 'planificar'}
          />
          <Tarjeta
            rotulo="Listos para enviar"
            valor={r.paraEnviar.length}
            detalle="Planificados y con período"
            icono="fa-paper-plane"
            tono="chip--teal"
            onAbrir={r.paraEnviar.length > 0 ? () => alternar('enviar') : undefined}
            abierta={corte === 'enviar'}
          />
          <Tarjeta
            rotulo="Trabados por lectura"
            valor={r.sinLeer.length}
            detalle="El PDF todavía no se leyó bien"
            icono="fa-file-circle-xmark"
            tono="chip--rojo"
            onAbrir={r.sinLeer.length > 0 ? () => alternar('sinLeer') : undefined}
            abierta={corte === 'sinLeer'}
          />
          <Tarjeta
            rotulo="Unidades en curso"
            valor={r.unidadesEnCurso}
            detalle="En drafts todavía no confirmados"
            icono="fa-tractor"
            tono="chip--indigo"
            onAbrir={r.unidadesEnCurso > 0 ? () => alternar('enCurso') : undefined}
            abierta={corte === 'enCurso'}
          />
          {r.porDivisa.map((d) => (
            <Tarjeta
              key={d.clave}
              rotulo={`Total en ${d.clave}`}
              valor={importe(d.total)}
              detalle={`${d.drafts} draft${d.drafts === 1 ? '' : 's'} en curso`}
              icono="fa-coins"
              tono="chip--verde"
              onAbrir={d.drafts > 0 ? () => alternar(`divisa:${d.clave}`) : undefined}
              abierta={corte === `divisa:${d.clave}`}
            />
          ))}
        </div>

        {corte && (
          <div className="corte-abierto">
            <div className="ctitle">
              <i className="fa-solid fa-layer-group" aria-hidden="true" />
              {cortes[corte]?.titulo} · {cortes[corte]?.drafts.length ?? 0} draft
              {(cortes[corte]?.drafts.length ?? 0) === 1 ? '' : 's'}
              <button
                type="button"
                className="btn btn--texto btn--chico"
                style={{ marginLeft: 'auto' }}
                onClick={() => setCorte(null)}
              >
                <i className="fa-solid fa-xmark" aria-hidden="true" /> Cerrar
              </button>
            </div>
            <div className="lista-body">
              {(cortes[corte]?.drafts ?? []).map((d) => (
                <FichaDraft key={d.id} draft={d} />
              ))}
            </div>
          </div>
        )}

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
