import type { PerfilElegible } from '@/services/acceso/cliente'
import { MarcoIngreso } from './MarcoIngreso'

interface Props {
  perfiles: PerfilElegible[]
  onElegir: (id: string) => void
}

/**
 * Elección de perfil, para la cuenta de monday que comparten los administradores.
 *
 * Sólo aparece cuando varias filas de la Lista Blanca tienen el mismo usuario de monday y todas son
 * ADMIN con Perfiles = SI. Cada perfil tiene su propio autenticador en su propio celular: elegir el
 * perfil de otro no alcanza para entrar como él.
 */
export function ElegirPerfil({ perfiles, onElegir }: Props) {
  return (
    <MarcoIngreso
      titulo="¿Con qué perfil entrás?"
      bajada="Esta cuenta de monday la comparten varias personas. Elegí la tuya: después te vamos a pedir tu código de verificación."
    >
      <div className="ingreso-perfiles">
        {perfiles.map((p) => (
          <button key={p.id} type="button" className="ingreso-perfil" onClick={() => onElegir(p.id)}>
            <span className="ingreso-perfil-ic" aria-hidden="true">
              {p.nombre.trim().charAt(0).toUpperCase()}
            </span>
            <span className="ingreso-perfil-txt">
              <span className="ingreso-perfil-nom">{p.nombre}</span>
              <span className="ingreso-perfil-det">
                {p.detalle}
                {!p.configurado && <span className="chip chip--ambar">sin configurar</span>}
              </span>
            </span>
            <i className="fa-solid fa-chevron-right ingreso-perfil-flecha" aria-hidden="true" />
          </button>
        ))}
      </div>
      <p className="ingreso-nota">
        Si ninguno es tuyo, pedile a un administrador que te agregue a la lista de usuarios habilitados.
      </p>
    </MarcoIngreso>
  )
}
