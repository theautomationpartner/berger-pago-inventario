import { useMemo } from 'react'
import { tonoEstadoCarga, tonoEta, type Tono } from '@/lib/chips'
import { DIAS_SIN_ACTUALIZAR, diasHastaEta, resumirDespachos, textoEta } from '@/lib/despachos'
import { fechaCorta } from '@/lib/format'
import { URL_TABLERO_DESPACHANTE } from '@/services/monday/columns'
import type { DespachoOP } from '@/types'
import { EtiquetasOP } from './EtiquetasOP'
import { useDespachos } from './useDespachos'

/** Cuántas OP de cada lista se muestran antes de cortar. Un dashboard no es un tablero. */
const TOPE_LISTA = 6

interface TarjetaProps {
  rotulo: string
  valor: number | string
  detalle?: string
  icono: string
  tono: Tono
}

/**
 * Una tarjeta del dashboard.
 *
 * El color no decora: es el mismo que lleva ese estado —o esa urgencia— en el resto de la app, así
 * que la pared de tarjetas se lee antes de leerla. Ninguna va en gris, ni siquiera las que valen
 * cero: un cero en gris parece un widget apagado, y es un dato.
 */
function Tarjeta({ rotulo, valor, detalle, icono, tono }: TarjetaProps) {
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

  const estaSemana = r.proximosArribos.filter((op) => (diasHastaEta(op.eta) ?? 99) <= 7)

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
            valor={r.vencidas.length}
            detalle="La fecha pasó y la OP sigue abierta"
            icono="fa-triangle-exclamation"
            tono="chip--rojo"
          />
          <Tarjeta
            rotulo="Llegan esta semana"
            valor={estaSemana.length}
            detalle="Arribo dentro de 7 días"
            icono="fa-calendar-day"
            tono="chip--naranja"
          />
          <Tarjeta
            rotulo="Sin ETA cargada"
            valor={r.sinEta.length}
            detalle="OP en curso sin fecha de arribo"
            icono="fa-calendar-xmark"
            tono="chip--ambar"
          />
          <Tarjeta
            rotulo="Sin N° de OP"
            valor={r.sinNroOp.length}
            detalle="Falta el número del despachante"
            icono="fa-hashtag"
            tono="chip--magenta"
          />
          <Tarjeta
            rotulo={`Sin actualizar ${DIAS_SIN_ACTUALIZAR}+ días`}
            valor={r.sinActualizar.length}
            detalle="Nadie actualizó sus datos en una semana"
            icono="fa-hourglass-half"
            tono="chip--violeta"
          />
          <Tarjeta
            rotulo="Contenedores en curso"
            valor={r.contenedoresEnCurso}
            detalle="En OP todavía no nacionalizadas"
            icono="fa-cubes"
            tono="chip--teal"
          />
        </div>

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
