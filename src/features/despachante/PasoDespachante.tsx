import type { Despachante } from '@/types'

interface Props {
  despachantes: Despachante[]
  cargando: boolean
  error: string | null
  onReintentar: () => void
  elegidoId: string | null
  onElegir: (id: string | null) => void
  /** El texto que va a recibir: la sección "Informacion para Despachante" del reporte. */
  informacion: string
  /** Número del paso dentro de su operación. */
  numeroPaso: number
}

/**
 * Elegir a quién se le manda el despacho, y ver qué se le manda.
 *
 * Es el mismo paso en las dos modalidades —cambia sólo el número— y por eso es un componente
 * compartido: la lista de despachantes y la vista previa tienen que ser idénticas, porque lo que
 * se confirma acá es exactamente lo mismo en las dos.
 *
 * La vista previa no es un resumen escrito aparte: es el TEXTO que se guarda en el pago y que el
 * despachante va a leer. Mostrar una versión parecida obligaría a mantener dos redacciones y, el
 * día que se separen, lo que se aprueba en pantalla no sería lo que sale.
 */
export function PasoDespachante({
  despachantes,
  cargando,
  error,
  onReintentar,
  elegidoId,
  onElegir,
  informacion,
  numeroPaso,
}: Props) {
  return (
    <>
      <div className="sec-head">
        <span className="sec-num">{numeroPaso}</span>
        <span className="sec-txt">
          <span className="sec-tit">Despachante</span>
          <span className="sec-det">
            Elegí a quién se le manda la información del despacho. Queda asignado al item que se
            crea en <b>Despachante de aduana</b> y es quien recibe el mail.
          </span>
        </span>
      </div>

      {error && (
        <div className="aviso aviso--error">
          <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
          <span>
            No se pudo leer el equipo de Despachantes: {error}{' '}
            <button type="button" className="btn btn--texto btn--chico" onClick={onReintentar}>
              Reintentar
            </button>
          </span>
        </div>
      )}

      <div className="lista" style={{ marginBottom: 16 }}>
        <div className="lista-head">
          <span>Despachante</span>
          <span className="lista-head-acciones">
            <button type="button" className="btn btn--borde btn--chico" onClick={onReintentar}>
              <i className="fa-solid fa-rotate" aria-hidden="true" /> Actualizar
            </button>
          </span>
        </div>

        <div className="lista-body">
          {cargando && (
            <div className="vacio">
              <span className="spin spin--oscuro" aria-hidden="true" />
              <span className="vacio-tit">Buscando despachantes…</span>
            </div>
          )}

          {!cargando && despachantes.length === 0 && !error && (
            <div className="vacio">
              <span className="vacio-ic">
                <i className="fa-solid fa-user-slash" aria-hidden="true" />
              </span>
              <span className="vacio-tit">No hay despachantes cargados</span>
              <span className="vacio-det">
                El equipo <b>Despachantes</b> de monday está vacío. Agregá ahí a quien corresponda y
                volvé a actualizar.
              </span>
            </div>
          )}

          {!cargando &&
            despachantes.map((d) => {
              const marcado = d.id === elegidoId
              return (
                <button
                  key={d.id}
                  type="button"
                  aria-pressed={marcado}
                  className={`trow${marcado ? ' trow--sel' : ''}`}
                  onClick={() => onElegir(marcado ? null : d.id)}
                >
                  <span className={`trow-radio${marcado ? ' trow-radio--sel' : ''}`} />
                  <span className="persona">
                    {d.foto ? (
                      <img className="persona-foto" src={d.foto} alt="" />
                    ) : (
                      <span className="persona-foto persona-foto--sin" aria-hidden="true">
                        <i className="fa-solid fa-user" />
                      </span>
                    )}
                    <span className="persona-txt">
                      <span className="persona-nom">{d.nombre}</span>
                      {d.email && <span className="persona-mail">{d.email}</span>}
                    </span>
                  </span>
                </button>
              )
            })}
        </div>
      </div>

      <div className="card card--flush">
        <div className="ctitle">
          <i className="fa-solid fa-envelope-open-text" aria-hidden="true" />
          Información que se le manda
        </div>
        {informacion ? (
          <pre className="previo">{informacion}</pre>
        ) : (
          <div className="vacio">
            <span className="vacio-ic">
              <i className="fa-solid fa-file-circle-question" aria-hidden="true" />
            </span>
            <span className="vacio-tit">Este pago no tiene información de contenedores</span>
            <span className="vacio-det">
              Se cargó antes de que la app armara los contenedores. El despacho se crea igual, pero
              la cantidad de contenedores hay que completarla a mano.
            </span>
          </div>
        )}
      </div>
    </>
  )
}
