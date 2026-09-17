import type { ModuloApp } from '@/services/monday/operaciones'
import type {
  ModalidadDespacho,
  OpcionPanel,
  OperacionAduana,
  OperacionDrafts,
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
    id: 'drafts',
    modulo: 'drafts',
    titulo: 'PLANIFICACIÓN DE DRAFTS',
    corto: 'Planificación de drafts',
    detalle:
      'Período de producción de cada draft y envío de la planificación al proveedor, antes de que ' +
      'el tractor exista.',
    icono: 'fa-solid fa-calendar-check',
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

/**
 * Operaciones dentro de DESPACHANTE DE ADUANA: el segundo panel del módulo de aduana.
 *
 * El dashboard tiene su propio módulo: el despachante externo entra a actualizar los datos de sus
 * OP, no a mirar el estado de toda la operación de BERGER. Administración ve las dos.
 */
export const OPERACIONES_ADUANA: (OpcionPanel<OperacionAduana> & { modulo: ModuloApp })[] = [
  {
    id: 'actualizar',
    modulo: 'aduana',
    titulo: 'ACTUALIZAR DESPACHO OP',
    corto: 'Actualizar OP',
    detalle:
      'Actualizar los datos de una o varias OP: estado de la carga, ETA, buque y documentación.',
    icono: 'fa-solid fa-pen-to-square',
  },
  {
    id: 'dashboard',
    modulo: 'aduanaDashboard',
    titulo: 'DASHBOARD DE DESPACHOS',
    corto: 'Dashboard',
    detalle: 'Cuántas OP hay en cada estado, qué arriba primero y qué quedó sin cargar.',
    icono: 'fa-solid fa-chart-simple',
  },
]

/** Operaciones dentro de PLANIFICACIÓN DE DRAFTS: el segundo panel del módulo de drafts. */
export const OPERACIONES_DRAFTS: OpcionPanel<OperacionDrafts>[] = [
  {
    id: 'planificar',
    titulo: 'PLANIFICAR PERÍODO DE PRODUCCIÓN',
    corto: 'Planificar período',
    detalle:
      'Asignarle a cada draft leído el período en el que se le pide al proveedor que lo fabrique.',
    icono: 'fa-solid fa-calendar-plus',
  },
  {
    id: 'enviar',
    titulo: 'ENVIAR PLANIFICACIÓN',
    corto: 'Enviar planificación',
    detalle: 'Mandarle a DEUTZ los drafts ya planificados, con su período sugerido y sus PDF.',
    icono: 'fa-solid fa-paper-plane',
  },
  {
    id: 'dashboard',
    titulo: 'DASHBOARD DE DRAFTS',
    corto: 'Dashboard',
    detalle: 'Cuántos drafts hay en cada estado, qué carga se sugirió y qué está esperando acción.',
    icono: 'fa-solid fa-chart-simple',
  },
]

/** Las operaciones de aduana que puede ver este perfil. */
export const aduanaDeModulos = (modulos: ModuloApp[]): OpcionPanel<OperacionAduana>[] =>
  OPERACIONES_ADUANA.filter((o) => modulos.includes(o.modulo))

/** ¿Tiene permitida ESTA operación de aduana? Es lo que evita dibujar una pantalla que va a rebotar. */
export const puedeEnAduana = (modulos: ModuloApp[], id: OperacionAduana): boolean =>
  aduanaDeModulos(modulos).some((o) => o.id === id)

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
