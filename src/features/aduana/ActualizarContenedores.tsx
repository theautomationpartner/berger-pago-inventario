import { useCallback, useEffect, useMemo, useState } from 'react'
import { Desplegable } from '@/components/ui/Desplegable'
import { NACIONALIZADO } from '@/lib/despachos'
import { fechaCorta, hoyISO } from '@/lib/format'
import {
  ESTADO_ARRIBO,
  ESTADOS_CON_ARRIBO,
  URL_TABLERO_CONTENEDORES,
} from '@/services/monday/columns'
import {
  actualizarContenedor,
  contenedoresDelTablero,
  depositosDeEntrega,
  listarTransportistas,
} from '@/services/monday/contenedoresDespacho'
import { SinAcceso } from '@/services/monday/sdk'
import type { Contacto, ContenedorDespacho, EdicionContenedor } from '@/types'

const mensaje = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/** Lo que falta cargarle a un contenedor. Es lo que decide si aparece en la lista de pendientes. */
const pendienteDeArribo = (c: ContenedorDespacho): boolean =>
  c.estadoArribo !== ESTADO_ARRIBO.ARRIBADO
const sinUbicacion = (c: ContenedorDespacho): boolean => !c.ubicacion.trim()

/**
 * ¿La carga de este contenedor ya llegó o está por llegar?
 *
 * Antes de "Próxima a Arribar" la mercadería todavía está navegando: marcar un arribo ahí sería
 * anotar un hecho que no pasó. El estado se lee del espejo de la OP, que el contenedor trae por su
 * conexión a nivel item.
 */
const enEtapaDeArribo = (c: ContenedorDespacho): boolean =>
  ESTADOS_CON_ARRIBO.some((estado) => c.estadoCargaOp.includes(estado))

/**
 * ¿Se puede dar por arribado?
 *
 * Sólo con la OP **nacionalizada**. En "Próxima a Arribar" la carga está llegando pero todavía no
 * pasó la aduana, y un contenedor no se retira antes de eso: marcarlo arribado sería anotar una
 * entrega que no pudo ocurrir. Las de esa etapa igual se listan, porque su ubicación y su
 * transportista **sí** se cargan antes —justamente para que el día que salga esté todo listo—.
 */
const puedeArribar = (c: ContenedorDespacho): boolean => c.estadoCargaOp.includes(NACIONALIZADO)

/** Busca por cualquiera de los nombres con los que se llama a un contenedor. */
const coincide = (c: ContenedorDespacho, busqueda: string): boolean => {
  const texto = busqueda.trim().toLowerCase()
  if (!texto) return true
  return [c.numero, c.nombre, c.nroOpDespachante, c.idOp, c.chasis]
    .filter(Boolean)
    .some((campo) => campo.toLowerCase().includes(texto))
}

/**
 * Actualizar Contenedores · BERGER S.A.
 *
 * Cuando la carga llega, el trabajo deja de ser por OP y pasa a ser **por contenedor**: un camión
 * llega y se descarga de a uno, con su propia entrega y su propio arribo. Por eso esta pantalla
 * entra por el tablero de 🚚Contenedores y no por la OP.
 *
 * Dos cosas por contenedor, que son las dos que se resuelven en el momento:
 *
 * - **Marcarlo como arribado** (`color_mm7ar9rc`).
 * - **Cargarle la ubicación de entrega** (`location_mm7a16dx`), y de paso el transportista.
 *
 * Por defecto muestra sólo los **pendientes**: los de una OP que ya está por llegar o nacionalizada
 * a los que les falta el arribo o la entrega. Lo demás está a un clic, porque corregir algo ya
 * cargado es tan legítimo como cargarlo la primera vez.
 */
export function ActualizarContenedores() {
  const [contenedores, setContenedores] = useState<ContenedorDespacho[]>([])
  const [contactos, setContactos] = useState<Contacto[]>([])
  /** Los depósitos del desplegable de entrega. Se leen del tablero: van sumando. */
  const [depositos, setDepositos] = useState<string[]>([])
  /** Los contenedores tildados para trabajarlos juntos. */
  const [lote, setLote] = useState<string[]>([])
  /**
   * Lo elegido en el panel del lote.
   *
   * Vive acá y NO se vuelca a cada contenedor en el momento del clic. Es la diferencia entre "esto
   * vale para los tildados" y "esto se copió una vez a los que había": con lo segundo, tildar uno
   * más lo dejaba afuera de lo ya elegido, y el desplegable volvía a verse vacío.
   */
  const [loteValores, setLoteValores] = useState<Partial<EdicionContenedor>>({})
  /** La fecha del arribo del lote. Separada porque el arribo se confirma con un botón. */
  const [fechaLote, setFechaLote] = useState(hoyISO())
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [busqueda, setBusqueda] = useState('')
  const [soloPendientes, setSoloPendientes] = useState(true)
  /** Lo editado a mano en CADA contenedor. Sólo los campos tocados: lo demás sale del lote. */
  const [ediciones, setEdiciones] = useState<Record<string, Partial<EdicionContenedor>>>({})

  const [guardando, setGuardando] = useState<string | null>(null)
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)
  const [guardados, setGuardados] = useState<string[]>([])

  const recargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      setContenedores(await contenedoresDelTablero())
    } catch (e) {
      setContenedores([])
      setError(
        e instanceof SinAcceso
          ? 'la app tiene que abrirse desde monday para leer el tablero.'
          : mensaje(e),
      )
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void recargar()
  }, [recargar])

  useEffect(() => {
    listarTransportistas()
      .then(setContactos)
      .catch(() => setContactos([]))
    depositosDeEntrega()
      .then(setDepositos)
      .catch(() => setDepositos([]))
  }, [])

  /** Los que esperan algo: de una OP en etapa de arribo, sin arribo marcado o sin entrega. */
  const pendientes = useMemo(
    () =>
      contenedores.filter((c) => enEtapaDeArribo(c) && (pendienteDeArribo(c) || sinUbicacion(c))),
    [contenedores],
  )

  const visibles = useMemo(
    () => (soloPendientes ? pendientes : contenedores).filter((c) => coincide(c, busqueda)),
    [soloPendientes, pendientes, contenedores, busqueda],
  )

  const enLote = (c: ContenedorDespacho) => lote.includes(c.id)

  /**
   * Lo que va a quedar en un contenedor, con esta prioridad:
   *
   *   1. lo que se editó **a mano en su tarjeta** —gana siempre, es lo más específico—,
   *   2. lo elegido en el **panel del lote**, si está tildado,
   *   3. lo que ya tiene en monday.
   *
   * Esa escalera es la que permite "todos a este depósito, menos éste que va al otro" sin
   * destildar nada ni volver a elegir lo de arriba.
   */
  const edicionDe = (c: ContenedorDespacho): EdicionContenedor => {
    const propio = ediciones[c.id] ?? {}
    const delLoteAhora = enLote(c) ? loteValores : {}
    /* El arribo del lote sólo cae sobre los que ya salieron de aduana: a los demás ni se les
       propone, así que tampoco se les aplica por estar tildados. */
    const arriboDelLote =
      enLote(c) && puedeArribar(c)
        ? { estadoArribo: delLoteAhora.estadoArribo, fechaArribo: delLoteAhora.fechaArribo }
        : {}

    const elegir = <T,>(a: T | undefined, b: T | undefined, c2: T): T => a ?? b ?? c2
    return {
      ubicacion: elegir(propio.ubicacion, delLoteAhora.ubicacion, c.ubicacion),
      transportistaId: elegir(
        propio.transportistaId,
        delLoteAhora.transportistaId,
        c.transportistaId,
      ),
      estadoArribo: elegir(propio.estadoArribo, arriboDelLote.estadoArribo, c.estadoArribo),
      fechaArribo: elegir(propio.fechaArribo, arriboDelLote.fechaArribo, c.fechaArribo),
    }
  }

  const cambiar = (c: ContenedorDespacho, cambio: Partial<EdicionContenedor>) =>
    setEdiciones((a) => ({ ...a, [c.id]: { ...(a[c.id] ?? {}), ...cambio } }))

  /** Qué cambió respecto de lo que hay en monday. Sólo eso viaja. */
  const cambiosDe = (c: ContenedorDespacho): Partial<EdicionContenedor> => {
    const e = edicionDe(c)
    const parcial: Partial<EdicionContenedor> = {}
    if ((e.ubicacion ?? '') !== (c.ubicacion ?? '')) parcial.ubicacion = e.ubicacion
    if ((e.transportistaId ?? null) !== (c.transportistaId ?? null)) {
      parcial.transportistaId = e.transportistaId ?? null
    }
    if ((e.estadoArribo ?? '') !== (c.estadoArribo ?? '')) parcial.estadoArribo = e.estadoArribo
    if ((e.fechaArribo ?? '') !== (c.fechaArribo ?? '')) parcial.fechaArribo = e.fechaArribo
    return parcial
  }

  /* ------------------------------------------------------------------ *
   * Trabajar varios a la vez
   *
   * Un barco trae seis contenedores que van al mismo depósito con el mismo transportista y
   * llegaron el mismo día. Cargarlo seis veces no es sólo lento: es donde aparece el que quedó
   * con otro depósito porque se saltó una fila. Lo que se elige acá se vuelca a los tildados
   * COMO EDICIÓN, no como escritura: queda a la vista en cada tarjeta y todavía se puede corregir
   * uno antes de guardar.
   * ------------------------------------------------------------------ */

  const alternarLote = (c: ContenedorDespacho) =>
    setLote((a) => (a.includes(c.id) ? a.filter((x) => x !== c.id) : [...a, c.id]))

  /** Los tildados que además están en pantalla: tildar y después filtrar no puede dejar fantasmas. */
  const delLote = useMemo(() => visibles.filter((c) => lote.includes(c.id)), [visibles, lote])

  /* El arribo sólo se le puede poner a los que ya salieron de aduana, así que el lote se parte en
     dos: a unos se les puede cargar todo, a los otros sólo la entrega. */
  const nacionalizadosDelLote = useMemo(() => delLote.filter(puedeArribar), [delLote])
  const sinNacionalizarDelLote = useMemo(() => delLote.filter((c) => !puedeArribar(c)), [delLote])

  /** Vacía la selección y lo elegido para ella: sin esto, lo del lote anterior seguiría pegado. */
  const vaciarLote = () => {
    setLote([])
    setLoteValores({})
  }

  /** Guarda de a uno, en orden: si el tercero falla, los dos anteriores ya quedaron bien. */
  const guardarLote = async () => {
    setErrorGuardar(null)
    const fallaron: string[] = []
    for (const c of delLote) {
      if (Object.keys(cambiosDe(c)).length === 0) continue
      try {
        await guardar(c)
      } catch {
        fallaron.push(c.numero || c.nombre)
      }
    }
    if (fallaron.length > 0) {
      setErrorGuardar(`No se pudieron guardar: ${fallaron.join(', ')}.`)
    }
    vaciarLote()
  }

  const guardar = async (c: ContenedorDespacho) => {
    const cambios = cambiosDe(c)
    if (Object.keys(cambios).length === 0) return

    setGuardando(c.id)
    setErrorGuardar(null)
    try {
      await actualizarContenedor(c.id, cambios)
      setGuardados((a) => [...a, c.id])
      /* Se actualiza la fila en memoria en vez de recargar el tablero entero: el resto de lo que
         está en pantalla no cambió, y recargar haría desaparecer de golpe el que se acaba de
         completar. Sale de la lista recién cuando la persona recarga. */
      setContenedores((a) =>
        a.map((x) =>
          x.id === c.id
            ? {
                ...x,
                ubicacion: cambios.ubicacion ?? x.ubicacion,
                estadoArribo: cambios.estadoArribo ?? x.estadoArribo,
                fechaArribo: cambios.fechaArribo ?? x.fechaArribo,
                transportistaId:
                  cambios.transportistaId !== undefined
                    ? cambios.transportistaId
                    : x.transportistaId,
                transportista: cambios.transportistaId
                  ? (contactos.find((k) => k.id === cambios.transportistaId)?.nombre ??
                    x.transportista)
                  : x.transportista,
              }
            : x,
        ),
      )
      setEdiciones((a) => {
        const { [c.id]: _, ...resto } = a
        return resto
      })
      setLote((a) => a.filter((x) => x !== c.id))
    } catch (e) {
      setErrorGuardar(`No se pudo guardar ${c.numero || c.nombre}: ${mensaje(e)}`)
    } finally {
      setGuardando(null)
    }
  }

  return (
    <div className="scroll">
      <div className="view">
        <div className="sec-head">
          <span className="sec-num">
            <i className="fa-solid fa-truck-ramp-box" aria-hidden="true" />
          </span>
          <span className="sec-txt">
            <span className="sec-tit">Contenedores</span>
            <span className="sec-det">
              Marcá los que ya llegaron y cargales la ubicación de entrega. Se muestran los de las
              OP <b>próximas a arribar</b> y <b>nacionalizadas</b> a las que todavía les falta algo.
            </span>
          </span>
        </div>

        {error && (
          <div className="aviso aviso--error">
            <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
            <span>
              No se pudo leer el tablero de Contenedores: {error}{' '}
              <button
                type="button"
                className="btn btn--texto btn--chico"
                onClick={() => void recargar()}
              >
                Reintentar
              </button>
            </span>
          </div>
        )}

        {errorGuardar && (
          <div className="aviso aviso--error">
            <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
            <span>{errorGuardar}</span>
          </div>
        )}

        <div className="filtros">
          <div className="filtros-fila">
            <label className="campo campo--busqueda">
              <span className="campo-lbl">Buscar</span>
              <input
                className="input"
                value={busqueda}
                placeholder="Buscar un contenedor…"
                onChange={(e) => setBusqueda(e.target.value)}
              />
              <span className="campo-ayuda campo-ayuda--ejemplo">
                N° de contenedor, N° de OP, ID del despacho o chasis
              </span>
            </label>
          </div>

          <div className="filtros-tags">
            <button
              type="button"
              aria-pressed={soloPendientes}
              className={`chip chip--boton chip--ambar${soloPendientes ? ' chip--activo' : ''}`}
              onClick={() => setSoloPendientes(true)}
            >
              Pendientes ({pendientes.length})
            </button>
            <button
              type="button"
              aria-pressed={!soloPendientes}
              className={`chip chip--boton chip--azul${!soloPendientes ? ' chip--activo' : ''}`}
              onClick={() => setSoloPendientes(false)}
            >
              Todos ({contenedores.length})
            </button>
          </div>

          <span className="filtros-nota filtros-nota--sola">
            <i className="fa-solid fa-rotate" aria-hidden="true" />
            {visibles.length} contenedor{visibles.length === 1 ? '' : 'es'} en pantalla
            <button
              type="button"
              className="btn btn--borde btn--chico"
              onClick={() => void recargar()}
            >
              Actualizar
            </button>
          </span>
        </div>

        {cargando && (
          <div className="vacio">
            <span className="spin spin--oscuro" aria-hidden="true" />
            <span className="vacio-tit">Leyendo los contenedores…</span>
          </div>
        )}

        {!cargando && !error && visibles.length === 0 && (
          <div className="vacio">
            <span className="vacio-ic">
              <i className="fa-solid fa-circle-check" aria-hidden="true" />
            </span>
            <span className="vacio-tit">
              {soloPendientes ? 'No hay contenedores pendientes' : 'No hay contenedores'}
            </span>
            <span className="vacio-det">
              {soloPendientes
                ? 'Los de las OP por llegar ya tienen su arribo y su entrega cargados.'
                : 'El despachante todavía no armó ningún contenedor.'}
            </span>
          </div>
        )}

        {delLote.length > 0 && (
          <div className="lote">
            <div className="lote-head">
              <span className="lote-tit">
                <i className="fa-solid fa-layer-group" aria-hidden="true" /> {delLote.length}{' '}
                contenedor{delLote.length === 1 ? '' : 'es'} elegido
                {delLote.length === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                className="btn btn--texto btn--chico"
                style={{ marginLeft: 'auto' }}
                onClick={vaciarLote}
              >
                <i className="fa-solid fa-xmark" aria-hidden="true" /> Vaciar la selección
              </button>
            </div>

            <span className="lote-det">
              Lo que elijas acá se carga en los {delLote.length} de una vez. Todavía no se guarda:
              queda a la vista en cada tarjeta y podés corregir alguno antes.
            </span>

            <div className="datos datos--form">
              <div className="campo">
                <span className="campo-lbl">Ubicación de entrega para todos</span>
                <Desplegable
                  valor={loteValores.ubicacion ?? ''}
                  opciones={depositos}
                  vacio="Elegir un depósito…"
                  buscable={depositos.length > 8}
                  onCambiar={(v) => setLoteValores((a) => ({ ...a, ubicacion: v || undefined }))}
                />
              </div>
              <div className="campo">
                <span className="campo-lbl">Transportista para todos</span>
                <Desplegable
                  valor={loteValores.transportistaId ?? ''}
                  opciones={contactos.map((x) => ({ valor: x.id, rotulo: x.nombre }))}
                  vacio="Elegir un transportista…"
                  buscable={contactos.length > 8}
                  onCambiar={(v) =>
                    setLoteValores((a) => ({ ...a, transportistaId: v || undefined }))
                  }
                />
              </div>
            </div>

            {/* El arribo NO es "un estado y además una fecha": marcar que llegó ES decir cuándo
                llegó. Por eso va un solo control —la fecha— y el botón sólo elige hoy por vos.
                Y se aplica únicamente a los nacionalizados: antes de salir de aduana no se retira
                nada, así que ponerle fecha a los demás sería anotar una entrega imposible. */}
            <div className="lote-arribo">
              <span className="lote-arribo-tit">
                <i className="fa-solid fa-anchor" aria-hidden="true" /> Marcar arribados
              </span>

              {nacionalizadosDelLote.length === 0 ? (
                <span className="campo-ayuda campo-ayuda--falta">
                  <i className="fa-solid fa-lock" aria-hidden="true" /> Ninguno de los elegidos está
                  en <b>{NACIONALIZADO}</b>. El arribo se marca recién cuando la OP sale de aduana.
                </span>
              ) : (
                <>
                  <div className="lote-arribo-fila">
                    <label className="campo campo--chico">
                      <span className="campo-lbl">¿Qué día llegaron?</span>
                      <input
                        className="input"
                        type="date"
                        max={hoyISO()}
                        value={fechaLote}
                        onChange={(ev) => {
                          setFechaLote(ev.target.value)
                          // Si el arribo ya estaba marcado, mover la fecha lo mueve con él.
                          setLoteValores((a) =>
                            a.estadoArribo ? { ...a, fechaArribo: ev.target.value } : a,
                          )
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className={`btn btn--chico ${
                        loteValores.estadoArribo ? 'btn--borde' : 'btn--primario'
                      }`}
                      disabled={!fechaLote}
                      onClick={() =>
                        setLoteValores((a) =>
                          a.estadoArribo
                            ? { ...a, estadoArribo: undefined, fechaArribo: undefined }
                            : {
                                ...a,
                                estadoArribo: ESTADO_ARRIBO.ARRIBADO,
                                fechaArribo: fechaLote,
                              },
                        )
                      }
                    >
                      {loteValores.estadoArribo ? (
                        <>
                          <i className="fa-solid fa-rotate-left" aria-hidden="true" /> Deshacer el
                          arribo
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-circle-check" aria-hidden="true" /> Marcar{' '}
                          {nacionalizadosDelLote.length} como arribado
                          {nacionalizadosDelLote.length === 1 ? '' : 's'}
                        </>
                      )}
                    </button>
                  </div>
                  <span className="lote-arribo-det">
                    Marcarlos arribados y ponerles la fecha es lo mismo: se guardan juntos.
                  </span>
                </>
              )}

              {/* Mezcla de nacionalizados y no nacionalizados: en vez de avisar que a algunos "no
                  se les va a cargar" —que obliga a leer el resumen fila por fila para saber a
                  cuáles—, se ofrece sacarlos de la selección de una vez. */}
              {sinNacionalizarDelLote.length > 0 && nacionalizadosDelLote.length > 0 && (
                <div className="aviso aviso--alerta" style={{ margin: 0 }}>
                  <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
                  <span>
                    <b>
                      {sinNacionalizarDelLote.length} de los elegidos todavía no{' '}
                      {sinNacionalizarDelLote.length === 1 ? 'está' : 'están'} en {NACIONALIZADO}
                    </b>{' '}
                    y no se {sinNacionalizarDelLote.length === 1 ? 'va' : 'van'} a marcar como
                    {sinNacionalizarDelLote.length === 1 ? ' arribado' : ' arribados'}:{' '}
                    {sinNacionalizarDelLote.map((c) => c.numero || c.nombre).join(', ')}. La entrega
                    y el transportista sí se les pueden cargar.
                    <span className="aviso-chips">
                      <button
                        type="button"
                        className="btn btn--borde btn--chico"
                        onClick={() => setLote(nacionalizadosDelLote.map((c) => c.id))}
                      >
                        <i className="fa-solid fa-filter" aria-hidden="true" /> Dejar sólo los{' '}
                        {nacionalizadosDelLote.length} nacionalizado
                        {nacionalizadosDelLote.length === 1 ? '' : 's'}
                      </button>
                    </span>
                  </span>
                </div>
              )}
            </div>

            {/* El resumen: qué le va a pasar a cada uno. Guardar en lote sin ver esto es firmar a
                ciegas, y el error más caro acá es pisarle el depósito a uno que ya estaba bien. */}
            {delLote.some((c) => Object.keys(cambiosDe(c)).length > 0) && (
              <div className="lote-resumen">
                <span className="lote-resumen-tit">Se va a guardar:</span>
                <ul className="cambios">
                  {delLote.map((c) => {
                    const cambio = cambiosDe(c)
                    if (Object.keys(cambio).length === 0) return null
                    const partes: string[] = []
                    if (cambio.ubicacion !== undefined) {
                      partes.push(`entrega → ${cambio.ubicacion || '(sin depósito)'}`)
                    }
                    if (cambio.transportistaId !== undefined) {
                      partes.push(
                        `transportista → ${
                          contactos.find((x) => x.id === cambio.transportistaId)?.nombre ??
                          '(sin asignar)'
                        }`,
                      )
                    }
                    /* El arribo se dice en un solo renglón: marcarlo y fecharlo son el mismo
                       acto, y separarlos hacía leer "arribo → Arribado · fecha → 25/09" como si
                       fueran dos cosas que pueden ir por separado. */
                    if (cambio.estadoArribo !== undefined || cambio.fechaArribo !== undefined) {
                      const dia = cambio.fechaArribo ?? c.fechaArribo
                      partes.push(
                        cambio.estadoArribo === ESTADO_ARRIBO.ARRIBADO || !cambio.estadoArribo
                          ? `arribado el ${dia ? fechaCorta(dia) : 'sin fecha'}`
                          : 'vuelve a pendiente de arribar',
                      )
                    }
                    return (
                      <li key={c.id} className="cambio">
                        <span className="cambio-campo">{c.numero || c.nombre}</span>
                        <span className="cambio-despues">{partes.join(' · ')}</span>
                      </li>
                    )
                  })}
                </ul>
                <button
                  type="button"
                  className="btn btn--primario btn--chico"
                  disabled={Boolean(guardando)}
                  onClick={() => void guardarLote()}
                >
                  {guardando ? (
                    <>
                      <span className="spin" aria-hidden="true" /> Guardando…
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-cloud-arrow-up" aria-hidden="true" /> Guardar los{' '}
                      {delLote.filter((c) => Object.keys(cambiosDe(c)).length > 0).length}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="op-editores">
          {visibles.map((c) => {
            const e = edicionDe(c)
            const cambios = Object.keys(cambiosDe(c)).length > 0
            const arribado = e.estadoArribo === ESTADO_ARRIBO.ARRIBADO
            const habilitaArribo = puedeArribar(c)
            const guardado = guardados.includes(c.id)
            return (
              <div key={c.id} className="card card--flush op-editor">
                <div className="ctitle op-editor-head">
                  <button
                    type="button"
                    className={`trow-check${enLote(c) ? ' trow-check--sel' : ''}`}
                    aria-pressed={enLote(c)}
                    aria-label={`Elegir ${c.numero || c.nombre} para cargar en lote`}
                    onClick={() => alternarLote(c)}
                  >
                    {enLote(c) && <i className="fa-solid fa-check" aria-hidden="true" />}
                  </button>
                  <span className="op-editor-nom">
                    <i className="fa-solid fa-box" aria-hidden="true" /> {c.numero || c.nombre}
                  </span>
                  <span className="op-editor-chips">
                    {c.numero && c.nombre !== c.numero && (
                      <span className="chip chip--indigo">{c.nombre}</span>
                    )}
                    {c.idOp && <span className="chip chip--teal">{c.idOp}</span>}
                    {c.nroOpDespachante && (
                      <span className="chip chip--magenta">OP {c.nroOpDespachante}</span>
                    )}
                    {c.estadoCargaOp && <span className="chip chip--azul">{c.estadoCargaOp}</span>}
                    <span className={`chip ${arribado ? 'chip--verde' : 'chip--ambar'}`}>
                      {e.estadoArribo || 'Sin estado de arribo'}
                    </span>
                    {guardado && !cambios && (
                      <span className="chip chip--verde">
                        <i className="fa-solid fa-check" aria-hidden="true" /> Guardado
                      </span>
                    )}
                  </span>
                </div>

                <div className="op-editor-cuerpo">
                  <div className="opfila-chips" style={{ marginBottom: 10 }}>
                    {c.chasis
                      .split(',')
                      .map((x) => x.trim())
                      .filter(Boolean)
                      .map((chasis) => (
                        <span key={chasis} className="chasis chasis--chico">
                          {chasis}
                        </span>
                      ))}
                    {c.fechaCreacion && (
                      <span className="chip chip--violeta">
                        Armado {fechaCorta(c.fechaCreacion)}
                      </span>
                    )}
                    {c.transportista && <span className="chip chip--lima">{c.transportista}</span>}
                  </div>

                  {/* El arribo es un interruptor y no un desplegable: es la acción del día, y tiene
                      que ser un solo toque. */}
                  <div className="decision">
                    <button
                      type="button"
                      aria-pressed={arribado}
                      disabled={!habilitaArribo}
                      className={`opcion opcion--confirmar${arribado ? ' opcion--elegida' : ''}`}
                      onClick={() =>
                        /* Al marcar el arribo se propone HOY, que es lo que pasa el 95% de las
                           veces: se marca el día que llega. Queda editable justo abajo para el
                           otro 5%, el contenedor que llegó el viernes y se marca el lunes. */
                        cambiar(
                          c,
                          arribado
                            ? { estadoArribo: ESTADO_ARRIBO.PENDIENTE, fechaArribo: '' }
                            : {
                                estadoArribo: ESTADO_ARRIBO.ARRIBADO,
                                fechaArribo: e.fechaArribo || hoyISO(),
                              },
                        )
                      }
                    >
                      <span className="opcion-ic">
                        <i
                          className={`fa-solid ${arribado ? 'fa-circle-check' : 'fa-circle'}`}
                          aria-hidden="true"
                        />
                      </span>
                      <span className="opcion-txt">
                        <span className="opcion-tit">
                          {arribado
                            ? `Arribado el ${e.fechaArribo ? fechaCorta(e.fechaArribo) : 'sin fecha'}`
                            : 'Marcar como arribado'}
                        </span>
                        <span className="opcion-det">
                          {!habilitaArribo
                            ? `La OP todavía está en "${c.estadoCargaOp || 'sin estado'}"`
                            : arribado
                              ? 'Tocá de nuevo si te equivocaste'
                              : `El contenedor llegó a destino · se guarda con la fecha de hoy`}
                        </span>
                      </span>
                    </button>
                  </div>

                  {!habilitaArribo && (
                    <span className="campo-ayuda campo-ayuda--falta" style={{ marginTop: 8 }}>
                      <i className="fa-solid fa-lock" aria-hidden="true" /> El arribo se marca
                      recién con la OP en <b>{NACIONALIZADO}</b>. Mientras tanto podés dejar cargada
                      la entrega y el transportista.
                    </span>
                  )}

                  {/* La fecha NO es un dato aparte del arribo: es el arribo. Por eso aparece
                      pegada al interruptor y sólo cuando está marcado, con la de hoy ya puesta. */}
                  {arribado && (
                    <div className="arribo-fecha">
                      <label className="campo campo--chico">
                        <span className="campo-lbl">¿Qué día llegó?</span>
                        <input
                          className="input"
                          type="date"
                          value={e.fechaArribo ?? ''}
                          max={hoyISO()}
                          onChange={(ev) => cambiar(c, { fechaArribo: ev.target.value })}
                        />
                      </label>
                      <span className="arribo-nota">
                        {e.fechaArribo ? (
                          <>
                            <i className="fa-solid fa-circle-info" aria-hidden="true" /> Cambiála si
                            llegó antes y recién ahora lo estás marcando.
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> Va
                            a quedar arribado sin fecha.
                          </>
                        )}
                      </span>
                    </div>
                  )}

                  <div className="datos datos--form" style={{ marginTop: 12 }}>
                    <div className="campo">
                      <span className="campo-lbl">
                        Ubicación de entrega {sinUbicacion(c) && '· pendiente'}
                      </span>
                      <Desplegable
                        valor={e.ubicacion}
                        opciones={depositos}
                        vacio="(sin depósito)"
                        buscable={depositos.length > 8}
                        onCambiar={(v) => cambiar(c, { ubicacion: v })}
                      />
                      {/* Lo que había en la columna vieja de ubicación: se muestra hasta que se
                          elija un depósito, para no perder de vista lo ya cargado. */}
                      {!e.ubicacion && c.ubicacionVieja && (
                        <span className="campo-ayuda">
                          <i className="fa-solid fa-clock-rotate-left" aria-hidden="true" /> Antes
                          decía: {c.ubicacionVieja}
                        </span>
                      )}
                    </div>

                    <div className="campo">
                      <span className="campo-lbl">Transportista</span>
                      <Desplegable
                        valor={e.transportistaId ?? ''}
                        opciones={contactos.map((x) => ({ valor: x.id, rotulo: x.nombre }))}
                        vacio="(sin asignar)"
                        buscable={contactos.length > 8}
                        onCambiar={(v) => cambiar(c, { transportistaId: v || null })}
                      />
                    </div>
                  </div>

                  <div className="op-editor-acciones">
                    <a
                      className="btn btn--texto btn--chico"
                      href={`${URL_TABLERO_CONTENEDORES}/pulses/${c.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />{' '}
                      Ver en monday
                    </a>
                    <button
                      type="button"
                      className="btn btn--marca btn--chico"
                      disabled={!cambios || guardando === c.id}
                      onClick={() => void guardar(c)}
                    >
                      {guardando === c.id ? (
                        <>
                          <span className="spin" aria-hidden="true" /> Guardando…
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-cloud-arrow-up" aria-hidden="true" /> Guardar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
