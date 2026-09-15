import { useState } from 'react'
import { BarraMarca } from '@/components/ui/BarraMarca'
import {
  PantallaSinAcceso,
  PantallaVerificando,
} from '@/components/ui/PantallaSinAcceso'
import { clienteVistaPrevia } from '@/features/acceso/clienteVistaPrevia'
import { Ingreso, type SesionIngreso } from '@/features/acceso/Ingreso'
import { DespachoAnticipado } from '@/features/anticipado/DespachoAnticipado'
import { Migas, type Miga } from '@/features/inicio/Migas'
import { PanelOpciones } from '@/features/inicio/PanelOpciones'
import { DespachoVista } from '@/features/vista/DespachoVista'
import { useAccesoMonday } from '@/hooks/useAccesoMonday'
import { MODALIDADES_DESPACHO, OPERACIONES_PRINCIPALES } from '@/lib/navegacion'
import { clienteIngreso } from '@/services/acceso/cliente'
import { mondayHabilitado } from '@/services/monday/sdk'
import type { ModalidadDespacho, OperacionPrincipal } from '@/types'

const TITULO = 'Operaciones de Inventario'
const SUBTITULO = 'Tractores · BERGER S.A.'

/**
 * En desarrollo, `?vista-previa` en la URL recorre las pantallas del ingreso con un servidor
 * simulado. Sin eso, en localhost se entra directo: ahí no corren las funciones de `api/`.
 * `import.meta.env.DEV` es `false` literal en el build de producción, así que esta rama —y el
 * cliente simulado— desaparecen del bundle publicado.
 */
const VISTA_PREVIA_INGRESO =
  import.meta.env.DEV && new URLSearchParams(window.location.search).has('vista-previa')

/**
 * Vista de tablero de BERGER S.A. — Operaciones de Inventario de Tractores.
 *
 * Tres barreras, en orden, y ninguna dibuja la app hasta que pasa:
 *
 *   1. monday   — ¿se abrió dentro del monday de BERGER?            (navegador, `useAccesoMonday`)
 *   2. ingreso  — ¿está en la Lista Blanca y pasó el autenticador? (servidor, `Ingreso`)
 *   3. datos    — cada pedido vuelve a comprobar las dos anteriores (servidor, `api/_seguridad`)
 *
 * Las dos primeras deciden QUÉ PANTALLA se ve. La que decide si se puede leer o escribir un dato
 * es la tercera, y está en el servidor: esconder la interfaz sin eso sería una cortina, no una
 * puerta.
 */
export function App() {
  const { acceso, usuarioId } = useAccesoMonday()

  if (acceso === 'verificando') return <PantallaVerificando />
  if (acceso === 'fuera-de-monday') return <PantallaSinAcceso motivo="fuera-de-monday" />
  if (acceso === 'sin-acceso') return <PantallaSinAcceso motivo="sin-acceso" />

  if (import.meta.env.DEV && !VISTA_PREVIA_INGRESO) {
    return (
      <AppAdentro
        sesion={{ perfil: { id: 'desarrollo', nombre: 'Desarrollo local' }, salir: () => {}, recuperacionRestantes: null }}
      />
    )
  }

  return (
    <Ingreso cliente={import.meta.env.DEV ? clienteVistaPrevia : clienteIngreso} usuarioId={usuarioId}>
      {(sesion) => <AppAdentro sesion={sesion} />}
    </Ingreso>
  )
}

/**
 * La app propiamente dicha, una vez adentro.
 *
 * La navegación tiene tres niveles —operación principal, modalidad y etapa— y cada uno se elige en
 * su propia pantalla. El estado de cada nivel se descarta al volver al anterior: la modalidad se
 * desmonta entera, y con ella cualquier selección a medio hacer.
 */
function AppAdentro({ sesion }: { sesion: SesionIngreso }) {
  const [principal, setPrincipal] = useState<OperacionPrincipal | null>(null)
  const [modalidad, setModalidad] = useState<ModalidadDespacho | null>(null)

  const barra = (
    <BarraMarca
      titulo={TITULO}
      subtitulo={SUBTITULO}
      perfil={sesion.perfil.nombre}
      onSalir={import.meta.env.DEV && !VISTA_PREVIA_INGRESO ? undefined : sesion.salir}
    />
  )

  /* Único caso de desarrollo: la app corre en localhost sin token en `.env.local`. */
  if (!mondayHabilitado()) {
    return (
      <div className="app">
        {barra}
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
      {barra}

      {/* Entró con un código de recuperación: probablemente perdió el celular. Se le avisa cuántos
          le quedan y qué hacer, en vez de dejarlo descubrirlo el día que se le terminan. */}
      {sesion.recuperacionRestantes != null && (
        <div className="aviso aviso--alerta aviso--banda">
          <i className="fa-solid fa-life-ring" aria-hidden="true" />
          <span>
            Entraste con un código de recuperación. Te{' '}
            {sesion.recuperacionRestantes === 1
              ? 'queda 1'
              : `quedan ${sesion.recuperacionRestantes}`}
            . Si perdiste el celular, pedile a un administrador que te reinicie la verificación.
          </span>
        </div>
      )}

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
