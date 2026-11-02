// v9.4: corregir lo que ya anotaste, lo de siempre a esta hora, repetir una comida de otro día, mantenimiento real,
// guardar como receta lo que contestó la IA y marcar cosas muy grandes
const BASE = process.env.E2E_URL || 'http://localhost:8770/';
const { chromium } = require('playwright');
const res = []; const ok = (n, c, x) => res.push((c ? '✓ ' : '✗ ') + n + (x !== undefined ? ' · ' + JSON.stringify(x).slice(0, 200) : ''));

(async () => {
  const b = await chromium.launch();
  const DATA = Object.assign({}, require('./datos.js'), { ia: true, scriptVersion: '8.4', macros7: { dias: 6, kcal: 1840, prot_g: 118, carbs_g: 197, grasa_g: 68, fibra_g: 21 } });
  DATA.resumen = Object.assign({}, DATA.resumen, { cambioSemana: 0, promedio7: 74.3 });
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
  try {
    await p.evaluate(() => verTab('Comida')); await p.waitForTimeout(200);
    // 1 y 7. Una pizza entera sale marcada; tocarla deja corregirla (½) y la hoja recibe lo corregido
    await p.evaluate(() => { agregarAProt([nuevoRegistro({ n: 'Pizza mexicana', q: 660, u: 'g', src: 'ia', p: 54, c: 198, f: 42, k: 1386 })], [comidaActual()]); cambiarProt(); });
    await p.waitForTimeout(200);
    ok('Algo de 1,386 kcal sale marcado ⚠️ en el día', await p.locator('.eaten button.grande', { hasText: 'Pizza mexicana' }).count() === 1);
    await p.locator('.eaten button', { hasText: 'Pizza mexicana' }).click(); await p.waitForTimeout(200);
    ok('Al tocarla: aviso de que es mucho y opciones para corregir', /1,386 kcal en una sola cosa/.test(await p.locator('#sheet').innerText()));
    await p.locator('#sheet .tch').first().click(); await p.waitForTimeout(100);
    await p.locator('#sheet .btn', { hasText: 'Guardar' }).click(); await p.waitForTimeout(250);
    const piz = await p.evaluate(() => { const k = prot[prot.length - 1], r = regDe(k), op = cola().filter(o => o.action === 'saveComidas').pop(); return { p: r.p, k: r.k, q: r.q, hoja: op.args[1].find(x => /Pizza/.test(x.n)) }; });
    ok('½: 330 g, 27 g de proteína, 693 kcal, y así va a la hoja', piz.p === 27 && piz.k === 693 && piz.q === 330 && piz.hoja.k === 693, piz);
    // Corregir un macro recalcula las kcal
    await p.locator('.eaten button', { hasText: 'Pizza mexicana' }).click(); await p.waitForTimeout(150);
    const prt = p.locator('#sheet .pc', { hasText: 'Proteína' }).locator('input'); await prt.fill('30'); await prt.dispatchEvent('change'); await p.waitForTimeout(100);
    ok('Cambiar la proteína recalcula las kcal', await p.evaluate(() => ITEM_ED.k2 === Math.round(4 * 30 + 4 * 99 + 9 * 21)), await p.evaluate(() => ITEM_ED.k2));
    await p.locator('#sheet .btn.ghost', { hasText: 'Quitar' }).click(); await p.waitForTimeout(200);
    ok('Y se puede quitar desde ahí', await p.evaluate(() => !prot.some(k => /Pizza/.test(tDe(k)))));

    // 2. Lo de siempre a esta hora (2 de los últimos días en esta comida)
    await p.evaluate(() => {
      const m = comidaActual();
      [1, 2].forEach(d => { const dia = sumarDias(hoy(), -d); LS.set('gym_prot_' + dia, [nuevoRegistro({ n: 'Avena con leche', q: 250, u: 'g', src: 'ia', p: 15, c: 50, f: 8, k: 330 })]); LS.set('gym_protmeal_' + dia, [m]); });
      pintarComida();
    });
    await p.waitForTimeout(200);
    ok('Sugiere lo que sueles comer a esta hora', await p.locator('.habitos .tch', { hasText: 'Avena con leche' }).count() === 1);
    await p.locator('.habitos .tch', { hasText: 'Avena con leche' }).click(); await p.waitForTimeout(200);
    ok('Un toque y queda anotado (y deja de sugerirse)', await p.evaluate(() => prot.some(k => /Avena con leche/.test(tDe(k)))) && await p.locator('.habitos .tch', { hasText: 'Avena con leche' }).count() === 0);

    // 3. Repetir una comida de otro día
    await p.locator('button', { hasText: 'Repetir una comida de otro día' }).click(); await p.waitForTimeout(200);
    const n0 = await p.evaluate(() => prot.length);
    ok('Lista las comidas de días pasados con su total', /15 g · 330 kcal/.test(await p.locator('#sheet').innerText()));
    await p.locator('#sheet .repcom').first().click(); await p.waitForTimeout(200);
    ok('Tocar una la agrega hoy', await p.evaluate(n => prot.length === n + 1, n0));

    // 5. Mantenimiento real en las metas
    await p.evaluate(() => abrirMetas()); await p.waitForTimeout(200);
    const mt = await p.locator('#sheet').innerText();
    ok('Metas: mantenimiento real con tus datos (1,840) y aviso si es mucho menos que la fórmula', /mantenimiento real anda en ~1,840 kcal/.test(mt) && /algo no se esté anotando/.test(mt), mt.slice(0, 300));
    await p.evaluate(() => cerrarModal());
    ok('Las metas que van a Panel llevan el mantenimiento real', await p.evaluate(() => { localStorage.removeItem('gym_metas_env'); mandarMetasGym(); const o = cola().filter(x => x.tag === 'metas-gym').pop(); return o && o.args[0].metasGym.mantReal === 1840; }));

    // 6. Guardar como receta lo que contestó la IA
    await p.evaluate(() => { COMIDA_IA = { texto: 'molletes', items: [{ nombre: 'Bolillo', gramos: 120, g: 12, c: 60, f: 5, k: 330, on: true }, { nombre: 'Frijoles con soya', gramos: 150, g: 15, c: 23, f: 3, k: 176, on: true }] }; pintarComida(); });
    await p.locator('.iacard button', { hasText: 'Guardar como receta' }).click(); await p.waitForTimeout(150);
    await p.fill('#recNom', 'Molletes con soya'); await p.locator('#sheet .btn', { hasText: 'Guardar' }).click(); await p.waitForTimeout(250);
    const rec = await p.evaluate(() => { const r = nutCfg().recetas.find(x => x.n === 'Molletes con soya'); return r && { items: r.items.length, tot: NUT.receta(r, resolver).tot }; });
    ok('Queda como receta con sus 2 cosas y los mismos macros', rec && rec.items === 2 && Math.round(rec.tot.p) === 27 && Math.abs(rec.tot.k - 506) <= 2, rec);
    ok('Aparece en Mis comidas y se agrega con un toque', await p.locator('.foods .food', { hasText: 'Molletes con soya' }).count() === 1);
    const n1 = await p.evaluate(() => prot.length);
    await p.locator('.foods .food', { hasText: 'Molletes con soya' }).click(); await p.waitForTimeout(200);
    ok('Agregarla suma 27 g', await p.evaluate(n => prot.length === n + 1 && Math.round(macrosDe(prot[prot.length - 1]).p) === 27, n1));
  } catch (e) { ok('La prueba de comida v9.4 terminó', false, e.message.split('\n')[0]); }
  ok('Sin errores de página', !errs.length, errs);
  await ctx.close();

  // 4. Aviso de calorías a las 9 pm (APK simulado: se anotan las notificaciones que se programan)
  const ctx2 = await b.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx2.addInitScript(d => {
    if (location.protocol === 'about:') return;
    window.__notis = [];
    window.Capacitor = { isNativePlatform: () => true, addListener: () => {}, Plugins: {},
      nativePromise: (pl, m, o) => { if (pl === 'LocalNotifications' && m === 'schedule') window.__notis.push(...o.notifications); return Promise.resolve(null); } };
    localStorage.setItem('gym_api', JSON.stringify('https://script.google.com/macros/s/MOCK/exec')); localStorage.setItem('gym_key', '"demo"');
    localStorage.setItem('gym_data', JSON.stringify(d)); localStorage.setItem('gym_bienvenida', 'true'); localStorage.setItem('gym_tour', 'true');
  }, DATA);
  await ctx2.route('https://script.google.com/**', r => { let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, result: body.action === 'data' ? DATA : [] }) }); });
  const p2 = await ctx2.newPage(); const errs2 = []; p2.on('pageerror', e => errs2.push(e.message));
  await p2.clock.install({ time: new Date(new Date().setHours(15, 0, 0, 0)) });
  await p2.goto(BASE); await p2.waitForTimeout(1500);
  try {
    const n = await p2.evaluate(async () => {
      verTab('Comida');
      agregarAProt([nuevoRegistro({ n: 'Comida corrida', q: 400, u: 'g', src: 'ia', p: 30, c: 60, f: 20, k: 540 })], [comidaActual()]); cambiarProt();
      window.__notis = []; programarAvisoProt(); await new Promise(r => setTimeout(r, 300));
      const x = window.__notis.find(z => z.id === 96); return x && { t: x.title, h: new Date(x.schedule.at).getHours() };
    });
    ok('9 pm: «te faltan ~X kcal» si vas muy abajo de tu meta', n && n.h === 21 && /te faltan ~/.test(n.t), n);
    const sin = await p2.evaluate(async () => { setAjuste('avisoKcal', false); window.__notis = []; programarAvisoProt(); await new Promise(r => setTimeout(r, 300)); return window.__notis.some(z => z.id === 96); });
    ok('Se puede apagar en Ajustes', !sin);
  } catch (e) { ok('Aviso de calorías', false, e.message.split('\n')[0]); }
  ok('Sin errores de página (APK simulado)', !errs2.length, errs2);
  await b.close();
  console.log(res.join('\n'));
})();
