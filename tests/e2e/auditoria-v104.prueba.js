// v10.4 (auditoría): la subida no se queda colgada, se pide guardado persistente, zonas de toque más grandes y campos con etiqueta
const BASE = process.env.E2E_URL || 'http://localhost:8770/';
const { chromium } = require('playwright');
const res = []; const ok = (n, c, x) => res.push((c ? '✓ ' : '✗ ') + n + (x !== undefined ? ' · ' + JSON.stringify(x).slice(0, 200) : ''));
(async () => {
  const b = await chromium.launch();
  const DATA = JSON.parse(JSON.stringify(require('./datos.js')));
  Object.assign(DATA, { ia: true, scriptVersion: '8.6' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(d => {
    if (location.protocol === 'about:') return;
    // Se anota si la app pide guardado persistente
    window.__persist = 0;
    try { Object.defineProperty(navigator, 'storage', { configurable: true, value: { persisted: () => Promise.resolve(false), persist: () => { window.__persist++; return Promise.resolve(true); } } }); } catch (e) {}
    localStorage.setItem('gym_api', JSON.stringify('https://script.google.com/macros/s/MOCK/exec')); localStorage.setItem('gym_key', '"demo"');
    localStorage.setItem('gym_data', JSON.stringify(d)); localStorage.setItem('gym_bienvenida', 'true'); localStorage.setItem('gym_tour', 'true');
  }, DATA);
  // Mientras "colgar" sea true, la subida (batch) nunca contesta, como cuando Google no responde
  let colgar = false, lotes = 0;
  await ctx.route('https://script.google.com/**', r => {
    let x = {}; try { x = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
    if (x.action === 'batch') { lotes++; if (colgar) return; return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, result: x.args[0].map(o => ({ id: o.id, ok: true })) }) }); }
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, result: x.action === 'data' ? DATA : [] }) });
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.waitForTimeout(1500);
  try {
    ok('Al abrir pide guardado persistente (para que no se borren fotos ni pendientes)', await p.evaluate(() => window.__persist) === 1);

    // 3. Subida colgada: con el tope corto, deja de decir "Subiendo…", el dato sigue pendiente y luego se sube
    colgar = true;
    await p.evaluate(() => { LIMITE_SUBIDA = 1200; clearTimeout(flushTimer); encolar('savePeso', [80.5, hoy()], 'peso-prueba'); enviar(); });
    await p.waitForTimeout(400);
    const durante = await p.evaluate(() => ({ subiendo: flushing, txt: $('sync').textContent }));
    await p.waitForTimeout(1500);
    const despues = await p.evaluate(() => ({ subiendo: flushing, pend: cola().length, txt: $('sync').textContent }));
    ok('Si Google no contesta, la subida se corta sola y el dato queda pendiente (no se pierde)', durante.subiendo && !despues.subiendo && despues.pend === 1 && /sin subir/.test(despues.txt), { durante, despues });
    colgar = false;
    await p.evaluate(() => { clearTimeout(flushTimer); return enviar(); }); await p.waitForTimeout(300);
    ok('Al reintentar con señal, se sube y la cola queda vacía', await p.evaluate(() => cola().length) === 0 && lotes >= 2);

    // 7. Zonas de toque: 10 px arriba de un enlace (fuera de su texto) todavía es el enlace
    await p.evaluate(() => verTab('Comida')); await p.waitForTimeout(200);
    const toque = await p.evaluate(() => {
      const prueba = sel => { const el = document.querySelector(sel); if (!el) return 'no hay ' + sel; el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect(), y = r.top - 10, x = r.left + Math.min(20, r.width / 2), t = document.elementFromPoint(x, y);
        return t && (t === el || el.contains(t)) ? true : (t ? t.className || t.tagName : 'nada') + ' (' + Math.round(r.height) + ' px)'; };
      const out = { repetir: prueba('#vComida button.link[data-click="abrirRepetir"]') };
      verTab('Entrenar'); out.tecnica = prueba('#vEntrenar .vidbtn');
      return out;
    });
    ok('Los enlaces y el ▶ de técnica se atinan aunque toques un poco arriba (zona de ~44 px)', toque.repetir === true && toque.tecnica === true, toque);

    // 7. Campos con etiqueta para lectores de pantalla
    await p.evaluate(() => { verTab('Progreso'); verPTab('Fuerza'); }); await p.waitForTimeout(200);
    const sel = await p.evaluate(() => { const s = document.querySelector('#vProgreso select'); return s ? s.getAttribute('aria-label') : 'sin lista'; });
    await p.evaluate(() => abrirAjustes()); await p.waitForTimeout(150);
    const fecha = await p.evaluate(() => $('carFecha').getAttribute('aria-label'));
    ok('La lista de la gráfica de fuerza y la fecha de la carrera tienen etiqueta', !!sel && sel !== 'sin lista' && !!fecha, { sel, fecha });
    await p.evaluate(() => cerrarModal());
  } catch (e) { ok('Recorrido completo', false, e.message.split('\n')[0]); }
  ok('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log(res.join('\n'));
})();
