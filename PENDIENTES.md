# Pendientes y contexto (para seguir en un chat nuevo)

Actualizado: 30/10/2026. Pega este archivo (o su link) al empezar un chat nuevo.

## Dónde está todo

| Pieza | Dónde | Estado |
|---|---|---|
| App Gym (PWA) | repo público `MartinRTX/Gym`, Pages en https://martinrtx.github.io/Gym/ | v9.1 publicada (`main` = rama de trabajo) |
| Rama de trabajo | `claude/fitness-app-visual-design-x9iz7n` | Publicar = adelantar `main` a esta rama, **solo cuando Martin diga "publica"** |
| APK Gym | carpeta `apk/` (Capacitor, carga la URL de Pages) | Compilación 21, firma verificada por el workflow |
| Apps Script de Gym | repo **privado** `MartinRTX/Gym-script` (`src/AppGym.js`, `src/Maquina.js`, `src/Código.js`) | 8.1 publicado (se publica solo con clasp al subir a `main`) |
| Panel | repo público `MartinRTX/Panel` (Pages /Panel/, APK propia) | 1.4: lee Gym y Finanzas (solo lectura); comidas y metas vienen de Gym; plan semanal en "Comidas 2026" |

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
