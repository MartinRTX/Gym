# Pendientes y contexto (para seguir en un chat nuevo)

Actualizado: 05/11/2026. Pega este archivo (o su link) al empezar un chat nuevo.

## Dónde está todo

| Pieza | Dónde | Estado |
|---|---|---|
| App Gym (PWA) | repo público `MartinRTX/Gym`, Pages en https://martinrtx.github.io/Gym/ | **v10.4 publicada** (05/11); `main` = rama de trabajo |
| Rama de trabajo | `claude/fitness-app-visual-design-x9iz7n` | Publicar = adelantar `main` a esta rama, **solo cuando Martin diga "publica"** |
| APK Gym | carpeta `apk/` (Capacitor, carga la URL de Pages) | Compilación 21, firma verificada por el workflow |
| Apps Script de Gym | repo **privado** `MartinRTX/Gym-script` (`src/AppGym.js`, `src/Maquina.js`, `src/Código.js`) | **8.6 publicado** (03/11); `main` = rama de trabajo |
| Panel | repo público `MartinRTX/Panel` (Pages /Panel/, APK propia) | **1.6 publicada** (03/11); `main` = rama de trabajo |

Versiones que deben ir juntas: `VERSION_APP` en `app.js` = `VERSION` en `sw.js` (`herramientas/revisar.js` falla si no).
`SCRIPT_ESPERADO` (en `app.js`, junto a `VERSION_APP`) ≤ `SCRIPT_VERSION` en `AppGym.js`. El `versionName` del APK sale de `VERSION_APP`.

## Reglas que no cambian

- La API key de Gemini solo en Script Properties. `AppGym.gs` nunca al repo público.
- Nunca imprimir ni subir la clave de la app, el id de la hoja, ni `.clasprc.json` (la credencial de clasp).
- Datos personales reales nunca al repo: las pruebas usan `tests/e2e/datos-prueba.json` (ficticio).
- Pedir confirmación antes de borrar datos y antes de hacer un cambio grande.
- Antes de compilar el APK: confirmar que se firma con la MISMA keystore (el workflow verifica el SHA-256). La keystore nunca va al repo.
- Decisiones de Martin: la licencia de los datos INCMNSZ y la credencial de clasp se quedan como están.

## Cómo probar

```bash
node herramientas/revisar.js            # versiones, sin onclick en texto, todo el HTML con la plantilla, etc.
node --test tests/*.test.js              # 82 pruebas de lógica
NODE_PATH=/opt/node-tools/node_modules node tests/e2e/correr.js [filtro]   # 316 pruebas de pantalla (Playwright)
NODE_PATH=/opt/node-tools/node_modules node herramientas/comparar-pantallas.js [ref] [filtro]   # antes y después: ¿se pinta igual?
```

En GitHub corren solas: "Pruebas" (revisar + unidad + pantalla), "APK Android" (desde `main`) y Pages.
En Gym-script: "Publicar script" (revisa en todas las ramas; en `main` hace `clasp push`, versión nueva,
actualiza la MISMA implementación y prueba que conteste "Clave incorrecta").

## Cómo publicar (cuando Martin diga "publica")

Pendiente de publicar: **Gym v10.5** (rama `claude/affectionate-cannon-ymlofy`). Gym-script y Panel: `main` al día.
Orden cuando haya cambios:

1. Gym-script: rama → `main`. Primero el script (si la app pide un `SCRIPT_ESPERADO` nuevo).
2. Gym: rama de trabajo → `main`. Al abrirla, el celular baja la versión nueva completa y recarga una vez.
3. Panel: rama → `main`.

✅ Script de Comidas con clasp (03/11): propiedad `CLAVE` puesta y `COMIDAS_SCRIPT_ID` en `Gym-script/.github/workflows/comidas.yml`.
Se publica solo desde Panel/main (cada 3 horas o a mano, "Publicar Comidas (Panel)"): nunca pegarlo a mano.
✅ Panel 1.7 (04/11): hábitos, objetivos de la semana, revisión del domingo y avisos (Panel.apk nuevo); script de Comidas 2
(pestañas Hábitos y Objetivos); Gym-script manda `resumen.diasSemanas` para la revisión.

## v10.5 (en la rama, 06/11): productos con porción de varias piezas

- Open Food Facts (y etiquetas) con porción de varias piezas ("2 piezas (62 g)", "3 galletas"): ahora también traen **1 pieza**.
  Antes "1 mantecada" y "Guardar y agregar 1 porción" contaban la porción entera (2 piezas: el doble de calorías).
  `NUT.piezasDePorcion`; `cantidadDeTexto` prefiere la pieza; "Revisa el producto" dice cuánto es 1 pieza y agrega una.
- Producto sin porción y escribiste cuántas ("1 mantecada"): se queda en 100 g pero avisa que pongas los gramos (`NUT.diceCuantas`).
- Lo que ya se guardó como producto con la porción vieja no cambia solo: se corrige volviéndolo a buscar o editando la cantidad.
- Pruebas: 3 en `nutricion.test.js` y `tests/e2e/mantecada-v105.prueba.js` (7).

## v10.4 (publicada 05/11): arreglos de la auditoría (3, 5, 6, 7, 8, 9)

- Tope de tiempo en todas las llamadas a la hoja (120 s) y en la subida de la cola (60 s); se reintenta sola.
- Guardado persistente al abrir; miniaturas con CORS primero (`bajarMedia` en `sw.js`).
- Zona de toque de ~44 px en enlaces y el ▶ de técnica; etiquetas en la lista de la gráfica, las fechas y la nota de hoy.
- Fuera datos personales del repo (comentario de `trote.js` y detalles de comidas en este archivo) y código sin uso.
- Pruebas: `tests/sw.test.js` (3) y `auditoria-v104` (6; fallaba en la v10.3). `comparar-pantallas` contra la v10.3: lo único
  distinto son las etiquetas nuevas (`aria-label`).

## v10.3 (publicada 05/11): la plantilla queda vigilada

- `revisar.js` (corre en cada push) falla si alguien vuelve a armar HTML a mano (`innerHTML = '…<…'`), usa `esc()` fuera de
  `app.js`/`coach.js`, o mete texto con comillas o `<` dentro de `${…}`. Se probó metiendo a propósito los dos errores de la v10.1.
- El ícono de Coach de la barra también pasó a la plantilla (se ve igual; lo confirmó `comparar-pantallas`).

## v10.2 (publicada 05/11): toda la app con la plantilla

- `series.js` (series, menú ⋮, cambiar ejercicio, superserie, teclados, pareja) y `comida.js` (buscador, recetas, tupper, cenas,
  etiquetas, producto, metas) con la plantilla. **Ya ningún archivo arma HTML a mano**: lo que queda con `'<…'` son cierres de
  etiquetas, íconos fijos y el formato del chat (que escapa primero). Comparado contra la v10.1: idéntico.
- **`herramientas/comparar-pantallas.js`**: saca una versión de git (`HEAD` por defecto), corre las MISMAS pruebas de pantalla
  contra esa y contra la carpeta, registra todo lo que se pinta y enseña las diferencias (sale con error si hay). Úsala en cualquier
  cambio que no debe verse distinto. Ruido conocido: la barra del descanso (ya se ignora) y a veces el anillo en comida-v97.
- Arreglo: cerrar el buscador justo después de escribir (o cuando terminaba de cargar el catálogo) daba un error
  («Cannot read properties of null»): la repintada pendiente ya revisa que siga abierto.
- `plantilla.prueba.js`: 18 hojas y teclados más (28 casos).

## Auditoría (05/11, v10.3) — ✅ 3, 5, 6, 7, 8 y 9 arreglados en la v10.4; faltan 1, 2, 4, 10 y 11

Prioridad alta:
1. Consejo entre series sin respuesta el 20 % de las veces (ver "Pestaña IA"): ligero primero en Gym-script (falta el sí).
2. 2FA en GitHub: el APK carga la página de Pages y tiene acceso a Health Connect y avisos; quien entre a la cuenta de GitHub
   controla lo que corre en el celular. Pasa de "opcional" a recomendado.
Prioridad media:
3. ✅ v10.4: la subida de la cola no tenía tiempo máximo (se quedaba en "Subiendo…"). Ahora `apiPost` corta a los 120 s
   (`LIMITE_API`) y la subida a los 60 s (`LIMITE_SUBIDA`) con AbortController; se reintenta sola a los 20 s.
4. Valores de Martin fijos para todos: FC fácil ≤ 150 y ritmo fácil 6:50/km (`trote.js`), clima de Hermosillo. Para la pareja
   u otra persona no aplican. Mover a Ajustes o calcularlos de sus datos (decisión de Martin).
5. ✅ v10.4: datos personales en el repo público (el comentario de calibración de `trote.js` y detalles de comidas de días
   reales en este archivo) quitados. El historial de git los conserva.
6. ✅ v10.4: la app pide guardado persistente al abrir (`pedirGuardadoPersistente`) y el service worker baja las miniaturas
   con CORS primero (`bajarMedia`; solo si el sitio no lo permite van "opacas", que Chrome cuenta como ~7 MB cada una).
Prioridad baja:
7. ✅ v10.4: zona de toque invisible de ~44 px en todos los enlaces y el ▶ de técnica (`::after` en `app.css`, no mueve nada);
   etiquetas en la lista de la gráfica de fuerza, las fechas (carrera, bienvenida, otro día) y la nota de hoy. Los ejes de las
   gráficas siguen a 10 px (más grandes se encimarían).
8. ✅ v10.4: quitados `ajustarItem` y las variables `jsq(…)` sin uso (la de `cuerpoEjercicio` sí se usa y se queda).
9. ✅ v10.4: el comentario de `regGuardar` ya dice lo que hace (borra por antigüedad, 120 días).
10. APK: sin `package-lock.json` (las dependencias de las dependencias pueden cambiar entre compilaciones) y las acciones de
    GitHub van por etiqueta (@v4), no por commit.
11. Revisar en Gym-script que un lote repetido (si se pierde la respuesta y se reenvía) no duplique renglones (ignorar ids ya vistos).
Lo que está bien: todo el HTML escapado por la plantilla (vigilado), CSP en Chrome, lista blanca de acciones, links filtrados,
clave en el cuerpo (no en la URL), sin secretos en el repo, firma del APK verificada, service worker todo o nada, una sola capa de
guardado con limpieza al llenarse, cola con reintentos. Carga ~0.2 s, cada pantalla se pinta en ~1 ms, ~1,200 nodos, 34 KB de
localStorage; todos los botones con nombre y sin desborde horizontal.

## Pestaña IA: primera revisión (05/11, datos del 02 al 04/11)

- **Comida, fotos y etiquetas con el ligero primero (v9.7) van bien de tiempo**: desde el 03/11, 7 consultas, 6 contestaron en
  1–17 s (casi todas en 1–3 s); 1 falló porque los 3 modelos estaban ocupados y al reintentar contestó en 1 s. Antes (02/11) las
  etiquetas con el completo tardaban 88–280 s. Calidad: una estimación por foto del ligero salió con la proteína inflada.
- **El modelo completo casi nunca contesta**: 429 (se acabó la cuota del día) o 503 (mucha demanda). Cuando da 503 tarda en fallar
  y ya no queda tiempo para el ligero.
- **El consejo entre series ("serie") sufre**: sigue probando primero el completo. 49 consultas el 03 y 04/11: 10 sin respuesta
  (20 %) tras esperar 25–155 s, y varias que sí contestaron tardaron 20–60 s (el consejo llega cuando ya hiciste la serie).
  Lo mismo con plan (10–30 s), chat (18–22 s) y el resumen de la sesión (1 falló).
- Propuesta (falta el sí de Martin; es en Gym-script): ligero primero también en serie, plan, chat y resumen, y el completo
  solo de respaldo; o en "serie" solo el ligero con tope corto. Volver a revisar la pestaña después.

## v10.1 (publicada 05/11): plantilla en Comida, Entrenar y Progreso

- `app.js` (aviso de abajo y errores de la hoja), `comida-dia.js`, `entrenar.js` y `progreso.js` (Músculos y gráficas incluidos)
  con la plantilla. Martin pidió los 3 de una vez.
- **Comparación nueva** (más completa que estados a mano): se corren las pruebas de pantalla registrando cada HTML que la app
  pinta (innerHTML / insertAdjacentHTML), con la versión anterior y la nueva, y se comparan por archivo de prueba. Dos corridas de
  la misma versión difieren solo en 2–4 pintadas (la barra del descanso y una carrera del anillo): ese es el ruido.
- Dos trampas nuevas (las detectaron las pruebas): un texto con comillas dentro de `${…}` también se escapa
  (`${ojo ? ' class="grande"' : ''}` salía `&quot;`: usar ``html` class="grande"` ``), y `html`a` + html`b`` dentro de un ternario
  de otra plantilla sale como texto. `plantilla.prueba.js` revisa Comida, Entrenar, Progreso y Músculos.
- Arreglo: en "¿Quién lo hace normalmente?" (pareja) una variable local `on` tapaba `on()` y los 3 botones no hacían nada.

## v10.0 (publicada 05/11): plantilla en Ajustes

- `ajustes.js` completo con la plantilla: bienvenida, Ajustes, Diagnóstico (Lo que falló ya la usaba). Los íconos de Ajustes
  (`svgA`/`AIC`) ya son `crudo(…)`; tarjetas repetidas con `tarjeta(…)`. Comparado contra la v9.9 en 51 estados (navegador y APK,
  datos normales y raros): idéntico. La prueba de la plantilla ahora es `plantilla.prueba.js` (crece con cada archivo).
- Después de v9.9 sigue v10.0 (como de v8.9 a v9.0); nada compara `VERSION_APP` como número.

## v9.9 (publicada 04/11): plantilla en 3 archivos y avisos de Comida

- **Plantilla ``html`…` ``** en `coach.js`, `trote.js` y `sesion.js` (todo lo que pintan). Comparado contra la v9.8 en 38 estados:
  con datos normales el HTML sale idéntico carácter por carácter; con datos raros lo único distinto es la fecha de las salidas de
  trote (`t.d`), que antes iba sin escapar. Prueba `plantilla`.
- **Ojo al pasar más archivos**: ``html`a` + html`b` `` ya es TEXTO (un `+` de dos plantillas da un string); si eso se mete en otro
  `${…}` se escapa y sale "<div…" en pantalla. Lo que se arma en varios pedazos y va dentro de otra plantilla: `crudo(…)`.
  La prueba `plantilla` revisa que no salgan etiquetas como texto.
- **Avisos de Comida** (`avisosItem` en `comida.js`): una receta o un tupper se revisa ingrediente por ingrediente con sus gramos
  (antes el total, sin gramos: un licuado de más de 60 g de proteína salía "¿es algo seco o en polvo?"); tus recetas y el tupper no se
  marcan por pasar de 900 kcal (lo de la IA sí). `NUT.revisarMacros(m, gramos, nombre)`: si el nombre dice polvo/seco/whey/scoop,
  mucha proteína por gramo es lo normal (las otras revisiones siguen). Prueba `comida-v99`.
- Mi licuado: Martin ajusta las cantidades en Comida › Mi licuado (pendiente: pesar los ingredientes).
- ✅ Comidas de la IA que no cuadraban: corregidas en la hoja el 04/11 con el sí de Martin (pestañas Comidas y Peso diario).
  En el celular esos días siguen con lo viejo; si se editan ahí, el celular vuelve a mandar sus números a la hoja.
- Al corregir la hoja a mano: leer el renglón JUSTO antes de escribir (el 04/11 se escribió un renglón abajo y hubo que regresarlo).

## v9.8 / script 8.6 / Panel 1.6 (publicado 03/11/2026)

- **Service worker todo o nada**: los archivos de la app salen SOLO del caché de su versión; una versión nueva se baja
  completa en `install` cuando cambia `VERSION` de `sw.js`. Ya no se pueden mezclar archivos de dos versiones.
- **Contraste** (`CSS_V98`, ahora al final de `app.css`): textos chicos y botones activos ≥ 4.5:1 en claro y oscuro
  (prueba `contraste-v98` revisa 10 pantallas en los dos temas).
- **Escapado**: prueba `escapar-v98` mete HTML en todo lo que viene de afuera (hoja, IA, catálogo) y revisa 15 pantallas.
- **app.js partido** (mismo código, revisado sentencia por sentencia): `app.js` (núcleo: utilidades, APK, configuración,
  cola, arranque, `VERSION_APP`, `SCRIPT_ESPERADO`), `entrenar.js`, `series.js`, `sesion.js`, `trote.js`, `comida-dia.js`,
  `coach.js`, `progreso.js`, `ajustes.js`, `inicio.js` (acciones y `arrancar()`, va al último). Los estilos que se metían
  con JS (`CSS_V53…CSS_V98` y los de `comida.js`) están en **`app.css`** (estilos calculados idénticos en 10 pantallas × 2 temas).
  Nada de lo que corre al cargar usa algo de un archivo posterior; si se agrega código "suelto" (fuera de funciones),
  cuidar el orden de `index.html`.
- **Una sola capa de guardado**: solo el bloque `LS` de `app.js` toca localStorage (`LS.claves()` para recorrer).
  `revisar.js` falla si otro archivo lo usa directo, o si `sw.js` no guarda algo que carga `index.html`.
- `catalogo.py` verifica la huella sha512 del paquete npm `tempo-food-db` (si cambia, no toca el catálogo).
- Script 8.6: si la celda W1 del Catálogo está vacía escribe "Tempo" (con nota de cómo llenarlo).
- Panel 1.6: semana de carrera igual que Gym (descarga, víspera y día de carrera descansan); la fecha sale de Gym.
  Sin `onclick` en texto (`clic('fn', …)` / `alEscribir`), sin script en línea, y en Chrome CSP con `script-src 'self'`.
  `Comidas.gs` lee la clave de Propiedades del script (`CLAVE`), con la línea del código como respaldo.
- CSP en el APK de Gym: **no se puso**. Solo podría llevar `'unsafe-inline'` (el puente de Capacitor es un script en línea),
  y así no frena el JS inyectado, que es el riesgo real; a cambio, si bloquea algo de Capacitor, se rompen Health Connect,
  avisos o widgets sin poder probarlo aquí. Lo que sí protege (todo escapado + prueba `escapar-v98`) ya está.

## v9.0 / script 8.0 (publicado 30/10/2026)

App y script van juntos: al publicar, adelantar `main` de Gym **y** pasar la rama del script a `main` de Gym-script.

- Buscador tolerante (`NUT.buscar`): ignora porciones ("rebanada", "scoop", "dos"), sinónimos ("coca" → refresco de cola),
  corrige errores de dedo con el vocabulario del catálogo, no exige todas las palabras. 7 platillos nuevos en `BASE` (chilaquiles, taco de asada…).
- IA de comida: modelo completo pensando (bajo), con reglas de porciones en el prompt ("1 rebanada" ≈ 110 g, nunca la pizza entera)
  y memoria de 6 h para lo mismo escrito igual; tope de tiempo entre modelos. La app enseña sugerencias del catálogo mientras
  piensa, los segundos que lleva, espera 30 s y si la respuesta llega tarde (hasta 1 min más) la muestra sola.
  Si tarda > 15 s lo anota en Errores ("Aviso: …") para medir. (Martin prefirió precisión a velocidad: no usar el modelo ligero.)
- Cantidad desde el texto (`NUT.cantidadDeTexto`): "4 rebanadas de pizza" → 4 × 107 g; "150 g" tal cual; "media taza" = la porción de 1/2 taza.
- Arreglo: tocar una sugerencia en la tarjeta de la IA no abría nada (la hoja se pintaba escondida).
- Hoja Comidas: recetas y tupper van un renglón por ingrediente con la columna nueva "Parte de"; el script los vuelve a juntar
  al mandarlos a la app (`juntarPartes_`). Recetas de antes sin ingredientes: si la receta no cambió, se sacan de ahí.
- Pendiente después de publicar: revisar en Errores los "Aviso: la IA de comida tardó…" para ver si sigue lenta y con qué modelo.

## v9.2 / script 8.2 (publicado 30/10/2026)

- Etiqueta + nota: la IA (`etiquetaIA_`, `fotoIA_`) solo copia la tabla (declarada por 100 g / porción / ambas, porción en g y piezas,
  porciones por envase, columna "por envase", contenido neto) y lo que dijiste (`consumo`); **todas las cuentas en la app**
  (`NUT.leerEtiqueta`, `gramosDeConsumo`, `gramosDe`). Si falta el envase y pides todo/la mitad, la vista previa lo pide.
- Vista previa (`abrirEtiqueta`): cantidad en g/ml, piezas, porciones o parte del envase con macros al instante; actualiza el
  producto si ya lo tienes (`NUT.mismoProducto`); 📷 en el Registro inteligente (foto + lo escrito) y texto de tabla pegado.

## Comida: lo que falló con datos reales (revisado 02/11) — puntos 1–6 hechos y publicados (v9.3 / script 8.3)

Encontrado en la hoja (Comidas y Errores):
- **Proteína inflada**: un guisado con soya en el buscador eligió *Soja (Soya) Frijol, Proteína* (proteína de soya SECA,
  47.6 g/100 g) y casi quintuplicó la proteína. Y la IA puso a una grasa 2 veces su peso en proteína (imposible).
- **Catálogo mexicano con fichas engañosas**: *Leche De Vaca, Entera* trae 29 g de proteína y 504 kcal por 100 g (es leche en polvo).
  No hay mantequilla en los básicos; "pan birote" no encuentra el bolillo.
- **La IA sigue tardando** con el modelo completo (2 veces en un día). No hay ningún
  "Aviso: tardó" (o contesta rápido o no contesta), así que falta saber dónde se va el tiempo.
- **Etiquetas difíciles**: el galón de leche trae la información escrita en renglones (no en tabla) y en superficie curva.

Mejoras propuestas (en orden):
1. **Revisión de sentido común antes de agregar** (app): proteína + carbos + grasa no puede pasar del peso; kcal ≈ 4P+4C+9G;
   más de 40 g de proteína en un solo alimento del catálogo pide confirmar. Lo que no cuadre sale marcado para corregir.
2. **Catálogo más seguro**: fichas que por sus números son secas o en polvo (P+C+G > 80 g por 100 g sin decir "polvo/seco/deshidratado")
   se marcan "seco o en polvo" y bajan en la búsqueda. Básicos nuevos: mantequilla, frijoles con soya (refritos con soya
   texturizada), sinónimos birote/telera → bolillo, atún en lata por marca (Mazatún, Dolores, Tuny) por lata.
3. **"El dato que sé manda"**: escribir "lata de atún Mazatún con 12 g de proteína" → la IA respeta los 12 g y estima lo demás;
   cada cosa de la respuesta se puede tocar para corregir gramos, proteína, carbos, grasa y kcal (hoy solo ±2 g de proteína) y confirmar.
4. **Medir la IA**: el script anota cada consulta (duración, modelo que contestó, modelos que fallaron) en una pestaña "IA";
   con eso se decide el orden de modelos. Si un modelo del arreglo ya no existe, se quita.
5. **Etiquetas difíciles**: hasta 3 fotos de la misma etiqueta (galón: frente, costado, atrás); el texto en renglones
   ("Contenido energético 61 kcal, proteínas 3.1 g…") ya se acepta; "galón" = 3,785 ml como envase; y un formulario corto para
   escribir los números de la etiqueta a mano cuando la foto no sirve.
6. ✅ **Corregido en la hoja** (Martin lo pidió) lo de ese día. En el celular ese día sigue con lo viejo hasta que se borre o se
   edite (la hoja ya está bien).

## v9.4 / script 8.4 / Panel 1.5 (publicado 02/11/2026): los 7 de Comida

1. Tocar algo de "Hoy comiste" → corregir (½, ×1½, ×2, cantidad o cada macro) o quitar (`abrirItemDia`). Va a la hoja al guardar.
2. "Sueles comer en …": lo que anotaste 2+ veces en esa comida en 3 semanas y hoy falta (`sugerenciasHora`).
3. "📅 Repetir una comida de otro día" (últimos 7 días, por comida). Las recetas se recalculan con la receta de hoy.
4. Aviso a las 9 pm si faltan o sobran más de 350 kcal (id 96, interruptor `avisoKcal` en Ajustes).
5. Mantenimiento real = kcal promedio registradas − cambio de peso × 1,100 (`NUT.mantenimientoReal`): en Metas, en Panel
   (`metasGym.mantReal`, con 5+ días) y en el reporte del domingo.
6. "💾 Guardar como receta" lo que contestó la IA: cada cosa queda como producto y la receta sale en Mis comidas (se quita con Editar).
7. Cosas de más de 900 kcal salen ⚠️ en el día y en la respuesta de la IA.

## v9.5 (publicada 03/11 con la v9.6): diseño y textos

- Un solo color para lo que se toca (`--act`: cian #0E7490 en claro, #22C3E6 en oscuro, contraste ≥ 4.5:1); el color del día
  (`--dia`) solo en el nombre grande, el rack y las pestañas de grupo. `--rut` ahora es el color de acción (`CSS_V95`).
- Textos: "✓ Guardado", "Ejercicios hechos hoy", "Recomendados para hoy / Otros ejercicios del plan", "Lo importante hoy",
  "Alternado", "Sube peso" (en la línea de abajo), sin RIR ni "reserva"; encabezado con lo que trabaja el día (sin "bloque").
- Músculos: `zn()` corto y `znL()` con el técnico entre paréntesis (solo al mostrar; claves sin cambio).
- "Siguiente · Empezar" en la primera tarjeta pendiente (no en modo sencillo, ni con algo abierto o en curso, ni en la búsqueda).
- Pareja: con la tarjeta abierta no se repite "Tú 0/4 · …" (está en las pestañas).
- Arreglos: "Descartar" de la IA ya se ve como botón secundario; la Ruta de hoy ya no se sale de la tarjeta.
- El documento "CAMBIOS v8.4" de otro chat era sobre la v8.3: NO aplicar sus archivos (borraría v8.5–v9.4).

## v9.6 (publicada 03/11 con la v9.5): color del día y animaciones

- Colores del día: Push naranja, **Pull rojo**, Legs amarillo, Core verde, **Trote cian**. La pesa de Entrenar en la barra de abajo
  es lo único de la barra con el color del día (`#nEntrenar`); lo demás sigue en el color de acción.
- Animaciones revisadas con una galería de las 32 (abajo, subiendo, arriba, bajando). Arregladas: **fondos** (antes quedaba hincado
  en el piso; ahora cuelga de las barras, codo atrás a ~70–90° abajo y casi estirado arriba, pecho inclinado, cojín de la asistida
  que sube con la pila), **búlgara** (pie de atrás en el banco) y **crunch en máquina** (sentado, el torso se enrolla). Con pruebas.

## v9.7 / script 8.5 (publicado 03/11)

- Animaciones: pantorrilla con más recorrido, aperturas en máquina (las manos llegan al centro), granjero caminando,
  curl de muñeca de cerca (`caja` = viewBox por familia) y 3 nuevas: press de pecho sentado, fondos en máquina sentado, remo T.
- Comida: en la respuesta de la IA, − / + cambian la PORCIÓN (piezas o gramos) y todo sube parejo (antes subían la proteína
  de 2 en 2 y salía "las calorías no cuadran"). Platillos con ingredientes editables (cambiar gramos, quitar, agregar del
  catálogo); se guardan con sus ingredientes (un renglón por ingrediente en la hoja). `NUT.escalarItem/sumarIngredientes`.
- Script: IA_COMIDA e IA_FOTO devuelven `piezas`, `g_pieza` e `ingredientes`; comida, fotos y etiquetas usan primero el modelo
  ligero (la pestaña IA mostró al completo con 429/503 y respuestas de 90–280 s). Revisar la pestaña IA en unos días (✅ primera revisión 05/11, arriba).

## Pendientes de la app (refactor y auditoría)

1. ✅ v9.8: partir `app.js`, `app.css`, una capa de guardado, contraste, service worker todo o nada, hash del catálogo, Tempo.
2. ✅ (v10.2) Todas las pantallas con la plantilla ``html`…` `` (la vigilan `escapar-v98` y `plantilla`).
   ✅ v9.9: `coach.js`, `trote.js`, `sesion.js`. ✅ v10.0: `ajustes.js`. ✅ v10.1: `app.js`, `comida-dia.js`, `entrenar.js`, `progreso.js`.
   ✅ v10.2: `series.js` y `comida.js`. Para lo nuevo: escribirlo directo con la plantilla y probar con `herramientas/comparar-pantallas.js`.
3. Animaciones: ajustes según lo que Martin vea en el celular real (posturas, colores, velocidad).
4. ✅ Panel 1.6: service worker "todo o nada" como Gym (`config.js` sigue yendo primero por la red).

## Pendientes de Panel ↔ Gym (ver detalle abajo)

1. ✅ Decidido (30/10, opción A): la comida se registra solo en Gym; **Gym calcula las metas** (se ajustan solas) y las manda
   al script (`saveConfig({metasGym})`, script 8.1); Panel 1.4 las lee con `comidasPanel` (`src/Panel.js` del repo del script)
   y solo las muestra. Nunca pegar código a mano en el Apps Script: clasp lo borra.
2. Pendiente de revisar con datos reales: que Panel muestre las 6 semanas y las metas de Gym (1,800–1,900 kcal hoy).
3. **Si cambia `getData` del script de Gym**, revisar `CALC.gymHoy` en `Panel/calculos.js`. Panel usa: `sugGrupo`, `todayKey`,
   `ultimoGrupo`, `ultimoGrupoFecha`, `dias`, `ultimoPeso`, `carrera`, `resumen.{semana,diasSemana,promedio7,cambioSemana,cambioCintura,cintura}`,
   `trotes.{semanas,km7}`, `cuerpo.{serie,actual,meta}`. Todos existen en 7.9 (revisado 30/10).
4. ✅ Panel 1.6: la semana de carrera, la víspera y el día de la carrera igual que Gym.
5. ✅ Panel 1.6: la fecha de la carrera sale de Gym (`config.js` solo de respaldo).
6. Si algún día cambia el id de la implementación del script de Gym, actualizar `URL_GYM` en `Panel/config.js`
   (el workflow de Gym-script actualiza siempre la misma, así que no debería pasar).
7. Seguridad (solo en Chrome, no en las APK): Gym, Panel y Finanzas comparten origen `martinrtx.github.io`, así que comparten
   localStorage (Panel puede leer `gym_key`; por eso existe "Usar la conexión de tu app") y el mismo espacio de ~5 MB.
   ✅ Panel 1.6 ya no usa `onclick` en texto y en Chrome tiene CSP estricta.
8. La URL `/exec` de Gym ya es pública (está en `Panel/config.js`): la única protección es la clave. Usar una clave larga.
9. ✅ Script de Comidas con clasp: se publica solo desde GitHub (ver arriba).

## Lo que le toca a Martin (recomendado, no urgente)

- (Martin lo dejó así: trabaja solo.) 2FA en GitHub y proteger `main`: opcional, ver la explicación del 03/11.
- La clave larga se queda como está (decisión de Martin).
- Pesar los ingredientes del licuado (Martin lo va a hacer) y corregir en Comida › Mi licuado.
