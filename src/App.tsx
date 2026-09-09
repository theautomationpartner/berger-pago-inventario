import { useState } from 'react'
import { BarraMarca } from '@/components/ui/BarraMarca'
import { SelectorOperacion } from '@/components/ui/SelectorOperacion'
import { CargarTransferencia } from '@/features/pago/CargarTransferencia'
import { FlujoAvancePago } from '@/features/pago/FlujoAvancePago'
import { FLUJOS } from '@/lib/flujos'
import { mondayHabilitado } from '@/services/monday/sdk'
import type { Operacion } from '@/types'

/**
 * Vista de tablero de BERGER S.A. — Pago de Inventario de Tractores.
 *
 * La app se monta como un tablero más dentro del workspace de monday, y se usa tanto desde la
 * computadora como desde la app del celular. Arriba, la marca y el selector de operación; abajo,
 * la operación elegida con su propio flujo.
 *
 * Cada operación se remonta con `key`: al cambiar de tarjeta se descarta el estado de la anterior
 * en vez de arrastrarlo. Una selección que sobrevive a un cambio de operación es exactamente la
 * clase de dato viejo que termina registrándose sin que nadie lo mire.
 */
export function App() {
  const [operacion, setOperacion] = useState<Operacion>('cargar')
  const [ronda, setRonda] = useState(0)

  const cambiar = (op: Operacion) => {
    setOperacion(op)
    setRonda((n) => n + 1)
  }

  if (!mondayHabilitado()) {
    return (
      <div className="app">
        <BarraMarca titulo="Pago de Inventario" subtitulo="Tractores · BERGER S.A." />
        <div className="scroll">
          <div className="view">
            <div className="aviso aviso--error">
              <i className="fa-solid fa-key" aria-hidden="true" />
              <span>
                Falta el token de Monday. Copiá <code>.env.example</code> a{' '}
                <code>.env.local</code>, completá <code>VITE_MONDAY_TOKEN</code> y reiniciá{' '}
                <code>npm run dev</code>.
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <BarraMarca titulo="Pago de Inventario" subtitulo="Tractores · BERGER S.A." />

      <div className="barra-ops">
        <div className="view">
          <SelectorOperacion activa={operacion} onCambiar={cambiar} />
        </div>
      </div>

      {operacion === 'cargar' ? (
        <CargarTransferencia key={ronda} />
      ) : (
        <FlujoAvancePago key={ronda} flujo={FLUJOS[operacion]} />
      )}
    </div>
  )
}
