# BERGER S.A. · Importación Berger S.A.

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
Operaciones              →  Operación                →  Paso
────────────────────────────────────────────────────────────────────────
PLANIFICACIÓN DE DRAFTS  →  PLANIFICAR PERÍODO       →  1. Selección de drafts
                                                        2. Períodos
                         →  ENVIAR PLANIFICACIÓN     →  1. Selección · 2. Confirmación
                         →  DASHBOARD DE DRAFTS      →  pantalla única

FECHAS DE PRODUCCIÓN     →  CONFIRMAR / PROPONER      →  1. Selección de tractores
  INVENTARIO                                             2. Confirmar o proponer
                         →  ENVIAR CONFIRMACIÓN      →  1. Confirmación · 2. Revisión

PAGOS DESPACHO           →  PAGO ANTICIPADO          →  1. Cargar Transferencia
                                                        2. Aprobar Transferencia
                                                        3. Confirmar Pago - SWIFT
                         →  PAGO VISTA (Contra BL)   →  1. Selección · 2. Despachante

DESPACHO DE ADUANA       →  ACTUALIZAR DESPACHO OP   →  1. Selección de OP
                            - DESPACHANTE               2. Qué hacer
                                                        3a. Actualización + resumen
                                                        3b. Armar contenedores
                         →  ACTUALIZAR OP - BERGER   →  1. OP próximas a arribar
                                                        2. Pago y entrega
                         →  ACTUALIZAR CONTENEDORES  →  pantalla única
                            - BERGER
                         →  DASHBOARD DE DESPACHOS   →  pantalla única
```

Las cuatro operaciones principales siguen el recorrido real de un tractor, y en ese orden: **se
planifica** el pedido con el proveedor, **se acuerda la fecha** de producción, **se paga y se
despacha**, y **se nacionaliza**.

**Cada persona ve sólo lo suyo.** Las dos operaciones principales pertenecen a módulos distintos, y
el primer panel muestra únicamente los que el servidor le habilitó a ese perfil: la gente que
despacha ve DESPACHO, el despachante de aduana ve DESPACHANTE DE ADUANA, y Administración ve las
dos. El detalle está en [Quién ve qué](#quién-ve-qué).

Las opciones de los paneles están descriptas como datos en
[`src/lib/navegacion.ts`](src/lib/navegacion.ts).

### Qué tractores se pueden despachar

En **las dos modalidades**, un tractor sólo aparece si su Fecha de Producción está **confirmada**:
`Estado Confirmación Fecha Producción` (`color_mm6s8xp2`) en **Fecha Confirmada**. Los que están
en *Fecha Pend Confirmar* no se muestran, porque armar un despacho sobre una fecha que todavía
puede cambiar es prometer algo que no está.

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

## PLANIFICACIÓN DE DRAFTS

Lo que pasa **antes** de que el tractor exista. Un *draft* es el pedido al proveedor: llega como
PDF, una automatización lo lee y carga el item en 🧾**Drafts** (`18428667614`) con un subitem por
producto. A partir de ahí, BERGER decide **para cuándo** le pide al proveedor que lo fabrique, y se
lo comunica.

### El circuito

| Estado `color_mm6zdmzr` | Qué significa | Quién lo mueve |
|---|---|---|
| `Pend de Planificar` | el PDF ya se leyó, falta decidir el período | **Planificar Período** |
| `Periodo Prod Planificada` | tiene período sugerido, falta mandarlo | **Enviar Planificación** |
| `Pend de Confirmar` | se mandó, se espera la respuesta del proveedor | el proveedor |
| `Confirmado en ORDEN de Confirmacion` | el proveedor confirmó | otro circuito |
| `Cancelado` | no se fabrica | — |

### Lo que se ve de cada draft

Todo lo que trajo el PDF, como etiquetas de color: fecha del draft (`date4`), N° de orden de pedido
(`text_mm6sv3rq`), condición de entrega (`dropdown_mm6tve05`), transporte (`dropdown_mm6tk49e`),
forma de pago (`dropdown_mm6t6geg`) y divisa (`color_mm6nbfey`). Más dos importes: el **costo de
transporte** y el **Total del draft** (`numeric_mm6n2m2y`), siempre con su divisa al lado.

**Cuál de los dos costos de transporte** depende de la condición de entrega: si dice FOB va
`numeric_mm6scnmk`, si dice FCA va `numeric_mm72rv29`. Se busca la palabra **dentro** del texto y
no se compara la etiqueta entera, porque el tablero también tiene "FOB PUERTO EN INDIA" y
"FCA LAUINGEN": comparando entera, esos dos —que son la mayoría— se quedarían sin costo. El rótulo
dice cuál se está mostrando, así que nunca hay que adivinar.

Cada draft se despliega y muestra sus **productos**: nombre, tipo de rodado (`dropdown_mm70988f`),
cantidad, precio unitario, el costo de transporte del producto —FOB `numeric_mm6schww` o FCA
`numeric_mm72y3dz`, con el mismo criterio—, valor neto y subtotal.

> **Dos ids del pedido original no coincidían con el tablero** y se usaron los que corresponden:
> `numeric_mm77ygs7` no es el costo FCA sino el *Total del draft sin transporte*, y el costo FCA
> total es `numeric_mm72rv29`. A nivel producto, el costo FCA es `numeric_mm72y3dz`.

### PLANIFICAR PERÍODO DE PRODUCCIÓN

**Paso 1 · Selección.** Los drafts en `Pend de Planificar` **que todavía no tienen período**. Uno
que ya lo tiene no aparece: volver a asignárselo sería pisar una planificación hecha. Se busca por
número de draft, que es el nombre del item, y también por ID de monday o N° de orden de pedido.

**Paso 2 · Períodos.** Un período por draft, de la lista de la columna `dropdown_mm70awrf`
(Enero 2026 → Diciembre 2035). Como lo más común es que varios vayan al mismo mes, hay un selector
que **los asigna todos de una vez** y después se corrigen los que difieran.

El selector **no es un `<select>` nativo**: son 120 opciones, y bajar por esa lista para llegar a un
mes que ya se sabe cuál es —peor todavía con la rueda del sistema en el celular— es más trabajo que
escribirlo. Se escribe y la lista se achica: la búsqueda ignora tildes y mayúsculas y sirve para el
mes (`marzo` deja los diez marzos), para el año (`2027` deja sus doce meses) o para los dos
(`marzo 27` deja uno solo, aunque el año esté a medias). Sin búsqueda, la lista va agrupada por año
con el encabezado fijo arriba. Se recorre también con las flechas y se elige con Enter. El control
queda **pintado en verde cuando ya tiene período**, así se ve de un vistazo qué draft falta.

Un draft seleccionado **sin período** frena la carga y se ofrece quitarlo con un clic: guardarlo
igual lo dejaría en `Periodo Prod Planificada` sin nada que planificar, que es justo lo que la
operación siguiente no sabría mandar.

Al confirmar, cada draft recibe su período **y** pasa a `Periodo Prod Planificada` en la misma
escritura: son dos lecturas del mismo hecho, y separarlas abre una ventana en la que el draft
figura planificado sin período.

### ENVIAR PLANIFICACIÓN

**Paso 1 · Selección.** Los drafts en `Periodo Prod Planificada` **y con período cargado**. Los dos
requisitos, no uno: si alguien le borró el período en el tablero, no hay nada que sugerir.

**Paso 2 · Confirmación.** Antes de crear nada se ve, **agrupado por período**, exactamente qué se
le va a decir al proveedor: cuántos drafts y cuántas unidades van a cada mes, y cuáles. Se avisa
que sale un **mail a DEUTZ con los PDF y los períodos sugeridos**. Este paso existe porque de acá
sale un mail a un tercero, y es lo último que se puede revisar sin tener que salir a pedir
disculpas.

Al confirmar se crea en 📬**Confirmación y Planificación** (`18428677294`) un item:

| Dato | Columna |
|------|---------|
| Nombre `Planificación DD/MM/AAAA` | `name` |
| Tipo = `🤚PLANIFICACION` | `color_mm737v3t` |
| Fecha de emisión | `date4` |
| Drafts seleccionados | `board_relation_mm70ss7g` |
| Estado de envío = `Enviar` | `color_mm73xw6w` |

El estado de envío va **último**, cuando el item ya quedó completo con sus drafts conectados: de esa
columna sale el mail, y dispararlo antes sería mandar una planificación a medio armar. Si esa
última escritura falla, el item ya está bien creado y se avisa para mandarlo desde el tablero.

### DASHBOARD DE DRAFTS

Responde tres preguntas, en este orden:

1. **¿Cómo viene el circuito?** Una tarjeta por estado, del color que ese estado tiene en el resto
   de la app.
2. **¿Qué tengo que hacer yo?** Cuántos esperan período, cuántos están listos para enviar, cuántas
   unidades hay sin planificar, y —aparte, en rojo— los que quedaron **trabados porque el PDF no se
   leyó bien**: ésos no son trabajo del planificador, pero no aparecen en ninguna lista hasta que se
   resuelvan, así que el dashboard es el único lugar donde se enteraría.
3. **¿Qué le estamos pidiendo al proveedor?** El reparto por **período sugerido** —la carga de
   fábrica que BERGER está proponiendo: diez drafts amontonados en un mismo mes es la señal de que
   hay que repartirlos antes de mandar la planificación—, por forma de pago y por condición de
   entrega, cada uno con drafts, unidades e importe.

Los importes se muestran **por divisa** y nunca sumados entre sí: sumar euros con dólares daría un
número que no existe. Si un corte mezcla divisas, se informa la cantidad y se calla el importe.

Las cuentas están en [`src/lib/drafts.ts`](src/lib/drafts.ts) y se prueban solas.

---

## FECHAS DE PRODUCCIÓN INVENTARIO

Entre el draft y el despacho hay una negociación: el proveedor informa **cuándo** va a fabricar cada
tractor, y BERGER acepta esa fecha o le propone otra. De ese ida y vuelta sale la única fecha que
después habilita a despachar —los dos módulos de despacho sólo muestran tractores con la fecha
confirmada—, así que es el módulo que abre la puerta a todo lo demás.

Dos columnas del Inventario cuentan la historia:

| Columna | Qué dice |
|---|---|
| 🤖Estado Confirmación Fecha Producción `color_mm6s8xp2` | `Fecha Pend Confirmar` (espera a BERGER) · `Fecha a Confirmar` (espera al proveedor) · `Fecha Confirmada` |
| 🤖Estado Fecha Producción `color_mm6sc76v` | `Aceptada` · `Nueva Fecha Propuesta` |

### CONFIRMAR / PROPONER FECHA PRODUCCIÓN

**Paso 1 · Selección.** Los tractores en `Fecha Pend Confirmar` **que tienen fecha de producción
cargada** (`date_mm6nymx`). Sin fecha no aparecen: no hay nada que aceptar ni contra qué comparar
una propuesta. Cada fila lleva sus etiquetas —modelo, N° interno, Primary Status y su traducción,
tipo de rodado y precio unitario FOB— y la **fecha bien grande a la derecha**, porque es lo que se
está decidiendo, no un dato más.

**Paso 2 · Confirmar o proponer.** Para cada tractor, dos tarjetas grandes y excluyentes:

- **Confirmar fecha de producción** → `color_mm6s8xp2` = `Fecha Confirmada` y `color_mm6sc76v` =
  `Aceptada`.
- **Proponer otra fecha** → se escribe en 🤚Fecha Prod Propuesta (`date_mm6n11kn`), `color_mm6s8xp2`
  pasa a `Fecha a Confirmar` y `color_mm6sc76v` a `Nueva Fecha Propuesta`.

Son dos botones y no un desplegable a propósito: la diferencia entre aceptar la fecha del proveedor
y devolverle otra **es** la decisión, y tiene que verse de un vistazo cuál quedó elegida. La elegida
se pinta entera —verde para confirmar, ámbar para proponer— y la otra queda en blanco.

Las tres columnas se escriben en **una sola** operación por tractor: son una sola decisión, y
separarlas dejaría al tractor con un estado que no se corresponde con su fecha.

> **Sin confirmación conectada no se puede decidir.** Un tractor sin nada en 🤖Confirmación de Fecha
> de Producción (`board_relation_mm6z1cn9`) se marca en rojo y bloquea el guardado hasta sacarlo de
> la selección, con el motivo completo: *no se detectó ninguna confirmación enviada por DEUTZ para
> ese producto; revisá el tablero 📬Confirmación y Planificación y la casilla de correo*. Confirmar
> sin eso sería dar por buena una fecha que no se sabe de dónde salió, y proponer sería responderle
> a un mail que nadie recibió.

### ENVIAR CONFIRMACIÓN

Del otro lado del mismo tablero están las **CONFIRMACIONES** (`color_mm737v3t` = `🤖CONFIRMACION`):
las que manda DEUTZ. Cada una trae conectados sus tractores del Inventario
(`board_relation_mm6zhvba`).

**Paso 1 · Selección.** Cada confirmación se lista con cuántas fechas se van a confirmar y cuántas a
proponer, ya contadas, y con el estado de su envío.

**Las que ya salieron no se listan.** Una confirmación con 🤖Estado Propuesta (`color_mm6ss2d2`) en
**Enviado** está terminada: ofrecerla otra vez sólo habilita a mandarla dos veces. Las demás sí
aparecen —`Enviar`, `Enviando`, `Detenido` o sin estado— porque todas son situaciones que pueden
terminar de resolverse desde acá; cuando el envío ya está en marcha, la pantalla lo dice.

**Paso 2 · Revisión.** El detalle tractor por tractor, con **la fecha del proveedor y la propuesta,
una al lado de la otra**, y qué le va a pasar a cada uno:

- **Se confirma** el que no tiene fecha propuesta —y también el que tiene una propuesta **igual** a
  la del proveedor: proponer la misma fecha es aceptarla, aunque el tablero la haya guardado como
  propuesta—.
- **Se propone** el que tiene una fecha propuesta distinta.

Mandarla exige **tres cosas**, y ninguna la puede dar por cumplida la app sola:

1. 🤖Estado Act Inventario (`color_mm6v8tv3`) en **Actualizado**.
2. 🤖Creacion Google Sheet (`color_mm6zx241`) en **Creado**.
3. Que alguien tilde que **revisó la planilla**.

Recién ahí se deja 🤖Estado Propuesta (`color_mm6ss2d2`) en **Enviar**, que es lo que dispara el
correo.

**La planilla se ve dentro de la app.** El link de 🤖G Drive Link se convierte a la URL `/preview`
de Google, que es la única que se puede incrustar: la de `/edit` la bloquea Google con
`X-Frame-Options`. Si aun así el recuadro aparece vacío —pasa cuando Google pide iniciar sesión
dentro del iframe— la pantalla lo dice y queda el botón para abrirla aparte. El tilde de revisado es
obligatorio en los dos casos, porque de acá sale un correo con fechas que después se cumplen.

---

## PAGO ANTICIPADO

El tractor se paga antes de despacharse. Son tres etapas que forman una cadena: cada una toma los
pagos que dejó la anterior.

| # | Etapa | Trabaja sobre | Deja el pago en |
|---|-------|---------------|-----------------|
| 1 | **Cargar Transferencia** | Tractores en `Listo para Pagar` **o** en `Pendiente de Pago`, con fecha confirmada | `CARGADO` · `Pend de Aprobar Transf` |
| 2 | **Aprobar Transferencia** | Pagos en `Pend de Aprobar Transf` | `APROBADO` · `Pend de Confirmar Transf` |
| 3 | **Confirmar Pago - SWIFT** | Pagos en `Pend de Confirmar Transf` **y** `APROBADO` | `CONFIRMADO` · `Pagado` |

Las etapas 1 y 2 son de dos pasos; la 3 tiene **tres**, porque es la que cierra el despacho: pago →
comprobante → **despachante**.

### El circuito, columna por columna

Tablero de **Pagos del Inventario** (`18430295445`):

| Columna | Op 1 | Op 2 | Op 3 |
|---------|------|------|------|
| Estado Pago `color_mm71p4rf` | `CARGADO` | `APROBADO` | `CONFIRMADO` |
| Operación Pend `color_mm71e2wc` | `Pend de Aprobar Transf` | `Pend de Confirmar Transf` | `Pagado` |
| Fecha de la etapa | `date_mm71zare` | `date_mm71xrq5` | `date_mm71q4qa` |
| Comprobante adjunto | `file_mm71eqv5` transferencia | `file_mm71s567` transf. c/número | `file_mm713dbc` comprobante del banco |
| Aviso por mail | — | `color_mm71tfkp` = `Enviar` | `color_mm71bk6h` = `Enviar` |

Además, todo pago lleva su **Tipo de Pago** (`color_mm78170z`): `ANTICIPADO` o `VISTA`.

El **aviso al despachante** (`color_mm78m8pn`) no está en esa tabla porque no es de una etapa
intermedia: en ANTICIPADO pasa a `Enviar` recién en la **etapa 3**, junto con el aviso al proveedor.
Hasta que el pago no está confirmado la transferencia todavía puede caerse, y avisarle antes al
despachante sería mandarlo a trabajar sobre un despacho que puede no ocurrir.

Y en paralelo, cada tractor del pago avanza en **Inventario** (`color_mm6v6532`):
`Listo para Pagar` → `Transf Cargada` → `Transf Aprobada` → `Pagado`.

### Etapa 1 — Cargar Transferencia

**Paso 1 · Selección.** La app trae del **Inventario** dos poblaciones, y la pantalla obliga a
elegir **una sola** por transferencia:

- **Listo para Pagar** — el anticipado de siempre: se paga antes de despachar.
- **Pendiente de Pago** — tractores que ya se despacharon a la vista y quedaron por cobrar contra el
  BL. Recorren las mismas tres etapas, pero **no vuelven a generar despacho de aduana**.

Los dos grupos no se pueden mezclar en un mismo pago: uno genera una OP en el Despachante y el otro
ya la tiene, así que un pago mezclado dejaría a la mitad de los tractores sin OP o a la otra con una
duplicada. Cambiar de grupo descarta lo que hubiera elegido.

Un pago del grupo **Pendiente de Pago** se llama `PAGO VISTA (Contra BL) - <fecha>` y lleva
`color_mm78170z` = `VISTA`: es lo que después hace que la etapa 3 **no** vuelva a crear el despacho
ni pida elegir despachante. De esa etapa sólo salen los avisos por mail.

Dentro del grupo elegido se ven **todos** los tractores, sin importar el mes.

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

Al apretar *Cargar Pago* se crea el item en **Pagos del Inventario**, llamado
`PAGO ANTICIPADO - <fecha de emisión>`, con las columnas de la tabla de arriba, el monto
(`numeric_mm714xb2`), la fecha de emisión (`date_mm71jrsz`), el tipo de pago (`color_mm78170z` =
`ANTICIPADO`) y el reporte de contenedores (`long_text_mm77ydg9`) —que se calcula **acá**, en el
primer paso, y no se vuelve a tocar—; y sus **subitems** (`18430295515`), uno por tractor:

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

## PAGO VISTA (Contra BL)

El pedido se hace **sin pago previo**, en dos pasos.

**Paso 1 · Selección.** Se eligen del Inventario los tractores con `Forma de Pago`
(`dropdown_mm6v2sa0`) en **VISTA**, la fecha de producción confirmada y el `Estado Pago` en **Listo
para Pagar** o **A Pagar Prox Mes**, con el mismo detalle que en anticipado y el total del valor
neto. Tiene el **mismo filtro por mes de producción** que la etapa 1 del anticipado, con el aviso de
cuántos tractores sin fecha quedan afuera.

Los que ya están en **Pendiente de Pago** no aparecen: ésos ya se despacharon a la vista y lo que les
falta es el pago, que se hace desde el circuito anticipado. Ofrecerlos acá sería despacharlos dos
veces.

**Paso 2 · Despachante.** A quién se le manda el despacho y qué se le manda.

A diferencia de anticipado, cada fila muestra además el **Estado Pago** del tractor: en la vista no
hay un estado que filtre la lista, así que ver en cuál está cada uno es parte de decidir si se pide.

Al registrar el pedido se crea en **Pagos del Inventario** un item llamado
`PAGO VISTA - <fecha>` con:

| Dato | Columna |
|------|---------|
| Tipo de Pago = `VISTA` | `color_mm78170z` |
| Fecha de emisión del pedido | `date_mm77cwrs` |
| Monto pendiente (total del valor neto) | `numeric_mm78d1ng` |
| Operación = `Pendiente de Pago` | `color_mm71e2wc` |
| Reporte de contenedores | `long_text_mm77ydg9` |
| Un subitem por tractor, conectado a su item del Inventario | `18430295515` |

Y cada tractor pasa a **Pendiente de Pago** (`color_mm6v6532`) en el Inventario.

El monto va a **Monto Pendiente VISTA** y no a la columna del monto transferido: en la vista todavía
no se pagó nada, y es justamente lo que queda por cobrar contra el BL.

Como el pedido se cierra en esta única operación, acá mismo se crea el **despacho en el Despachante
de aduana** y se deja el aviso al despachante (`color_mm78m8pn`) en `Enviar`.

> **Pendiente:** el envío del pedido por mail al proveedor todavía no está implementado. El reporte
> de contenedores ya queda guardado, que es lo que ese mail va a llevar.

La selección, la carga de tractores y los resúmenes son los mismos componentes que usa anticipado
([`src/features/tractores/`](src/features/tractores/)).

---

## Contenedores

Mientras se eligen tractores —en el paso 1 de PAGO ANTICIPADO y en PAGO VISTA— la app va armando
los contenedores y lo muestra abajo, en vivo. La idea es enterarse **mientras se elige**, no
después: ver que un contenedor viaja por la mitad cuando ya se registró el pago es tarde.

El tablero **Contenedores** (`18430565324`) dice qué puede viajar junto. Cada fila es una
**combinación**:

| Columna | Qué dice |
|---------|----------|
| 🚜 Catálogo de Productos `board_relation_mm77crvy` | Qué modelos entran combinados entre sí |
| Contenedor `status` | `40 H`, `20 H`, `20 H + 40 H`, `40 H + 40 H`, `CUALQUIER CONTENEDOR` |
| Cantidad De Tractor `numeric_mm77r45y` | Cuántos tractores entran **en total** en esa combinación |
| Ruedas `color_mm77eeke` | `Con Ruedas`, `Sin Ruedas` o `Con y Sin Ruedas` |

El **+** de la etiqueta no es decorativo: `20 H + 40 H` son **dos** contenedores físicos para esa
cantidad de tractores. `CUALQUIER CONTENEDOR` cuenta como uno.

Un mismo grupo de modelos suele tener varias filas. Los 6205/6175/6155, por ejemplo: uno solo en un
`40 H` con ruedas, dos en un `20 H + 40 H` con ruedas, o dos sin ruedas en un `40 H`.

### Cómo se arman

1. Cada tractor llega al catálogo por su conexión (`board_relation_mm6sxre2`) y de ahí a las
   combinaciones que lo aceptan, **con su rodado**: el Inventario dice "Con Rodado" y Contenedores
   dice "Con Ruedas", que son lo mismo con distinta palabra; "Con y Sin Ruedas" sirve para los dos.
2. Los tractores que comparten las mismas combinaciones se agrupan: por eso dos modelos distintos
   viajan juntos cuando el tablero los conectó a la misma fila.
3. Para cada grupo se elige la combinación **más chica que alcance** para lo que queda —así cinco
   tractores no viajan en un contenedor de seis si hay uno de cinco—. Si ninguna alcanza, se usa la
   que mejor aprovecha cada contenedor y se sigue con el resto.

En pantalla queda cada contenedor con lo que lleva, en **verde** si está completo y en **ámbar** si
sobra lugar, y —cuando sobra— la sugerencia de qué otro tractor de la lista podría completarlo. Los
que no entran en ninguna combinación se informan aparte con el motivo: el modelo no figura en el
tablero, no hay fila para ese rodado, falta el dato de rodado, o el tractor no está conectado al
catálogo.

Lo mismo, en texto, queda guardado en el pago en **Contenedores Armados por APP**
(`long_text_mm77ydg9`). Ese texto tiene **dos destinatarios y por eso dos secciones**:

- **`Informacion para Berger:`** — el detalle para decidir: el total, qué lleva cada contenedor,
  dónde sobró lugar, con qué se podría completar y qué tractores quedaron sin ubicar y por qué.
- **`Informacion para Despachante:`** — lo mínimo para operar, en cuatro líneas:

```
* Cantidad de contenedores: 3
* Contenedores por tipo: 1 x 20 H, 2 x 40 H
* Cantidad de tractores: 5
* Origen: Puerto 1: Alemania (Bremerhaven) ó Puerto 2: Alemania (Hamburgo)
```

El total va **solo, en su propia línea**: además de leerse de un vistazo, es el número que la etapa
3 vuelve a leer de este texto para cargarlo en el tablero del Despachante. El desglose cuenta
contenedores **físicos** (`20 H + 40 H` son dos, no uno).

El **origen** sale del puerto de carga del Catálogo de Productos (`dropdown_mm78jn1v`), que es un
dato del modelo, no del tractor. Si el modelo tiene más de un puerto se numeran —son alternativas
entre las que todavía hay que elegir, y esa elección no la hace la app—. El **destino** no va en el
reporte: se escribe a mano en el cuerpo del mail.

> Un tractor cuyo modelo no tenga puerto cargado deja el origen en
> `(sin puerto cargado en el Catálogo)`, en vez de que la línea desaparezca sin dejar rastro.

La cuenta está aparte de la pantalla y de monday, en
[`src/lib/contenedores.ts`](src/lib/contenedores.ts), y se prueba sola.

---

## Despachante de aduana

Cuando un despacho queda cerrado, la app crea un item en **👮Despachante de aduana**
(`18430575903`) con lo que el despachante necesita para empezar a trabajar. Ocurre en un momento
distinto según la modalidad, y por el mismo motivo en los dos casos: cuando ya no puede volverse
atrás.

| Modalidad | Cuándo se crea |
|-----------|----------------|
| PAGO ANTICIPADO | En la etapa 3, al confirmar el SWIFT |
| PAGO VISTA | Al registrar el pedido |

### Elegir el despachante

Antes de confirmar, las dos modalidades tienen un paso —el **3** en la etapa 3 de anticipado, el
**2** en vista— donde se elige a quién se le manda y se ve **exactamente el texto** que va a
recibir: la sección `Informacion para Despachante:` del reporte, ni un resumen aparte ni una
versión parecida. Mantener dos redacciones terminaría, el día que se separen, en aprobar en
pantalla algo distinto de lo que sale.

Los candidatos salen del equipo **Despachantes** de monday
([`/teams/1504184`](https://maquinariasagricolas.monday.com/teams/1504184)), no de una lista en el
código: sumar un despachante es agregarlo al equipo, sin tocar ni desplegar nada. Los usuarios
desactivados se dejan afuera —asignarle un despacho a alguien que ya no entra a monday es mandarlo
a un buzón que nadie abre—. Elegir es obligatorio: sin despachante el botón de confirmar no se
habilita.

El elegido queda en la columna de persona (`person`) del item, que admite **una sola**.

**Si el equipo está vacío**, no se muestra ninguna lista para elegir —no hay a quién— y el despacho
se crea igual, con la persona **sin asignar** y un aviso que lo dice. Bloquear la operación ahí
dejaría el circuito trabado por un equipo de monday que la app no administra. La obligación de
elegir aparece sólo cuando hay alguien en el equipo.

| Dato | Columna | De dónde sale |
|------|---------|----------------|
| Conexión al pago | `board_relation_mm7815ae` | el item de Pagos del Inventario |
| Despachante asignado | `person` | el elegido en el paso anterior |
| Cantidad de contenedores | `numeric_mm77sq5g` | del reporte ya guardado en el pago |
| País de origen | `dropdown_mm776ha7` | del puerto del Catálogo de cada tractor |
| Puerto de origen | `dropdown_mm79vwr1` | el puerto del Catálogo, tal cual |
| Proveedor = `Same Deutz Fahr SPA` | `dropdown_mm77czh3` | fijo |
| Importador = `Berger SA` | `color_mm77sys5` | fijo |

Y un **subitem por tractor** (`18431188087`) con los mismos datos que su subitem del pago: valor
neto (`numeric_mm78rw31`), N° de draft (`text_mm78wee6`), cód. de producto (`text_mm78m15e`) y la
conexión al Inventario (`board_relation_mm78fqs9`).

Cada tractor que entra como subitem pasa además a **En Despachante** en el Estado Pedido del
Inventario (`color_mm6n109a`). Es el único momento en que la app toca esa columna —el resto del
viaje lo maneja el tablero— y es el que separa "lo despachamos" de "ya está en manos del
despachante". Se escribe tractor por tractor, dentro del mismo recorrido que creó su subitem, así
que cambia el estado de exactamente los que quedaron en el despacho y de ninguno más.

**Cuando el modelo tiene dos puertos** —los alemanes salen por Bremerhaven o por Hamburgo— se
cargan los dos: el criterio para elegir uno todavía no está definido, y elegirlo por nuestra cuenta
sería inventar un dato que después nadie podría revisar. Un puerto que la columna no conozca se
deja afuera antes de mandar, porque un dropdown con una etiqueta inexistente no falla en su columna:
hace fallar la escritura entera del item.

Dos decisiones que conviene saber:

- **La cantidad de contenedores se LEE del reporte del pago, no se vuelve a calcular.** Entre cargar
  la transferencia y confirmar el SWIFT pueden pasar semanas; si en el medio cambió una combinación
  del tablero de Contenedores, recalcular declararía un número distinto del que ya se le reportó a
  Berger. Si el pago no tiene reporte de la app, la columna queda vacía y se avisa en pantalla.
- **El item lleva el nombre del pago.** El pedido era crearlo sin nombre, pero monday rechaza los
  items con el nombre vacío (`InvalidItemNameException`), así que lleva el del pago: es lo que
  permite reconocerlo en el tablero sin abrir la conexión.

Nada de lo que pase acá aborta la operación de la que cuelga: para cuando se llega, el pago ya está
escrito y los tractores ya avanzaron, así que lo que falle se informa como advertencia.

El país sale del puerto por una tabla que vive en
[`src/services/monday/columns.ts`](src/services/monday/columns.ts): el Catálogo guarda la ciudad
(`Chennai`) y el Despachante pide el país (`India`), y ninguna de las dos columnas guarda la
relación.

---

## DESPACHO DE ADUANA

El otro lado del mismo circuito. Cuando una OP sale del despacho queda en el tablero
👮**Despachante de aduana** (`18430575903`), y de ahí en adelante quien la mueve es el despachante:
no toca tractores ni pagos, sólo informa dónde está la carga.

**Quién entra.** Administración ve las tres operaciones; los despachantes externos, **sólo**
Actualizar Despacho OP - DESPACHANTE.

### ACTUALIZAR DESPACHO OP - DESPACHANTE

Tres pasos, y cada uno existe por un motivo distinto.

Después de elegir las OP, el paso 2 pregunta **qué va a hacer**: actualizar los datos del viaje, o
armar los contenedores. Son dos trabajos distintos sobre la misma OP y por eso se eligen, en vez de
mezclarse en una pantalla sola.

Después de elegir las OP, el paso 2 pregunta **qué va a hacer**: actualizar los datos del viaje, o
armar los contenedores. Son dos trabajos distintos sobre la misma OP y por eso se eligen, en vez de
mezclarse en una pantalla sola.

**Paso 1 · Selección.** Todas las OP del tablero, con dos formas de acotarlas que se combinan:

- **Estado de carga** (`status`), como etiquetas del color del estado y con su **X** para quitarlas,
  igual que el filtro de meses del otro módulo. Ninguna elegida es "todas". Cada una dice cuántas
  OP tiene.
- **Búsqueda** por nombre del item (`PAGOINV-019`), N° de OP del despachante (`text_mm78qbvc`), ID
  del despacho (`DESPACHO-003`), buque, documento de transporte o contenedor de referencia. Son los
  seis nombres con los que se habla de la misma carga según con quién se esté hablando.

Cada fila muestra el nombre, el ID del despacho, el estado, el N° de OP —o **Sin N° de OP** en
naranja, si todavía no se cargó—, el arribo, el país y los contenedores. Y se despliega: antes de
marcar una OP se puede ver **cómo está hoy en monday**, campo por campo, en recuadros verde claro.

En esa ficha **sólo aparece lo que está cargado**: un campo vacío se omite, no se muestra con una
raya. Una ficha llena de rayas obliga a leer doce casilleros para encontrar los cuatro que tienen
algo, y lo que falta se nota igual por ausencia. Ahí va también el **puerto de origen**, al lado del
país: uno dice de dónde sale la mercadería y el otro de dónde zarpa.

**Paso 2 · Actualización de datos.** Un formulario por OP, con los valores actuales ya cargados:

| Campo | Columna |
|-------|---------|
| Estado de carga | `status` |
| ETA | `date4` |
| N° Op Despachante | `text_mm78qbvc` |
| Vía de transporte | `dropdown_mm78f6fn` |
| Buque | `text_mm77pw8d` |
| Nro doc de transporte | `text_mm77wxd4` |
| Contenedor de referencia | `text_mm772j1r` |
| Observaciones de la carga | `long_text_mm78yvbx` |

También se suben ahí los **cuatro comprobantes del trámite**: FC transporte de importación
(`file_mm77pmw7`), Despacho de importación (`file_mm77dbsc`), FC terminal (`file_mm77qde5`) y
Gastos varios · rendición (`file_mm774a1r`). Lo que ya está adjunto se muestra: subir otro **suma**
un archivo, no reemplaza al anterior, y conviene saberlo antes de apretar.

**Sólo viaja lo que se cambió.** Lo que no se toca no se manda, así que dos personas trabajando el
mismo día no se pisan los datos que cargó la otra, aunque tengan la OP abierta al mismo tiempo. Cada
campo modificado muestra al lado qué decía antes: el error más caro acá es sobreescribir un dato
bueno por haber tipeado en la fila equivocada.

Una OP seleccionada **sin ningún cambio** bloquea el paso, y se avisa con su nombre y un botón para
sacarla de la selección. Guardarla igual escribiría una actualización vacía y la dejaría "tocada"
sin nada nuevo, que es peor que no haberla abierto.

**Paso 3 · Resumen.** Campo por campo, `antes → después`, antes de escribir nada. No es un trámite:
acá se editan varias OP de una vez, y una fila equivocada se nota mucho más leyendo
"ETA: 12/10 → 12/11" que releyendo siete formularios.

Al guardar, cada OP se escribe por separado: si la quinta falla, las cuatro anteriores ya quedaron
bien y no hay nada que deshacer. Lo que falle se informa con nombre y apellido.

### El paso 2: qué hacer con la OP

Elegida la OP, la pantalla pregunta si se van a **actualizar los datos** del viaje o **armar los
contenedores**. Son dos trabajos distintos sobre la misma OP, y cada tarjeta lleva al pie **su
requisito**, que es lo que evita entrar y volver:

- **Actualizar datos** avisa, si quedan tractores sueltos, que para poner "Próxima a Arribar" hay
  que armar los contenedores antes. El estado se edita en esa pantalla, así que es ahí donde hay
  que enterarse.
- **Armar contenedores** dice qué le falta para habilitarse: una sola OP elegida y el **N° Op
  Despachante** cargado. Cuando ya está todo adentro, lo dice también —en verde—.

Las dos tarjetas están a la escala de las del panel de operaciones, con un color por acción: azul
para la tarea de todos los días, ámbar para el paso que habilita el arribo. La deshabilitada se
apaga a gris en vez de transparentarse, porque justo ahí es donde su texto explica qué falta.

### Armar contenedores

Al crear el despacho, la app dejó una **estimación** de cuántos contenedores harían falta. Acá manda
la realidad: **el dato que vale es cómo los arma el despachante**, aunque no coincida. Por eso no hay
tope ni validación contra ese número; sólo se muestra al lado para que se vea la diferencia.

Se habilita cuando la OP ya tiene **N° Op Despachante** (`text_mm78qbvc`): antes de eso el trámite
no arrancó. Un tractor está pendiente cuando su subitem no tiene nada en
`board_relation_mm7a62tt`.

Por cada contenedor se carga su **número** y se marcan los tractores que van adentro. Cada tractor se
identifica por su **chasis** (`lookup_mm7am1p1`, espejo del Inventario), en monoespaciado y
destacado: dos unidades del mismo modelo tienen el mismo nombre y el mismo modelo, y la matrícula es
lo único que las distingue. Un tractor entra en un solo contenedor: marcarlo en otro lo saca del
anterior.

**No se puede guardar con tractores sin ubicar**, y los que faltan están siempre a la vista. Al
guardar se crea un item en 🚚**Contenedores** (`18431711942`) con:

| Qué | Columna | De dónde sale |
|---|---|---|
| Nombre del item | *(el nombre)* | `2 x 6205 G AGROTRON · 1 x 6175 G` — la cuenta por modelo |
| N° de contenedor | `text_mm7aye5e` | lo que cargó el despachante |
| Fecha de creación | `date_mm7dxh72` | el día en que se armó |
| Tractores | `board_relation_mm7abg4` | los subitems marcados |
| OP | `board_relation_mm7d8kr1` | el **item** de la OP |

El **nombre dice qué lleva**, no cómo se llama el contenedor: en el tablero se lee primero el
nombre, y "2 x 6205 G AGROTRON" identifica la carga mucho antes que una matrícula. El número sigue
estando, en su columna.

La conexión al **item** de la OP va además de la de los subitems, y no es redundante: es la que le
trae al contenedor el N° de OP del despachante (`lookup_mm7d50jj`), el ID de la OP
(`lookup_mm7dq99y`) y su estado de carga (`lookup_mm7d9537`) espejados. Sin ella el contenedor no
sabría de qué despacho es, y es con esos espejos con lo que después se lo busca.

**La conexión es de doble vía**, así que monday completa solo el lado del subitem —probado contra
la API—.

### "Próxima a Arribar": el cruce entre los dos

Ese estado es la bisagra del circuito, y por eso tiene dos reglas:

1. **Exige los contenedores armados**, y lo dice en **tres momentos**, cada vez más temprano:

   | Dónde | Qué pasa |
   |---|---|
   | Paso 2, "¿qué vas a hacer?" | cada tarjeta muestra su requisito: armar contenedores pide el N° de OP, y actualizar datos avisa que sin contenedores no va a poder poner "Próxima a Arribar" |
   | El desplegable del estado | la opción "Próxima a Arribar" aparece **deshabilitada**, con el texto *— faltan contenedores*, y debajo del campo se dice cuántos tractores quedan sueltos |
   | Al guardar | el botón queda bloqueado y se listan las OP que no pueden pasar |

   Que la opción no se pueda ni elegir es lo que evita el caso feo: completar el formulario entero
   para que recién al final se diga que no. El aviso a BERGER lleva los links de los contenedores
   para que carguen transportista y entrega, así que sin contenedores ese aviso no sirve.
2. **Dispara el aviso a BERGER**, y sólo cuando la OP RECIÉN entra a ese estado: volver a guardar una
   que ya estaba ahí no vuelve a avisar.

El aviso son **dos cosas**, no una:

- Un **update en el item** con el texto de qué hay que completar, y —si hay contenedores— los links
  de cada uno.
- Las **menciones a Sofía** (`115175712`) **y Micaela** (`115175739`), que son lo que hace que les
  llegue. Van en el argumento `mentions_list` de `create_update`, no incrustadas en el cuerpo:
  el marcado dentro del `body` monday lo descarta al guardar —el texto queda y nadie se entera—.
  Como `mentions_list` no existe en la versión de la API que usa el resto de la app (2024-10), esa
  operación declara la suya (2025-07). Si el update falla, se cae a **notificaciones personales**:
  menos prolijo, pero el aviso no se pierde.

### ACTUALIZAR OP - BERGER S.A.

El otro lado de "Próxima a Arribar", y **sólo para Administración**. Muestra únicamente las OP en ese
estado: antes no hay nada que decidir, y después ya se decidió.

Arriba hay un **buscador** que mira el N° de OP del despachante (`text_mm78qbvc`), el nombre de la
OP, y el **nombre y el modelo** (`lookup_mm78rbz2`) de cada uno de sus tractores. Los tractores de
todas las OP listadas se traen en **una sola** consulta al abrir la pantalla, porque quien busca una
carga se acuerda del tractor mucho más seguido que del número de trámite. Cada fila muestra además
cuántos tractores tiene.

Dos cosas en la misma pantalla, porque se deciden juntas:

| De la **OP** | Columna |
|---|---|
| Forma de pago | `dropdown_mm77scb3` |
| Fondeo | `dropdown_mm77t4vd` |
| Banco a declarar | `dropdown_mm77yeb2` |
| VEP por dónde | `dropdown_mm77tkx3` |
| Estado Pago VEP | `color_mm793phx` |

| De **cada contenedor** | Columna |
|---|---|
| Ubicación de entrega | `location_mm7a16dx` |
| Transportista | `board_relation_mm7axy2m` (del tablero de Contactos) |

Van en el contenedor y no en la OP porque cada uno puede ir a un lugar distinto y con un
transportista distinto. Se puede completar sólo una parte: el banco suele definirse antes que el
transporte.

> **La ubicación exige coordenadas.** Una columna de tipo location de monday rechaza la escritura si
> sólo se manda la dirección. Como la app no geocodifica, las coordenadas van en 0 y la dirección
> —que es lo que se lee en el tablero y lo que necesita el transportista— queda bien escrita. El
> punto exacto en el mapa se ajusta desde monday.

**El Estado Pago VEP no lo toca la app al crear el despacho.** Su valor inicial lo pone la propia
columna en monday; la app lo escribe únicamente desde esta operación, cuando BERGER lo pasa a
`PAGADO`. Escribirlo al crear obligaba a habilitar esa columna en la lista de escribibles del alta,
y una columna habilitada de más es una que se puede pisar sin querer.

### ACTUALIZAR CONTENEDORES - BERGER S.A.

Cuando la carga llega, el trabajo deja de ser por OP y pasa a ser **por contenedor**: un camión
llega y se descarga de a uno, con su propia entrega y su propio arribo. Por eso esta pantalla entra
por el tablero de 🚚**Contenedores** y no por la OP. Es del módulo `aduanaBerger`, igual que
"Actualizar OP".

| Qué se carga | Columna |
|---|---|
| Arribado / Pendiente de Arribar | `color_mm7ar9rc` |
| Ubicación de entrega | `location_mm7a16dx` |
| Transportista | `board_relation_mm7axy2m` |

**Sólo se marca arribo de lo que puede haber llegado.** El estado de carga de la OP se lee del
espejo `lookup_mm7d9537`, y el toggle de arribo aparece únicamente si esa OP está en **Próxima a
Arribar** o **Nacionalizado**. Antes de eso la mercadería todavía está navegando: marcar un arribo
ahí sería anotar un hecho que no pasó. La ubicación, en cambio, se puede cargar siempre —se define
antes de que el barco llegue—.

Por defecto lista los **pendientes**: los de una OP ya en etapa de arribo a los que les falta el
arribo o la entrega. "Todos" está a un clic, porque corregir algo ya cargado es tan legítimo como
cargarlo la primera vez.

El **buscador** cubre las cuatro formas de nombrar un contenedor: su número (`text_mm7aye5e`), el
nombre del item, el N° de OP del despachante (`lookup_mm7d50jj`), el ID de la OP
(`lookup_mm7dq99y`) y el **chasis** de los tractores que lleva (`lookup_mm7ds57v`). Quien recibe el
camión tiene a mano la matrícula o el remito, casi nunca el número de trámite.

Se guarda **de a un contenedor**: cada tarjeta tiene su botón. Son decisiones independientes —cada
contenedor va a un lugar distinto— y guardar en bloque haría que un error en el tercero dejara en
duda a los otros cinco.

### DASHBOARD DE DESPACHOS

Está armado alrededor de dos preguntas, que son las que se hacen todos los días:

**¿En qué estado está cada carga?** Una tarjeta por estado, en el orden del circuito —Nueva OP →
Pendiente de Embarque → En Tránsito → Próxima a Arribar → Nacionalizado— y con el mismo color que
esa etiqueta tiene en el resto de la app.

**¿Qué hay que mirar hoy?** La segunda fila de tarjetas:

| Tarjeta | Qué cuenta |
|---------|------------|
| Con ETA vencida | OP abiertas cuya fecha de arribo ya pasó |
| Llegan esta semana | arribo dentro de 7 días |
| Sin ETA cargada | OP en curso sin fecha de arribo |
| Sin N° de OP | falta el número del despachante |
| Sin actualizar 7+ días | nadie cargó nada en una semana (`pulse_updated_mm784qds`) |
| Contenedores en curso | contenedores en OP todavía no nacionalizadas |

Los tres cortes del medio no son estadística: son **trabajo pendiente del propio despachante**, y
son los que hacen que el dashboard sirva para algo más que mirar. Abajo, las mismas OP listadas
—próximos arribos, vencidas, dormidas, sin ETA— y el reparto por país de origen.

**Las tarjetas se abren.** Tocar cualquiera despliega las OP de ese corte con su ficha completa y
**sus contenedores**: número, cuántos tractores lleva, estado de arribo, transportista, ubicación y
turno, más el chasis de cada tractor. Los contenedores se piden **sólo al abrir** y sólo de esas OP:
traerlos todos al cargar el dashboard sería una consulta por OP para dibujar unos números que casi
siempre se miran sin abrir nada.

Todo se calcula sobre las OP que ya están en pantalla, sin una consulta aparte: el número de arriba
y la lista de abajo salen del mismo dato, así que no pueden contradecirse. Las cuentas están en
[`src/lib/despachos.ts`](src/lib/despachos.ts) y se prueban solas.

> **Sugerencias para más adelante:** promedio de días entre estados (cuánto tarda de verdad una
> carga en salir), OP por despachante asignado, arribos por semana en las próximas cuatro, y
> contenedores por país. Las cuatro salen de este mismo tablero, sin cargar un dato nuevo.

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
| 🤚Team `dropdown_mm72dj2g` | decide **qué módulos** ve (ver [Quién ve qué](#quién-ve-qué)) |

La Lista Blanca se vuelve a leer **en cada pedido de datos**, no sólo al entrar: pasar a alguien a
Inactivo o quitarle la app le corta el acceso en el acto, aunque tenga la sesión del día abierta.

**Cuentas compartidas.** El autenticador es del **usuario de monday**, no de la fila. Si varias
personas entran con la misma cuenta de monday —el caso de los administradores—, comparten un único
autenticador y un único código. Si esa cuenta tuviera más de una fila en la Lista Blanca, manda la
primera habilitada.

**Mensaje único.** Cualquier rechazo —no está en la lista, inactivo, sin la app, otra cuenta— se
muestra igual: *"No tenés acceso a esta aplicación. Contactá al administrador."* Nunca revela si el
usuario existe ni qué hay adentro. El motivo real queda en el Registro de Accesos.

### Quién ve qué

La Lista Blanca ya no decide sólo **si** entrás: decide **a qué**. La app tiene dos módulos y dos
poblaciones que no se cruzan.

| Quién | Condiciones | Qué ve |
|-------|-------------|--------|
| Administración | 🤚Team `dropdown_mm72dj2g` incluye **Administracion** | **todo**: Planificación de Drafts, Fechas de Producción, Pagos Despacho, Actualizar Despacho OP y los dashboards |
| Despachante de aduana | 🤚Tipo Usuario `color_mm728j0d` = **INVITADO**, 🤚Team = **Despachantes** **y** estar en el equipo [Despachantes](https://maquinariasagricolas.monday.com/teams/1504184) de monday | **sólo** Actualizar Despacho OP - DESPACHANTE |
| Fila sin equipo cargado | — | Despacho |

Administración ve todo lo que la app tenga, hoy y cuando se sumen operaciones nuevas: es el equipo
dueño de la operación. El único restringido es el despachante, que es externo.

Por eso son **seis** módulos: `drafts`, `fechas`, `despacho`, `aduana` (lo del despachante
externo), `aduanaBerger` (lo que completa BERGER sobre la misma OP) y `aduanaDashboard` (la lectura
de conjunto). Los tres últimos comparten tablero y escriben cosas distintas. El dashboard está aparte justamente porque el despachante no lo ve —entra
a cargar sus OP, no a mirar el estado de toda la operación de BERGER— y, como se alimenta de la
misma consulta que él sí usa, separarlo por módulo es lo único que los distingue del lado del
servidor.

Para el despachante son las **tres condiciones juntas**, como las pidió BERGER. Cada una la
administra alguien distinto —la fila la carga BERGER, el equipo lo maneja monday—, así que exigir
las tres significa que nadie habilita a un externo por su cuenta. Si falta cualquiera, no entra: no
es que vea menos, es que no tiene ningún módulo y el rechazo es el mismo cartel genérico de siempre.

**El control está en el servidor, no en la pantalla.** Cada operación del catálogo declara su
módulo, y `/api/monday` comprueba en cada pedido que el perfil lo tenga. Un despachante que pida
los pagos del inventario se choca con eso aunque su pantalla no ofrezca el botón: esconder un botón
no impide pedir el dato.

**Cuándo vale cada cambio.** Los módulos se calculan al ingresar —es el único momento en que se
consulta el equipo de monday— y viajan firmados dentro de la sesión del día. En cada pedido se
vuelven a filtrar contra la Lista Blanca en vivo: cambiarle el tipo o el equipo **en el tablero**
corta el módulo en el acto; sacar a alguien del **equipo de monday** recién se nota en su próximo
ingreso, que como mucho es al día siguiente.

**Sesiones que quedan cortas.** Cada vez que alguien abre la app con una sesión del día ya válida,
se le vuelve a emitir con los módulos de ese momento, conservando que ya pasó el autenticador. Sin
eso, quien tuviera una sesión abierta emitida antes de que existieran los módulos —o antes de
cambiar de equipo— se quedaba con la pantalla de operaciones **vacía** hasta el día siguiente. Y si
un pedido de datos llega con una sesión sin módulos vigentes, se pide **renovar la sesión**, no se
niega el acceso: negarlo mostraría "no tenés acceso" a alguien que sí lo tiene.

### Autenticador (TOTP)

Estándar abierto RFC 6238: sirve **Google Authenticator**, Microsoft Authenticator, Authy o
1Password. No hay servidor externo, mails ni costo.

- **Primera vez:** se muestra un QR (y la clave en texto para quien no puede escanear) y se
  confirma con el primer código. Después se entregan **10 códigos de recuperación de un solo uso**,
  que se muestran una única vez: no se puede seguir sin confirmar que se guardaron.
- **Los ADMIN pueden usar una clave que ya tienen** —la del gestor de contraseñas del equipo, por
  ejemplo 1Password— en vez del QR: la pegan y escriben el código que esa clave está generando, lo
  que prueba que se copió completa. Es para la cuenta operativa que comparten varias personas, así
  no hay que repartir un QR. Al resto sólo se le ofrece escanear, que es lo que garantiza que el
  secreto lo generó la app y nadie más lo vio.

  > Si esa clave es la misma que usa la verificación en dos pasos **de monday**, el segundo factor
  > deja de ser independiente: quien pueda entrar a monday con esa cuenta ya tiene el código de la
  > app. Escanear el QR con el gestor de contraseñas es igual de cómodo y mantiene los dos factores
  > separados.
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
| Secreto del autenticador (uno por usuario de monday) | 🔐 Seguridad · Autenticador (no editar) | Cifrado AES-256-GCM. La clave vive sólo en Vercel. Si se edita a mano, no descifra. |
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
| Reiniciar el autenticador de alguien (perdió el celular) | **Borrar su fila** en 🔐 Seguridad · Autenticador —está identificada por el ID de usuario de monday—. En el próximo ingreso le aparece el QR. |
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
- En las **escrituras**, el tablero tiene que ser uno de los del circuito y **cada columna tocada
  tiene que estar en la lista de escribibles de ese tablero**. La app puede mover el Estado Pago de
  un tractor; no puede tocarle el precio de venta.
- Dos módulos pueden compartir tablero y escribir cosas distintas: sobre el Inventario, el circuito
  de pago mueve el Estado Pago y el de fechas mueve las fechas, y ninguno puede escribir lo del otro.
- El despachante tiene su **propia lista**, más chica: las ocho columnas que carga él. Al crear un
  despacho la app completa la conexión al pago, el proveedor y el importador, y ninguna de esas se
  puede cambiar después desde el módulo de Aduana.
- Cada operación pertenece a un **módulo**, y el perfil tiene que tenerlo habilitado.
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
    modulos.ts                Qué módulos ve cada perfil (Lista Blanca + equipo)
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
    fechas/
      ConfirmarProponerFecha.tsx  Confirmar o proponer la fecha (dos pasos)
      EnviarConfirmacion.tsx      Revisar y mandar una confirmación
      EtiquetasTractorFecha.tsx   Modelo, N° interno, status, rodado y precio
      useFechas.ts                Carga de tractores pendientes y confirmaciones
    drafts/
      PlanificarPeriodo.tsx     Planificar período de producción (dos pasos)
      EnviarPlanificacion.tsx   Enviar planificación al proveedor (dos pasos)
      DashboardDrafts.tsx       Dashboard de Drafts
      ListaDrafts.tsx           Lista, etiquetas, importes y productos de un draft
      useDrafts.ts              Carga de drafts por estado
    aduana/
      ActualizarDespachos.tsx   Actualizar Despacho OP · despachante
      ActualizarOpBerger.tsx    Pago y entrega de las OP próximas a arribar
      ArmarContenedores.tsx     Qué tractor va en cada contenedor
      DashboardDespachos.tsx    Dashboard de Despachos
      EditorOP.tsx              Formulario de una OP
      FichaOP.tsx               Los datos actuales de una OP
      EtiquetasOP.tsx           ID, estado, N° de OP, ETA, país
      useDespachos.ts           Carga de las OP del tablero
    despachante/
      PasoDespachante.tsx       Elegir despachante y ver qué se le manda
      useDespachantes.ts        La gente del equipo Despachantes
    vista/
      DespachoVista.tsx         Despacho a la VISTA (dos pasos)
    tractores/                Lo que comparten las dos modalidades
      ListaTractores.tsx        Lista seleccionable
      ResumenContenedores.tsx   Cuántos contenedores salen y qué lleva cada uno
      useContenedores.ts        Combinaciones + armado en vivo
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
    contenedores.ts           Armado de contenedores y reporte para el proveedor
    puertos.ts                Puerto de carga → país de origen, y el texto del origen
    despachos.ts              Cambios de una OP, filtros y cuentas del dashboard
    drafts.ts                 FOB/FCA, filtros y cuentas del dashboard de drafts
    fechas.ts                 Qué se puede decidir y qué lleva una confirmación
    periodos.ts               Los 120 períodos de producción de la columna
    chips.ts                  Color de cada etiqueta
    format.ts                 Números y fechas
  services/monday/            Todo lo que habla con monday
    columns.ts                IDs de tableros y columnas (única fuente de verdad)
    operaciones.ts            Catálogo de operaciones permitidas + validación de variables
    sdk.ts                    Cliente HTTP + subida de archivos
    parse.ts                  Lectura de column_values
    inventario.ts             Tractores listos para pagar y tractores VISTA
    contenedores.ts           Combinaciones del tablero de Contenedores
    catalogo.ts               Puerto de carga de cada modelo
    despachantes.ts           El equipo Despachantes de monday
    despachos.ts              Lectura y actualización de las OP de aduana
    contenedoresDespacho.ts   Tractores de una OP, contenedores y contactos
    avisos.ts                 El update y las notificaciones a BERGER
    drafts.ts                 Lectura de drafts y asignación del período
    planificacion.ts          El item de planificación que se manda al proveedor
    fechas.ts                 Tractores pendientes y la decisión sobre su fecha
    confirmaciones.ts         Las confirmaciones del proveedor y su envío
    pagos.ts                  Pagos pendientes con sus subitems
    crearPago.ts              Etapa 1: pago, subitems y estados
    crearPedidoVista.ts       Pedido a la vista: item, subitems y estados
    avanzarPago.ts            Etapas 2 y 3: comprobante, estados, fechas y aviso
    despachante.ts            Alta del despacho en el Despachante de aduana
  styles/                     base · layout · components · pago · aduana · ingreso
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
