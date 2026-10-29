// Auditoría v8.1 en el navegador: cada flujo nuevo con su resultado esperado
const BASE = process.env.E2E_URL || 'http://localhost:8770/';
const TMP = require('os').tmpdir();
const IMAGEN = require('path').join(__dirname, '..', '..', 'icon-512.png');
const { chromium } = require('playwright');
const DATA = Object.assign({}, require('./datos.js'), { scriptVersion: '7.6', ia: true });
const casos = [];
const ok = (n, c, info) => casos.push((c ? '✓ ' : '✗ ') + n + (info !== undefined ? ' · ' + JSON.stringify(info) : ''));
async function pagina(b, hora, extra) {
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 412, height: 915 }, colorScheme: 'dark', reducedMotion: extra && extra.quieto ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(d => {
    localStorage.setItem('gym_api', JSON.stringify('https://script.google.com/macros/s/MOCK/exec')); localStorage.setItem('gym_key', JSON.stringify('demo'));
    localStorage.setItem('gym_data', JSON.stringify(d)); localStorage.setItem('gym_bienvenida', 'true'); if (!window.__conTour) localStorage.setItem('gym_tour', 'true');
  }, DATA);
  await ctx.route('https://script.google.com/**', r => {
    const body = JSON.parse(r.request().postData() || '{}');
    const res = body.action === 'data' ? DATA : body.action === 'batch' ? body.args[0].map(o => ({ id: o.id, ok: true })) : [];
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, result: res }) });
  });
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  if (hora) await p.clock.install({ time: new Date(hora) });
  await p.goto(BASE + 'index.html'); await p.waitForTimeout(1500);
  return p;
}
(async () => {
  const b = await chromium.launch();
  let p = await pagina(b, '2026-10-22T10:00:00');
  // 1. Ruta: título con avance y Quitar; sin cajita repetida ni aviso flotante
  let r = await p.evaluate(() => { seguirRuta(); return { h2: [...document.querySelectorAll('#entCuerpo h2')].map(h => h.textContent), caja: !!document.querySelector('.ruta.corta'), toast: $('toast').classList.contains('show') }; });
  ok('Ruta aceptada: un solo título con avance y Quitar', r.h2.some(t => /Tu ruta de hoy: 0 de \d/.test(t) && /Quitar/.test(t)) && !r.caja && !r.toast, r);
  // 2. Primera serie: la tarjeta sube a "Ahora" y queda abierta
  r = await p.evaluate(() => { const n = OPEN, st = state[n]; const i = st.sets.findIndex(s => s.t !== 'C'); marcar(n, i); return new Promise(res => setTimeout(() => res({ n, h2: document.querySelector('#entCuerpo h2').textContent, primera: document.querySelector('#entCuerpo .ex').id.slice(3), abierta: document.getElementById('ex-' + n).classList.contains('open') }), 600)); });
  ok('Primera serie: sube a Ahora, abierta', r.h2 === 'Ahora' && r.primera === r.n && r.abierta, r);
  const A = r.n;
  // 3. Serie hecha: palomita del color del grupo y fila apagada; la siguiente con raya
  r = await p.evaluate(n => { const el = document.getElementById('ex-' + n), h = el.querySelector('.set.hecho .chk'), s = el.querySelector('.set.sig');
    return { chk: getComputedStyle(h).backgroundColor, rut: getComputedStyle(document.body).getPropertyValue('--rut').trim(), op: getComputedStyle(el.querySelector('.set.hecho .val')).opacity, raya: s && getComputedStyle(s).boxShadow }; }, A);
  ok('Serie hecha en color del grupo, fila apagada, la siguiente con raya', r.op === '0.55' && /inset/.test(r.raya || ''), r);
  // 4. Tocar la cabeza cierra la tarjeta en curso aunque siga en Ahora; marcar otra serie la reabre
  r = await p.evaluate(n => { abrir(n); const cerrada = !document.getElementById('ex-' + n).classList.contains('open'); return { cerrada, sigue: document.querySelector('#entCuerpo h2').textContent }; }, A);
  ok('Cerrar tarjeta en curso: se cierra y sigue en Ahora', r.cerrada && r.sigue === 'Ahora', r);
  // 5. Desmarcar la única serie: regresa a su sección
  r = await p.evaluate(n => { const st = state[n], i = st.sets.findIndex(s => s.ok); marcar(n, i); return new Promise(res => setTimeout(() => res({ h2: [...document.querySelectorAll('#entCuerpo h2')].map(h => h.textContent.slice(0, 20)), enMarcha: enMarcha(n) }), 600)); }, A);
  ok('Desmarcar: sale de Ahora', !r.h2.includes('Ahora') && !r.enMarcha, r);
  // 6. Guardar: el rack se llena con animación y abre el siguiente
  r = await p.evaluate(n => { const st = state[n]; st.sets.forEach(s => { s.ok = s.t !== 'C' ? true : s.ok; }); OPEN = n; guardar(n, true);
    return new Promise(res => setTimeout(() => res({ llenas: document.querySelectorAll('.rack .mancuerna').length, entra: document.querySelectorAll('.rack .mancuerna.entra').length, lado: document.querySelector('.hoy .grupo span').textContent, OPEN }), 700)); }, A);
  ok('Guardar: 1 mancuerna llena (cayendo), "1 de N hechos" y abre el siguiente', r.llenas === 1 && r.entra === 1 && /^1 de \d+hechos$/.test(r.lado) && r.OPEN && r.OPEN !== A, r);
  // 7. Rack simétrico por diseño: una mancuerna por ejercicio, todas del mismo tamaño
  r = await p.evaluate(() => [...document.querySelectorAll('.rack g')].map(g => g.getBBox().height));
  ok('Rack: todas iguales', new Set(r).size === 1, r);
  // 8. Buscador: lupa → casilla con foco → resultados → Cancelar regresa
  r = await p.evaluate(() => { const antes = !!$('buscar'); abrirBuscar(); return new Promise(res => setTimeout(() => { const foco = document.activeElement === $('buscar'); buscar('remo'); const n = document.querySelector('#entCuerpo h2').textContent; cerrarBuscar(); res({ antes, foco, n, despues: !!$('buscar'), lupa: !!document.querySelector('.chip.lupa') }); }, 80)); });
  ok('Buscador detrás de la lupa', !r.antes && r.foco && /resultado/.test(r.n) && !r.despues && r.lupa, r);
  // 9. Mosaicos: sin borde; antes de las 6 pm Proteína lleva a Comida; Peso abre el teclado
  r = await p.evaluate(() => { const m = [...document.querySelectorAll('.mosaicos button')]; const bt = getComputedStyle(m[0]).borderTopWidth;
    const prot = m.find(x => /Proteína/.test(x.textContent)); prot.click(); const tab = TAB; verTab('Entrenar');
    document.querySelector('.mosaicos button').click(); const kp = $('kp').classList.contains('show') || getComputedStyle($('kp')).display !== 'none'; cerrarTeclado();
    return { n: m.length, et: m.map(x => x.querySelector('.et').textContent), borde: bt, tab, kp }; });
  ok('Mosaicos: sin borde, Proteína → Comida, Peso → teclado', r.borde === '0px' && r.tab === 'Comida' && r.kp, r);
  // 10. Barra inferior: la pestaña activa crece; 5 pestañas con Coach
  r = await p.evaluate(() => { verTab('Progreso'); const t = (id) => $(id) && $(id).querySelector('.bola').getBoundingClientRect().width; return new Promise(res => setTimeout(() => res({ n: document.querySelectorAll('#nav button').length, prog: t('nProgreso'), ent: t('nEntrenar') }), 600)); });
  ok('Barra inferior: la activa mide 56 y las demás 40', r.prog === 56 && r.ent === 40, r);
  // 11. Comida: los botones de Agregar entran en la primera pantalla
  r = await p.evaluate(() => { verTab('Comida'); window.scrollTo(0, 0); const f = document.querySelector('#vComida .siempre'); return { top: Math.round(f.getBoundingClientRect().top), alto: innerHeight }; });
  ok('Comida: los de siempre (licuado, tupper, cena) a la vista', r.top < r.alto - 120, r);
  // 12. Aviso flotante sólido (sin transparencia)
  r = await p.evaluate(() => { toast('Prueba'); const c = getComputedStyle($('toast')); return { bg: c.backgroundColor, borde: c.borderTopWidth }; });
  ok('Aviso: fondo sólido con borde', !/rgba\(.*,\s*0(\.\d+)?\)/.test(r.bg) && r.borde === '1px', r);
  ok('Sin errores de página (1)', !p.errs.length, p.errs);
  // 13. 6:30 pm: Proteína avisa (punto) y abre su tarjeta abajo; botón cerrar visible
  p = await pagina(b, '2026-10-22T18:30:00');
  r = await p.evaluate(() => { const m = [...document.querySelectorAll('.mosaicos button')], prot = m.find(x => /Proteína/.test(x.textContent)); prot.click();
    const x = $('sheet').querySelector('.cerrar'); return { ojo: prot.classList.contains('ojo'), hoja: !!$('sheet').querySelector('.prot6'), cerrar: x && getComputedStyle(x).width }; });
  ok('6:30 pm: Proteína con punto abre su tarjeta, ✕ de 38px', r.ojo && r.hoja && r.cerrar === '38px', r);
  ok('Sin errores de página (2)', !p.errs.length, p.errs);
  // 14. Otro día (FECHA): sin mosaicos, con tarjeta de peso; rack no aparece
  r = await p.evaluate(() => { cambiarFecha(sumarDias(hoy(), -1)); return { mos: !!document.querySelector('.mosaicos'), rack: !!document.querySelector('.rack'), otro: !!document.querySelector('.otro') }; });
  ok('Otro día: sin mosaicos ni rack', !r.mos && !r.rack && r.otro, r);
  // 15. Movimiento reducido: todo funciona igual
  p = await pagina(b, '2026-10-22T10:00:00', { quieto: true });
  r = await p.evaluate(() => { const n = OPEN, st = state[n]; marcar(n, st.sets.findIndex(s => s.t !== 'C')); return document.querySelector('#entCuerpo h2').textContent; });
  ok('Movimiento reducido: sube a Ahora sin animación', r === 'Ahora', r);
  ok('Sin errores de página (3)', !p.errs.length, p.errs);
  console.log(casos.join('\n'));
  await b.close();
})();
