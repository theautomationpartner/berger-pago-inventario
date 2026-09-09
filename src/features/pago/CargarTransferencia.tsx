import { useCallback, useEffect, useMemo, useState } from 'react'
import { Stepper } from '@/components/ui/Stepper'
import { aNumero, hoyISO, importe } from '@/lib/format'
import { cargarTransferencia } from '@/services/monday/crearPago'
import { tractoresListosParaPagar } from '@/services/monday/inventario'
import { SinAcceso } from '@/services/monday/sdk'
import type { DatosTransferencia, Etapa, PeriodoMes, ResultadoCarga, Tractor } from '@/types'
import { PantallaFinal } from './PantallaFinal'
import { Paso1Seleccion } from './Paso1Seleccion'
import { Paso2Transferencia } from './Paso2Transferencia'

/** Mes en curso: el que la operación propone por defecto. */
function mesActual(): PeriodoMes {
  const hoy = new Date()
  return { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 }
}

const DATOS_VACIOS: DatosTransferencia = { archivo: null, monto: '', fechaEmision: hoyISO() }

const mensaje = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/**
 * Operación 1 del circuito: cargar la transferencia de un grupo de tractores.
 *
 * El estado vive todo acá y baja como props a los dos pasos. Es a propósito: la selección y el
 * comprobante son UNA sola operación —lo que se elige en el paso 1 es exactamente lo que se
 * registra en el paso 2—, así que partir el estado en dos componentes sólo abriría la puerta a
 * que se desincronicen.
 */
export function CargarTransferencia() {
  const [periodo, setPeriodo] = useState<PeriodoMes>(mesActual)
  const [tractores, setTractores] = useState<Tractor[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [etapa, setEtapa] = useState<Etapa>('seleccion')
  const [datos, setDatos] = useState<DatosTransferencia>(DATOS_VACIOS)

  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoCarga | null>(null)
  const [montoRegistrado, setMontoRegistrado] = useState(0)

  const buscar = useCallback(async (p: PeriodoMes) => {
    setCargando(true)
    setError(null)
    try {
      setTractores(await tractoresListosParaPagar(p))
    } catch (e) {
      setTractores([])
      setError(
        e instanceof SinAcceso
          ? 'la app tiene que abrirse desde monday para consultar el tablero.'
          : mensaje(e),
      )
    } finally {
      setCargando(false)
    }
  }, [])

  /* Al cambiar de mes se vuelve a consultar y se limpia la selección: los tractores marcados
     pertenecían al mes anterior y arrastrarlos mezclaría dos operaciones distintas. */
  useEffect(() => {
    setSeleccionados(new Set())
    void buscar(periodo)
  }, [periodo, buscar])

  const elegidos = useMemo(
    () => tractores.filter((t) => seleccionados.has(t.id)),
    [tractores, seleccionados],
  )
  const total = useMemo(
    () => elegidos.reduce((suma, t) => suma + (t.valorNeto ?? 0), 0),
    [elegidos],
  )

  const alternar = (id: string) =>
    setSeleccionados((previos) => {
      const proximos = new Set(previos)
      if (proximos.has(id)) proximos.delete(id)
      else proximos.add(id)
      return proximos
    })

  const reiniciar = () => {
    setSeleccionados(new Set())
    setDatos({ ...DATOS_VACIOS, fechaEmision: hoyISO() })
    setResultado(null)
    setErrorEnvio(null)
    setEtapa('seleccion')
    void buscar(periodo)
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
              periodo={periodo}
              onCambiarPeriodo={setPeriodo}
              tractores={tractores}
              seleccionados={seleccionados}
              onAlternar={alternar}
              onTodos={(ids) => setSeleccionados(new Set(ids))}
              onNinguno={() => setSeleccionados(new Set())}
              cargando={cargando}
              error={error}
              onReintentar={() => void buscar(periodo)}
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
            <span className="xs">Total valor neto: {importe(total)}</span>
          </div>

          <div className="pie-acciones">
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
