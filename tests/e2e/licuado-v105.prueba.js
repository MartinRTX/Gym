// v10.5: tu licuado con TUS productos. Cada ingrediente dice de dónde salen sus macros (genérico o tuyo);
// desde la receta se elige un producto de marca (Open Food Facts) o se le toma foto a la etiqueta y queda en la receta;
// y la beta-alanina está en el catálogo (0 kcal, 5 g).
const BASE = process.env.E2E_URL || 'http://localhost:8770/';
const TMP = require('os').tmpdir();
const { chromium } = require('playwright');
const DATA = Object.assign({}, require('./datos.js'), { scriptVersion: '7.7', ia: true });
const casos = []; const ok = (n, c, info) => casos.push((c ? '✓ ' : '✗ ') + n + (info !== undefined ? ' · ' + JSON.stringify(info).slice(0, 300) : ''));
const OUT = require('path').join(TMP, 'gym-licuado'); require('fs').mkdirSync(OUT, { recursive: true });
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
  const fresas = { code: '0193968000001', product_name: 'Fresas enteras congeladas', brands: "Member's Mark", serving_size: '1 taza (140 g)', serving_quantity: 140,
    nutriments: { proteins_100g: 0.7, carbohydrates_100g: 10, fat_100g: 0, 'energy-kcal_100g': 43, proteins_serving: 1, 'energy-kcal_serving': 60 } };
  await ctx.route('https://world.openfoodfacts.org/**', r => r.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ products: [fresas] }) }));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + 'index.html'); await p.waitForTimeout(1500);
  await p.evaluate(() => { verTab('Comida'); abrirReceta('licuado'); }); await p.waitForTimeout(300);
  let t = await p.locator('#sheet').innerText();
  ok('Receta: cada ingrediente dice de dónde salen sus macros', /Fresas congeladas[\s\S]*USDA · por 100 g: 0.4 g prot · 35 kcal · genérico/.test(t), t.slice(0, 600));
  await p.screenshot({ path: OUT + '/1-receta.png' });
  // ⇄ en las fresas → buscar → Open Food Facts → guardar → ya están en la receta
  const i = await p.evaluate(() => REC_ED.items.findIndex(x => x.ref === 'b:fresa-cong'));
  await p.evaluate(n => recCambiar(n), i); await p.waitForTimeout(300);
  ok('Desde la receta se puede tomar foto a la etiqueta', await p.locator('#sheet button', { hasText: 'Foto de la etiqueta o código' }).count() === 1);
  await p.fill('#busNut', 'fresas congeladas'); await p.waitForTimeout(400);
  await p.evaluate(() => buscarOFF()); await p.waitForTimeout(700);
  await p.evaluate(() => elegirOFF('0193968000001')); await p.waitForTimeout(300);
  ok('Producto de marca desde la receta: "Guardar y usar en la receta"', await p.locator('#sheet .btn', { hasText: 'Guardar y usar en la receta' }).count() === 1);
  await p.locator('#sheet .btn', { hasText: 'Guardar y usar en la receta' }).click(); await p.waitForTimeout(400);
  let r = await p.evaluate(n => { const it = REC_ED.items[n], al = resolver(it.ref); return { ref: it.ref, q: it.q, n: al && al.n, k: al && al.k }; }, i);
  ok('Las fresas de la receta ya son las tuyas (misma cantidad)', /^p:/.test(r.ref) && r.n === 'Fresas enteras congeladas' && r.q === 100 && r.k === 43, r);
  t = await p.locator('#sheet').innerText();
  ok('Y se ve: Member\'s Mark, de Open Food Facts, sin "genérico"', /Fresas enteras congeladas · Member's Mark[\s\S]*Open Food Facts · por 100 g: 0.7 g prot · 43 kcal(?! · genérico)/.test(t), t.slice(0, 700));
  // Beta-alanina: ＋ Agregar ingrediente → 5 g
  await p.evaluate(() => recAgregar()); await p.waitForTimeout(300);
  await p.fill('#busNut', 'beta alanina'); await p.waitForTimeout(500);
  await p.evaluate(() => { const a = listaBusqueda().find(x => x.id === 'b:beta-alanina'); elegirNut(a.id); }); await p.waitForTimeout(200);
  r = await p.evaluate(() => CANT && CANT.q);
  ok('Beta-alanina: sale en 5 g', r === 5, r);
  await p.locator('#sheet .btn', { hasText: 'Usar en la receta' }).click(); await p.waitForTimeout(300);
  await p.evaluate(() => guardarReceta()); await p.waitForTimeout(300);
  r = await p.evaluate(() => { const rec = nutCfg().recetas.find(x => x.id === 'licuado'); return { beta: rec.items.find(x => x.ref === 'b:beta-alanina'), fresas: resolver(rec.items.find(x => /^p:/.test(x.ref)).ref).n }; });
  ok('Guardado: el licuado lleva beta-alanina 5 g y tus fresas', r.beta && r.beta.q === 5 && r.fresas === 'Fresas enteras congeladas', r);
  await p.screenshot({ path: OUT + '/2-receta-tuya.png' });
  // Después, una búsqueda normal de un producto de marca NO va a la receta
  await p.evaluate(() => { cerrarReceta(); abrirBuscador(); }); await p.fill('#busNut', 'fresas'); await p.evaluate(() => buscarOFF()); await p.waitForTimeout(600);
  await p.evaluate(() => elegirOFF('0193968000001')); await p.waitForTimeout(200);
  ok('Búsqueda normal: el producto se agrega a tu día, no a la receta', await p.locator('#sheet .btn', { hasText: 'Guardar y agregar' }).count() === 1);
  ok('Sin errores de página', !errs.length, errs);
  console.log(casos.join('\n'));
  await b.close();
})();
