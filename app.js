/* Gym – app instalable (sirve para varias personas: cada quien con su clave y su propia hoja).
 * Lee y escribe la hoja de Google a través del script de Apps Script (la "API").
 * Todo lo que guardas se queda primero en el celular y se sube en cuanto hay señal.
 * Este archivo es el núcleo (utilidades, APK, configuración, cola y arranque). El resto va en un archivo por tema,
 * en este orden (index.html y sw.js): app.js, entrenar.js, series.js, sesion.js, trote.js, comida-dia.js, coach.js, progreso.js, ajustes.js, inicio.js. Los estilos van en app.css.
 */

/* ===================== Utilidades ===================== */
let SIN_ESPACIO = 0;   // cuándo falló por última vez guardar en el celular por falta de espacio
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) {
    const t = JSON.stringify(v);
    try { localStorage.setItem(k, t); return true; } catch (e) { /* sin espacio: abajo */ }
    try { limpiarDiasViejos(21); localStorage.setItem(k, t); return true; } catch (e) { SIN_ESPACIO = Date.now(); return false; }
  },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  claves() { try { return Object.keys(localStorage); } catch (e) { return []; } }
};
// Este bloque es el ÚNICO que toca localStorage (lo revisa herramientas/revisar.js): todo lo demás usa LS
// Lo de cada día (sesión, comida, peso, borradores…) lleva la fecha en la clave; lo de hace semanas ya está en tu hoja
function limpiarDiasViejos(dias) {
  const corte = sumarDias(hoy(), -dias);
  LS.claves().forEach(k => { const m = /^gym_.+_(\d{4}-\d{2}-\d{2})(_.*)?$/.exec(k); if (m && m[1] < corte) LS.del(k); });
}
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');
function claveDia(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function hoy() { return claveDia(new Date()); }
function sumarDias(k, n) { const d = new Date(k + 'T12:00:00'); d.setDate(d.getDate() + n); return claveDia(d); }
function difDias(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000); }
function ddmm(k) { return k.slice(8, 10) + '/' + k.slice(5, 7); }
// Días desde un dd/mm que manda el script (la fecha más cercana hacia atrás); null si no se entiende
function diasDesdeDM(dm) {
  const m = /^(\d{1,2})\/(\d{1,2})/.exec(dm || '');
  if (!m) return null;
  const h = new Date(hoy() + 'T12:00:00'), d = new Date(h.getFullYear(), m[2] - 1, Number(m[1]), 12);
  if (d > h) d.setFullYear(d.getFullYear() - 1);
  return Math.round((h - d) / 864e5);
}
const DSEM = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
function diaCorto(k) { return DSEM[new Date(k + 'T12:00:00').getDay()] + ' ' + ddmm(k); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
// Links que vienen de la hoja (videos, fotos): solo http(s); un "javascript:" no llega a un href ni a un src
const urlSegura = u => /^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '';
/* ----- Eventos sin código en el HTML -----
   Los botones llevan data-click="accion" y sus argumentos en JSON (escapado); un solo escuchador en el documento
   llama a la función. Así ningún texto de la hoja puede volverse código, y el navegador puede bloquear todo JS en línea.
   on('anadirHoy', nombre, 3)  →  data-click="anadirHoy" data-click-a="[&quot;…&quot;,3]"
   ev('input', 'buscar', VALOR) para otros eventos. Valores que se leen al momento del evento: */
const EL = { $: 'el' }, VALOR = { $: 'valor' }, MARCADO = { $: 'marcado' }, ABIERTO = { $: 'abierto' }, PADRE = { $: 'padre' }, EVENTO = { $: 'evento' };
const ARG_VIVO = { el: el => el, valor: el => el.value, marcado: el => el.checked, abierto: el => el.open, padre: el => el.parentNode, evento: (el, e) => e };
// Solo lo que la propia app pidió con on()/ev() (y los botones fijos de index.html): un data-click inyectado no hace nada
const ACCIONES_OK = new Set(['guardarConfig', 'abrirAjustes', 'verTab', 'fondoTeclado', 'fondoModal']);
function ev(tipo, accion) {
  ACCIONES_OK.add(accion);
  const args = Array.prototype.slice.call(arguments, 2);
  return new Crudo('data-' + tipo + '="' + accion + '"' + (args.length ? ' data-' + tipo + '-a="' + esc(JSON.stringify(args)) + '"' : ''));
}
function on(accion) { return ev.apply(null, ['click'].concat(Array.prototype.slice.call(arguments))); }
/* ----- Plantilla que escapa sola -----
   html`<b>${nombre}</b> ${on('abrir', x)}` → lo que viene de afuera (la hoja, la IA, Open Food Facts) se escapa siempre;
   solo pasa tal cual lo que la propia app armó: on()/ev(), otra plantilla html`` o crudo(h). Un arreglo se une sin comas. */
class Crudo { constructor(s) { this.s = String(s); } toString() { return this.s; } }
const crudo = h => h instanceof Crudo ? h : new Crudo(h);
function html(partes) {
  const pon = v => v instanceof Crudo ? v.s : Array.isArray(v) ? v.map(pon).join('') : v === null || v === undefined || v === false ? '' : esc(v);
  let s = partes[0];
  for (let i = 1; i < partes.length; i++) s += pon(arguments[i]) + partes[i];
  return new Crudo(s);
}
function despachar(tipo, e) {
  const el = e.target && e.target.closest ? e.target.closest('[data-' + tipo + ']') : null;
  if (!el) return;
  const nombre = el.getAttribute('data-' + tipo), f = ACCIONES_OK.has(nombre) ? window[nombre] : null;
  if (typeof f !== 'function') return registrarError('Acción desconocida: ' + nombre, tipo);
  let args = [];
  try { args = JSON.parse(el.getAttribute('data-' + tipo + '-a') || '[]'); } catch (x) { return registrarError('Argumentos inválidos: ' + nombre, tipo); }
  // Solo los argumentos que se pidieron (una función con argumentos opcionales no recibe el evento de sorpresa)
  f.apply(el, args.map(a => a && typeof a === 'object' && a.$ && ARG_VIVO[a.$] ? ARG_VIVO[a.$](el, e) : a));
}
['click', 'input', 'change'].forEach(t => document.addEventListener(t, e => despachar(t, e)));
// Estos no suben por el documento: se escuchan en la fase de captura
['toggle', 'load', 'error', 'canplay'].forEach(t => document.addEventListener(t, e => despachar(t, e), true));
// Texto dentro de un string de JavaScript (ANIM_IA y similares): sin comillas ni caracteres de HTML
function jsq(s) { return String(s).replace(/[\\'"<>&]/g, c => '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0')); }
function mmss(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + pad(s % 60); }
function minutos(ms) { const m = Math.floor(ms / 60000); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + pad(m % 60) + ' min'; }
function vibrar(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }
/* ----- Errores de la app: se guardan en el celular y se suben a la pestaña "Errores" de tu hoja ----- */
let ERR_TIMER = null;
const leerSeguro = f => { try { return f() || ''; } catch (e) { return ''; } };
function registrarError(msg, donde, pila) {
  try {
    msg = String(msg || '').slice(0, 300);
    if (!msg || /ResizeObserver loop|^Script error\.?$|Failed to fetch|NetworkError|Load failed|^Promesa: tiempo$/i.test(msg)) return;
    const l = LS.get('gym_jserr', []), dia = hoy();
    if (l.filter(x => x.dia === dia).length >= 15 || l.some(x => x.dia === dia && x.msg === msg)) return;   // sin repetir y sin inundar la hoja
    l.push({ dia: dia, ts: new Date().toISOString(), msg: msg, donde: String(donde || '').slice(0, 200), pila: String(pila || '').slice(0, 800),
             ver: leerSeguro(() => VERSION_APP) + (leerSeguro(() => NATIVO) ? ' apk' : ' web'), tab: leerSeguro(() => TAB), ua: navigator.userAgent.slice(0, 160) });
    LS.set('gym_jserr', l.slice(-40));
    clearTimeout(ERR_TIMER); ERR_TIMER = setTimeout(subirErrores, 4000);
  } catch (e) { /* el registro de errores nunca debe romper la app */ }
}
async function subirErrores() {
  const nuevos = LS.get('gym_jserr', []).filter(x => !x.subido);
  if (!nuevos.length || !API || !KEY || !navigator.onLine) return;
  const marcar = ok => LS.set('gym_jserr', LS.get('gym_jserr', []).map(x => ok.has('err-' + x.ts) ? Object.assign(x, { subido: true }) : x));
  try {
    await apiPost('errores', [nuevos]);
    marcar(new Set(nuevos.map(x => 'err-' + x.ts)));
  } catch (e) {
    if (!/desconocida/i.test(e.message)) return;   // sin señal: se intenta al volver a abrir
    try {
      const res = await apiPost('batch', [nuevos.map(x => ({ id: 'err-' + x.ts, action: 'logError', args: [x] }))]);
      marcar(new Set(res.filter(r => r.ok).map(r => r.id)));   // si el script aún no tiene logError, se quedan para la próxima
    } catch (e2) { /* se intenta al volver a abrir */ }
  }
}
window.addEventListener('error', e => registrarError(e.message, (e.filename || '').split('/').pop() + ':' + e.lineno + ':' + e.colno, e.error && e.error.stack));
window.addEventListener('unhandledrejection', e => { const r = e.reason || {}; registrarError('Promesa: ' + (r.message || r), '', r.stack); });
/* ----- App nativa (APK con Capacitor): mismos archivos; si corre dentro del APK usa el motor háptico y alarmas reales ----- */
const NATIVO = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
function nativo(plugin, metodo, opts) {
  try { return window.Capacitor.nativePromise(plugin, metodo, opts || {}).catch(() => null); } catch (e) { return Promise.resolve(null); }
}
/* ----- APK: widgets, accesos directos del ícono y Health Connect (solo existen en la app nativa; sin ellos todo sigue igual) ----- */
let WIDGET_T = null;
// Lo que muestran los widgets de la pantalla de inicio; se guarda en el celular después de cada cambio
function actualizarWidgets() {
  if (!NATIVO || !DATA) return;
  clearTimeout(WIDGET_T);
  WIDGET_T = setTimeout(() => { try { nativo('GymNativo', 'guardarWidgets', { datos: datosWidgets() }); } catch (e) { registrarError('Widgets: ' + e.message); } }, 600);
}
function datosWidgets() {
  const r = DATA.resumen || {}, dia = hoy(), cuenta = LS.get('gym_food_counts', {}), vistas = {};
  const botones = recetasComoBotones().concat(misComidas(), FOODS.filter(f => f.k !== 'Licuado')).filter(f => f.g > 0 && !vistas[f.k] && (vistas[f.k] = true))
    .sort((a, b) => ((cuenta[b.k] || 0) + (b.fav ? 2 : 0)) - ((cuenta[a.k] || 0) + (a.fav ? 2 : 0))).slice(0, 2)
    .map(f => ({ k: f.k, t: f.fav || f.rec ? f.t : f.k, g: f.g }));
  const g = grupoDeHoy(), entrena = (DATA.dias || [1, 2, 3, 4, 5]).includes(new Date().getDay());
  let ruta = [];
  try { ruta = rutaAceptada(g) || (GRUPOS3.includes(g) ? calcularRuta(g).items : []); } catch (e) { ruta = []; }
  const nombres = ruta.slice(0, 3).map(x => exDe(x.name)).filter(Boolean).map(e => e.ejercicio.split(' (')[0]);
  // Semana (lunes a domingo): lo de hoy que la hoja aún no tiene también cuenta
  const semana = (r.semana || []).slice(), hoyIdx = (new Date().getDay() + 6) % 7;
  let gym = r.diasSemana || 0;
  if (sesion().log.length && !semana[hoyIdx]) gym++;
  const kmSem = DATA.trotes && DATA.trotes.semanas && DATA.trotes.semanas.length ? DATA.trotes.semanas[DATA.trotes.semanas.length - 1].km : r.km7;
  const sal = LS.get('gym_salud', null), anoche = sal && sal.sueno ? sal.sueno.find(x => x.k === dia) : null;
  return {
    v: 1, ts: Date.now(), dia: dia,
    prot: { dia: dia, g: protTotal(cargarProt(dia)), meta: metaProt(), botones: botones },
    hoy: { dia: dia, grupo: g, hora: String(DATA.recordatorio || '').replace(/^0/, ''), entrena: entrena, proximo: DATA.sugGrupo || g,
           ruta: nombres.length ? nombres.join(' → ') : '' },
    carrera: DATA.carrera ? { fecha: DATA.carrera.fecha, nombre: nombreCarrera(DATA.carrera), dia: dia, hoy: troteDeHoy() }
      : enMantenimiento() ? { mant: true, hechos: trotesSemana(), meta: 2, dia: dia, hoy: troteDeHoy() } : null,
    semana: { gym: gym, meta: META_DIAS, km: Math.round((kmSem || 0) * 10) / 10, peso: r.promedio7 === undefined ? null : r.promedio7,
              cambio: r.cambioSemana === undefined ? null : r.cambioSemana, sueno: anoche ? anoche.h : null }
  };
}
// "✓ 5.0 km hoy" si ya corriste; si no, la siguiente salida del plan
function troteDeHoy() {
  const dia = hoy(), hecho = ((DATA.trotes && DATA.trotes.ult7) || []).filter(t => t.k === dia).concat(trotesPendientes().filter(t => claveDia(new Date(t.ts)) === dia));
  if (hecho.length) return '✓ ' + Math.round(hecho.reduce((a, t) => a + Number(t.km || 0), 0) * 10) / 10 + ' km hoy';
  if (enMantenimiento()) return trotesSemana() >= 2 ? '✓ 2 de 2 esta semana' : 'Toca: fácil · 25–30 min';
  const ses = sesionesPlan(), sig = ses && ses.find(x => !x.hecho);
  return sig ? 'Toca: ' + sig.tipo + ' · ' + sig.min + ' min' : '';
}
// Widget o acceso directo: gymmb://accion/peso | comida | entrenar | trote | progreso
async function consumirAccion() {
  if (!NATIVO) return;
  const r = await nativo('GymNativo', 'consumirAccion');
  if (r && r.url) abrirAccion(r.url);
}
function abrirAccion(url) {
  const a = String(url || '').replace(/^gymmb:\/\/accion\//, '').split(/[/?#]/)[0];
  if (!DATA || !a) return;
  cerrarModal(); cerrarTeclado();
  if (FECHA) cambiarFecha(null);
  if (a === 'peso') { verTab('Entrenar'); PESO_TMP = ''; tecladoPeso(); }
  else if (a === 'comida') verTab('Comida');
  else if (a === 'progreso') verTab('Progreso');
  else if (a === 'pasos') verTab('Entrenar');
  else if (a === 'trote') { verTab('Entrenar'); elegirGrupo('Trote'); }
  else if (a === 'entrenar') {
    verTab('Entrenar');
    if (GRUPO === 'Trote' || !GRUPO_MANUAL) GRUPO = grupoDeHoy();
    OPEN = siguiente(GRUPO, ''); ANIM_ABRE = OPEN; pintarEntrenar();
    if (OPEN) irA(OPEN);
  }
}
// Comidas que sumaste desde el widget de proteína: se agregan a su día y se suben a la hoja (cada una una sola vez)
async function tomarColaWidget() {
  if (!NATIVO || !DATA) return;
  asegurarProt();
  const r = await nativo('GymNativo', 'tomarCola'), items = (r && r.items) || [];
  if (!items.length) return;
  const vistos = LS.get('gym_widget_ids', []), porDia = {};
  items.forEach(x => { if (!x || !x.id || !x.k || vistos.includes(x.id)) return; vistos.push(x.id); (porDia[x.dia] = porDia[x.dia] || []).push(x); });
  LS.set('gym_widget_ids', vistos.slice(-300));
  let g = 0;
  Object.keys(porDia).forEach(dia => {
    const enPantalla = dia === diaComida(), antes = enPantalla ? prot : cargarProt(dia), lista = antes.concat(porDia[dia].map(x => expandirClave(x.k)));
    if (enPantalla) { prot = lista; PROT_DIA = dia; }
    LS.set('gym_prot_' + dia, lista);
    LS.set('gym_protmeal_' + dia, etiquetas(dia, antes.length).concat(porDia[dia].map(x => comidaPorHora(new Date(x.ts || Date.now()).getHours()))));
    porDia[dia] = porDia[dia].map(x => x.k);
    sincronizarDia(dia, lista);
    const c = LS.get('gym_food_counts', {}); porDia[dia].forEach(k => { c[k] = (c[k] || 0) + 1; g += gDe(k); }); LS.set('gym_food_counts', c);
  });
  // Ya quedaron guardadas en el celular: ahora sí se borran de la cola del widget (con el APK anterior ya se habían borrado)
  nativo('GymNativo', 'confirmarCola', { ids: items.map(x => x && x.id).filter(Boolean) });
  if (g) toast('Del widget: +' + g + ' g de proteína');
  pintarTab(); programarAvisoProt(); actualizarWidgets();
}
// Health Connect (solo lectura): pasos, distancia, sueño y sesiones de ejercicio
const SALUD_TIPOS = ['steps', 'distance', 'sleep', 'workouts'];
const hc = (metodo, opts) => { try { return window.Capacitor.nativePromise('Health', metodo, opts || {}).catch(() => null); } catch (e) { return Promise.resolve(null); } };
// APK 7.5 o más nuevo: lee Health Connect con su propio código (carreras con distancia), diagnóstico y aviso de pasos
let APK_P = null, APK_OK = null, ESTADO_N = null;
// El APK 7.5+ siempre contesta "estado" (aunque Health Connect falle un momento); el anterior no tiene ese método
const apkNuevo = () => (APK_P = APK_P || (NATIVO ? nativo('GymNativo', 'estado').then(e => { ESTADO_N = e || null; return (APK_OK = !!e); }) : Promise.resolve(false)));
async function conectarSalud() {
  if (await apkNuevo()) {
    // Una sola pantalla de Health Connect: los 4 permisos de lectura y "en segundo plano" (para el aviso de las 5 pm)
    await nativo('LocalNotifications', 'requestPermissions');   // el aviso de pasos es una notificación
    const e = await nativo('GymNativo', 'conectarSalud', { fondo: true });
    if (e) ESTADO_N = e;
    if (e && e.errorHC) { toast('Health Connect no respondió: ' + String(e.errorHC).slice(0, 80)); return false; }
    if (!e || e.sdk === 'no') { toast('Health Connect no está disponible en este celular'); return false; }
    if (e.sdk === 'actualizar') { toast('Actualiza Health Connect en Play Store y vuelve a intentar'); return false; }
    // Si ya los negaste 2 veces, Android ya no muestra la ventana: se abre la pantalla de permisos de Gym en Health Connect
    const abrir = { txt: 'Abrir', fn: () => nativo('GymNativo', 'abrirPermisosSalud') };
    if (!(e.permisos || []).length) { toast('Sin permiso de Health Connect: actívalo ahí para Gym', '', abrir); return false; }
    const NOM = { READ_STEPS: 'pasos', READ_DISTANCE: 'distancia', READ_SLEEP: 'sueño', READ_EXERCISE: 'ejercicio' };
    if ((e.faltan || []).length) toast('Falta permiso de ' + e.faltan.map(p => NOM[p] || p).join(', ') + ' en Health Connect', '', abrir);
    return true;
  }
  const d = await hc('isAvailable');
  if (!d || !d.available) { toast('Health Connect no está disponible en este celular'); return false; }
  const r = await hc('requestAuthorization', { read: SALUD_TIPOS, write: [] });
  if (!r || !(r.readAuthorized || []).length) { toast('Sin permiso: la app sigue igual, sin Health Connect'); return false; }
  return true;
}
// Lectura con el APK anterior (plugin de capgo): la distancia de cada carrera se pide aparte porque ahí llegaba vacía
async function leerSaludCapgo(ini, fin) {
  const iso = d => d.toISOString(), kLocal = t => claveDia(new Date(t));
  const [pasosR, suenoR, runsR] = await Promise.all([
    hc('queryAggregated', { dataType: 'steps', startDate: iso(ini), endDate: iso(fin), bucket: 'day', aggregation: 'sum' }),
    hc('readSamples', { dataType: 'sleep', startDate: iso(new Date(ini.getTime() - 12 * 3600e3)), endDate: iso(fin), limit: 60 }),
    hc('queryWorkouts', { startDate: iso(ini), endDate: iso(fin), limit: 60 })
  ]);
  if (!pasosR && !suenoR && !runsR) return null;   // sin permiso o sin Health Connect: todo sigue igual
  const pasos = ((pasosR && pasosR.samples) || []).map(x => ({ k: kLocal(x.startDate), v: Math.round(Number(x.value || (x.values || {}).sum) || 0) })).filter(x => x.v > 0);
  // Sueño: se cuenta lo dormido (sin despierto ni "en cama") y va al día en que despertaste
  const noches = {};
  ((suenoR && suenoR.samples) || []).forEach(x => {
    const min = x.stages && x.stages.length ? x.stages.filter(st => !/awake|inBed/.test(st.stage)).reduce((a, st) => a + (st.durationMinutes || 0), 0) : Number(x.value) || 0;
    if (min > 0) { const k = kLocal(x.endDate); noches[k] = (noches[k] || 0) + min / 60; }
  });
  const sueno = Object.keys(noches).sort().map(k => ({ k: k, h: Math.round(noches[k] * 10) / 10 }));
  const todas = (runsR && runsR.workouts) || [], corridas = todas.filter(w => /^running/.test(w.workoutType || ''));
  for (const w of corridas) {
    if (Number(w.totalDistance) >= 500) continue;
    const d = await hc('queryAggregated', { dataType: 'distance', startDate: w.startDate, endDate: w.endDate, bucket: 'hour', aggregation: 'sum' });
    const m = ((d && d.samples) || []).reduce((a, x) => a + (Number(x.value) || 0), 0);
    if (m) w.totalDistance = m;
  }
  const runs = corridas.filter(w => Number(w.totalDistance) >= 500).map(w => ({
    uid: 'hc-' + (w.platformId || w.startDate), ts: w.startDate, k: kLocal(w.startDate),
    km: Math.round(Number(w.totalDistance) / 10) / 100, min: Math.round(Number(w.duration) / 6) / 10, fuente: String(w.sourceName || '').slice(0, 60) }));
  return { pasos: pasos, sueno: sueno, runs: runs, sesiones: todas.length, sinDistancia: corridas.length - runs.length,
           fuentesPasos: [], fuentesSueno: [], fuentesEjercicio: [...new Set(todas.map(w => w.sourceName).filter(Boolean))], errores: [], via: 'capgo' };
}
async function leerSalud(forzar) {
  if (!NATIVO || !DATA || !ajuste('salud', false)) return;
  const ult = LS.get('gym_salud', null);
  if (!forzar && ult && Date.now() - ult.ts < 20 * 60 * 1000) return;   // máximo una lectura cada 20 min
  const ini = new Date(); ini.setDate(ini.getDate() - 7); ini.setHours(0, 0, 0, 0);
  let r = null;
  if (await apkNuevo()) {
    const n = await nativo('GymNativo', 'leerSalud', { dias: 7 });
    if (n && n.ok) r = Object.assign(n, { via: 'nativo' });
  }
  if (!r) r = await leerSaludCapgo(ini, new Date());
  if (!r) return;
  // Más lento que 9:30/km es una caminata (Samsung las manda como "running"): no entra a Trotes
  const runs = (r.runs || []).filter(x => !(Number(x.min) > 0 && Number(x.km) > 0 && Number(x.min) / Number(x.km) > 9.5))
    .map(x => ({ uid: x.uid, ts: x.ts, k: x.k, km: x.km, min: x.min, fuente: String(x.fuente || '').slice(0, 60) }));
  LS.set('gym_salud', { ts: Date.now(), pasos: r.pasos || [], sueno: r.sueno || [], runs: runs, via: r.via, sesiones: r.sesiones || 0, sinDistancia: r.sinDistancia || 0,
    fuentes: { pasos: r.fuentesPasos || [], sueno: r.fuentesSueno || [], ejercicio: r.fuentesEjercicio || [] }, errores: (r.errores || []).slice(0, 5) });
  // A la hoja: un renglón por día en "Salud" y las carreras que falten en Trotes (el script evita duplicados)
  const dias = {};
  (r.pasos || []).forEach(x => { (dias[x.k] = dias[x.k] || { k: x.k }).pasos = x.v; });
  (r.sueno || []).forEach(x => { (dias[x.k] = dias[x.k] || { k: x.k }).sueno = x.h; });
  const firma = JSON.stringify([dias, runs.map(x => x.uid)]);
  if (firma !== LS.get('gym_salud_firma', '')) {
    encolar('saveSalud', [{ dias: Object.values(dias), trotes: runs }], 'salud');
    LS.set('gym_salud_firma', firma);
  }
  actualizarWidgets();
  if (TAB === 'Progreso') pintarProgreso();
  repintarEntrenar();
}
// Las tarjetas de Entrenar que dependen de lo nativo (pasos, permisos), sin interrumpir si estás anotando algo
function repintarEntrenar() {
  if (TAB === 'Entrenar' && !sesionActiva() && !$('kp').classList.contains('show') && !$('modal').classList.contains('show')) pintarEntrenar();
}
// Aviso de pasos (APK 7.5+): la hora, la meta y si está prendido viven también en el celular para la alarma
const META_PASOS = () => ajuste('metaPasos', 7000), HORA_PASOS = 17;
function configurarPasos() {
  if (!NATIVO) return;
  apkNuevo().then(ok => ok && nativo('GymNativo', 'configurarPasos', { activo: ajuste('salud', false) && ajuste('avisoPasos', true), meta: META_PASOS(), hora: HORA_PASOS, minuto: 0, laborales: true }));
}
let NATIVO_LISTO = false, RECARGA_PENDIENTE = false;
// Hay algo a medias en pantalla: teclado abierto, una ventana, un campo con el cursor o una sesión en curso
function ocupado() {
  const a = document.activeElement;
  return $('kp').classList.contains('show') || $('modal').classList.contains('show') || (a && /^(INPUT|TEXTAREA)$/.test(a.tagName)) || sesionActiva();
}
function iniciarNativo() {
  if (!NATIVO || NATIVO_LISTO) return;
  NATIVO_LISTO = true;
  try { window.Capacitor.addListener('GymNativo', 'accion', () => consumirAccion()); } catch (e) { /* APK anterior: sin widgets */ }
  // Tocar un aviso (ej. el de las 7 am) abre lo suyo
  try { window.Capacitor.addListener('LocalNotifications', 'localNotificationActionPerformed', e => {
    const a = e && e.notification && e.notification.extra && e.notification.extra.accion;
    if (a) setTimeout(() => abrirAccion('gymmb://accion/' + a), 300);
  }); } catch (e) { /* sin avisos */ }
  consumirAccion(); tomarColaWidget(); leerSalud(); configurarPasos();
  apkNuevo().then(ok => { if (ok) repintarEntrenar(); });
}
// Vibración con intención: ligera al teclear, golpe fuerte al marcar serie, patrón de éxito en récord
const HAPTICOS = {
  tecla: [['impact', { style: 'LIGHT' }], 6],
  ok:    [['impact', { style: 'MEDIUM' }], 15],
  serie: [['impact', { style: 'HEAVY' }], 35],
  pr:    [['notification', { type: 'SUCCESS' }], [40, 60, 40, 60, 120]],
  fin:   [['vibrate', { duration: 600 }], [300, 150, 300]],
  error: [['notification', { type: 'ERROR' }], [60, 40, 60]],
  atencion: [['notification', { type: 'WARNING' }], [80, 80, 80]],
};
function hap(tipo) {
  const h = HAPTICOS[tipo] || HAPTICOS.ok;
  if (NATIVO) { nativo('Haptics', h[0][0], h[0][1]); if (tipo === 'pr') setTimeout(() => nativo('Haptics', 'impact', { style: 'HEAVY' }), 220); }
  else vibrar(h[1]);
}
function vacio(v) { return v === '' || v === null || v === undefined; }
let toastFn = null;
// toast(mensaje, tipo, {txt, fn}) — con acción (por ejemplo "Deshacer") dura 5 segundos
function toast(msg, tipo, accion) {
  if (Date.now() < TOAST_FIJO && !accion) return;   // el aviso de "sin espacio" no se tapa
  const t = $('toast');
  toastFn = accion ? accion.fn : null;
  t.innerHTML = html`<span>${msg}</span>${accion ? html`<button ${on('usarToast')}>${accion.txt}</button>` : ''}`;
  t.className = 'toast show' + (tipo ? ' ' + tipo : '') + (accion ? ' act' : '');
  clearTimeout(t._h);
  t._h = setTimeout(() => { t.className = 'toast'; toastFn = null; }, accion ? 5000 : tipo === 'pr' ? 2800 : 2200);
}
function usarToast() { const f = toastFn; $('toast').className = 'toast'; toastFn = null; if (f) f(); }
const ICO = {
  check: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  trophy: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/></svg>',
  up: '<svg class="icon" style="width:16px;height:16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  flame: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21c-3.9 0-6.5-2.7-6.5-6.3 0-3.2 2.3-5.4 3.6-7.7.4 1.6 1.3 2.7 2.4 3.2C11.8 7.7 13 5 15.2 3c.1 3 3.3 5.6 3.3 10.7 0 4-2.7 7.3-6.5 7.3z"/></svg>',
  timer: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg>',
  pausa: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>',
  cal: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  share: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v13M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>',
  camara: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  swap: '<svg class="icon" style="width:16px;height:16px;vertical-align:-3px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/></svg>'
};
const RPE = { 'Al fallo': 10, 'Casi (1–2 más)': 8.5, 'Sobraban 3+': 7 };
const KG_A_LB = 2.2046;
const GRUPOS3 = ['Push', 'Pull', 'Legs'];
const DIAS_CORTOS = ['D', 'L', 'M', 'Mi', 'J', 'V', 'S'];   // 0 = domingo … 6 = sábado

/* ===================== Configuración y datos ===================== */
let API = LS.get('gym_api', ''), KEY = LS.get('gym_key', '');
let DATA = null, GRUPO = null, TAB = 'Entrenar', OPEN = null, BUSCA = '', PTAB = 'Semana';
let FECHA = null;              // null = hoy; 'aaaa-mm-dd' = registrando otro día
let GRUPO_MANUAL = false, GRUPO_DIA = null;
// Animaciones de una sola vez: se marcan antes de pintar y se limpian al terminar (así no se repiten en cada toque)
let ANIM_ABRE = null, ANIM_SET = null, ANIM_IA = null, ANIM_PLAN = false;   // el grupo sigue al de hoy salvo que tú elijas otro ese día
let state = {};
let prot = [];
let COMIDA_DIA = null;         // null = hoy; 'aaaa-mm-dd' = registrando la comida de ayer
const diaComida = () => COMIDA_DIA || hoy();
let BV_POSPUESTA = false;      // "Ahora no" en la bienvenida: vuelve a salir la próxima vez que abras la app
let flushing = false, flushTimer = null;
const PLEG = {};               // secciones abiertas a mano

const FOODS = [
  { k: 'Licuado', t: 'Licuado (scoop + leche)', g: 32 },
  { k: 'Scoop', t: 'Scoop con agua', g: 22 },
  { k: 'Tupper carne', t: 'Tupper con carne o pollo', g: 28 },
  { k: 'Tupper pasta', t: 'Tupper de pasta o papa', g: 12 },
  { k: 'Cena huevos', t: 'Cena: 3 de maíz con queso y frijol + 2 huevos', g: 30 },
  { k: 'Cena pollo', t: 'Cena: quesadillas de harina + pollo', g: 40 },
  { k: 'Quesadillas', t: '2 quesadillas solas', g: 16 },
  { k: 'Huevos', t: '2 huevos', g: 12 },
  { k: 'Atún', t: 'Lata de atún', g: 20 },
  { k: 'Carne', t: 'Carne o pollo (tu palma)', g: 25 },
  { k: 'Leche', t: 'Vaso de leche', g: 8 },
  { k: 'Yogurt', t: 'Yogurt griego o skyr', g: 15 },
  { k: 'Calle', t: 'Comida de la calle', g: 25 }
];
const META_DIAS = 4;
const metaProt = () => (DATA && DATA.metaProteina) || 130;
const DESCANSOS = [60, 90, 120, 180];
const TIPOS_TROTE = ['Fácil', 'Calidad', 'Larga', 'Carrera', 'Libre'];
const ajuste = (k, d) => LS.get('gym_cfg_' + k, d);
// Modo sencillo: para quien empieza (menos pestañas, instrucciones en palabras normales)
const sencillo = () => ajuste('sencillo', false);
const NOMBRE_GRUPO = { Push: 'Pecho y hombro', Pull: 'Espalda y bíceps', Legs: 'Pierna', Core: 'Abdomen', Trote: 'Correr' };
function aplicarSencillo() { document.body.classList.toggle('sencillo', !!sencillo()); }
const setAjuste = (k, v) => LS.set('gym_cfg_' + k, v);
const diaReg = () => FECHA || hoy();
const tsReg = () => FECHA ? new Date(FECHA + 'T07:00:00').getTime() : Date.now();
// Nombres para avisar qué dato rechazó la hoja
const NOMBRE_OP = { saveExercise: 'Ejercicio', savePeso: 'Peso', saveProteina: 'Proteína', saveCintura: 'Cintura', saveTrote: 'Trote', saveMedia: 'Video', saveAjuste: 'Ajuste de máquina',
                    saveFoto: 'Foto', saveConfig: 'Ajuste', undoById: 'Borrado', undoTrote: 'Borrado de trote', borrarFoto: 'Borrado de foto',
                    cambiarVariante: 'Cambio de equipo (actualiza el script)', saveSalud: 'Health Connect (actualiza el script)' };

/* ===================== API ===================== */
// Lecturas también por POST: la clave nunca viaja en el link (los links quedan en historial y registros)
async function apiGet(action, clave) { return apiPost(action, [], clave); }
async function apiPost(action, args, clave) {
  // Pareja (script 7.6+): la hoja ya no manda la clave del compañero; vas con la tuya y "para" con su nombre
  const c = clave || KEY, cuerpo = /^para:/.test(c) ? { k: KEY, para: c.slice(5) } : { k: c };
  // text/plain evita la verificación previa de CORS que Apps Script no contesta
  const r = await fetch(API, { method: 'POST', redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(Object.assign(cuerpo, { action: action, args: args })) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'Error de la API');
  return j.result;
}

/* ===================== Cola de cambios (funciona sin señal) ===================== */
let COLA_MEM = null;   // si el celular se quedó sin espacio, la cola vive aquí hasta que se sube
function cola() { return COLA_MEM || LS.get('gym_queue', []); }
function guardarCola(q) {
  if (LS.set('gym_queue', q)) COLA_MEM = null;
  else { COLA_MEM = q; avisoEspacio(); }
  pintarSync();
}
// Sin espacio: el aviso se queda unos segundos (que un "Guardado ✓" no lo tape) y no cierres la app hasta que suba
let TOAST_FIJO = 0;
function avisoEspacio() {
  TOAST_FIJO = 0;
  toast('Tu celular no tiene espacio para la app: esto se sube en cuanto haya señal, no la cierres', 'error');
  TOAST_FIJO = Date.now() + 4500;
}
function encolar(action, args, tag, clave) {
  let q = cola();
  const k = clave || KEY;
  if (tag) q = q.filter(op => !(op.tag === tag && (op.k || KEY) === k));
  q.push({ id: uid(), action: action, args: args, tag: tag || null, k: k });
  guardarCola(q);
  clearTimeout(flushTimer); flushTimer = setTimeout(enviar, 1200);
}
let ENVIOS = 0;   // lotes mandados: una lectura de la hoja que se cruzó con uno se vuelve a pedir
async function enviar() {
  const q = cola();
  if (flushing || !q.length || !API || navigator.onLine === false) return;
  flushing = true; pintarSync();
  const errores = [];
  let fallo = false;
  try {
    // Cada cambio se manda con la clave con la que se hizo (por si alguien cambió de cuenta en este celular);
    // una clave rechazada no frena las demás
    for (const c of [...new Set(q.map(op => op.k || KEY))]) {
      const deClave = q.filter(op => (op.k || KEY) === c), ids = new Set(deClave.map(op => op.id));
      // "En camino": si los deshaces mientras tanto, además se manda el borrado
      guardarCola(cola().map(op => ids.has(op.id) ? Object.assign(op, { enviado: true }) : op));
      ENVIOS++;
      let res;
      try { res = await apiPost('batch', [deClave.map(op => ({ id: op.id, action: op.action, args: op.args }))], c); }
      catch (e) { fallo = true; if (/Clave/.test(e.message)) toast('La clave no coincide; revisa la configuración'); continue; }
      const listos = new Set(), intentos = {};
      (res || []).forEach(r => {
        if (r.ok) return listos.add(r.id);
        const op = q.find(o => o.id === r.id);
        // Un error pasajero de Google no borra el dato: se reintenta (3 veces en total) antes de avisarte
        if (op && (op.intentos || 0) < 2) { intentos[r.id] = (op.intentos || 0) + 1; fallo = true; return; }
        listos.add(r.id);
        errores.push({ que: NOMBRE_OP[op && op.action] || 'Dato', msg: String(r.error || 'Error'), cuando: hoy() });
      });
      guardarCola(cola().filter(op => !listos.has(op.id)).map(op => intentos[op.id] ? Object.assign(op, { intentos: intentos[op.id] }) : op));
    }
  } finally { flushing = false; pintarSync(); }
  if (fallo) { clearTimeout(flushTimer); flushTimer = setTimeout(enviar, 20000); }
  if (errores.length) {
    // El aviso se queda arriba en Entrenar hasta que tocas "Entendido"
    LS.set('gym_errores', LS.get('gym_errores', []).concat(errores).slice(-10));
    toast('La hoja no aceptó ' + (errores.length === 1 ? 'un dato' : errores.length + ' datos') + '; revisa el aviso');
    if (DATA && TAB === 'Entrenar') pintarEntrenar();
  }
}
function pintarSync() {
  const n = cola().length, el = $('sync');
  if (!el) return;
  if (flushing) { el.className = 'sync'; el.textContent = 'Subiendo…'; }
  else if (n) { el.className = 'sync pend'; el.textContent = n + ' sin subir' + (navigator.onLine ? '' : ' · sin señal') + (COLA_MEM ? ' · sin espacio' : ''); }
  else { el.className = 'sync ok'; el.textContent = '✓ Guardado'; }
}
function avisoErrores() {
  const e = LS.get('gym_errores', []);
  if (!e.length) return '';
  return crudo(html`<div class="card" style="background:var(--acc-weak);border-color:transparent">` +
    html`<div class="t1" style="color:var(--acc)">La hoja no aceptó ${e.length === 1 ? 'un dato' : e.length + ' datos'}</div>` +
    html`<div class="muted" style="margin:4px 0 10px">${e.slice(-3).map((x, i) => html`${i ? html`<br>` : ''}${x.que + ' (' + ddmm(x.cuando) + '): ' + x.msg}`)}` +
    html`<br>Quedó en tu celular, pero no en la hoja. Si no sabes por qué, mándale captura a tu coach.</div>` +
    html`<button class="btn ghost sm" ${on('entendidoErrores')}>Entendido</button></div>`);
}

/* ===================== Arranque ===================== */
function arrancar() {
  aplicarSencillo(); cargarFotosMaq();
  // Link de configuración: ?api=…&k=… o #api=…&k=… (también acepta key=)
  const p = new URLSearchParams(location.search), ph = new URLSearchParams(location.hash.slice(1));
  const linkApi = (p.get('api') || ph.get('api') || '').trim(), linkKey = (p.get('k') || p.get('key') || ph.get('k') || ph.get('key') || '').trim();
  if (linkApi && linkKey) {
    // Solo un script de Google (script.google.com/macros/s/…/exec); si ya hay otra cuenta en este celular, se pregunta
    const valido = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(linkApi);
    const cambia = KEY && (linkKey !== KEY || linkApi !== API);
    if (!valido) toast('Ese link de configuración no es válido');
    else if (!cambia || confirm('Este link cambia la cuenta de la app en este celular. Lo que no se haya subido se sube con la cuenta anterior. ¿Continuar?')) {
      if (cambia) cambiarDeCuenta();
      API = linkApi; KEY = linkKey;
      LS.set('gym_api', API); LS.set('gym_key', KEY);
      toast('App configurada ✓');
    }
  }
  const g = p.get('g');
  if (g) { GRUPO = g; OPEN = null; GRUPO_MANUAL = true; GRUPO_DIA = hoy(); }
  if (p.toString() || location.hash) history.replaceState(null, '', location.pathname);
  ponerGuardia();
  // Tarjeta pendiente abierta: al tocar uno de sus botones se cierra (si abrió otra ventana, como confirmar la cintura, esa se queda)
  $('sheet').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || b.classList.contains('cerrar') || !$('sheet').dataset.pend) return;
    setTimeout(() => { if ($('sheet').dataset.pend) cerrarModal(); }, 150);
  });
  if ('serviceWorker' in navigator) {
    const teniaVersion = !!navigator.serviceWorker.controller;
    let recargada = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!teniaVersion || recargada) return;
      recargada = true;
      if (ocupado()) RECARGA_PENDIENTE = true; else location.reload();
    });
    navigator.serviceWorker.register('sw.js').then(reg => reg.update()).catch(() => {});
    // El APK casi nunca se cierra del todo: al regresar a la app también se busca la versión nueva (máximo cada 10 min)
    let ultimaRevision = Date.now();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || Date.now() - ultimaRevision < 10 * 60e3) return;
      ultimaRevision = Date.now();
      navigator.serviceWorker.getRegistration().then(reg => reg && reg.update()).catch(() => {});
    });
  }
  if (!API || !KEY) { $('loading').classList.add('hide'); $('setup').classList.remove('hide'); return; }

  limpiarDiasViejos(60);
  DATA = LS.get('gym_data', null);
  if (DATA) { pintarTodo(); iniciarNativo(); }
  actualizar();
  enviar();
  window.addEventListener('online', () => { pintarSync(); enviar(); refrescar(); });
  window.addEventListener('offline', pintarSync);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && RECARGA_PENDIENTE) return location.reload();   // la versión nueva, al salir de la app
    if (document.visibilityState === 'visible') {
      revisarDia(); enviar(); refrescar(); tickRest();
      if (NATIVO && DATA) { consumirAccion(); tomarColaWidget(); leerSalud(); }
      if (sesionActiva()) pedirPantalla();
    }
  });
  setInterval(enviar, 30000);
  setInterval(tickSesion, 15000);
  setTimeout(subirErrores, 8000);
  if (LS.get('gym_rest', null)) arrancarRest();
  if (sesionActiva()) pedirPantalla();
}
const VERSION_APP = 'v10.2';
// Versión del script de Apps Script que espera esta app (SCRIPT_VERSION en AppGym.js); si la hoja trae una anterior, Ajustes avisa
const SCRIPT_ESPERADO = '8.5';
const versionNum = v => String(v || '0').split('.').map(Number).reduce((a, x, i) => a + x / Math.pow(100, i), 0);
const scriptAlDia = () => !!(DATA && DATA.scriptVersion && versionNum(DATA.scriptVersion) >= versionNum(SCRIPT_ESPERADO));
let ULT_LECTURA = 0;
// Al volver a la app o recuperar la señal: lee la hoja si pasó más de un minuto desde la última vez
function refrescar() { if (Date.now() - ULT_LECTURA > 60000) actualizar(); }
// Otra persona en este celular: se borra todo lo de la cuenta anterior menos la cola (sus pendientes se suben con su clave)
function cambiarDeCuenta() {
  LS.claves().filter(k => /^gym_/.test(k) && !['gym_queue', 'gym_api', 'gym_key'].includes(k)).forEach(k => LS.del(k));
  if (NATIVO) nativo('GymNativo', 'tomarCola').then(r => {   // las comidas del widget eran de la otra cuenta
    const ids = ((r && r.items) || []).map(x => x.id).filter(Boolean);
    if (ids.length) nativo('GymNativo', 'confirmarCola', { ids: ids });
  });
}
// Tu link de configuración (lleva tu clave): para configurar el APK sin escribir nada. Va después de "#": no llega a ningún servidor
function copiarLinkConfig() {
  const link = location.origin + location.pathname + '#api=' + encodeURIComponent(API) + '&k=' + encodeURIComponent(KEY);
  (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(() => toast('Link copiado: pégalo en la app (no lo compartas)'),
    () => toast('No pude copiar; tu link: ' + link.slice(0, 60) + '…'));
}
function guardarConfig() {
  // Si pegas el link completo (…?api=…&key=…) en la casilla de la URL, se toman los dos datos de ahí
  const pegado = $('cfgApi').value.trim();
  if (/[?&#]api=/.test(pegado)) {
    try {
      const u = new URL(pegado), q = new URLSearchParams(u.search.slice(1) + '&' + u.hash.slice(1));
      $('cfgApi').value = q.get('api') || ''; $('cfgKey').value = q.get('k') || q.get('key') || $('cfgKey').value;
    } catch (e) {}
  }
  const a = $('cfgApi').value.trim(), k = $('cfgKey').value.trim();
  if (!/^https:\/\/script\.google\.com\//.test(a) || !k) return toast('Revisa la URL y la clave');
  LS.set('gym_api', a); LS.set('gym_key', k);
  location.reload();
}
async function actualizar(intento) {
  try {
    for (let i = 0; flushing && i < 60; i++) await new Promise(r => setTimeout(r, 250));
    const n0 = ENVIOS, d = await apiGet('data');
    if (!d || typeof d !== 'object' || !Array.isArray(d.exercises)) throw new Error('La hoja mandó datos incompletos');
    if (ENVIOS !== n0 && (intento || 0) < 2) return actualizar((intento || 0) + 1);
    ULT_LECTURA = Date.now();
    const igual = DATA && JSON.stringify(d) === JSON.stringify(DATA);
    DATA = d; LS.set('gym_data', d);
    if (!igual || DIA_PINTADO !== hoy()) pintarTodo();   // si no cambió nada, no se borra lo que estés escribiendo
    if (!NATIVO_LISTO) iniciarNativo();                   // primera vez en este celular (sin datos guardados)
    seguroNut(primerSyncNut, 'primer envío');           // script 7.7 recién puesto: sube hoy y ayer a la pestaña Comidas
    seguroNut(mandarMetasGym, 'metas para Panel');      // script 8.1: Panel muestra las metas que calcula Gym
    precargarMedia();
    if (DATA.perfil === false && !LS.get('gym_bienvenida', false)) abrirBienvenida();
    else { revisarMedallas(); setTimeout(tourSiToca, 700); }
  } catch (e) {
    if (/incompletos/.test(e.message)) registrarError(e.message, 'actualizar');
    if (!DATA) $('loading').textContent = /Clave/.test(e.message)
      ? 'La clave no coincide. Vuelve a abrir el link de configuración.'
      : 'Necesitas internet la primera vez que abres la app.';
  }
}

/* ===================== Estado del día ===================== */
const fresco = () => DATA && DATA.todayKey === hoy();
function sesion() { return LS.get('gym_ses_' + hoy(), { start: null, log: [], ended: false }); }
function guardarSesion(s) { LS.set('gym_ses_' + hoy(), s); }
function sesionActiva() { const s = sesion(); return !!(s.start && !s.ended); }
function wip() { return LS.get('gym_wip_' + diaReg(), {}); }
function guardarWip(name) {
  const w = wip(), st = state[name];
  if (st && !st.done && st.edited) w[name] = { unit: st.unit, sets: st.sets, rir: st.rir, notas: st.notas };
  else delete w[name];
  LS.set('gym_wip_' + diaReg(), w);
}
function exDe(name) { return esPar(name) ? (PAR && PAR.exs ? PAR.exs[name] : undefined) : DATA.exercises.find(e => e.name === name); }
