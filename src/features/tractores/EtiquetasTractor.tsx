import { tonoRodado } from '@/lib/chips'

interface Props {
  numInterno: string
  modelo: string
  estadoRodado: string
  /** La forma de pago se muestra sólo donde aporta: en ANTICIPADO todas dicen lo mismo. */
  formaPago?: string
}

/**
 * Las etiquetas que identifican a un tractor de un vistazo: número interno, modelo y rodado.
 *
 * Es UNA pieza y no tres `<span>` sueltos repetidos en cada pantalla porque tienen que verse
 * igual en todos los pasos —la lista de selección, el detalle, el resumen, la ficha del pago y el
 * despacho a la vista—. Repartidas, alcanza con que una pantalla se olvide del rodado para que el
 * usuario deje de poder confiar en que la etiqueta que no ve es porque no existe.
 *
 * El número interno y el modelo se omiten si están vacíos, porque su ausencia no dice nada. El
 * rodado NO se omite: que falte es justamente algo a mirar antes de despachar, y por eso aparece
 * en rojo en vez de desaparecer.
 */
export function EtiquetasTractor({ numInterno, modelo, estadoRodado, formaPago }: Props) {
  return (
    <>
      {numInterno && <span className="chip chip--interno">N° {numInterno}</span>}
      {modelo && (
        <span className="chip chip--magenta" title="Modelo">
          {modelo}
        </span>
      )}
      <span className={`chip ${tonoRodado(estadoRodado)}`} title="Estado Rodado">
        {estadoRodado || 'Rodado sin cargar'}
      </span>
      {formaPago && <span className="chip chip--violeta">{formaPago}</span>}
    </>
  )
}
