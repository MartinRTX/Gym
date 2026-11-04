// v9.9: una receta (o el tupper) se revisa ingrediente por ingrediente. Antes el total de un licuado grande (más de 60 g de
// proteína y 900 kcal) salía ⚠️ "¿es algo seco o en polvo?" y "¿fue todo?": el registro de la receta no trae gramos y la revisión lo
// trataba como una sola cosa sin peso. Lo que dice la IA sigue revisándose igual.
const BASE = process.env.E2E_URL || 'http://localhost:8770/';
const { chromium } = require('playwright');
const res = []; const ok = (n, c, x) => res.push((c ? '✓ ' : '✗ ') + n + (x !== undefined ? ' · ' + JSON.stringify(x).slice(0, 200) : ''));

(async () => {
  const b = await chromium.launch();
  const DATA = Object.assign({}, require('./datos.js'), { ia: true, scriptVersion: '8.6' });
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(d => {
    if (location.protocol === 'about:') return;
    localStorage.setItem('gym_api', JSON.stringify('https://script.google.com/macros/s/MOCK/exec')); localStorage.setItem('gym_key', '"demo"');
    localStorage.setItem('gym_data', JSON.stringify(d)); localStorage.setItem('gym_bienvenida', 'true'); localStorage.setItem('gym_tour', 'true');
  }, DATA);
  await ctx.route('https://script.google.com/**', r => {
    let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, result: body.action === 'data' ? DATA : [] }) });
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.waitForTimeout(1500);
  // Un licuado grande pero que cuadra (números ficticios): ~675 g, 64 g de proteína, 910 kcal
  const PARTES = [['Leche entera', 300, 'ml', 9, 15, 9, 180], ['Avena', 70, 'g', 9.2, 47.4, 4.6, 265], ['Plátano', 120, 'g', 1.3, 27.4, 0.4, 107],
    ['Fresas', 100, 'g', 0.4, 9.1, 0.1, 35], ['Proteína en polvo', 35, 'g', 27.3, 2.2, 0.6, 123], ['Linaza', 20, 'g', 3.7, 5.8, 8.4, 107], ['Soya texturizada (seca)', 30, 'g', 13, 10, 0.7, 93]]
    .map(x => ({ n: x[0], q: x[1], u: x[2], p: x[3], c: x[4], f: x[5], k: x[6], fib: 0 }));
  try {
    await p.evaluate(() => verTab('Comida')); await p.waitForTimeout(200);
    await p.evaluate(P => {
      const t = P.reduce((a, x) => ({ p: a.p + x.p, c: a.c + x.c, f: a.f + x.f, k: a.k + x.k }), { p: 0, c: 0, f: 0, k: 0 });
      agregarAProt([nuevoRegistro(Object.assign({ n: 'Mi licuado', src: 'receta', ref: 'licuado', partes: P }, t)),
        nuevoRegistro({ n: 'Tupper grande', src: 'tupper', ref: 'res|papa|lleno|0', p: 70, c: 120, f: 30, k: 1030, partes: [{ n: 'Res', q: 250, u: 'g', p: 70, c: 0, f: 20, k: 460 }, { n: 'Arroz', q: 350, u: 'g', p: 0, c: 120, f: 10, k: 570 }] }),
        nuevoRegistro({ n: 'Receta con un dato mal', src: 'receta', ref: 'x', p: 25, c: 5, f: 1, k: 130, partes: [{ n: 'Ingrediente raro', q: 10, u: 'g', p: 20, c: 0, f: 0, k: 80 }, { n: 'Agua', q: 250, u: 'ml', p: 5, c: 5, f: 1, k: 50 }] }),
        nuevoRegistro({ n: 'Pizza entera', q: 660, u: 'g', src: 'ia', p: 54, c: 198, f: 42, k: 1386 })], [comidaActual(), comidaActual(), comidaActual(), comidaActual()]);
      cambiarProt();
    }, PARTES);
    await p.waitForTimeout(200);
    const marcado = n => p.locator('.eaten button.grande', { hasText: n }).count();
    ok('Licuado de 64 g de proteína y 910 kcal: sin ⚠️ (cuadra ingrediente por ingrediente)', await marcado('Mi licuado') === 0);
    ok('Tupper de 1,030 kcal: sin ⚠️ (son tus cantidades)', await marcado('Tupper grande') === 0);
    ok('Una receta con un ingrediente que no cuadra sí sale ⚠️', await marcado('Receta con un dato mal') === 1);
    ok('Lo de la IA de 1,386 kcal sigue saliendo ⚠️', await marcado('Pizza entera') === 1);
    await p.locator('.eaten button', { hasText: 'Mi licuado' }).click(); await p.waitForTimeout(200);
    ok('Al abrir el licuado no hay avisos', await p.locator('#sheet .av, #sheet .aviso').count() === 0 && !/es mucho|una sola cosa/.test(await p.locator('#sheet').innerText()));
    await p.evaluate(() => cerrarModal());
    await p.locator('.eaten button', { hasText: 'Receta con un dato mal' }).click(); await p.waitForTimeout(200);
    ok('Al abrir la receta mala, el aviso dice qué ingrediente', /Ingrediente raro: .*pesan más que la comida/.test(await p.locator('#sheet').innerText()));
    await p.evaluate(() => cerrarModal());
  } catch (e) { ok('Recorrido completo', false, e.message.split('\n')[0]); }
  ok('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log(res.join('\n'));
})();
