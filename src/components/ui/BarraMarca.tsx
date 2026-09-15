interface Props {
  titulo: string
  subtitulo: string
  /** Perfil con el que se entró. Se muestra junto a la acción de salir. */
  perfil?: string
  onSalir?: () => void
}

/**
 * Barra superior de la app: la marca abre el bloque contra el margen izquierdo, como en el resto
 * de las apps del equipo.
 *
 * El logo se referencia por URL (`/logo-berger.svg`, servido desde `public/`) en vez de importarse
 * como módulo: así se reemplaza el archivo por el oficial de BERGER —un PNG, un SVG, el que sea—
 * sin recompilar ni tocar una línea de código.
 *
 * A la derecha, quién está adentro y cómo salir. Con la cuenta de monday compartida entre varios
 * administradores, ver con qué perfil se entró evita cargar algo a nombre de otro, y "Salir" es la
 * forma de que otra persona entre desde la misma computadora sin esperar al día siguiente.
 */
export function BarraMarca({ titulo, subtitulo, perfil, onSalir }: Props) {
  return (
    <header className="marca">
      <img className="marca-logo" src="/logo-berger.svg" alt="BERGER S.A." />
      <span className="marca-sep" aria-hidden="true" />
      <div className="marca-txt">
        <span className="marca-tit">{titulo}</span>
        <span className="marca-sub">{subtitulo}</span>
      </div>
      <div className="marca-derecha">
        {perfil && (
          <span className="chip chip--indigo marca-perfil" title="Perfil con el que entraste">
            <i className="fa-solid fa-user" aria-hidden="true" /> {perfil}
          </span>
        )}
        {onSalir && (
          <button type="button" className="btn btn--texto btn--chico marca-salir" onClick={onSalir}>
            <i className="fa-solid fa-right-from-bracket" aria-hidden="true" />
            <span className="marca-salir-txt">Salir</span>
          </button>
        )}
        <span className="marca-build" title="Build en ejecución">
          {__COMMIT__}
        </span>
      </div>
    </header>
  )
}
