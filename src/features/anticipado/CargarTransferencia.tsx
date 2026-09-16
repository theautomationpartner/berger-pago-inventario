import { useState } from 'react'
import { Stepper } from '@/components/ui/Stepper'
import { ResumenContenedores } from '@/features/tractores/ResumenContenedores'
import { useContenedores } from '@/features/tractores/useContenedores'
import { useSeleccionTractores, useTractores } from '@/features/tractores/useTractores'
import { reporteContenedores } from '@/lib/contenedores'
import { aNumero, fechaCorta, hoyISO, importe } from '@/lib/format'
import { puertosDeTractores } from '@/lib/puertos'
import { cargarTransferencia } from '@/services/monday/crearPago'
import { tractoresListosParaPagar } from '@/services/monday/inventario'
import type { DatosTransferencia, Etapa, ResultadoCarga } from '@/types'
import { PantallaFinal } from './PantallaFinal'
import { Paso1Seleccion } from './Paso1Seleccion'
import { Paso2Transferencia } from './Paso2Transferencia'

const DATOS_VACIOS: DatosTransferencia = { archivo: null, monto: '', fechaEmision: hoyISO() }

const mensaje = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/**
 * Despacho ANTICIPADO · etapa 1: cargar la transferencia de un grupo de tractores.
 *
 * El estado vive todo acá y baja como props a los dos pasos. Es a propósito: la selección y el
 * comprobante son UNA sola operación —lo que se elige en el paso 1 es exactamente lo que se
 * registra en el paso 2—, así que partir el estado en dos componentes sólo abriría la puerta a
 * que se desincronicen.
 */
export function CargarTransferencia() {
  const { tractores, cargando, error, recargar } = useTractores(tractoresListosParaPagar)
  const { seleccionados, alternar, marcar, desmarcar, limpiar, elegidos, total } =
    useSeleccionTractores(tractores)
  const contenedores = useContenedores(elegidos, tractores)

  /* Vacío = todos los meses. Se conserva al cargar otra transferencia: quien trabaja con los
     tractores de ciertos meses suele seguir con esos mismos. */
  const [mesesElegidos, setMesesElegidos] = useState<string[]>([])

  const [etapa, setEtapa] = useState<Etapa>('seleccion')
  const [datos, setDatos] = useState<DatosTransferencia>(DATOS_VACIOS)

  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoCarga | null>(null)
  const [montoRegistrado, setMontoRegistrado] = useState(0)

  const reiniciar = () => {
    limpiar()
    setDatos({ ...DATOS_VACIOS, fechaEmision: hoyISO() })
    setResultado(null)
    setErrorEnvio(null)
    setEtapa('seleccion')
    void recargar()
  }

  /** Pasar al paso 2 propone el total como monto, sin pisar lo que el usuario ya haya escrito. */
  const confirmarSeleccion = () => {
    setDatos((d) => (d.monto.trim() ? d : { ...d, monto: String(total) }))
    setErrorEnvio(null)
    setEtapa('transferencia')
  }

  const montoNumero = aNumero(datos.monto)
  const listoParaCargar =
    elegidos.length > 0 && datos.archivo != null && montoNumero != null && Boolean(datos.fechaEmision)

  const impactar = async () => {
    if (!datos.archivo || montoNumero == null) return
    setEnviando(true)
    setErrorEnvio(null)
    try {
      const r = await cargarTransferencia({
        tractores: elegidos,
        archivo: datos.archivo,
        monto: montoNumero,
        fechaEmision: datos.fechaEmision,
        reporteContenedores: reporteContenedores(
          contenedores.resumen,
          `PAGO ANTICIPADO - ${fechaCorta(datos.fechaEmision)}`,
          puertosDeTractores(elegidos),
        ),
      })
      setResultado(r)
      setMontoRegistrado(montoNumero)
      setEtapa('listo')
    } catch (e) {
      setErrorEnvio(mensaje(e))
    } finally {
      setEnviando(false)
    }
  }

  const panelContenedores = (
    <ResumenContenedores
      resumen={contenedores.resumen}
      cargando={contenedores.cargando}
      error={contenedores.error}
      onReintentar={() => void contenedores.recargar()}
      seleccionados={elegidos.length}
    />
  )

  return (
    <>
      <div className="scroll">
        <div className="view">
          <Stepper
            actual={etapa}
            onIr={etapa === 'listo' || enviando ? undefined : (e) => setEtapa(e as Etapa)}
          />

          {etapa === 'seleccion' && (
            <Paso1Seleccion
              tractores={tractores}
              mesesElegidos={mesesElegidos}
              onCambiarMeses={setMesesElegidos}
              seleccionados={seleccionados}
              onAlternar={alternar}
              onMarcar={marcar}
              onDesmarcar={desmarcar}
              cargando={cargando}
              error={error}
              onReintentar={() => void recargar()}
              contenedores={panelContenedores}
            />
          )}

          {etapa === 'transferencia' && (
            <>
              {errorEnvio && (
                <div className="aviso aviso--error">
                  <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
                  <span>No se pudo cargar el pago: {errorEnvio}</span>
                </div>
              )}
              <Paso2Transferencia
                tractores={elegidos}
                datos={datos}
                onCambiar={setDatos}
                total={total}
                contenedores={panelContenedores}
              />
            </>
          )}

          {etapa === 'listo' && resultado && (
            <PantallaFinal
              resultado={resultado}
              monto={montoRegistrado}
              onNuevaOperacion={reiniciar}
            />
          )}
        </div>
      </div>

      {etapa !== 'listo' && (
        <footer className="pie">
          <div className="pie-info">
            <span className="font-b">
              {elegidos.length} tractor{elegidos.length === 1 ? '' : 'es'} seleccionado
              {elegidos.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="pie-acciones">
            <span className="pie-total">
              <span className="pie-total-lbl">Total valor neto</span>
              <span className="pie-total-val">{importe(total)}</span>
            </span>
            {etapa === 'transferencia' && (
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
                onClick={confirmarSeleccion}
              >
                Confirmar <i className="fa-solid fa-arrow-right" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--marca"
                disabled={!listoParaCargar || enviando}
                onClick={() => void impactar()}
              >
                {enviando ? (
                  <>
                    <span className="spin" aria-hidden="true" /> Cargando en monday…
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-cloud-arrow-up" aria-hidden="true" /> Cargar Pago
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
