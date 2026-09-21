import { aNumero, importe } from '@/lib/format'
import { nombreDeContenedor } from '@/lib/despachos'
import type { TractorDeOp } from '@/types'

interface Props {
  tractores: TractorDeOp[]
}

/** El valor neto viene de una columna numérica: si no es un número, se muestra tal cual vino. */
const valor = (crudo: string): string => {
  const n = aNumero(crudo)
  return n === null ? crudo : importe(n)
}

/**
 * El rodado NO es un sí/no: el espejo del Inventario devuelve la etiqueta entera —"Con Rodado",
 * "Sin Rodado"— y se muestra tal cual. Lo único que se deduce es el color, y por la negativa:
 * cualquier cosa que empiece con "sin" se pinta apagada. Inventar un "Sí"/"No" propio obligaría a
 * mantener acá la lista de etiquetas del tablero.
 */
const tieneRodado = (rodado: string): boolean => !/^\s*sin\b/i.test(rodado)

/**
 * Los tractores de una OP, en etiquetas, debajo de su fila.
 *
 * Quien decide el pago y la entrega de una OP necesita ver **qué** está por pagar sin tener que
 * abrirla: cuántas unidades, de qué modelo, por cuánta plata y con qué factura. Antes eso obligaba
 * a ir a monday, y al volver ya se había perdido de vista la lista.
 *
 * Arriba va el resumen por modelo —`2 x 6205 G AGROTRON`—, que es como se habla de una carga; y
 * abajo una etiqueta por unidad, porque la factura, el chasis y el valor son de cada tractor y no
 * del modelo. El chasis va en monoespaciado: dos unidades iguales se distinguen sólo por ahí.
 */
export function EtiquetasTractorOp({ tractores }: Props) {
  if (tractores.length === 0) return null

  return (
    <div className="tractores-op">
      <span className="tractores-op-resumen">
        <i className="fa-solid fa-tractor" aria-hidden="true" /> {nombreDeContenedor(tractores)}
      </span>

      <div className="tractores-op-lista">
        {tractores.map((t) => (
          <span key={t.id} className="tractag">
            <span className="tractag-nom">
              {t.nombre}
              {t.modelo ? <span className="tractag-modelo"> · {t.modelo}</span> : null}
            </span>
            <span className="tractag-datos">
              {t.valorNeto ? (
                <span className="tractag-dato tractag-dato--plata">
                  <i className="fa-solid fa-dollar-sign" aria-hidden="true" />
                  {valor(t.valorNeto)}
                </span>
              ) : null}
              {t.nroFactCompra ? (
                <span className="tractag-dato">
                  <i className="fa-solid fa-file-invoice" aria-hidden="true" />
                  {t.nroFactCompra}
                </span>
              ) : null}
              {t.chasis ? (
                <span className="tractag-dato tractag-dato--chasis">{t.chasis}</span>
              ) : null}
              {/* El rodado se dice SIEMPRE, también cuando no tiene: ahí es justamente un dato que
                  cambia cómo se descarga, y un vacío se confunde con "no lo miré". */}
              <span
                className={`tractag-dato ${
                  t.rodado && tieneRodado(t.rodado) ? 'tractag-dato--si' : 'tractag-dato--no'
                }`}
              >
                <i
                  className={`fa-solid ${
                    t.rodado && tieneRodado(t.rodado) ? 'fa-circle-check' : 'fa-circle-minus'
                  }`}
                  aria-hidden="true"
                />
                {t.rodado || 'Rodado sin cargar'}
              </span>
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
