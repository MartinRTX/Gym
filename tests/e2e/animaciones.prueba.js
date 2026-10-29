// Animación de cada ejercicio dentro de la app: se monta sola, se mueve, cuenta repeticiones, vista de frente y se puede apagar
const BASE = process.env.E2E_URL || 'http://localhost:8770/';
const { chromium } = require('playwright');
const DATA = Object.assign({}, require('./datos.js'), { ia: true, scriptVersion: '7.9' });
// Un ejercicio con tempo propio en el Catálogo (columna W)
DATA.exercises = DATA.exercises.map(e => /Curl martillo/.test(e.ejercicio) ? Object.assign({}, e, { tempo: '3-1-1-0' }) : e);
const res = []; const ok = (n, c, x) => res.push((c ? '✓ ' : '✗ ') + n + (x !== undefined ? ' · ' + JSON.stringify(x).slice(0, 200) : ''));

async function abrir(b, o) {
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', reducedMotion: o && o.quieto ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(d => {
    if (location.protocol === 'about:') return;
    localStorage.setItem('gym_api', JSON.stringify('https://script.google.com/macros/s/MOCK/exec')); localStorage.setItem('gym_key', '"demo"');
    localStorage.setItem('gym_data', JSON.stringify(d)); localStorage.setItem('gym_bienvenida', 'true'); localStorage.setItem('gym_tour', 'true');
  }, DATA);
  await ctx.route('https://script.google.com/**', r => { let a = ''; try { a = JSON.parse(r.request().postData() || '{}').action; } catch (e) {}
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, result: a === 'data' ? DATA : [] }) }); });
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.goto(BASE); await p.waitForTimeout(1500);
  return p;
}

(async () => {
  const b = await chromium.launch();
  let p = await abrir(b);
  try {
    const nombre = await p.evaluate(() => { const e = DATA.exercises.find(x => x.group === GRUPO && !(state[x.name] && state[x.name].done)); OPEN = null; abrir(e.name); return e.name; });
    await p.waitForTimeout(400);
    const a = await p.evaluate(n => {
      const el = document.querySelector('.ex.open .anim-ej'); if (!el) return null;
      const sig = state[n].sets.find(x => !x.ok && x.t !== 'C');
      return { svg: !!el.querySelector('svg'), lista: el.getAttribute('data-lista'), cuenta: el.querySelector('text') ? el.querySelector('text').textContent : '', reps: sig ? sig.r : null,
               d: el.querySelector('svg g:nth-of-type(5) path, svg path[fill="var(--persona)"]').getAttribute('d') };
    }, nombre);
    ok('La tarjeta abierta trae la animación ya dibujada', a && a.svg && a.lista === '1', a);
    ok('Cuenta las repeticiones de la serie que sigue', a && a.cuenta === '1/' + a.reps, a && [a.cuenta, a.reps]);
    await p.waitForTimeout(700);
    const d2 = await p.evaluate(() => document.querySelector('.ex.open .anim-ej svg path[fill="var(--persona)"]').getAttribute('d'));
    ok('Se mueve (cambia su dibujo con el tiempo)', a && d2 !== a.d);
    ok('Dice la fase debajo (sube, aprieta, baja…)', await p.evaluate(() => (document.querySelector('.ex.open .anim-fase') || {}).textContent.length > 3));
    // Repintar la tarjeta (marcar una serie) no deja animaciones repetidas
    await p.evaluate(n => { marcar(n, state[n].sets.findIndex(s => !s.ok)); }, nombre); await p.waitForTimeout(400);
    ok('Al repintar queda una sola animación en la tarjeta', await p.evaluate(() => document.querySelectorAll('.ex.open .anim-ej svg').length === 1));
    // Técnica: grande, con su tempo; de frente para elevaciones laterales
    const lat = await p.evaluate(() => DATA.exercises.find(e => /laterales/i.test(e.ejercicio)).name);
    await p.evaluate(n => verTecnica(n), lat); await p.waitForTimeout(400);
    const t = await p.evaluate(() => ({ grande: !!document.querySelector('#sheet .anim-ej.grande svg'), tempo: (document.querySelector('#sheet .anim-tempo') || {}).textContent || '',
      frente: ANIM.familiaDe(exDe(document.querySelector('#sheet .anim-ej').getAttribute('data-ej'))) }));
    ok('Técnica: animación grande con su tempo', t.grande && /Sube 0\.8 s · aprieta 0\.35 s · baja 1\.5 s/.test(t.tempo), t);
    ok('Elevaciones laterales: vista de frente', t.frente === 'laterales' && ANIM_FRENTE(await p), t.frente);
    // Tempo propio del Catálogo
    const curl = await p.evaluate(() => DATA.exercises.find(e => /Curl martillo/.test(e.ejercicio)).name);
    await p.evaluate(n => { cerrarModal(); verTecnica(n); }, curl); await p.waitForTimeout(300);
    ok('Tempo del Catálogo (3-1-1-0) en la ficha', /Sube 1 s · aprieta 0\.15 s · baja 3 s/.test(await p.evaluate(() => document.querySelector('#sheet .anim-tempo').textContent)));
    await p.evaluate(() => cerrarModal());
    // Solo se animan las que están en pantalla
    // Solo se dibujan las que están en pantalla: una ventana cerrada (o una tarjeta fuera de la vista) no cambia
    const foto = () => p.evaluate(() => [...document.querySelectorAll('.anim-ej svg')].map(sv => ({ d: (sv.querySelector('path[fill="var(--persona)"]') || {}).getAttribute ? sv.querySelector('path[fill="var(--persona)"]').getAttribute('d') : '', caja: sv.getClientRects().length > 0 })));
    const f1 = await foto(); await p.waitForTimeout(600); const f2 = await foto();
    ok('Solo se mueven las que se ven (la de una ventana cerrada se queda quieta)', f1.length === f2.length && f1.every((x, i) => x.caja ? x.d !== f2[i].d : x.d === f2[i].d), f1.map((x, i) => [x.caja, x.d !== f2[i].d]));
    // Apagarla en Ajustes
    await p.evaluate(() => { setAjuste('animaciones', false); pintarTab(); }); await p.waitForTimeout(300);
    ok('Se puede apagar en Ajustes', await p.evaluate(() => !document.querySelector('.ex.open .anim-ej')));
    await p.evaluate(() => { setAjuste('animaciones', true); pintarTab(); });
    ok('Sin errores de animación en el registro', await p.evaluate(() => !LS.get('gym_jserr', []).some(e => /Animación/.test(e.msg))));
  } catch (e) { ok('La prueba de animaciones terminó', false, e.message.split('\n')[0]); }
  ok('Sin errores de página', !p.errs.length, p.errs);
  await p.context().close();

  // Movimiento reducido: quieta (no cambia con el tiempo)
  p = await abrir(b, { quieto: true });
  try {
    await p.evaluate(() => { const e = DATA.exercises.find(x => x.group === GRUPO); OPEN = null; abrir(e.name); }); await p.waitForTimeout(300);
    const d1 = await p.evaluate(() => document.querySelector('.ex.open .anim-ej svg path[fill="var(--persona)"]').getAttribute('d'));
    await p.waitForTimeout(800);
    const d2 = await p.evaluate(() => document.querySelector('.ex.open .anim-ej svg path[fill="var(--persona)"]').getAttribute('d'));
    ok('Con "reducir movimiento" se queda quieta', d1 === d2);
  } catch (e) { ok('Movimiento reducido', false, e.message.split('\n')[0]); }
  ok('Sin errores de página (movimiento reducido)', !p.errs.length, p.errs);
  await b.close();
  console.log(res.join('\n'));
})();
// ¿La ficha abierta dibuja una figura de frente? (dos brazos: brazo0 y brazo1)
async function ANIM_FRENTE(p) { return p.evaluate(() => { const a = document.querySelector('#sheet .anim-ej').__anim; return !!(a && a.c && a.c.brazo0 && a.c.brazo1); }); }
