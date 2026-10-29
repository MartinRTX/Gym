// Botones sin código en el HTML (data-click + un solo escuchador): ninguna pantalla trae on*="…" y cada acción existe
const BASE = process.env.E2E_URL || 'http://localhost:8770/';
const { chromium } = require('playwright');
const DATA = Object.assign({}, require('./datos.js'), { ia: true, scriptVersion: '7.8' });
const res = []; const ok = (n, c, x) => res.push((c ? '✓ ' : '✗ ') + n + (x !== undefined ? ' · ' + JSON.stringify(x).slice(0, 200) : ''));

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  // Cualquier cosa que la política de seguridad bloquee queda anotada (no debería haber nada de la propia app)
  await ctx.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + (e.blockedURI || '') + ' ' + (e.sourceFile || ''))); });
  await ctx.addInitScript(d => {
    if (location.protocol === 'about:') return;
    localStorage.setItem('gym_api', JSON.stringify('https://script.google.com/macros/s/MOCK/exec')); localStorage.setItem('gym_key', '"demo"');
    localStorage.setItem('gym_data', JSON.stringify(d)); localStorage.setItem('gym_bienvenida', 'true'); localStorage.setItem('gym_tour', 'true');
  }, DATA);
  await ctx.route('https://script.google.com/**', r => { let a = ''; try { a = JSON.parse(r.request().postData() || '{}').action; } catch (e) {}
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, result: a === 'data' ? DATA : [] }) }); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.waitForTimeout(1500);

  // Revisa lo que está en pantalla: sin on*="…" y cada data-<evento> con su función
  const revisar = () => p.evaluate(() => {
    const malos = [], sinFuncion = [], argsMalos = [];
    document.querySelectorAll('*').forEach(el => {
      for (const a of el.attributes) {
        if (/^on/i.test(a.name)) malos.push(el.tagName + ' ' + a.name);
        const m = /^data-(click|input|change|toggle|load|error|canplay)$/.exec(a.name);
        if (m) {
          if (typeof window[a.value] !== 'function' || !ACCIONES_OK.has(a.value)) sinFuncion.push(a.value);
          const arg = el.getAttribute(a.name + '-a');
          if (arg) { try { if (!Array.isArray(JSON.parse(arg))) argsMalos.push(a.value); } catch (e) { argsMalos.push(a.value); } }
        }
      }
    });
    return { malos: malos, sinFuncion: [...new Set(sinFuncion)], argsMalos: argsMalos, n: document.querySelectorAll('[data-click]').length };
  });
  const pantallas = [
    ['Entrenar', () => { verTab('Entrenar'); const e = DATA.exercises.find(x => x.group === GRUPO) || DATA.exercises[0]; OPEN = null; abrir(e.name); }],
    ['Menú del ejercicio', () => menuEjercicio(OPEN)],
    ['Cambiar ejercicio', () => elegirCambio(OPEN)],
    ['Elegir músculo', () => elegirMusculo()],
    ['Panel de un músculo', () => elegirMusculo('Bíceps')],
    ['Teclado del peso', () => { cerrarModal(); PESO_TMP = ''; tecladoPeso(); }],
    ['Comida', () => { cerrarTeclado(); verTab('Comida'); }],
    ['Tupper', () => abrirTupper()],
    ['Cenas', () => abrirCenas()],
    ['Buscador', () => abrirBuscador({ q: 'avena' })],
    ['Cámara', () => abrirCamara()],
    ['Metas', () => abrirMetas()],
    ['Progreso', () => { cerrarModal(); verTab('Progreso'); }],
    ['Progreso · Fuerza', () => verPTab('Fuerza')],
    ['Progreso · Cuerpo', () => verPTab('Cuerpo')],
    ['Progreso · Logros', () => verPTab('Logros')],
    ['Músculos', () => verTab('Musculos')],
    ['Ajustes', () => abrirAjustes()],
    ['Bienvenida', () => { cerrarModal(); BV = null; abrirBienvenida(); }]
  ];
  for (const [nombre, f] of pantallas) {
    try { await p.evaluate(f); } catch (e) { ok(nombre + ': abre', false, e.message.split('\n')[0]); continue; }
    await p.waitForTimeout(250);
    const r = await revisar();
    ok(nombre + ': sin código en el HTML y cada botón con su acción (' + r.n + ')', !r.malos.length && !r.sinFuncion.length && !r.argsMalos.length, r);
  }
  await p.evaluate(() => cerrarModal());

  try {
  // Botones que antes eran varias instrucciones: ahora funciones con nombre
  await p.evaluate(() => verTab('Comida')); await p.waitForTimeout(200);
  const ring0 = await p.evaluate(() => RING_FALTA);
  await p.click('.ring'); await p.waitForTimeout(150);
  ok('Anillo de proteína: alterna lo registrado y lo que falta', await p.evaluate(r => RING_FALTA === !r, ring0));
  await p.evaluate(() => abrirTupper()); await p.waitForTimeout(150);
  const t0 = await p.evaluate(() => TUP.tort);
  await p.click('#sheet .ttort button[aria-label="Más"]'); await p.waitForTimeout(100);
  ok('Tupper: + tortillas', await p.evaluate(t => TUP.tort === t + 1, t0));
  await p.locator('#sheet .tchips button').nth(1).click(); await p.waitForTimeout(100);
  ok('Tupper: elegir la proteína', await p.evaluate(() => TUP.prot === NUT.TUPPER.proteinas[1][0]));
  await p.evaluate(() => { cerrarModal(); BUS = null; pedirCantidadDirecta(NUT.BASE[0], 100); }); await p.waitForTimeout(150);
  const q0 = await p.evaluate(() => CANT.q);
  await p.click('#sheet .cantfila button[aria-label="Más"]'); await p.waitForTimeout(100);
  ok('Cantidad: el + suma', await p.evaluate(q => CANT.q > q, q0));
  await p.fill('#sheet .cantfila input', '137'); await p.dispatchEvent('#sheet .cantfila input', 'change'); await p.waitForTimeout(100);
  ok('Cantidad: escribirla la cambia', await p.evaluate(() => CANT.q === 137));
  await p.evaluate(() => cerrarCantidad());
  await p.evaluate(() => verTab('Progreso')); await p.waitForTimeout(150);
  await p.locator('.seg button', { hasText: 'Fuerza' }).click(); await p.waitForTimeout(150);
  ok('Progreso: las pestañas cambian', await p.evaluate(() => PTAB === 'Fuerza'));
  await p.evaluate(() => abrirAjustes()); await p.waitForTimeout(150);
  await p.locator('#sheet .pills button').nth(2).click(); await p.waitForTimeout(150);
  ok('Ajustes: elegir el descanso', await p.evaluate(() => ajuste('descanso', 90) === DESCANSOS[2]));
  // Fondo oscuro: tocar dentro de la hoja no cierra; tocar fuera, sí
  await p.evaluate(() => { cerrarModal(); elegirMusculo(); }); await p.waitForTimeout(250);
  await p.click('#sheet .t2'); await p.waitForTimeout(100);
  const sigue = await p.evaluate(() => $('modal').classList.contains('show'));
  await p.mouse.click(200, 10); await p.waitForTimeout(150);
  ok('Tocar dentro de la hoja no la cierra; el fondo sí', sigue && await p.evaluate(() => !$('modal').classList.contains('show')));
  await p.evaluate(() => { cerrarModal(); BV = null; BV_POSPUESTA = false; abrirBienvenida(); }); await p.waitForTimeout(150);
  await p.fill('#bvPeso', '81');
  const dia = await p.evaluate(() => BV.dias.includes(6));
  await p.locator('.bv .dias button').nth(5).click(); await p.waitForTimeout(150);
  ok('Bienvenida: escribir el peso y elegir días', await p.evaluate(d => BV.peso === '81' && BV.dias.includes(6) === !d, dia));
  await p.evaluate(() => cerrarModal());
  // Un data-click metido en la página (no lo pidió la app) no hace nada
  const inyectado = await p.evaluate(() => {
    window.__corrio = false; window.trampa = () => { window.__corrio = true; };
    const x = document.createElement('button'); x.setAttribute('data-click', 'trampa'); document.body.appendChild(x); x.click(); x.remove();
    return window.__corrio;
  });
  ok('Un data-click que la app no pidió no corre', inyectado === false);
  // Plantilla que escapa sola
  const pl = await p.evaluate(() => {
    const malo = '<img src=x onerror="window.__x=1">';
    return {
      escapa: String(html`<b>${malo}</b>`) === '<b>' + esc(malo) + '</b>',
      crudo: String(html`<i>${crudo('<b>ok</b>')}</i>`) === '<i><b>ok</b></i>',
      arreglo: String(html`<p>${['a<', html`<b>c</b>`]}</p>`) === '<p>a&lt;<b>c</b></p>',
      boton: /data-click="abrir" data-click-a="\[&quot;Push: x&quot;\]"/.test(String(html`<button ${on('abrir', 'Push: x')}>`)),
      vacio: String(html`<p>${null}${undefined}${false}</p>`) === '<p></p>'
    };
  });
  ok('Plantilla html``: escapa lo de afuera, deja pasar lo de la app', Object.values(pl).every(Boolean), pl);
  // Lo que diga la IA de una máquina se muestra como texto, nunca como HTML
  const maq = await p.evaluate(() => {
    window.__x = 0;
    MAQ = { maquina: '<img src=x onerror="window.__x=1">', ejercicio: '<b>Hack</b>', grupo: 'Legs', musculo: 'Cuádriceps', anotar: 'Por lado', series: 3, min: 8, max: 12,
            como: '"><script>window.__x=2</script>', confianza: 'alta', otros: [], foto: 'javascript:alert(1)', chica: '' };
    abrirModal(); pintarMaquina();
    const h = $('sheet').innerHTML;
    return { img: !$('sheet').querySelector('img[onerror], script, b b'), texto: $('sheet').textContent.includes('<b>Hack</b>'), src: !/javascript:/.test(h) };
  });
  await p.waitForTimeout(150);
  ok('Foto de máquina: el texto de la IA no se vuelve HTML ni código', maq.img && maq.texto && maq.src && await p.evaluate(() => window.__x === 0), maq);
  await p.evaluate(() => cerrarModal());
  // CSP (navegador): un onclick metido a la fuerza no corre
  const enLinea = await p.evaluate(() => {
    window.__enLinea = false;
    const d = document.createElement('div'); d.innerHTML = '<button id="malo" onclick="window.__enLinea=true">x</button>'; document.body.appendChild(d);
    document.getElementById('malo').click(); d.remove();
    return { corrio: window.__enLinea, csp: !!document.querySelector('meta[http-equiv="Content-Security-Policy"]') };
  });
  ok('Con la política de seguridad, un onclick inyectado no corre', enLinea.csp && enLinea.corrio === false, enLinea);
  const bloqueos = await p.evaluate(() => window.__csp.filter(x => !/^script-src-attr/.test(x)));
  ok('La política no bloqueó nada de la app (datos, fuentes, imágenes)', !bloqueos.length, bloqueos);
  ok('Sin acciones desconocidas en el registro', await p.evaluate(() => !LS.get('gym_jserr', []).some(e => /Acción desconocida|Argumentos inválidos/.test(e.msg) && !/trampa/.test(e.msg))));
  } catch (e) { ok('La prueba de botones terminó', false, e.message.split('\n')[0]); }
  ok('Sin errores de página', !errs.length, errs);
  await b.close();
  console.log(res.join('\n'));
})();
