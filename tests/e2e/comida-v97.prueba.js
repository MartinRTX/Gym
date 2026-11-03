// v9.7: − / + cambian la porción (3 galletas sube todo parejo, sin avisos) y los platillos traen ingredientes editables
const BASE = process.env.E2E_URL || 'http://localhost:8770/';
const { chromium } = require('playwright');
const res = []; const ok = (n, c, x) => res.push((c ? '✓ ' : '✗ ') + n + (x !== undefined ? ' · ' + JSON.stringify(x).slice(0, 200) : ''));
(async () => {
  const b = await chromium.launch();
  const DATA = Object.assign({}, require('./datos.js'), { ia: true, scriptVersion: '8.5' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(d => { if (location.protocol === 'about:') return; localStorage.setItem('gym_api', JSON.stringify('https://script.google.com/macros/s/MOCK/exec')); localStorage.setItem('gym_key', '"demo"');
    localStorage.setItem('gym_data', JSON.stringify(d)); localStorage.setItem('gym_bienvenida', 'true'); localStorage.setItem('gym_tour', 'true'); }, DATA);
  await ctx.route('https://script.google.com/**', r => { let x = {}; try { x = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
    const res = x.action === 'data' ? DATA : x.action === 'comidaIA' ? { items: [
      { nombre: 'Ensalada de atún con pasta', gramos: 250, g: 22, c: 35, f: 8, k: 312, fib: 4, ingredientes: [
        { nombre: 'Pasta cocida', gramos: 120, g: 6, c: 30, f: 1, k: 158, fib: 2 }, { nombre: 'Atún en agua', gramos: 80, g: 15.5, c: 0, f: 0.8, k: 69, fib: 0 },
        { nombre: 'Mayonesa', gramos: 10, g: 0.1, c: 0.1, f: 7.5, k: 68, fib: 0 }, { nombre: 'Verduras', gramos: 40, g: 0.4, c: 4.9, f: 0, k: 17, fib: 2 }] },
      { nombre: 'Galleta salada grande', gramos: 20, piezas: 1, g_pieza: 20, g: 2, c: 14, f: 2, k: 82, fib: 1 }], consejo: '' } : [];
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, result: res }) }); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.waitForTimeout(1500);
  try {
    await p.evaluate(() => verTab('Comida'));
    await p.fill('#iaComida', 'ensalada de atún con pasta y una galleta'); await p.click('text=Calcular'); await p.waitForTimeout(600);
    const gal = p.locator('.iacard .iitem', { hasText: 'Galleta' });
    ok('La galleta se cuenta por piezas', /1 pza/.test(await gal.innerText()));
    await gal.locator('button[aria-label="Más"]').click(); await gal.locator('button[aria-label="Más"]').click(); await p.waitForTimeout(150);
    const g = await p.evaluate(() => COMIDA_IA.items[1]);
    ok('+ + → 3 galletas: 60 g, 6 g prot, 246 kcal (todo parejo)', g.piezas === 3 && g.gramos === 60 && g.g === 6 && g.k === 246, g);
    ok('Sin avisos de que no cuadra', !/no cuadran|pesan más/.test(await p.locator('.iacard').innerText()));
    // Ingredientes de la ensalada
    await p.locator('.iacard .ingtog').first().click(); await p.waitForTimeout(150);
    ok('La ensalada muestra sus 4 ingredientes', await p.locator('.iacard .ings .ing:not(.nuevo)').count() === 4);
    const atun = p.locator('.iacard .ing', { hasText: 'Atún' }).locator('input');
    await atun.fill('160'); await atun.dispatchEvent('change'); await p.waitForTimeout(150);
    const e = await p.evaluate(() => COMIDA_IA.items[0]);
    ok('Más atún (80 → 160 g) sube el plato: 330 g, 38 g prot', e.gramos === 330 && e.g === 38, [e.gramos, e.g, e.k]);
    await p.locator('.iacard .ing', { hasText: 'Mayonesa' }).locator('button[aria-label="Quitar"]').click(); await p.waitForTimeout(150);
    ok('Quitar la mayonesa le resta sus 68 kcal', await p.evaluate(() => COMIDA_IA.items[0].k === 312 + 69 - 68), await p.evaluate(() => COMIDA_IA.items[0].k));
    await p.fill('#ingNom0', 'aguacate'); await p.fill('#ingG0', '30'); await p.locator('.iacard .ing.nuevo button').first().click(); await p.waitForTimeout(400);
    ok('Agregar aguacate (del catálogo) lo suma', await p.evaluate(() => COMIDA_IA.items[0].ingredientes.some(i => /Aguacate/i.test(i.nombre))));
    await p.locator('.iacard .acts .btn:not(.ghost)').click(); await p.waitForTimeout(300);
    const r = await p.evaluate(() => { const reg = prot.map(regDe).filter(Boolean); return reg.map(x => ({ n: x.n, partes: (x.partes || []).length, k: x.k })); });
    ok('Se agrega con sus ingredientes (para la hoja) y la galleta como "3 pzas"', r.some(x => /Ensalada/.test(x.n) && x.partes === 4) && r.some(x => /Galleta.*3 pzas/.test(x.n) && x.k === 246), r);
  } catch (e) { ok('La prueba v9.7 terminó', false, e.message.split('\n')[0]); }
  ok('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log(res.join('\n'));
})();
