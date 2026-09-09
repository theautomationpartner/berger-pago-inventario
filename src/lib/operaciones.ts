import type { DefinicionOperacion } from '@/types'

/**
 * Las tres operaciones del circuito de pago de inventario, en el orden real en que ocurren.
 *
 * El orden del array ES el del circuito: cada operación toma los pagos que dejó la anterior.
 */
export const OPERACIONES: DefinicionOperacion[] = [
  {
    id: 'cargar',
    titulo: 'Cargar Transferencia',
    detalle: 'Elegí los tractores listos para pagar del mes y adjuntá el comprobante.',
    icono: 'fa-solid fa-file-arrow-up',
  },
  {
    id: 'aprobar',
    titulo: 'Aprobar Transferencia',
    detalle: 'Adjuntá la transferencia con número y avisale al proveedor que quedó aprobada.',
    icono: 'fa-solid fa-circle-check',
  },
  {
    id: 'confirmar',
    titulo: 'Confirmar Pago',
    detalle: 'Cerrá el circuito con el comprobante del banco que acredita el depósito.',
    icono: 'fa-solid fa-landmark',
  },
]
