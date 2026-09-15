import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import type { PerfilIngreso } from '@/services/acceso/cliente'
import { CampoCodigo } from './CampoCodigo'
import { MarcoIngreso } from './MarcoIngreso'

interface Props {
  perfil: PerfilIngreso
  otpauth: string
  secreto: string
  mensaje: string | null
  enviando: boolean
  onConfirmar: (codigo: string) => void
  onCambiarPerfil?: () => void
}

/** La clave en bloques de 4, para copiarla a mano sin perderse: `ABCD EFGH IJKL …`. */
const enBloques = (secreto: string) => secreto.match(/.{1,4}/g)?.join(' ') ?? secreto

/**
 * Primera vez: se escanea el QR con la app del celular y se confirma con el primer código.
 *
 * El QR se dibuja EN el navegador, a partir del `otpauth://` que manda el servidor. Mandarlo a un
 * servicio externo de generación de QR sería entregarle el secreto del autenticador a un tercero.
 *
 * La clave en texto está debajo, para quien no puede escanear —por ejemplo, porque está usando la
 * app de monday en el mismo celular donde tiene el autenticador—.
 */
export function ConfigurarAutenticador({
  perfil,
  otpauth,
  secreto,
  mensaje,
  enviando,
  onConfirmar,
  onCambiarPerfil,
}: Props) {
  const [qr, setQr] = useState<string | null>(null)
  const [verClave, setVerClave] = useState(false)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    let vigente = true
    QRCode.toDataURL(otpauth, { margin: 1, width: 220, errorCorrectionLevel: 'M' })
      .then((url) => vigente && setQr(url))
      .catch(() => vigente && setVerClave(true))
    return () => {
      vigente = false
    }
  }, [otpauth])

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(secreto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setVerClave(true)
    }
  }

  return (
    <MarcoIngreso
      ancha
      titulo="Configurá tu verificación"
      bajada={
        <>
          Hola <b>{perfil.nombre}</b>. Es la primera vez que entrás: vinculá tu celular una sola vez y
          después sólo te vamos a pedir un código de 6 dígitos por día.
        </>
      }
    >
      <ol className="ingreso-pasos">
        <li>
          <span className="ingreso-paso-num">1</span>
          <span>
            Abrí <b>Google Authenticator</b> (o Microsoft Authenticator, Authy, 1Password) en tu
            celular y escaneá este código.
          </span>
        </li>
      </ol>

      <div className="ingreso-qr">
        {qr ? (
          <img src={qr} alt="Código QR para vincular el autenticador" width={220} height={220} />
        ) : (
          <span className="spin spin--oscuro" aria-hidden="true" />
        )}
      </div>

      <div className="ingreso-clave">
        <button type="button" className="btn btn--texto btn--chico" onClick={() => setVerClave((v) => !v)}>
          <i className="fa-solid fa-keyboard" aria-hidden="true" />
          {verClave ? 'Ocultar la clave' : '¿No podés escanear? Ingresá la clave a mano'}
        </button>
        {verClave && (
          <div className="ingreso-clave-caja">
            <code className="ingreso-clave-txt">{enBloques(secreto)}</code>
            <button type="button" className="btn btn--borde btn--chico" onClick={() => void copiar()}>
              <i className={`fa-solid ${copiado ? 'fa-check' : 'fa-copy'}`} aria-hidden="true" />
              {copiado ? 'Copiada' : 'Copiar'}
            </button>
          </div>
        )}
      </div>

      <ol className="ingreso-pasos" start={2}>
        <li>
          <span className="ingreso-paso-num">2</span>
          <span>Escribí el código de 6 dígitos que muestra la app para confirmar.</span>
        </li>
      </ol>

      <CampoCodigo onCompleto={onConfirmar} deshabilitado={enviando} reinicio={mensaje} />

      {mensaje && (
        <div className="aviso aviso--error ingreso-aviso">
          <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
          <span>{mensaje}</span>
        </div>
      )}
      {enviando && <p className="ingreso-nota">Verificando…</p>}

      {onCambiarPerfil && (
        <button type="button" className="btn btn--texto btn--chico ingreso-volver" onClick={onCambiarPerfil}>
          <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Elegir otro perfil
        </button>
      )}
    </MarcoIngreso>
  )
}
