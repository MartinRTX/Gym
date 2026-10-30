// v9.2 (script 8.2): etiqueta + lo que dijiste. La IA solo copia la tabla; la app hace las cuentas (piezas, porciones,
// parte del envase), pide el tamaño del envase si no viene, no duplica productos y recalcula al instante
const BASE = process.env.E2E_URL || 'http://localhost:8770/';
const path = require('path');
const { chromium } = require('playwright');
const res = []; const ok = (n, c, x) => res.push((c ? '✓ ' : '✗ ') + n + (x !== undefined ? ' · ' + JSON.stringify(x).slice(0, 200) : ''));
const IMAGEN = path.join(__dirname, '..', '..', 'icon-512.png');
// Galletas: tabla NOM-051 solo por porción (30 g = 3 galletas), 6 porciones por envase, sin contenido neto
const MARIAS = { es_etiqueta: true, nombre: 'Galletas Marías', marca: 'Gamesa', u: 'g', declarada: 'porcion', por100: null,
  porcion: { texto: '3 galletas', cant: 30, piezas: 3, p: 2.1, c: 22.5, f: 3, k: 125, fib: 0.6 }, porciones_envase: 6, contenido_neto: null, envase: null,
  consumo: { tipo: 'piezas', valor: 6 }, code: '', avisos: [] };

(async () => {
  const b = await chromium.launch();
  const DATA = Object.assign({}, require('./datos.js'), { ia: true, scriptVersion: '8.2' });
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
    if (body.action === 'etiquetaIA') result = MARIAS;
    if (body.action === 'fotoIA') result = Object.assign({ tipo: 'etiqueta' }, MARIAS, { consumo: { tipo: 'fraccion', valor: 0.5 } });
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, result: result }) });
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.waitForTimeout(1500);
  const tot = () => p.evaluate(() => $('etqTot').textContent);
  try {
    await p.evaluate(() => verTab('Comida')); await p.waitForTimeout(200);
    // 1. "me comí 6" con la tabla por porción: 6 × 10 g = 60 g, sin que la IA haga cuentas
    await p.evaluate(m => abrirEtiqueta(m), MARIAS); await p.waitForTimeout(250);
    const e1 = await p.evaluate(() => ({ modo: ETQ.modo, valor: ETQ.valor, pieza: ETQ.info.pieza, env: ETQ.info.envase, p100: ETQ.al.p, decl: document.querySelector('.etqdecl').textContent }));
    ok('Tabla por porción → 100 g, 1 pieza = 10 g y envase = 6 porciones (180 g)', e1.p100 === 7 && e1.pieza === 10 && e1.env === 180 && /por porción/.test(e1.decl), e1);
    ok('«Me comí 6» → 6 piezas = 60 g', e1.modo === 'piezas' && e1.valor === 6 && /60 g/.test(await tot()), await tot());
    // 2. Cambiar la cantidad recalcula al instante (sin repintar: el mismo campo sigue con el foco)
    await p.focus('#etqValor'); const antes = await p.evaluateHandle(() => $('etqValor'));
    await p.fill('#etqValor', '3'); await p.waitForTimeout(100);
    ok('Escribir 3 piezas recalcula al momento (30 g · 2.1 g prot)', /30 g/.test(await tot()) && /2\.1 g/.test(await tot()) && await p.evaluate(a => $('etqValor') === a && document.activeElement === a, antes), [await tot(), await p.evaluate(a => [$('etqValor') === a, document.activeElement && document.activeElement.id], antes)]);
    // 3. Otras formas de contar: del envase (la mitad) y porciones
    await p.locator('.etqmodos button', { hasText: 'Del envase' }).click(); await p.waitForTimeout(150);
    await p.locator('#sheet .tch', { hasText: 'La mitad' }).click(); await p.waitForTimeout(150);
    ok('La mitad del envase = 90 g', /90 g/.test(await tot()), await tot());
    await p.locator('.etqmodos button', { hasText: 'Porciones' }).click(); await p.waitForTimeout(150);
    ok('Al cambiar a porciones conserva lo que llevabas (90 g = 3 porciones)', await p.evaluate(() => ETQ.valor === 3) && /90 g/.test(await tot()));
    await p.evaluate(() => cerrarModal());

    // 4. Sin datos del envase y "me la comí toda": pide el tamaño antes de dejar agregar
    await p.evaluate(() => abrirEtiqueta({ es_etiqueta: true, nombre: 'Barra de proteína', u: 'g', declarada: '100', por100: { p: 30, c: 35, f: 12, k: 368, fib: 8 }, consumo: { tipo: 'todo' } }));
    await p.waitForTimeout(200);
    const e4 = await p.evaluate(() => ({ pide: !!$('etqEnvG'), bloqueado: $('etqAgregar').disabled }));
    ok('Sin contenido neto ni porciones por envase: pide de cuánto es el envase', e4.pide && e4.bloqueado, e4);
    await p.fill('#etqEnvG', '60'); await p.dispatchEvent('#etqEnvG', 'change'); await p.waitForTimeout(150);
    ok('Con el envase escrito ya calcula (60 g · 18 g prot) y deja agregar', /60 g/.test(await tot()) && /18 g/.test(await tot()) && await p.evaluate(() => !$('etqAgregar').disabled), await tot());
    await p.evaluate(() => cerrarModal());

    // 5. No duplicar: ya tienes las Marías → se actualiza la que tienes
    await p.evaluate(() => { const c = nutCfg(); c.productos.push({ id: 'p:viejas', n: 'Marías Gamesa', marca: '', u: 'g', p: 6, c: 70, f: 9, k: 400, fib: 1, por: [], src: 'etiqueta', code: '', ts: 1 }); guardarNut(c); });
    await p.evaluate(m => abrirEtiqueta(m), MARIAS); await p.waitForTimeout(200);
    ok('Si ya lo tienes, ofrece actualizarlo (marcado por defecto)', /Ya tienes «Marías Gamesa»/.test(await p.locator('#sheet').innerText()) && await p.evaluate(() => ETQ.actualizar));
    const n0 = await p.evaluate(() => ({ prods: nutCfg().productos.length, dia: prot.length }));
    await p.locator('#etqAgregar').click(); await p.waitForTimeout(250);
    const n1 = await p.evaluate(() => { const r = regDe(prot[prot.length - 1]); const pr = nutCfg().productos.find(x => x.id === 'p:viejas'); return { prods: nutCfg().productos.length, dia: prot.length, q: r.q, p: r.p, ref: r.ref, nuevoP: pr.p, por: pr.por.map(x => x[0]) }; });
    ok('Agregar: actualiza el producto (sin copia) y registra 60 g', n1.prods === n0.prods && n1.dia === n0.dia + 1 && n1.q === 60 && n1.ref === 'p:viejas' && n1.nuevoP === 7, n1);
    ok('El producto guarda porción, pieza y envase (para buscarlo después)', /porción/.test(n1.por[0]) && n1.por.includes('1 galleta') && n1.por.includes('Todo el envase'), n1.por);
    ok('Después, «4 galletas marías» en el buscador = 40 g', await p.evaluate(() => NUT.cantidadDeTexto('4 galletas marías', nutCfg().productos.find(x => x.id === 'p:viejas')).q === 40));

    // 6. Texto de la tabla pegado en el Registro inteligente → la misma vista previa (la IA solo lo lee)
    await p.fill('#iaComida', 'Tamaño de la porción 30 g (3 galletas). Contenido energético 125 kcal, proteínas 2.1 g, grasas totales 3 g, carbohidratos 22.5 g. Me comí 6');
    await p.click('text=Calcular'); await p.waitForTimeout(500);
    const pegado = llamadas.filter(x => x.action === 'etiquetaIA').pop();
    ok('Texto de tabla pegado: se manda como etiqueta y abre la vista previa', pegado && pegado.args[2] && /Contenido energético/.test(pegado.args[2].texto) && await p.evaluate(() => !!ETQ && ETQ.desdeIA), pegado && pegado.args);
    await p.evaluate(() => cerrarModal()); await p.waitForTimeout(100);

    // 7. 📷 junto a lo que escribiste: foto + nota en una sola llamada
    await p.evaluate(() => { COMIDA_IA = null; pintarComida(); }); await p.waitForTimeout(100);
    await p.fill('#iaComida', 'son Marías, me comí la mitad del paquete');
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.locator('.iacard .fila-ia button[aria-label^="Foto"]').click()]);
    await fc.setFiles(IMAGEN); await p.waitForTimeout(900);
    const foto = llamadas.filter(x => x.action === 'fotoIA').pop();
    ok('La foto va con la nota y la mitad del paquete = 90 g', foto && foto.args[2].nota === 'son Marías, me comí la mitad del paquete' && /90 g/.test(await tot()), foto && foto.args[2]);
  } catch (e) { ok('La prueba de etiqueta v9.2 terminó', false, e.message.split('\n')[0]); }
  ok('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log(res.join('\n'));
})();
