// Revisión rápida que corre GitHub en cada push (y la puedes correr tú: node herramientas/revisar.js):
//  1. Sintaxis de cada archivo de la app.
//  2. Los scripts de index.html juntos, en el orden en que los carga el navegador: así se detecta una variable
//     declarada dos veces (const/let repetido), que en el celular deja la app en blanco; y funciones repetidas entre archivos.
//  3. script/Progresion.gs al día con motor.js.
//  4. La versión de la app (VERSION_APP en app.js) y la del service worker (VERSION en sw.js) son la misma:
//     si no, los celulares no bajan la versión nueva (o la bajan a medias).
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

if (errores) process.exit(1);
