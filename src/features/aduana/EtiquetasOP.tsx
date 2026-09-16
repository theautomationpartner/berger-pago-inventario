import { tonoEstadoCarga, tonoEta } from '@/lib/chips'
import { diasHastaEta, textoEta } from '@/lib/despachos'
import type { DespachoOP } from '@/types'

interface Props {
  op: DespachoOP
  /** El ETA ocupa lugar; en las listas largas alcanza con el estado. */
  conEta?: boolean
}

/**
 * Las etiquetas que identifican una OP de un vistazo.
 *
 * Son las mismas en la lista, en el editor y en el resumen. Es una sola pieza a propósito: si cada
 * pantalla armara las suyas, alcanzaría con que una se olvide el estado para que el despachante
 * deje de poder confiar en que lo que no ve es porque no existe.
 *
 * Ninguna va en gris. El ID del despacho y el N° de OP son los dos nombres con los que se habla de
 * la misma carga —el de monday y el del despachante— y por eso están siempre los dos; cuando el N°
 * todavía no se cargó, se dice, en vez de desaparecer.
 */
export function EtiquetasOP({ op, conEta = false }: Props) {
  const dias = diasHastaEta(op.eta)

  return (
    <>
      {op.idDespacho && (
        <span className="chip chip--indigo" title="ID del despacho en monday">
          {op.idDespacho}
        </span>
      )}
      <span className={`chip ${tonoEstadoCarga(op.estadoCarga)}`} title="Estado de carga">
        {op.estadoCarga || 'Sin estado'}
      </span>
      {op.nroOp ? (
        <span className="chip chip--teal" title="N° Op Despachante">
          OP {op.nroOp}
        </span>
      ) : (
        <span className="chip chip--naranja" title="N° Op Despachante">
          Sin N° de OP
        </span>
      )}
      {conEta && (
        <span className={`chip ${tonoEta(dias)}`} title="Fecha estimada de arribo">
          <i className="fa-solid fa-ship" aria-hidden="true" /> {textoEta(dias)}
        </span>
      )}
      {op.paisOrigen && (
        <span className="chip chip--magenta" title="País de origen">
          {op.paisOrigen}
        </span>
      )}
      {op.cantidadContenedores != null && op.cantidadContenedores > 0 && (
        <span className="chip chip--violeta" title="Contenedores">
          {op.cantidadContenedores} cont.
        </span>
      )}
    </>
  )
}
