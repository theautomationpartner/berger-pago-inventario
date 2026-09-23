import { useState } from 'react'
import { importe, fechaCorta } from '@/lib/format'
import type { Draft } from '@/types'

/** Un importe con su divisa: 43.298,22 EUR. Sin divisa, el número solo. */
const conDivisa = (valor: number | null, divisa: string): string =>
  valor == null ? '—' : divisa ? `${importe(valor)} ${divisa}` : importe(valor)

/**
 * Las etiquetas de un draft: todo lo que el PDF trajo, de un vistazo.
 *
 * Ninguna va en gris y ninguna se omite por estar vacía salvo el número de orden de pedido, cuya
 * ausencia no dice nada. El costo de transporte se rotula con la condición que lo eligió —FOB o
 * FCA— para que no haya que adivinar de cuál de los dos se está hablando.
 */
export function EtiquetasDraft({ draft }: { draft: Draft }) {
  return (
    <>
      {draft.idDraft && (
        <span className="chip chip--indigo" title="ID del draft en monday">
          {draft.idDraft}
        </span>
      )}
      <span className="chip chip--azul" title="Fecha del draft">
        <i className="fa-solid fa-calendar" aria-hidden="true" />{' '}
        {draft.fecha ? fechaCorta(draft.fecha) : 'Sin fecha'}
      </span>
      {draft.ordenPedido && (
        <span className="chip chip--teal" title="NR. de Orden de Pedido">
          Pedido {draft.ordenPedido}
        </span>
      )}
      <span className="chip chip--magenta" title="Condición de entrega">
        {draft.condicionEntrega || 'Sin condición'}
      </span>
      <span className="chip chip--lima" title="Transporte">
        {draft.transporte || 'Sin transporte'}
      </span>
      <span className="chip chip--violeta" title="Forma de pago">
        {draft.formaPago || 'Sin forma de pago'}
      </span>
      <span className="chip chip--naranja" title="Divisa">
        {draft.divisa || 'Sin divisa'}
      </span>
      {draft.periodo && (
        <span className="chip chip--verde" title="Período de producción sugerido">
          <i className="fa-solid fa-industry" aria-hidden="true" /> {draft.periodo}
        </span>
      )}
    </>
  )
}

/** Los dos importes del encabezado: el transporte que corresponde y el total. */
export function ImportesDraft({ draft }: { draft: Draft }) {
  return (
    <span className="draft-importes">
      <span className="draft-importe">
        <span className="draft-importe-lbl">{draft.rotuloTransporte}</span>
        <span className="draft-importe-val">{conDivisa(draft.costoTransporte, draft.divisa)}</span>
      </span>
      <span className="draft-importe draft-importe--total">
        <span className="draft-importe-lbl">Total del draft</span>
        <span className="draft-importe-val">{conDivisa(draft.total, draft.divisa)}</span>
      </span>
    </span>
  )
}

/** Los productos del draft: lo que el proveedor va a fabricar. */
export function ProductosDraft({ draft }: { draft: Draft }) {
  if (draft.productos.length === 0) {
    return (
      <div className="vacio">
        <span className="vacio-ic">
          <i className="fa-solid fa-box-open" aria-hidden="true" />
        </span>
        <span className="vacio-tit">Este draft no tiene productos cargados</span>
        <span className="vacio-det">
          La lectura del PDF no generó subelementos. Revisalo en el tablero antes de planificarlo.
        </span>
      </div>
    )
  }

  return (
    <div className="productos">
      {draft.productos.map((p) => (
        <div key={p.id} className="producto">
          <div className="producto-head">
            <span className="producto-nom">{p.nombre}</span>
            <span className="chip chip--lima" title="Tipo de rodado">
              {p.rodado || 'Sin rodado'}
            </span>
            <span className="chip chip--indigo" title="Cantidad">
              {p.cantidad ?? '—'} u.
            </span>
          </div>
          <div className="datos">
            <div className="dato">
              <span className="dato-lbl">Precio unitario</span>
              <span className="dato-val">{conDivisa(p.precioUnitario, draft.divisa)}</span>
            </div>
            <div className="dato">
              <span className="dato-lbl">{draft.rotuloTransporte}</span>
              <span className="dato-val">{conDivisa(p.costoTransporte, draft.divisa)}</span>
            </div>
            <div className="dato">
              <span className="dato-lbl">Valor neto</span>
              <span className="dato-val">{conDivisa(p.valorNeto, draft.divisa)}</span>
            </div>
            <div className="dato dato--neto">
              <span className="dato-lbl">Subtotal</span>
              <span className="dato-val">{conDivisa(p.subtotal, draft.divisa)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

interface Props {
  drafts: Draft[]
  seleccion: string[]
  onAlternar: (draft: Draft) => void
  cargando: boolean
  error: string | null
  onReintentar: () => void
  vacioTitulo: string
  vacioDetalle: string
}

/**
 * La lista de drafts con su desplegable de productos.
 *
 * Es la MISMA en las dos operaciones del módulo —planificar y enviar— a propósito: lo que se mira
 * para decidir un período es lo mismo que se mira para decidir si se manda, y dos listas distintas
 * terminarían mostrando datos distintos del mismo draft.
 */
export function ListaDrafts({
  drafts,
  seleccion,
  onAlternar,
  cargando,
  error,
  onReintentar,
  vacioTitulo,
  vacioDetalle,
}: Props) {
  const [abierto, setAbierto] = useState<string | null>(null)

  return (
    <div className="lista">
      <div className="lista-head">
        <span>Draft</span>
        <span className="lista-head-acciones">
          <button type="button" className="btn btn--borde btn--chico" onClick={onReintentar}>
            <i className="fa-solid fa-rotate" aria-hidden="true" /> Actualizar
          </button>
        </span>
      </div>

      <div className="lista-body">
        {cargando && (
          <div className="vacio">
            <span className="spin spin--oscuro" aria-hidden="true" />
            <span className="vacio-tit">Buscando drafts…</span>
          </div>
        )}

        {error && !cargando && (
          <div className="vacio">
            <span className="vacio-ic">
              <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
            </span>
            <span className="vacio-tit">No se pudo leer el tablero de Drafts</span>
            <span className="vacio-det">{error}</span>
          </div>
        )}

        {!cargando && !error && drafts.length === 0 && (
          <div className="vacio">
            <span className="vacio-ic">
              <i className="fa-solid fa-inbox" aria-hidden="true" />
            </span>
            <span className="vacio-tit">{vacioTitulo}</span>
            <span className="vacio-det">{vacioDetalle}</span>
          </div>
        )}

        {!cargando &&
          drafts.map((draft) => {
            const marcado = seleccion.includes(draft.id)
            const desplegado = abierto === draft.id
            return (
              <div key={draft.id} className={`opfila${marcado ? ' opfila--sel' : ''}`}>
                <div className="opfila-head">
                  <button
                    type="button"
                    aria-pressed={marcado}
                    className="opfila-marca"
                    onClick={() => onAlternar(draft)}
                  >
                    <span className={`trow-check${marcado ? ' trow-check--sel' : ''}`}>
                      {marcado && <i className="fa-solid fa-check" aria-hidden="true" />}
                    </span>
                    <span className="opfila-nom">Draft {draft.nombre}</span>
                  </button>

                  <span className="opfila-chips">
                    <EtiquetasDraft draft={draft} />
                  </span>

                  <button
                    type="button"
                    className="btn btn--texto btn--chico opfila-ver"
                    aria-expanded={desplegado}
                    onClick={() => setAbierto(desplegado ? null : draft.id)}
                  >
                    <i
                      className={`fa-solid fa-chevron-${desplegado ? 'up' : 'down'}`}
                      aria-hidden="true"
                    />{' '}
                    {draft.productos.length} producto{draft.productos.length === 1 ? '' : 's'}
                  </button>
                </div>

                <div className="opfila-head opfila-head--importes">
                  <ImportesDraft draft={draft} />
                </div>

                {desplegado && (
                  <div className="opfila-cuerpo">
                    <ProductosDraft draft={draft} />
                  </div>
                )}
              </div>
            )
          })}
      </div>
    </div>
  )
}
