// Mapa de la app: qué declara cada archivo (a nivel raíz), cuánto corre al cargar y qué usa de los demás.
// Sirve para decidir dónde va algo nuevo y qué tan amarrado está un archivo antes de moverlo.
//   NODE_PATH=/opt/node-tools/node_modules node herramientas/mapa.js            (necesita acorn y acorn-walk)
//   NODE_PATH=/opt/node-tools/node_modules node herramientas/mapa.js cortes comida.js 501 675
//      → ¿se puede partir comida.js en esas líneas? (lo que corre al cargar no puede usar funciones de un pedazo posterior)
const acorn = require('acorn'), walk = require('acorn-walk');
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..');
const leer = f => acorn.parse(fs.readFileSync(path.join(RAIZ, f), 'utf8'), { ecmaVersion: 2022, sourceType: 'script', locations: true });

if (process.argv[2] === 'cortes') {
  const [archivo, ...cortes] = process.argv.slice(3), ast = leer(archivo);
  const pedazo = l => cortes.filter(c => l >= Number(c)).length, funcs = {};
  ast.body.forEach(n => { if (n.type === 'FunctionDeclaration') funcs[n.id.name] = pedazo(n.loc.start.line); });
  let malos = 0;
  ast.body.forEach(n => {
    if (n.type === 'FunctionDeclaration') return;
    const p = pedazo(n.loc.start.line);
    walk.recursive(n, null, { Function() {}, ArrowFunctionExpression() {}, FunctionExpression() {},
      Identifier(id) { if (funcs[id.name] !== undefined && funcs[id.name] > p) { malos++; console.log('✗ línea', id.loc.start.line, 'usa al cargar', id.name, '(pedazo', funcs[id.name], ')'); } } });
  });
  console.log(malos ? malos + ' problemas' : '✓ se puede partir ahí');
  process.exit(malos ? 1 : 0);
}

const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const archivos = [...html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map(m => m[1]);
const decl = {}, duenio = {}, asts = {};
archivos.forEach(f => {
  asts[f] = leer(f); decl[f] = [];
  asts[f].body.forEach(n => {
    if (n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') decl[f].push(n.id.name);
    else if (n.type === 'VariableDeclaration') n.declarations.forEach(d => { if (d.id.type === 'Identifier') decl[f].push(d.id.name); });
  });
  decl[f].forEach(n => { duenio[n] = f; });
});
console.log('archivo'.padEnd(17), 'líneas', 'nombres', 'al cargar', ' usa de otros (veces)');
archivos.forEach(f => {
  const usa = {};
  walk.full(asts[f], n => { if (n.type === 'Identifier' && duenio[n.name] && duenio[n.name] !== f) usa[duenio[n.name]] = (usa[duenio[n.name]] || 0) + 1; });
  const lineas = fs.readFileSync(path.join(RAIZ, f), 'utf8').split('\n').length;
  console.log(f.padEnd(17), String(lineas).padStart(6), String(decl[f].length).padStart(7), String(asts[f].body.filter(n => n.type !== 'FunctionDeclaration').length).padStart(9), ' ',
    Object.entries(usa).sort((a, b) => b[1] - a[1]).map(([k, v]) => k.replace('.js', '') + ':' + v).join(' '));
});
console.log('\nnombres globales en total:', archivos.reduce((a, f) => a + decl[f].length, 0));
