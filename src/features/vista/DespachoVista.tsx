import { ListaTractores } from '@/features/tractores/ListaTractores'
import { ResumenSeleccion } from '@/features/tractores/ResumenSeleccion'
import { useSeleccionTractores, useTractores } from '@/features/tractores/useTractores'
import { importe } from '@/lib/format'
import { tractoresParaDespachoVista } from '@/services/monday/inventario'

/**
 * Despacho a la VISTA (contra VL): un único paso.
 *
 * Se eligen del Inventario los tractores con Forma de Pago en VISTA y se arma el pedido, que se
 * hace SIN pago previo y se va a enviar por mail. Por ahora la pantalla llega hasta la selección
 * con el detalle completo y el total: el envío todavía no está implementado, y el botón lo dice en
 * vez de fingir que hace algo.
 *
 * A diferencia del ANTICIPADO, acá se muestra el Estado Pago de cada tractor. En el anticipado
 * todos los de la lista están, por definición, en "Listo para Pagar"; en la vista no hay un estado
 * que los filtre, así que ver en cuál está cada uno es parte de decidir si se pide.
 */
export function DespachoVista() {
  const { tractores, cargando, error, recargar } = useTractores(tractoresParaDespachoVista)
  const { seleccionados, alternar, marcar, desmarcar, elegidos, total } =
    useSeleccionTractores(tractores)

  return (
    <>
      <div className="scroll">
        <div className="view">
          <div className="sec-head">
            <span className="sec-num">
              <i className="fa-solid fa-paper-plane" aria-hidden="true" />
            </span>
            <span className="sec-txt">
              <span className="sec-tit">Pedido a la vista</span>
              <span className="sec-det">
                Tractores del Inventario con Forma de Pago en <b>VISTA</b>. El pedido se hace sin
                pago previo.
              </span>
            </span>
          </div>

          <div className="filtros">
            <span className="filtros-nota filtros-nota--sola">
              <i className="fa-solid fa-rotate" aria-hidden="true" />
              Datos en vivo del Inventario
              <button
                type="button"
                className="btn btn--borde btn--chico"
                onClick={() => void recargar()}
              >
                Actualizar
              </button>
            </span>
          </div>

          <ListaTractores
            tractores={tractores}
            seleccionados={seleccionados}
            onAlternar={alternar}
            onMarcar={marcar}
            onDesmarcar={desmarcar}
            cargando={cargando}
            error={error}
            onReintentar={() => void recargar()}
            vacioTitulo="No hay tractores para pedir a la vista"
            vacioDetalle='Ningún tractor del Inventario tiene la Forma de Pago en "VISTA".'
            mostrarEstadoPago
          />

          <ResumenSeleccion
            tractores={elegidos}
            onQuitar={alternar}
            titulo="Tractores de este pedido"
            detalleTotal="a la vista"
          />
        </div>
      </div>

      <footer className="pie">
        <div className="pie-info">
          <span className="font-b">
            {elegidos.length} tractor{elegidos.length === 1 ? '' : 'es'} seleccionado
            {elegidos.length === 1 ? '' : 's'}
          </span>
          <span className="xs">Total valor neto: {importe(total)}</span>
        </div>

        <div className="pie-acciones">
          <span className="chip chip--ambar pie-nota">
            <i className="fa-solid fa-clock" aria-hidden="true" /> Envío por mail: próximamente
          </span>
          <button
            type="button"
            className="btn btn--marca"
            disabled
            title="El envío del pedido por mail todavía no está disponible"
          >
            <i className="fa-solid fa-paper-plane" aria-hidden="true" /> Enviar pedido
          </button>
        </div>
      </footer>
    </>
  )
}
