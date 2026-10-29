// Política de seguridad (CSP): el navegador solo corre los archivos de la app; nada de JS dentro del HTML.
// Va primero en index.html. Solo en el navegador: en el APK, Capacitor mete su puente con el teléfono como script en
// línea y esta política lo bloquearía (sin él no hay Health Connect, avisos ni widgets).
(function () {
  var nativo = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) || /; wv\)/.test(navigator.userAgent);
  if (nativo) return;
  var m = document.createElement('meta');
  m.httpEquiv = 'Content-Security-Policy';
  m.content = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",                       // estilos de las tarjetas y barras (no corren código)
    "img-src 'self' data: blob: https:",                        // tus fotos, miniaturas de YouTube y GIF de técnica
    "media-src 'self' blob: https:",
    "font-src 'self'",
    "connect-src 'self' https://script.google.com https://script.googleusercontent.com https://world.openfoodfacts.org https://api.open-meteo.com",
    "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'"
  ].join('; ');
  document.head.appendChild(m);
})();
