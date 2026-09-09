import { useState } from 'react'
import { fechaCorta, importe } from '@/lib/format'
import type { Tractor } from '@/types'

interface Props {
  tractores: Tractor[]
  onQuitar: (id: string) => void
}

/**
 * Lista desplegable de los tractores elegidos.
 *
 * Cada fila cerrada muestra sólo el nombre y el valor neto —lo que hace falta para revisar la
 * selección de un vistazo—; el detalle completo (flete, precio unitario, forma de pago, número
 * interno, fecha de producción) aparece al abrirla. Con quince tractores seleccionados, mostrar
 * las cinco columnas de todos a la vez convierte la revisión en un scroll interminable.
 *
 * Qué filas están abiertas se guarda por ID en un `Set` y no por índice: quitar un tractor del
 * medio correría los índices y dejaría abierta una fila que el usuario nunca tocó.
 */
export function ListaSeleccionados({ tractores, onQuitar }: Props) {
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())

  const alternar = (id: string) =>
    setAbiertos((previos) => {
      const proximos = new Set(previos)
      if (proximos.has(id)) proximos.delete(id)
      else proximos.add(id)
      return proximos
    })

  return (
    <div className="sel-lista">
      {tractores.map((t) => {
        const abierto = abiertos.has(t.id)
        return (
          <div key={t.id} className={`sel-item${abierto ? ' sel-item--abierto' : ''}`}>
            <button
              type="button"
              className="sel-head"
              aria-expanded={abierto}
              onClick={() => alternar(t.id)}
            >
              <span className="sel-caret">
                <i className="fa-solid fa-chevron-right" aria-hidden="true" />
              </span>
              <span className="sel-nom">{t.nombre}</span>
              {t.numInterno && <span className="chip chip--interno">N° {t.numInterno}</span>}
              <span className="sel-head-neto">{importe(t.valorNeto)}</span>
            </button>

            {abierto && (
              <div className="sel-cuerpo">
                <div className="datos">
                  <div className="dato">
                    <span className="dato-lbl">Costo de flete</span>
                    <span className="dato-val">{importe(t.costoFlete)}</span>
                  </div>
                  <div className="dato">
                    <span className="dato-lbl">Precio unitario</span>
                    <span className="dato-val">{importe(t.precioUnitario)}</span>
                  </div>
                  <div className="dato dato--neto">
                    <span className="dato-lbl">Valor neto</span>
                    <span className="dato-val">{importe(t.valorNeto)}</span>
                  </div>
                  <div className="dato dato--forma">
                    <span className="dato-lbl">Forma de pago</span>
                    <span className="dato-val">{t.formaPago || '—'}</span>
                  </div>
                  <div className="dato">
                    <span className="dato-lbl">N° de draft</span>
                    <span className="dato-val">{t.numDraft || '—'}</span>
                  </div>
                  <div className="dato">
                    <span className="dato-lbl">Cod. de producto</span>
                    <span className="dato-val">{t.codProducto || '—'}</span>
                  </div>
                  <div className="dato">
                    <span className="dato-lbl">Fecha de prod.</span>
                    <span className="dato-val">{fechaCorta(t.fechaProd)}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn btn--borde btn--chico"
                    onClick={() => onQuitar(t.id)}
                  >
                    <i className="fa-solid fa-xmark" aria-hidden="true" /> Sacar de la transferencia
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
