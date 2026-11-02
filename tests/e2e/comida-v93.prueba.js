// v9.3 (script 8.3): números que no cuadran salen marcados, fichas secas avisan, la respuesta de la IA se corrige a mano,
// varias fotos de la misma etiqueta y los datos de la etiqueta escritos a mano
const BASE = process.env.E2E_URL || 'http://localhost:8770/';
const path = require('path');
const { chromium } = require('playwright');
const res = []; const ok = (n, c, x) => res.push((c ? '✓ ' : '✗ ') + n + (x !== undefined ? ' · ' + JSON.stringify(x).slice(0, 200) : ''));
const IMAGEN = path.join(__dirname, '..', '..', 'icon-512.png');

(async () => {
  const b = await chromium.launch();
  const DATA = Object.assign({}, require('./datos.js'), { ia: true, scriptVersion: '8.3' });
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(d => {
    if (location.protocol === 'about:') return;
    localStorage.setItem('gym_api', JSON.stringify('https://script.google.com/macros/s/MOCK/exec')); localStorage.setItem('gym_key', '"demo"');
    localStorage.setItem('gym_data', JSON.stringify(d)); localStorage.setItem('gym_bienvenida', 'true'); localStorage.setItem('gym_tour', 'true');
  }, DATA);
  const llamadas = [];
  await ctx.route('https://script.google.com/**', r => {
    let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
    llamadas.push(body);
    let result = body.action === 'data' ? DATA : [];
    if (body.action === 'comidaIA') result = { items: [{ nombre: 'Atún Mazatún', gramos: 140, g: 12, c: 2, f: 3, k: 83, fijo: ['g'] }, { nombre: 'Mantequilla', gramos: 10, g: 20, c: 0, f: 8, k: 72 }], consejo: '' };
    if (body.action === 'fotoIA' || body.action === 'etiquetaIA') result = { tipo: 'etiqueta', es_etiqueta: true, nombre: 'Leche entera', u: 'ml', declarada: 'porcion',
      porcion: { texto: '1 vaso', cant: 250, p: 7.8, c: 12, f: 8.3, k: 154 }, contenido_neto: 3785, consumo: null };
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, result: result }) });
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.waitForTimeout(1500);
  try {
    await p.evaluate(() => verTab('Comida')); await p.waitForTimeout(200);
    // 1. El dato que das manda (🔒) y lo imposible sale marcado
    await p.fill('#iaComida', 'lata de atún Mazatún con 12 g de proteína y pan con mantequilla'); await p.click('text=Calcular'); await p.waitForTimeout(600);
    const card = await p.locator('.iacard').innerText();
    ok('El dato tuyo se marca 🔒 y se ven carbos, grasa y kcal de cada cosa', /Atún Mazatún 🔒/.test(card) && /C 2 · G 3 · 83 kcal/.test(card), card.slice(0, 200));
    ok('Mantequilla con 20 g de proteína en 10 g: sale el aviso', /pesan más que la comida/.test(card));
    // 2. Corregirla a mano: proteína 0 → las kcal se recalculan y el aviso se va
    await p.locator('.iacard .iitem .nm', { hasText: 'Mantequilla' }).click(); await p.waitForTimeout(200);
    await p.locator('#sheet .pc', { hasText: 'Proteína' }).locator('input').fill('0'); await p.locator('#sheet .pc', { hasText: 'Proteína' }).locator('input').dispatchEvent('change'); await p.waitForTimeout(150);
    const ed = await p.evaluate(() => ({ g: COMIDA_IA.items[1].g, k: COMIDA_IA.items[1].k, av: $('iaEdAv').textContent }));
    ok('Al corregir la proteína se recalculan las kcal (72) y ya no hay aviso', ed.g === 0 && ed.k === 72 && !ed.av, ed);
    // Cambiar los gramos escala todo
    await p.locator('#sheet .pc', { hasText: 'Gramos' }).locator('input').fill('20'); await p.locator('#sheet .pc', { hasText: 'Gramos' }).locator('input').dispatchEvent('change'); await p.waitForTimeout(150);
    ok('Cambiar los gramos (10 → 20) escala grasa y kcal', await p.evaluate(() => COMIDA_IA.items[1].f === 16 && COMIDA_IA.items[1].k === 144));
    await p.locator('#sheet .btn', { hasText: 'Listo' }).click(); await p.waitForTimeout(150);
    await p.evaluate(() => { COMIDA_IA = null; pintarComida(); });
    // 3. Ficha seca del catálogo: avisa en el buscador y en la cantidad
    await p.evaluate(() => abrirBuscador()); await p.evaluate(() => cargarCatalogo()); await p.waitForTimeout(300);
    await p.fill('#busNut', 'soja frijol proteina'); await p.waitForTimeout(400);
    ok('El buscador marca la proteína de soya seca', /seco o en polvo/.test(await p.locator('#busRes').innerText()));
    await p.locator('#busRes .bres', { hasText: 'Soja (Soya) Frijol, Proteína' }).first().click(); await p.waitForTimeout(200);
    await p.fill('#sheet .cantfila input', '150'); await p.dispatchEvent('#sheet .cantfila input', 'change'); await p.waitForTimeout(200);
    const cant = await p.locator('#sheet').innerText();
    ok('Al elegirla: aviso de seco y de 71 g de proteína', /seco o en polvo/.test(cant) && /es mucho/.test(cant), cant.slice(0, 200));
    await p.evaluate(() => { BUS = null; cerrarModal(); });
    // 4. Datos de la etiqueta a mano (un galón: porción de 250 ml)
    await p.evaluate(() => { abrirCamara(); }); await p.waitForTimeout(150);
    await p.locator('#sheet .camopts button', { hasText: 'Escribir los datos' }).click(); await p.waitForTimeout(150);
    await p.locator('#sheet .tch', { hasText: 'Líquido' }).click(); await p.waitForTimeout(100);
    const llena = async (nom, v) => { const i = p.locator('#sheet .pc', { hasText: nom }).locator('input').first(); await i.fill(v); await i.dispatchEvent('change'); };
    await p.fill('#sheet input.campo', 'Leche Lala entera'); await p.dispatchEvent('#sheet input.campo', 'change');
    await llena('Porción', '250'); await llena('Porciones por envase', '15'); await llena('Proteína', '7.8'); await llena('kcal', '154'); await llena('Carbos', '12'); await llena('Grasa', '8.3');
    await p.locator('#sheet .btn', { hasText: 'Continuar' }).click(); await p.waitForTimeout(200);
    const m = await p.evaluate(() => ({ p100: ETQ.al.p, env: ETQ.info.envase, u: ETQ.info.u, tot: $('etqTot').textContent }));
    ok('A mano: por 100 ml = 3.1 g, envase = 15 × 250 = 3,750 ml, 1 vaso = 7.8 g', m.p100 === 3.1 && m.env === 3750 && m.u === 'ml' && /7\.8 g/.test(m.tot), m);
    await p.evaluate(() => cerrarModal());
    // 5. Varias fotos de la misma etiqueta (galón) con la nota
    await p.fill('#iaComida', 'me tomé un vaso');
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.locator('.iacard .fila-ia button[aria-label^="Foto"]').click()]);
    ok('Se pueden escoger varias fotos', fc.isMultiple());
    await fc.setFiles([IMAGEN, IMAGEN]); await p.waitForTimeout(1200);
    const f = llamadas.filter(x => x.action === 'fotoIA').pop();
    ok('Las 2 fotos van juntas con la nota y el galón sale de 3,785 ml', f && Array.isArray(f.args[0]) && f.args[0].length === 2 && f.args[2].nota === 'me tomé un vaso' && await p.evaluate(() => ETQ.info.envase === 3785), f && [typeof f.args[0], f.args[0].length]);
    ok('Ofrece agregar otra foto (2 de 3)', /otra foto de la misma etiqueta \(2 de 3\)/.test(await p.locator('#sheet').innerText()));
  } catch (e) { ok('La prueba de comida v9.3 terminó', false, e.message.split('\n')[0]); }
  ok('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log(res.join('\n'));
})();
