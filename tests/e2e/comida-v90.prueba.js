// v9.0 Comida: buscador tolerante, la IA no te deja esperando (sugerencias mientras piensa y respuesta tardía),
// tocar una sugerencia sí abre la cantidad, y las recetas van a la hoja ingrediente por ingrediente
const BASE = process.env.E2E_URL || 'http://localhost:8770/';
const { chromium } = require('playwright');
const res = []; const ok = (n, c, x) => res.push((c ? '✓ ' : '✗ ') + n + (x !== undefined ? ' · ' + JSON.stringify(x).slice(0, 200) : ''));

async function abrir(b, version) {
  const DATA = Object.assign({}, require('./datos.js'), { ia: true, scriptVersion: version });
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(d => {
    if (location.protocol === 'about:') return;
    localStorage.setItem('gym_api', JSON.stringify('https://script.google.com/macros/s/MOCK/exec')); localStorage.setItem('gym_key', '"demo"');
    localStorage.setItem('gym_data', JSON.stringify(d)); localStorage.setItem('gym_bienvenida', 'true'); localStorage.setItem('gym_tour', 'true');
  }, DATA);
  await ctx.route('https://script.google.com/**', async r => {
    let a = '', body = {}; try { body = JSON.parse(r.request().postData() || '{}'); a = body.action; } catch (e) {}
    if (a === 'comidaIA') {
      // La IA "lenta" contesta a los 2.5 s (la app espera 1 s en esta prueba)
      await new Promise(x => setTimeout(x, 2500));
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, result: { items: [{ nombre: 'Pizza 4 rebanadas', gramos: 430, g: 45, c: 125, f: 53, k: 1150 }], consejo: 'ok', modelo: 'prueba' } }) });
    }
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, result: a === 'data' ? DATA : [] }) });
  });
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.goto(BASE); await p.waitForTimeout(1500);
  return p;
}
// Lo que se mandaría a la hoja (pestaña Comidas) para hoy
const filasHoja = p => p.evaluate(() => { const op = cola().filter(o => o.action === 'saveComidas').pop(); return op ? op.args[1] : null; });

(async () => {
  const b = await chromium.launch();
  let p = await abrir(b, '8.1');
  try {
    // Script 8.1: las metas que calcula Gym se mandan para que Panel las muestre (una sola vez si no cambian)
    const metas = await p.evaluate(() => { const ops = cola().filter(o => o.action === 'saveConfig' && o.args[0] && o.args[0].metasGym); return { n: ops.length, m: ops[0] && ops[0].args[0].metasGym }; });
    ok('Las metas de Gym se mandan para Panel', metas.n === 1 && metas.m.k > 1000 && metas.m.p > 0 && metas.m.auto === true, metas);
    await p.evaluate(() => mandarMetasGym());
    ok('Si no cambiaron, no se vuelven a mandar', await p.evaluate(() => cola().filter(o => o.tag === 'metas-gym').length === 1));
    // Buscador: porciones, errores de dedo, sinónimos y platillos
    await p.evaluate(() => { verTab('Comida'); abrirBuscador(); }); await p.waitForTimeout(300);
    await p.evaluate(() => cargarCatalogo()); await p.waitForTimeout(300);
    const busca = async q => { await p.fill('#busNut', q); await p.waitForTimeout(350); return p.evaluate(() => [...document.querySelectorAll('#busRes .bres .nm')].slice(0, 3).map(x => x.firstChild.textContent)); };
    let r = await busca('cereal cherios'); ok('«cereal cherios» (error de dedo) encuentra el cereal', r.some(x => /cheerios/i.test(x)), r);
    r = await busca('rebanada de pizza'); ok('«rebanada de pizza» encuentra la pizza', /pizza/i.test(r[0] || ''), r);
    r = await busca('proteína scoop'); ok('«proteína scoop» encuentra la proteína en polvo', /prote[ií]na en polvo/i.test(r[0] || ''), r);
    r = await busca('coca cola'); ok('«coca cola» encuentra el refresco de cola', /refresco de cola/i.test(r[0] || ''), r);
    r = await busca('tacos de asada'); ok('«tacos de asada» encuentra el taco', /taco de carne asada/i.test(r[0] || ''), r);
    r = await busca('chilaquiles'); ok('Platillos nuevos: chilaquiles', /chilaquiles/i.test(r[0] || ''), r);
    await busca('6 doritos nachos'); await p.locator('#busRes .bres').first().click(); await p.waitForTimeout(250);
    ok('«6 doritos nachos» → 6 piezas = 15 g', await p.evaluate(() => /Doritos/.test(CANT.al.n) && CANT.q === 15));
    await p.evaluate(() => cerrarCantidad()); await p.waitForTimeout(150);
    // La cantidad sale de lo que escribiste: 4 rebanadas = 4 × 107 g
    await busca('4 rebanadas de pizza'); await p.locator('#busRes .bres').first().click(); await p.waitForTimeout(250);
    const cant = await p.evaluate(() => ({ q: CANT.q, tip: (document.querySelector('#sheet .tip') || {}).textContent || '' }));
    ok('«4 rebanadas de pizza» → 428 g (no 100 g ni la pizza entera) y lo explica', cant.q === 428 && /4 × rebanada/.test(cant.tip), cant);
    await p.evaluate(() => cerrarCantidad()); await p.waitForTimeout(150);
    await p.evaluate(() => cerrarBuscador());

    // IA lenta: mientras piensa salen sugerencias del catálogo; si tarda, avisa y la respuesta tardía igual aparece
    await p.evaluate(() => { LIMITE_IA_COMIDA = 1000; }); await p.waitForTimeout(100);
    await p.fill('#iaComida', 'cuatro rebanadas de pizza'); await p.click('text=Calcular'); await p.waitForTimeout(500);
    const mientras = await p.evaluate(() => ({ cargando: COMIDA_IA.cargando, loc: (COMIDA_IA.locales || []).map(a => a.n), seg: !!$('iaSeg') }));
    ok('Mientras piensa: sugerencias del catálogo y los segundos que lleva', mientras.cargando && mientras.loc.some(n => /pizza/i.test(n)) && mientras.seg, mientras);
    await p.waitForTimeout(1000);
    const tarde = await p.evaluate(() => COMIDA_IA.error);
    ok('Si tarda, lo dice sin borrar las sugerencias', /está tardando/.test(tarde) && await p.evaluate(() => (COMIDA_IA.locales || []).length > 0), tarde);
    await p.waitForTimeout(1600);
    ok('La respuesta que llega tarde se muestra sola', await p.evaluate(() => !!(COMIDA_IA.items && COMIDA_IA.items.length && !COMIDA_IA.error)));
    // Tocar una sugerencia abre la cantidad (antes se pintaba escondida)
    await p.evaluate(async () => { COMIDA_IA = { texto: '3 tacos de asada y una coca', locales: await sugerenciasCatalogo('3 tacos de asada y una coca') }; pintarComida(); }); await p.waitForTimeout(200);
    await p.locator('.iacard .bres').first().click(); await p.waitForTimeout(300);
    const hoja = await p.evaluate(() => ({ abierta: $('modal').classList.contains('show'), cant: !!document.querySelector('#sheet .cantfila'), n: CANT.al.n, q: CANT.q }));
    ok('Tocar una sugerencia abre «¿cuánto comiste?» con la cantidad que escribiste', hoja.abierta && hoja.cant && /taco/i.test(hoja.n) && hoja.q === 240, hoja);
    const antes = await p.evaluate(() => prot.length);
    await p.locator('#sheet .acts .btn').click(); await p.waitForTimeout(300);
    ok('Al agregarla queda en el día y la tarjeta de la IA se limpia', await p.evaluate(n => prot.length === n + 1 && !COMIDA_IA, antes));

    // Receta → un renglón por ingrediente, con «Parte de»
    await p.evaluate(() => cenaHoy('cena-harina')); await p.waitForTimeout(300);
    const filas = await filasHoja(p), cena = (filas || []).filter(x => x.de === '2 quesadillas de harina');
    ok('La receta va a la hoja ingrediente por ingrediente', cena.length === 3 && cena.every(x => /\.\d$/.test(x.id) && x.q > 0 && x.u), cena.map(x => x.n + ' ' + x.q + x.u));
    const tot = await p.evaluate(() => { const r = NUT.receta(recetaDe('cena-harina'), resolver).tot; return r; });
    const suma = cena.reduce((a, x) => ({ p: a.p + x.p, k: a.k + x.k }), { p: 0, k: 0 });
    ok('Los ingredientes suman lo mismo que la receta', Math.abs(suma.p - tot.p) < 0.3 && Math.abs(suma.k - tot.k) <= 2, [suma, tot.p, tot.k]);
    // Del otro celular: los renglones juntos vuelven a ser una sola receta
    const junta = await p.evaluate(() => {
      const id = 'zz' + Date.now();
      DATA.comidasDias = { '2020-01-02': [{ id: id, n: 'Mi licuado', p: 40, c: 80, f: 13, k: 576, fib: 12, src: 'receta', ref: 'licuado', m: 'd', partes: [{ n: 'Avena', q: 40, u: 'g', p: 5 }] }] };
      const l = listaDesdeHoja('2020-01-02'); const r = regDe(l[0]); return { n: l.length, nombre: r.n, partes: (r.partes || []).length };
    });
    ok('Lo que llega de la hoja trae sus ingredientes', junta.n === 1 && junta.nombre === 'Mi licuado' && junta.partes === 1, junta);
  } catch (e) { ok('La prueba de comida v9.0 terminó', false, e.message.split('\n')[0]); }
  ok('Sin errores de página', !p.errs.length, p.errs);
  await p.context().close();

  // Con el script viejo (7.9) la receta sigue en un solo renglón
  p = await abrir(b, '7.9');
  try {
    await p.evaluate(() => { verTab('Comida'); cenaHoy('cena-harina'); }); await p.waitForTimeout(300);
    const filas = await filasHoja(p);
    ok('Script viejo: la receta va en un solo renglón', filas && filas.filter(x => /quesadillas/.test(x.n)).length === 1 && !filas.some(x => x.de), filas && filas.map(x => x.n));
  } catch (e) { ok('Script viejo', false, e.message.split('\n')[0]); }
  ok('Sin errores de página (script viejo)', !p.errs.length, p.errs);
  await b.close();
  console.log(res.join('\n'));
})();
