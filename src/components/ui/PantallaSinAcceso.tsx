interface Props {
  /** `otra-cuenta` distingue "no estás en monday" de "estás, pero en otra empresa". */
  motivo: 'fuera-de-monday' | 'otra-cuenta'
}

/**
 * Pantalla de acceso denegado.
 *
 * Es lo ÚNICO que se dibuja cuando la app no está corriendo dentro del monday de BERGER: sin
 * barra de marca, sin selector de operación y sin ninguna consulta al tablero. La app no llega a
 * pedir datos, así que no hay nada que filtrar ni siquiera por un instante.
 *
 * El texto no explica cómo entrar ni menciona tableros ni cuentas: a alguien que llegó por la URL
 * del deploy no hay nada que contarle, y cada detalle de más es una pista sobre qué hay del otro
 * lado. Quien sí tiene que usarla la abre desde monday y nunca ve esta pantalla.
 */
export function PantallaSinAcceso({ motivo }: Props) {
  return (
    <div className="sin-acceso">
      <span className="sin-acceso-ic">
        <i className="fa-solid fa-lock" aria-hidden="true" />
      </span>
      <h1 className="sin-acceso-tit">No tenés acceso a este contenido</h1>
      <p className="sin-acceso-det">
        {motivo === 'otra-cuenta' ? (
          <>Esta aplicación está habilitada sólo para una cuenta de monday.com.</>
        ) : (
          <>
            Esta aplicación funciona únicamente dentro de <b>monday.com</b>.
          </>
        )}
      </p>
    </div>
  )
}

/** Espera mientras monday responde quién es el usuario. Dura un instante dentro del iframe. */
export function PantallaVerificando() {
  return (
    <div className="sin-acceso">
      <span className="spin spin--oscuro" aria-hidden="true" />
      <p className="sin-acceso-det">Verificando el acceso…</p>
    </div>
  )
}
