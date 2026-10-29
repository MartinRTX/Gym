// Pruebas de pantalla: abren la app en Chromium (como un Pixel de 412 px) con la hoja simulada y revisan lo que ve el usuario.
//   node tests/e2e/correr.js            todas
//   node tests/e2e/correr.js comida     solo las que tengan "comida" en el nombre
// Cada archivo *.prueba.js imprime una línea por caso: "✓ …" pasó, "✗ …" falló. Si alguna falla (o el archivo truena), sale con error.
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const arrancar = require('./servidor.js');

(async () => {
  const filtro = process.argv[2] || '';
  const pruebas = fs.readdirSync(__dirname).filter(f => f.endsWith('.prueba.js') && f.includes(filtro)).sort();
  const srv = await arrancar(0);
  let pasaron = 0, fallaron = 0;
  const t0 = Date.now();
  for (const f of pruebas) {
    const salida = await new Promise(ok => {
      let txt = '';
      const h = spawn(process.execPath, [path.join(__dirname, f)], { env: Object.assign({}, process.env, { E2E_URL: srv.url }) });
      h.stdout.on('data', d => { txt += d; }); h.stderr.on('data', d => { txt += d; });
      const limite = setTimeout(() => { txt += '\n✗ tardó más de 4 minutos'; h.kill(); }, 240000);
      h.on('close', codigo => { clearTimeout(limite); ok({ txt: txt, codigo: codigo }); });
    });
    const lineas = salida.txt.split('\n');
    const bien = lineas.filter(l => l.startsWith('✓')).length, mal = lineas.filter(l => l.startsWith('✗'));
    const trono = salida.codigo !== 0 || (!bien && !mal.length);
    pasaron += bien; fallaron += mal.length + (trono ? 1 : 0);
    console.log((mal.length || trono ? '✗ ' : '✓ ') + f + ': ' + bien + ' pasaron' + (mal.length ? ', ' + mal.length + ' fallaron' : ''));
    mal.forEach(l => console.log('    ' + l));
    if (trono) console.log('    El archivo terminó con error:\n' + salida.txt.split('\n').filter(l => !/^[✓✗]/.test(l)).slice(-15).map(l => '    ' + l).join('\n'));
  }
  srv.cerrar();
  console.log('\n' + pasaron + ' casos pasaron, ' + fallaron + ' fallaron · ' + Math.round((Date.now() - t0) / 1000) + ' s');
  process.exit(fallaron ? 1 : 0);
})();
