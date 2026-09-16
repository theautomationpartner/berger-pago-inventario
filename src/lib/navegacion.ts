import type { ModuloApp } from '@/services/monday/operaciones'
import type {
  ModalidadDespacho,
  OpcionPanel,
  OperacionAduana,
  OperacionPrincipal,
} from '@/types'

/**
 * Operaciones principales: el primer panel de la app.
 *
 * Cada una pertenece a un módulo, y cada persona ve sólo las de los módulos que tiene habilitados:
 * la gente de BERGER despacha, el despachante de aduana actualiza las OP. Esconderlas es sólo
 * comodidad —el permiso lo aplica el servidor en cada pedido—, pero ofrecerle a alguien una
 * pantalla que va a rebotar es peor que no ofrecérsela.
 */
export const OPERACIONES_PRINCIPALES: (OpcionPanel<OperacionPrincipal> & { modulo: ModuloApp })[] = [
  {
    id: 'despacho',
    modulo: 'despacho',
    titulo: 'DESPACHO',
    corto: 'Despacho',
    detalle: 'Despacho de tractores del inventario, con pago anticipado o a la vista.',
    icono: 'fa-solid fa-truck-ramp-box',
  },
  {
    id: 'aduana',
    modulo: 'aduana',
    titulo: 'DESPACHANTE DE ADUANA',
    corto: 'Despachante de aduana',
    detalle:
      'Seguimiento de las OP ya despachadas: estado de la carga, arribos y datos del transporte.',
    icono: 'fa-solid fa-passport',
  },
]

/** Las operaciones principales que puede ver este perfil. */
export const principalesDeModulos = (
  modulos: ModuloApp[],
): OpcionPanel<OperacionPrincipal>[] =>
  OPERACIONES_PRINCIPALES.filter((o) => modulos.includes(o.modulo))

/** Operaciones dentro de DESPACHANTE DE ADUANA: el segundo panel del módulo de aduana. */
export const OPERACIONES_ADUANA: OpcionPanel<OperacionAduana>[] = [
  {
    id: 'actualizar',
    titulo: 'ACTUALIZAR DESPACHO OP',
    corto: 'Actualizar OP',
    detalle:
      'Cargar las novedades de una o varias OP: estado de la carga, ETA, buque y documentación.',
    icono: 'fa-solid fa-pen-to-square',
  },
  {
    id: 'dashboard',
    titulo: 'DASHBOARD DE DESPACHOS',
    corto: 'Dashboard',
    detalle: 'Cuántas OP hay en cada estado, qué arriba primero y qué quedó sin cargar.',
    icono: 'fa-solid fa-chart-simple',
  },
]

/** Modalidades de despacho: el segundo panel, dentro de DESPACHO. */
export const MODALIDADES_DESPACHO: OpcionPanel<ModalidadDespacho>[] = [
  {
    id: 'anticipado',
    titulo: 'PAGO ANTICIPADO',
    corto: 'Pago anticipado',
    detalle:
      'El tractor se paga antes de despacharse: carga de la transferencia, aprobación y ' +
      'confirmación del pago.',
    icono: 'fa-solid fa-file-invoice-dollar',
  },
  {
    id: 'vista',
    titulo: 'PAGO VISTA (Contra BL)',
    corto: 'Pago vista',
    detalle:
      'El pedido se hace sin pago previo, con los tractores que tienen Forma de Pago en VISTA.',
    icono: 'fa-solid fa-paper-plane',
  },
]
