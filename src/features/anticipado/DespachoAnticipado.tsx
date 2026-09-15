import { useState } from 'react'
import { SelectorEtapa } from '@/components/ui/SelectorEtapa'
import { FLUJOS } from '@/lib/flujos'
import type { EtapaAnticipado } from '@/types'
import { CargarTransferencia } from './CargarTransferencia'
import { FlujoAvancePago } from './FlujoAvancePago'

/**
 * Despacho ANTICIPADO: el circuito de pago de tres etapas.
 *
 * Es todo lo que antes era la app entera, ahora un nivel más adentro. Cada etapa se remonta con
 * `key` al cambiar de pestaña: se descarta el estado de la anterior en vez de arrastrarlo. Una
 * selección que sobrevive a un cambio de etapa es exactamente la clase de dato viejo que termina
 * registrándose sin que nadie lo mire.
 */
export function DespachoAnticipado() {
  const [etapa, setEtapa] = useState<EtapaAnticipado>('cargar')
  const [ronda, setRonda] = useState(0)

  const cambiar = (proxima: EtapaAnticipado) => {
    setEtapa(proxima)
    setRonda((n) => n + 1)
  }

  return (
    <>
      <div className="barra-ops">
        <div className="view">
          <SelectorEtapa activa={etapa} onCambiar={cambiar} />
        </div>
      </div>

      {etapa === 'cargar' ? (
        <CargarTransferencia key={ronda} />
      ) : (
        <FlujoAvancePago key={ronda} flujo={FLUJOS[etapa]} />
      )}
    </>
  )
}
