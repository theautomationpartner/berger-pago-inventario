import { fechaCorta } from '@/lib/format'
import type { DespachoOP } from '@/types'

/** Un dato de la ficha: rótulo arriba, valor abajo. */
function Dato({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="dato dato--ficha">
      <span className="dato-lbl">{rotulo}</span>
      <span className="dato-val">{valor}</span>
    </div>
  )
}

/**
 * Los datos actuales de una OP, tal como están hoy en monday.
 *
 * Es lo que se despliega antes de editar: nadie debería cambiar un estado sin ver primero qué
 * decía. Incluye los datos del despacho que el despachante NO puede tocar —proveedor, país, puerto,
 * contenedores— porque son los que le permiten reconocer de qué carga se trata.
 *
 * **Sólo aparece lo que está cargado.** Un campo vacío no se muestra con una raya: se omite. Una
 * ficha llena de rayas obliga a leer doce casilleros para encontrar los cuatro que tienen algo, y
 * lo que falta ya se ve igual —por ausencia— sin ocupar lugar. Si no hay nada cargado, se dice.
 */
export function FichaOP({ op }: { op: DespachoOP }) {
  const datos: { rotulo: string; valor: string }[] = [
    { rotulo: 'Estado de carga', valor: op.estadoCarga },
    { rotulo: 'ETA', valor: op.eta ? fechaCorta(op.eta) : '' },
    { rotulo: 'N° Op Despachante', valor: op.nroOp },
    { rotulo: 'Vía de transporte', valor: op.viaTransporte },
    { rotulo: 'Buque', valor: op.buque },
    { rotulo: 'Nro doc de transporte', valor: op.nroDocTransporte },
    { rotulo: 'Contenedor de referencia', valor: op.contenedorRef },
    { rotulo: 'Contenedores', valor: op.cantidadContenedores?.toString() ?? '' },
    { rotulo: 'País de origen', valor: op.paisOrigen },
    // El puerto va pegado al país: uno dice de dónde sale la mercadería, el otro de dónde zarpa.
    { rotulo: 'Puerto de origen', valor: op.puertoOrigen },
    { rotulo: 'Proveedor', valor: op.proveedor },
    { rotulo: 'Despachante', valor: op.despachante },
  ].filter((d) => d.valor.trim())

  if (datos.length === 0 && !op.observaciones.trim()) {
    return (
      <div className="vacio">
        <span className="vacio-ic">
          <i className="fa-solid fa-circle-info" aria-hidden="true" />
        </span>
        <span className="vacio-tit">Esta OP todavía no tiene datos cargados</span>
        <span className="vacio-det">Se llena desde el paso siguiente, o desde el tablero.</span>
      </div>
    )
  }

  return (
    <div className="datos">
      {datos.map((d) => (
        <Dato key={d.rotulo} rotulo={d.rotulo} valor={d.valor} />
      ))}
      {op.observaciones.trim() && (
        <div className="dato dato--ficha" style={{ gridColumn: '1 / -1' }}>
          <span className="dato-lbl">Observaciones de la carga</span>
          <span className="dato-val" style={{ whiteSpace: 'pre-wrap' }}>
            {op.observaciones}
          </span>
        </div>
      )}
    </div>
  )
}
