/**
 * Quiénes pueden recibir un despacho: la gente del equipo "Despachantes" de la cuenta.
 *
 * La lista no está en el código ni en una columna: se lee del equipo de monday, así que sumar o
 * sacar un despachante es agregarlo o quitarlo del equipo, sin tocar la app.
 */
import type { Despachante } from '@/types'
import { mondayApi } from './sdk'

interface UsuarioCrudo {
  id: string
  name: string
  email: string | null
  photo_thumb_small: string | null
  enabled: boolean | null
}

/**
 * Los despachantes, en orden alfabético.
 *
 * Los usuarios desactivados se dejan afuera: siguen figurando en el equipo, pero asignarle un
 * despacho a alguien que ya no entra a monday es mandarlo a un buzón que nadie abre.
 */
export async function listarDespachantes(): Promise<Despachante[]> {
  const r = await mondayApi<{ teams: { users: UsuarioCrudo[] | null }[] | null }>(
    'despachantes',
    {},
  )

  const usuarios = r.teams?.[0]?.users ?? []
  return usuarios
    .filter((u) => u.enabled !== false)
    .map((u) => ({
      id: u.id,
      nombre: u.name,
      email: u.email ?? '',
      foto: u.photo_thumb_small ?? '',
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}
