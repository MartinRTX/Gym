// Antes y después de un cambio de pantallas: corre las MISMAS pruebas de pantalla (tests/e2e) contra la versión
// anterior (sacada de git) y contra la de tu carpeta, registra cada HTML que la app pinta (innerHTML e
// insertAdjacentHTML) y enseña lo que cambió. Sirve para cambios que no deben verse distintos (pasar a la plantilla,
// reordenar código): si dice "idéntico", nada de lo que recorren las pruebas cambió.
//
//   NODE_PATH=/opt/node-tools/node_modules node herramientas/comparar-pantallas.js [ref] [filtro]
//     ref     versión de antes (por defecto HEAD: lo último que guardaste en git; ej. main, v10.1, un commit)
//     filtro  solo las pruebas con ese texto en el nombre (ej. comida)
//
// Ruido conocido (sale aunque no cambies nada): la barra del descanso (se mueve por milisegundos) ya se ignora;
// a veces el anillo de proteína pinta una vez de más o de menos en comida-v97 (es una carrera de tiempos).
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const { spawn, execSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const REF = process.argv[2] || 'HEAD', FILTRO = process.argv[3] || '';
const PRUEBAS = path.join(RAIZ, 'tests', 'e2e');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
// Se carga antes que la app: avisa al servidor cada vez que algo se pinta
const GANCHO = `(function () {
  const env = (que, v) => { try { const x = new XMLHttpRequest(); x.open('POST', '/__pinta', false); x.send(JSON.stringify([que, String(v)])); } catch (e) {} };
  const d = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  Object.defineProperty(Element.prototype, 'innerHTML', { configurable: true, get() { return d.get.call(this); },
    set(v) { if (v !== '') env(this.id || this.className || this.tagName, v); d.set.call(this, v); } });
  const a = Element.prototype.insertAdjacentHTML;
  Element.prototype.insertAdjacentHTML = function (p, v) { env('adj:' + (this.id || this.className), v); return a.call(this, p, v); };
})();`;

// Un servidor por versión: sirve sus archivos, mete el gancho en index.html y junta lo pintado por archivo de prueba
function servidor(raiz) {
  const s = { log: {}, actual: '' };
  return new Promise(ok => {
    s.http = http.createServer((req, res) => {
      if (req.url === '/__pinta' && req.method === 'POST') {
        let b = ''; req.on('data', d => { b += d; });
        req.on('end', () => { (s.log[s.actual] = s.log[s.actual] || []).push(b); res.end('ok'); }); return;
      }
      const ruta = decodeURIComponent(req.url.split('?')[0]);
      if (ruta === '/__gancho.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(GANCHO); }
      let p = path.join(raiz, ruta);
      if (!p.startsWith(raiz) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(raiz, 'index.html');
      res.setHeader('Content-Type', TIPOS[path.extname(p)] || 'application/octet-stream'); res.setHeader('Cache-Control', 'no-store');
      if (p.endsWith('index.html')) return res.end(fs.readFileSync(p, 'utf8').replace('<script src=', '<script src="__gancho.js"></script><script src='));
      fs.createReadStream(p).pipe(res);
    }).listen(0, () => { s.url = 'http://localhost:' + s.http.address().port + '/'; ok(s); });
  });
}
function correr(archivo, url) {
  return new Promise(ok => {
    let t = '';
    const h = spawn(process.execPath, [path.join(PRUEBAS, archivo)], { env: Object.assign({}, process.env, { E2E_URL: url }) });
    h.stdout.on('data', d => { t += d; }); h.stderr.on('data', d => { t += d; });
    const limite = setTimeout(() => h.kill(), 240000);
    h.on('close', () => { clearTimeout(limite); ok(t.split('\n').filter(l => l.startsWith('✗'))); });
  });
}
// Lo que cambia solo con la hora o al azar: ids de registro, horas, segundos, timestamps, la versión y la barra del descanso
const norm = s => s
  .replace(/\b(?=[0-9a-z]*\d)(?=[0-9a-z]*[a-z])[0-9a-z]{12,14}\b/g, 'ID')
  .replace(/\b1[789]\d{11}\b/g, 'TS')
  .replace(/\d{1,2}:\d\d( ?[ap]m)?/g, 'HH:MM')
  .replace(/\d+ s\b/g, 'N s').replace(/\d+ min\b/g, 'N min').replace(/hace [^<"]*/g, 'hace X')
  .replace(/Gym v[\d.]+|App v[\d.]+|gym-v[\d.]+/g, 'VER')
  .replace(/(class=\\"rbar\\"><div style=\\"width:)[\d.]+%/g, '$1X%');

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-antes-'));
  try {
    execSync('git archive ' + JSON.stringify(REF) + ' | tar -x -C ' + JSON.stringify(tmp), { cwd: RAIZ, stdio: ['ignore', 'ignore', 'inherit'], shell: '/bin/bash' });
  } catch (e) { console.error('No pude sacar «' + REF + '» de git'); process.exit(2); }
  const [antes, ahora] = await Promise.all([servidor(tmp), servidor(RAIZ)]);
  const lista = fs.readdirSync(PRUEBAS).filter(f => f.endsWith('.prueba.js') && f.includes(FILTRO)).sort();
  console.log('Comparando ' + REF + ' (antes) contra tu carpeta (ahora) con ' + lista.length + ' archivos de prueba…');
  for (const f of lista) {
    antes.actual = ahora.actual = f;
    const [ma, mb] = await Promise.all([correr(f, antes.url), correr(f, ahora.url)]);
    if (mb.length) console.log('  (ahora) ' + f + ': ' + mb.join(' | ').slice(0, 300));
    if (ma.length && !mb.length) console.log('  (solo antes fallaba) ' + f + ': ' + ma.join(' | ').slice(0, 200));
  }
  antes.http.close(); ahora.http.close();
  fs.rmSync(tmp, { recursive: true, force: true });

  let iguales = 0, total = 0, archivosDistintos = 0;
  for (const f of lista) {
    const a = (antes.log[f] || []).map(norm), b = (ahora.log[f] || []).map(norm);
    const cuenta = {}; a.forEach(x => { cuenta[x] = (cuenta[x] || 0) + 1; });
    const soloB = []; b.forEach(x => { if (cuenta[x]) cuenta[x]--; else soloB.push(x); });
    const soloA = []; Object.keys(cuenta).forEach(x => { for (let i = 0; i < cuenta[x]; i++) soloA.push(x); });
    const n = Math.max(a.length, b.length); total += n; iguales += n - Math.max(soloA.length, soloB.length);
    if (!soloA.length && !soloB.length) continue;
    archivosDistintos++;
    console.log('\n≠ ' + f + ': ' + soloA.length + ' pintadas solo antes, ' + soloB.length + ' solo ahora');
    // Cada una de antes junto a la de ahora que más se le parece, enseñando dónde empiezan a diferir
    soloA.slice(0, 4).forEach(x => {
      let mejor = '', mp = -1;
      soloB.forEach(y => { let i = 0; while (i < x.length && x[i] === y[i]) i++; if (i > mp) { mp = i; mejor = y; } });
      let j = 0; while (j < x.length - mp && j < mejor.length - mp && x[x.length - 1 - j] === mejor[mejor.length - 1 - j]) j++;
      console.log('   antes: …' + x.slice(Math.max(0, mp - 60), x.length - j + 30).slice(0, 300));
      console.log('   ahora: …' + mejor.slice(Math.max(0, mp - 60), mejor.length - j + 30).slice(0, 300));
    });
    if (!soloA.length) soloB.slice(0, 2).forEach(y => console.log('   solo ahora: ' + y.slice(0, 200)));
  }
  console.log('\n' + (archivosDistintos ? iguales + ' de ' + total + ' pintadas iguales; revisa las diferencias de arriba'
    : 'Idéntico: ' + total + ' pintadas iguales en ' + lista.length + ' archivos de prueba'));
  process.exit(archivosDistintos ? 1 : 0);
})();
