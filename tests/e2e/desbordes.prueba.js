// Mide desbordes horizontales al cambiar de músculo, en varios anchos
const BASE = process.env.E2E_URL || 'http://localhost:8770/';
const TMP = require('os').tmpdir();
const res = []; const ok = (n, c, x) => res.push((c ? '✓ ' : '✗ ') + n + (x !== undefined ? ' · ' + JSON.stringify(x).slice(0, 160) : ''));
const IMAGEN = require('path').join(__dirname, '..', '..', 'icon-512.png');
const { chromium } = require('playwright');
const DATA = require('./datos.js');
(async () => {
  const b = await chromium.launch();
  for (const w of [320, 360, 412]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await ctx.addInitScript(d => { localStorage.setItem('gym_api', JSON.stringify('https://script.google.com/macros/s/MOCK/exec')); localStorage.setItem('gym_key', '"demo"');
      localStorage.setItem('gym_data', JSON.stringify(d)); localStorage.setItem('gym_bienvenida', 'true'); if (!window.__conTour) localStorage.setItem('gym_tour', 'true'); }, DATA);
    await ctx.route('https://script.google.com/**', r => { let a = ''; try { a = r.request().method() === 'GET' ? new URL(r.request().url()).searchParams.get('action') : JSON.parse(r.request().postData() || '{}').action; } catch (e) {}
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, result: a === 'data' ? DATA : [] }) }); });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.clock.install({ time: new Date(process.env.HORA || '2026-10-25T08:30:00') });
    await p.goto(BASE); await p.waitForTimeout(1200);
    const zonas = await p.evaluate(() => ZONAS);
    let peor = [];
    for (const m of zonas) {
      await p.evaluate(m => elegirMusculo(m), m); await p.waitForTimeout(60);
      if (Number(process.env.ZOOM || 1.3) !== 1) await p.evaluate(z => { const els = [...document.querySelectorAll('#sheet *')], fs = els.map(e => parseFloat(getComputedStyle(e).fontSize)); els.forEach((e, i) => e.style.fontSize = fs[i] * z + 'px'); }, Number(process.env.ZOOM || 1.3));
      const r = await p.evaluate(() => {
        const sh = document.querySelector('#sheet').getBoundingClientRect(), out = [];
        document.querySelectorAll('#sheet *').forEach(el => { const q = el.getBoundingClientRect(); if (q.width && q.right > sh.right + 1) out.push(el.tagName + '.' + el.className + ' "' + (el.textContent || '').slice(0, 40) + '" +' + Math.round(q.right - sh.right)); });
        return { doc: document.documentElement.scrollWidth, sheet: document.querySelector('#sheet').scrollWidth - document.querySelector('#sheet').clientWidth, out: out.slice(0, 4) };
      });
      if (r.doc > w || r.sheet > 0 || r.out.length) peor.push(m + ': doc ' + r.doc + ' sheetX ' + r.sheet + ' ' + r.out.join(' | '));
      if (process.env.SHOT === m) await p.screenshot({ path: TMP + '/mus-' + w + '.png' });
    }
    ok('Elegir músculo a ' + w + 'px: nada se sale de la pantalla', !peor.length, peor.slice(0, 3));
    ok('Sin errores de página a ' + w + 'px', !errs.length, errs);
    await ctx.close();
  }
  await b.close();
  console.log(res.join('\n'));
})();
