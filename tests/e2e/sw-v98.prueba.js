// v9.8: el service worker sirve SIEMPRE una versión completa. Publicar un app.js nuevo no se mezcla con la versión
// instalada; llega completo cuando cambia sw.js (VERSION) y la app se recarga sola una vez.
const arrancar = require('./servidor.js');
const { chromium } = require('playwright');
const res = []; const ok = (n, c, x) => res.push((c ? '✓ ' : '✗ ') + n + (x !== undefined ? ' · ' + JSON.stringify(x).slice(0, 200) : ''));
(async () => {
  // Servidor propio: así se puede "publicar" una versión nueva a media prueba
  const cambios = {}, srv = await arrancar(0, cambios), BASE = srv.url;
  const b = await chromium.launch();
  const DATA = Object.assign({}, require('./datos.js'), { ia: true, scriptVersion: '8.5' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(d => { if (location.protocol === 'about:') return; localStorage.setItem('gym_api', JSON.stringify('https://script.google.com/macros/s/MOCK/exec')); localStorage.setItem('gym_key', '"demo"');
    localStorage.setItem('gym_data', JSON.stringify(d)); localStorage.setItem('gym_bienvenida', 'true'); localStorage.setItem('gym_tour', 'true'); }, DATA);
  await ctx.route('https://script.google.com/**', r => { let x = {}; try { x = JSON.parse(r.request().postData() || '{}'); } catch (e) {} r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, result: x.action === 'data' ? DATA : [] }) }); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  try {
    await p.goto(BASE); await p.evaluate(() => navigator.serviceWorker.ready); await p.reload(); await p.waitForTimeout(800);
    ok('La app queda controlada por el service worker', await p.evaluate(() => !!navigator.serviceWorker.controller));
    // "Se publica" un app.js nuevo, pero sw.js no cambia: la app sigue con la versión instalada completa
    cambios['/app.js'] = t => t + '\n/*NUEVO*/';
    await p.reload(); await p.waitForTimeout(800);
    const v1 = await p.evaluate(async () => ({ servido: (await (await fetch('app.js')).text()).includes('/*NUEVO*/'),
      guardado: (await (await (await caches.open((await caches.keys()).find(k => /^gym-v/.test(k)))).match('app.js')).text()).includes('/*NUEVO*/') }));
    ok('Un archivo nuevo suelto no se mezcla con la versión instalada', !v1.servido && !v1.guardado, v1);
    // Cambia sw.js (VERSION): se instala la versión nueva completa y la app se recarga sola
    cambios['/sw.js'] = t => t.replace(/const VERSION = '([^']+)'/, "const VERSION = '$1-prueba'");
    const recargo = p.waitForEvent('load', { timeout: 15000 }).then(() => true).catch(() => false);
    await p.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()));
    const r2 = await recargo; await p.waitForTimeout(800);
    const v2 = await p.evaluate(async () => ({ servido: (await (await fetch('app.js')).text()).includes('/*NUEVO*/'), caches: await caches.keys() }));
    ok('Con sw.js nuevo llega la versión completa y la app se recarga una vez', r2 && v2.servido && v2.caches.some(k => /-prueba$/.test(k)) && !v2.caches.some(k => /^gym-v[\d.]+$/.test(k)), [r2, v2]);
  } catch (e) { ok('La prueba del service worker terminó', false, e.message.split('\n')[0]); }
  ok('Sin errores de página', !errs.length, errs);
  await b.close(); srv.cerrar();
  console.log(res.join('\n'));
})();
