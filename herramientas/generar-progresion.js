// Genera script/Progresion.gs a partir de motor.js: el script de la hoja usa exactamente el mismo cálculo que la app.
//   node herramientas/generar-progresion.js            → escribe script/Progresion.gs
//   node herramientas/generar-progresion.js --revisar  → falla si script/Progresion.gs no está al día (lo corre GitHub)
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const DESTINO = path.join(RAIZ, 'script', 'Progresion.gs');

function generar() {
  const motor = fs.readFileSync(path.join(RAIZ, 'motor.js'), 'utf8');
  const m = /\n  \/\/ <progresion>[^\n]*\n([\s\S]*?)\n  \/\/ <\/progresion>/.exec(motor);
  if (!m) throw new Error('No encontré el bloque // <progresion> … // </progresion> en motor.js');
  const funcion = m[1].split('\n').map(l => l.startsWith('  ') ? l.slice(2) : l).join('\n')
    .replace('function progresionInicio(p) {', 'function progresionInicio_(p) {');
  if (!funcion.includes('function progresionInicio_(p) {')) throw new Error('El bloque no trae function progresionInicio(p)');
  return [
    '/**',
    ' * Gym – Progresion.gs: la sugerencia al EMPEZAR cada ejercicio (subir, bajar o mantener, siempre con números).',
    ' *',
    ' * ARCHIVO GENERADO desde motor.js de la app (node herramientas/generar-progresion.js). No lo edites aquí:',
    ' * así la app y la hoja usan el mismo motor. Va en tu proyecto de Apps Script como archivo aparte, junto a AppGym.gs.',
    ' * La app compara firmaMotor_() con la suya; si no coinciden, te avisa y usa su propio cálculo.',
    ' */',
    funcion,
    '',
    '// Huella del motor (la misma cuenta que MOTOR.firmaProgresion en motor.js)',
    'function firmaMotor_() {',
    "  const t = progresionInicio_.toString().replace(/progresionInicio_?\\(/g, 'progresionInicio(').replace(/\\s+/g, '');",
    '  let h = 5381;',
    '  for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;',
    '  return h.toString(36);',
    '}',
    ''
  ].join('\n');
}

if (require.main === module) {
  const nuevo = generar();
  if (process.argv.includes('--revisar')) {
    const actual = fs.existsSync(DESTINO) ? fs.readFileSync(DESTINO, 'utf8') : '';
    if (actual !== nuevo) {
      console.error('script/Progresion.gs no está al día con motor.js: corre node herramientas/generar-progresion.js y súbelo.');
      process.exit(1);
    }
    console.log('script/Progresion.gs al día con motor.js');
  } else {
    fs.writeFileSync(DESTINO, nuevo);
    console.log('Escribí', path.relative(RAIZ, DESTINO));
  }
}
module.exports = { generar, DESTINO };
