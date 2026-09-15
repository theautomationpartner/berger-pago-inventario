import { useCallback, useEffect, useMemo, useState } from 'react'
import { armarContenedores } from '@/lib/contenedores'
import { opcionesDeContenedor } from '@/services/monday/contenedores'
import { SinAcceso } from '@/services/monday/sdk'
import type { OpcionContenedor, ResumenContenedores, Tractor } from '@/types'

const mensaje = (e: unknown): string =>
  e instanceof SinAcceso
    ? 'la app tiene que abrirse desde monday.'
    : e instanceof Error
      ? e.message
      : String(e)

const VACIO: ResumenContenedores = {
  armados: [],
  sinContenedor: [],
  totalContenedores: 0,
  totalLibres: 0,
}

/**
 * Las combinaciones de contenedores y el armado de lo que el usuario va eligiendo.
 *
 * Las combinaciones se traen UNA vez al abrir la pantalla; el armado se recalcula en el navegador
 * con cada tractor que se marca. Por eso el resumen aparece al instante y no hay que esperar a
 * monday en cada clic.
 */
export function useContenedores(seleccionados: Tractor[], disponibles: Tractor[]) {
  const [opciones, setOpciones] = useState<OpcionContenedor[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      setOpciones(await opcionesDeContenedor())
    } catch (e) {
      setOpciones([])
      setError(mensaje(e))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void recargar()
  }, [recargar])

  const resumen = useMemo(
    () => (opciones.length === 0 ? VACIO : armarContenedores(seleccionados, opciones, disponibles)),
    [seleccionados, opciones, disponibles],
  )

  return { resumen, opciones, cargando, error, recargar }
}
