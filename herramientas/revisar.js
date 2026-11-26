// Revisión rápida que corre GitHub en cada push (y la puedes correr tú: node herramientas/revisar.js):
//  1. Sintaxis de cada archivo de la app.
//  2. Los scripts de index.html juntos, en el orden en que los carga el navegador: así se detecta una variable
//     declarada dos veces (const/let repetido), que en el celular deja la app en blanco; y funciones repetidas entre archivos.
//  3. script/Progresion.gs al día con motor.js.
//  5. Ningún on*="…" en el HTML: los botones usan on('accion', …) (data-click) y la política de seguridad bloquea el JS en línea.
//  4. La versión de la app (VERSION_APP en app.js) y la del service worker (VERSION en sw.js) son la misma:
//     si no, los celulares no bajan la versión nueva (o la bajan a medias).
//  6. Todo lo que carga index.html está en la lista del service worker.
//  7. Solo el bloque LS de app.js toca localStorage, y cada clave que se usa ('gym_…') está anotada en ALMACEN (app.js).
//  8. Todo el HTML sale de la plantilla html`…` (v10.2): nada de innerHTML = '<…' a mano, esc() solo donde se permite y
//     ningún texto con comillas o < dentro de ${…} (se escaparía y saldría &quot; o "<div" en pantalla).
//  9. tsconfig.json revisa exactamente los archivos que carga index.html (la revisión de tipos corre aparte, en GitHub:
//     npx -y -p typescript@6.0.2 tsc -p tsconfig.json; atrapa nombres mal escritos entre archivos y llamadas con
//     argumentos de más).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');
let errores = 0;
const compilar = (codigo, nombre) => {
  try { new vm.Script(codigo, { filename: nombre }); console.log('✓', nombre); }
  catch (e) { errores++; console.error('✗', nombre + ':', e.message); }
};

const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map(m => m[1].replace(/^\.\//, '').split('?')[0]).filter(f => !/^https?:/.test(f));
const archivos = [...new Set(scripts.concat(['sw.js', 'script/Progresion.gs']))];
archivos.forEach(f => compilar(fs.readFileSync(path.join(RAIZ, f), 'utf8'), f));
compilar(scripts.map(f => fs.readFileSync(path.join(RAIZ, f), 'utf8')).join('\n;\n'), scripts.join(' + ') + ' (juntos, como en index.html)');

// 2b. Una función con el mismo nombre en dos archivos no da error: gana la del último y la otra deja de funcionar sin avisar
const vistas = {};
scripts.forEach(f => {
  for (const m of fs.readFileSync(path.join(RAIZ, f), 'utf8').matchAll(/^(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/gm)) {
    if (vistas[m[1]] && vistas[m[1]] !== f) { errores++; console.error('✗ función ' + m[1] + ' repetida en ' + vistas[m[1]] + ' y ' + f); }
    vistas[m[1]] = vistas[m[1]] || f;
  }
});
if (!errores) console.log('✓ sin funciones repetidas entre archivos');

const { generar, DESTINO } = require('./generar-progresion.js');
if (fs.readFileSync(DESTINO, 'utf8') !== generar()) { errores++; console.error('✗ script/Progresion.gs no está al día: corre node herramientas/generar-progresion.js'); }
else console.log('✓ script/Progresion.gs al día con motor.js');

const vApp = (fs.readFileSync(path.join(RAIZ, 'app.js'), 'utf8').match(/const VERSION_APP = 'v([\d.]+)'/) || [])[1];
const vSw = (fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8').match(/const VERSION = 'gym-v([\d.]+)'/) || [])[1];
if (!vApp || vApp !== vSw) { errores++; console.error('✗ versiones distintas: app.js v' + vApp + ' y sw.js gym-v' + vSw + ' (cambia las dos)'); }
else console.log('✓ app.js y sw.js en la misma versión (v' + vApp + ')');

// 6. Todo lo que carga index.html (scripts y app.css) va en la lista del service worker: si falta uno, sin señal la app
//    queda a medias (y con el todo-o-nada se pediría a la red cada vez)
const hojas = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m => m[1]).filter(f => !/^https?:/.test(f));
const enSw = (fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8').match(/const ARCHIVOS = \[([\s\S]*?)\];/) || [])[1] || '';
const faltan = scripts.concat(hojas).filter(f => !enSw.includes("'./" + f + "'"));
if (faltan.length) { errores++; console.error('✗ faltan en ARCHIVOS de sw.js: ' + faltan.join(', ')); }
else console.log('✓ sw.js guarda los ' + (scripts.length + hojas.length) + ' archivos que carga index.html');

// 7. Una sola capa de guardado: solo el bloque LS de app.js toca localStorage
const directo = scripts.filter(f => {
  let t = fs.readFileSync(path.join(RAIZ, f), 'utf8');
  if (f === 'app.js') t = t.replace(/const LS = \{[\s\S]*?\n\};/, '');
  return /\blocalStorage\s*[.\[)]/.test(t.replace(/\/\/.*$/gm, ''));
});
if (directo.length) { errores++; console.error('✗ localStorage directo en ' + directo.join(', ') + ': usa LS.get / LS.set / LS.del / LS.claves'); }
else console.log('✓ todo el guardado pasa por LS');

const conCodigo = scripts.concat(['index.html']).filter(f => /\son[a-z]+=\\?["']/.test(fs.readFileSync(path.join(RAIZ, f), 'utf8')));
if (conCodigo.length) { errores++; console.error('✗ código en el HTML (on…="…") en ' + conCodigo.join(', ') + ': usa on(\'accion\', …) o ev(\'input\', …)'); }
else console.log('✓ sin on…="…" en el HTML');

// 8. La plantilla: una vez que todo pasó a html`…`, que nadie regrese a armar HTML a mano
//    esc() se permite en app.js (la plantilla misma) y en coach.js (el formato del chat escapa primero y luego pone negritas)
const ESC_OK = ['app.js', 'coach.js'];
const plantilla = [];
scripts.forEach(f => {
  const lineas = fs.readFileSync(path.join(RAIZ, f), 'utf8').split('\n');
  lineas.forEach((l, i) => {
    const donde = f + ':' + (i + 1);
    if (/(innerHTML\s*=|insertAdjacentHTML\([^,]*,)\s*(['"])[^'"]*</.test(l)) plantilla.push(donde + ' arma HTML a mano (usa html`…`)');
    if (!ESC_OK.includes(f) && /\besc\(/.test(l)) plantilla.push(donde + ' usa esc(): con html`…` se escapa solo');
    if (/html`/.test(l) && /[?:] '[^']*["<>][^']*'/.test(l)) plantilla.push(donde + ' texto con comillas o < dentro de ${…}: se escapa (usa html`…`)');
  });
});
if (plantilla.length) { errores++; console.error('✗ plantilla html`…`:\n  ' + plantilla.slice(0, 10).join('\n  ')); }
else console.log('✓ todo el HTML sale de la plantilla html`…`');

// 7b. Cada clave del celular ('gym_…') está en ALMACEN (app.js) con lo que guarda; y nada del registro sobra
{
  const appTxt = fs.readFileSync(path.join(RAIZ, 'app.js'), 'utf8'), bloque = /const ALMACEN = \{([\s\S]*?)\n\};/.exec(appTxt);
  if (!bloque) { errores++; console.error('✗ No encontré const ALMACEN = { … } en app.js'); }
  else {
    const registradas = new Set([...bloque[1].matchAll(/\b(gym_[A-Za-z0-9_]*):/g)].map(m => m[1]));
    const usadas = new Map();
    scripts.forEach(f => {
      const txt = fs.readFileSync(path.join(RAIZ, f), 'utf8').replace(/const ALMACEN = \{[\s\S]*?\n\};/, '');
      for (const m of txt.matchAll(/['"`](gym_[A-Za-z0-9_]*)['"`]/g)) if (!usadas.has(m[1])) usadas.set(m[1], f);
    });
    const sinRegistro = [...usadas].filter(([k]) => !registradas.has(k)).map(([k, f]) => k + ' (' + f + ')');
    const sobran = [...registradas].filter(k => !usadas.has(k));
    if (sinRegistro.length) { errores++; console.error('✗ Claves del celular sin anotar en ALMACEN (app.js): ' + sinRegistro.join(', ')); }
    if (sobran.length) { errores++; console.error('✗ ALMACEN anota claves que ya nadie usa: ' + sobran.join(', ')); }
    if (!sinRegistro.length && !sobran.length) console.log('✓ las ' + registradas.size + ' claves del celular están anotadas en ALMACEN');
  }
}

// 9. La revisión de tipos ve los mismos archivos que el navegador: uno nuevo en index.html sin tsconfig quedaría sin revisar
try {
  const ts = JSON.parse(fs.readFileSync(path.join(RAIZ, 'tsconfig.json'), 'utf8')).files.filter(f => /\.js$/.test(f));
  if (JSON.stringify(ts) !== JSON.stringify(scripts)) { errores++; console.error('✗ tsconfig.json "files" no es la lista de index.html (mismo orden):\n  tsconfig: ' + ts.join(', ') + '\n  index:    ' + scripts.join(', ')); }
  else console.log('✓ tsconfig.json revisa los mismos ' + scripts.length + ' archivos que carga index.html');
} catch (e) { errores++; console.error('✗ tsconfig.json: ' + e.message); }

if (errores) process.exit(1);
