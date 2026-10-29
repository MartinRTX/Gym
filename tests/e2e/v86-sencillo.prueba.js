// Pruebas de v8.6: tour, modo sencillo, foto de la máquina, repetir ayer, lo que falló, aviso 7 am, cintura
const BASE = process.env.E2E_URL || 'http://localhost:8770/';
const TMP = require('os').tmpdir();
const IMAGEN = require('path').join(__dirname, '..', '..', 'icon-512.png');
const { chromium } = require('playwright');
const DATA = require('./datos.js'); DATA.ia = true;
const res = []; const ok = (n, c, x) => { res.push((c ? '✓ ' : '✗ ') + n + (x !== undefined ? ' · ' + JSON.stringify(x).slice(0, 160) : '')); };
async function pagina(b, o) {
  const ctx = await b.newContext({ viewport: { width: o.w || 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block', colorScheme: o.tema || 'light' });
  await ctx.addInitScript(([d, extra, nativo]) => {
    localStorage.setItem('gym_api', JSON.stringify('https://script.google.com/macros/s/MOCK/exec')); localStorage.setItem('gym_key', '"demo"');
    localStorage.setItem('gym_data', JSON.stringify(d)); localStorage.setItem('gym_bienvenida', 'true');
    Object.keys(extra).forEach(k => localStorage.setItem(k, JSON.stringify(extra[k])));
    if (nativo) { window.__llamadas = []; window.Capacitor = { isNativePlatform: () => true, addListener: (p, e) => { window.__llamadas.push('listen ' + p + '.' + e); return {}; },
      nativePromise: (p, m, a) => { window.__llamadas.push(p + '.' + m + ' ' + JSON.stringify(a || {}).slice(0, 3000)); return Promise.resolve(m === 'estado' ? { ok: true, apk: '7.5.11' } : {}); } }; }
  }, [DATA, o.ls || {}, !!o.nativo]);
  await ctx.route('https://script.google.com/**', r => { let a = ''; try { a = JSON.parse(r.request().postData() || '{}').action || new URL(r.request().url()).searchParams.get('action'); } catch (e) {}
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, result: a === 'data' ? DATA : [] }) }); });
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.clock.install({ time: new Date(o.hora || '2026-10-27T08:10:00') });
  await p.goto(BASE); await p.waitForTimeout(1500);
  return p;
}
const ayer = '2026-10-26';
(async () => {
  const b = await chromium.launch();
  // 1) Tour la primera vez
  let p = await pagina(b, {});
  ok('Tour aparece solo la primera vez', await p.locator('#tour').count() === 1);
  for (let i = 1; i <= 4; i++) { await p.screenshot({ path: TMP + '/tour-' + i + '.png' }); const t = await p.locator('#tour .t2').innerText().catch(() => ''); ok('Tour paso ' + i, !!t, t); await p.click('#tour .btn'); await p.waitForTimeout(250); }
  ok('Tour termina y queda visto', await p.locator('#tour').count() === 0 && await p.evaluate(() => LS.get('gym_tour', false)));
  ok('Sin bloqueo de scroll tras el tour', !(await p.evaluate(() => document.documentElement.classList.contains('conmodal'))));
  await p.evaluate(() => iniciarTour()); await p.waitForTimeout(200);
  await p.evaluate(() => history.back()); await p.waitForTimeout(400);
  ok('Atrás cierra el tour', await p.locator('#tour').count() === 0);
  ok('Grupos con nombre normal', (await p.locator('.chips .chip.r-Pull').innerText()).includes('Espalda y bíceps'));
  ok('Sin errores (tour)', !p.errs.length, p.errs);
  await p.context().close();

  // 2) Modo sencillo
  p = await pagina(b, { ls: { gym_tour: true, gym_cfg_sencillo: true } });
  ok('Hoy te toca en vez de mosaicos', await p.locator('.hoytoca li').count() === 3 && await p.locator('.mosaicos').count() === 0);
  ok('Sin Músculos ni Coach en la barra', !(await p.locator('#nMusculos').isVisible()));
  ok('Sin Ruta de hoy', await p.locator('.ruta').count() === 0);
  await p.screenshot({ path: TMP + '/sencillo-hoy.png' });
  await p.locator('.hoytoca li').nth(1).locator('button').click(); await p.waitForTimeout(500);
  const instr = await p.locator('.ex.open .facil').innerText().catch(() => '');
  ok('Entrenar abre el primer ejercicio con una instrucción', /Serie 1 de \d+: hazlo/.test(instr), instr);
  ok('Encabezados en palabras simples', (await p.locator('.ex.open .sets-h').innerText()).includes('Veces'));
  await p.evaluate(() => { const c = document.querySelector('.ex.open'); window.scrollTo(0, c.getBoundingClientRect().top + scrollY - 10); });
  await p.screenshot({ path: TMP + '/sencillo-ejercicio.png' });
  // Foto de la máquina desde la tarjeta
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('.ex.open .exfoto-vacia')]);
  await fc.setFiles(IMAGEN); await p.waitForTimeout(800);
  ok('Foto guardada y se ve en la tarjeta', await p.locator('.ex.open img.exfoto').count() === 1);
  const kb = await p.evaluate(() => IDB.todas().then(m => Math.round(Object.values(m).join('').length / 1024)));
  ok('La foto pesa poco', kb < 120, kb + ' KB');
  await p.click('.ex.open img.exfoto'); await p.waitForTimeout(200); await p.click('text=Quitar'); await p.click('text=Sí, quitarla'); await p.waitForTimeout(300);
  ok('Quitar la foto pide confirmar y la quita', await p.locator('.ex.open img.exfoto').count() === 0);
  // Marcar series: la instrucción avanza
  await p.locator('.ex.open .set .chk').first().click(); await p.waitForTimeout(400);
  const instr2 = await p.locator('.ex.open .facil').innerText().catch(() => '');
  ok('La instrucción pasa a la serie 2', /Serie 2 de/.test(instr2), instr2);
  ok('Sin errores (sencillo)', !p.errs.length, p.errs);
  await p.context().close();

  // 3) Repetir lo de ayer, lo que falló y aviso de 7 am (APK)
  p = await pagina(b, { nativo: true, ls: { gym_tour: true, ['gym_prot_' + ayer]: ['Scoop', 'Huevo'], ['gym_protmeal_' + ayer]: ['d', 'd'],
    gym_jserr: [{ dia: '2026-10-27', ts: '2026-10-27T13:00:00Z', msg: 'IA comida: La IA tardó demasiado · «tacos»', donde: 'calcularComida' }] } });
  await p.evaluate(() => verTab('Comida')); await p.waitForTimeout(300);
  ok('Botón Repetir lo de ayer', await p.locator('text=Repetir lo de ayer').count() === 1);
  await p.screenshot({ path: TMP + '/repetir.png' });
  await p.click('text=Repetir lo de ayer'); await p.waitForTimeout(300);
  ok('Se agregó lo de ayer y el botón se va', await p.evaluate(() => prot.length === 2 && protTotal() > 0 && tDe(prot[1]) === tDe('Huevo')) && await p.locator('text=Repetir lo de ayer').count() === 0, await p.evaluate(() => prot));
  await p.evaluate(() => abrirAjustes()); await p.waitForTimeout(200);
  ok('Ajustes: modo sencillo, tour, aviso 7 am y lo que falló', ['Modo sencillo', 'Tour de la app', 'pesarte a las 7 am', 'Lo que falló'].every(async t => true) && (await p.locator('#sheet').innerText()).includes('pesarte a las 7 am'));
  await p.evaluate(() => abrirFallas()); await p.waitForTimeout(200);
  ok('Lo que falló lista el error', (await p.locator('#sheet').innerText()).includes('La IA tardó'));
  await p.screenshot({ path: TMP + '/fallas.png' });
  const llam = await p.evaluate(() => window.__llamadas.filter(x => /schedule/.test(x)).pop() || '');
  ok('Aviso de peso 7 am programado (con acción peso, canal propio)', /"channelId":"peso"/.test(llam) && /"id":7\d/.test(llam) && /"accion":"peso"/.test(llam) && /Ya te pesaste/.test(llam));
  ok('Hoy no, si son las 8:10', !/"at":"2026-10-27T13:00/.test(llam));
  ok('Escucha el toque del aviso', await p.evaluate(() => window.__llamadas.some(x => /localNotificationActionPerformed/.test(x))));
  ok('Sin errores (comida/ajustes)', !p.errs.length, p.errs);
  await p.context().close();

  // 4) Domingo sin pesarte: cintura a la vista
  p = await pagina(b, { hora: '2026-10-25T08:30:00', ls: { gym_tour: true } });
  ok('Cintura el domingo sin pesarte', await p.locator('.mosaicos button', { hasText: 'Cintura' }).count() === 1);
  await p.context().close();

  // 5) Bienvenida con "Soy nuevo"
  const D2 = Object.assign({}, DATA, { perfil: false });
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(d => { localStorage.setItem('gym_api', JSON.stringify('https://script.google.com/macros/s/MOCK/exec')); localStorage.setItem('gym_key', '"demo"'); localStorage.setItem('gym_data', JSON.stringify(d)); }, D2);
  await ctx.route('https://script.google.com/**', r => { let a = ''; try { a = JSON.parse(r.request().postData() || '{}').action || new URL(r.request().url()).searchParams.get('action'); } catch (e) {}
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, result: a === 'data' ? D2 : [] }) }); });
  p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.goto(BASE); await p.waitForTimeout(1200);
  await p.evaluate(() => abrirBienvenida()); await p.waitForTimeout(200);
  await p.fill('#bvPeso', '70'); await p.click('text=Soy nuevo'); await p.screenshot({ path: TMP + '/bienvenida.png' }); await p.click('.bv .acts .btn:not(.ghost)'); await p.waitForTimeout(1500);
  ok('Soy nuevo → modo sencillo y tour', await p.evaluate(() => sencillo() && document.body.classList.contains('sencillo')) && await p.locator('#tour').count() === 1);
  ok('Sin errores (bienvenida)', !p.errs.length, p.errs);
  await b.close();
  console.log(res.join('\n'));
})();
