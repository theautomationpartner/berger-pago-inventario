import { useRef } from 'react'
import { pesoArchivo } from '@/lib/format'

interface Props {
  /** Cómo se llama el comprobante. */
  rotulo: string
  /** Lo que ya está subido en monday, tal como lo devuelve la columna. */
  yaSubidos: { nombre: string; url: string }[]
  /** Lo que se va a subir al guardar. */
  pendientes: File[]
  onCambiar: (archivos: File[]) => void
  /**
   * Si admite más de uno.
   *
   * Hoy sólo Senasa: de un despacho pueden salir varios certificados, y obligar a elegirlos de a
   * uno era hacer el mismo trámite tres veces. El resto es un único PDF por columna.
   */
  varios?: boolean
}

/**
 * Una fila de la lista de comprobantes.
 *
 * Reemplaza al recuadro grande de arrastrar y soltar. Ocho recuadros ocupaban una pantalla entera
 * para mostrar, casi siempre, ocho veces el mismo texto; en una lista cada comprobante es un
 * renglón y lo que se ve de un vistazo es **qué hay subido y qué falta**, que es la pregunta real.
 *
 * Lo que está en monday se muestra como etiqueta verde con su nombre, y se abre. Lo que todavía no
 * se subió va en ámbar, con una cruz para sacarlo antes de guardar: hasta que no se aprieta
 * Guardar no viajó nada.
 */
export function FilaArchivo({ rotulo, yaSubidos, pendientes, onCambiar, varios }: Props) {
  const input = useRef<HTMLInputElement>(null)

  const agregar = (lista: FileList | null) => {
    if (!lista || lista.length === 0) return
    const nuevos = [...lista].filter((f) => f.name.toLowerCase().endsWith('.pdf'))
    onCambiar(varios ? [...pendientes, ...nuevos] : nuevos.slice(0, 1))
    // Sin esto, volver a elegir EL MISMO archivo no dispara `change` y no pasa nada.
    if (input.current) input.current.value = ''
  }

  const quitar = (i: number) => onCambiar(pendientes.filter((_, n) => n !== i))

  const vacio = pendientes.length === 0 && yaSubidos.length === 0

  /* El botón dice lo que va a pasar, que no siempre es lo mismo: monday SUMA el archivo a la
     columna en vez de reemplazarlo, así que con algo ya subido lo que se hace es adjuntar otro.
     Lo único que sí se reemplaza es lo que todavía no viajó. */
  const rotuloBoton =
    pendientes.length > 0 && !varios
      ? 'Cambiar el elegido'
      : yaSubidos.length > 0
        ? 'Adjuntar otro'
        : 'Adjuntar PDF'

  return (
    <div className="farch">
      <div className="farch-nom">
        <span className="farch-rot">{rotulo}</span>
        {varios && <span className="farch-varios">admite varios</span>}
      </div>

      <div className="farch-tags">
        {yaSubidos.map((a) => (
          <a
            key={a.url}
            className="chip chip--verde chip--link"
            href={a.url}
            target="_blank"
            rel="noreferrer"
            title={a.nombre}
          >
            <i className="fa-solid fa-file-pdf" aria-hidden="true" /> {a.nombre}
          </a>
        ))}

        {pendientes.map((f, i) => (
          <span key={`${f.name}-${i}`} className="chip chip--ambar farch-pend">
            <i className="fa-solid fa-cloud-arrow-up" aria-hidden="true" /> {f.name}
            <span className="farch-peso">{pesoArchivo(f.size)}</span>
            <button
              type="button"
              className="farch-x"
              aria-label={`Quitar ${f.name}`}
              onClick={() => quitar(i)}
            >
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          </span>
        ))}

        {vacio && <span className="farch-vacio">Sin adjuntar</span>}
      </div>

      <button
        type="button"
        className="btn btn--borde btn--chico farch-btn"
        onClick={() => input.current?.click()}
      >
        <i className="fa-solid fa-paperclip" aria-hidden="true" /> {rotuloBoton}
      </button>

      <input
        ref={input}
        type="file"
        accept=".pdf"
        multiple={varios}
        hidden
        onChange={(e) => agregar(e.target.files)}
      />
    </div>
  )
}
