# Pendientes y contexto (para seguir en un chat nuevo)

Actualizado: 02/11/2026. Pega este archivo (o su link) al empezar un chat nuevo.

## Dónde está todo

| Pieza | Dónde | Estado |
|---|---|---|
| App Gym (PWA) | repo público `MartinRTX/Gym`, Pages en https://martinrtx.github.io/Gym/ | v9.4 publicada (`main` = rama de trabajo) |
| Rama de trabajo | `claude/fitness-app-visual-design-x9iz7n` | Publicar = adelantar `main` a esta rama, **solo cuando Martin diga "publica"** |
| APK Gym | carpeta `apk/` (Capacitor, carga la URL de Pages) | Compilación 21, firma verificada por el workflow |
| Apps Script de Gym | repo **privado** `MartinRTX/Gym-script` (`src/AppGym.js`, `src/Maquina.js`, `src/Código.js`) | 8.4 publicado (se publica solo con clasp al subir a `main`) |
| Panel | repo público `MartinRTX/Panel` (Pages /Panel/, APK propia) | 1.5: lee Gym y Finanzas (solo lectura); comidas y metas vienen de Gym; plan semanal en "Comidas 2026" |

Versiones que deben ir juntas: `VERSION_APP` en `app.js` = `VERSION` en `sw.js` (`herramientas/revisar.js` falla si no).
`SCRIPT_ESPERADO` en `app.js` = `SCRIPT_VERSION` en `AppGym.js`. El `versionName` del APK sale de `VERSION_APP`.

## Reglas que no cambian

- La API key de Gemini solo en Script Properties. `AppGym.gs` nunca al repo público.
- Nunca imprimir ni subir la clave de la app, el id de la hoja, ni `.clasprc.json` (la credencial de clasp).
- Datos personales reales nunca al repo: las pruebas usan `tests/e2e/datos-prueba.json` (ficticio).
- Pedir confirmación antes de borrar datos y antes de hacer un cambio grande.
- Antes de compilar el APK: confirmar que se firma con la MISMA keystore (el workflow verifica el SHA-256). La keystore nunca va al repo.
- Decisiones de Martin: la licencia de los datos INCMNSZ y la credencial de clasp se quedan como están.

## Cómo probar

```bash
node herramientas/revisar.js            # versiones, sin onclick en texto, etc.
node --test tests/*.test.js              # 72 pruebas de lógica
NODE_PATH=/opt/node-tools/node_modules node tests/e2e/correr.js [filtro]   # 191 pruebas de pantalla (Playwright)
```

En GitHub corren solas: "Pruebas" (revisar + unidad + pantalla), "APK Android" (desde `main`) y Pages.
En Gym-script: "Publicar script" (revisa en todas las ramas; en `main` hace `clasp push`, versión nueva,
actualiza la MISMA implementación y prueba que conteste "Clave incorrecta").

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
- **Proteína inflada el 01/11**: "frijoles con soya" en el buscador eligió *Soja (Soya) Frijol, Proteína* (proteína de soya
  SECA, 47.6 g/100 g): 150 g = **71 g de proteína** que no comió. Y la IA puso *Mantequilla 10 g* con **20 g de proteína** (imposible).
- **Catálogo mexicano con fichas engañosas**: *Leche De Vaca, Entera* trae 29 g de proteína y 504 kcal por 100 g (es leche en polvo).
  No hay mantequilla en los básicos; "pan birote" no encuentra el bolillo.
- **La IA sigue tardando** con el modelo completo: 2 veces el 01/11 ("Cereal kellogs all bran", "molletes…"). No hay ningún
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
6. ✅ **Corregido el 01/11 en la hoja** (Martin lo pidió): frijoles con soya 150 g (14.6 g prot) y mantequilla 10 g (0.1 g prot);
   Peso diario del 01/11 = 95 g. En el celular ese día sigue con lo viejo hasta que se borre o se edite (la hoja ya está bien).

## v9.4 / script 8.4 / Panel 1.5 (publicado 02/11/2026): los 7 de Comida

1. Tocar algo de "Hoy comiste" → corregir (½, ×1½, ×2, cantidad o cada macro) o quitar (`abrirItemDia`). Va a la hoja al guardar.
2. "Sueles comer en …": lo que anotaste 2+ veces en esa comida en 3 semanas y hoy falta (`sugerenciasHora`).
3. "📅 Repetir una comida de otro día" (últimos 7 días, por comida). Las recetas se recalculan con la receta de hoy.
4. Aviso a las 9 pm si faltan o sobran más de 350 kcal (id 96, interruptor `avisoKcal` en Ajustes).
5. Mantenimiento real = kcal promedio registradas − cambio de peso × 1,100 (`NUT.mantenimientoReal`): en Metas, en Panel
   (`metasGym.mantReal`, con 5+ días) y en el reporte del domingo.
6. "💾 Guardar como receta" lo que contestó la IA: cada cosa queda como producto y la receta sale en Mis comidas (se quita con Editar).
7. Cosas de más de 900 kcal salen ⚠️ en el día y en la respuesta de la IA.

## v9.5 (en la rama, falta "publica"): diseño y textos

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
  ligero (la pestaña IA mostró al completo con 429/503 y respuestas de 90–280 s). Revisar la pestaña IA en unos días.

## Pendientes de la app (refactor y auditoría)

1. Partir `app.js` (~5,300 líneas) en ~10 archivos y juntar los `CSS_V53…CSS_V89` en un `app.css`.
2. Pasar el resto de las pantallas a la plantilla ``html`…` `` que escapa sola (hoy solo `pintarMaquina` y `abrirFallas`).
3. Una sola capa de guardado (hoy hay `LS`, IndexedDB para fotos y llaves sueltas).
4. Contraste de textos chicos (chips, "✓ Al día", textos apagados).
5. Service worker: puede mezclar archivos de dos versiones (stale-while-revalidate). Cambiar a "todo o nada" por versión.
6. `catalogo.py` baja el paquete de npm sin verificar su hash.
7. Animaciones: ajustes según lo que Martin vea en el celular real (posturas, colores, velocidad).
8. Opcional: encabezado "Tempo" en la columna W del Catálogo; CSP en el APK si Capacitor lo permite.

## Pendientes de Panel ↔ Gym (ver detalle abajo)

1. ✅ Decidido (30/10, opción A): la comida se registra solo en Gym; **Gym calcula las metas** (se ajustan solas) y las manda
   al script (`saveConfig({metasGym})`, script 8.1); Panel 1.4 las lee con `comidasPanel` (`src/Panel.js` del repo del script)
   y solo las muestra. Nunca pegar código a mano en el Apps Script: clasp lo borra.
2. Pendiente de revisar con datos reales: que Panel muestre las 6 semanas y las metas de Gym (1,800–1,900 kcal hoy).
3. **Si cambia `getData` del script de Gym**, revisar `CALC.gymHoy` en `Panel/calculos.js`. Panel usa: `sugGrupo`, `todayKey`,
   `ultimoGrupo`, `ultimoGrupoFecha`, `dias`, `ultimoPeso`, `carrera`, `resumen.{semana,diasSemana,promedio7,cambioSemana,cambioCintura,cintura}`,
   `trotes.{semanas,km7}`, `cuerpo.{serie,actual,meta}`. Todos existen en 7.9 (revisado 30/10).
4. Rutina de hoy en Panel: no sabe de la semana de carrera (en Gym la víspera es descanso y hay descarga). Alrededor del 20–21/11 pueden decir cosas distintas.
5. Fecha de la carrera: Panel usa la de su `config.js` y no la de Gym. Si cambia, cambiarla en los dos.
6. Si algún día cambia el id de la implementación del script de Gym, actualizar `URL_GYM` en `Panel/config.js`
   (el workflow de Gym-script actualiza siempre la misma, así que no debería pasar).
7. Seguridad (solo en Chrome, no en las APK): Gym, Panel y Finanzas comparten origen `martinrtx.github.io`, así que comparten
   localStorage (Panel puede leer `gym_key`; por eso existe "Usar la conexión de tu app") y el mismo espacio de ~5 MB.
   Panel usa `onclick` en texto, así que no puede tener la CSP estricta que ya tiene Gym. Opcional: pasarlo a `data-click` y CSP.
8. La URL `/exec` de Gym ya es pública (está en `Panel/config.js`): la única protección es la clave. Usar una clave larga.
9. Opcional: el script de Comidas de Panel se pega a mano; se podría publicar con clasp como el de Gym.

## Lo que le toca a Martin (recomendado, no urgente)

- Activar 2FA en GitHub y proteger la rama `main` de Gym y Gym-script.
- Pesar avena, plátano y fresas del licuado y corregir las cantidades en Comida › Mi licuado.
