import type { ModalidadDespacho, OpcionPanel, OperacionPrincipal } from '@/types'

/**
 * Operaciones principales: el primer panel de la app.
 *
 * Hoy es una sola, y el panel existe igual a propósito. Es el lugar donde se van a sumar los
 * próximos tipos de operación: si la app arrancara directo en Despacho, el día que llegue la
 * segunda habría que cambiar la pantalla de entrada que todos ya aprendieron.
 */
export const OPERACIONES_PRINCIPALES: OpcionPanel<OperacionPrincipal>[] = [
  {
    id: 'despacho',
    titulo: 'DESPACHO',
    corto: 'Despacho',
    detalle: 'Despacho de tractores del inventario, con pago anticipado o a la vista.',
    icono: 'fa-solid fa-truck-ramp-box',
  },
]

/** Modalidades de despacho: el segundo panel, dentro de DESPACHO. */
export const MODALIDADES_DESPACHO: OpcionPanel<ModalidadDespacho>[] = [
  {
    id: 'anticipado',
    titulo: 'ANTICIPADO',
    corto: 'Anticipado',
    detalle:
      'El tractor se paga antes de despacharse: carga de la transferencia, aprobación y ' +
      'confirmación del pago.',
    icono: 'fa-solid fa-file-invoice-dollar',
  },
  {
    id: 'vista',
    titulo: 'VISTA (CONTRA VL)',
    corto: 'Vista',
    detalle:
      'El pedido se hace sin pago previo, con los tractores que tienen Forma de Pago en VISTA.',
    icono: 'fa-solid fa-paper-plane',
  },
]
