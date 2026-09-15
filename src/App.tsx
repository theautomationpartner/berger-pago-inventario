import { useState } from 'react'
import { BarraMarca } from '@/components/ui/BarraMarca'
import {
  PantallaSinAcceso,
  PantallaVerificando,
} from '@/components/ui/PantallaSinAcceso'
import { DespachoAnticipado } from '@/features/anticipado/DespachoAnticipado'
import { Migas, type Miga } from '@/features/inicio/Migas'
import { PanelOpciones } from '@/features/inicio/PanelOpciones'
import { DespachoVista } from '@/features/vista/DespachoVista'
import { useAccesoMonday } from '@/hooks/useAccesoMonday'
import { MODALIDADES_DESPACHO, OPERACIONES_PRINCIPALES } from '@/lib/navegacion'
import { mondayHabilitado } from '@/services/monday/sdk'
import type { ModalidadDespacho, OperacionPrincipal } from '@/types'

const TITULO = 'Operaciones de Inventario'
const SUBTITULO = 'Tractores · BERGER S.A.'

/**
 * Vista de tablero de BERGER S.A. — Operaciones de Inventario de Tractores.
 *
 * La app se monta como un tablero más dentro del workspace de monday, y se usa tanto desde la
 * computadora como desde la app del celular.
 *
 * Lo PRIMERO que pasa es la verificación de acceso, antes de dibujar cualquier otra cosa. La app
 * se puede instalar en cualquier cuenta de monday y su URL es pública, así que hasta que monday
 * no confirme que del otro lado hay un usuario de BERGER, lo único que existe en pantalla es el
 * cartel de acceso denegado.
 *
 * Después, la navegación tiene tres niveles —operación principal, modalidad y etapa— y cada uno
 * se elige en su propia pantalla. El estado de cada nivel se descarta al volver al anterior: la
 * modalidad se desmonta entera, y con ella cualquier selección a medio hacer.
 */
export function App() {
  const acceso = useAccesoMonday()
  const [principal, setPrincipal] = useState<OperacionPrincipal | null>(null)
  const [modalidad, setModalidad] = useState<ModalidadDespacho | null>(null)

  if (acceso === 'verificando') return <PantallaVerificando />
  if (acceso !== 'habilitado') return <PantallaSinAcceso motivo={acceso} />

  /* Único caso de desarrollo: la app corre en localhost sin token en `.env.local`. En producción
     nunca se llega acá, porque el acceso ya se resolvió arriba. */
  if (!mondayHabilitado()) {
    return (
      <div className="app">
        <BarraMarca titulo={TITULO} subtitulo={SUBTITULO} />
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

  const irAlInicio = () => {
    setPrincipal(null)
    setModalidad(null)
  }

  const defPrincipal = OPERACIONES_PRINCIPALES.find((o) => o.id === principal)
  const defModalidad = MODALIDADES_DESPACHO.find((m) => m.id === modalidad)

  const migas: Miga[] = [{ rotulo: 'Operaciones', onIr: irAlInicio }]
  if (defPrincipal) migas.push({ rotulo: defPrincipal.corto, onIr: () => setModalidad(null) })
  if (defModalidad) migas.push({ rotulo: defModalidad.corto })

  return (
    <div className="app">
      <BarraMarca titulo={TITULO} subtitulo={SUBTITULO} />
      <Migas migas={migas} />

      {principal === null && (
        <PanelOpciones
          titulo="¿Qué operación vas a hacer?"
          detalle="Elegí el tipo de operación sobre el inventario de tractores."
          opciones={OPERACIONES_PRINCIPALES}
          onElegir={setPrincipal}
        />
      )}

      {principal === 'despacho' && modalidad === null && (
        <PanelOpciones
          titulo="Despacho"
          detalle="Elegí cómo se despachan los tractores."
          opciones={MODALIDADES_DESPACHO}
          onElegir={setModalidad}
        />
      )}

      {principal === 'despacho' && modalidad === 'anticipado' && <DespachoAnticipado />}
      {principal === 'despacho' && modalidad === 'vista' && <DespachoVista />}
    </div>
  )
}
