// v10.5: escribir y borrar en el buscador es fluido: la caja de texto NO se vuelve a pintar (antes cada tecla repintaba
// toda la hoja: el teclado de Android perdía lo que estaba escribiendo y el cursor brincaba); solo cambia la lista.
const BASE = process.env.E2E_URL || 'http://localhost:8770/';
const { chromium } = require('playwright');
const DATA = Object.assign({}, require('./datos.js'), { scriptVersion: '7.7', ia: true });
const casos = []; const ok = (n, c, info) => casos.push((c ? '✓ ' : '✗ ') + n + (info !== undefined ? ' · ' + JSON.stringify(info).slice(0, 300) : ''));
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(d => {
    localStorage.setItem('gym_api', JSON.stringify('https://script.google.com/macros/s/MOCK/exec')); localStorage.setItem('gym_key', JSON.stringify('demo'));
    localStorage.setItem('gym_data', JSON.stringify(d)); localStorage.setItem('gym_bienvenida', 'true'); localStorage.setItem('gym_tour', 'true');
  }, DATA);
  await ctx.route('https://script.google.com/**', r => {
    const body = JSON.parse(r.request().postData() || '{}');
    const res = body.action === 'data' ? DATA : body.action === 'batch' ? body.args[0].map(o => ({ id: o.id, ok: true })) : [];
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, result: res }) });
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + 'index.html'); await p.waitForTimeout(1500);
  await p.evaluate(() => { verTab('Comida'); abrirBuscador(); }); await p.waitForTimeout(800);
  await p.evaluate(() => { window.__caja = document.getElementById('busNut'); });
  await p.locator('#busNut').pressSequentially('fresas cong', { delay: 40 }); await p.waitForTimeout(300);
  let r = await p.evaluate(() => ({ misma: document.getElementById('busNut') === window.__caja, foco: document.activeElement === window.__caja, v: window.__caja.value,
    cursor: window.__caja.selectionStart, res: document.querySelectorAll('#busRes .bres').length, primero: (document.querySelector('#busRes .bres .nm') || {}).textContent || '' }));
  ok('Al escribir: la misma caja (no se repinta), con foco y el cursor al final', r.misma && r.foco && r.v === 'fresas cong' && r.cursor === 11, r);
  ok('Y la lista se actualiza', r.res > 0 && /Fresa/i.test(r.primero), r);
  // Borrar letras (y en medio del texto)
  await p.keyboard.press('Backspace'); await p.keyboard.press('Backspace'); await p.waitForTimeout(250);
  await p.evaluate(() => window.__caja.setSelectionRange(3, 3)); await p.keyboard.press('Backspace'); await p.waitForTimeout(250);
  r = await p.evaluate(() => ({ misma: document.getElementById('busNut') === window.__caja, v: window.__caja.value, cursor: window.__caja.selectionStart }));
  ok('Al borrar (también en medio): el cursor se queda donde estaba', r.misma && r.v === 'frsas co' && r.cursor === 2, r);
  // Borrar todo: vuelve a lo que usaste
  await p.fill('#busNut', ''); await p.waitForTimeout(250);
  ok('Sin texto: la lista de lo que usaste', /Escribe qué comiste|·/.test(await p.locator('#busRes').innerText()));
  // Escribir y elegir enseguida: el repintado pendiente no tapa la pantalla de cantidad
  await p.locator('#busNut').pressSequentially('avena', { delay: 10 });
  await p.evaluate(() => { const a = listaBusqueda().find(x => x.id === 'b:avena'); elegirNut(a.id); }); await p.waitForTimeout(300);
  ok('Elegir justo después de escribir: se queda la pantalla de cantidad', await p.locator('#sheet .cant').count() === 1 && !(await p.locator('#busNut').count()));
  ok('Sin errores de página', !errs.length, errs);
  console.log(casos.join('\n'));
  await b.close();
})();
