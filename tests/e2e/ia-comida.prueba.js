const BASE = process.env.E2E_URL || 'http://localhost:8770/';
const TMP = require('os').tmpdir();
const res = []; const ok = (n, c, x) => res.push((c ? '✓ ' : '✗ ') + n + (x !== undefined ? ' · ' + JSON.stringify(x).slice(0, 160) : ''));
const IMAGEN = require('path').join(__dirname, '..', '..', 'icon-512.png');
const { chromium } = require('playwright');
const DATA = require('./datos.js'); DATA.ia = true;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(d => { localStorage.setItem('gym_api', JSON.stringify('https://script.google.com/macros/s/MOCK/exec')); localStorage.setItem('gym_key', '"demo"');
    localStorage.setItem('gym_data', JSON.stringify(d)); localStorage.setItem('gym_bienvenida', 'true'); if (!window.__conTour) localStorage.setItem('gym_tour', 'true'); }, DATA);
  await ctx.route('https://script.google.com/**', async r => {
    let a = '', body = {}; try { body = JSON.parse(r.request().postData() || '{}'); a = r.request().method() === 'GET' ? new URL(r.request().url()).searchParams.get('action') : body.action; } catch (e) {}
    if (a === 'comidaIA') {
      const t = JSON.stringify(body).toLowerCase();
      if (t.includes('lento')) { await new Promise(x => setTimeout(x, 2500)); return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, result: { items: [{ nombre: 'VIEJO', g: 99, k: 500 }] } }) }); }
      if (t.includes('xyz')) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'No identifiqué alimentos; descríbelo un poco más' }) });
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, result: { items: [{ nombre: 'Coca 600 ml', gramos: 600, g: 0, c: 63, f: 0, k: 252 }, { nombre: 'Tacos de asada', g: 24, c: 40, f: 18, k: 420 }], consejo: 'ok' } }) });
    }
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, result: a === 'data' ? DATA : [] }) });
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.waitForTimeout(1200);
  await p.evaluate(() => verTab('Comida')); await p.waitForTimeout(300);
  await p.fill('#iaComida', 'algo lento'); await p.click('text=Calcular'); await p.waitForTimeout(300);
  ok('Mientras calcula se puede volver a preguntar', await p.locator('text=Preguntar de nuevo').count() > 0);
  await p.fill('#iaComida', 'una coca y 3 tacos de asada'); await p.click('text=Preguntar de nuevo'); await p.waitForTimeout(3200);
  const items = await p.evaluate(() => COMIDA_IA.items.map(x => x.nombre).join(', '));
  ok('La respuesta vieja se ignora y queda la nueva', items === 'Coca 600 ml, Tacos de asada', items);
  const boton = await p.locator('.iacard .acts .btn:not(.ghost)').innerText();
  ok('El botón suma proteína y calorías', /\+24 g · 672 kcal/.test(boton), boton);
  await p.screenshot({ path: TMP + '/ia-items.png' });
  await p.locator('.iacard .iitem .mini.on').nth(1).click(); await p.waitForTimeout(200);   // quita los tacos: queda solo la coca
  ok('Algo sin proteína (refresco) se puede agregar', await p.locator('.iacard .acts .btn:not(.ghost)').isEnabled());
  await p.locator('.iacard .acts .btn:not(.ghost)').click(); await p.waitForTimeout(300);
  ok('Quedó anotado en el día', await p.evaluate(() => prot.length === 1));
  await p.fill('#iaComida', 'xyz frijoles de la olla, tortillas de maiz'); await p.click('text=Calcular'); await p.waitForTimeout(2500);
  const err = await p.evaluate(() => COMIDA_IA.error), loc = await p.evaluate(() => (COMIDA_IA.locales || []).map(a => a.n).join(' / '));
  ok('Si la IA no reconoce la comida, lo dice y ofrece el catálogo', /No se pudo calcular/.test(err) && /Frijol/i.test(loc) && /Tortilla/i.test(loc), loc);
  await p.screenshot({ path: TMP + '/ia-error.png' });
  ok('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log(res.join('\n'));
})();
