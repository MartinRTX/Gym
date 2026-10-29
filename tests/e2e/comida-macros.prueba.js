// Pruebas de Comida con macros en el navegador (y capturas): node nut.js
const BASE = process.env.E2E_URL || 'http://localhost:8770/';
const TMP = require('os').tmpdir();
const IMAGEN = require('path').join(__dirname, '..', '..', 'icon-512.png');
const { chromium } = require('playwright');
const DATA = Object.assign({}, require('./datos.js'), { scriptVersion: '7.7', ia: true });
const casos = []; const ok = (n, c, info) => casos.push((c ? '✓ ' : '✗ ') + n + (info !== undefined ? ' · ' + JSON.stringify(info).slice(0, 300) : ''));
const OUT = process.env.OUTN || require('path').join(TMP, 'gym-nut'); require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, colorScheme: process.env.ESQ || 'dark' });
  await ctx.addInitScript(d => {
    localStorage.setItem('gym_api', JSON.stringify('https://script.google.com/macros/s/MOCK/exec')); localStorage.setItem('gym_key', JSON.stringify('demo'));
    localStorage.setItem('gym_data', JSON.stringify(d)); localStorage.setItem('gym_bienvenida', 'true'); if (!window.__conTour) localStorage.setItem('gym_tour', 'true');
    // Un día de antes con los botones viejos (solo proteína)
    const k = (n) => { const x = new Date(); x.setDate(x.getDate() - n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
    localStorage.setItem('gym_prot_2026-10-22', JSON.stringify(['Licuado', 'Tupper carne', 'Atún (20 g)']));   // el reloj de la prueba es el 23/10
  }, DATA);
  const llamadas = [];
  await ctx.route('https://script.google.com/**', r => {
    const body = JSON.parse(r.request().postData() || '{}'); llamadas.push(body);
    let res = [];
    if (body.action === 'data') res = DATA;
    else if (body.action === 'batch') res = body.args[0].map(o => ({ id: o.id, ok: true }));
    else if (body.action === 'etiquetaIA') res = { nombre: 'Leche Lala 100 sin lactosa', marca: 'Lala', u: 'ml', por100: null, porcion: { texto: '1 vaso', cant: 250, p: 9, c: 12, f: 5, k: 129, fib: 0 }, avisos: [] };
    else if (body.action === 'fotoComidaIA') res = { items: [{ nombre: 'Bistec en salsa verde', g: 32, gramos: 200, c: 9, f: 14, k: 290, fib: 1.5, nota: '~1 cucharón grande' }, { nombre: 'Arroz rojo', g: 5, gramos: 150, c: 38, f: 8, k: 264, fib: 0, nota: '1 taza' }], consejo: 'Buen tupper: ya llevas la mitad de tu proteína.' };
    else if (body.action === 'comidaIA') res = { items: [{ nombre: 'Tacos de asada', g: 27, gramos: 300, c: 45, f: 25, k: 520, fib: 4, nota: '3 tacos' }], consejo: '' };
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, result: res }) });
  });
  await ctx.route('https://world.openfoodfacts.org/**', r => {
    const u = r.request().url();
    const prod = { code: '7501055300846', product_name: 'Proteína Iso 100 Vainilla', brands: 'Dymatize', serving_size: '1 scoop (32 g)', serving_quantity: 32,
      nutriments: { proteins_100g: 78, carbohydrates_100g: 6, fat_100g: 1.5, 'energy-kcal_100g': 360, proteins_serving: 25, 'energy-kcal_serving': 115 } };
    const body = /\/api\/v2\/product\//.test(u) ? { status: 1, product: prod } : { products: [prod] };
    return r.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.clock.install({ time: new Date('2026-10-23T14:30:00') });
  await p.goto(BASE + 'index.html'); await p.waitForTimeout(1500);
  let n = 0; const shot = async (nom, full) => { await p.waitForTimeout(350); await p.screenshot({ path: OUT + '/' + String(++n).padStart(2, '0') + '-' + nom + '.png', fullPage: !!full }); };
  await p.evaluate(() => verTab('Comida')); await shot('comida');
  // Licuado
  await p.evaluate(() => abrirReceta('licuado')); await shot('licuado');
  let r = await p.evaluate(() => { recCant(0, 1); recSet(1, 50); const t = NUT.receta({ items: REC_ED.items }, resolver).tot; guardarReceta(); return { leche: recetaDe('licuado').items[0].q, avena: recetaDe('licuado').items[1].q, p: t.p }; });
  ok('Licuado: cambiar cantidades y guardar', r.leche === 275 && r.avena === 50, r);
  r = await p.evaluate(() => { agregarRecetaHoy(); const k = prot[prot.length - 1]; return { k, reg: regDe(k), et: etiquetas(diaComida(), prot.length).slice(-1)[0] }; });
  ok('Licuado agregado como registro con macros', r.reg && r.reg.p > 40 && r.reg.k > 500 && r.reg.src === 'receta', r);
  // Cenas
  await p.evaluate(() => abrirCenas()); await shot('cenas');
  r = await p.evaluate(() => ({ filas: [...document.querySelectorAll('.cenas .cf')].map(f => f.textContent), tip: document.querySelector('#sheet .tip').textContent }));
  ok('Cenas lado a lado con el cambio', r.filas.length === 6 && /más de proteína/.test(r.tip), r.tip);
  await p.evaluate(() => cenaHoy('cena-maiz'));
  // Tupper
  await p.evaluate(() => abrirTupper()); await shot('tupper');
  r = await p.evaluate(() => { TUP.prot = 'res'; tupLado('verdura'); TUP.tort = 2; pintarTupper(); agregarTupper(); const c = nutCfg().tuppers; return { n: Object.keys(c).length, nom: Object.values(c)[0].nombre, ult: regDe(prot[prot.length - 1]) }; });
  ok('Tupper de 3 toques: se agrega y se aprende', r.n === 1 && /res, arroz, frijoles y verduras \+ 2 tortillas/.test(r.nom) && r.ult.p > 40, r);
  await p.evaluate(() => abrirTupper()); await shot('tupper-aprendido');
  await p.evaluate(() => cerrarModal());
  // Buscador
  await p.evaluate(() => abrirBuscador()); await p.waitForTimeout(800);
  await p.fill('#busNut', 'tortilla maiz'); await p.waitForTimeout(600); await shot('buscar');
  r = await p.evaluate(() => [...document.querySelectorAll('#busRes .bres .nm')].slice(0, 6).map(x => x.firstChild.textContent));
  ok('Buscar tortilla de maíz: base primero y la tabla mexicana', r[0] === 'Tortilla de maíz' && r.some(x => /Maiz Tortilla/i.test(x)), r);
  await p.fill('#busNut', 'queso panela'); await p.waitForTimeout(600);
  r = await p.evaluate(() => [...document.querySelectorAll('#busRes .bres .nm')].slice(0, 4).map(x => x.firstChild.textContent));
  ok('Buscar queso panela', /panela/i.test(r[0]), r);
  await p.fill('#busNut', 'chicken breast'); await p.waitForTimeout(600);
  r = await p.evaluate(() => [...document.querySelectorAll('#busRes .bres .nm')].slice(0, 3).map(x => x.firstChild.textContent));
  ok('Buscar en inglés encuentra el USDA', r.some(x => /chicken/i.test(x)), r);
  await p.fill('#busNut', 'pechuga pollo'); await p.waitForTimeout(600);
  r = await p.evaluate(() => [...document.querySelectorAll('#busRes .bres .nm')].slice(0, 5).map(x => x.firstChild.textContent));
  ok('Buscar en español también trae USDA traducido', r.length >= 3, r);
  await p.evaluate(() => { const a = listaBusqueda().find(x => /Guisos Tinga/i.test(x.n)); pedirCantidad(a); }); await shot('cantidad');
  r = await p.evaluate(() => { CANT.q = 200; usarCantidad(); return regDe(prot[prot.length - 1]); });
  ok('Agregar 200 g de tinga desde la tabla mexicana', r && Math.abs(r.p - 19.4) < 0.2 && r.src === 'mx', r);
  // Open Food Facts
  await p.evaluate(() => abrirBuscador()); await p.fill('#busNut', 'iso 100'); await p.waitForTimeout(400);
  await p.evaluate(() => buscarOFF()); await p.waitForTimeout(800); await shot('off');
  r = await p.evaluate(() => (BUS.off || []).map(a => [a.n, a.p, a.por]));
  ok('Open Food Facts: producto con porción', r.length === 1 && r[0][1] === 78 && r[0][2][0][1] === 32, r);
  await p.evaluate(() => elegirOFF('7501055300846')); await shot('producto-off');
  r = await p.evaluate(() => { PROD.al.rol = 'proteina'; guardarProducto(false); const it = recetaDe('licuado').items.find(i => i.rol === 'proteina'); return { ref: it.ref, q: it.q, prod: resolver(it.ref) && resolver(it.ref).n }; });
  ok('Nueva proteína como la de siempre: el licuado la usa (1 scoop de 32 g)', /^p:/.test(r.ref) && r.q === 32 && /Iso 100/.test(r.prod), r);
  // Código de barras escrito
  await p.evaluate(() => abrirCamara()); await shot('camara');
  await p.fill('#codManual', '7501055300846'); await p.evaluate(() => codigoManual()); await p.waitForTimeout(500);
  r = await p.evaluate(() => PROD && PROD.al.n);
  ok('Código de barras escrito → Open Food Facts', /Iso 100/.test(r || ''), r);
  await p.evaluate(() => cerrarModal());
  // Foto de etiqueta (solo porción) → leche de siempre
  const foto = async tipo => p.evaluate(async t => {
    const cv = document.createElement('canvas'); cv.width = 400; cv.height = 300; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 400, 300); g.fillStyle = '#000'; g.fillText('Información nutrimental', 20, 40);
    const blob = await new Promise(ok => cv.toBlob(ok, 'image/png')); FOTO = { tipo: t }; await procesarFotoNut(new File([blob], 'f.png', { type: 'image/png' }));
  }, tipo);
  await foto('etiqueta'); await p.waitForTimeout(300); await shot('etiqueta');
  r = await p.evaluate(() => ({ p: PROD.al.p, k: PROD.al.k, u: PROD.al.u, por: PROD.al.por, rol: PROD.al.rol }));
  ok('Etiqueta solo por porción → por 100 ml y sugiere "mi leche"', r.p === 3.6 && r.u === 'ml' && r.rol === 'leche' && r.por[0][1] === 250, r);
  r = await p.evaluate(() => { guardarProducto(false); const it = recetaDe('licuado').items.find(i => i.rol === 'leche'); return { ref: it.ref, q: it.q, n: resolver(it.ref).n }; });
  ok('Leche nueva en el licuado sin rearmarlo (cantidad igual)', /^p:/.test(r.ref) && r.q === 275, r);
  const env = llamadas.find(x => x.action === 'etiquetaIA');
  ok('La foto viaja chica (JPEG)', env && env.args[1] === 'image/jpeg' && env.args[0].length < 400000, env && env.args[0].length);
  // Foto del tupper
  await foto('tupper'); await p.waitForTimeout(400); await shot('foto-tupper');
  r = await p.evaluate(() => { const its = COMIDA_IA.items.length; agregarComidaIA(); const a = regDe(prot[prot.length - 2]); return { its, a }; });
  ok('Foto del tupper: la IA estima y se agrega con macros', r.its === 2 && r.a.k === 290 && r.a.src === 'foto', r);
  // Metas
  await p.evaluate(() => abrirMetas()); await shot('metas');
  r = await p.evaluate(() => Object.assign(metasHoy(), { meta: metaProt() }));
  ok('Metas calculadas (proteína = la tuya)', r.p === r.meta && r.k >= 1700 && r.k <= 2600 && r.auto, r);
  await p.evaluate(() => cerrarModal());
  // Día viejo: solo proteína, pero los botones de antes estiman macros
  r = await p.evaluate(() => { const ayer = sumarDias(hoy(), -1); return totalMacros(cargarProt(ayer)); });
  ok('Días de antes: botones viejos con macros estimados; lo "(20 g)" queda sin datos', r.p === 80 && r.k === 661 && r.sinDatos === 1, r);
  // Sincronización
  await p.evaluate(() => enviar()); await p.waitForTimeout(1600);
  const lote = llamadas.filter(x => x.action === 'batch').flatMap(x => x.args[0]);
  const cmd = lote.filter(o => o.action === 'saveComidas').slice(-1)[0], pr = lote.filter(o => o.action === 'saveProteina').slice(-1)[0];
  ok('Hoja: saveComidas con cada cosa y sus macros', cmd && cmd.args[1].length >= 5 && cmd.args[1].every(i => i.p !== undefined && i.n && 'k' in i && i.h), cmd && cmd.args[1].map(i => [i.n, i.p, i.k, i.m]));
  ok('Hoja: Peso diario sigue con proteína y detalle legible', pr && pr.args[0] > 100 && !/#/.test(pr.args[1]), pr && pr.args.slice(0, 2));
  const cfg = lote.filter(o => o.action === 'saveConfig' && o.args[0].nutricion).slice(-1)[0];
  ok('Hoja: recetas, productos y tuppers respaldados', cfg && cfg.args[0].nutricion.productos.length === 2 && cfg.args[0].nutricion.recetas.length === 3, cfg && Object.keys(cfg.args[0].nutricion));
  // Widget y día típico
  r = await p.evaluate(() => datosWidgets().prot.botones);
  ok('Widget: el licuado es tu receta', r.some(x => x.k === '@licuado' && x.g > 40), r);
  r = await p.evaluate(() => { const l = diaTipicoLista(); return { l, g: protTotal(l) }; });
  ok('Día típico usa tu receta de licuado', r.l[0] === '@licuado', r);
  await p.evaluate(() => { verTab('Comida'); window.scrollTo(0, 0); }); await shot('comida-llena');
  await p.evaluate(() => window.scrollTo(0, 99999)); await shot('hoy-comiste');
  ok('Sin errores de página', !errs.length, errs);
  console.log(casos.join('\n'));
  await b.close();
})();
