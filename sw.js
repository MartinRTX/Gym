// Guarda la app en el celular para que abra rápido y funcione sin señal.
// Cuando subas una versión nueva de la app, cambia el número de VERSION.
const VERSION = 'gym-v10.5';
// Miniaturas de YouTube, GIF e imágenes de técnica: caché aparte que NO se borra al cambiar de versión
const MEDIA = 'gym-media';
const MEDIA_MAX = 150;
// Catálogo de alimentos (~730 KB): se baja la primera vez que buscas y se queda aunque cambie la versión de la app
// (la app lo pide con ?v=N: si el catálogo cambia, sube N y se baja el nuevo)
const DATOS = 'gym-datos';
const ARCHIVOS = [
  './', './index.html', './seguridad.js', './motor.js', './nutricion.js', './comida.js', './animaciones.js', './app.js', './entrenar.js', './series.js', './sesion.js', './trote.js', './comida-dia.js', './coach.js', './progreso.js', './ajustes.js', './inicio.js', './app.css', './manifest.webmanifest', './fonts/archivo.woff2',
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
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== MEDIA && k !== DATOS).map(k => caches.delete(k))))
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
// Se pide con CORS cuando el sitio lo permite: una respuesta "opaca" (sin CORS) Chrome la cuenta como ~7 MB de espacio
// aunque pese 30 KB, y con muchas el celular borra antes lo guardado de la app. Si el sitio no da CORS, va opaca como antes.
function bajarMedia(url) {
  return fetch(url, { mode: 'cors', credentials: 'omit' }).then(r => r.ok ? r : Promise.reject(r))
    .catch(() => fetch(url, { mode: 'no-cors', credentials: 'omit' }));
}
// Primero lo guardado (funciona sin señal); si no está, lo baja y lo guarda
function deMedia(req) {
  return caches.open(MEDIA).then(cache => cache.match(req.url).then(hit => hit || bajarMedia(req.url).then(resp => {
    if (resp && (resp.ok || resp.type === 'opaque')) guardarMedia(cache, req.url, resp.clone());
    return resp;
  })));
}

// Archivos de la app: SIEMPRE los de la versión instalada, todos juntos (todo o nada).
// Antes se actualizaban uno por uno en segundo plano y, justo después de publicar, podían mezclarse archivos
// de dos versiones. Ahora una versión nueva llega completa cuando cambia este archivo (VERSION): el navegador
// la baja entera en 'install' (si falla un archivo, no se instala nada) y la app se recarga una vez al activarse.
// Lo que no está en la lista se pide a la red. Las llamadas a Google (tus datos) nunca se guardan aquí.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) {
    if (esMedia(url)) e.respondWith(deMedia(e.request));
    return;
  }
  if (/\/datos\/alimentos\.json$/.test(url.pathname)) {
    e.respondWith(caches.open(DATOS).then(cache => cache.match(e.request).then(hit => hit || fetch(e.request).then(resp => {
      if (resp && resp.ok) { const copia = resp.clone(); cache.keys().then(ks => Promise.all(ks.map(k => cache.delete(k)))).then(() => cache.put(e.request, copia)); }
      return resp;
    }))));
    return;
  }
  e.respondWith(caches.open(VERSION).then(cache => cache.match(e.request, { ignoreSearch: true }).then(guardado => guardado || fetch(e.request))));
});

// La app manda la lista de miniaturas y GIF del catálogo: se bajan con señal para tenerlos en el gym
self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.tipo !== 'precache' || !Array.isArray(d.urls)) return;
  e.waitUntil(caches.open(MEDIA).then(cache => Promise.all(d.urls.slice(0, MEDIA_MAX).map(u =>
    cache.match(u).then(hit => hit || bajarMedia(u).then(resp => guardarMedia(cache, u, resp)).catch(() => null))
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
