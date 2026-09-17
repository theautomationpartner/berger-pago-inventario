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
 *
 * Si el equipo de Despachantes está VACÍO, no se muestra ninguna lista para elegir: no hay a quién.
 * El despacho se crea igual, con la persona sin asignar, y se dice por qué. Bloquear la operación
 * ahí sería dejar el circuito trabado por un equipo de monday que la app no administra.
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
  /* Sin nadie en el equipo no hay nada que elegir: se avisa y se sigue. Mientras carga no se
     decide todavía, para no mostrar "no hay despachantes" durante medio segundo. */
  const equipoVacio = !cargando && !error && despachantes.length === 0

  return (
    <>
      <div className="sec-head">
        <span className="sec-num">{numeroPaso}</span>
        <span className="sec-txt">
          <span className="sec-tit">Despachante</span>
          <span className="sec-det">
            {equipoVacio
              ? 'El despacho se va a crear sin despachante asignado. Abajo está la información que lleva.'
              : 'Elegí a quién se le manda la información del despacho. Queda asignado al item que se crea en Despachante de aduana y es quien recibe el mail.'}
          </span>
        </span>
      </div>

      {equipoVacio && (
        <div className="aviso aviso--alerta">
          <i className="fa-solid fa-user-slash" aria-hidden="true" />
          <span>
            El equipo <b>Despachantes</b> de monday no tiene a nadie, así que el despacho se crea
            con el despachante <b>sin asignar</b>. Agregá a quien corresponda al equipo y asignalo
            después desde el tablero.
          </span>
        </div>
      )}

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

      {!equipoVacio && (
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
      )}

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
