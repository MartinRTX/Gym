// v10.6 (script 9.0): cada llamada lleva el identificador de este celular; el bloqueo por claves equivocadas se explica y no
// pierde lo anotado; y tus productos ya no se cortan a 40 (a las recetas les desaparecían ingredientes).
const BASE = process.env.E2E_URL || 'http://localhost:8770/';
const { chromium } = require('playwright');
const DATA = Object.assign({}, require('./datos.js'), { scriptVersion: '9.0', ia: true });
const casos = []; const ok = (n, c, info) => casos.push((c ? '✓ ' : '✗ ') + n + (info !== undefined ? ' · ' + JSON.stringify(info).slice(0, 300) : ''));
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 412, height: 915 } });
  await ctx.addInitScript(d => {
    if (localStorage.getItem('gym_api')) return;
    localStorage.setItem('gym_api', JSON.stringify('https://script.google.com/macros/s/MOCK/exec')); localStorage.setItem('gym_key', JSON.stringify('demo'));
    localStorage.setItem('gym_data', JSON.stringify(d)); localStorage.setItem('gym_bienvenida', 'true'); localStorage.setItem('gym_tour', 'true');
  }, DATA);
  const cuerpos = []; let bloqueado = false;
  await ctx.route('https://script.google.com/**', r => {
    const body = JSON.parse(r.request().postData() || '{}'); cuerpos.push(body);
    if (bloqueado) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Demasiados intentos con una clave equivocada. Por seguridad, espera 15 minutos.' }) });
    const res = body.action === 'data' ? DATA : body.action === 'batch' ? body.args[0].map(o => ({ id: o.id, ok: true })) : [];
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, result: res }) });
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + 'index.html'); await p.waitForTimeout(1500);
  // 1. El identificador: 32 letras, el mismo en todas las llamadas, y sobrevive a recargar
  const d1 = await p.evaluate(() => dispositivo());
  await p.evaluate(() => encolar('savePeso', [70, hoy()], 'peso')); await p.waitForTimeout(1800);
  await p.reload(); await p.waitForTimeout(1500);
  const ds = [...new Set(cuerpos.map(c => c.d))];
  ok('Cada llamada (leer y guardar) lleva el identificador de este celular', cuerpos.length >= 3 && ds.length === 1 && /^[0-9a-f]{32}$/.test(ds[0]) && ds[0] === d1, { n: cuerpos.length, ds });
  ok('La clave sigue yendo en el cuerpo, no en el link', cuerpos.every(c => c.k === 'demo'));
  // 2. Tus productos: 45 guardados y una receta que usa el más viejo; al guardar otro no desaparece ninguno
  await p.evaluate(() => {
    verTab('Comida');
    const c = nutCfg();
    c.productos = Array.from({ length: 45 }, (_, i) => ({ id: 'p:viejo' + i, n: 'Producto ' + i, marca: '', u: 'g', p: 10, c: 10, f: 5, k: 125, fib: 0, por: [['1 porción', 30]], src: 'etiqueta', code: '', ts: i }));
    c.recetas.push({ id: 'r-prueba', n: 'Mi receta', ico: '🍽️', m: 'c', items: [{ ref: 'p:viejo0', q: 100 }] });
    guardarNut(c);
    confirmarProducto({ n: 'Producto nuevo', marca: 'X', u: 'g', p: 5, c: 5, f: 5, k: 85, fib: 0, por: [['1 porción', 50]], src: 'etiqueta' }, []);
    guardarProducto(false);
  });
  await p.waitForTimeout(1800);
  let r = await p.evaluate(() => { const c = nutCfg(), t = NUT.receta(c.recetas.find(x => x.id === 'r-prueba'), resolver); return { n: c.productos.length, viejo: !!c.productos.find(x => x.id === 'p:viejo0'), kcal: t.tot.k }; });
  ok('46 productos: no se corta a 40 y la receta conserva su ingrediente', r.n === 46 && r.viejo && r.kcal === 125, r);
  const enviado = cuerpos.filter(c => c.action === 'batch').map(c => c.args[0]).flat().filter(o => o.action === 'saveConfig' && o.args[0].nutricion).pop();
  ok('Y a la hoja se mandan los 46', !!enviado && enviado.args[0].nutricion.productos.length === 46, enviado && enviado.args[0].nutricion.productos.length);
  // 3. Bloqueo por claves equivocadas: avisa con palabras claras y lo anotado se queda en la cola
  bloqueado = true;
  await p.evaluate(() => encolar('savePeso', [71, hoy()], 'peso')); await p.waitForTimeout(1900);
  const aviso = await p.locator('#toast').innerText().catch(() => '');
  r = await p.evaluate(() => ({ cola: cola().length, sync: document.getElementById('sync').textContent }));
  ok('Bloqueado: explica que espere 15 minutos', /15 minutos/.test(aviso) && /se sube solo/.test(aviso), aviso);
  ok('Bloqueado: lo anotado no se pierde (sigue en la cola)', r.cola === 1 && /sin subir/.test(r.sync), r);
  bloqueado = false;
  await p.evaluate(() => enviar()); await p.waitForTimeout(1200);
  ok('Al terminar el bloqueo se sube solo', await p.evaluate(() => cola().length) === 0);
  // 4. Cambiar de cuenta en este celular no cambia el identificador
  ok('Cambiar de cuenta conserva el identificador', await p.evaluate(() => { cambiarDeCuenta(); return dispositivo(); }) === d1);
  ok('Sin errores de página', !errs.length, errs);
  console.log(casos.join('\n'));
  await b.close();
})();
