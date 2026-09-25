import { useCallback, useEffect, useMemo, useState } from 'react'
import { Desplegable } from '@/components/ui/Desplegable'
import { ZonaArchivo } from '@/components/ui/ZonaArchivo'
import { Stepper } from '@/components/ui/Stepper'
import { fechaCorta } from '@/lib/format'
import {
  BANCO_DECLARAR,
  COL_DESPACHANTE,
  ESTADO_ENVIO_TURNO,
  ESTADO_PAGO_VEP,
  FONDEO,
  FORMA_PAGO_OP,
  PROXIMA_A_ARRIBAR,
  URL_TABLERO_CONTENEDORES,
  URL_TABLERO_DESPACHANTE,
  FORMA_PAGO_VEP,
} from '@/services/monday/columns'
import {
  contenedoresDeOp,
  listarTransportistas,
  tractoresDeOps,
} from '@/services/monday/contenedoresDespacho'
import { ARCHIVOS_BERGER, actualizarOpBerger } from '@/services/monday/despachos'
import { subirArchivoAColumna } from '@/services/monday/sdk'
import type {
  Contacto,
  ContenedorDespacho,
  DespachoOP,
  EdicionBerger,
  EtapaBerger,
  TractorDeOp,
} from '@/types'
import { EtiquetasOP } from './EtiquetasOP'
import { EtiquetasTractorOp } from './EtiquetasTractorOp'
import { useDespachos } from './useDespachos'

const mensaje = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/**
 * El nombre del archivo adjunto.
 *
 * Una columna de archivo de monday devuelve la URL completa del recurso, que es larguísima y no
 * dice nada; lo que importa en pantalla es cómo se llama el PDF.
 */
/**
 * El nombre del transportista asignado.
 *
 * Una columna de conexión devuelve el id del item, nunca su nombre, así que se resuelve contra la
 * lista de contactos que la pantalla ya tiene cargada.
 */
const nombreDelContacto = (id: string | null, contactos: Contacto[]): string =>
  contactos.find((x) => x.id === id)?.nombre ?? ''

const nombreDeArchivo = (valor: string): string => {
  const ultimo = valor.split('/').pop() ?? valor
  try {
    return decodeURIComponent(ultimo) || 'archivo adjunto'
  } catch {
    return ultimo || 'archivo adjunto'
  }
}

const valoresBerger = (op: DespachoOP): EdicionBerger => ({
  formaPago: op.formaPago,
  fondeo: op.fondeo,
  bancoDeclarar: op.bancoDeclarar,
  formaPagoVepArca: op.formaPagoVepArca,
  estadoPagoVepArca: op.estadoPagoVepArca,
  formaPagoVepTerminal: op.formaPagoVepTerminal,
  estadoPagoVepTerminal: op.estadoPagoVepTerminal,
})

/** Un `<select>` con las etiquetas del tablero y la opción de dejarlo vacío. */
function Selector({
  rotulo,
  valor,
  opciones,
  onCambiar,
  bloqueado,
  motivo,
}: {
  rotulo: string
  valor: string
  opciones: readonly string[]
  onCambiar: (v: string) => void
  /** Deshabilita el campo. Se usa para el Estado Pago VEP mientras no haya VEP emitido. */
  bloqueado?: boolean
  /** Por qué está bloqueado. Sin esto, un campo gris es un misterio. */
  motivo?: string
}) {
  return (
    <div className="campo">
      <span className="campo-lbl">{rotulo}</span>
      <Desplegable valor={valor} opciones={opciones} bloqueado={bloqueado} onCambiar={onCambiar} />
      {bloqueado && motivo && (
        <span className="campo-ayuda campo-ayuda--falta">
          <i className="fa-solid fa-lock" aria-hidden="true" /> {motivo}
        </span>
      )}
    </div>
  )
}

/**
 * El bloque de un VEP: su forma de pago, su estado y su comprobante.
 *
 * Hay dos trámites distintos —el de ARCA y el de la terminal— con la misma mecánica: el despachante
 * emite el VEP, BERGER lo paga y adjunta el comprobante. Se dibujan con el mismo componente
 * justamente para que se vea que son el mismo circuito, y separados para que nadie pague uno
 * creyendo que paga el otro.
 */
function BloqueVep({
  titulo,
  icono,
  vepSubido,
  comprobanteSubido,
  formaPago,
  onFormaPago,
  estado,
  estadoGuardado,
  onEstado,
  comprobante,
  onComprobante,
}: {
  titulo: string
  icono: string
  /** El VEP que emitió el despachante. Vacío = todavía no hay nada que pagar. */
  vepSubido: string
  /** El comprobante del pago, si ya se subió alguna vez. */
  comprobanteSubido: string
  formaPago: string
  onFormaPago: (v: string) => void
  estado: string
  /** El estado que hay HOY en monday. Un pago ya registrado no se revierte solo. */
  estadoGuardado: string
  onEstado: (v: string) => void
  comprobante: File | null
  onComprobante: (f: File | null) => void
}) {
  const hayVep = Boolean(vepSubido.trim())
  const pagado = estado === ESTADO_PAGO_VEP.PAGADO

  /*
   * Marcar PAGADO exige dos cosas, y las dos por el mismo motivo: un pago que no se puede
   * respaldar no es un pago registrado, es un estado suelto.
   *
   *   1. Una forma de pago elegida: sin eso no se sabe por dónde salió la plata.
   *   2. El comprobante — el que ya está en monday, o el que se está adjuntando ahora.
   *
   * La opción directamente NO aparece en el desplegable mientras falte algo, y debajo se dice qué.
   * Dejarla visible pero inerte invita a probar, y probar termina en un cartel.
   */
  const hayComprobante = Boolean(comprobanteSubido.trim()) || Boolean(comprobante)
  const faltaParaPagar = !formaPago.trim()
    ? 'Elegí primero la forma de pago'
    : !hayComprobante
      ? 'Adjuntá el comprobante del pago para poder marcarlo PAGADO'
      : ''

  /*
   * Si se marcó PAGADO y después se saca el comprobante —o la forma de pago—, el estado vuelve
   * solo a NO PAGADO. El requisito no puede ser sólo de entrada: sin esto alcanzaba con adjuntar,
   * marcar y quitar el archivo para dejar un PAGADO sin nada detrás.
   *
   * Nunca toca un pago que YA estaba registrado en monday: eso se revierte allá, donde queda
   * asentado quién lo hizo.
   */
  const yaEstabaPagado = estadoGuardado === ESTADO_PAGO_VEP.PAGADO
  useEffect(() => {
    if (!yaEstabaPagado && faltaParaPagar && estado === ESTADO_PAGO_VEP.PAGADO) {
      onEstado(ESTADO_PAGO_VEP.NO_PAGADO)
    }
  }, [yaEstabaPagado, faltaParaPagar, estado, onEstado])

  return (
    <div className="vep">
      <div className="vep-head">
        <span className="vep-tit">
          <i className={`fa-solid ${icono}`} aria-hidden="true" /> {titulo}
        </span>
        {hayVep ? (
          <a className="vep-ver" href={vepSubido} target="_blank" rel="noreferrer">
            <i className="fa-solid fa-file-pdf" aria-hidden="true" />
            <span className="vep-ver-txt">
              <span className="vep-ver-rot">Ver {titulo} del despachante</span>
              <span className="vep-ver-arch">{nombreDeArchivo(vepSubido)}</span>
            </span>
            <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
          </a>
        ) : (
          <span className="chip chip--ambar">El despachante todavía no lo subió</span>
        )}
      </div>

      {!hayVep ? (
        <span className="vep-det">
          Hasta que el despachante no suba el <b>{titulo}</b> no se puede marcar el pago ni adjuntar
          el comprobante: sin VEP emitido, un pago marcado es un pago que no existe.
        </span>
      ) : (
        <>
          <div className="datos datos--form">
            <div className="campo">
              <span className="campo-lbl">Forma de pago</span>
              <Desplegable valor={formaPago} opciones={FORMA_PAGO_VEP} onCambiar={onFormaPago} />
            </div>
            <div className="campo">
              <span className="campo-lbl">Estado del pago</span>
              <Desplegable
                valor={estado}
                opciones={
                  faltaParaPagar
                    ? [ESTADO_PAGO_VEP.NO_PAGADO]
                    : [ESTADO_PAGO_VEP.NO_PAGADO, ESTADO_PAGO_VEP.PAGADO]
                }
                bloqueado={pagado}
                onCambiar={onEstado}
              />
              {pagado ? (
                <span className="campo-ayuda campo-ayuda--falta">
                  <i className="fa-solid fa-lock" aria-hidden="true" /> Ya está pagado: para
                  revertirlo, se cambia en monday
                </span>
              ) : (
                faltaParaPagar && (
                  <span className="campo-ayuda campo-ayuda--falta">
                    <i className="fa-solid fa-lock" aria-hidden="true" /> {faltaParaPagar}
                  </span>
                )
              )}
            </div>
          </div>

          {pagado ? (
            comprobanteSubido ? (
              <a
                className="chip chip--verde chip--link"
                href={comprobanteSubido}
                target="_blank"
                rel="noreferrer"
              >
                <i className="fa-solid fa-paperclip" aria-hidden="true" />{' '}
                {nombreDeArchivo(comprobanteSubido)}
              </a>
            ) : (
              <span className="campo-ayuda campo-ayuda--aviso">
                <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> Quedó marcado
                como pagado sin comprobante adjunto. Se sube desde monday.
              </span>
            )
          ) : (
            <ZonaArchivo
              archivo={comprobante}
              onElegir={onComprobante}
              acepta=".pdf"
              titulo={
                comprobanteSubido
                  ? `Ya hay un comprobante (${nombreDeArchivo(comprobanteSubido)}) · subir otro`
                  : `Comprobante de pago del ${titulo}`
              }
            />
          )}
        </>
      )}
    </div>
  )
}

/**
 * Actualizar OP · BERGER S.A.
 *
 * El otro lado de "Próxima a Arribar". Cuando el despachante marca ese estado, BERGER recibe el
 * aviso y tiene que definir cómo se paga y cómo se entrega. Esta operación es exactamente ese
 * trabajo, y por eso **sólo muestra las OP en ese estado**: antes no hay nada que decidir, y
 * después ya se decidió.
 *
 * Son dos cosas en la misma pantalla porque se deciden juntas:
 *
 * - De la **OP**: forma de pago, fondeo, banco a declarar, por dónde va el VEP y si ya se pagó.
 * - De **cada contenedor**: el transportista y la ubicación de entrega. Van en el contenedor y no
 *   en la OP porque cada uno puede ir a un lugar distinto y con un transportista distinto.
 *
 * Se puede completar sólo una parte: nada obliga a llenar todo de una vez, porque el banco suele
 * definirse antes que el transporte.
 */
export function ActualizarOpBerger() {
  const { despachos, cargando, error, recargar } = useDespachos()

  const [busqueda, setBusqueda] = useState('')
  /** Tractores de las OP listadas: hacen falta para poder buscar por tractor o por modelo. */
  const [tractoresPorOp, setTractoresPorOp] = useState<Record<string, TractorDeOp[]>>({})

  const [etapa, setEtapa] = useState<EtapaBerger>('seleccion')
  const [elegidaId, setElegidaId] = useState<string | null>(null)
  const [edicion, setEdicion] = useState<EdicionBerger | null>(null)
  const [contenedores, setContenedores] = useState<ContenedorDespacho[]>([])
  const [tractores, setTractores] = useState<TractorDeOp[]>([])
  const [contactos, setContactos] = useState<Contacto[]>([])
  const [cargandoDetalle, setCargandoDetalle] = useState(false)

  /** El comprobante del pago del VEP, si se adjuntó uno en esta edición. */
  const [comprobanteArca, setComprobanteArca] = useState<File | null>(null)
  const [comprobanteTerminal, setComprobanteTerminal] = useState<File | null>(null)

  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [resultado, setResultado] = useState<{ nombre: string; advertencias: string[] } | null>(
    null,
  )

  /* Sólo las que están por llegar: es el momento en que BERGER tiene que definir estos datos. */
  const porLlegar = useMemo(
    () => despachos.filter((op) => op.estadoCarga === PROXIMA_A_ARRIBAR),
    [despachos],
  )
  const elegida = porLlegar.find((op) => op.id === elegidaId) ?? null

  /* Los tractores de todas las OP listadas, en UNA consulta. Se traen para que la búsqueda pueda
     mirar también adentro: quien busca una carga suele acordarse del tractor, no del N° de OP. */
  useEffect(() => {
    if (porLlegar.length === 0) return
    tractoresDeOps(porLlegar.map((op) => op.id))
      .then((porOp) => setTractoresPorOp(Object.fromEntries(porOp)))
      .catch(() => setTractoresPorOp({}))
  }, [porLlegar])

  /** Busca por N° de OP del despachante, nombre de la OP, y nombre o modelo de sus tractores. */
  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    if (!texto) return porLlegar
    return porLlegar.filter((op) => {
      const tractores = tractoresPorOp[op.id] ?? []
      return [
        op.nombre,
        op.nroOp,
        op.idDespacho,
        ...tractores.map((t) => t.nombre),
        ...tractores.map((t) => t.modelo),
      ]
        .filter(Boolean)
        .some((campo) => campo.toLowerCase().includes(texto))
    })
  }, [porLlegar, busqueda, tractoresPorOp])

  const cargarDetalle = useCallback(async (op: DespachoOP) => {
    setCargandoDetalle(true)
    try {
      const porOp = await tractoresDeOps([op.id])
      const lista = porOp.get(op.id) ?? []
      setTractores(lista)
      const conts = await contenedoresDeOp(lista)
      setContenedores(conts)
    } catch (e) {
      setErrorEnvio(`No se pudieron leer los contenedores: ${mensaje(e)}`)
    } finally {
      setCargandoDetalle(false)
    }
  }, [])

  // Los contactos se piden una sola vez: es la lista de transportistas y cambia cada tanto.
  useEffect(() => {
    listarTransportistas()
      .then(setContactos)
      .catch(() => setContactos([]))
  }, [])

  const abrir = (op: DespachoOP) => {
    setElegidaId(op.id)
    setEdicion(valoresBerger(op))
    setComprobanteArca(null)
    setComprobanteTerminal(null)
    setErrorEnvio(null)
    setEtapa('edicion')
    void cargarDetalle(op)
  }

  const reiniciar = () => {
    setElegidaId(null)
    setEdicion(null)
    setComprobanteArca(null)
    setComprobanteTerminal(null)
    setContenedores([])
    setTractores([])
    setResultado(null)
    setErrorEnvio(null)
    setEtapa('seleccion')
    void recargar()
  }

  /**
   * ¿Este contenedor ya está coordinado con el transportista?
   *
   * Cuando tiene fecha de turno **y** el aviso salió (`Enviado`), el transportista ya recibió un
   * correo diciéndole dónde y cuándo. Cambiarle el lugar de entrega o la empresa después de eso
   * deja al tablero diciendo una cosa y al mail otra, y el que va a manejar leyó el mail. Por eso
   * esos dos campos quedan en modo lectura, y se corrigen desde monday avisando a mano.
   */
  const coordinado = (c: ContenedorDespacho): boolean =>
    Boolean(c.fechaTurno) && c.estadoEnvioTurno === ESTADO_ENVIO_TURNO.ENVIADO

  /** Lo que cambió de la OP respecto de lo que hay en monday. */
  const cambiosDeOp = (): Partial<EdicionBerger> => {
    if (!elegida || !edicion) return {}
    const actual = valoresBerger(elegida)
    const parcial: Partial<EdicionBerger> = {}
    for (const campo of Object.keys(actual) as (keyof EdicionBerger)[]) {
      if ((edicion[campo] ?? '') !== (actual[campo] ?? '')) parcial[campo] = edicion[campo]
    }
    return parcial
  }

  const hayCambios =
    Object.keys(cambiosDeOp()).length > 0 ||
    Boolean(comprobanteArca) ||
    Boolean(comprobanteTerminal)

  const guardar = async () => {
    if (!elegida) return
    setEnviando(true)
    setErrorEnvio(null)
    const advertencias: string[] = []

    const cambios = cambiosDeOp()
    if (Object.keys(cambios).length > 0) {
      try {
        await actualizarOpBerger(elegida.id, cambios)
      } catch (e) {
        advertencias.push(`No se pudo actualizar la OP: ${mensaje(e)}`)
      }
    }

    /* El comprobante va DESPUÉS de los datos: si la subida falla, lo que ya se decidió quedó
       igualmente guardado y sólo hay que volver a adjuntar el archivo. */
    /* Los dos comprobantes son independientes: que falle uno no tiene por qué llevarse al otro. */
    const comprobantes: [File | null, string, string][] = [
      [comprobanteArca, ARCHIVOS_BERGER[0], 'VEP ARCA'],
      [comprobanteTerminal, ARCHIVOS_BERGER[1], 'VEP Terminal'],
    ]
    for (const [archivo, columna, rotulo] of comprobantes) {
      if (!archivo) continue
      try {
        await subirArchivoAColumna(elegida.id, columna, archivo)
      } catch (e) {
        advertencias.push(`No se pudo subir el comprobante del ${rotulo}: ${mensaje(e)}`)
      }
    }

    setEnviando(false)
    if (advertencias.length > 0 && Object.keys(cambios).length === 0) {
      setErrorEnvio(advertencias.join(' · '))
      return
    }
    setResultado({ nombre: elegida.nombre, advertencias })
    setEtapa('listo')
  }

  /* ------------------------------------------------------------------ */
  if (etapa === 'listo' && resultado) {
    const conProblemas = resultado.advertencias.length > 0
    return (
      <div className="scroll">
        <div className="view">
          <Stepper variante="berger" actual="listo" />

          {conProblemas && (
            <div className="aviso aviso--alerta">
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
              <span>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {resultado.advertencias.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </span>
            </div>
          )}

          <div className="final">
            <span className="final-ic">
              <i
                className={`fa-solid ${conProblemas ? 'fa-circle-exclamation' : 'fa-check'}`}
                aria-hidden="true"
              />
            </span>
            <span className="final-tit">OP actualizada</span>
            <span className="final-det">
              Se guardaron los datos de <b>{resultado.nombre}</b> y de sus contenedores.
            </span>

            <div className="final-acciones">
              <a
                className="btn btn--borde"
                href={URL_TABLERO_DESPACHANTE}
                target="_blank"
                rel="noreferrer"
              >
                <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /> Ver en
                monday
              </a>
              <button type="button" className="btn btn--primario" onClick={reiniciar}>
                <i className="fa-solid fa-list" aria-hidden="true" /> Volver a la lista
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="scroll">
        <div className="view">
          <Stepper
            variante="berger"
            actual={etapa}
            onIr={enviando ? undefined : (e) => setEtapa(e as EtapaBerger)}
          />

          {errorEnvio && (
            <div className="aviso aviso--error">
              <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
              <span>{errorEnvio}</span>
            </div>
          )}

          {etapa === 'seleccion' && (
            <>
              <div className="sec-head">
                <span className="sec-num">1</span>
                <span className="sec-txt">
                  <span className="sec-tit">OP próximas a arribar</span>
                  <span className="sec-det">
                    Las que el despachante marcó como <b>{PROXIMA_A_ARRIBAR}</b>: son las que
                    esperan que BERGER defina pago, banco y entrega.
                  </span>
                </span>
              </div>

              {error && (
                <div className="aviso aviso--error">
                  <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
                  <span>
                    No se pudo leer el tablero: {error}{' '}
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

              <div className="filtros">
                <div className="filtros-fila">
                  <label className="campo campo--busqueda">
                    <span className="campo-lbl">Buscar</span>
                    <input
                      className="input"
                      value={busqueda}
                      placeholder="N° de OP, nombre, tractor o modelo…"
                      onChange={(e) => setBusqueda(e.target.value)}
                    />
                  </label>
                </div>
                <span className="filtros-nota filtros-nota--sola">
                  <i className="fa-solid fa-anchor" aria-hidden="true" />
                  {visibles.length} de {porLlegar.length} OP próximas a arribar
                </span>
              </div>

              <div className="lista">
                <div className="lista-head">
                  <span>Orden de pago</span>
                  <span className="lista-head-acciones">
                    <button
                      type="button"
                      className="btn btn--borde btn--chico"
                      onClick={() => void recargar()}
                    >
                      <i className="fa-solid fa-rotate" aria-hidden="true" /> Actualizar
                    </button>
                  </span>
                </div>

                <div className="lista-body">
                  {cargando && (
                    <div className="vacio">
                      <span className="spin spin--oscuro" aria-hidden="true" />
                      <span className="vacio-tit">Buscando OP…</span>
                    </div>
                  )}

                  {!cargando && !error && visibles.length === 0 && porLlegar.length > 0 && (
                    <div className="vacio">
                      <span className="vacio-ic">
                        <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
                      </span>
                      <span className="vacio-tit">Ninguna OP coincide con la búsqueda</span>
                      <span className="vacio-det">
                        Probá con el N° de OP, el nombre, o el modelo de alguno de sus tractores.
                      </span>
                    </div>
                  )}

                  {!cargando && !error && porLlegar.length === 0 && (
                    <div className="vacio">
                      <span className="vacio-ic">
                        <i className="fa-solid fa-anchor" aria-hidden="true" />
                      </span>
                      <span className="vacio-tit">No hay OP próximas a arribar</span>
                      <span className="vacio-det">
                        Cuando el despachante marque una carga como {PROXIMA_A_ARRIBAR}, aparece
                        acá.
                      </span>
                    </div>
                  )}

                  {!cargando &&
                    visibles.map((op) => (
                      <div key={op.id} className="opfila">
                        <div className="opfila-head">
                          <span className="opfila-nom">{op.nombre}</span>
                          <span className="opfila-chips">
                            <EtiquetasOP op={op} conEta />
                            <span
                              className={`chip ${
                                op.estadoPagoVepArca === ESTADO_PAGO_VEP.PAGADO
                                  ? 'chip--verde'
                                  : 'chip--rojo'
                              }`}
                            >
                              VEP {op.estadoPagoVepArca || 'sin estado'}
                            </span>
                            {(tractoresPorOp[op.id] ?? []).length > 0 && (
                              <span className="chip chip--indigo">
                                {(tractoresPorOp[op.id] ?? []).length} tractor
                                {(tractoresPorOp[op.id] ?? []).length === 1 ? '' : 'es'}
                              </span>
                            )}
                          </span>
                          <button
                            type="button"
                            className="btn btn--primario btn--chico opfila-ver"
                            onClick={() => abrir(op)}
                          >
                            <i className="fa-solid fa-pen-to-square" aria-hidden="true" /> Completar
                          </button>
                        </div>
                        <EtiquetasTractorOp tractores={tractoresPorOp[op.id] ?? []} />
                      </div>
                    ))}
                </div>
              </div>
            </>
          )}

          {etapa === 'edicion' && elegida && edicion && (
            <>
              <div className="sec-head">
                <span className="sec-num">2</span>
                <span className="sec-txt">
                  <span className="sec-tit">{elegida.nombre}</span>
                  <span className="sec-det">
                    Completá lo que ya esté definido. Lo que dejes sin tocar queda como está.
                  </span>
                </span>
              </div>

              <div className="card card--flush op-editor">
                <div className="ctitle op-editor-head">
                  <span className="op-editor-nom">
                    <i className="fa-solid fa-file-invoice-dollar" aria-hidden="true" /> Datos del
                    despacho
                  </span>
                  <span className="op-editor-chips">
                    <EtiquetasOP op={elegida} conEta />
                  </span>
                </div>

                <div className="op-editor-cuerpo">
                  <div className="datos datos--form">
                    <Selector
                      rotulo="Forma de pago"
                      valor={edicion.formaPago}
                      opciones={FORMA_PAGO_OP}
                      onCambiar={(v) => setEdicion({ ...edicion, formaPago: v })}
                    />
                    <Selector
                      rotulo="Fondeo"
                      valor={edicion.fondeo}
                      opciones={FONDEO}
                      onCambiar={(v) => setEdicion({ ...edicion, fondeo: v })}
                    />
                    <Selector
                      rotulo="Banco a declarar"
                      valor={edicion.bancoDeclarar}
                      opciones={BANCO_DECLARAR}
                      onCambiar={(v) => setEdicion({ ...edicion, bancoDeclarar: v })}
                    />
                  </div>

                  {/* Dos trámites, dos pagos: el VEP de ARCA y el de la terminal portuaria. Van
                      separados a propósito —misma mecánica, plata distinta—, y cada uno se
                      habilita recién cuando el despachante subió SU archivo. */}
                  <BloqueVep
                    titulo="VEP ARCA"
                    icono="fa-building-columns"
                    vepSubido={elegida.archivos[COL_DESPACHANTE.vepArca] ?? ''}
                    comprobanteSubido={elegida.archivos[COL_DESPACHANTE.comprobanteVepArca] ?? ''}
                    formaPago={edicion.formaPagoVepArca}
                    onFormaPago={(v) => setEdicion({ ...edicion, formaPagoVepArca: v })}
                    estado={edicion.estadoPagoVepArca}
                    estadoGuardado={elegida.estadoPagoVepArca}
                    onEstado={(v) => setEdicion({ ...edicion, estadoPagoVepArca: v })}
                    comprobante={comprobanteArca}
                    onComprobante={setComprobanteArca}
                  />

                  <BloqueVep
                    titulo="VEP Terminal"
                    icono="fa-anchor"
                    vepSubido={elegida.archivos[COL_DESPACHANTE.vepTerminal] ?? ''}
                    comprobanteSubido={
                      elegida.archivos[COL_DESPACHANTE.comprobanteVepTerminal] ?? ''
                    }
                    formaPago={edicion.formaPagoVepTerminal}
                    onFormaPago={(v) => setEdicion({ ...edicion, formaPagoVepTerminal: v })}
                    estado={edicion.estadoPagoVepTerminal}
                    estadoGuardado={elegida.estadoPagoVepTerminal}
                    onEstado={(v) => setEdicion({ ...edicion, estadoPagoVepTerminal: v })}
                    comprobante={comprobanteTerminal}
                    onComprobante={setComprobanteTerminal}
                  />
                </div>
              </div>

              <div className="sec-head" style={{ marginTop: 18 }}>
                <span className="sec-num">
                  <i className="fa-solid fa-truck" aria-hidden="true" />
                </span>
                <span className="sec-txt">
                  <span className="sec-tit">Contenedores de esta OP</span>
                  <span className="sec-det">
                    Para ver qué viaja y cómo quedó cada entrega. La <b>ubicación</b> y el{' '}
                    <b>transportista</b> se cargan en <b>Actualizar Contenedores</b>: se editan en
                    un solo lugar para que no haya dos pantallas escribiendo el mismo dato con
                    reglas distintas.
                  </span>
                </span>
                {/* Los contenedores los toca también el despachante —y monday, con sus
                    automatizaciones— mientras esta pantalla está abierta. El botón evita tener
                    que salir y volver a entrar a la OP para ver lo último. */}
                <button
                  type="button"
                  className="btn btn--borde btn--chico"
                  style={{ marginLeft: 'auto' }}
                  disabled={cargandoDetalle || !elegida}
                  onClick={() => elegida && void cargarDetalle(elegida)}
                >
                  <i
                    className={`fa-solid fa-rotate${cargandoDetalle ? ' fa-spin' : ''}`}
                    aria-hidden="true"
                  />{' '}
                  Actualizar
                </button>
              </div>

              {cargandoDetalle && (
                <div className="vacio">
                  <span className="spin spin--oscuro" aria-hidden="true" />
                  <span className="vacio-tit">Leyendo los contenedores…</span>
                </div>
              )}

              {!cargandoDetalle && contenedores.length === 0 && (
                <div className="aviso aviso--alerta">
                  <i className="fa-solid fa-boxes-packing" aria-hidden="true" />
                  <span>
                    Esta OP todavía no tiene contenedores armados. Los arma el despachante desde su
                    operación; hasta entonces no hay dónde cargar transportista ni entrega.
                  </span>
                </div>
              )}

              <div className="op-editores">
                {contenedores.map((c) => {
                  const dentro = tractores.filter((t) => t.contenedorId === c.id)
                  const cerrado = coordinado(c)
                  return (
                    <div key={c.id} className="card card--flush op-editor">
                      <div className="ctitle op-editor-head">
                        <span className="op-editor-nom">
                          <i className="fa-solid fa-box" aria-hidden="true" />{' '}
                          {c.numero || c.nombre}
                        </span>
                        <span className="op-editor-chips">
                          <span className="chip chip--indigo">
                            {dentro.length} tractor{dentro.length === 1 ? '' : 'es'}
                          </span>
                          {c.estadoArribo && (
                            <span className="chip chip--teal">{c.estadoArribo}</span>
                          )}
                          {c.fechaTurno && (
                            <span className="chip chip--azul">
                              Turno {fechaCorta(c.fechaTurno)}
                              {c.horaTurno ? ` ${c.horaTurno}` : ''}
                            </span>
                          )}
                          {c.estadoEnvioTurno === ESTADO_ENVIO_TURNO.ENVIADO && (
                            <span className="chip chip--verde">Aviso enviado</span>
                          )}
                          <a
                            className="btn btn--texto btn--chico"
                            href={`${URL_TABLERO_CONTENEDORES}/pulses/${c.id}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <i
                              className="fa-solid fa-arrow-up-right-from-square"
                              aria-hidden="true"
                            />{' '}
                            Ver
                          </a>
                        </span>
                      </div>

                      <div className="op-editor-cuerpo">
                        {dentro.length > 0 && (
                          <div className="tractores-cont" style={{ marginBottom: 12 }}>
                            {dentro.map((t) => (
                              <div key={t.id} className="tractor-fila tractor-fila--lectura">
                                <span className="chasis">{t.chasis || 'Sin chasis'}</span>
                                <span className="tractor-nom">{t.nombre}</span>
                                {t.modelo && <span className="chip chip--magenta">{t.modelo}</span>}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="datos datos--lectura">
                          <div className="campo">
                            <span className="campo-lbl">Ubicación de entrega</span>
                            <span className="campo-fijo">
                              <i className="fa-solid fa-location-dot" aria-hidden="true" />{' '}
                              {c.ubicacion || 'Sin cargar'}
                            </span>
                          </div>
                          <div className="campo">
                            <span className="campo-lbl">Transportista</span>
                            <span className="campo-fijo">
                              <i className="fa-solid fa-truck-fast" aria-hidden="true" />{' '}
                              {c.transportista ||
                                nombreDelContacto(c.transportistaId, contactos) ||
                                'Sin asignar'}
                            </span>
                          </div>
                        </div>

                        {cerrado && (
                          <span className="campo-ayuda campo-ayuda--ok">
                            <i className="fa-solid fa-lock" aria-hidden="true" /> Ya se le avisó al
                            transportista: turno del {fechaCorta(c.fechaTurno)}
                            {c.horaTurno ? ` a las ${c.horaTurno}` : ''}.
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {etapa === 'edicion' && (
        <footer className="pie">
          <div className="pie-info">
            <span className="font-b">{elegida?.nombre}</span>
            <span className="xs">
              {hayCambios ? 'Hay cambios sin guardar' : 'Todavía no cambiaste nada'}
            </span>
          </div>

          <div className="pie-acciones">
            <button
              type="button"
              className="btn btn--texto"
              disabled={enviando}
              onClick={() => setEtapa('seleccion')}
            >
              <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Volver
            </button>
            <button
              type="button"
              className="btn btn--marca"
              disabled={!hayCambios || enviando}
              onClick={() => void guardar()}
            >
              {enviando ? (
                <>
                  <span className="spin" aria-hidden="true" /> Guardando en monday…
                </>
              ) : (
                <>
                  <i className="fa-solid fa-cloud-arrow-up" aria-hidden="true" /> Guardar cambios
                </>
              )}
            </button>
          </div>
        </footer>
      )}
    </>
  )
}
