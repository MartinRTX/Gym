// Pantallas que ya se pintan con la plantilla html`…` (v9.9: Coach, Trote y Sesión; v10.0: Ajustes; v10.1: Comida, Entrenar, Progreso y Músculos). Dos riesgos al pasarlas: que algo de afuera se vuelva HTML
// (se escapa de menos) o que un pedazo de la app salga como texto "<div…" (se escapa de más: html`a` + html`b` ya es texto).
const BASE = process.env.E2E_URL || 'http://localhost:8770/';
const { chromium } = require('playwright');
const res = []; const ok = (n, c, x) => res.push((c ? '✓ ' : '✗ ') + n + (x !== undefined ? ' · ' + JSON.stringify(x).slice(0, 300) : ''));
const X = '<b data-inyectado="1">X</b>';
(async () => {
  const b = await chromium.launch();
  const DATA = JSON.parse(JSON.stringify(require('./datos.js')));
  Object.assign(DATA, { ia: true, scriptVersion: '8.6', memoria: ['Le duele el hombro' + X] });
  DATA.today += X;
  DATA.plan.carrera.nombre = '5K' + X; DATA.plan.sesiones[0].tipo = 'Fácil' + X; DATA.plan.sesiones[0].ritmo = '7:15' + X; DATA.plan.sesiones[1].txt += X;
  DATA.trotes.ultimos = DATA.trotes.ultimos.concat([{ d: '18/10' + X, k: '2026-10-18', km: 3, min: 24, uid: 'u2', tipo: 'Fácil' + X, fc: 160 }]);
  // v10.1: comida, ejercicios y progreso con HTML metido
  DATA.exercises.forEach(e => { e.ejercicio += X; if (e.modalidad) e.modalidad += X; });
  DATA.comidas = [{ t: 'Taco' + X, g: 20, c: 10, f: 5, k: 180 }];
  DATA.comidasDias = { [DATA.todayKey]: [{ id: 'z1', h: '08:00', m: 'd', n: 'Licuado' + X, q: 100, u: 'g', p: 20, c: 10, f: 5, k: 180, fib: 1, src: 'ia', ref: '' }] };
  DATA.resumen = Object.assign({}, DATA.resumen, { records: [{ ej: 'Press' + X, w: 100, unit: 'lb', r: 8, k: '2026-10-20', tipo: 'peso', pct: 3 }], subir: [{ ej: 'Remo' + X, peso: 50, unit: 'lb' }] });
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(d => { if (location.protocol === 'about:') return; localStorage.setItem('gym_api', JSON.stringify('https://script.google.com/macros/s/MOCK/exec')); localStorage.setItem('gym_key', '"demo"');
    localStorage.setItem('gym_data', JSON.stringify(d)); localStorage.setItem('gym_bienvenida', 'true'); localStorage.setItem('gym_tour', 'true');
    localStorage.setItem('gym_chat', JSON.stringify([{ rol: 'yo', texto: 'Hola<b data-inyectado="1">X</b>', ts: Date.now() }, { rol: 'coach', texto: '**Bien**<b data-inyectado="1">X</b>', ts: Date.now(), aprendio: ['dato<b data-inyectado="1">X</b>'] }])); }, DATA);
  await ctx.route('https://script.google.com/**', r => { let x = {}; try { x = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, result: x.action === 'data' ? DATA : [] }) }); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.waitForTimeout(1500);
  const inyectados = () => p.evaluate(() => document.querySelectorAll('[data-inyectado]').length);
  // Lo que ve el usuario no debe traer etiquetas sueltas (salvo la marca de la prueba, que debe verse como texto)
  const etiquetasSueltas = sel => p.evaluate(s => { const t = Array.from(document.querySelectorAll(s)).map(e => e.innerText).join('\n').split('<b data-inyectado="1">X</b>').join('');
    return (t.match(/<\/?(div|span|button|b|i|svg|br)\b|&(lt|gt|amp|quot|#39);/g) || []).slice(0, 5); }, sel);
  try {
    // Trote con plan, lectura de captura y salidas
    await p.evaluate(() => { verTab('Entrenar'); TROTE.ia = { km: 5.2, min: 31.5, fc: 150, zonas: { z2: 5, z3: 10 }, vueltas: [{ ritmo: '6:01<b data-inyectado="1">X</b>' }], analisis: 'Bien<b data-inyectado="1">X</b>' }; elegirGrupo('Trote'); });
    await p.waitForTimeout(300);
    ok('Trote: las sesiones del plan son elementos (no texto)', await p.locator('#vEntrenar .pses').count() === 3);
    ok('Trote: la lectura de la captura es un elemento', await p.locator('#vEntrenar .foco .zonas div').count() === 5);
    ok('Trote: nada de afuera se vuelve HTML y no salen etiquetas como texto', !(await inyectados()) && !(await etiquetasSueltas('#vEntrenar')).length, await etiquetasSueltas('#vEntrenar'));
    ok('Trote: las marcas de afuera se ven como texto', /5K<b data-inyectado/.test(await p.locator('#vEntrenar .plan5k').innerText()) && /18\/10<b data-inyectado/.test(await p.locator('#vEntrenar').innerText()));
    await p.evaluate(() => tecladoTrote('min')); await p.waitForTimeout(150);
    ok('Teclado del trote: botones y teclas como elementos', await p.locator('#kpSheet .quick button').count() === 4 && await p.locator('#kpSheet .keys button').count() === 12);
    await p.evaluate(() => cerrarTeclado());
    // Coach
    await p.evaluate(() => { MEM_ABIERTA = true; verTab('Coach'); }); await p.waitForTimeout(300);
    ok('Coach: burbujas, memoria y negritas como elementos', await p.locator('#vCoach .msg').count() === 2 && await p.locator('#vCoach .mem li').count() === 1 && await p.locator('#vCoach .msg.coach b').count() === 1);
    ok('Coach: nada de afuera se vuelve HTML y no salen etiquetas como texto', !(await inyectados()) && !(await etiquetasSueltas('#vCoach')).length, await etiquetasSueltas('#vCoach'));
    // Resumen de la sesión y descanso
    await p.evaluate(() => { verTab('Entrenar'); const s = sesion(), e = DATA.exercises[0]; s.start = Date.now() - 40 * 60000;
      s.log = [{ name: e.name, ej: e.ejercicio + '<b data-inyectado="1">X</b>', unit: 'lb', vol: 1000, sets: [{ w: 60, r: 8 }], prs: ['peso'] }]; guardarSesion(s); terminarSesion(); });
    await p.waitForTimeout(200);
    ok('Resumen de la sesión: cifras, récord y botones como elementos', await p.locator('#sheet .stats b').count() === 3 && await p.locator('#sheet .acts .btn').count() === 2 && /Récord de peso en/.test(await p.locator('#sheet').innerText()));
    ok('Resumen: nada de afuera se vuelve HTML y no salen etiquetas como texto', !(await inyectados()) && !(await etiquetasSueltas('#sheet')).length, await etiquetasSueltas('#sheet'));
    await p.evaluate(() => { cerrarModal(); setAjuste('autoDescanso', false); sugerirDescanso(); }); await p.waitForTimeout(100);
    ok('Descanso: los 4 tiempos como botones', await p.locator('#rest .rbtn:not(.x)').count() === 4);
    await p.evaluate(() => iniciarRest(90)); await p.waitForTimeout(300);
    ok('Descanso corriendo: reloj, +30 s y Omitir', /\d:\d\d/.test(await p.locator('#rest .big').innerText()) && await p.locator('#rest .rbtn').count() === 2);
    await p.evaluate(() => detenerRest());
    // Ajustes (con nombre y versión del script de afuera), bienvenida y diagnóstico
    await p.evaluate(() => { DATA.nombre = 'Martin<b data-inyectado="1">X</b>'; DATA.scriptVersion = '7.0<b data-inyectado="1">X</b>'; abrirAjustes(); }); await p.waitForTimeout(200);
    ok('Ajustes: interruptores con su ícono, aviso del script y pastillas como elementos', await p.locator('#sheet .tog').count() >= 8 && await p.locator('#sheet .aic svg').count() >= 12 &&
      await p.locator('#sheet .aviso-script').count() === 1 && await p.locator('#sheet .dias button').count() === 7);
    ok('Ajustes: nada de afuera se vuelve HTML y no salen etiquetas como texto', !(await inyectados()) && !(await etiquetasSueltas('#sheet')).length, await etiquetasSueltas('#sheet'));
    await p.evaluate(() => { cerrarModal(); const s = sesion(); s.ended = true; guardarSesion(s); BV = null; BV_POSPUESTA = false; abrirBienvenida(); BV.peso = '80'; bvMeta(); }); await p.waitForTimeout(150);
    ok('Bienvenida: días, carrera y meta de proteína como elementos', await p.locator('#sheet .bv .dias button').count() === 7 && await p.locator('#bvMeta b').count() === 1);
    ok('Bienvenida: nada de afuera se vuelve HTML y no salen etiquetas como texto', !(await inyectados()) && !(await etiquetasSueltas('#sheet')).length, await etiquetasSueltas('#sheet'));
    await p.evaluate(() => { cerrarModal(); BV = null; DIAG = { e: null, apk: '' }; abrirModal('completa'); pintarDiagnostico(); }); await p.waitForTimeout(150);
    ok('Diagnóstico: renglones y botones como elementos', await p.locator('#sheet .diag .dl').count() >= 3 && await p.locator('#sheet .diag-bt button').count() === 5 && !(await etiquetasSueltas('#sheet')).length);
    await p.evaluate(() => cerrarModal());
    // Comida: anillo, botones, por comida, lo de hoy y la respuesta de la IA con ingredientes
    await p.evaluate(() => verTab('Comida')); await p.waitForTimeout(250);
    ok('Comida: anillo, botones, por comida y lo de hoy como elementos', await p.locator('#vComida .protcard .ring svg').count() === 1 && await p.locator('#vComida .foods button.food').count() > 3 &&
      await p.locator('#vComida .porcomida .comidas3 button').count() === 3 && await p.locator('#vComida .eaten button').count() >= 1);
    ok('Comida: nada de afuera se vuelve HTML y no salen etiquetas como texto', !(await inyectados()) && !(await etiquetasSueltas('#vComida')).length, await etiquetasSueltas('#vComida'));
    await p.evaluate(() => { COMIDA_IA = { texto: 'pizza', consejo: 'tip<b data-inyectado="1">X</b>', items: [{ nombre: 'Pizza<b data-inyectado="1">X</b>', gramos: 100, g: 10, c: 30, f: 10, k: 260, nota: 'n<b data-inyectado="1">X</b>', on: true, verIng: true,
      ingredientes: [{ nombre: 'Queso<b data-inyectado="1">X</b>', gramos: 30, g: 7, c: 1, f: 7, k: 95 }] }] }; pintarComida(); }); await p.waitForTimeout(150);
    ok('Comida: respuesta de la IA e ingredientes como elementos', await p.locator('#vComida .iitem').count() === 1 && await p.locator('#vComida .ings .ing').count() === 2 &&
      !(await inyectados()) && !(await etiquetasSueltas('#vComida')).length, await etiquetasSueltas('#vComida'));
    await p.evaluate(() => { COMIDA_IA = null; });
    // Entrenar: tarjetas, mosaicos, grupos y la técnica de un ejercicio
    await p.evaluate(() => { verTab('Entrenar'); elegirGrupo(DATA.sugGrupo); const e = DATA.exercises.find(x => x.group === GRUPO); OPEN = null; abrir(e.name); }); await p.waitForTimeout(250);
    ok('Entrenar: tarjetas, mosaicos y grupos como elementos', await p.locator('#vEntrenar .ex').count() > 2 && await p.locator('#vEntrenar .mosaicos button').count() >= 2 &&
      await p.locator('#vEntrenar .chips .chip').count() >= 4 && await p.locator('#vEntrenar .ex.open .ex-body').count() === 1);
    ok('Entrenar: nada de afuera se vuelve HTML y no salen etiquetas como texto', !(await inyectados()) && !(await etiquetasSueltas('#vEntrenar')).length, await etiquetasSueltas('#vEntrenar'));
    await p.evaluate(() => verTecnica(OPEN)); await p.waitForTimeout(150);
    ok('Técnica: nada de afuera se vuelve HTML y no salen etiquetas como texto', !(await inyectados()) && !(await etiquetasSueltas('#sheet')).length, await etiquetasSueltas('#sheet'));
    // "¿Quién lo hace normalmente?": antes los botones no tenían acción (una variable tapaba on())
    await p.evaluate(() => { cerrarModal(); menuAsignado(OPEN); }); await p.waitForTimeout(100);
    ok('¿Quién lo hace?: los 3 botones tienen acción', await p.locator('#sheet .pills button[data-click="fijarAsignado"]').count() === 3);
    await p.evaluate(() => cerrarModal());
    // Progreso (las 4 pestañas) y Músculos de hoy
    const malosP = [];
    for (const t of ['Semana', 'Fuerza', 'Cuerpo', 'Logros']) {
      await p.evaluate(t => { verTab('Progreso'); verPTab(t); }, t); await p.waitForTimeout(200);
      const et = await etiquetasSueltas('#vProgreso'); if (await inyectados() || et.length) malosP.push(t + ': ' + et.join(' '));
    }
    ok('Progreso: nada de afuera se vuelve HTML y no salen etiquetas como texto (4 pestañas)', !malosP.length, malosP);
    await p.evaluate(() => verPTab('Fuerza')); await p.waitForTimeout(150);
    ok('Progreso › Fuerza: el mapa (frente y espalda) y las zonas como elementos', await p.locator('#vProgreso .cuerpo svg').count() === 2 && await p.locator('#vProgreso .mchips button').count() > 10);
    await p.evaluate(() => verTab('Musculos')); await p.waitForTimeout(200);
    ok('Músculos de hoy: mapa y leyenda como elementos, sin etiquetas como texto', await p.locator('#vMusculos .cuerpo svg').count() === 2 && await p.locator('#vMusculos .leyenda span').count() === 4 &&
      !(await inyectados()) && !(await etiquetasSueltas('#vMusculos')).length, await etiquetasSueltas('#vMusculos'));
    await p.evaluate(() => verTab('Entrenar'));
  } catch (e) { ok('Recorrido completo', false, e.message.split('\n')[0]); }
  ok('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log(res.join('\n'));
})();
