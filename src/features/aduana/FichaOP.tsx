import { fechaCorta } from '@/lib/format'
import { diasSinNovedades } from '@/lib/despachos'
import type { DespachoOP } from '@/types'

/** Un dato de la ficha. Vacío se dice, no se deja en blanco. */
function Dato({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="dato">
      <span className="dato-lbl">{rotulo}</span>
      <span className="dato-val">{valor || '—'}</span>
    </div>
  )
}

/**
 * Los datos actuales de una OP, tal como están hoy en monday.
 *
 * Es lo que se despliega antes de editar: nadie debería cambiar un estado sin ver primero qué
 * decía. Incluye los datos del despacho que el despachante NO puede tocar —proveedor, país,
 * contenedores— porque son los que le permiten reconocer de qué carga se trata.
 */
export function FichaOP({ op }: { op: DespachoOP }) {
  const dias = diasSinNovedades(op.ultimaActualizacion)

  return (
    <div className="datos">
      <Dato rotulo="Estado de carga" valor={op.estadoCarga} />
      <Dato rotulo="ETA" valor={op.eta ? fechaCorta(op.eta) : ''} />
      <Dato rotulo="N° Op Despachante" valor={op.nroOp} />
      <Dato rotulo="Vía de transporte" valor={op.viaTransporte} />
      <Dato rotulo="Buque" valor={op.buque} />
      <Dato rotulo="Nro doc de transporte" valor={op.nroDocTransporte} />
      <Dato rotulo="Contenedor de referencia" valor={op.contenedorRef} />
      <Dato rotulo="Contenedores" valor={op.cantidadContenedores?.toString() ?? ''} />
      <Dato rotulo="País de origen" valor={op.paisOrigen} />
      <Dato rotulo="Proveedor" valor={op.proveedor} />
      <Dato rotulo="Despachante" valor={op.despachante} />
      <Dato
        rotulo="Últimas novedades"
        valor={dias == null ? '' : dias === 0 ? 'Hoy' : dias === 1 ? 'Ayer' : `Hace ${dias} días`}
      />
      {op.observaciones && (
        <div className="dato" style={{ gridColumn: '1 / -1' }}>
          <span className="dato-lbl">Observaciones de la carga</span>
          <span className="dato-val" style={{ whiteSpace: 'pre-wrap' }}>
            {op.observaciones}
          </span>
        </div>
      )}
    </div>
  )
}
