# Cómo está hecha la app Gym

Para quien vaya a cambiar algo (Martin o un chat nuevo). Lo que está aquí lo cuidan las revisiones automáticas: si lo
rompes, GitHub te avisa antes de publicar.

## Las piezas

| Pieza | Qué es | Dónde |
|---|---|---|
| App (PWA) | HTML + JavaScript sin compilar, en GitHub Pages | este repo, `main` → https://martinrtx.github.io/Gym/ |
| APK | cascarón de Capacitor que carga la misma página (más avisos, widgets, Health Connect) | `apk/` |
| Servidor | Apps Script que lee y escribe tu hoja de Google | repo privado `MartinRTX/Gym-script` |
| Motor | la cuenta de "la siguiente serie" (`motor.js`); la hoja usa la misma, generada en `script/Progresion.gs` | este repo |
| Panel | otra app que lee lo de Gym con la acción `panel` (contrato en `Gym-script/tests/contrato-panel.json`) | `MartinRTX/Panel` |

## Los archivos de la app, en el orden en que se cargan (index.html)

Son *scripts clásicos*: todos comparten los mismos nombres globales (~880). Por eso el orden importa al cargar, y por
eso hay revisiones que cuidan nombres repetidos, mal escritos y de más (abajo).

| Archivo | Qué hace |
|---|---|
| `seguridad.js` | política de seguridad (nada de JS dentro del HTML) |
| `motor.js` | **puro**: siguiente serie, progresión, calentamiento (pruebas en `tests/motor.test.js`) |
| `nutricion.js` | **puro**: macros, recetas, tupper, etiquetas, búsqueda, metas (`tests/nutricion.test.js`) |
| `comida.js` | comida 1/3: registros del día, editar, recetas, cena, tupper y metas |
| `comida-buscar.js` | comida 2/3: buscador (catálogo, tus productos, Open Food Facts) y "¿cuánto comiste?" |
| `comida-foto.js` | comida 3/3: cámara, etiqueta, código de barras y "Revisa el producto" |
| `animaciones.js` | **puro**: la figura que hace cada ejercicio |
| `app.js` | el núcleo: utilidades, plantilla `html\`…\``, eventos `on()`, `LS` y `ALMACEN`, API y cola sin señal, arranque |
| `entrenar.js` | pantalla de Entrenar: pareja, hoy, peso, cintura, tarjeta del ejercicio |
| `series.js` | series: plan del día, teclado, guardar, cambios de equipo, superserie |
| `sesion.js` | resumen de la sesión, recorrido, botón atrás, descanso |
| `trote.js` | trotes y plan de carrera |
| `comida-dia.js` | pantalla de Comida: proteína por comida, avisos, pasos, comida con IA, dictado |
| `coach.js` | chat con la IA |
| `progreso.js` | progreso 1/3: ritmo de peso, mapa muscular, fotos y gráficas |
| `maquina.js` | progreso 2/3: foto de una máquina → qué ejercicio es |
| `ruta.js` | progreso 3/3: ruta de hoy, descarga anticipada, quién hace qué en pareja, músculos de hoy |
| `ajustes.js` | bienvenida, ajustes y diagnóstico |
| `inicio.js` | botones sueltos y arranque (va al último) |

Para ver quién usa a quién: `NODE_PATH=/opt/node-tools/node_modules node herramientas/mapa.js`.

## Cómo se conectan

- **Botones**: `on('accion', args…)` pone `data-click` en el HTML y un solo escuchador llama a la función global con ese
  nombre. Solo las acciones que la app pidió con `on()` se pueden llamar (`ACCIONES_OK`).
- **HTML**: siempre con la plantilla `` html`…` `` (escapa sola). Nada de `innerHTML = '<…'` a mano.
- **Lo que manda la hoja**: `DATA` (se guarda en el celular para abrir sin señal).
- **Lo que mandas a la hoja**: `encolar(acción, args)` → cola en el celular → se sube en lotes (`enviar()`), con el
  identificador del celular (`gym_disp`).
- **Lo que se guarda en el celular**: solo con `LS`, y cada clave anotada en `ALMACEN` (app.js) con lo que guarda.

## Lo que se revisa solo (GitHub, en cada push; sin verde no se publica)

| Revisión | Qué atrapa |
|---|---|
| `node herramientas/revisar.js` | sintaxis; nombres repetidos entre archivos; versión de app = service worker; el service worker guarda todo; solo `LS` toca localStorage y toda clave está en `ALMACEN`; todo el HTML con la plantilla; `tsconfig.json` con los mismos archivos que `index.html` |
| `npx -y -p typescript@6.0.2 tsc -p tsconfig.json` | **revisión de tipos de toda la app**: nombres mal escritos entre archivos, llamadas con argumentos de más. TypeScript solo revisa; la app sigue siendo JavaScript |
| `node --test tests/*.test.js` | motor, nutrición, service worker, animaciones (91) |
| `node tests/e2e/correr.js` | la app en Chromium con la hoja simulada (347 casos) |

A mano, antes de mover código: `NODE_PATH=/opt/node-tools/node_modules node herramientas/comparar-pantallas.js [ref]`
corre las pruebas de pantalla contra la versión de antes y contra la tuya y enseña cualquier cosa que se pinte distinto.

## Cómo agregar…

- **un archivo**: en `index.html` (en su lugar del orden), en `ARCHIVOS` de `sw.js` y en `files` de `tsconfig.json`;
  sube `VERSION_APP` (app.js) y `VERSION` (sw.js). Si partes uno, revisa los cortes:
  `NODE_PATH=/opt/node-tools/node_modules node herramientas/mapa.js cortes archivo.js <línea> …`.
- **una clave del celular**: anótala en `ALMACEN` con lo que guarda. Si es por día, que lleve `_AAAA-MM-DD`.
- **un botón**: `on('miAccion', …)` y una `function miAccion(…)` global.
- **una acción del servidor**: en `Gym-script` (lista de `api_` o de `batch_`), con su prueba en `Gym-script/tests`.

## Por qué no (todavía) módulos ES

Pasar a `import`/`export` haría explícito qué usa cada archivo, pero hoy no conviene: los botones buscan su función por
nombre global (`on()`) y las pruebas de pantalla llaman funciones globales en 124 lugares. Habría que cambiar todo eso a
la vez para que, por fuera, la app quede igual. Lo que da casi el mismo beneficio sin ese
riesgo ya está: la revisión de tipos ve todos los archivos juntos y avisa de cualquier nombre que no exista.
Si algún día se hace, el orden sería: primero `motor.js`, `nutricion.js` y `animaciones.js` (ya son puros), después
los que no pintan pantalla, y al final cambiar `on()` para que reciba la función en vez del nombre.

## Lo que sigue para ordenar más (de mayor a menor beneficio)

1. `entrenar.js` ↔ `series.js` se usan mucho entre sí (154 usos de entrenar desde series): juntar lo de la tarjeta del
   ejercicio en un solo lugar.
2. `app.js` mezcla utilidades, API, cola y arranque: separar la API y la cola sin señal en `datos.js`.
3. Anotar con JSDoc la forma de `DATA` (lo que manda la hoja): así la revisión de tipos también atrapa campos mal escritos.
