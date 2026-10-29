const BASE = process.env.E2E_URL || 'http://localhost:8770/';
const TMP = require('os').tmpdir();
const IMAGEN = require('path').join(__dirname, '..', '..', 'icon-512.png');
const { chromium } = require('playwright');
const base = require('./datos.js');
const variantes = {
  'sin trotes/resumen/cuerpo/dias': Object.assign({}, base, { scriptVersion: '7.7', ia: true, trotes: undefined, resumen: undefined, cuerpo: undefined, dias: undefined, ultimoPeso: null }),
  'script 7.7 con nutrición vacía y comidas de hoy': Object.assign({}, base, { scriptVersion: '7.7', ia: true, nutricion: { ts: 5, recetas: [], productos: [], tuppers: {}, metas: null },
    comidasDias: { [new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10)]: [{ h: '08:00', m: 'd', n: 'Mi licuado', q: null, u: '', p: 41, c: 80, f: 13, k: 576, fib: 12, src: 'receta', ref: 'licuado', id: '' }] },
    macros7: null, comidas: [{ t: 'Tacos  asada', g: 27, c: 45, f: 25, k: 520, fib: 4 }, { t: 'Viejo', g: 10 }], diaTipico: ['Licuado', 'Tacos  asada (27 g)', 'Scoop'] }),
  'script 7.6 sin nada nuevo': Object.assign({}, base, { scriptVersion: '7.6', ia: false, comidas: null, diaTipico: null, dueno: false }),
  'nutrición con receta sin items': Object.assign({}, base, { scriptVersion: '7.7', nutricion: { ts: 9e12, recetas: [{ id: 'licuado', n: 'Mi licuado' }], productos: null, tuppers: null, metas: { k: 2100 } } })
};
(async () => {
  const b = await chromium.launch();
  for (const [nom, DATA] of Object.entries(variantes)) {
    const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 412, height: 915 } });
    await ctx.addInitScript(d => {
      localStorage.setItem('gym_api', JSON.stringify('https://script.google.com/macros/s/MOCK/exec')); localStorage.setItem('gym_key', JSON.stringify('demo'));
      localStorage.setItem('gym_data', JSON.stringify(d)); localStorage.setItem('gym_bienvenida', 'true'); if (!window.__conTour) localStorage.setItem('gym_tour', 'true');
      const k = new Date(); const dia = k.getFullYear() + '-' + String(k.getMonth() + 1).padStart(2, '0') + '-' + String(k.getDate()).padStart(2, '0');
      if (d.dueno !== false) localStorage.setItem('gym_prot_' + dia, JSON.stringify(['Licuado', 'Tacos de asada (27 g)', 'Scoop']));

    }, DATA);
    await ctx.route('https://script.google.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, result: JSON.parse(r.request().postData() || '{}').action === 'data' ? DATA : [] }) }));
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + 'index.html'); await p.waitForTimeout(1500);
    const r = await p.evaluate(() => { try { verTab('Comida'); } catch (e) { return 'verTab: ' + e.message; } return { siempre: !!document.querySelector('.siempre3'), macros: !!document.querySelector('.macros'), ring: !!document.querySelector('.ring'), txt: document.querySelector('#vComida').textContent.length }; });
    let r2 = null; try { r2 = await p.evaluate(() => { abrirReceta('licuado'); const a = !!document.querySelector('.rec'); cerrarModal(); abrirTupper(); cerrarModal(); abrirCenas(); cerrarModal(); abrirMetas(); cerrarModal(); return a; }); } catch (e) { r2 = 'ERR ' + e.message.split('\n')[0]; }
    console.log((errs.length || !r.siempre ? '✗ ' : '✓ ') + nom, JSON.stringify(r), r2, errs.join(' | '));
    await ctx.close();
  }
  await b.close();
})();
