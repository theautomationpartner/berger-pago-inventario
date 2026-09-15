# BERGER S.A. · Operaciones de Inventario de Tractores

Aplicación de **vista de tablero** (board view) de monday.com para las operaciones sobre el
inventario de tractores de BERGER S.A. Se instala en el workspace como un tablero más y se usa
tanto desde la computadora como desde la app de monday del celular.

React 18 + TypeScript sobre Vite. Los datos son en vivo: la app lee y escribe directo en los
tableros reales de la cuenta.

---

## Navegación

La app tiene tres niveles, y cada uno se elige en su propia pantalla. Una miga de pan arriba
muestra dónde está parado el usuario y permite volver a cualquier nivel anterior (dentro del iframe
de monday el "atrás" del navegador no sirve).

```
Operaciones   →  Modalidad           →  Etapa
────────────────────────────────────────────────────────────
DESPACHO      →  ANTICIPADO          →  1. Cargar Transferencia
                                        2. Aprobar Transferencia
                                        3. Confirmar Pago - SWIFT
              →  VISTA (CONTRA VL)   →  paso único
```

El primer panel —**Operaciones**— hoy tiene sólo DESPACHO, y existe igual a propósito: es donde se
suman los próximos tipos de operación sin cambiar la pantalla de entrada. Las opciones de los dos
paneles están descriptas como datos en [`src/lib/navegacion.ts`](src/lib/navegacion.ts).

### Lo que se ve de cada tractor

En **todos** los pasos donde aparece un tractor —las listas de selección, el detalle desplegable,
el resumen de la transferencia, la ficha del pago y el pedido a la vista— se muestran las mismas
etiquetas de color, de la misma forma
([`EtiquetasTractor`](src/features/tractores/EtiquetasTractor.tsx)):

| Etiqueta | Columna del Inventario | Color |
|----------|------------------------|-------|
| N° Interno | `text_mm6n7mk6` | índigo |
| Modelo | `lookup_mm726zx1` (mirror del Catálogo de Productos) | magenta |
| Estado Rodado | `color_mm72mfyd` | lima **Con Rodado** · naranja **Sin Rodado** · rojo si falta |

Ninguna etiqueta de la app va en gris. Los estados siguen el avance del circuito (ámbar → azul →
verde) y los atributos del tractor llevan cada uno su color fijo; el criterio vive en
[`src/lib/chips.ts`](src/lib/chips.ts).

---

## Despacho ANTICIPADO

El tractor se paga antes de despacharse. Son tres etapas que forman una cadena: cada una toma los
pagos que dejó la anterior.

| # | Etapa | Trabaja sobre | Deja el pago en |
|---|-------|---------------|-----------------|
| 1 | **Cargar Transferencia** | Tractores del Inventario en `Listo para Pagar` | `CARGADO` · `Pend de Aprobar Transf` |
| 2 | **Aprobar Transferencia** | Pagos en `Pend de Aprobar Transf` | `APROBADO` · `Pend de Confirmar Transf` |
| 3 | **Confirmar Pago - SWIFT** | Pagos en `Pend de Confirmar Transf` **y** `APROBADO` | `CONFIRMADO` · `Pagado` |

### El circuito, columna por columna

Tablero de **Pagos del Inventario** (`18430295445`):

| Columna | Op 1 | Op 2 | Op 3 |
|---------|------|------|------|
| Estado Pago `color_mm71p4rf` | `CARGADO` | `APROBADO` | `CONFIRMADO` |
| Operación Pend `color_mm71e2wc` | `Pend de Aprobar Transf` | `Pend de Confirmar Transf` | `Pagado` |
| Fecha de la etapa | `date_mm71zare` | `date_mm71xrq5` | `date_mm71q4qa` |
| Comprobante adjunto | `file_mm71eqv5` transferencia | `file_mm71s567` transf. c/número | `file_mm713dbc` comprobante del banco |
| Aviso por mail | — | `color_mm71tfkp` = `Enviar` | `color_mm71bk6h` = `Enviar` |

Y en paralelo, cada tractor del pago avanza en **Inventario** (`color_mm6v6532`):
`Listo para Pagar` → `Transf Cargada` → `Transf Aprobada` → `Pagado`.

### Etapa 1 — Cargar Transferencia

**Paso 1 · Selección.** La app trae del tablero de **Inventario** **todos** los tractores con
`Estado Pago` = **Listo para Pagar**, sin importar el mes.

Para acotar, se eligen **meses de producción** (`Fecha Prod`, `date_mm6nymx`) desde un desplegable
que ofrece desde 12 meses antes hasta 12 meses después del actual. Cada mes elegido queda como una
etiqueta con su **X** para quitarlo, y se pueden combinar: sin ninguno se ve todo; con uno o más,
sólo los tractores de esos meses. Cada opción del desplegable muestra cuántos tractores listos
tiene ese mes.

El filtro se aplica sobre la lista ya cargada —no vuelve a consultar monday— y **no borra la
selección**: un tractor ya elegido sigue en el resumen de abajo aunque su mes salga del filtro. Así
se arma una transferencia con tractores de varios meses. Si hay tractores sin `Fecha Prod`, con un
filtro activo se avisa cuántos quedan afuera.

Cada fila muestra el nombre del item, sus etiquetas (N° interno, modelo, rodado), la fecha de
producción y el valor neto. Al marcarlos se arma abajo una lista desplegable con el detalle
completo de cada uno —costo de flete, precio unitario, valor neto, forma de pago, N° de draft,
código de producto y fecha— y el **total del valor neto** de la selección.

**Paso 2 · Transferencia.** Recuadro para adjuntar el PDF, monto —propuesto con el total,
editable— y fecha de emisión.

Al apretar *Cargar Pago* se crea el item en **Pagos del Inventario** con las columnas de la tabla
de arriba, más el monto (`numeric_mm714xb2`) y la fecha de emisión (`date_mm71jrsz`); y sus
**subitems** (`18430295515`), uno por tractor:

| Dato | Columna del subitem | Origen en Inventario |
|------|---------------------|----------------------|
| Nombre del tractor | `name` | `name` |
| Valor Neto | `numeric_mm71c5je` | `lookup_mm6vj4cp` |
| N° de Draft | `text_mm71atj2` | `text_mm6ne4br` |
| Cod. de Producto | `text_mm71zgys` | `lookup_mm6z4hd1` |
| Conexión al tractor | `board_relation_mm718zjg` | item del Inventario |

### Etapas 2 y 3 — avanzar un pago

Las dos tienen la misma forma: se elige **un** pago pendiente (de a uno, porque cada uno tiene su
propio comprobante), se ve la ficha completa —datos del item y los tractores del subitem con su
estado actual en el Inventario— y se adjunta el documento de la etapa.

La conexión `board_relation_mm718zjg` del subitem es lo que permite avanzar el estado del tractor
sin volver a buscarlo por nombre. Si un subitem quedó sin conexión, la app lo muestra con un chip
rojo y lo informa como advertencia, en vez de saltearlo en silencio.

El aviso por mail se dispara **último**, después de que todo lo demás quedó escrito: es lo único
irreversible de la operación, porque una vez que la automatización lo manda, el proveedor ya lo
recibió.

Las dos operaciones comparten componente y servicio; lo único propio de cada una está descripto
como datos en [`src/lib/flujos.ts`](src/lib/flujos.ts).

---

## Despacho a la VISTA (contra VL)

El pedido se hace **sin pago previo**. Es un único paso: se eligen del Inventario los tractores con
`Forma de Pago` (`dropdown_mm6v2sa0`) en **VISTA**, con el mismo detalle que en ANTICIPADO
—etiquetas, costo de flete, precio unitario, valor neto, forma de pago, N° de draft, código de
producto y fecha— y el total del valor neto.

A diferencia de ANTICIPADO, cada fila muestra además el **Estado Pago** del tractor: en la vista no
hay un estado que filtre la lista, así que ver en cuál está cada uno es parte de decidir si se pide.

> **Pendiente:** el envío del pedido por mail todavía no está implementado. El botón *Enviar
> pedido* aparece deshabilitado y lo indica, en vez de simular que hace algo.

La selección, la carga de tractores y el resumen son los mismos componentes que usa ANTICIPADO
([`src/features/tractores/`](src/features/tractores/)).

---

## Correr en local

```bash
npm install
cp .env.example .env.local     # completar VITE_MONDAY_TOKEN
npm run dev                    # http://localhost:5182
```

| Script | Qué hace |
|--------|----------|
| `npm run dev` | Servidor de desarrollo de Vite con `--host` (accesible desde la red y desde el celular). |
| `npm run build` | Build de producción en `dist/`. |
| `npm run preview` | Sirve el build ya compilado. |
| `npm run typecheck` | `tsc --noEmit` sobre `src/` y `api/`. |

En localhost **el ingreso no corre** (Vite no ejecuta las funciones de `api/`) y se entra directo.
Para ver las pantallas del ingreso con un servidor simulado, abrí
`http://localhost:5182/?vista-previa`. Ahí `000000` es siempre un código incorrecto, para probar los
mensajes.

El navegador no puede pegarle directo a `api.monday.com` (CORS), así que Vite hace de proxy en dos
rutas: `/monday-api` → `/v2` (GraphQL) y `/monday-file` → `/v2/file` (subida de archivos).

---

## Ingreso: Lista Blanca y autenticador

Para entrar hay que pasar tres barreras, en orden. Ninguna dibuja la app hasta que pasa:

```
1. monday     ¿Se abrió dentro del monday de BERGER?            sessionToken firmado por monday
2. ingreso    ¿Está en la Lista Blanca y pasó el autenticador?  /api/acceso
3. datos      Cada pedido vuelve a comprobar 1 y 2              /api/monday · /api/monday-file
```

Las dos primeras deciden qué pantalla se ve. La que decide si se puede leer o escribir un dato es
la tercera, y está en el servidor: esconder la interfaz sin eso sería una cortina, no una puerta.

### Lista Blanca

Tablero **🔒Lista Blanca**. Cada fila es un **perfil**. Para entrar a esta app, el usuario de monday
logueado tiene que tener una fila con:

| Columna | Condición |
|---------|-----------|
| 🤚ID Usuarios `text_mm72j4e6` | igual al ID de usuario de monday de quien entra |
| 🤚Estado Usuario `status` | **Activo** |
| 🤚ID APP Habilitadas `dropdown_mm72bgr3` | incluye el id de esta app (`SEGURIDAD_APP_ID`) |

La Lista Blanca se vuelve a leer **en cada pedido de datos**, no sólo al entrar: pasar a alguien a
Inactivo o quitarle la app le corta el acceso en el acto, aunque tenga la sesión del día abierta.

**Perfiles compartidos.** Los administradores usan la misma cuenta de monday: varias filas con el
mismo ID de usuario. Eso sólo es válido si **todas** esas filas tienen Tipo Usuario = **ADMIN** y
Perfiles = **SI**; entonces, antes del autenticador, se elige con qué perfil se entra. Cada perfil
tiene su propio autenticador en su propio celular. Si hay filas repetidas que no cumplen eso, es un
error de carga y se niega el acceso: elegir una al azar le daría a alguien los permisos de otro.

**Mensaje único.** Cualquier rechazo —no está en la lista, inactivo, sin la app, otra cuenta— se
muestra igual: *"No tenés acceso a esta aplicación. Contactá al administrador."* Nunca revela si el
usuario existe ni qué hay adentro. El motivo real queda en el Registro de Accesos.

### Autenticador (TOTP)

Estándar abierto RFC 6238: sirve **Google Authenticator**, Microsoft Authenticator, Authy o
1Password. No hay servidor externo, mails ni costo.

- **Primera vez:** se muestra un QR (y la clave en texto para quien no puede escanear) y se
  confirma con el primer código. Después se entregan **10 códigos de recuperación de un solo uso**,
  que se muestran una única vez: no se puede seguir sin confirmar que se guardaron.
- **Cada día:** el primer ingreso del día calendario (hora de Argentina) pide el código de 6
  dígitos. Quien entra a las 23:50 lo vuelve a necesitar a las 00:10.
- **Un código sirve una sola vez**, se tolera ±30 segundos de reloj desfasado, y hay un **límite de 5
  intentos fallidos cada 15 minutos** por perfil.
- **🤚Desactivar Google Authenticator** (`color_mm779m2m`): sólo la etiqueta exacta **Desactivar**
  lo apaga. "NO Desactivar", vacío o cualquier otra lo deja encendido. Si el admin lo vuelve a
  encender, la sesión sin código de esa persona deja de servir en el siguiente pedido.

### Dónde se guarda cada cosa

| Qué | Dónde | Protección |
|-----|-------|-----------|
| Secreto del autenticador | 🔐 Seguridad · Autenticador (no editar) | Cifrado AES-256-GCM. La clave vive sólo en Vercel. Si se edita a mano, no descifra. |
| Códigos de recuperación | mismo tablero | Sólo su HMAC con una clave del servidor. No están en claro. |
| Intentos fallidos y último código usado | mismo tablero | — |
| Cada ingreso e intento fallido | 🔐 Registro de Accesos | Fecha, email, IP, usuario, perfil y motivo. |
| Sesión del día | `localStorage` del navegador | Token firmado por el servidor. No es una cookie: dentro del iframe de monday las cookies de terceros se bloquean de forma distinta en cada navegador. |

Los dos tableros de seguridad son **privados** y sólo los ve la cuenta administradora.

### Tareas del administrador

| Para… | Hacer… |
|-------|--------|
| Dar acceso a alguien | Agregar su fila en la Lista Blanca: ID de usuario, Activo y la app. |
| Quitar el acceso | Pasar su fila a **Inactivo** (o quitarle la app). Corta al instante. |
| Reiniciar el autenticador de alguien (perdió el celular) | **Borrar la fila de su perfil** en 🔐 Seguridad · Autenticador. En el próximo ingreso le aparece el QR. |
| Dejar entrar a alguien sin código, por un rato | Poner **Desactivar** en su fila de la Lista Blanca. Queda registrado como "Ingreso sin autenticador". |
| Detectar a alguien tanteando | Revisar 🔐 Registro de Accesos: varios "Acceso denegado" o "Código incorrecto" seguidos del mismo usuario o IP. |

> **Límite a tener presente.** La Lista Blanca vive en monday, así que quien controle la cuenta de
> monday de los administradores puede editarla —por ejemplo, desactivarle el autenticador a un
> perfil—. El autenticador de esos perfiles es tan fuerte como la contraseña de esa cuenta. Por eso
> conviene **activar la verificación en dos pasos de monday** en la cuenta compartida.

---

## Qué puede pedirle la app a monday

El cliente **no arma consultas GraphQL**. Manda el *nombre* de una operación del catálogo
([`src/services/monday/operaciones.ts`](src/services/monday/operaciones.ts)) y el texto de la
consulta lo pone el servidor, así que no se puede falsificar: lo que no está en el catálogo, no se
puede pedir.

Antes el proxy reenviaba el cuerpo tal cual, y eso lo convertía en una API completa de la cuenta:
cualquier usuario de BERGER con sesión —incluso uno de sólo lectura— podía abrir las herramientas
del navegador y ejecutar la consulta que quisiera con el token de la cuenta. El guard comprobaba
QUIÉN preguntaba, pero nunca QUÉ preguntaba.

Fijar el texto de la consulta no alcanza por sí solo, porque las variables siguen viniendo del
cliente: `change_multiple_column_values` con variables libres escribe en cualquier tablero de la
cuenta aunque la mutation esté fija. Por eso cada operación las valida:

- Los **ids de tablero de lectura los pone el servidor**; el que mande el cliente se descarta.
- En las **escrituras**, el tablero tiene que ser el de Inventario o el de Pagos, y **cada columna
  tocada tiene que estar en la lista de escribibles de ese tablero**. La app puede mover el Estado
  Pago de un tractor; no puede tocarle el precio de venta.
- Los **archivos** sólo entran en las tres columnas de comprobante del circuito, con un tope de
  20 MB.
- Ids, tamaños de página e índices de estado se validan de forma y de rango.

Los IDs de tableros y columnas **siguen siendo visibles** en el bundle, y eso es deliberado: no son
credenciales —sin un token válido no habilitan nada— y esconderlos exigiría mover todo el armado de
consultas al servidor. Lo que sí quedó cerrado es lo que se puede *hacer* con ellos.

---

## Seguridad del token

**El token nunca entra al repositorio ni al bundle que descarga el navegador.**

- `.env.local` está en `.gitignore` (la regla es `.env.*` con excepción de `.env.example`). Es el
  único lugar del disco donde vive el token en desarrollo.
- En **producción** el token va como `MONDAY_TOKEN` en las variables de entorno de Vercel y sólo lo
  leen las funciones serverless de `api/`, del lado del servidor.

> ⚠️ **`VITE_MONDAY_TOKEN` no va nunca en Vercel.** Vite reemplaza todo lo que empieza con `VITE_`
> por su valor literal dentro del JavaScript que descarga el navegador. Cargarla en el deploy
> publica el token para cualquiera que abra la URL y mire el bundle. Es exclusiva de `.env.local`.

Variables de entorno del deploy (los valores **no** están en el repositorio; están en Vercel):

| Variable | ¿Obligatoria? | Para qué |
|----------|---------------|----------|
| `MONDAY_TOKEN` | Sí | Token de la API. **Sin** prefijo `VITE_`. |
| `MONDAY_SIGNING_SECRET` | Sí (o la de abajo) | Signing secret de la app. Developer Center → tu app → Basic Information. |
| `MONDAY_CLIENT_SECRET` | Sí (o la de arriba) | Client secret de la misma pantalla. Se prueban las dos. |
| `MONDAY_ACCOUNT_ID` | No | Cuenta habilitada. Por defecto, la de BERGER S.A. |
| `SEGURIDAD_CLAVE_MAESTRA` | Sí · **compartida** | 32 bytes en base64url. Cifra los secretos del autenticador, firma la sesión del día y protege los códigos de recuperación. Marcarla como *Sensitive*. **Cambiarla obliga a todos a configurar el autenticador de nuevo.** |
| `SEGURIDAD_LISTA_BLANCA_TABLERO_ID` | Sí · **compartida** | Tablero 🔒Lista Blanca. |
| `SEGURIDAD_AUTENTICADOR_TABLERO_ID` | Sí · **compartida** | Tablero 🔐 Seguridad · Autenticador. |
| `SEGURIDAD_REGISTRO_TABLERO_ID` | Sí · **compartida** | Tablero 🔐 Registro de Accesos. |
| `SEGURIDAD_APP_ID` | Sí · **de cada app** | Id de esta app en la columna "ID APP Habilitadas" de la Lista Blanca. |

### Más de una app

La Lista Blanca y los dos tableros de seguridad son **de BERGER, no de esta app**: todas las apps
futuras usan los mismos. Por eso las variables `SEGURIDAD_` son de dos clases:

- **Compartidas** —la clave maestra y los tres ids de tablero—: mismo valor en todos los proyectos.
  Conviene cargarlas **una sola vez** en Vercel como *Shared Environment Variables* del equipo
  (Team Settings → Environment Variables → Shared) y vincularlas a cada proyecto. Cambiar una se
  hace en un lugar.
- **De cada app** —`SEGURIDAD_APP_ID`—: la única que cambia entre proyectos.

La clave maestra no sólo *puede* ser la misma: **tiene** que serlo. Todas las apps leen y escriben
el mismo tablero del autenticador, así que cada una tiene que poder descifrar el secreto que guardó
otra. Una persona configura el autenticador **una vez** y le sirve para todas las apps. Compartir la
clave no mezcla los accesos: la sesión del día lleva adentro para qué app es y sólo vale para esa.

Para sumar una app nueva: crear su proyecto en Vercel, vincularle las compartidas, cargarle su
`SEGURIDAD_APP_ID`, y agregar ese id en "ID APP Habilitadas" de quienes tengan que entrar.

Para generar la clave maestra:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

> Si el token de la API se filtró alguna vez (mail, chat, captura, un bundle publicado), hay que
> **revocarlo y generar uno nuevo** desde monday: developers → My access tokens.

---

## Estructura

```
api/                          Funciones serverless del deploy (Vercel, runtime edge)
  _guard.ts                   Verificación del sessionToken de monday
  acceso.ts                   Ingreso: Lista Blanca, perfiles y autenticador
  monday.ts                   Proxy GraphQL: resuelve operaciones del catálogo
  monday-file.ts              Proxy de subida de archivos (multipart)
  _seguridad/                 Sólo servidor: nunca llega al navegador
    porton.ts                 Las tres comprobaciones de cada pedido de datos
    acceso.ts                 Reglas de la Lista Blanca y de la sesión
    listaBlanca.ts            Lectura de la Lista Blanca
    autenticador.ts           Estado del TOTP y códigos de recuperación
    sesionApp.ts              Sesión del día firmada
    registro.ts               Registro de Accesos
    cripto.ts                 TOTP (RFC 6238), AES-256-GCM y HMAC sobre WebCrypto
    config.ts                 Variables de entorno e ids de columnas
public/
  logo-berger.svg             Logo de la barra superior — reemplazable sin recompilar
src/
  App.tsx                     Verificación de acceso + navegación de tres niveles
  types.ts                    Estructuras de datos de la app
  components/ui/              Piezas genéricas (marca, stepper, selector de etapa y de meses…)
  features/
    acceso/                   Pantallas del ingreso (perfil, QR, códigos, código del día)
    inicio/                   Paneles de elección y miga de pan
    anticipado/               Despacho ANTICIPADO
      DespachoAnticipado.tsx    Selector de las tres etapas
      CargarTransferencia.tsx   Etapa 1 (asistente de dos pasos)
      Paso1Seleccion.tsx        Selección con filtro de meses
      FlujoAvancePago.tsx       Etapas 2 y 3 (mismo flujo, distinta configuración)
      DetallePago.tsx           Ficha de un pago con sus tractores
    vista/
      DespachoVista.tsx         Despacho a la VISTA (paso único)
    tractores/                Lo que comparten las dos modalidades
      ListaTractores.tsx        Lista seleccionable
      ListaSeleccionados.tsx    Detalle desplegable de lo elegido
      ResumenSeleccion.tsx      Lo elegido + total del valor neto
      EtiquetasTractor.tsx      N° interno, modelo y rodado
      useTractores.ts           Carga de tractores y manejo de la selección
  hooks/                      Acceso a monday, clic afuera
  lib/
    navegacion.ts             Opciones de los paneles de entrada
    etapas.ts                 Las tres etapas de ANTICIPADO
    flujos.ts                 Las etapas 2 y 3 descriptas como datos
    meses.ts                  Meses del filtro (12 atrás y 12 adelante)
    chips.ts                  Color de cada etiqueta
    format.ts                 Números y fechas
  services/monday/            Todo lo que habla con monday
    columns.ts                IDs de tableros y columnas (única fuente de verdad)
    operaciones.ts            Catálogo de operaciones permitidas + validación de variables
    sdk.ts                    Cliente HTTP + subida de archivos
    parse.ts                  Lectura de column_values
    inventario.ts             Tractores listos para pagar y tractores VISTA
    pagos.ts                  Pagos pendientes con sus subitems
    crearPago.ts              Etapa 1: pago, subitems y estados
    avanzarPago.ts            Etapas 2 y 3: comprobante, estados, fechas y aviso
  styles/                     base · layout · components · pago
```

### Celular

La app se usa desde la app de monday del celular, así que la interfaz está pensada para esa
pantalla y no simplemente achicada:

- El alto se mide en `100dvh`, no `100vh`: en el celular la barra de direcciones aparece y
  desaparece con el scroll, y `100vh` deja el pie de acción cortado apenas se abre la app.
- Las tarjetas de operación se vuelven pestañas en una fila que scrollea en horizontal. Apiladas
  con su descripción se comían la pantalla entera antes de mostrar un solo dato.
- Las filas de las listas pasan a dos renglones (identificación arriba, importes abajo) y el pie
  a dos filas, con el botón principal ocupando el ancho completo.
- El stepper cambia a rótulos cortos: "Selección de tractores" no entra.
- Los campos van a 16px. Por debajo de ese tamaño iOS hace zoom al enfocarlos y deja el resto del
  formulario fuera de la vista.
- Todo lo que se toca mide 44px de alto como mínimo.

El resto del layout usa **container queries** sobre `.app`, no media queries: dentro de monday el
ancho útil depende de los paneles laterales abiertos, no del tamaño de la ventana.

### El logo

`public/logo-berger.svg` es un **marcador reconstruido**, no el archivo original de la marca. Para
poner el oficial alcanza con dejar el archivo en `public/` y apuntar el `src` de
`src/components/ui/BarraMarca.tsx` al nombre nuevo. No hace falta tocar nada más.

La caja del logo se mide por **alto** (52px; 40px en celular) y deja el ancho libre hasta 260px,
con `object-fit: contain`. Con ese margen entra entero cualquier archivo hasta una proporción de
5:1, sin recortarse ni achicarse. Si el logo oficial fuera todavía más ancho, el único ajuste es
subir el `max-width` de `.marca-logo`.

---

## Notas de la API de monday que costaron encontrarse

Están comentadas en el código, pero conviene tenerlas juntas:

1. **Las columnas mirror devuelven `text: null` siempre**, incluso teniendo dato. El valor está en
   `display_value`, que sólo aparece pidiendo el fragmento `... on MirrorValue`. Sin eso, los
   cuatro importes del tractor se leen vacíos y nada avisa.
2. **Los filtros de `status` comparan por índice, no por etiqueta.** Mandar `"Listo para Pagar"`
   devuelve una lista vacía sin error. La variable tiene que declararse como `CompareValue!`: con
   `[String]` monday rechaza la query entera.
3. **`query_params` no se puede combinar con un cursor.** La paginación va por
   `next_items_page(cursor:)`, que ya arrastra el filtro de la primera página.
4. **La subida de archivos no sigue la especificación de GraphQL multipart.** El campo es `query`
   (con `operations` contesta *"query not found in multipart form"*), las variables van como
   `variables[nombre]` y el `map` asocia texto plano, no un array.
5. **Una `board_relation` devuelve `text: null`**, igual que los mirrors. Los items conectados
   salen por `... on BoardRelationValue { linked_item_ids }`, y son justamente el dato que las
   operaciones 2 y 3 necesitan para avanzar el estado del tractor.

---

## Deploy en Vercel

1. Importar el repositorio; el framework se detecta solo (`vercel.json` ya fija build y salida).
2. En monday: Developer Center → **Create app** → agregar una feature de tipo **Board View** y
   apuntarla a la URL del deploy. De esa pantalla salen el signing secret y el client secret.
3. Cargar en Vercel las variables de la tabla de arriba, y **borrar `VITE_MONDAY_TOKEN` si está**.
4. Redeployar: las variables se leen en el build, así que un deploy anterior no las toma.
5. Instalar la app en el workspace de BERGER y agregar la vista al tablero.

Hasta que no estén el signing secret y el client secret, la función `/api/monday` contesta
`500 · Falta MONDAY_SIGNING_SECRET` y la app no muestra datos. Es a propósito: sin con qué
verificar la firma, no hay forma de saber quién está pidiendo, y fallar cerrado es lo correcto.
