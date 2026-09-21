# Operaciones de la APP · Importación Berger S.A.

**Fecha del relevamiento:** 17 de septiembre de 2026 · **actualizado:** 18 de septiembre de 2026
**Cuenta de monday:** BERGER S.A. (`36618349`, slug `maquinariasagricolas`)
**Formato:** vista de tablero (board view) embebida en monday, servida desde Vercel

Este documento describe **todas las operaciones que la app tiene hoy**, una por una: qué hace cada
una, qué verifica antes de dejar avanzar, qué se espera como resultado, de qué tablero toma los
datos, sobre qué tablero impacta y con qué valores, cómo se encadena con las demás, y qué criterios
se tomaron al diseñarla.

---

## 1. Panorama general

### 1.1 El recorrido de un tractor

La app acompaña a un tractor desde que se pide hasta que se nacionaliza. Las cuatro operaciones
principales están ordenadas en ese mismo recorrido, y **cada una habilita a la siguiente**:

```
  PLANIFICACIÓN DE DRAFTS        ¿qué le pedimos al proveedor y para cuándo?
            ↓                    (el draft queda planificado y se le manda a DEUTZ)
  FECHAS DE PRODUCCIÓN           ¿aceptamos la fecha que contestó, o proponemos otra?
  INVENTARIO                     (el tractor queda con la fecha CONFIRMADA)
            ↓
  PAGOS DESPACHO                 ¿cómo se paga y se despacha?
            ↓                    (se arma el pago, los contenedores y el despacho)
  DESPACHO DE ADUANA             ¿dónde está la carga y cómo se entrega?
                                 (el despachante actualiza el viaje y arma los contenedores;
                                  BERGER define pago, banco y entrega)
```

El encadenamiento **no es una sugerencia de la interfaz: está en los filtros**. Cada operación sólo
muestra lo que la anterior dejó en el estado correcto, así que es imposible saltear un paso desde la
app.

| Operación | Sólo ve lo que quedó en… | Lo deja en… |
|---|---|---|
| Planificar Período | Draft `Pend de Planificar` sin período | `Periodo Prod Planificada` + período |
| Enviar Planificación | Draft `Periodo Prod Planificada` con período | item de PLANIFICACION en `Enviar` |
| Confirmar / Proponer Fecha | Tractor `Fecha Pend Confirmar` con fecha | `Fecha Confirmada` o `Fecha a Confirmar` |
| Enviar Confirmación | Confirmación de DEUTZ no enviada | `Estado Propuesta` = `Enviar` |
| Pago Anticipado (3 etapas) | Tractor `Listo para Pagar` **y** `Fecha Confirmada` | `Pagado` + despacho creado |
| Pago Vista | Tractor `VISTA` **y** `Fecha Confirmada` | `Pendiente de Pago` + despacho creado |
| Actualizar Despacho OP - DESPACHANTE | OP creada por cualquiera de los dos pagos | estado de carga actualizado y contenedores armados |
| Actualizar OP - BERGER S.A. | OP en `Próxima a Arribar` | pago, banco, VEP y entrega definidos |
| Actualizar Fecha de Carga - DESPACHANTE | Contenedor sin `date_mm7a8jds` | turno de carga con día y hora |
| Actualizar Contenedores - BERGER S.A. | Contenedor de una OP `Próxima a Arribar` o `Nacionalizado` | `Arribado` + fecha de arribo + entrega |

### 1.2 Tableros que intervienen

| Tablero | ID | Rol en la app |
|---|---|---|
| 🧾 Drafts | `18428667614` | Pedido al proveedor. **Lectura + escritura** (período y estado) |
| 🧾 Subelementos de Drafts | `18428672791` | Un producto por línea del draft. **Sólo lectura** |
| 📬 Confirmación y Planificación de Fecha de Producción | `18428677294` | Doble uso: la app **crea** las PLANIFICACIONES y **lee + dispara** las CONFIRMACIONES |
| 🚜 Inventario | `18428578101` | Un item por tractor. **Lectura + escritura** (fechas, estado de pago, estado de pedido) |
| 🚜 Catálogo de Productos | `18428421090` | Modelo y puerto de carga. **Sólo lectura** |
| 📦 Contenedores | `18430565324` | Qué modelos viajan juntos y en qué contenedor. **Sólo lectura** |
| 💸 Pagos del Inventario | `18430295445` | Un item por operación de pago. **Creación + escritura** |
| 💸 Subelementos de Pagos | `18430295515` | Un subitem por tractor pagado. **Creación** |
| 👮 Despachante de aduana | `18430575903` | Un item por despacho. **Creación + escritura** |
| 👮 Subelementos del Despachante | `18431188087` | Un subitem por tractor despachado. **Creación** |
| 🚚 Contenedores | `18431711942` | Los contenedores reales del despacho. **Creación + escritura** |
| Contactos | `18428421093` | De ahí salen los transportistas. **Sólo lectura** |
| 🔒 Lista Blanca | (variable de entorno) | Quién entra y a qué módulos |
| 🔐 Autenticador · 🔐 Registro de Accesos | (variables de entorno) | Segundo factor y auditoría |

### 1.3 Quién ve qué

El acceso tiene **dos capas** y las dos son obligatorias:

1. **Entrar a la app**: estar en la 🔒Lista Blanca, activo, con esta app habilitada, y pasar el
   segundo factor (Google Authenticator, una vez por día calendario argentino).
2. **Ver un módulo**: depende del equipo.

| Quién | Condiciones | Qué ve |
|---|---|---|
| Administración | Team = `Administracion` en la Lista Blanca **y** estar en el equipo Administración de monday (`1504155`) | **Todo** |
| Despachante de aduana | Tipo = `INVITADO`, Team = `Despachantes` **y** estar en el equipo Despachantes de monday (`1504184`) | **Sólo** sus dos operaciones: Actualizar Despacho OP y Actualizar Fecha de Carga Contenedor |
| Fila sin equipo cargado | — | Sólo Pagos Despacho |

Internamente hay **seis módulos**: `drafts`, `fechas`, `despacho`, `aduana` (lo del despachante
externo), `aduanaBerger` (lo que completa BERGER sobre la misma OP) y `aduanaDashboard`.
Cada operación del catálogo declara el suyo y **el servidor lo verifica en cada pedido de datos**:
esconder un botón no impide pedir el dato; lo impide esa lista. El dashboard de despachos es un
módulo aparte porque usa la misma consulta que el despachante, y es lo único que lo distingue.

**Consideración de diseño:** los módulos se calculan **al ingresar** —es el único momento en que se
consulta el equipo de monday— y viajan firmados dentro de la sesión del día. En cada pedido se
vuelven a filtrar contra la Lista Blanca en vivo. Consecuencia práctica: **cambiar el tipo o el
equipo en el tablero corta el acceso en el acto**; sacar a alguien del equipo de monday recién se
nota en su próximo ingreso (como mucho, al día siguiente).

---

## 2. PLANIFICACIÓN DE DRAFTS

**Finalidad.** Decidir en qué mes le pedimos al proveedor que fabrique cada draft, y comunicárselo.
Es lo que pasa **antes de que el tractor exista** en el Inventario.

**Contexto.** Un *draft* es el pedido al proveedor. Llega como PDF, una automatización lo lee y crea
el item en 🧾Drafts con un subitem por producto. La app entra después de esa lectura.

### 2.1 Operación · PLANIFICAR PERÍODO DE PRODUCCIÓN

**Qué hace.** Le asigna a cada draft el período de producción sugerido y lo pasa de estado.

**De dónde toma los datos.**
- 🧾 Drafts (`18428667614`), filtrado por `color_mm6zdmzr` = `Pend de Planificar` (índice 3).
- 🧾 Subelementos de Drafts (`18428672791`), en la misma consulta: los productos de cada draft.

**Qué verifica antes de mostrar.**
- El draft está en `Pend de Planificar`.
- **No tiene período cargado** en `dropdown_mm70awrf`. Un draft que ya lo tiene no aparece:
  reasignarlo sería pisar una planificación hecha.

**Qué se ve de cada draft** (todo como etiquetas de color, ninguna en gris):

| Dato | Columna |
|---|---|
| N° de draft | `name` |
| ID del draft | `pulse_id_mm6thwyf` |
| Fecha del draft | `date4` |
| N° de Orden de Pedido | `text_mm6sv3rq` |
| Condición de entrega | `dropdown_mm6tve05` |
| Transporte | `dropdown_mm6tk49e` |
| Forma de pago | `dropdown_mm6t6geg` |
| Divisa | `color_mm6nbfey` |
| Costo de transporte | `numeric_mm6scnmk` (FOB) **o** `numeric_mm72rv29` (FCA) |
| Total del draft | `numeric_mm6n2m2y` |

Y desplegando, sus **productos**: nombre, tipo de rodado (`dropdown_mm70988f`), cantidad
(`numeric_mm6nvzkt`), precio unitario (`numeric_mm6nqrbw`), costo de transporte del producto
(`numeric_mm6schww` FOB **o** `numeric_mm72y3dz` FCA), valor neto (`numeric_mm6vzz57`) y subtotal
(`numeric_mm6t6at7`).

**Consideración · cuál de los dos costos de transporte.** Se busca la palabra **FOB** o **FCA**
*dentro* de la condición de entrega, no se compara la etiqueta completa. El tablero tiene también
`FOB PUERTO EN INDIA` y `FCA LAUINGEN`, que son la mayoría de los casos: comparando la etiqueta
entera se habrían quedado sin costo. El rótulo en pantalla dice cuál se está mostrando.

**Búsqueda.** Por número de draft (el nombre del item), ID de monday o N° de orden de pedido: son
los tres nombres con los que se habla del mismo draft según con quién.

**Pasos.**
1. **Selección** — ver y marcar los drafts.
2. **Períodos** — un período por draft, de la lista de `dropdown_mm70awrf` (120 etiquetas: Enero 2026
   → Diciembre 2035). Hay un selector que **asigna el mismo período a todos de una vez**, y después
   se corrigen los que difieran: es el caso más frecuente.

**Qué verifica antes de guardar.**
- Cada draft seleccionado tiene un período elegido. Si alguno no lo tiene, **se bloquea el guardado**
  y se ofrece quitarlo con un clic. Guardarlo igual lo dejaría en `Periodo Prod Planificada` sin nada
  que planificar, que es justo lo que la operación siguiente no sabría mandar.

**Sobre qué impacta.** 🧾 Drafts, un item por draft, **en una sola escritura**:

| Columna | Valor |
|---|---|
| `dropdown_mm70awrf` 🤚Periodo de producción Sugerida | el período elegido |
| `color_mm6zdmzr` 🤖Estado Draf | `Periodo Prod Planificada` |

**Consideración.** Las dos columnas van juntas porque son dos lecturas del mismo hecho —para cuándo
se pidió y en qué etapa quedó—. Separarlas abre una ventana en la que el draft figura planificado sin
período.

**Qué se espera.** Los drafts dejan de aparecer en esta operación y pasan a estar disponibles en
*Enviar Planificación*.

**Manejo de errores.** Se guarda **uno por uno**: si el quinto falla, los cuatro anteriores ya
quedaron bien y no hay nada que deshacer. Lo que falle se informa con el número de draft.

### 2.2 Operación · ENVIAR PLANIFICACIÓN

**Qué hace.** Junta los drafts ya planificados en un item de planificación y dispara el correo a
DEUTZ con los PDF y los períodos sugeridos.

**De dónde toma los datos.** 🧾 Drafts, filtrado por `color_mm6zdmzr` = `Periodo Prod Planificada`
(índice 4), con sus subelementos.

**Qué verifica antes de mostrar.** Los **dos** requisitos, no uno: el estado correcto **y** que
`dropdown_mm70awrf` tenga período. Si alguien borró el período en el tablero, no hay nada que
sugerirle al proveedor.

**Pasos.**
1. **Selección** — mismos datos y misma búsqueda que la operación anterior.
2. **Confirmación** — los drafts **agrupados por período**: cuántos drafts y cuántas unidades van a
   cada mes, y cuáles. Se avisa explícitamente que sale un mail a DEUTZ con los PDF.

**Consideración.** Ese paso existe porque de ahí sale un correo a un tercero: es lo último que se
puede revisar sin tener que salir a pedir disculpas.

**Sobre qué impacta.** 📬 Confirmación y Planificación (`18428677294`), **un item nuevo**:

| Dato | Columna | Valor |
|---|---|---|
| Nombre | `name` | `Planificación DD/MM/AAAA` |
| Tipo | `color_mm737v3t` | `🤚PLANIFICACION` |
| Fecha de emisión | `date4` | hoy |
| Drafts | `board_relation_mm70ss7g` | los drafts seleccionados |
| Estado de envío | `color_mm73xw6w` | `Enviar` |

**Orden de escritura y por qué.** Primero el item con sus conexiones; **el estado de envío va al
final**. De esa columna sale el mail, y dispararlo antes sería mandar una planificación a medio
armar. Si esa última escritura falla, el item ya está bien creado: se avisa y se puede mandar desde
el tablero.

**Qué se espera.** El proveedor recibe la planificación y, más adelante, responde con una
**CONFIRMACION** en ese mismo tablero, que es lo que alimenta el módulo siguiente.

### 2.3 Operación · DASHBOARD DE DRAFTS

**Qué hace.** Lectura de conjunto del tablero de Drafts. No escribe nada.

**De dónde toma los datos.** 🧾 Drafts en los dos estados que le importan al módulo
(`Pend de Planificar` y `Periodo Prod Planificada`), con sus subelementos.

**Qué muestra.**
- Una tarjeta por estado del draft, en el orden del circuito.
- **Trabajo pendiente:** cuántos esperan período, cuántos están listos para enviar, unidades sin
  planificar, total por divisa, y —en rojo— los **trabados por lectura**: drafts en
  `Pend de Planificar` cuyo `color_mm6sr83w` no es `Leido`. Esos no aparecen en ninguna lista de
  trabajo, así que el dashboard es el único lugar donde se detectan.
- **Cortes** con drafts, unidades e importe: por **período sugerido** (la carga de fábrica que BERGER
  está proponiendo), por forma de pago y por condición de entrega.

**Consideración.** Los importes se muestran **por divisa** y nunca sumados entre sí: sumar euros con
dólares daría un número que no existe. Si un corte mezcla divisas, se informa la cantidad y se calla
el importe.

---

## 3. FECHAS DE PRODUCCIÓN INVENTARIO

**Finalidad.** Resolver el ida y vuelta con el proveedor por la fecha de producción de cada tractor.
**Es el módulo que abre la puerta al despacho**: los dos módulos de pago sólo muestran tractores con
la fecha confirmada.

**Las dos columnas que cuentan la historia** (🚜 Inventario):

| Columna | Etiquetas | Qué significa |
|---|---|---|
| `color_mm6s8xp2` 🤖Estado Confirmación Fecha Producción | `Fecha Pend Confirmar` · `Fecha a Confirmar` · `Fecha Confirmada` | quién tiene la pelota: BERGER, el proveedor, o nadie |
| `color_mm6sc76v` 🤖Estado Fecha Producción | `Aceptada` · `Nueva Fecha Propuesta` | en qué quedó la fecha |

### 3.1 Operación · CONFIRMAR / PROPONER FECHA PRODUCCIÓN

**Qué hace.** Por cada tractor, acepta la fecha que informó el proveedor o le devuelve una propuesta.

**De dónde toma los datos.** 🚜 Inventario, filtrado por `color_mm6s8xp2` = `Fecha Pend Confirmar`
(índice 1).

**Qué verifica antes de mostrar.**
- El estado es `Fecha Pend Confirmar`.
- **Tiene fecha de producción** en `date_mm6nymx`. Sin fecha no aparece: no hay nada que aceptar ni
  contra qué comparar una propuesta.

**Qué se ve de cada tractor** (etiquetas de color):

| Dato | Columna |
|---|---|
| Modelo | `lookup_mm726zx1` (mirror del Catálogo) |
| N° Interno | `text_mm6n7mk6` |
| Primary Status | `color_mm6n5xb` |
| Primary Status Nombre Esp | `color_mm70vjqf` |
| Tipo de Rodado | `dropdown_mm709vd3` |
| FOB · Precio Unitario | `lookup_mm6vfwgy` (mirror) |

Y la **Fecha de Producción** (`date_mm6nymx`) destacada aparte, grande: es lo que se está
decidiendo, no un dato más entre otros seis.

**Búsqueda.** Por nombre del item, N° interno o modelo.

**Pasos.**
1. **Selección** — marcar los tractores sobre los que se va a decidir.
2. **Confirmar o proponer** — por tractor, dos tarjetas grandes y **excluyentes**. La elegida se
   pinta entera (verde = confirmar, ámbar = proponer); la otra queda en blanco. Al elegir *proponer*
   se abre el campo de fecha.

**Consideración de diseño.** Son dos botones y no un desplegable porque la diferencia entre aceptar
la fecha del proveedor y devolverle otra **es** la decisión: tiene que verse de un vistazo cuál quedó
elegida en cada tractor cuando se está trabajando una tanda.

**Qué verifica antes de guardar.**
1. **Confirmación conectada obligatoria.** El tractor tiene que tener algo en
   `board_relation_mm6z1cn9` 🤖Confirmación de Fecha de Producción. Si no, se marca en rojo, **bloquea
   el guardado** y se muestra el motivo completo: *no se detectó ninguna confirmación enviada por
   DEUTZ para ese producto; revisar el tablero 📬Confirmación y Planificación y la casilla de
   correo*. Sin eso, confirmar sería dar por buena una fecha que no se sabe de dónde salió, y
   proponer sería responderle a un mail que nadie recibió.
2. **Todos decididos.** Cada tractor seleccionado tiene una opción elegida, y si es *proponer*, una
   fecha cargada.

**Sobre qué impacta.** 🚜 Inventario, un item por tractor, **en una sola escritura**:

*Si confirma:*

| Columna | Valor |
|---|---|
| `color_mm6s8xp2` | `Fecha Confirmada` |
| `color_mm6sc76v` | `Aceptada` |

*Si propone:*

| Columna | Valor |
|---|---|
| `date_mm6n11kn` 🤚Fecha Prod Propuesta | la fecha elegida |
| `color_mm6s8xp2` | `Fecha a Confirmar` |
| `color_mm6sc76v` | `Nueva Fecha Propuesta` |

**Consideración.** Al confirmar **no se toca** la fecha propuesta: no hay ninguna propuesta que
hacer. Las tres columnas van juntas porque son una sola decisión.

**Qué se espera.**
- Confirmado → el tractor queda habilitado para los dos módulos de pago y despacho.
- Propuesto → la pelota vuelve al proveedor; el tractor sale de esta lista y espera su respuesta.

**Manejo de errores.** Uno por uno, con advertencias por tractor, igual que en el resto de la app.

### 3.2 Operación · ENVIAR CONFIRMACIÓN

**Qué hace.** Revisa lo que el proveedor confirmó y lo que BERGER le propone, y dispara el envío.

**De dónde toma los datos.**
- 📬 Confirmación y Planificación, filtrado por `color_mm737v3t` = `🤖CONFIRMACION` (índice 1).
- 🚜 Inventario: los tractores conectados en `board_relation_mm6zhvba`, leídos por id en una sola
  consulta para todas las confirmaciones de la pantalla.

**Qué verifica antes de mostrar.** **No se listan las ya enviadas**: una confirmación con
`color_mm6ss2d2` = `Enviado` está terminada, y ofrecerla otra vez sólo habilita a mandarla dos veces.
Sí aparecen las que están en `Enviar`, `Enviando`, `Detenido` o sin estado, porque todas son
situaciones que pueden terminar de resolverse desde la app; cuando el envío ya está en marcha, la
pantalla lo dice.

**Qué se ve.** Por cada tractor de la confirmación: las mismas etiquetas del punto 3.1, más **la
fecha del proveedor (`date_mm6nymx`) y la propuesta (`date_mm6n11kn`) una al lado de la otra**, y qué
le va a pasar.

**Regla de negocio · qué se confirma y qué se propone.**
- **Se confirma** el que no tiene fecha propuesta, **y también** el que tiene una propuesta *igual* a
  la del proveedor: proponer la misma fecha es aceptarla, aunque el tablero la haya guardado como
  propuesta.
- **Se propone** el que tiene una fecha propuesta distinta.

**Qué verifica antes de enviar** — tres condiciones, y **ninguna la puede dar por cumplida la app**:

| Condición | Columna | Valor exigido |
|---|---|---|
| El Inventario ya se actualizó | `color_mm6v8tv3` 🤖Estado Act Inventario | `Actualizado` |
| La planilla ya existe | `color_mm6zx241` 🤖Creacion Google Sheet | `Creado` |
| Alguien revisó la planilla | — | tilde explícito en la pantalla |

**La planilla, dentro de la app.** El link de `link_mm6n3cwf` 🤖G Drive Link se convierte a la URL
`/preview` de Google, que es la única que se puede incrustar en un iframe (la de `/edit` la bloquea
Google con `X-Frame-Options`). Si aun así el recuadro aparece vacío —pasa cuando Google pide iniciar
sesión dentro del iframe— la pantalla lo explica y queda el botón para abrirla aparte. **El tilde de
revisado es obligatorio en los dos casos**, porque de acá sale un correo con fechas que después se
cumplen.

**Sobre qué impacta.** 📬 Confirmación y Planificación, el item elegido:

| Columna | Valor |
|---|---|
| `color_mm6ss2d2` 🤖Estado Propuesta | `Enviar` |

Es **lo único** que la app le escribe a una confirmación.

**Qué se espera.** La automatización del tablero manda el correo y mueve ese estado a `Enviando` y
después a `Enviado`; a partir de ahí la confirmación deja de listarse.

---

## 4. PAGOS DESPACHO

**Finalidad.** Pagar y despachar los tractores. Dos modalidades, según cómo se acordó el pago con el
proveedor: **anticipado** (se paga antes de despachar) y **vista** (se despacha y se paga contra BL).

**Filtro común a las dos.** Sólo se puede despachar lo que tiene la fecha de producción **confirmada**
(`color_mm6s8xp2` = `Fecha Confirmada`). Un tractor con la fecha a confirmar no aparece en ninguna de
las dos: armar un despacho sobre una fecha que todavía puede cambiar es rehacerlo después.

### 4.1 Lo que las dos modalidades comparten

#### 4.1.1 Selección de tractores

De 🚜 Inventario, mostrando por tractor:

| Dato | Columna |
|---|---|
| Nombre | `name` |
| N° Interno | `text_mm6n7mk6` |
| Modelo | `lookup_mm726zx1` |
| Estado Rodado | `color_mm72mfyd` |
| Fecha de Producción | `date_mm6nymx` |
| Valor Neto | `lookup_mm6vj4cp` |
| Costo de Flete | `lookup_mm6vg317` |
| Precio Unitario | `lookup_mm6vfwgy` |
| Forma de Pago | `dropdown_mm6v2sa0` |
| N° de Draft | `text_mm6ne4br` |
| Cód. de Producto | `lookup_mm6z4hd1` |

**Filtro por mes de producción** (sólo en anticipado): desplegable con 12 meses hacia atrás y 12
hacia adelante, combinables, cada uno con su **X** para quitarlo. Sin ninguno elegido se ven todos.

**Consideración.** El filtro se aplica sobre la lista ya cargada —no vuelve a consultar monday— y
**no borra la selección**: un tractor ya elegido sigue en el resumen aunque su mes salga del filtro,
para poder armar una transferencia con tractores de varios meses.

#### 4.1.2 Armado de contenedores

Mientras se eligen tractores, la app arma los contenedores **en vivo**.

**De dónde toma los datos.** 📦 Contenedores (`18430565324`): cada fila es una **combinación posible**
—qué productos del catálogo viajan juntos (`board_relation_mm77crvy`), en qué tipo de contenedor
(`status`), cuántos entran (`numeric_mm77r45y`) y con qué rodado (`color_mm77eeke`)—.

**Cómo decide.**
1. Agrupa los tractores por el **conjunto de combinaciones** que les sirve: dos modelos distintos que
   comparten combinaciones pueden viajar juntos, que es justamente lo que dice el tablero.
2. Compara el rodado por el "Con"/"Sin", porque el Inventario dice *Con Rodado* y Contenedores dice
   *Con Ruedas*. `Con y Sin Ruedas` sirve para ambos.
3. Elige la combinación **más chica que alcance** para lo que queda; si ninguna alcanza, la que mejor
   aprovecha cada contenedor físico.
4. El `+` de una etiqueta (`20 H + 40 H`) cuenta como **dos contenedores físicos**.

**Qué informa.** Cuántos contenedores salen, qué lleva cada uno, dónde sobró lugar, **qué otro
tractor de la lista podría completarlo**, y los que no entran en ninguna combinación con su motivo
(no está conectado al Catálogo, el modelo no figura en Contenedores, falta el Estado Rodado, o no hay
combinación para ese rodado).

**Consideración.** Se muestra *mientras se elige* y no después: ver que un contenedor viaja por la
mitad cuando el pago ya se registró es tarde.

#### 4.1.3 El reporte de contenedores

Se guarda en `long_text_mm77ydg9` del pago y tiene **dos secciones, para dos destinatarios**:

```
Informacion para Berger:        el detalle completo para decidir
   TOTAL, qué lleva cada contenedor, lugares libres, sugerencias,
   y los tractores sin contenedor asignado con su motivo

Informacion para Despachante:   lo mínimo para operar
   * Cantidad de contenedores: 3
   * Contenedores por tipo: 1 x 20 H, 2 x 40 H
   * Cantidad de tractores: 5
   * Origen: Puerto 1: Alemania (Bremerhaven) ó Puerto 2: Alemania (Hamburgo)
```

- El **total va solo en su propia línea** porque es el número que la etapa 3 vuelve a leer de este
  texto para cargarlo en el tablero del Despachante.
- El desglose cuenta contenedores **físicos**, no combinaciones.
- El **origen** sale del puerto de carga del Catálogo (`dropdown_mm78jn1v`), que es un dato del
  modelo. Si el modelo tiene más de un puerto, se numeran: son alternativas, y esa elección no la
  hace la app.
- El **destino** no va en el reporte: se escribe a mano en el cuerpo del mail.

#### 4.1.4 Elección del despachante

Antes de confirmar, las dos modalidades tienen un paso donde se elige **a quién se le manda el
despacho** y se ve **exactamente el texto** que va a recibir (la sección `Informacion para
Despachante` del reporte, no un resumen escrito aparte).

Los candidatos salen del **equipo Despachantes de monday** (`1504184`), no de una lista en el código:
sumar un despachante es agregarlo al equipo. Los usuarios desactivados se dejan afuera.

**Casos.**
- **Equipo con gente** → elegir es **obligatorio**.
- **Equipo vacío** → no se muestra la lista, el despacho se crea con la persona **sin asignar** y se
  avisa. Bloquear ahí dejaría el circuito trabado por un equipo de monday que la app no administra.

#### 4.1.5 Alta del despacho en aduana

Cuando el despacho queda cerrado, se crea el item en 👮 Despachante de aduana (`18430575903`):

| Dato | Columna | De dónde sale |
|---|---|---|
| Nombre | `name` | el nombre del pago |
| Conexión al pago | `board_relation_mm7815ae` | el item de Pagos |
| Despachante | `person` | el elegido en el paso anterior |
| Cantidad de contenedores | `numeric_mm77sq5g` | del reporte ya guardado |
| País de origen | `dropdown_mm776ha7` | del puerto del Catálogo |
| Puerto de origen | `dropdown_mm79vwr1` | del puerto del Catálogo |
| Proveedor | `dropdown_mm77czh3` | fijo: `Same Deutz Fahr SPA` |
| Importador | `color_mm77sys5` | fijo: `Berger SA` |

Y un **subitem por tractor** (`18431188087`): valor neto (`numeric_mm78rw31`), N° de draft
(`text_mm78wee6`), cód. de producto (`text_mm78m15e`) y conexión al Inventario
(`board_relation_mm78fqs9`).

**Además, cada tractor pasa a `En Despachante`** en `color_mm6n109a` 🤖Estado Pedido del Inventario.
Se escribe tractor por tractor, dentro del mismo recorrido que creó su subitem, así que cambia el
estado de exactamente los que quedaron en el despacho y de ninguno más. **Es el único momento en que
la app toca esa columna**; el resto del viaje lo maneja el tablero.

**Consideraciones.**
- El item lleva **el nombre del pago** porque monday rechaza items con el nombre vacío
  (`InvalidItemNameException`), aunque el pedido original era crearlo sin nombre.
- Con **dos puertos** (los alemanes) se cargan los dos: el criterio para elegir uno no está definido.
- Un puerto o un país que la columna no conozca **se deja afuera antes de mandar**: un dropdown con
  una etiqueta inexistente no falla en su columna, hace fallar la escritura entera del item.
- **Nada de esto aborta la operación**: para cuando se llega, el pago ya está escrito y los tractores
  ya avanzaron, así que lo que falle se informa como advertencia.

### 4.2 PAGO ANTICIPADO

Tres etapas encadenadas: cada una toma los pagos que dejó la anterior.

| Etapa | Trabaja sobre | Deja el pago en |
|---|---|---|
| 1 · Cargar Transferencia | Tractores `Listo para Pagar` con fecha confirmada | `CARGADO` · `Pend de Aprobar Transf` |
| 2 · Aprobar Transferencia | Pagos en `Pend de Aprobar Transf` | `APROBADO` · `Pend de Confirmar Transf` |
| 3 · Confirmar Pago - SWIFT | Pagos en `Pend de Confirmar Transf` **y** `APROBADO` | `CONFIRMADO` · `Pagado` |

En paralelo, cada tractor avanza en `color_mm6v6532` 🤖Estado Pago del Inventario:
`Listo para Pagar` → `Transf Cargada` → `Transf Aprobada` → `Pagado`.

#### 4.2.1 Etapa 1 · CARGAR TRANSFERENCIA

**Qué hace.** Registra el pago de un grupo de tractores y adjunta el comprobante.

**De dónde toma los datos.** 🚜 Inventario: `color_mm6v6532` = `Listo para Pagar` **y**
`color_mm6s8xp2` = `Fecha Confirmada`.

**Pasos.** 1) Selección con filtro de meses y armado de contenedores. 2) Transferencia: PDF, monto
—propuesto con el total de los valores netos, **editable**— y fecha de emisión.

**Consideración.** El monto queda editable porque la transferencia real puede diferir por redondeo,
gastos bancarios o un pago parcial acordado. Cuando difiere del total calculado, **la app lo dice** en
vez de decidir por su cuenta cuál de los dos tiene razón.

**Sobre qué impacta.**

*💸 Pagos del Inventario — item nuevo `PAGO ANTICIPADO - <fecha de emisión>`:*

| Dato | Columna | Valor |
|---|---|---|
| Tipo de pago | `color_mm78170z` | `ANTICIPADO` |
| Monto | `numeric_mm714xb2` | el tipeado |
| Fecha de emisión | `date_mm71jrsz` | la elegida |
| Estado Pago | `color_mm71p4rf` | `CARGADO` |
| Operación Pendiente | `color_mm71e2wc` | `Pend de Aprobar Transf` |
| Fecha CARGADO | `date_mm71zare` | hoy |
| Reporte de contenedores | `long_text_mm77ydg9` | el texto de dos secciones |
| Comprobante | `file_mm71eqv5` | el PDF |

*💸 Subelementos de Pagos — uno por tractor:* nombre (`name`), valor neto (`numeric_mm71c5je`), N° de
draft (`text_mm71atj2`), cód. de producto (`text_mm71zgys`) y conexión al Inventario
(`board_relation_mm718zjg`).

*🚜 Inventario:* `color_mm6v6532` → `Transf Cargada`.

**Orden y manejo de errores.** Crear el item y subir el comprobante son los **únicos pasos que
abortan**: sin item o sin comprobante no hay nada que registrar, y un pago sin transferencia adjunta
no se puede aprobar después. De los subitems en adelante, los fallos se juntan como **advertencias**
y se devuelven: el pago ya existe, y esconder que un subitem no se creó dejaría al usuario creyendo
que cargó algo que no está.

**Consideración.** El aviso al despachante **no se toca en esta etapa**: en anticipado el despacho se
informa recién cuando el pago está confirmado, porque hasta entonces la transferencia puede caerse.

#### 4.2.2 Etapa 2 · APROBAR TRANSFERENCIA

**Qué hace.** Aprueba una transferencia ya cargada y avisa al proveedor.

**De dónde toma los datos.** 💸 Pagos del Inventario: `color_mm71e2wc` = `Pend de Aprobar Transf`,
con sus subitems y —leído del Inventario en una sola consulta— el estado actual de cada tractor.

**Qué verifica.** Se elige **un solo pago por vez**: cada uno tiene su propio comprobante, y aprobar
dos a la vez obligaría a preguntar qué archivo va con cuál. Si un subitem quedó **sin conexión al
Inventario**, se muestra con un chip rojo y se informa como advertencia, en vez de saltearlo en
silencio.

**Sobre qué impacta.**

| Tablero | Columna | Valor |
|---|---|---|
| 💸 Pagos | `file_mm71s567` | transferencia con número |
| 💸 Pagos | `color_mm71p4rf` | `APROBADO` |
| 💸 Pagos | `color_mm71e2wc` | `Pend de Confirmar Transf` |
| 💸 Pagos | `date_mm71xrq5` | hoy |
| 🚜 Inventario | `color_mm6v6532` | `Transf Aprobada` |
| 💸 Pagos | `color_mm71tfkp` (Email 1) | `Enviar` |

**Orden.** El comprobante es lo único que aborta. **El aviso por mail va último**: es lo único
irreversible —una vez que la automatización lo manda, el proveedor ya lo recibió—.

#### 4.2.3 Etapa 3 · CONFIRMAR PAGO - SWIFT

**Qué hace.** Cierra el circuito del pago, avisa al proveedor y **arma el despacho de aduana**.

**De dónde toma los datos.** 💸 Pagos del Inventario, con **dos** condiciones: `color_mm71e2wc` =
`Pend de Confirmar Transf` **y** `color_mm71p4rf` = `APROBADO`.

**Consideración.** Se piden las dos porque un pago que quedó en "Pend de Confirmar" sin haber pasado
por APROBADO es una inconsistencia del tablero, y confirmarlo taparía el problema en vez de
mostrarlo.

**Pasos.** Es la única etapa de **tres pasos**: pago → comprobante del banco → **despachante**.

**Sobre qué impacta.**

| Tablero | Columna | Valor |
|---|---|---|
| 💸 Pagos | `file_mm713dbc` | comprobante del banco |
| 💸 Pagos | `color_mm71p4rf` | `CONFIRMADO` |
| 💸 Pagos | `color_mm71e2wc` | `Pagado` |
| 💸 Pagos | `date_mm71q4qa` | hoy |
| 🚜 Inventario | `color_mm6v6532` | `Pagado` |
| 👮 Despachante | item + subitems | ver 4.1.5 |
| 🚜 Inventario | `color_mm6n109a` | `En Despachante` |
| 💸 Pagos | `color_mm71bk6h` (Email 2) | `Enviar` |
| 💸 Pagos | `color_mm78m8pn` (Email despachante) | `Enviar` |

**Orden.** Comprobante → estados y fecha → tractores → **despacho de aduana** → los dos avisos por
mail, juntos y al final.

**Consideración · de dónde sale la cantidad de contenedores.** Se **lee del reporte** que dejó la
etapa 1, no se vuelve a calcular. Entre cargar la transferencia y confirmar el SWIFT pueden pasar
semanas; si en el medio cambió una combinación del tablero de Contenedores, recalcular declararía un
número distinto del que ya se le reportó a Berger. Si el pago no tiene reporte de la app, la columna
queda vacía y se avisa en pantalla.

### 4.3 PAGO VISTA (Contra BL)

**Qué hace.** Registra un pedido que se despacha **sin pago previo**: se paga contra BL.

**De dónde toma los datos.** 🚜 Inventario: `dropdown_mm6v2sa0` incluye `VISTA` **y**
`color_mm6s8xp2` = `Fecha Confirmada`.

**Consideración.** A diferencia de anticipado, acá se muestra el **Estado Pago** de cada tractor: en
anticipado todos los de la lista están por definición en `Listo para Pagar`, y en vista no hay un
estado que los filtre, así que ver en cuál está cada uno es parte de decidir si se pide.

**Pasos.** 1) Selección + contenedores. 2) Despachante.

**Sobre qué impacta.**

*💸 Pagos del Inventario — item nuevo `PAGO VISTA - <fecha>`:*

| Dato | Columna | Valor |
|---|---|---|
| Tipo de pago | `color_mm78170z` | `VISTA` |
| Fecha de emisión | `date_mm77cwrs` | hoy |
| Monto pendiente | `numeric_mm78d1ng` | total del valor neto |
| Operación Pendiente | `color_mm71e2wc` | `Pendiente de Pago` |
| Reporte de contenedores | `long_text_mm77ydg9` | el texto de dos secciones |

*💸 Subelementos:* uno por tractor, igual que en anticipado.
*🚜 Inventario:* `color_mm6v6532` → `Pendiente de Pago`; `color_mm6n109a` → `En Despachante`.
*👮 Despachante:* item + subitems (ver 4.1.5).
*💸 Pagos:* `color_mm78m8pn` → `Enviar`, **al final**.

**Consideración.** El monto va a *Monto Pendiente VISTA* y **no** a la columna del monto transferido:
en la vista todavía no se pagó nada, y es justamente lo que queda por cobrar contra el BL.

---

## 5. DESPACHO DE ADUANA

**Finalidad.** El otro lado del circuito. Cuando una OP sale del despacho, quien la mueve es el
despachante: no toca tractores ni pagos, sólo informa dónde está la carga.

**Quién entra.** Administración (todo) y los despachantes externos (**sólo** Actualizar Despacho OP).

### 5.1 Operación · ACTUALIZAR DESPACHO OP - DESPACHANTE

**Qué hace.** Carga las novedades de una o varias OP en 👮 Despachante de aduana.

**De dónde toma los datos.** 👮 Despachante de aduana (`18430575903`), todas las OP. El filtro se
hace en la pantalla: es un tablero que crece de a una fila por despacho, así que filtrar en el
navegador es instantáneo y no cuesta un viaje a monday por cada tecla.

**Filtros y búsqueda.**
- Por **estado de carga** (`status`): `Nueva OP`, `Pendiente de Embarque`, `En Transito`,
  `Próxima a Arribar`, `Nacionalizado`. Etiquetas del color del estado, combinables, cada una con su
  **X**. Ninguna elegida = todas. Cada una dice cuántas OP tiene.
- Por **texto**: nombre del item, N° de OP del despachante (`text_mm78qbvc`), ID del despacho
  (`pulse_id_mm78a7v4`), buque, documento de transporte o contenedor de referencia.

**Qué se ve.** Cada fila: nombre, ID del despacho, estado, N° de OP —o **Sin N° de OP** en naranja—,
arribo, país y contenedores. Desplegando, la **ficha con los datos actuales** en recuadros verde
claro, donde **sólo aparece lo que está cargado**: un campo vacío se omite.

**Consideración.** Una ficha llena de rayas obliga a leer doce casilleros para encontrar los cuatro
que tienen algo, y lo que falta se nota igual por ausencia.

**Pasos.**
1. **Selección de OP.**
2. **Qué hacer** — dos tarjetas excluyentes: *Actualizar datos* o *Armar contenedores*. Son dos
   trabajos distintos sobre la misma OP.
3. **Actualización de datos** — un formulario por OP con los valores actuales ya cargados.
4. **Resumen** — campo por campo, `antes → después`, antes de escribir nada.

**Campos editables** (los únicos que el despachante puede escribir):

| Campo | Columna |
|---|---|
| Estado de carga | `status` |
| ETA | `date4` |
| N° Op Despachante | `text_mm78qbvc` |
| Vía de transporte | `dropdown_mm78f6fn` |
| Buque | `text_mm77pw8d` |
| Nro doc de transporte | `text_mm77wxd4` |
| Contenedor de referencia | `text_mm772j1r` |
| Observaciones de la carga | `long_text_mm78yvbx` |

Y los **cuatro comprobantes del trámite**, que se suben desde la misma pantalla:

| Comprobante | Columna |
|---|---|
| FC transporte de Importación | `file_mm77pmw7` |
| Despacho de importación | `file_mm77dbsc` |
| FC terminal | `file_mm77qde5` |
| Gastos varios · rendición | `file_mm774a1r` |

Lo que ya está adjunto se muestra en pantalla: subir otro **suma** un archivo, no reemplaza al
anterior. Los archivos se suben **después** de escribir las columnas: si una subida falla, los datos
ya quedaron guardados y sólo hay que volver a adjuntar.

**Qué verifica.**
- **Sólo viaja lo que cambió.** Lo que no se toca no se manda, así que dos personas trabajando el
  mismo día no se pisan los datos que cargó la otra.
- Cada campo modificado muestra al lado **qué decía antes**: el error más caro acá es sobreescribir
  un dato bueno por haber tipeado en la fila equivocada.
- Una OP seleccionada **sin ningún cambio bloquea el paso**, y se ofrece sacarla. Guardarla igual
  escribiría una actualización vacía.

**Consideración · por qué existe el paso 3.** Acá se editan varias OP de una vez, y una fila
equivocada se nota mucho más leyendo `ETA: 12/10 → 12/11` que releyendo siete formularios.

**Sobre qué impacta.** 👮 Despachante de aduana, una escritura por OP, sólo con los campos
modificados. Si la quinta falla, las cuatro anteriores ya quedaron bien; lo que falle se informa con
nombre.

**Restricción de permisos.** La lista de columnas editables del despachante es **más chica** que la
que usa la app al crear el despacho: la conexión al pago, el proveedor y el importador no se pueden
cambiar desde este módulo.

**Comprobantes que sube el despachante.** A los cuatro del trámite se suma el **VEP**
(`file_mm7d41zn`), y no es uno más: es la llave del pago. Mientras esa columna esté vacía, BERGER
no puede marcar el VEP como pagado ni subir su comprobante.

**El paso 2 · ¿qué vas a hacer?** Después de elegir la OP se decide entre *Actualizar datos* y
*Armar contenedores*. Cada tarjeta muestra al pie **su requisito**:

| Tarjeta | Requisito que muestra |
|---|---|
| Actualizar datos | con tractores sueltos: *"Para poner «Próxima a Arribar» hay que armar los contenedores antes"*. Sin tractores sueltos, lo confirma en verde |
| Armar contenedores | una sola OP elegida, y el **N° Op Despachante** (`text_mm78qbvc`) cargado. Si ya está todo ubicado, lo dice |

**Consideración · el requisito se dice donde se toma la decisión.** El estado de carga se edita en
*Actualizar datos*, no en *Armar contenedores*; por eso la advertencia sobre el arribo va en la
primera tarjeta aunque hable de la segunda.

### 5.2 Armar contenedores

**Qué hace.** Dice qué tractor viaja en qué contenedor, y crea esos contenedores en monday.

**De dónde toma los datos.** Los **subitems** de la OP en 👮 Despachante de aduana, con el chasis
espejado del Inventario (`lookup_mm7am1p1`), el modelo (`lookup_mm78rbz2`) y el contenedor en el
que ya están (`board_relation_mm7a62tt`).

**Qué verifica antes de habilitarse.** Que la OP tenga **N° Op Despachante** (`text_mm78qbvc`):
antes de eso el trámite no arrancó. Un tractor está pendiente cuando su subitem no tiene contenedor.

**Qué verifica antes de guardar.**
- Cada contenedor tiene número y al menos un tractor.
- No hay dos contenedores con el mismo número en la misma OP.
- **Ningún tractor queda afuera.** Es la condición que no se puede saltear: un tractor sin contenedor
  es uno que nadie va a ir a buscar al puerto.

**Sobre qué impacta.** 🚚 Contenedores (`18431711942`), un item por contenedor:

| Dato | Columna | Qué lleva |
|---|---|---|
| Nombre del item | `name` | `N° de OP - N° de contenedor - cuenta por modelo` |
| N° de contenedor | `text_mm7aye5e` | lo que cargó el despachante |
| Fecha de Creación Contenedor | `date_mm7dxh72` | el día en que se armó |
| Tractores que lleva | `board_relation_mm7abg4` | los subitems marcados |
| OP de despacho | `board_relation_mm7d8kr1` | el **item** de la OP |

**Consideración · el nombre contesta tres preguntas.** De qué OP es, cuál de los contenedores es y
qué lleva adentro, en ese orden: `2026-0143 - MSKU1234567 - 2 x 6205 G AGROTRON`. Los tres datos
viven además en sus columnas; en el nombre están porque es lo único que se ve en una notificación,
en un link o en la columna de conexión de otro tablero. Si un tractor no tiene modelo cargado se
cuenta como "Sin modelo", para que la cuenta cierre igual.

**Consideración · la conexión al item de la OP.** Va **además** de la de los subitems, y no es
redundante: es la que le trae al contenedor, espejados, el N° de OP del despachante
(`lookup_mm7d50jj`), el ID de la OP (`lookup_mm7dq99y`) y su estado de carga (`lookup_mm7d9537`).
Sin ella el contenedor no sabría de qué despacho es, y es con esos espejos con lo que después se lo
busca y se decide si puede marcarse como arribado.

**Consideración · sólo se escribe un lado.** La conexión con el subitem del tractor es de **doble
vía**: monday completa `board_relation_mm7a62tt` solo. Escribir los dos sería pisar el mismo dato
dos veces y dejar la puerta abierta a que queden distintos si una de las escrituras falla.

**Consideración · manda la realidad.** Al crear el despacho, la app dejó una estimación de cuántos
contenedores harían falta. Acá no se valida contra ese número: **el dato que vale es cómo los armó el
despachante**. La estimación se muestra al lado, nada más, para que se vea la diferencia.

**Consideración · el chasis.** Cada tractor se identifica por su matrícula, en monoespaciado y
destacado: dos unidades del mismo modelo tienen el mismo nombre y el mismo modelo, y el chasis es lo
único que las distingue cuando hay que decir cuál va en cuál.

### 5.3 Operación · ACTUALIZAR FECHA DE CARGA CONTENEDOR - DESPACHANTE

**Qué hace.** Le asigna a cada contenedor su turno de carga en la terminal: día y hora. **Sólo el
despachante** (módulo `aduana`), junto a su otra operación.

**Por qué es suya.** El turno lo consigue él; BERGER se entera, no lo decide.

**De dónde toma los datos.** 🚚 Contenedores completo, con los espejos de la OP.

**Qué verifica antes de mostrar.** Por defecto sólo los que **no tienen turno** (`date_mm7a8jds`
vacío): ésa es su lista de pendientes, un contenedor sin turno es un camión que nadie citó. "Todos"
está a un clic. Busca por N° de contenedor, N° de OP, ID de la OP, chasis y estado de carga.

**Sobre qué impacta.** Una sola columna: `date_mm7a8jds`, con día y hora.

**Consideración · fecha y hora, juntas.** Son el mismo dato y viajan en una sola escritura. Un
turno "el jueves" sin hora no le sirve al transportista, y en dos pasos se podía guardar la mitad;
el botón no se habilita hasta que están las dos.

**Consideración · la hora se guarda en UTC.** Una columna de fecha con hora almacena la hora en UTC
y la muestra en la zona de la cuenta: las **09:00** se escriben **12:00:00** —comprobado leyendo un
turno cargado a mano—. La conversión puede correr el DÍA (las 22:30 caen al día siguiente en UTC),
así que se calcula con una fecha real y no sumando tres horas. El huso va fijo en `-03:00`, no el
del navegador: el turno es en el puerto, no donde esté abierta la app.

**Consideración · lo único que puede escribir es el turno.** Su operación del catálogo tiene una
lista de columnas escribibles de **una sola**. La ubicación de entrega, el transportista y el
arribo son de BERGER y quedan fuera de su alcance aunque conozca el id del item. Por la misma
razón la lectura del tablero de contenedores existe **dos veces** en el catálogo, una por módulo:
cada operación pertenece a uno solo, y esa simpleza es lo que permite auditar de un vistazo quién
puede pedir qué.

**Qué más muestra.** El detalle de la OP de cada contenedor —N° de OP, ID, estado de carga, chasis,
arribo, entrega, patente— plegado por defecto.

### 5.4 El cruce: "Próxima a Arribar"

Ese estado es la bisagra entre el despachante y BERGER, y tiene dos reglas.

**1. Exige los contenedores armados.** El motivo es concreto: el aviso a BERGER lleva los links de
los contenedores para que carguen transportista y entrega, así que sin contenedores ese aviso no
sirve. La exigencia se avisa **tres veces**, cada una más temprano que la anterior:

| Momento | Qué se ve |
|---|---|
| Paso 2, "¿qué vas a hacer?" | la tarjeta de *Actualizar datos* avisa que sin contenedores no va a poder ponerse "Próxima a Arribar"; la de *Armar contenedores* dice qué le falta para habilitarse |
| Al abrir el desplegable del estado de carga | la opción "Próxima a Arribar" está **deshabilitada** y rotulada *— faltan contenedores*; debajo del campo se dice cuántos tractores quedan sueltos, y el formulario muestra el aviso con el botón para ir a armarlos |
| Al guardar | el botón queda bloqueado y se listan las OP que no pueden pasar |

**Consideración · no alcanza con rechazar al final.** Dejar elegir un estado que después el guardado
rechaza obliga a completar el formulario entero para recibir un no. Por eso la opción directamente
no se puede seleccionar, y el aviso del formulario aparece **aunque el estado elegido todavía no
sea** "Próxima a Arribar": lo que importa es que se entere quien está por elegirlo.

**2. Dispara el aviso a BERGER**, y sólo cuando la OP **recién entra** a ese estado: volver a guardar
una que ya estaba ahí no vuelve a avisar.

El aviso son **dos cosas**:

| Qué | Dónde | Contenido |
|---|---|---|
| Update con menciones | en el item de la OP | qué campos hay que completar, los links de los contenedores si los hay, y la mención a Sofía (`115175712`) y Micaela (`115175739`) |
| Notificación | a las dos | **sólo si el update falla**: el mismo pedido, en una línea |

**Consideración · cómo se menciona.** Las menciones van en el argumento `mentions_list` de
`create_update`, no incrustadas en el cuerpo: el marcado dentro del `body` monday lo descarta al
guardar —el texto queda y la persona nunca se entera—. Probado contra la API.

**Consideración · versión de la API.** `mentions_list` no existe en 2024-10, que es la versión con
la que corre el resto de la app. En vez de subir la versión de todo —lo que obligaría a volver a
probar las treinta y pico de consultas—, **esa operación declara la suya** (2025-07). El catálogo
admite una versión por operación justamente para esto.

Ninguna de las dos aborta nada: para cuando se llega ahí la OP ya está actualizada, así que un fallo
del aviso se informa como advertencia.

### 5.5 Operación · ACTUALIZAR OP - BERGER S.A.

**Qué hace.** Define cómo se paga y cómo se entrega una carga que está por llegar. **Sólo
Administración.**

**De dónde toma los datos.** 👮 Despachante de aduana, filtrado por `status` = `Próxima a Arribar`,
más los contenedores de esa OP y el tablero de Contactos para elegir transportista.

**Qué verifica antes de mostrar.** Sólo las OP en ese estado: antes no hay nada que decidir y después
ya se decidió.

**Buscador.** Filtra por N° de OP del despachante (`text_mm78qbvc`), nombre de la OP, y **nombre o
modelo** (`lookup_mm78rbz2`) de cualquiera de sus tractores. Los tractores de todas las OP listadas
se traen en **una sola** consulta al abrir: quien busca una carga se acuerda del tractor mucho más
seguido que del número de trámite.

**Qué muestra cada fila.** Además de las etiquetas de la OP, sus **tractores**: arriba el resumen
por modelo (`2 x 6205 G AGROTRON`) y debajo una etiqueta por unidad.

| Dato del tractor | Columna | Tipo |
|---|---|---|
| Nombre | `name` del subitem | — |
| Modelo | `lookup_mm78rbz2` | espejo |
| Valor neto | `numeric_mm78rw31` | columna propia del subitem |
| N° Fact Compra | `lookup_mm7avmwm` | espejo |
| Chasis | `lookup_mm7am1p1` | espejo |
| Rodado | `lookup_mm78j0hk` | espejo |

**Consideración · por qué está en la lista y no adentro.** Quien define pago, banco y entrega
necesita ver qué está por pagar antes de entrar. Teniéndolo que abrir, la comparación entre OP se
pierde.

**Consideración · el rodado se muestra siempre.** Se imprime la etiqueta tal como viene del
tablero ("Con Rodado", "Sin Rodado"), sin traducirla a un sí/no propio: eso obligaría a mantener
acá la lista de etiquetas del Inventario. Lo único que se deduce es el color, y por la negativa.
Un tractor sin rodado se descarga distinto, así que un vacío no puede confundirse con "no lo miré".

**Sobre qué impacta.**

*De la OP (👮 Despachante de aduana):*

| Dato | Columna |
|---|---|
| Forma de pago | `dropdown_mm77scb3` |
| Fondeo | `dropdown_mm77t4vd` |
| Banco a declarar | `dropdown_mm77yeb2` |
| VEP por dónde | `dropdown_mm77tkx3` |
| Estado Pago VEP | `color_mm793phx` |

*De cada contenedor (🚚 Contenedores):*

| Dato | Columna |
|---|---|
| Ubicación de entrega | `location_mm7a16dx` |
| Transportista | `board_relation_mm7axy2m` |

**Consideración · por qué en el contenedor.** Cada contenedor puede ir a un lugar distinto y con un
transportista distinto, así que esos dos datos viven ahí y no en la OP.

**Consideración · los campos arrancan con lo que hay.** Incluido el transportista ya asignado —la
conexión devuelve el id, que se resuelve contra la lista de contactos— y las coordenadas de la
dirección, que la columna expone en campos propios (`lat`/`lng`) y no en su texto. Arrancar en
blanco hacía que un contenedor ya completo se viera como pendiente y que la advertencia de "sin
ubicar" saliera sobre una dirección perfectamente cargada.

**Consideración · botón Actualizar.** La sección de contenedores tiene el suyo: el despachante y
las automatizaciones tocan esos items mientras la pantalla está abierta, y sin el botón había que
salir de la OP y volver a entrar.

**Consideración · un contenedor coordinado no se toca.** Con fecha de turno (`date_mm7a8jds`) **y**
el aviso ya enviado (`color_mm7dzv11` = `Enviado`), el transportista recibió un correo diciéndole
dónde y cuándo. La entrega y el transportista pasan a sólo lectura con el motivo escrito:
cambiarlos después deja al tablero diciendo una cosa y al mail otra, y el que maneja leyó el mail.
Se corrige en monday, avisando a mano. Hacen falta **las dos** condiciones: con turno pero sin
aviso enviado todavía se edita.

**Consideración · se puede completar a medias.** Nada obliga a llenar todo de una vez: el banco suele
definirse antes que el transporte, y sólo viaja lo que se cambió.

**Consideración · la ubicación se elige de una lista.** Una columna de tipo *location* rechaza la
escritura si sólo se manda la dirección: exige latitud y longitud. El campo funciona como el de
monday —se escribe, aparecen direcciones reales, se toca una— y se guardan **sus** coordenadas. En
el tablero el resultado es indistinguible de haberla cargado a mano, probado contra la API.

Escribir libre sigue permitido, porque hay entregas en establecimientos que ningún mapa conoce. En
ese caso las coordenadas van en 0, la dirección se lee bien igual, y el campo avisa *"Sin ubicar en
el mapa"* antes de guardar: así es una decisión y no un descuido.

**Consideración · el transportista sale filtrado.** El tablero de Contactos es la agenda entera de
BERGER —clientes, proveedores, despachantes—, así que el desplegable muestra sólo los que tienen
`Transportista` en 🤚Categoria (`dropdown_mm7acm6r`). Un contacto con varias categorías aparece
igual. El filtro es por el dato del tablero y no por una lista en el código: se da de alta un
transportista nuevo y aparece sin tocar la app.

**Consideración · el VEP lo maneja BERGER.** Al crear el despacho la app **no toca**
`color_mm793phx`: su valor inicial lo pone la propia columna en monday. La app sólo lo escribe
desde esta operación, cuando BERGER lo pasa a `PAGADO`.

**Consideración · no se puede pagar un VEP que no existe.** El estado del pago y el comprobante
(`file_mm7d3jvj`) están **bloqueados** mientras el despachante no haya subido el VEP
(`file_mm7d41zn`). Se mira el archivo, no un estado: el archivo es el hecho. Con el VEP subido, la
pantalla muestra su nombre con link y habilita las dos cosas **juntas**, porque marcar el pago sin
adjuntar el comprobante deja media operación registrada.

**Consideración · un pago no se deshace desde acá.** Con el estado ya en `PAGADO`, el desplegable
queda fijo y no se ofrece subir otro comprobante: se muestra el que hay, con link. Si el pago se
registró mal, se corrige en monday, donde queda asentado quién lo cambió.

**Consideración · cada archivo, de su módulo.** El VEP pertenece al módulo `aduana` y el
comprobante de pago a `aduanaBerger`. Así el despachante no puede subir el comprobante de pago ni
BERGER el VEP, y eso lo verifica el servidor por la pertenencia de la columna, no la pantalla.

| Archivo | Columna | Quién lo sube | Módulo |
|---|---|---|---|
| VEP | `file_mm7d41zn` | el despachante | `aduana` |
| Comprobante de pago del VEP | `file_mm7d3jvj` | BERGER | `aduanaBerger` |

### 5.6 Operación · ACTUALIZAR CONTENEDORES - BERGER S.A.

**Qué hace.** Marca los contenedores que ya llegaron y les carga la ubicación de entrega. **Sólo
Administración** (módulo `aduanaBerger`).

**Por qué es una operación aparte.** Cuando la carga llega, el trabajo deja de ser por OP y pasa a
ser **por contenedor**: un camión llega y se descarga de a uno, con su propia entrega y su propio
arribo. Por eso esta pantalla entra por el tablero de 🚚 Contenedores y no por la OP.

**De dónde toma los datos.** 🚚 Contenedores (`18431711942`) completo —hasta 500 items, en una
consulta—, con sus espejos de la OP, más el tablero de Contactos para elegir transportista.

**Qué verifica antes de mostrar.**
- Por defecto, sólo los **pendientes**: los de una OP en etapa de arribo a los que les falta el
  arribo o la entrega. "Todos" está a un clic.
- El **arribo sólo se puede marcar** si la OP está en **Próxima a Arribar** o **Nacionalizado**
  (espejo `lookup_mm7d9537`). Antes de eso la mercadería está navegando: marcar un arribo ahí sería
  anotar un hecho que no pasó. La ubicación, en cambio, se puede cargar siempre —se define antes de
  que el barco llegue—.

**Sobre qué impacta.** 🚚 Contenedores:

| Dato | Columna |
|---|---|
| Estado de arribo | `color_mm7ar9rc` (*Arribado* / *Pendientes de Arribar*) |
| Fecha de arribo | `date_mm7dqnek` |
| Ubicación de entrega | `location_mm7a16dx` |
| Transportista | `board_relation_mm7axy2m` |

**Buscador.** Cubre las cuatro formas de nombrar un contenedor: su número (`text_mm7aye5e`), el
nombre del item, el N° de OP del despachante (`lookup_mm7d50jj`), el ID de la OP
(`lookup_mm7dq99y`) y el **chasis** de los tractores que lleva (`lookup_mm7ds57v`). Quien recibe el
camión tiene a mano la matrícula o el remito, casi nunca el número de trámite.

**Consideración · la fecha de arribo se propone, no se impone.** Al marcar el arribo la app carga
**hoy** y lo dice con todas las letras antes de guardar, porque es lo que pasa casi siempre: se
marca el día que llega. El campo queda editable justo abajo para el caso contrario —llegó el
viernes y se marca el lunes—, con tope en hoy: un arribo futuro no existe. Destildar el arribo
borra la fecha, para que no quede una fecha de algo que no pasó.

**Consideración · se guarda de a uno.** Cada tarjeta tiene su botón. Son decisiones independientes
—cada contenedor va a un lugar distinto— y guardar en bloque haría que un error en el tercero
dejara en duda a los otros cinco.

**Consideración · la ubicación y el transportista.** Igual que en 5.5: la dirección se elige del
buscador para que viaje con coordenadas, y el desplegable de transportistas está filtrado por la
categoría del tablero de Contactos.

### 5.7 Operación · DASHBOARD DE DESPACHOS

**Qué hace.** Lectura de conjunto del tablero del despachante. No escribe nada. **Sólo Administración
lo ve.**

**De dónde toma los datos.** 👮 Despachante de aduana, las mismas OP que la operación anterior.

**Qué muestra.**
- Una tarjeta por **estado de carga**, en el orden del circuito y con el color de ese estado.
- **Qué mirar hoy:** con ETA vencida, llegan esta semana (≤ 7 días), sin ETA cargada, sin N° de OP,
  **sin actualizar hace 7 días o más** (`pulse_updated_mm784qds`), y contenedores en curso.
- **Listas** de esas mismas OP y el reparto por país de origen.

**Las tarjetas se abren.** Tocar cualquiera despliega las OP de ese corte con su ficha completa y sus
**contenedores**: número, tractores que lleva, estado de arribo, transportista, ubicación, turno y el
chasis de cada tractor. Los contenedores se piden **sólo al abrir** y sólo de esas OP: traerlos todos
al cargar sería una consulta por OP para dibujar unos números que casi siempre se miran sin abrir
nada.

**Consideración.** Los cortes *sin ETA*, *sin N° de OP* y *sin actualizar* no son estadística: son
trabajo pendiente del propio despachante, y son los que hacen que el dashboard sirva para algo más
que mirar. Los totales se calculan sobre las OP que ya están en pantalla, sin una consulta aparte: el
número de arriba y la lista de abajo salen del mismo dato, así que no pueden contradecirse.

---

## 6. Ingreso y seguridad (transversal a todas las operaciones)

No es una operación del negocio, pero condiciona todas.

**Qué verifica, en orden, antes de mostrar nada:**

1. **¿Viene de monday?** La app corre dentro de un iframe y valida el `sessionToken` firmado. Abrir
   la URL del deploy en un navegador suelto no devuelve nada.
2. **¿De la cuenta de BERGER?** Se compara la cuenta del token (`36618349`).
3. **¿Está en la 🔒Lista Blanca?** Activo, con esta app habilitada.
4. **¿Pasó el segundo factor?** Google Authenticator (TOTP), **una vez por día calendario
   argentino**. Primera vez: QR + 10 códigos de recuperación. Los ADMIN pueden importar una clave que
   ya tienen (gestor de contraseñas del equipo).
5. **¿Qué módulos le corresponden?** Ver 1.3.

**Qué se registra.** Cada intento fallido queda en el 🔐Registro de Accesos con fecha, evento, email,
IP, usuario, cuenta y motivo.

**Consideración · mensaje único.** Cualquier rechazo muestra siempre lo mismo: *"No tenés acceso a
esta aplicación. Contactá al administrador."* Nunca revela si el usuario existe ni qué hay adentro.
El motivo real queda sólo en el registro.

**Consideración · el buscador de direcciones también pasa por el portón.** `api/geo.ts` es el
único endpoint que consulta un servicio de afuera (Nominatim/OpenStreetMap). Exige la misma sesión
que el proxy de datos y, además, el módulo `aduanaBerger`. Lo único que sale hacia afuera es el
texto de la dirección: ni el usuario, ni la cuenta, ni el contenedor, ni la OP.

**Consideración · el candado real está en el servidor.** El cliente **no arma consultas GraphQL**:
manda el *nombre* de una operación de un catálogo cerrado, y el servidor pone el texto y valida las
variables. Los ids de tablero de lectura los pone el servidor; en las escrituras, cada columna tocada
tiene que estar en la lista de escribibles de ese tablero **para ese módulo**. Dos módulos pueden
compartir tablero y escribir cosas distintas: sobre el Inventario, el circuito de pago mueve el
Estado Pago y el de fechas mueve las fechas, y ninguno puede escribir lo del otro.

---

## 7. Criterios de diseño comunes a todas las operaciones

Estos criterios se repiten en toda la app y explican por qué las pantallas se parecen entre sí.

1. **Lo irreversible va último.** En cualquier operación que dispare un correo, esa columna se toca
   **después** de que todo lo demás quedó escrito. Una vez que la automatización manda el mail, el
   destinatario ya lo recibió.
2. **Abortar sólo cuando no hay nada registrado.** Los primeros pasos (crear el item, subir el
   comprobante) abortan la operación. De ahí en adelante, los fallos se juntan como **advertencias**
   y se muestran: el registro ya existe, y esconder que un paso falló deja al usuario creyendo que
   cargó algo que no está.
3. **Escrituras de a una, nunca todo o nada.** Si la quinta falla, las cuatro anteriores ya quedaron
   bien y no hay nada que deshacer.
4. **Sólo se manda lo que cambió.** Vale para la actualización de OP: evita pisar datos que otra
   persona cargó mientras tanto.
5. **Nada bloquea en silencio.** Cuando algo impide continuar (un tractor sin confirmación, una OP
   sin cambios, un draft sin período), se dice **cuál** es y se ofrece quitarlo con un clic.
6. **Ninguna etiqueta en gris.** Todas las etiquetas llevan color, y el color sigue el avance del
   circuito: ámbar recién empezado, azul a mitad de camino, verde cerrado, rojo lo que está mal.
7. **Los filtros de monday van por índice, la decisión por etiqueta.** monday filtra los `status` y
   `dropdown` por índice; mandar el texto devuelve una lista vacía sin error. La app filtra por
   índice para traer menos filas y **vuelve a comparar la etiqueta** en el cliente, así que si cambia
   el orden de las etiquetas trae de más y filtra bien, en vez de mostrar lo que no corresponde.
8. **Los importes nunca se suman entre divisas.** Si un corte mezcla EUR y USD, se informa la
   cantidad y se calla el importe.
9. **Las listas se traen enteras y se filtran en el navegador.** Son tableros que crecen de a una
   fila por operación: filtrar localmente es instantáneo y no cuesta un viaje a monday por tecla.
10. **Todo funciona en el celular**, porque la app se usa desde la aplicación móvil de monday.

---

## 8. Resumen por tablero: qué escribe la app y desde dónde

| Tablero | Columna | Valor que escribe | Operación |
|---|---|---|---|
| 🧾 Drafts | `dropdown_mm70awrf` | período elegido | Planificar Período |
| 🧾 Drafts | `color_mm6zdmzr` | `Periodo Prod Planificada` | Planificar Período |
| 📬 Planificación | item completo + `color_mm73xw6w` = `Enviar` | — | Enviar Planificación |
| 📬 Confirmación | `color_mm6ss2d2` | `Enviar` | Enviar Confirmación |
| 🚜 Inventario | `color_mm6s8xp2` | `Fecha Confirmada` / `Fecha a Confirmar` | Confirmar / Proponer |
| 🚜 Inventario | `color_mm6sc76v` | `Aceptada` / `Nueva Fecha Propuesta` | Confirmar / Proponer |
| 🚜 Inventario | `date_mm6n11kn` | fecha propuesta | Confirmar / Proponer |
| 🚜 Inventario | `color_mm6v6532` | `Transf Cargada` → `Transf Aprobada` → `Pagado` / `Pendiente de Pago` | Pagos Despacho |
| 🚜 Inventario | `color_mm6n109a` | `En Despachante` | Etapa 3 y Pago Vista |
| 💸 Pagos | item completo, estados, fechas, archivos, reporte, avisos | — | Pagos Despacho |
| 💸 Subelementos de Pagos | un subitem por tractor | — | Etapa 1 y Pago Vista |
| 👮 Despachante | item completo + subitems | — | Etapa 3 y Pago Vista |
| 👮 Despachante | los 8 campos del despachante | lo que cargue | Actualizar Despacho OP - DESPACHANTE |
| 👮 Despachante | los 4 comprobantes del trámite **más el VEP** (`file_mm7d41zn`) | archivos | Actualizar Despacho OP - DESPACHANTE |
| 👮 Despachante | `file_mm7d3jvj` | comprobante de pago del VEP | Actualizar OP - BERGER |
| 👮 Despachante | `color_mm793phx` | lo que defina BERGER (la app NO lo toca al crear) | Actualizar OP - BERGER |
| 👮 Despachante | pago, fondeo, banco y VEP | lo que defina BERGER | Actualizar OP - BERGER |
| 👮 Despachante | update + notificaciones | aviso a Sofía y Micaela | al pasar a "Próxima a Arribar" |
| 🚚 Contenedores | item completo: nombre por modelo, N°, `date_mm7dxh72`, tractores y OP | — | Armar contenedores |
| 🚚 Contenedores | `location_mm7a16dx` y `board_relation_mm7axy2m` | entrega y transportista | Actualizar OP - BERGER · Actualizar Contenedores |
| 🚚 Contenedores | `color_mm7ar9rc` y `date_mm7dqnek` | `Arribado` + fecha de arribo | Actualizar Contenedores - BERGER |
| 🚚 Contenedores | `date_mm7a8jds` | turno de carga (día y hora) | Actualizar Fecha de Carga - DESPACHANTE |

**Lo que la app NUNCA escribe:** importes y datos leídos del PDF de los drafts, el Catálogo de
Productos, el tablero de Contenedores, y cualquier columna fuera de las listas de arriba.

---

## 9. Pendientes conocidos al 17/09/2026

- **Origen y destino del reporte al despachante:** el origen ya sale del puerto del Catálogo; el
  **destino** todavía se escribe a mano en el cuerpo del mail.
- **Criterio de puerto único:** cuando un modelo alemán figura con Bremerhaven y Hamburgo se cargan
  los dos, porque no está definido cómo elegir.
- **Despachos anteriores a esta versión:** los items ya creados en 👮 Despachante de aduana no tienen
  puerto de origen cargado; se completa a mano.
- **Dashboard de fechas de producción:** no existe. Los otros dos módulos sí tienen el suyo.
- **Coordenadas de la ubicación de entrega:** *resuelto*. La dirección se elige de un buscador
  (Nominatim/OpenStreetMap, por `api/geo.ts`) y viaja con sus coordenadas reales. Sigue en 0 sólo
  cuando se escribe una dirección que el buscador no encuentra, y la pantalla lo avisa.
- **Menciones en los updates:** *resuelto*. Van en `mentions_list` de `create_update`, que existe
  desde la versión 2025-07 de la API; esa operación —y sólo esa— declara su propia versión. Lo que
  monday descarta es el marcado escrito dentro del `body`, que era el camino anterior. Las
  notificaciones personales quedaron como respaldo por si el update falla.
