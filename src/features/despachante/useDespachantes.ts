import { useCallback, useEffect, useState } from 'react'
import { listarDespachantes } from '@/services/monday/despachantes'
import { SinAcceso } from '@/services/monday/sdk'
import type { Despachante } from '@/types'

const mensaje = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/**
 * La gente del equipo "Despachantes", para el paso en que se elige a quién se le manda.
 *
 * Se carga una sola vez al entrar al paso y no en cada tecla: el equipo cambia cada tanto, no
 * durante una operación.
 */
export function useDespachantes(activo = true) {
  const [despachantes, setDespachantes] = useState<Despachante[]>([])
  const [cargando, setCargando] = useState(activo)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    // La operación 2 no elige despachante: pedirle el equipo a monday sería una consulta de más en
    // cada pantalla que no lo usa.
    if (!activo) return
    setCargando(true)
    setError(null)
    try {
      setDespachantes(await listarDespachantes())
    } catch (e) {
      setDespachantes([])
      setError(
        e instanceof SinAcceso
          ? 'la app tiene que abrirse desde monday para leer el equipo.'
          : mensaje(e),
      )
    } finally {
      setCargando(false)
    }
  }, [activo])

  useEffect(() => {
    void recargar()
  }, [recargar])

  return { despachantes, cargando, error, recargar }
}
