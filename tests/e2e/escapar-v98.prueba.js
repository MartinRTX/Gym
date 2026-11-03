// v9.8: todo lo que viene de afuera (tu hoja, la IA, Open Food Facts) se muestra como TEXTO. Se mete una marca HTML
// en cada campo de texto y se recorren las pantallas: si en algún lado aparece como elemento, falló el escapado.
const BASE = process.env.E2E_URL || 'http://localhost:8770/';
const { chromium } = require('playwright');
const res = []; const ok = (n, c, x) => res.push((c ? '✓ ' : '✗ ') + n + (x !== undefined ? ' · ' + JSON.stringify(x).slice(0, 300) : ''));
const X = '<b data-inyectado="1">X</b>';
(async () => {
  const b = await chromium.launch();
  const DATA = JSON.parse(JSON.stringify(require('./datos.js')));
  Object.assign(DATA, { ia: true, scriptVersion: '8.5', nombre: 'Martin' + X });
  DATA.exercises.forEach(e => { ['ejercicio', 'variante', 'patron', 'tecnica', 'hint', 'nota', 'modalidad'].forEach(k => { if (typeof e[k] === 'string' && e[k]) e[k] += X; }); });
  DATA.comidas = [{ t: 'Taco' + X, g: 20, c: 10, f: 5, k: 180 }];
  DATA.carrera = { fecha: '2026-11-21', km: 5, nombre: '5K' + X };
  const hoyK = DATA.todayKey;
  DATA.comidasDias = { [hoyK]: [{ id: 'z1', h: '08:00', m: 'd', n: 'Licuado' + X, q: 100, u: 'g', p: 20, c: 10, f: 5, k: 180, fib: 1, src: 'ia', ref: '' }] };
  const IA = {
    comidaIA: { items: [{ nombre: 'Pizza' + X, gramos: 100, g: 10, c: 30, f: 10, k: 260, nota: 'nota' + X, ingredientes: [{ nombre: 'Queso' + X, gramos: 30, g: 7, c: 1, f: 7, k: 95 }] }], consejo: 'tip' + X },
    etiquetaIA: { es_etiqueta: true, nombre: 'Leche' + X, marca: 'Marca' + X, u: 'ml', declarada: 'porcion', porcion: { texto: 'vaso' + X, cant: 250, p: 8, c: 12, f: 8, k: 150 }, avisos: ['aviso' + X] },
    chat: { texto: 'Hola' + X, modelo: 'x' }, plan: { foco: 'foco' + X, ejercicios: [] }
  };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(d => { if (location.protocol === 'about:') return; localStorage.setItem('gym_api', JSON.stringify('https://script.google.com/macros/s/MOCK/exec')); localStorage.setItem('gym_key', '"demo"');
    localStorage.setItem('gym_data', JSON.stringify(d)); localStorage.setItem('gym_bienvenida', 'true'); localStorage.setItem('gym_tour', 'true'); }, DATA);
  await ctx.route('https://script.google.com/**', r => { let x = {}; try { x = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, result: x.action === 'data' ? DATA : IA[x.action] || [] }) }); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.waitForTimeout(1500);
  const malos = [];
  const revisar = async n => { const hay = await p.evaluate(() => document.querySelectorAll('[data-inyectado]').length); if (hay) malos.push(n + ' (' + hay + ')'); };
  const pasos = [
    ['Entrenar', () => verTab('Entrenar')], ['Ejercicio abierto', () => { const e = DATA.exercises.find(x => x.group === GRUPO); OPEN = null; abrir(e.name); }],
    ['Menú', () => menuEjercicio(OPEN)], ['Cambiar', () => { cerrarModal(); elegirCambio(OPEN); }], ['Técnica', () => { cerrarModal(); verTecnica(OPEN); }],
    ['Comida', () => { cerrarModal(); verTab('Comida'); }], ['Buscador', () => abrirBuscador({ q: 'taco' })], ['Metas', () => { cerrarModal(); abrirMetas(); }],
    ['Progreso', () => { cerrarModal(); verTab('Progreso'); }], ['Fuerza', () => verPTab('Fuerza')], ['Cuerpo', () => verPTab('Cuerpo')], ['Logros', () => verPTab('Logros')],
    ['Músculos', () => verTab('Musculos')], ['Coach', () => verTab('Coach')], ['Ajustes', () => abrirAjustes()]
  ];
  for (const [n, f] of pasos) { try { await p.evaluate(f); await p.waitForTimeout(300); await revisar(n); } catch (e) { malos.push(n + ': ' + e.message.split('\n')[0]); } }
  // Respuestas de la IA: comida (con ingredientes), etiqueta y coach
  try {
    await p.evaluate(() => { cerrarModal(); verTab('Comida'); }); await p.fill('#iaComida', 'pizza'); await p.click('text=Calcular'); await p.waitForTimeout(600);
    await p.evaluate(() => { COMIDA_IA.items[0].verIng = true; pintarComida(); }); await p.waitForTimeout(150); await revisar('Respuesta IA comida');
    await p.evaluate(() => editarItemIA(0)); await p.waitForTimeout(150); await revisar('Editar respuesta IA');
    await p.evaluate(() => { cerrarModal(); abrirEtiqueta({ es_etiqueta: true, nombre: 'Leche<b data-inyectado="1">X</b>', marca: 'M<b data-inyectado="1">X</b>', u: 'ml', declarada: 'porcion', porcion: { texto: 'vaso<b data-inyectado="1">X</b>', cant: 250, p: 8, c: 12, f: 8, k: 150 }, avisos: ['a<b data-inyectado="1">X</b>'] }); });
    await p.waitForTimeout(150); await revisar('Etiqueta');
    await p.evaluate(() => { cerrarModal(); agregarComidaIA && COMIDA_IA && agregarComidaIA(); verTab('Comida'); }); await p.waitForTimeout(200); await revisar('Día con lo de la IA');
    await p.evaluate(() => { const i = prot.length - 1; if (i >= 0) abrirItemDia(i); }); await p.waitForTimeout(150); await revisar('Corregir del día');
  } catch (e) { malos.push('IA: ' + e.message.split('\n')[0]); }
  ok('Nada de lo de afuera se vuelve HTML (' + pasos.length + ' pantallas + IA, etiqueta y día)', !malos.length, malos);
  ok('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log(res.join('\n'));
})();
