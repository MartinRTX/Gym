// v10.5: productos de marca cuya porción es de varias piezas (Mantecadas con nuez: porción = 2 piezas de 62 g).
// Antes "Guardar y agregar 1 porción" y "1 mantecada" contaban las 2 piezas (el doble de calorías).
const BASE = process.env.E2E_URL || 'http://localhost:8770/';
const TMP = require('os').tmpdir();
const { chromium } = require('playwright');
const DATA = Object.assign({}, require('./datos.js'), { scriptVersion: '7.7', ia: true });
const casos = []; const ok = (n, c, info) => casos.push((c ? '✓ ' : '✗ ') + n + (info !== undefined ? ' · ' + JSON.stringify(info).slice(0, 300) : ''));
const OUT = require('path').join(TMP, 'gym-mantecada'); require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, colorScheme: 'dark' });
  await ctx.addInitScript(d => {
    localStorage.setItem('gym_api', JSON.stringify('https://script.google.com/macros/s/MOCK/exec')); localStorage.setItem('gym_key', JSON.stringify('demo'));
    localStorage.setItem('gym_data', JSON.stringify(d)); localStorage.setItem('gym_bienvenida', 'true'); localStorage.setItem('gym_tour', 'true');
  }, DATA);
  await ctx.route('https://script.google.com/**', r => {
    const body = JSON.parse(r.request().postData() || '{}');
    const res = body.action === 'data' ? DATA : body.action === 'batch' ? body.args[0].map(o => ({ id: o.id, ok: true })) : [];
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, result: res }) });
  });
  const conPorcion = { code: '7501000111111', product_name: 'Mantecadas con nuez', brands: 'Bimbo', serving_size: '2 piezas (62 g)', serving_quantity: 62,
    nutriments: { proteins_100g: 6, carbohydrates_100g: 43.1, fat_100g: 29.3, 'energy-kcal_100g': 460, proteins_serving: 3.7, 'energy-kcal_serving': 285 } };
  const sinPorcion = { code: '7501000222222', product_name: 'Mantecadas vainilla', brands: 'Bimbo',
    nutriments: { proteins_100g: 6, carbohydrates_100g: 50, fat_100g: 22, 'energy-kcal_100g': 420 } };
  await ctx.route('https://world.openfoodfacts.org/**', r => r.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ products: /vainilla/.test(r.request().url()) ? [sinPorcion] : [conPorcion] }) }));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + 'index.html'); await p.waitForTimeout(1500);
  await p.evaluate(() => verTab('Comida'));
  let r;
  // 1. Buscar "1 mantecada" → Open Food Facts → revisar el producto
  await p.evaluate(() => abrirBuscador()); await p.fill('#busNut', '1 mantecada'); await p.waitForTimeout(400);
  await p.evaluate(() => buscarOFF()); await p.waitForTimeout(800);
  r = await p.evaluate(() => (BUS.off || [])[0] && BUS.off[0].por);
  ok('Open Food Facts: la porción de 2 piezas trae también 1 pieza', JSON.stringify(r) === JSON.stringify([['2 piezas (62 g)', 62], ['1 pieza', 31]]), r);
  await p.evaluate(() => elegirOFF('7501000111111')); await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '/1-producto.png' });
  const hoja = await p.locator('#sheet').innerText();
  ok('Revisar producto: dice cuánto es 1 pieza', /1 pieza = 31 g/.test(hoja) && /143 kcal/.test(hoja), hoja.slice(0, 400));
  ok('El botón agrega 1 pieza (no la porción de 2)', /Guardar y agregar 1 pieza/.test(hoja), hoja.slice(-120));
  await p.locator('#sheet .btn', { hasText: 'Guardar y agregar' }).click(); await p.waitForTimeout(300);
  r = await p.evaluate(() => ({ q: CANT.q, k: Math.round(NUT.macros(CANT.al, CANT.q).k) }));
  ok('Guardar y agregar: 31 g, ~143 kcal (antes 62 g, 285 kcal)', r.q === 31 && r.k === 143, r);
  await p.screenshot({ path: OUT + '/2-cantidad.png' });
  await p.evaluate(() => cerrarModal());
  // 2. Ya guardado: escribir "1 mantecada" en el buscador lo calcula de una pieza
  await p.evaluate(() => abrirBuscador()); await p.fill('#busNut', '1 mantecada'); await p.waitForTimeout(500);
  r = await p.evaluate(() => { const a = listaBusqueda().find(x => /Mantecadas con nuez/.test(x.n)); if (!a) return null; elegirNut(a.id); return CANT && CANT.q; });
  ok('Tu producto guardado: "1 mantecada" = 31 g', r === 31, r);
  await p.evaluate(() => cerrarModal());
  // 3. Producto sin porción: "1 mantecada" se queda en 100 g, pero avisa
  await p.evaluate(() => abrirBuscador()); await p.fill('#busNut', '1 mantecada vainilla'); await p.waitForTimeout(400);
  await p.evaluate(() => buscarOFF()); await p.waitForTimeout(800);
  r = await p.evaluate(() => { const a = (BUS.off || [])[0]; if (!a) return null; pedirCantidad(a, BUS.q); return CANT.q; });
  const txt = await p.locator('#sheet').innerText();
  ok('Sin porción: 100 g y avisa que pongas los gramos de la etiqueta', r === 100 && /no dice cuánto pesa una pieza/.test(txt), [r, txt.slice(0, 300)]);
  await p.screenshot({ path: OUT + '/3-sin-porcion.png' });
  ok('Sin errores de página', !errs.length, errs);
  console.log(casos.join('\n'));
  await b.close();
})();
