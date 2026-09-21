import { useMemo, useState } from 'react'
import { URL_TABLERO_CONTENEDORES } from '@/services/monday/columns'
import { crearContenedor } from '@/services/monday/contenedoresDespacho'
import type {
  ContenedorDespacho,
  ContenedorEnArmado,
  DespachoOP,
  ResultadoContenedores,
  TractorDeOp,
} from '@/types'

const mensaje = (e: unknown): string => (e instanceof Error ? e.message : String(e))

interface Props {
  op: DespachoOP
  tractores: TractorDeOp[]
  /** Los que ya estaban armados antes de entrar. */
  armados: ContenedorDespacho[]
  onVolver: () => void
  onListo: (resultado: ResultadoContenedores) => void
}

/** Un id local para cada contenedor en pantalla. No es el de monday: todavía no existe. */
let contador = 0
const nuevaClave = () => `c${(contador += 1)}`

/**
 * Armar los contenedores de una OP.
 *
 * Cuando la app creó el despacho dejó una **estimación** de cuántos contenedores harían falta,
 * calculada con el tablero de combinaciones. Acá manda la realidad: el dato que vale es cómo los
 * armó el despachante, aunque no coincida con la estimación. Por eso no hay tope ni validación
 * contra ese número; sólo se informa para que se vea la diferencia.
 *
 * Lo único que se exige es que **no quede ningún tractor afuera**: un tractor sin contenedor es un
 * tractor que nadie va a ir a buscar al puerto, y además bloquea el paso de la OP a "Próxima a
 * Arribar".
 *
 * Cada tractor se identifica por su **chasis**: dos unidades del mismo modelo tienen el mismo
 * nombre y el mismo modelo, y la matrícula es lo único que las distingue cuando hay que decir cuál
 * va en qué contenedor.
 */
export function ArmarContenedores({ op, tractores, armados, onVolver, onListo }: Props) {
  /* Los que ya tienen contenedor no se tocan: se muestran aparte, para saber qué falta. */
  const pendientes = useMemo(() => tractores.filter((t) => !t.contenedorId), [tractores])
  const yaCargados = useMemo(() => tractores.filter((t) => t.contenedorId), [tractores])

  const [contenedores, setContenedores] = useState<ContenedorEnArmado[]>(() =>
    pendientes.length > 0 ? [{ clave: nuevaClave(), numero: '', tractorIds: [] }] : [],
  )
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const asignados = new Set(contenedores.flatMap((c) => c.tractorIds))
  const sinAsignar = pendientes.filter((t) => !asignados.has(t.id))

  const sinNumero = contenedores.filter((c) => !c.numero.trim())
  const vacios = contenedores.filter((c) => c.tractorIds.length === 0)
  const repetidos = contenedores.filter(
    (c, i) =>
      c.numero.trim() &&
      contenedores.findIndex(
        (o) => o.numero.trim().toUpperCase() === c.numero.trim().toUpperCase(),
      ) !== i,
  )

  const listo =
    contenedores.length > 0 &&
    sinAsignar.length === 0 &&
    sinNumero.length === 0 &&
    vacios.length === 0 &&
    repetidos.length === 0

  const agregar = () =>
    setContenedores((a) => [...a, { clave: nuevaClave(), numero: '', tractorIds: [] }])

  const quitar = (clave: string) => setContenedores((a) => a.filter((c) => c.clave !== clave))

  const cambiarNumero = (clave: string, numero: string) =>
    setContenedores((a) => a.map((c) => (c.clave === clave ? { ...c, numero } : c)))

  /** Un tractor está en un solo contenedor: marcarlo en otro lo saca del anterior. */
  const alternarTractor = (clave: string, tractorId: string) =>
    setContenedores((a) =>
      a.map((c) => {
        if (c.clave !== clave) {
          return { ...c, tractorIds: c.tractorIds.filter((id) => id !== tractorId) }
        }
        return c.tractorIds.includes(tractorId)
          ? { ...c, tractorIds: c.tractorIds.filter((id) => id !== tractorId) }
          : { ...c, tractorIds: [...c.tractorIds, tractorId] }
      }),
    )

  const guardar = async () => {
    setEnviando(true)
    setError(null)
    const creados: string[] = []
    const advertencias: string[] = []

    /* Uno por uno: si el tercero falla, los dos anteriores ya quedaron creados con sus tractores
       conectados y no hay nada que deshacer. */
    for (const c of contenedores) {
      try {
        await crearContenedor(
          c.numero.trim(),
          pendientes.filter((t) => c.tractorIds.includes(t.id)),
          op.id,
        )
        creados.push(c.numero.trim())
      } catch (e) {
        advertencias.push(`No se pudo crear el contenedor ${c.numero}: ${mensaje(e)}`)
      }
    }

    setEnviando(false)
    if (creados.length === 0) {
      setError(advertencias.join(' · ') || 'No se creó ningún contenedor.')
      return
    }
    onListo({ creados, advertencias })
  }

  /** Cómo se lee un tractor en la lista: el chasis primero, que es lo que lo distingue. */
  const Tractor = ({ t }: { t: TractorDeOp }) => (
    <>
      <span className="chasis">{t.chasis || 'Sin chasis'}</span>
      <span className="tractor-nom">{t.nombre}</span>
      {t.modelo && <span className="chip chip--magenta">{t.modelo}</span>}
      {t.rodado && <span className="chip chip--lima">{t.rodado}</span>}
    </>
  )

  return (
    <>
      <div className="scroll">
        <div className="view">
          <div className="sec-head">
            <span className="sec-num">
              <i className="fa-solid fa-boxes-packing" aria-hidden="true" />
            </span>
            <span className="sec-txt">
              <span className="sec-tit">Armar contenedores · {op.nombre}</span>
              <span className="sec-det">
                Cargá cada contenedor con su número y marcá qué tractores van adentro. Tienen que
                entrar <b>todos</b>: un tractor sin contenedor es uno que nadie va a ir a buscar.
              </span>
            </span>
          </div>

          {error && (
            <div className="aviso aviso--error">
              <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className="filtros">
            <span className="filtros-nota filtros-nota--sola">
              <i className="fa-solid fa-circle-info" aria-hidden="true" />
              {op.nroOp && <span className="chip chip--teal">OP {op.nroOp}</span>}
              <span className="chip chip--indigo">{tractores.length} tractores en la OP</span>
              {op.cantidadContenedores != null && op.cantidadContenedores > 0 && (
                <span
                  className="chip chip--violeta"
                  title="Lo que estimó la app al crear el despacho"
                >
                  {op.cantidadContenedores} estimados
                </span>
              )}
              <span className={`chip ${sinAsignar.length === 0 ? 'chip--verde' : 'chip--ambar'}`}>
                {sinAsignar.length === 0
                  ? 'Todos asignados'
                  : `Faltan ${sinAsignar.length} por asignar`}
              </span>
            </span>
          </div>

          {/* Lo que falta, siempre a la vista: es la única condición para poder guardar. */}
          {sinAsignar.length > 0 && (
            <div className="aviso aviso--alerta">
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
              <span>
                <b>
                  {sinAsignar.length === 1
                    ? 'Falta ubicar 1 tractor.'
                    : `Faltan ubicar ${sinAsignar.length} tractores.`}
                </b>{' '}
                Marcalos en alguno de los contenedores:
                <span className="aviso-chips">
                  {sinAsignar.map((t) => (
                    <span key={t.id} className="chip chip--ambar">
                      {t.chasis || t.nombre}
                    </span>
                  ))}
                </span>
              </span>
            </div>
          )}

          {yaCargados.length > 0 && (
            <div className="aviso aviso--info">
              <i className="fa-solid fa-circle-check" aria-hidden="true" />
              <span>
                {yaCargados.length} tractor{yaCargados.length === 1 ? '' : 'es'} de esta OP ya
                {yaCargados.length === 1 ? ' está' : ' están'} en un contenedor armado
                {armados.length > 0 && ` (${armados.map((c) => c.numero || c.nombre).join(', ')})`}.
                Acá sólo se arman los que faltan.
              </span>
            </div>
          )}

          <div className="op-editores">
            {contenedores.map((c, i) => {
              const dentro = pendientes.filter((t) => c.tractorIds.includes(t.id))
              const repetido = repetidos.includes(c)
              return (
                <div
                  key={c.clave}
                  className={`card card--flush op-editor${
                    c.tractorIds.length === 0 || !c.numero.trim() ? ' op-editor--pendiente' : ''
                  }`}
                >
                  <div className="ctitle op-editor-head">
                    <span className="op-editor-nom">
                      <i className="fa-solid fa-box" aria-hidden="true" /> Contenedor {i + 1}
                    </span>
                    <span className="op-editor-chips">
                      <span className={`chip ${dentro.length > 0 ? 'chip--verde' : 'chip--ambar'}`}>
                        {dentro.length} tractor{dentro.length === 1 ? '' : 'es'}
                      </span>
                      {contenedores.length > 1 && (
                        <button
                          type="button"
                          className="btn btn--texto btn--chico"
                          onClick={() => quitar(c.clave)}
                        >
                          <i className="fa-solid fa-trash" aria-hidden="true" /> Quitar
                        </button>
                      )}
                    </span>
                  </div>

                  <div className="op-editor-cuerpo">
                    <label className="campo" style={{ maxWidth: 320 }}>
                      <span className="campo-lbl">Número de contenedor</span>
                      <input
                        className="input"
                        value={c.numero}
                        placeholder="Ej: MSKU 123456-7"
                        onChange={(e) => cambiarNumero(c.clave, e.target.value)}
                      />
                      {repetido && (
                        <span className="campo-ayuda campo-ayuda--falta">
                          Ese número ya está en otro contenedor de esta OP.
                        </span>
                      )}
                    </label>

                    <div className="tractores-cont">
                      <span className="campo-lbl">Tractores que van en este contenedor</span>
                      {pendientes.map((t) => {
                        const marcado = c.tractorIds.includes(t.id)
                        const enOtro = asignados.has(t.id) && !marcado
                        return (
                          <button
                            key={t.id}
                            type="button"
                            aria-pressed={marcado}
                            className={`tractor-fila${marcado ? ' tractor-fila--sel' : ''}${
                              enOtro ? ' tractor-fila--otro' : ''
                            }`}
                            onClick={() => alternarTractor(c.clave, t.id)}
                          >
                            <span className={`trow-check${marcado ? ' trow-check--sel' : ''}`}>
                              {marcado && <i className="fa-solid fa-check" aria-hidden="true" />}
                            </span>
                            <Tractor t={t} />
                            {enOtro && <span className="chip chip--azul">En otro contenedor</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="final-acciones" style={{ marginTop: 14, justifyContent: 'flex-start' }}>
            <button type="button" className="btn btn--borde" onClick={agregar}>
              <i className="fa-solid fa-plus" aria-hidden="true" /> Agregar otro contenedor
            </button>
            <a
              className="btn btn--texto"
              href={URL_TABLERO_CONTENEDORES}
              target="_blank"
              rel="noreferrer"
            >
              <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /> Ver el
              tablero
            </a>
          </div>
        </div>
      </div>

      <footer className="pie">
        <div className="pie-info">
          <span className="font-b">
            {contenedores.length} contenedor{contenedores.length === 1 ? '' : 'es'} armado
            {contenedores.length === 1 ? '' : 's'}
          </span>
          <span className="xs">
            {sinAsignar.length > 0
              ? `Faltan ${sinAsignar.length} tractor${sinAsignar.length === 1 ? '' : 'es'}`
              : sinNumero.length > 0
                ? 'Falta el número de algún contenedor'
                : vacios.length > 0
                  ? 'Hay un contenedor sin tractores'
                  : 'Listo para guardar'}
          </span>
        </div>

        <div className="pie-acciones">
          <button type="button" className="btn btn--texto" disabled={enviando} onClick={onVolver}>
            <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Volver
          </button>
          <button
            type="button"
            className="btn btn--marca"
            disabled={!listo || enviando}
            onClick={() => void guardar()}
          >
            {enviando ? (
              <>
                <span className="spin" aria-hidden="true" /> Creando en monday…
              </>
            ) : (
              <>
                <i className="fa-solid fa-boxes-packing" aria-hidden="true" /> Guardar contenedores
              </>
            )}
          </button>
        </div>
      </footer>
    </>
  )
}
