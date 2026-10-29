// Pruebas de los arreglos de la auditoría (lote 1) en el navegador: node prueba76.js
const BASE = process.env.E2E_URL || 'http://localhost:8770/';
const TMP = require('os').tmpdir();
const IMAGEN = require('path').join(__dirname, '..', '..', 'icon-512.png');
const { chromium } = require('playwright');
const DATA = require('./datos.js');
const URL0 = BASE + 'index.html';
const API_OK = 'https://script.google.com/macros/s/MOCK/exec';
const resultados = [];
const ok = (nombre, cond, extra) => { resultados.push((cond ? '✓ ' : '✗ ') + nombre + (extra ? ' · ' + extra : '')); };

async function abrir(b, o) {
  o = o || {};
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, serviceWorkers: 'block' });
  const llamadas = { data: 0, batch: [] };
  await ctx.addInitScript(([d, ls, api]) => {
    if (location.protocol === 'about:') return;
    if (sessionStorage.getItem('iniciada')) return;   // solo en la primera carga (las recargas conservan lo guardado)
    sessionStorage.setItem('iniciada', '1');
    localStorage.setItem('gym_api', JSON.stringify(api)); localStorage.setItem('gym_key', JSON.stringify('demo'));
    localStorage.setItem('gym_data', JSON.stringify(d)); localStorage.setItem('gym_bienvenida', 'true'); if (!window.__conTour) localStorage.setItem('gym_tour', 'true');
    Object.keys(ls).forEach(k => localStorage.setItem(k, JSON.stringify(ls[k])));
  }, [DATA, o.ls || {}, API_OK]);
  await ctx.route('https://script.google.com/**', async r => {
    let body = {};
    try { body = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
    if (body.action === 'data') { llamadas.data++; if (o.dataLento) await new Promise(x => setTimeout(x, o.dataLento)); return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, result: DATA }) }); }
    if (body.action === 'batch') {
      const ops = body.args[0]; llamadas.batch.push(ops.map(x => x.action));
      if (o.batchLento) await new Promise(x => setTimeout(x, o.batchLento));
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, result: ops.map(x => ({ id: x.id, ok: true })) }) });
    }
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, result: [] }) });
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  if (o.hora) await p.clock.install({ time: new Date(o.hora) });
  await p.goto(o.url || URL0);
  await p.waitForTimeout(o.espera || 1200);
  return { ctx, p, llamadas, errs };
}

(async () => {
  const b = await chromium.launch();

  // 1. Calentamiento sin palomear: al marcar el esfuerzo de la última serie de trabajo, se guarda solo
  {
    const { ctx, p, errs } = await abrir(b, { hora: '2026-10-22T18:00:00' });
    const r = await p.evaluate(async () => {
      const ex = DATA.exercises.find(e => e.barra > 0 && e.modalidad !== 'Barra fija');
      GRUPO = ex.group; OPEN = null; abrir(ex.name);
      const st = state[ex.name];
      const c = st.sets.filter(s => s.t === 'C').length;
      st.sets.forEach((s, i) => { if (s.t !== 'C') { if (!s.w) s.w = 20; if (!s.r) s.r = 10; marcar(ex.name, i); } });
      setRir(ex.name, 'Casi (1–2 más)');
      await new Promise(x => setTimeout(x, 600));
      const op = cola().find(o => o.action === 'saveExercise' && o.args[0].name === ex.name);
      return { c, done: state[ex.name].done, sets: op ? op.args[0].sets.map(s => s.t).join('') : null };
    });
    ok('Calentamiento sin palomear: se guarda solo al marcar el esfuerzo', r.c === 3 && r.done && r.sets === 'TTTT', JSON.stringify(r));
    ok('Sin errores (1)', !errs.length, errs.join(' | '));
    await ctx.close();
  }

  // 2. Terminar con un ejercicio a medias: se suben las series palomeadas
  // 3. "Igual que antes" con calentamientos: no palomea series de trabajo
  {
    const { ctx, p, errs } = await abrir(b, { hora: '2026-10-22T18:00:00' });
    const r = await p.evaluate(() => {
      const ex = DATA.exercises.find(e => e.group === 'Pull' && e.anterior && e.anterior.length && !(e.barra > 0));
      GRUPO = 'Pull'; OPEN = null; abrir(ex.name);
      const st = state[ex.name];
      const idx = st.sets.map((s, i) => s.t !== 'C' ? i : -1).filter(i => i > -1);
      idx.slice(0, 2).forEach(i => { if (!st.sets[i].w) st.sets[i].w = 30; if (!st.sets[i].r) st.sets[i].r = 10; marcar(ex.name, i); });
      terminarSesion();
      const op = cola().find(o => o.action === 'saveExercise' && o.args[0].name === ex.name);
      cerrarModal();
      // Igual que antes en un básico con calentamientos
      const ex2 = DATA.exercises.find(e => e.barra > 0 && e.anterior && e.anterior.length);
      OPEN = null; GRUPO = ex2.group; abrir(ex2.name);
      const st2 = state[ex2.name];
      st2.sets.forEach((s, i) => { if (s.t === 'C' && i < 2) s.ok = true; });
      igualQueAntes(ex2.name);
      return { parciales: op ? op.args[0].sets.length : null, tipos: st2.sets.map(s => s.t + (s.ok ? '✓' : '')).join(' ') };
    });
    ok('Terminar sube el ejercicio a medias (2 series)', r.parciales === 2, JSON.stringify(r.parciales));
    ok('"Igual que antes" deja los calentamientos y no palomea series de trabajo', /^C✓ C✓ C (T )*T$/.test(r.tipos), r.tipos);
    ok('Sin errores (2-3)', !errs.length, errs.join(' | '));
    await ctx.close();
  }

  // 4. Deshacer mientras se está subiendo: además se manda el borrado
  {
    const { ctx, p, llamadas, errs } = await abrir(b, { batchLento: 2500 });
    await p.evaluate(() => {
      const ex = DATA.exercises.find(e => e.group === 'Push' && !e.done);
      GRUPO = 'Push'; OPEN = null; abrir(ex.name);
      const st = state[ex.name];
      st.sets.forEach((s, i) => { if (s.t !== 'C') { s.w = s.w || 40; s.r = s.r || 10; s.ok = true; } });
      window.__ex = ex.name; guardar(ex.name, false, true);
    });
    await p.waitForTimeout(1800);   // ya salió el envío (1.2 s) y sigue en camino
    await p.evaluate(() => deshacer(window.__ex));
    await p.waitForTimeout(4000);
    const q = await p.evaluate(() => cola().map(o => o.action));
    const mandados = llamadas.batch.flat();
    ok('Deshacer en camino manda el borrado', mandados.includes('saveExercise') && (mandados.includes('undoById') || q.includes('undoById')), 'lotes: ' + JSON.stringify(llamadas.batch) + ' · cola: ' + JSON.stringify(q));
    ok('Sin errores (4)', !errs.length, errs.join(' | '));
    await ctx.close();
  }

  // 5. Lectura de la hoja que se cruza con una subida: se vuelve a pedir
  {
    const pend = [{ id: 'x1', action: 'savePeso', args: [74, '2026-10-21'], tag: 'peso-2026-10-21', k: 'demo' }];
    const { ctx, llamadas, errs } = await abrir(b, { ls: { gym_queue: pend }, dataLento: 1500, espera: 4500 });
    ok('Lectura que se cruzó con una subida se pide otra vez', llamadas.data >= 2 && llamadas.batch.length >= 1, 'data: ' + llamadas.data + ' · lotes: ' + llamadas.batch.length);
    ok('Sin errores (5)', !errs.length, errs.join(' | '));
    await ctx.close();
  }

  // 6. Pasada la medianoche con la app abierta y sin señal: la comida nueva va al día nuevo
  {
    const { ctx, p, errs } = await abrir(b, { hora: '2026-10-22T23:58:00' });
    await p.evaluate(() => { verTab('Comida'); addProt('Licuado'); });
    await p.clock.fastForward('05:00');
    await ctx.setOffline(true);
    const r = await p.evaluate(() => { addProt('Scoop'); return [hoy(), LS.get('gym_prot_2026-10-22').map(tDe), LS.get('gym_prot_2026-10-23').map(tDe), LS.get('gym_protmeal_2026-10-23')]; });
    // v8.2: lo que agregas es un registro con macros; se compara por nombre
    ok('Después de medianoche no se suma lo de ayer', r[0] === '2026-10-23' && JSON.stringify(r[1]) === '["Licuado (scoop + leche)"]' && JSON.stringify(r[2]) === '["Scoop con agua"]' && r[3].length === 1, JSON.stringify(r));
    ok('Sin errores (6)', !errs.length, errs.join(' | '));
    await ctx.close();
  }

  // 7. Celular sin espacio: lo nuevo no se pierde (la cola vive en memoria y se sube) y el aviso no se tapa
  {
    const { ctx, p, llamadas, errs } = await abrir(b);
    const r = await p.evaluate(async () => {
      const trozo = 'x'.repeat(100000);
      try { for (let i = 0; i < 200; i++) localStorage.setItem('ajeno_' + i, trozo); } catch (e) {}
      for (const n of [10000, 1000, 100, 10, 1]) { try { for (let i = 0; i < 100000; i++) localStorage.setItem('ajeno_' + n + '_' + i, 'x'.repeat(n)); } catch (e) {} }
      PESO_TMP = 75.4; guardarPeso();
      const t = $('toast').textContent;
      return { mem: !!COLA_MEM && COLA_MEM.some(o => o.action === 'savePeso'), toast: t };
    });
    await p.waitForTimeout(2500);
    ok('Sin espacio: la cola queda en memoria y se avisa', r.mem && /espacio/.test(r.toast), JSON.stringify(r));
    ok('Sin espacio: igual se sube', llamadas.batch.flat().includes('savePeso'), JSON.stringify(llamadas.batch));
    ok('Sin errores (7)', !errs.length, errs.join(' | '));
    await ctx.close();
  }

  // 8. Link de configuración: uno que no es de Google no cambia nada; otra cuenta pide confirmación y limpia lo anterior
  {
    const { ctx, p, errs } = await abrir(b, { url: URL0 + '?api=' + encodeURIComponent('https://malo.example.com/exec') + '&k=zzz' });
    const r1 = await p.evaluate(() => [LS.get('gym_api'), LS.get('gym_key'), location.search]);
    ok('Link con servidor ajeno no cambia la configuración', r1[0] === API_OK && r1[1] === 'demo' && r1[2] === '', JSON.stringify(r1));
    let pregunto = false;
    p.on('dialog', d => { pregunto = true; d.accept(); });
    await p.evaluate(() => LS.set('gym_chat', [{ rol: 'yo', texto: 'de la otra cuenta' }]));
    await p.goto('about:blank');
    await p.goto(URL0 + '#api=' + encodeURIComponent('https://script.google.com/macros/s/OTRO_123/exec') + '&k=nueva');
    await p.waitForTimeout(1200);
    const r2 = await p.evaluate(() => [LS.get('gym_api'), LS.get('gym_key'), LS.get('gym_chat', null), location.hash]);
    ok('Otra cuenta: pregunta, cambia y borra lo de la anterior', pregunto && /OTRO_123/.test(r2[0]) && r2[1] === 'nueva' && r2[2] === null && r2[3] === '', JSON.stringify(r2));
    ok('Sin errores (8)', !errs.length, errs.join(' | '));
    await ctx.close();
  }

  // 9. Buscador: la casilla no se vuelve a dibujar mientras escribes
  // 10. Un nombre con comillas no rompe su botón
  {
    const { ctx, p, errs } = await abrir(b);
    await p.evaluate(() => { verTab('Entrenar'); abrirBuscar(); window.__b = $('buscar'); });
    await p.click('#buscar');
    await p.keyboard.type('press', { delay: 40 });
    const r = await p.evaluate(() => ({ mismo: $('buscar') === window.__b, valor: $('buscar').value, res: (document.querySelector('#entCuerpo h2') || {}).textContent }));
    ok('Buscador: misma casilla y resultados al escribir', r.mismo && r.valor === 'press' && /resultado/.test(r.res || ''), JSON.stringify(r));
    await p.evaluate(() => { BUSCA = ''; pintarEntrenar(); DATA.comidas = [{ t: 'Tacos "al pastor" & <b>doble</b>', g: 25 }]; verTab('Comida'); });
    const antes = await p.evaluate(() => prot.length);
    const boton = p.locator('button.food', { hasText: 'Tacos' }).first();
    await boton.click();
    const r2 = await p.evaluate(() => ({ n: prot.length, ultimo: tDe(prot[prot.length - 1]), b: document.querySelectorAll('.food b b').length }));
    ok('Nombre con comillas: el botón funciona y no inyecta HTML', r2.n === antes + 1 && /al pastor/.test(r2.ultimo) && r2.b === 0, JSON.stringify(r2));
    ok('Sin errores (9-10)', !errs.length, errs.join(' | '));
    await ctx.close();
  }

  await b.close();
  console.log(resultados.join('\n'));
})();
