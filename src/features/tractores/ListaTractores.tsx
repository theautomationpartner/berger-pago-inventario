import { tonoEstadoInventario } from '@/lib/chips'
import { fechaCorta, importe } from '@/lib/format'
import type { Tractor } from '@/types'
import { EtiquetasTractor } from './EtiquetasTractor'

interface Props {
  /** Los tractores que se muestran: ya filtrados, si hay filtro. */
  tractores: Tractor[]
  seleccionados: Set<string>
  onAlternar: (id: string) => void
  onMarcar: (ids: string[]) => void
  onDesmarcar: (ids: string[]) => void
  cargando: boolean
  error: string | null
  onReintentar: () => void
  /** Qué decir cuando no hay nada. Cada modalidad lo explica con sus propias condiciones. */
  vacioTitulo: string
  vacioDetalle: string
  /** En VISTA los tractores pueden estar en cualquier Estado Pago, así que se muestra. */
  mostrarEstadoPago?: boolean
}

/**
 * Lista de tractores seleccionables. La comparten el despacho ANTICIPADO y el despacho a la VISTA.
 *
 * "Marcar todos" actúa sobre lo que se VE, no sobre todo lo cargado: con un filtro de meses
 * activo, marcar todos tiene que marcar los de esos meses, no traerse de arrastre los que el
 * usuario acaba de sacar de la vista. Por la misma razón, desmarcar sólo desmarca los visibles:
 * una selección hecha con otro filtro no se pierde por cambiar de mes.
 */
export function ListaTractores({
  tractores,
  seleccionados,
  onAlternar,
  onMarcar,
  onDesmarcar,
  cargando,
  error,
  onReintentar,
  vacioTitulo,
  vacioDetalle,
  mostrarEstadoPago = false,
}: Props) {
  const ids = tractores.map((t) => t.id)
  const todosMarcados = ids.length > 0 && ids.every((id) => seleccionados.has(id))

  return (
    <>
      {error && (
        <div className="aviso aviso--error">
          <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
          <span>
            No se pudo leer el Inventario: {error}{' '}
            <button type="button" className="btn btn--texto btn--chico" onClick={onReintentar}>
              Reintentar
            </button>
          </span>
        </div>
      )}

      <div className="lista">
        <div className="lista-head">
          <span>
            Tractor
            {!cargando && tractores.length > 0 && (
              <span className="chip chip--teal lista-head-cuenta">{tractores.length}</span>
            )}
          </span>
          <span className="lista-head-acciones">
            <button
              type="button"
              className="btn btn--borde btn--chico"
              disabled={ids.length === 0}
              onClick={() => (todosMarcados ? onDesmarcar(ids) : onMarcar(ids))}
            >
              {todosMarcados ? 'Desmarcar todos' : 'Marcar todos'}
            </button>
          </span>
        </div>

        <div className="lista-body">
          {cargando && (
            <div className="vacio">
              <span className="spin spin--oscuro" aria-hidden="true" />
              <span className="vacio-tit">Buscando tractores en el Inventario…</span>
            </div>
          )}

          {!cargando && tractores.length === 0 && !error && (
            <div className="vacio">
              <span className="vacio-ic">
                <i className="fa-solid fa-tractor" aria-hidden="true" />
              </span>
              <span className="vacio-tit">{vacioTitulo}</span>
              <span className="vacio-det">{vacioDetalle}</span>
            </div>
          )}

          {!cargando &&
            tractores.map((t) => {
              const marcado = seleccionados.has(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={marcado}
                  className={`trow${marcado ? ' trow--sel' : ''}`}
                  onClick={() => onAlternar(t.id)}
                >
                  <span className="trow-check">
                    {marcado && <i className="fa-solid fa-check" aria-hidden="true" />}
                  </span>
                  <span className="trow-nom">
                    <span className="trow-nom-txt">{t.nombre}</span>
                    <EtiquetasTractor
                      numInterno={t.numInterno}
                      modelo={t.modelo}
                      estadoRodado={t.estadoRodado}
                    />
                    {mostrarEstadoPago && (
                      <span className={`chip ${tonoEstadoInventario(t.estadoPago)}`}>
                        {t.estadoPago || 'sin estado'}
                      </span>
                    )}
                  </span>
                  <span className="trow-meta">
                    <span className="trow-fecha" title="Fecha de producción">
                      {fechaCorta(t.fechaProd)}
                    </span>
                    <span className="trow-neto">{importe(t.valorNeto)}</span>
                  </span>
                </button>
              )
            })}
        </div>
      </div>
    </>
  )
}
