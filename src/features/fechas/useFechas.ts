import { useCallback, useEffect, useState } from 'react'
import { confirmacionesDelProveedor } from '@/services/monday/confirmaciones'
import { tractoresPendientesDeFecha } from '@/services/monday/fechas'
import { SinAcceso } from '@/services/monday/sdk'
import type { Confirmacion, TractorFecha } from '@/types'

const mensaje = (e: unknown): string => (e instanceof Error ? e.message : String(e))

const noAccesible = (e: unknown, que: string): string =>
  e instanceof SinAcceso ? `la app tiene que abrirse desde monday para leer ${que}.` : mensaje(e)

/** Los tractores que esperan una decisión sobre su fecha de producción. */
export function useTractoresPendientes() {
  const [tractores, setTractores] = useState<TractorFecha[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      setTractores(await tractoresPendientesDeFecha())
    } catch (e) {
      setTractores([])
      setError(noAccesible(e, 'el Inventario'))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void recargar()
  }, [recargar])

  return { tractores, cargando, error, recargar }
}

/** Las confirmaciones del proveedor, con sus tractores. */
export function useConfirmaciones() {
  const [confirmaciones, setConfirmaciones] = useState<Confirmacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      setConfirmaciones(await confirmacionesDelProveedor())
    } catch (e) {
      setConfirmaciones([])
      setError(noAccesible(e, 'las confirmaciones'))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void recargar()
  }, [recargar])

  return { confirmaciones, cargando, error, recargar }
}
