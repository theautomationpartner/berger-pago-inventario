import { useEffect, useState } from 'react'
import { CUENTA_BERGER } from '@/services/monday/columns'
import { obtenerDatosSesion } from '@/services/monday/sesion'

/**
 * Resultado de la verificación de acceso.
 *
 * - `verificando`: todavía se está esperando la respuesta de monday.
 * - `habilitado`: hay sesión válida de la cuenta de BERGER.
 * - `fuera-de-monday`: nadie contestó el pedido de sesión. Pasa cuando se abre la URL del deploy
 *   directo en el navegador: no hay iframe padre que responda.
 * - `otra-cuenta`: hay sesión de monday, pero de una cuenta que no es la de BERGER.
 */
export type Acceso = 'verificando' | 'habilitado' | 'fuera-de-monday' | 'otra-cuenta'

/**
 * Decide si la app puede mostrarse, ANTES de dibujar nada.
 *
 * Este orden es el punto: si la interfaz se dibuja primero y recién falla al pedir datos, quien
 * abre la URL suelta ve la pantalla entera —las operaciones, los filtros, el mes de trabajo— con
 * un cartel de error encima. No se filtra ningún dato del tablero, pero sí la forma del circuito
 * interno de la empresa, que tampoco tiene por qué estar a la vista.
 *
 * En desarrollo se saltea: ahí no hay iframe de monday que pueda contestar, y el token local ya
 * define quién tiene acceso. Es la única diferencia entre los dos entornos, y va acá para que no
 * se repita en cada pantalla.
 */
export function useAccesoMonday(): Acceso {
  const [acceso, setAcceso] = useState<Acceso>(import.meta.env.DEV ? 'habilitado' : 'verificando')

  useEffect(() => {
    if (import.meta.env.DEV) return

    let vigente = true
    obtenerDatosSesion()
      .then((datos) => {
        if (!vigente) return
        setAcceso(datos.accountId === CUENTA_BERGER ? 'habilitado' : 'otra-cuenta')
      })
      .catch(() => {
        // Fuera de monday el pedido de sesión no se responde nunca; lo corta el propio tiempo
        // límite de `sesion.ts`, y ese vencimiento llega acá como un rechazo más.
        if (vigente) setAcceso('fuera-de-monday')
      })

    return () => {
      vigente = false
    }
  }, [])

  return acceso
}
