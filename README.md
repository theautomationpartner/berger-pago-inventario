# BERGER S.A. · Pago de Inventario de Tractores

Aplicación de **vista de tablero** (board view) de monday.com para el circuito de pago del
inventario de tractores de BERGER S.A. Se instala en el workspace como un tablero más y se usa
tanto desde la computadora como desde la app de monday del celular.

React 18 + TypeScript sobre Vite. Los datos son en vivo: la app lee y escribe directo en los
tableros reales de la cuenta.

---

## Las tres operaciones

Las tres están implementadas y forman una cadena: cada una toma los pagos que dejó la anterior.

| # | Operación | Trabaja sobre | Deja el pago en |
|---|-----------|---------------|-----------------|
| 1 | **Cargar Transferencia** | Tractores del Inventario en `Listo para Pagar` del mes | `CARGADO` · `Pend de Aprobar Transf` |
| 2 | **Aprobar Transferencia** | Pagos en `Pend de Aprobar Transf` | `APROBADO` · `Pend de Confirmar Transf` |
| 3 | **Confirmar Pago** | Pagos en `Pend de Confirmar Transf` **y** `APROBADO` | `CONFIRMADO` · `Pagado` |

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

### Operación 1 — Cargar Transferencia

**Paso 1 · Selección.** La app trae del tablero de **Inventario** los tractores que cumplen las
dos condiciones a la vez:

- `Estado Pago` = **Listo para Pagar**
- el **mes y el año** de `Fecha Prod` coinciden con el mes de la operación (por defecto, el mes en
  curso; se puede cambiar desde el selector).

Cada fila muestra el nombre del item, el **N° Interno** al costado, la forma de pago, la fecha de
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

### Operaciones 2 y 3 — avanzar un pago

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

El navegador no puede pegarle directo a `api.monday.com` (CORS), así que Vite hace de proxy en dos
rutas: `/monday-api` → `/v2` (GraphQL) y `/monday-file` → `/v2/file` (subida de archivos).

---

## Acceso: sólo el monday de BERGER

La URL del deploy es pública y la app se puede instalar en cualquier cuenta de monday, así que el
permiso **no** depende de dónde esté instalada. Lo decide el `sessionToken` que monday le entrega
a la app: un JWT firmado con el secreto de la aplicación, que dice de qué cuenta viene el usuario.

- **En el cliente** (`src/hooks/useAccesoMonday.ts`): la verificación corre ANTES de dibujar nada.
  Si monday no responde —porque no hay iframe padre, o sea, alguien abrió la URL suelta— o si la
  cuenta no es la de BERGER (`36618349`), lo único que existe en pantalla es el cartel de acceso
  denegado. Ni barra de marca, ni operaciones, ni una sola consulta al tablero.
- **En el servidor** (`api/_guard.ts`): la misma comprobación, y ésta es la barrera de verdad. El
  proxy verifica la firma HMAC del token y que la cuenta coincida antes de hablar con Monday. Sin
  eso, cualquiera podría pedirle datos salteándose la interfaz.

Esconder la pantalla es cortesía; la barrera es la del servidor. Están las dos porque resuelven
cosas distintas: una evita mostrar el circuito interno de la empresa a quien pasa por la URL, la
otra evita que se lleve los datos.

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

Variables de entorno del deploy:

| Variable | ¿Obligatoria? | Para qué |
|----------|---------------|----------|
| `MONDAY_TOKEN` | Sí | Token de la API. **Sin** prefijo `VITE_`. |
| `MONDAY_SIGNING_SECRET` | Sí (o la de abajo) | Signing secret de la app. Developer Center → tu app → Basic Information. |
| `MONDAY_CLIENT_SECRET` | Sí (o la de arriba) | Client secret de la misma pantalla. Se prueban las dos: cuál valida depende de cómo se creó la app. |
| `MONDAY_ACCOUNT_ID` | No | Cuenta habilitada. Por defecto, la de BERGER S.A. (`36618349`). |

> Si el token de la API se filtró alguna vez (mail, chat, captura, un bundle publicado), hay que
> **revocarlo y generar uno nuevo** desde monday: developers → My access tokens.

---

## Estructura

```
api/                        Funciones serverless del deploy (Vercel, runtime edge)
  _guard.ts                 Verificación del sessionToken de monday
  monday.ts                 Proxy GraphQL con el token del lado servidor
  monday-file.ts            Proxy de subida de archivos (multipart)
public/
  logo-berger.svg           Logo de la barra superior — reemplazable sin recompilar
src/
  App.tsx                   Marca + selector de operación
  types.ts                  Estructuras de datos de la app
  components/ui/            Piezas reutilizables (marca, stepper, selector, zona de archivo)
  features/pago/            Los tres flujos de operación
    CargarTransferencia.tsx   Operación 1 (asistente de dos pasos)
    FlujoAvancePago.tsx       Operaciones 2 y 3 (mismo flujo, distinta configuración)
    DetallePago.tsx           Ficha de un pago con sus tractores
  lib/                      Formato de números y fechas, catálogo de operaciones
    flujos.ts                 Las operaciones 2 y 3 descriptas como datos
  services/monday/          Todo lo que habla con monday
    columns.ts              IDs de tableros y columnas (única fuente de verdad)
    sdk.ts                  Cliente HTTP + subida de archivos
    parse.ts                Lectura de column_values
    inventario.ts           Consulta de tractores listos para pagar
    pagos.ts                Consulta de pagos pendientes con sus subitems
    crearPago.ts            Operación 1: pago, subitems y estados
    avanzarPago.ts          Operaciones 2 y 3: comprobante, estados, fechas y aviso
  styles/                   base · layout · components · pago
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
