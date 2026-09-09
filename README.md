# BERGER S.A. · Pago de Inventario de Tractores

Aplicación de **vista de tablero** (board view) de monday.com para el circuito de pago del
inventario de tractores de BERGER S.A. Se instala en el workspace como un tablero más.

React 18 + TypeScript sobre Vite. Los datos son en vivo: la app lee y escribe directo en los
tableros reales de la cuenta.

---

## Las tres operaciones

| # | Operación | Estado | Qué hace |
|---|-----------|--------|----------|
| 1 | **Cargar Transferencia** | ✅ Implementada | Elegir los tractores listos para pagar del mes, adjuntar la transferencia en PDF y registrar el pago. |
| 2 | **Aprobar Transferencia** | ⏳ En desarrollo | Revisar las transferencias en `CARGADO` y dejarlas en `APROBADO` / `Transf Aprobada`. |
| 3 | **Confirmar Pago** | ⏳ En desarrollo | Cerrar el circuito con el comprobante del banco y pasar los tractores a `Pagado`. |

### Operación 1 — Cargar Transferencia, paso a paso

**Paso 1 · Selección.** La app trae del tablero de **Inventario** los tractores que cumplen las
dos condiciones a la vez:

- `Estado Pago` = **Listo para Pagar**
- el **mes y el año** de `Fecha Prod` coinciden con el mes de la operación (por defecto, el mes en
  curso; se puede cambiar desde el selector).

Cada fila muestra el nombre del item, el **N° Interno** al costado, la forma de pago, la fecha de
producción y el valor neto. Al marcarlos se arma abajo una lista desplegable con el detalle
completo de cada uno —costo de flete, precio unitario, valor neto, forma de pago, N° de draft,
código de producto y fecha— y el **total del valor neto** de la selección.

**Paso 2 · Transferencia.** Recuadro para adjuntar el PDF (arrastrando o desde el explorador),
monto —propuesto con el total, editable— y fecha de emisión.

**Impacto en monday** al apretar *Cargar Pago*:

En **Pagos del Inventario** (`18430295445`), un item nuevo:

| Dato | Columna |
|------|---------|
| PDF de la transferencia | `file_mm71eqv5` |
| Monto transferencia | `numeric_mm714xb2` |
| Fecha emisión transf. | `date_mm71jrsz` |
| Estado Pago = `CARGADO` | `color_mm71p4rf` |

En sus **subitems** (`18430295515`), uno por tractor:

| Dato | Columna | Origen en Inventario |
|------|---------|----------------------|
| Nombre del tractor | `name` | `name` |
| Valor Neto | `numeric_mm71c5je` | `lookup_mm6vj4cp` |
| N° de Draft | `text_mm71atj2` | `text_mm6ne4br` |
| Cod. de Producto | `text_mm71zgys` | `lookup_mm6z4hd1` |
| Conexión al tractor | `board_relation_mm718zjg` | item del Inventario |

Y en **Inventario** (`18428578101`), cada tractor pasa a `Estado Pago` = **Transf Cargada**
(`color_mm6v6532`).

---

## Correr en local

```bash
npm install
cp .env.example .env.local     # completar VITE_MONDAY_TOKEN
npm run dev                    # http://localhost:5182
```

| Script | Qué hace |
|--------|----------|
| `npm run dev` | Servidor de desarrollo de Vite con `--host` (accesible desde la red). |
| `npm run build` | Build de producción en `dist/`. |
| `npm run preview` | Sirve el build ya compilado. |
| `npm run typecheck` | `tsc --noEmit` sobre `src/` y `api/`. |

El navegador no puede pegarle directo a `api.monday.com` (CORS), así que Vite hace de proxy en dos
rutas: `/monday-api` → `/v2` (GraphQL) y `/monday-file` → `/v2/file` (subida de archivos).

---

## Seguridad del token

**El token nunca entra al repositorio ni al bundle que descarga el navegador.**

- `.env.local` está en `.gitignore` (la regla es `.env.*` con excepción de `.env.example`). Es el
  único lugar del disco donde vive el token en desarrollo.
- En **producción** el token NO se expone con `VITE_`: va como `MONDAY_TOKEN` en las variables de
  entorno de Vercel y sólo lo leen las funciones serverless de `api/`, del lado del servidor.
- Esas funciones exigen un `sessionToken` firmado por monday antes de consultar nada
  (`api/_guard.ts`): verifican la firma HMAC con el secreto de la app y que la cuenta sea la de
  BERGER. Abrir la URL del deploy en un navegador suelto no devuelve datos.

Variables de entorno del deploy:

| Variable | Para qué |
|----------|----------|
| `MONDAY_TOKEN` | Token de la API. **Sin** prefijo `VITE_`. |
| `MONDAY_SIGNING_SECRET` | Signing secret de la app (Developer Center → Basic Information). |
| `MONDAY_CLIENT_SECRET` | Client secret de la misma pantalla. Se prueban los dos. |
| `MONDAY_ACCOUNT_ID` | Cuenta habilitada. BERGER S.A. = `36618349`. |

> Si el token de la API se filtró alguna vez (mail, chat, captura), hay que **revocarlo y generar
> uno nuevo** desde monday: developers → My access tokens.

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
  features/pago/            Flujo de "Cargar Transferencia"
  lib/                      Formato de números y fechas, catálogo de operaciones
  services/monday/          Todo lo que habla con monday
    columns.ts              IDs de tableros y columnas (única fuente de verdad)
    sdk.ts                  Cliente HTTP + subida de archivos
    parse.ts                Lectura de column_values
    inventario.ts           Consulta de tractores listos para pagar
    crearPago.ts            Escritura del pago, subitems y estados
  styles/                   base · layout · components · pago
```

### El logo

`public/logo-berger.svg` es un **marcador reconstruido**, no el archivo original de la marca. Para
poner el oficial alcanza con dejar el archivo en `public/` y apuntar el `src` de
`src/components/ui/BarraMarca.tsx` al nombre nuevo. No hace falta tocar nada más.

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

---

## Deploy en Vercel

1. Importar el repositorio; el framework se detecta solo (`vercel.json` ya fija build y salida).
2. Cargar las cuatro variables de entorno de la tabla de arriba.
3. En el Developer Center de monday, apuntar la board view a la URL del deploy.
