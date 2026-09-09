import type { DefinicionOperacion } from '@/types'

/**
 * Las tres operaciones del circuito de pago de inventario, en el orden real en que ocurren.
 *
 * Las dos últimas se muestran desde ahora aunque todavía no estén implementadas: el usuario tiene
 * que ver el circuito completo para saber dónde está parado, y una operación que aparece recién
 * cuando se programa cambia la pantalla debajo de los pies de quien ya la aprendió.
 */
export const OPERACIONES: DefinicionOperacion[] = [
  {
    id: 'cargar',
    titulo: 'Cargar Transferencia',
    detalle: 'Elegí los tractores listos para pagar del mes y adjuntá el comprobante.',
    icono: 'fa-solid fa-file-arrow-up',
    disponible: true,
  },
  {
    id: 'aprobar',
    titulo: 'Aprobar Transferencia',
    detalle: 'Revisión de las transferencias cargadas antes de mandarlas al banco.',
    icono: 'fa-solid fa-circle-check',
    disponible: false,
  },
  {
    id: 'confirmar',
    titulo: 'Confirmar Pago',
    detalle: 'Cierre del pago con el comprobante del banco y el número de transferencia.',
    icono: 'fa-solid fa-landmark',
    disponible: false,
  },
]
