const BASE = process.env.E2E_URL || 'http://localhost:8770/';
const TMP = require('os').tmpdir();
const res = []; const ok = (n, c, x) => res.push((c ? '✓ ' : '✗ ') + n + (x !== undefined ? ' · ' + JSON.stringify(x).slice(0, 160) : ''));
const IMAGEN = require('path').join(__dirname, '..', '..', 'icon-512.png');
const { chromium } = require('playwright');
const DATA = require('./datos.js'); DATA.ia = true;
const ex = DATA.exercises.find(e => e.anterior && e.anterior.length && e.group === 'Pull');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(d => { localStorage.setItem('gym_api', JSON.stringify('https://script.google.com/macros/s/MOCK/exec')); localStorage.setItem('gym_key', '"demo"');
    localStorage.setItem('gym_data', JSON.stringify(d)); localStorage.setItem('gym_bienvenida', 'true'); if (!window.__conTour) localStorage.setItem('gym_tour', 'true'); }, DATA);
  let modo = 'cat', nuevo = null;
  await ctx.route('https://script.google.com/**', async r => {
    let a = '', body = {}; try { body = JSON.parse(r.request().postData() || '{}'); a = r.request().method() === 'GET' ? new URL(r.request().url()).searchParams.get('action') : body.action; } catch (e) {}
    const ok = x => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, result: x }) });
    if (a === 'maquinaIA') return ok(modo === 'cat'
      ? { maquina: 'Remo sentado', ejercicio: ex.ejercicio, enCatalogo: ex.ejercicio, otros: ['Remo a una mano'], grupo: 'Pull', confianza: 'alta' }
      : { maquina: 'Hack squat', ejercicio: 'Sentadilla hack en máquina', enCatalogo: '', otros: [], grupo: 'Legs', musculo: 'Cuádriceps', secundario: 'Glúteo', zonas: 'Cuádriceps:1, Glúteo:0.5',
          modalidad: 'Discos', anotar: 'Por lado', series: 3, min: 8, max: 12, como: 'Espalda pegada · baja hasta 90° · empuja con todo el pie', confianza: 'alta' });
    if (a === 'nuevoEjercicio') { nuevo = body.args[0]; return ok({ ya: false, ejercicio: nuevo.ejercicio, grupo: nuevo.grupo }); }
    return ok(a === 'data' ? DATA : []);
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.waitForTimeout(1200);
  await p.evaluate(() => elegirMusculo()); await p.waitForTimeout(200);
  await p.click('text=¿Una máquina que no conoces?'); await p.waitForTimeout(200);
  await p.screenshot({ path: TMP + '/maq-0.png' });
  const subir = async (btn) => { const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click(btn)]); await fc.setFiles(IMAGEN); await p.waitForTimeout(1500); };
  await subir('text=Tomar foto');
  await p.screenshot({ path: TMP + '/maq-1.png' });
  const cat = await p.locator('.maqok').innerText();
  ok('Reconoce un ejercicio que ya está en tu catálogo', cat.includes(ex.ejercicio) && /Ya lo has hecho/.test(cat), cat);
  modo = 'nuevo'; await p.click('text=Otra foto'); await subir('text=Elegir de la galería');
  await p.screenshot({ path: TMP + '/maq-2.png' });
  await p.click('text=Agregarlo a mi catálogo'); await p.waitForTimeout(1200);
  ok('Agrega el nuevo con sus datos y sin mandar la foto', nuevo && nuevo.ejercicio === 'Sentadilla hack en máquina' && nuevo.grupo === 'Legs' && !('foto' in nuevo), nuevo && Object.keys(nuevo));
  await p.evaluate(() => { BUSCA = 'zzzz'; pintarEntrenar(); }); await p.waitForTimeout(200);
  ok('Si la búsqueda no encuentra nada, ofrece la foto', await p.locator('text=¿No aparece? Tómale foto').count() === 1);
  ok('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log(res.join('\n'));
})();
