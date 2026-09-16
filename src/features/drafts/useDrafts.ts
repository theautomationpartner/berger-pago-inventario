import { useCallback, useEffect, useState } from 'react'
import { draftsPorEstado } from '@/services/monday/drafts'
import { SinAcceso } from '@/services/monday/sdk'
import type { Draft } from '@/types'

const mensaje = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/**
 * Los drafts de un estado, con sus productos.
 *
 * Cada operación del módulo mira un estado distinto —pendientes de planificar, ya planificados— y
 * por eso el estado es un parámetro y no una constante adentro: las dos pantallas comparten toda
 * la carga, el manejo de errores y el reintento.
 *
 * `cargador` permite reusar el hook con otra consulta —el dashboard, que mira los dos estados—
 * sin duplicar nada de esto.
 */
export function useDrafts(estado: string, cargador?: () => Promise<Draft[]>) {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      setDrafts(await (cargador ? cargador() : draftsPorEstado(estado)))
    } catch (e) {
      setDrafts([])
      setError(
        e instanceof SinAcceso
          ? 'la app tiene que abrirse desde monday para consultar el tablero.'
          : mensaje(e),
      )
    } finally {
      setCargando(false)
    }
  }, [estado, cargador])

  useEffect(() => {
    void recargar()
  }, [recargar])

  return { drafts, cargando, error, recargar }
}
