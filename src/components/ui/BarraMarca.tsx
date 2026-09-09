interface Props {
  titulo: string
  subtitulo: string
}

/**
 * Barra superior de la app: la marca abre el bloque contra el margen izquierdo, como en el resto
 * de las apps del equipo.
 *
 * El logo se referencia por URL (`/logo-berger.svg`, servido desde `public/`) en vez de importarse
 * como módulo: así se reemplaza el archivo por el oficial de BERGER —un PNG, un SVG, el que sea—
 * sin recompilar ni tocar una línea de código.
 */
export function BarraMarca({ titulo, subtitulo }: Props) {
  return (
    <header className="marca">
      <img className="marca-logo" src="/logo-berger.svg" alt="BERGER S.A." />
      <span className="marca-sep" aria-hidden="true" />
      <div className="marca-txt">
        <span className="marca-tit">{titulo}</span>
        <span className="marca-sub">{subtitulo}</span>
      </div>
      <span className="marca-build" title="Build en ejecución">
        {__COMMIT__}
      </span>
    </header>
  )
}
