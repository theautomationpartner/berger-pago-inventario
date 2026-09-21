import { useCallback, useEffect, useRef, useState } from 'react'
import { useClickAfuera } from '@/hooks/useClickAfuera'
import { buscarUbicaciones, type Ubicacion } from '@/services/geo'

interface Props {
  /** La dirección que hay hoy. */
  valor: string
  /** Coordenadas de la dirección actual, o `null` si se escribió a mano. */
  coordenadas: { lat: string; lng: string } | null | undefined
  onCambiar: (direccion: string, coordenadas: { lat: string; lng: string } | null) => void
  id?: string
}

/** Lo que se muestra en la lista: la dirección entera es larguísima, así que se parte en dos. */
const partir = (direccion: string): { titulo: string; resto: string } => {
  const partes = direccion.split(',')
  return {
    titulo: partes.slice(0, 2).join(',').trim(),
    resto: partes.slice(2).join(',').trim(),
  }
}

/**
 * Campo de dirección con sugerencias reales.
 *
 * La columna de ubicación de monday **exige latitud y longitud**: una dirección suelta hace que
 * rechace la escritura entera. Escribiéndola a mano lo mejor que se puede hacer es mandar las
 * coordenadas en 0, y entonces el texto se lee bien pero el punto del mapa cae en cualquier lado.
 *
 * Por eso acá la dirección se **elige**, como en monday: se escribe, aparecen direcciones reales
 * y al tocar una quedan guardadas sus coordenadas. Escribir libre sigue permitido —hay entregas
 * en establecimientos que ningún mapa conoce—, pero el campo avisa que esa va a ir sin ubicar.
 *
 * La búsqueda espera a que se deje de tipear: el servicio de mapas es gratuito y su política pide
 * no abusar, así que no se consulta letra por letra.
 */
export function SelectorUbicacion({ valor, coordenadas, onCambiar, id }: Props) {
  const [texto, setTexto] = useState(valor)
  const [abierto, setAbierto] = useState(false)
  const [sugerencias, setSugerencias] = useState<Ubicacion[]>([])
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Lo que se buscó por última vez: sin esto, elegir una sugerencia dispara otra búsqueda. */
  const ultima = useRef('')

  const caja = useRef<HTMLDivElement>(null)
  const cerrar = useCallback(() => setAbierto(false), [])
  useClickAfuera(caja, abierto, cerrar)

  // El valor puede cambiar desde afuera (se cambia de contenedor sin desmontar el campo).
  useEffect(() => {
    setTexto(valor)
    ultima.current = valor
  }, [valor])

  useEffect(() => {
    const consulta = texto.trim()
    if (consulta.length < 3 || consulta === ultima.current) return

    // Medio segundo de espera: se busca cuando se dejó de escribir, no en cada tecla.
    const reloj = setTimeout(async () => {
      setBuscando(true)
      setError(null)
      try {
        const encontradas = await buscarUbicaciones(consulta)
        setSugerencias(encontradas)
        setAbierto(true)
      } catch {
        setSugerencias([])
        setError('No se pudo buscar la dirección. Podés escribirla igual.')
      } finally {
        setBuscando(false)
      }
    }, 500)
    return () => clearTimeout(reloj)
  }, [texto])

  const elegir = (u: Ubicacion) => {
    ultima.current = u.direccion
    setTexto(u.direccion)
    setAbierto(false)
    onCambiar(u.direccion, { lat: u.lat, lng: u.lng })
  }

  const escribir = (nuevo: string) => {
    setTexto(nuevo)
    // Al editar el texto se pierden las coordenadas: ya no son de esta dirección.
    onCambiar(nuevo, null)
  }

  const ubicada = Boolean(coordenadas && valor.trim())
  const sinUbicar = Boolean(!coordenadas && valor.trim())

  return (
    <div className="ubicacion" ref={caja}>
      <div className="ubicacion-campo">
        <input
          id={id}
          className="input"
          value={texto}
          placeholder="Escribí calle y número, o ciudad y provincia"
          autoComplete="off"
          onChange={(e) => escribir(e.target.value)}
          onFocus={() => sugerencias.length > 0 && setAbierto(true)}
        />
        <span className="ubicacion-estado" aria-live="polite">
          {buscando ? (
            <span className="spin spin--oscuro spin--chico" aria-hidden="true" />
          ) : ubicada ? (
            <i className="fa-solid fa-location-dot ubicacion-ic--ok" title="Ubicada en el mapa" />
          ) : null}
        </span>
      </div>

      {abierto && sugerencias.length > 0 && (
        <ul className="ubicacion-lista">
          {sugerencias.map((u) => {
            const { titulo, resto } = partir(u.direccion)
            return (
              <li key={`${u.lat},${u.lng},${u.direccion}`}>
                <button type="button" className="ubicacion-op" onClick={() => elegir(u)}>
                  <i className="fa-solid fa-location-dot" aria-hidden="true" />
                  <span className="ubicacion-op-txt">
                    <span className="ubicacion-op-tit">{titulo}</span>
                    {resto && <span className="ubicacion-op-det">{resto}</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {error && <span className="campo-ayuda campo-ayuda--falta">{error}</span>}

      {!error && sinUbicar && (
        <span className="campo-ayuda campo-ayuda--aviso">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> Sin ubicar en el
          mapa. Elegí una de las sugeridas para que el punto quede bien; si no, se guarda sólo la
          dirección escrita.
        </span>
      )}

      {ubicada && (
        <span className="campo-ayuda campo-ayuda--ok">
          <i className="fa-solid fa-circle-check" aria-hidden="true" /> Ubicada en el mapa
        </span>
      )}
    </div>
  )
}
