// Pruebas del service worker (sin navegador): node --test tests/*.test.js
// v10.4: las miniaturas y GIF se piden con CORS primero; solo si el sitio no lo permite van "opacas" (Chrome cuenta cada
// respuesta opaca como ~7 MB de espacio y con muchas el celular borra antes lo guardado de la app).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// sw.js en un contexto falso: guarda los manejadores y lo que se le pide a la red
function cargarSW(red) {
  const pedidos = [];
  const ctx = {
    self: { addEventListener() {}, location: { origin: 'https://martinrtx.github.io' } },
    fetch: (url, o) => { pedidos.push({ url: String(url), modo: o && o.mode }); return red(o && o.mode); },
    caches: { open: () => Promise.resolve({ match: () => Promise.resolve(null), put: () => Promise.resolve(), keys: () => Promise.resolve([]), delete: () => Promise.resolve() }) },
    URL, Request: function () {}, Promise
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8'), ctx);
  return { ctx, pedidos };
}

test('Miniatura de un sitio con CORS: un solo pedido, normal (no opaco)', async () => {
  const { ctx, pedidos } = cargarSW(() => Promise.resolve({ ok: true, type: 'cors' }));
  const r = await ctx.bajarMedia('https://i.ytimg.com/vi/abc/hqdefault.jpg');
  assert.strictEqual(r.type, 'cors');
  assert.deepStrictEqual(pedidos.map(p => p.modo), ['cors']);
});

test('Sitio sin CORS: se reintenta como antes (opaco) y la imagen igual se guarda', async () => {
  const { ctx, pedidos } = cargarSW(modo => modo === 'cors' ? Promise.reject(new TypeError('CORS')) : Promise.resolve({ ok: false, type: 'opaque' }));
  const r = await ctx.bajarMedia('https://ejemplo.com/tecnica.gif');
  assert.strictEqual(r.type, 'opaque');
  assert.deepStrictEqual(pedidos.map(p => p.modo), ['cors', 'no-cors']);
});

test('Respuesta con error (404) en CORS: también se intenta opaca', async () => {
  const { ctx, pedidos } = cargarSW(modo => Promise.resolve(modo === 'cors' ? { ok: false, status: 404, type: 'cors' } : { ok: false, type: 'opaque' }));
  await ctx.bajarMedia('https://ejemplo.com/x.png');
  assert.deepStrictEqual(pedidos.map(p => p.modo), ['cors', 'no-cors']);
});
