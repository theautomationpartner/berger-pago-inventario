import { useState } from 'react'
import { Stepper } from '@/components/ui/Stepper'
import { PasoDespachante } from '@/features/despachante/PasoDespachante'
import { useDespachantes } from '@/features/despachante/useDespachantes'
import { ListaTractores } from '@/features/tractores/ListaTractores'
import { ResumenContenedores } from '@/features/tractores/ResumenContenedores'
import { ResumenSeleccion } from '@/features/tractores/ResumenSeleccion'
import { useContenedores } from '@/features/tractores/useContenedores'
import { useSeleccionTractores, useTractores } from '@/features/tractores/useTractores'
import { reporteContenedores, seccionDespachante } from '@/lib/contenedores'
import { fechaCorta, hoyISO, importe } from '@/lib/format'
import { puertosDeTractores } from '@/lib/puertos'
import { URL_TABLERO_PAGOS } from '@/services/monday/columns'
import { crearPedidoVista, nombreDelPedidoVista } from '@/services/monday/crearPedidoVista'
import { tractoresParaDespachoVista } from '@/services/monday/inventario'
import type { EtapaVista, ResultadoCarga } from '@/types'

const mensaje = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/**
 * Despacho a la VISTA (contra BL): un único paso.
 *
 * Se eligen del Inventario los tractores con Forma de Pago en VISTA —y con la Fecha de Producción
 * confirmada—, se elige el despachante y se registra el pedido, que se hace SIN pago previo: cada
 * tractor queda en "Pendiente de Pago" y el pedido también.
 *
 * Son dos pasos y no uno solo porque el segundo cierra el despacho: de ahí sale el mail y el item
 * del Despachante de aduana, y eso merece una pantalla donde se vea a quién se le manda y qué se
 * le manda antes de apretar.
 *
 * A diferencia del ANTICIPADO, acá se muestra el Estado Pago de cada tractor. En el anticipado
 * todos los de la lista están, por definición, en "Listo para Pagar"; en la vista no hay un estado
 * que los filtre, así que ver en cuál está cada uno es parte de decidir si se pide.
 */
export function DespachoVista() {
  const { tractores, cargando, error, recargar } = useTractores(tractoresParaDespachoVista)
  const { seleccionados, alternar, marcar, desmarcar, limpiar, elegidos, total } =
    useSeleccionTractores(tractores)
  const contenedores = useContenedores(elegidos, tractores)

  const [etapa, setEtapa] = useState<EtapaVista>('seleccion')
  const [despachanteId, setDespachanteId] = useState<string | null>(null)
  const equipo = useDespachantes()

  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoCarga | null>(null)

  /* El reporte se arma con la selección de arriba y se usa para las dos cosas: lo que se ve en el
     paso del despachante y lo que se guarda en el pago. Es el MISMO texto, calculado una vez. */
  const reporte = reporteContenedores(
    contenedores.resumen,
    nombreDelPedidoVista(hoyISO()),
    puertosDeTractores(elegidos),
  )

  const registrar = async () => {
    setEnviando(true)
    setErrorEnvio(null)
    try {
      const r = await crearPedidoVista({
        tractores: elegidos,
        montoPendiente: total,
        totalContenedores: contenedores.resumen.totalContenedores,
        despachanteId,
        reporteContenedores: reporte,
      })
      setResultado(r)
      setEtapa('listo')
    } catch (e) {
      setErrorEnvio(mensaje(e))
    } finally {
      setEnviando(false)
    }
  }

  const reiniciar = () => {
    limpiar()
    setResultado(null)
    setErrorEnvio(null)
    setDespachanteId(null)
    setEtapa('seleccion')
    void recargar()
  }

  if (resultado) {
    const conProblemas = resultado.advertencias.length > 0
    return (
      <div className="scroll">
        <div className="view">
          <Stepper variante="vista" actual="listo" />

          {conProblemas && (
            <div className="aviso aviso--alerta">
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
              <span>
                <b>El pedido se registró, pero quedaron cosas sin completar.</b> Revisalas en monday:
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
              {conProblemas ? 'Pedido registrado con observaciones' : 'Pedido registrado'}
            </span>
            <span className="final-det">
              Se creó <b>{nombreDelPedidoVista(hoyISO())}</b> en Pagos del Inventario, con el detalle
              de los contenedores, y el despacho en <b>Despachante de aduana</b>, al que ya se le
              avisó. Los tractores quedaron en <b>Pendiente de Pago</b>.
            </span>

            <div className="final-datos">
              <span className="chip chip--verde">
                <i className="fa-solid fa-file-invoice-dollar" aria-hidden="true" /> Pedido #
                {resultado.pagoId}
              </span>
              <span className="chip chip--azul">
                <i className="fa-solid fa-layer-group" aria-hidden="true" />{' '}
                {resultado.subitemIds.length} tractor
                {resultado.subitemIds.length === 1 ? '' : 'es'}
              </span>
              <span className="chip chip--ambar">
                <i className="fa-solid fa-envelope" aria-hidden="true" /> Aviso al despachante
                enviado
              </span>
            </div>

            <div className="final-acciones">
              <a
                className="btn btn--borde"
                href={`${URL_TABLERO_PAGOS}/pulses/${resultado.pagoId}`}
                target="_blank"
                rel="noreferrer"
              >
                <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /> Ver en
                monday
              </a>
              <button type="button" className="btn btn--primario" onClick={reiniciar}>
                <i className="fa-solid fa-plus" aria-hidden="true" /> Hacer otro pedido
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
            variante="vista"
            actual={etapa}
            onIr={enviando ? undefined : (e) => setEtapa(e as EtapaVista)}
          />

          {etapa === 'despachante' && (
            <>
              {errorEnvio && (
                <div className="aviso aviso--error">
                  <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
                  <span>No se pudo registrar el pedido: {errorEnvio}</span>
                </div>
              )}

              <PasoDespachante
                despachantes={equipo.despachantes}
                cargando={equipo.cargando}
                error={equipo.error}
                onReintentar={() => void equipo.recargar()}
                elegidoId={despachanteId}
                onElegir={setDespachanteId}
                informacion={seccionDespachante(reporte)}
                numeroPaso={2}
              />

              <div className="aviso aviso--info" style={{ marginTop: 16, marginBottom: 0 }}>
                <i className="fa-solid fa-circle-info" aria-hidden="true" />
                <span>
                  Al registrar, se crea <b>{nombreDelPedidoVista(hoyISO())}</b> en{' '}
                  <b>Pagos del Inventario</b> con un subitem por tractor, el despacho en{' '}
                  <b>Despachante de aduana</b> a nombre del elegido —al que se le manda esta
                  información— y los {elegidos.length} tractor{elegidos.length === 1 ? '' : 'es'}{' '}
                  pasan a <b>Pendiente de Pago</b>.
                </span>
              </div>
            </>
          )}

          {etapa === 'seleccion' && (
          <>
          <div className="sec-head">
            <span className="sec-num">
              <i className="fa-solid fa-paper-plane" aria-hidden="true" />
            </span>
            <span className="sec-txt">
              <span className="sec-tit">Pedido a la vista</span>
              <span className="sec-det">
                Tractores del Inventario con Forma de Pago en <b>VISTA</b> y la Fecha de Producción
                confirmada. El pedido se hace sin pago previo.
              </span>
            </span>
          </div>

          {errorEnvio && (
            <div className="aviso aviso--error">
              <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
              <span>No se pudo registrar el pedido: {errorEnvio}</span>
            </div>
          )}

          <div className="filtros">
            <span className="filtros-nota filtros-nota--sola">
              <i className="fa-solid fa-rotate" aria-hidden="true" />
              Datos en vivo del Inventario
              <button
                type="button"
                className="btn btn--borde btn--chico"
                onClick={() => void recargar()}
              >
                Actualizar
              </button>
            </span>
          </div>

          <ListaTractores
            tractores={tractores}
            seleccionados={seleccionados}
            onAlternar={alternar}
            onMarcar={marcar}
            onDesmarcar={desmarcar}
            cargando={cargando}
            error={error}
            onReintentar={() => void recargar()}
            vacioTitulo="No hay tractores para pedir a la vista"
            vacioDetalle='Ningún tractor del Inventario tiene la Forma de Pago en "VISTA" con la Fecha de Producción confirmada.'
            mostrarEstadoPago
          />

          <ResumenSeleccion
            tractores={elegidos}
            onQuitar={alternar}
            titulo="Tractores de este pedido"
            detalleTotal="a la vista"
          />

          <ResumenContenedores
            resumen={contenedores.resumen}
            cargando={contenedores.cargando}
            error={contenedores.error}
            onReintentar={() => void contenedores.recargar()}
            seleccionados={elegidos.length}
          />

          {elegidos.length > 0 && (
            <div className="aviso aviso--info" style={{ marginBottom: 0 }}>
              <i className="fa-solid fa-circle-info" aria-hidden="true" />
              <span>
                En el paso siguiente elegís el despachante y ves la información que se le manda.
                Después de registrar, los {elegidos.length} tractor
                {elegidos.length === 1 ? '' : 'es'} pasan a <b>Pendiente de Pago</b> en el
                Inventario.
              </span>
            </div>
          )}
          </>
          )}
        </div>
      </div>

      <footer className="pie">
        <div className="pie-info">
          <span className="font-b">
            {elegidos.length} tractor{elegidos.length === 1 ? '' : 'es'} seleccionado
            {elegidos.length === 1 ? '' : 's'}
          </span>
          <span className="xs">
            Pedido del {fechaCorta(hoyISO())}
            {contenedores.resumen.totalContenedores > 0 &&
              ` · ${contenedores.resumen.totalContenedores} contenedor${
                contenedores.resumen.totalContenedores === 1 ? '' : 'es'
              }`}
          </span>
        </div>

        <div className="pie-acciones">
          <span className="pie-total">
            <span className="pie-total-lbl">Total valor neto</span>
            <span className="pie-total-val">{importe(total)}</span>
          </span>

          {etapa === 'despachante' && (
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
                setEtapa('despachante')
              }}
            >
              Continuar <i className="fa-solid fa-arrow-right" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--marca"
              disabled={elegidos.length === 0 || enviando || !despachanteId}
              onClick={() => void registrar()}
            >
              {enviando ? (
                <>
                  <span className="spin" aria-hidden="true" /> Registrando en monday…
                </>
              ) : (
                <>
                  <i className="fa-solid fa-paper-plane" aria-hidden="true" /> Registrar pedido
                </>
              )}
            </button>
          )}
        </div>
      </footer>
    </>
  )
}
