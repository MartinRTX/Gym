// v9.5: un solo color para lo que se toca, el color del día solo en el encabezado, textos sin jerga y "Siguiente · Empezar"
const BASE = process.env.E2E_URL || 'http://localhost:8770/';
const { chromium } = require('playwright');
const res = []; const ok = (n, c, x) => res.push((c ? '✓ ' : '✗ ') + n + (x !== undefined ? ' · ' + JSON.stringify(x).slice(0, 200) : ''));
(async () => {
  const b = await chromium.launch();
  const DATA = Object.assign({}, require('./datos.js'), { ia: true, scriptVersion: '8.4' });
  for (const tema of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', colorScheme: tema });
    await ctx.addInitScript(d => { if (location.protocol === 'about:') return; localStorage.setItem('gym_api', JSON.stringify('https://script.google.com/macros/s/MOCK/exec')); localStorage.setItem('gym_key', '"demo"');
      localStorage.setItem('gym_data', JSON.stringify(d)); localStorage.setItem('gym_bienvenida', 'true'); localStorage.setItem('gym_tour', 'true'); }, DATA);
    await ctx.route('https://script.google.com/**', r => { let x = {}; try { x = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
      r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, result: x.action === 'data' ? DATA : [] }) }); });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE); await p.waitForTimeout(1500);
    try {
      await p.evaluate(() => { verTab('Entrenar'); elegirGrupo('Push'); OPEN = null; pintarEntrenar(); }); await p.waitForTimeout(300);
      const c = await p.evaluate(() => {
        const col = el => el ? getComputedStyle(el).color : null, bg = el => el ? getComputedStyle(el).backgroundColor : null;
        const tmp = document.createElement('div'); tmp.style.color = 'var(--act)'; document.body.appendChild(tmp); const act = getComputedStyle(tmp).color; tmp.style.color = 'var(--acc)'; const acc = getComputedStyle(tmp).color; tmp.remove();
        return { act: act, acc: acc, titulo: col(document.querySelector('.hoy .grupo b')), empezar: bg(document.querySelector('.ex.sig .empezar')), nav: bg(document.querySelector('#nav button.on .bola')) };
      });
      ok(tema + ': el nombre del día va en su color (Push naranja)', c.titulo === c.acc, c);
      ok(tema + ': "Empezar" y la barra van en el color de acción', c.empezar === c.act && c.nav === c.act, c);
      const t = await p.evaluate(() => ({ sig: !!document.querySelector('.ex.sig .sigtxt'), n: document.querySelectorAll('.empezar').length, enc: document.querySelector('.hoy').textContent, h2: [...document.querySelectorAll('#vEntrenar h2')].map(x => x.textContent).join('|') }));
      ok(tema + ': una sola tarjeta "Siguiente · Empezar"', t.sig && t.n === 1, t);
      ok(tema + ': encabezado sin "bloque" y con lo que trabaja', /pecho, hombros y tríceps/.test(t.enc) && !/bloque/i.test(t.enc), t.enc);
      ok(tema + ': secciones con nombres claros', /Recomendados para hoy/.test(t.h2) && !/Recomendado ·/.test(t.h2), t.h2);
      // Al abrir otra tarjeta ya no hay "Empezar"; en la búsqueda tampoco
      await p.locator('.ex.sig .empezar').click(); await p.waitForTimeout(250);
      ok(tema + ': al empezar se abre y el botón se va', await p.evaluate(() => !!OPEN && !document.querySelector('.empezar')));
      await p.evaluate(() => { OPEN = null; abrirBuscar(); buscar('press'); }); await p.waitForTimeout(250);
      ok(tema + ': en la búsqueda no aparece "Empezar"', await p.evaluate(() => !document.querySelector('.empezar')));
      await p.evaluate(() => cerrarBuscar());
      // Contraste del texto de los botones: al menos 4.5 a 1
      const r = await p.evaluate(() => {
        const L = s => { const [r, g, b] = s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
        const el = document.querySelector('.btn:not(.ghost):not(.acc):not(.verde)'); const a = L(getComputedStyle(el).color), z = L(getComputedStyle(el).backgroundColor);
        return Math.round((Math.max(a, z) + 0.05) / (Math.min(a, z) + 0.05) * 10) / 10;
      });
      ok(tema + ': los botones se leen bien (contraste ' + r + ':1)', r >= 4.5, r);
      // Músculos: nombre de todos con el técnico entre paréntesis
      await p.evaluate(() => verTab('Musculos')); await p.waitForTimeout(250);
      ok(tema + ': músculos con nombre sencillo', /Espalda ancha \(dorsal\)|Hombro de|Muslo de/.test(await p.locator('#vMusculos').innerText()));
    } catch (e) { ok(tema + ': la prueba terminó', false, e.message.split('\n')[0]); }
    ok(tema + ': sin errores de página', !errs.length, errs);
    await ctx.close();
  }
  await b.close();
  console.log(res.join('\n'));
})();
