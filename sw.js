// Guarda la app en el celular para que abra rápido y funcione sin señal.
// Cuando subas una versión nueva de la app, cambia el número de VERSION.
const VERSION = 'gym-v6.1';
// Miniaturas de YouTube, GIF e imágenes de técnica: caché aparte que NO se borra al cambiar de versión
const MEDIA = 'gym-media';
const MEDIA_MAX = 150;
const ARCHIVOS = [
  './', './index.html', './app.js', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  // cache: 'reload' obliga a bajar los archivos nuevos, no los que el navegador tenga guardados
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(ARCHIVOS.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== MEDIA).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ¿Es una imagen de técnica? (miniatura de YouTube o archivo de imagen de otro sitio)
function esMedia(url) {
  return /(^|\.)ytimg\.com$/.test(url.hostname) || url.hostname === 'img.youtube.com' ||
         /\.(gif|png|jpe?g|webp)$/i.test(url.pathname);
}
// Guarda en la caché de medios y borra las más viejas si pasa del límite
function guardarMedia(cache, clave, resp) {
  return cache.put(clave, resp).then(() => cache.keys()).then(keys => {
    const sobran = keys.length - MEDIA_MAX;
    return sobran > 0 ? Promise.all(keys.slice(0, sobran).map(k => cache.delete(k))) : null;
  }).catch(() => null);
}
// Primero lo guardado (funciona sin señal); si no está, lo baja y lo guarda
function deMedia(req) {
  return caches.open(MEDIA).then(cache => cache.match(req.url).then(hit => hit || fetch(req).then(resp => {
    if (resp && (resp.ok || resp.type === 'opaque')) guardarMedia(cache, req.url, resp.clone());
    return resp;
  })));
}

// Archivos de la app: responde con lo guardado y actualiza en segundo plano.
// Las llamadas a Google (tus datos) nunca se guardan aquí.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) {
    if (esMedia(url)) e.respondWith(deMedia(e.request));
    return;
  }
  e.respondWith(
    caches.open(VERSION).then(cache =>
      cache.match(e.request, { ignoreSearch: true }).then(guardado => {
        const red = fetch(e.request).then(resp => {
          if (resp && resp.ok) cache.put(e.request, resp.clone());
          return resp;
        }).catch(() => guardado);
        return guardado || red;
      })
    )
  );
});

// La app manda la lista de miniaturas y GIF del catálogo: se bajan con señal para tenerlos en el gym
self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.tipo !== 'precache' || !Array.isArray(d.urls)) return;
  e.waitUntil(caches.open(MEDIA).then(cache => Promise.all(d.urls.slice(0, MEDIA_MAX).map(u =>
    cache.match(u).then(hit => hit || fetch(u, { mode: 'no-cors' }).then(resp => guardarMedia(cache, u, resp)).catch(() => null))
  ))));
});

// Al tocar el aviso del reloj/celular, abre la app (o la trae al frente).
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('./');
  }));
});
