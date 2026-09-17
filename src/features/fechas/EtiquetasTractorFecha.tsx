import { importe } from '@/lib/format'
import type { TractorFecha } from '@/types'

/**
 * Las etiquetas de un tractor en el módulo de fechas.
 *
 * Son las mismas en la selección, en la decisión y en el resumen de una confirmación: lo que se
 * mira para decidir una fecha es lo mismo que se mira para revisar lo que se le manda al proveedor.
 *
 * El PRIMARY STATUS va en castellano —que es lo que se lee— con el código de fábrica al lado, que
 * es como lo nombra DEUTZ en sus mails. Ninguna etiqueta va en gris.
 */
export function EtiquetasTractorFecha({ tractor }: { tractor: TractorFecha }) {
  return (
    <>
      {tractor.modelo && (
        <span className="chip chip--magenta" title="Modelo">
          {tractor.modelo}
        </span>
      )}
      {tractor.numInterno && (
        <span className="chip chip--interno" title="N° Interno">
          N° {tractor.numInterno}
        </span>
      )}
      {tractor.primaryStatus && (
        <span className="chip chip--indigo" title="Primary Status">
          {tractor.primaryStatus}
        </span>
      )}
      {tractor.primaryStatusEsp && (
        <span className="chip chip--azul" title="Primary Status (español)">
          {tractor.primaryStatusEsp}
        </span>
      )}
      {tractor.tipoRodado && (
        <span className="chip chip--lima" title="Tipo de rodado">
          {tractor.tipoRodado}
        </span>
      )}
      {tractor.precioUnitario != null && (
        <span className="chip chip--teal" title="FOB · Precio unitario">
          {importe(tractor.precioUnitario)}
        </span>
      )}
    </>
  )
}
