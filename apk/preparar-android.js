// Ajustes al proyecto Android que crea `npx cap add android` (el workflow lo corre en cada compilación).
// 1. minSdk 26: Health Connect no existe antes de Android 8.
// 2. Health Connect SOLO LECTURA de pasos, distancia, sueño y ejercicio: el plugin declara muchos permisos más
//    (incluidos los de escritura); aquí se quitan del APK final con tools:node="remove".
const fs = require('fs');

const VARS = 'android/variables.gradle';
let v = fs.readFileSync(VARS, 'utf8');
v = v.replace(/minSdkVersion = \d+/, 'minSdkVersion = 26');
fs.writeFileSync(VARS, v);

const MANIFEST = 'android/app/src/main/AndroidManifest.xml';
const PLUGIN = 'node_modules/@capgo/capacitor-health/android/src/main/AndroidManifest.xml';
const SE_QUEDAN = ['READ_STEPS', 'READ_DISTANCE', 'READ_SLEEP', 'READ_EXERCISE'].map(p => 'android.permission.health.' + p);

let m = fs.readFileSync(MANIFEST, 'utf8');
if (!m.includes('xmlns:tools=')) m = m.replace('<manifest ', '<manifest xmlns:tools="http://schemas.android.com/tools" ');
const delPlugin = [...fs.readFileSync(PLUGIN, 'utf8').matchAll(/android:name="(android\.permission\.health\.[A-Z_]+)"/g)].map(x => x[1]);
const quitar = [...new Set(delPlugin.concat(['WRITE_EXERCISE', 'READ_HEALTH_DATA_HISTORY', 'READ_HEALTH_DATA_IN_BACKGROUND'].map(p => 'android.permission.health.' + p)))]
  .filter(p => !SE_QUEDAN.includes(p));
const lineas = quitar.map(p => `    <uses-permission android:name="${p}" tools:node="remove" />`).join('\n');
if (!m.includes('tools:node="remove"')) m = m.replace('</manifest>', `\n    <!-- Health Connect: solo lectura de pasos, distancia, sueño y ejercicio -->\n${lineas}\n</manifest>`);
fs.writeFileSync(MANIFEST, m);
console.log('minSdk 26 · permisos de Health Connect que se quitan:', quitar.length, '· se quedan:', SE_QUEDAN.join(', '));
