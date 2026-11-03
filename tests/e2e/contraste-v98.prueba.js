// v9.8: todo texto visible se lee (contraste ≥ 4.5:1, o 3:1 si es grande) en las pantallas principales, en claro y oscuro.
// No cuenta el logo (texto con degradado), los emojis ni las medallas (imagen de fondo).
const BASE = process.env.E2E_URL || 'http://localhost:8770/';
const { chromium } = require('playwright');
const res = []; const ok = (n, c, x) => res.push((c ? '✓ ' : '✗ ') + n + (x !== undefined ? ' · ' + JSON.stringify(x).slice(0, 300) : ''));
(async () => {
  const b = await chromium.launch();
  const DATA = Object.assign({}, require('./datos.js'), { ia: true, scriptVersion: '8.5' });
  const malos = {};
  for (const tema of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, serviceWorkers: 'block', colorScheme: tema });
    await ctx.addInitScript(d => { localStorage.setItem('gym_api', JSON.stringify('https://script.google.com/macros/s/MOCK/exec')); localStorage.setItem('gym_key', '"demo"');
      localStorage.setItem('gym_data', JSON.stringify(d)); localStorage.setItem('gym_bienvenida', 'true'); localStorage.setItem('gym_tour', 'true'); }, DATA);
    await ctx.route('https://script.google.com/**', r => { let x = {}; try { x = JSON.parse(r.request().postData() || '{}'); } catch (e) {} r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, result: x.action === 'data' ? DATA : [] }) }); });
    const p = await ctx.newPage(); await p.goto(BASE); await p.waitForTimeout(1300);
    const pantallas = [['Entrenar', () => { verTab('Entrenar'); }], ['Ejercicio', () => { const e = DATA.exercises.find(x => x.group === GRUPO); OPEN = null; abrir(e.name); }],
      ['Comida', () => verTab('Comida')], ['Progreso', () => verTab('Progreso')], ['Fuerza', () => verPTab('Fuerza')], ['Cuerpo', () => verPTab('Cuerpo')], ['Logros', () => verPTab('Logros')],
      ['Músculos', () => verTab('Musculos')], ['Coach', () => verTab('Coach')], ['Ajustes', () => abrirAjustes()]];
    for (const [n, f] of pantallas) {
      await p.evaluate(f); await p.waitForTimeout(350);
      const r = await p.evaluate(() => {
        const L = c => { const m = c.match(/[\d.]+/g); if (!m) return null; let [r, g, b, a] = m.map(Number); if (/^color\(srgb/.test(c)) { r *= 255; g *= 255; b *= 255; } return { r, g, b, a: a === undefined ? 1 : a }; };
        const lum = c => [c.r, c.g, c.b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
        const fondo = el => { let col = { r: 0, g: 0, b: 0, a: 0 }; const capas = []; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage !== 'none') return null; const c = L(cs.backgroundColor); if (c && c.a > 0) { capas.push(c); if (c.a >= 1) break; } }
          const base = L(getComputedStyle(document.body).backgroundColor); let res = base; for (let i = capas.length - 1; i >= 0; i--) { const c = capas[i]; res = { r: c.r * c.a + res.r * (1 - c.a), g: c.g * c.a + res.g * (1 - c.a), b: c.b * c.a + res.b * (1 - c.a) }; } return res; };
        const out = [];
        const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && Number(getComputedStyle(el).opacity) > 0.5; };
        document.querySelectorAll('body *').forEach(el => {
          const txt = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).map(n => n.textContent.trim()).join(' ');
          if (!txt || !visible(el) || el.closest('svg,#modal:not(.show),.brand,.med') || !/[A-Za-zÁÉÍÓÚáéíóúñÑ0-9]/.test(txt)) return;
          const cs = getComputedStyle(el), fg = L(cs.color), bg = fondo(el); if (!fg || !bg) return;
          const f2 = fg.a < 1 ? { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) } : fg;
          let op = 1; for (let e = el; e; e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
          const a = lum(f2), z = lum(bg), cr = (Math.max(a, z) + 0.05) / (Math.min(a, z) + 0.05), px = parseFloat(cs.fontSize), grande = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
          if (cr * (op < 1 ? op : 1) < (grande ? 3 : 4.5) && !el.closest('.off,[disabled]')) out.push({ t: txt.slice(0, 30), cls: (el.className && el.className.baseVal === undefined ? el.className : '') + ' < ' + (el.parentElement.className || el.parentElement.tagName), cr: Math.round(cr * 100) / 100, px: px, op: Math.round(op * 100) / 100 });
        });
        return out;
      });
      r.forEach(x => { const k = tema + ' · ' + x.cls; (malos[k] = malos[k] || []).push(n + ': «' + x.t + '» ' + x.cr + ':1 ' + x.px + 'px' + (x.op < 1 ? ' op ' + x.op : '')); });
      await p.evaluate(() => { try { cerrarModal(); } catch (e) {} });
    }
    await ctx.close();
  }
  const lista = Object.keys(malos).map(k => k + ' → ' + malos[k][0]);
  ok('Todo el texto se lee en claro y oscuro (' + lista.length + ' con poco contraste)', !lista.length, lista);
  await b.close();
  console.log(res.join('\n'));
})();
