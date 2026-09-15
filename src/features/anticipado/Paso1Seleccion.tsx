import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { SelectorMeses } from '@/components/ui/SelectorMeses'
import { ListaTractores } from '@/features/tractores/ListaTractores'
import { ResumenSeleccion } from '@/features/tractores/ResumenSeleccion'
import { claveMes, mesesDelFiltro } from '@/lib/meses'
import { mesDeProduccion } from '@/services/monday/inventario'
import type { Tractor } from '@/types'

interface Props {
  /** TODOS los tractores listos para pagar, sin filtrar por mes. */
  tractores: Tractor[]
  /** Claves (`2026-09`) de los meses elegidos en el filtro. Vacío = todos los meses. */
  mesesElegidos: string[]
  onCambiarMeses: (claves: string[]) => void
  seleccionados: Set<string>
  onAlternar: (id: string) => void
  onMarcar: (ids: string[]) => void
  onDesmarcar: (ids: string[]) => void
  cargando: boolean
  error: string | null
  onReintentar: () => void
  /** Resumen de contenedores, armado con lo que se lleva elegido. */
  contenedores: ReactNode
}

/**
 * Paso 1 del despacho ANTICIPADO: qué tractores entran en la transferencia.
 *
 * Arranca mostrando TODOS los tractores listos para pagar. Los meses de producción se eligen como
 * etiquetas combinables: sin ninguna, se ve todo; con una o más, sólo los de esos meses.
 *
 * El filtro se aplica sobre la lista ya cargada, no vuelve a consultar monday. Agregar o quitar un
 * mes es instantáneo, y —sobre todo— no borra la selección: los tractores ya elegidos quedan en el
 * resumen de abajo aunque su mes deje de estar en el filtro. Así se puede armar una transferencia
 * con tractores de varios meses eligiendo de a uno por vez.
 */
export function Paso1Seleccion({
  tractores,
  mesesElegidos,
  onCambiarMeses,
  seleccionados,
  onAlternar,
  onMarcar,
  onDesmarcar,
  cargando,
  error,
  onReintentar,
  contenedores,
}: Props) {
  const meses = useMemo(() => mesesDelFiltro(), [])

  /* Cuántos tractores listos hay en cada mes: se muestra en cada opción del desplegable. */
  const conteos = useMemo(() => {
    const cuenta = new Map<string, number>()
    for (const t of tractores) {
      const m = mesDeProduccion(t)
      if (m) cuenta.set(claveMes(m), (cuenta.get(claveMes(m)) ?? 0) + 1)
    }
    return cuenta
  }, [tractores])

  const visibles = useMemo(() => {
    if (mesesElegidos.length === 0) return tractores
    const filtro = new Set(mesesElegidos)
    return tractores.filter((t) => {
      const m = mesDeProduccion(t)
      return m != null && filtro.has(claveMes(m))
    })
  }, [tractores, mesesElegidos])

  const elegidos = tractores.filter((t) => seleccionados.has(t.id))
  const sinFecha = tractores.filter((t) => !t.fechaProd).length

  return (
    <>
      <div className="sec-head">
        <span className="sec-num">1</span>
        <span className="sec-txt">
          <span className="sec-tit">Tractores listos para pagar</span>
          <span className="sec-det">
            Del tablero de Inventario, con Estado Pago en <b>Listo para Pagar</b>. Filtrá por mes de
            producción eligiendo uno o más meses.
          </span>
        </span>
      </div>

      <div className="filtros">
        <div className="campo filtros-meses">
          <span className="campo-lbl">Mes de producción</span>
          <SelectorMeses
            meses={meses}
            elegidos={mesesElegidos}
            onCambiar={onCambiarMeses}
            conteos={conteos}
          />
        </div>
        <span className="filtros-nota">
          <i className="fa-solid fa-rotate" aria-hidden="true" />
          Datos en vivo del Inventario
          <button type="button" className="btn btn--borde btn--chico" onClick={onReintentar}>
            Actualizar
          </button>
        </span>
      </div>

      {/* Los tractores sin Fecha de Prod no pueden caer en ningún mes: con un filtro activo
          desaparecen sin explicación, así que se avisa cuántos quedan afuera. */}
      {mesesElegidos.length > 0 && sinFecha > 0 && (
        <div className="aviso aviso--alerta">
          <i className="fa-solid fa-calendar-xmark" aria-hidden="true" />
          <span>
            {sinFecha} tractor{sinFecha === 1 ? '' : 'es'} listo{sinFecha === 1 ? '' : 's'} para
            pagar no tiene{sinFecha === 1 ? '' : 'n'} Fecha de Prod cargada y no aparece
            {sinFecha === 1 ? '' : 'n'} con el filtro de meses. Quitá el filtro para verlos.
          </span>
        </div>
      )}

      <ListaTractores
        tractores={visibles}
        seleccionados={seleccionados}
        onAlternar={onAlternar}
        onMarcar={onMarcar}
        onDesmarcar={onDesmarcar}
        cargando={cargando}
        error={error}
        onReintentar={onReintentar}
        vacioTitulo={
          mesesElegidos.length > 0
            ? 'No hay tractores listos para pagar en esos meses'
            : 'No hay tractores listos para pagar'
        }
        vacioDetalle={
          mesesElegidos.length > 0
            ? 'Ninguno de los meses elegidos tiene tractores con Estado Pago en "Listo para Pagar". Sumá otros meses o quitá el filtro.'
            : 'Ningún tractor del Inventario tiene el Estado Pago en "Listo para Pagar".'
        }
      />

      <ResumenSeleccion
        tractores={elegidos}
        onQuitar={onAlternar}
        titulo="Tractores de esta transferencia"
      />

      {contenedores}
    </>
  )
}
