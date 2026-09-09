import { useCallback, useEffect, useState } from 'react'
import { Stepper } from '@/components/ui/Stepper'
import { ZonaArchivo } from '@/components/ui/ZonaArchivo'
import { fechaCorta, importe } from '@/lib/format'
import { avanzarPago } from '@/services/monday/avanzarPago'
import { URL_TABLERO_PAGOS } from '@/services/monday/columns'
import { pagosPendientes } from '@/services/monday/pagos'
import { SinAcceso } from '@/services/monday/sdk'
import type { EtapaAvance, FlujoAvance, Pago, ResultadoAvance } from '@/types'
import { DetallePago } from './DetallePago'

interface Props {
  flujo: FlujoAvance
}

const mensaje = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/**
 * Operaciones 2 y 3: avanzar un pago que ya existe.
 *
 * Es UN solo componente para las dos porque el flujo es idéntico —elegir un pago, adjuntar un
 * comprobante, empujar el circuito— y lo único que cambia son los estados y los textos, que
 * llegan en `flujo`. Duplicar la pantalla habría duplicado también el manejo de errores y las
 * advertencias parciales, que es justo la parte que no conviene mantener por partida doble.
 *
 * La selección es de a UNO y no múltiple: cada pago tiene su propio comprobante, así que aprobar
 * dos a la vez obligaría a preguntar qué archivo va con cuál.
 */
export function FlujoAvancePago({ flujo }: Props) {
  const [pagos, setPagos] = useState<Pago[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [elegidoId, setElegidoId] = useState<string | null>(null)
  const [etapa, setEtapa] = useState<EtapaAvance>('seleccion')
  const [archivo, setArchivo] = useState<File | null>(null)

  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoAvance | null>(null)
  const [pagoRegistrado, setPagoRegistrado] = useState<Pago | null>(null)

  const buscar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      setPagos(await pagosPendientes(flujo.filtroOperacionPend, flujo.filtroEstadoPago))
    } catch (e) {
      setPagos([])
      setError(
        e instanceof SinAcceso
          ? 'la app tiene que abrirse desde monday para consultar el tablero.'
          : mensaje(e),
      )
    } finally {
      setCargando(false)
    }
  }, [flujo.filtroOperacionPend, flujo.filtroEstadoPago])

  useEffect(() => {
    void buscar()
  }, [buscar])

  const elegido = pagos.find((p) => p.id === elegidoId) ?? null

  const reiniciar = () => {
    setElegidoId(null)
    setArchivo(null)
    setResultado(null)
    setPagoRegistrado(null)
    setErrorEnvio(null)
    setEtapa('seleccion')
    void buscar()
  }

  const impactar = async () => {
    if (!elegido || !archivo) return
    setEnviando(true)
    setErrorEnvio(null)
    try {
      const r = await avanzarPago({ pago: elegido, archivo, flujo })
      setPagoRegistrado(elegido)
      setResultado(r)
      setEtapa('listo')
    } catch (e) {
      setErrorEnvio(mensaje(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <div className="scroll">
        <div className="view">
          <Stepper
            variante="avance"
            actual={etapa}
            onIr={etapa === 'listo' || enviando ? undefined : (e) => setEtapa(e as EtapaAvance)}
          />

          {etapa === 'seleccion' && (
            <>
              <div className="sec-head">
                <span className="sec-num">1</span>
                <span className="sec-txt">
                  <span className="sec-tit">{flujo.tituloSeleccion}</span>
                  <span className="sec-det">{flujo.detalleSeleccion}</span>
                </span>
              </div>

              {error && (
                <div className="aviso aviso--error">
                  <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
                  <span>
                    No se pudo leer el tablero de Pagos: {error}{' '}
                    <button
                      type="button"
                      className="btn btn--texto btn--chico"
                      onClick={() => void buscar()}
                    >
                      Reintentar
                    </button>
                  </span>
                </div>
              )}

              <div className="lista">
                <div className="lista-head">
                  <span>Pago</span>
                  <span className="lista-head-acciones">
                    <button
                      type="button"
                      className="btn btn--borde btn--chico"
                      onClick={() => void buscar()}
                    >
                      <i className="fa-solid fa-rotate" aria-hidden="true" /> Actualizar
                    </button>
                  </span>
                </div>

                <div className="lista-body">
                  {cargando && (
                    <div className="vacio">
                      <span className="spin spin--oscuro" aria-hidden="true" />
                      <span className="vacio-tit">Buscando pagos…</span>
                    </div>
                  )}

                  {!cargando && pagos.length === 0 && !error && (
                    <div className="vacio">
                      <span className="vacio-ic">
                        <i className="fa-solid fa-inbox" aria-hidden="true" />
                      </span>
                      <span className="vacio-tit">{flujo.vacioTitulo}</span>
                      <span className="vacio-det">{flujo.vacioDetalle}</span>
                    </div>
                  )}

                  {!cargando &&
                    pagos.map((p) => {
                      const marcado = p.id === elegidoId
                      return (
                        <button
                          key={p.id}
                          type="button"
                          aria-pressed={marcado}
                          className={`trow${marcado ? ' trow--sel' : ''}`}
                          onClick={() => setElegidoId(marcado ? null : p.id)}
                        >
                          <span className={`trow-radio${marcado ? ' trow-radio--sel' : ''}`} />
                          <span className="trow-nom">
                            <span className="trow-nom-txt">{p.nombre}</span>
                            <span className="chip chip--gris">
                              {p.tractores.length} tractor{p.tractores.length === 1 ? '' : 'es'}
                            </span>
                          </span>
                          <span className="trow-meta">
                            <span className="trow-fecha">{fechaCorta(p.fechaEmision)}</span>
                            <span className="trow-neto">{importe(p.monto)}</span>
                          </span>
                        </button>
                      )
                    })}
                </div>
              </div>

              {elegido && (
                <div style={{ marginTop: 16 }}>
                  <DetallePago pago={elegido} />
                </div>
              )}
            </>
          )}

          {etapa === 'archivo' && elegido && (
            <>
              <div className="sec-head">
                <span className="sec-num">2</span>
                <span className="sec-txt">
                  <span className="sec-tit">{flujo.tituloArchivo}</span>
                  <span className="sec-det">{flujo.detalleArchivo}</span>
                </span>
              </div>

              {errorEnvio && (
                <div className="aviso aviso--error">
                  <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
                  <span>No se pudo completar la operación: {errorEnvio}</span>
                </div>
              )}

              <div className="card card--flush" style={{ marginBottom: 16 }}>
                <div className="ctitle">
                  <i className="fa-solid fa-paperclip" aria-hidden="true" />
                  {flujo.tituloArchivo}
                </div>
                <ZonaArchivo
                  archivo={archivo}
                  onElegir={setArchivo}
                  titulo={flujo.zonaTitulo}
                />
              </div>

              <DetallePago pago={elegido} />

              <div className="aviso aviso--info" style={{ marginBottom: 0 }}>
                <i className="fa-solid fa-circle-info" aria-hidden="true" />
                <span>
                  Al confirmar, el pago pasa a <b>{flujo.nuevoEstadoPago}</b>, queda como{' '}
                  <b>{flujo.nuevaOperacionPend}</b>, sus {elegido.tractores.length} tractor
                  {elegido.tractores.length === 1 ? '' : 'es'} pasan a{' '}
                  <b>{flujo.nuevoEstadoInventario}</b> en el Inventario y {flujo.detalleEmail}.
                </span>
              </div>
            </>
          )}

          {etapa === 'listo' && resultado && pagoRegistrado && (
            <>
              {resultado.advertencias.length > 0 && (
                <div className="aviso aviso--alerta">
                  <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
                  <span>
                    <b>La operación se completó, pero quedaron cosas sin resolver.</b> Revisalas en
                    monday:
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
                    className={`fa-solid ${
                      resultado.advertencias.length > 0 ? 'fa-circle-exclamation' : 'fa-check'
                    }`}
                    aria-hidden="true"
                  />
                </span>
                <span className="final-tit">{flujo.finalTitulo}</span>
                <span className="final-det">{flujo.finalDetalle}</span>

                <div className="final-datos">
                  <span className="chip chip--verde">
                    <i className="fa-solid fa-file-invoice-dollar" aria-hidden="true" /> Pago #
                    {resultado.pagoId}
                  </span>
                  <span
                    className={`chip ${resultado.advertencias.length > 0 ? 'chip--ambar' : 'chip--verde'}`}
                  >
                    <i className="fa-solid fa-tractor" aria-hidden="true" />{' '}
                    {resultado.tractoresActualizados} en {flujo.nuevoEstadoInventario}
                  </span>
                  <span className="chip chip--azul">
                    <i className="fa-solid fa-envelope" aria-hidden="true" /> Aviso al proveedor en
                    cola
                  </span>
                </div>

                <div className="final-acciones">
                  <a
                    className="btn btn--borde"
                    href={`${URL_TABLERO_PAGOS}/pulses/${resultado.pagoId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /> Ver
                    en monday
                  </a>
                  <button type="button" className="btn btn--primario" onClick={reiniciar}>
                    <i className="fa-solid fa-list" aria-hidden="true" /> Volver a la lista
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {etapa !== 'listo' && (
        <footer className="pie">
          <div className="pie-info">
            <span className="font-b">
              {elegido ? elegido.nombre : 'Ningún pago seleccionado'}
            </span>
            <span className="xs">
              {elegido
                ? `${importe(elegido.monto)} · ${elegido.tractores.length} tractor${
                    elegido.tractores.length === 1 ? '' : 'es'
                  }`
                : 'Elegí el pago sobre el que querés trabajar'}
            </span>
          </div>

          <div className="pie-acciones">
            {etapa === 'archivo' && (
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
                disabled={!elegido}
                onClick={() => {
                  setErrorEnvio(null)
                  setEtapa('archivo')
                }}
              >
                Continuar <i className="fa-solid fa-arrow-right" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--marca"
                disabled={!archivo || enviando}
                onClick={() => void impactar()}
              >
                {enviando ? (
                  <>
                    <span className="spin" aria-hidden="true" /> Registrando en monday…
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-cloud-arrow-up" aria-hidden="true" />{' '}
                    {flujo.botonAccion}
                  </>
                )}
              </button>
            )}
          </div>
        </footer>
      )}
    </>
  )
}
