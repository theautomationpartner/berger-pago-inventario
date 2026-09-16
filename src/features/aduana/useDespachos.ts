import { useCallback, useEffect, useState } from 'react'
import { despachosDeAduana } from '@/services/monday/despachos'
import { SinAcceso } from '@/services/monday/sdk'
import type { DespachoOP } from '@/types'

const mensaje = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/**
 * Las OP del tablero del Despachante de aduana.
 *
 * Lo usan las dos operaciones del módulo —actualizar y el dashboard—: las dos miran exactamente el
 * mismo tablero, y con dos cargas distintas una podría mostrar un número y la otra otro.
 */
export function useDespachos() {
  const [despachos, setDespachos] = useState<DespachoOP[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      setDespachos(await despachosDeAduana())
    } catch (e) {
      setDespachos([])
      setError(
        e instanceof SinAcceso
          ? 'la app tiene que abrirse desde monday para consultar el tablero.'
          : mensaje(e),
      )
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void recargar()
  }, [recargar])

  return { despachos, cargando, error, recargar }
}
