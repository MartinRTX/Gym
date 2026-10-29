// Servidor de archivos de la app para las pruebas (sin caché): node tests/e2e/servidor.js [puerto]
const http = require('http'), fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..', '..');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
function arrancar(puerto) {
  return new Promise(ok => {
    const s = http.createServer((req, res) => {
      let p = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(RAIZ) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(RAIZ, 'index.html');
      res.setHeader('Content-Type', TIPOS[path.extname(p)] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store');
      fs.createReadStream(p).pipe(res);
    }).listen(puerto || 0, () => ok({ url: 'http://localhost:' + s.address().port + '/', cerrar: () => s.close() }));
  });
}
module.exports = arrancar;
if (require.main === module) arrancar(Number(process.argv[2]) || 8770).then(s => console.log('Sirviendo en ' + s.url));
