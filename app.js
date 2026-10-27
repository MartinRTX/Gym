/* Gym v5.4 – app instalable (sirve para varias personas: cada quien con su clave y su propia hoja).
 * Lee y escribe la hoja de Google a través del script de Apps Script (la "API").
 * Todo lo que guardas se queda primero en el celular y se sube en cuanto hay señal.
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
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
// Lo de cada día (sesión, comida, peso, borradores…) lleva la fecha en la clave; lo de hace semanas ya está en tu hoja
function limpiarDiasViejos(dias) {
  const corte = sumarDias(hoy(), -dias);
  try { Object.keys(localStorage).forEach(k => { const m = /^gym_.+_(\d{4}-\d{2}-\d{2})$/.exec(k); if (m && m[1] < corte) localStorage.removeItem(k); }); } catch (e) {}
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
// Texto dentro de un string de JavaScript en onclick="…": sin comillas ni caracteres de HTML (un nombre con " no rompe el botón)
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
  t.innerHTML = '<span>' + esc(msg) + '</span>' + (accion ? '<button onclick="usarToast()">' + esc(accion.txt) + '</button>' : '');
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
// Estilos de la v5.3 y v5.4 (metas, logros, bienvenida, notas); van aquí para no tener que cambiar index.html
const CSS_V53 = `
  .seg.s4 { grid-template-columns: repeat(4, 1fr); }
  .seg.s4 button { font-size: 13px; }
  .metabar { height: 12px; background: var(--card2); border-radius: 99px; overflow: hidden; margin: 10px 0 6px; }
  .metabar div { height: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--pri), var(--ok)); }
  .pts { display: flex; align-items: baseline; gap: 6px; }
  .pts b { font-size: 40px; font-weight: 800; letter-spacing: -.03em; line-height: 1; color: var(--pri); }
  .desglose { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; margin-top: 12px; }
  .desglose .l { font-size: 12.5px; color: var(--muted); display: flex; justify-content: space-between; }
  .desglose .b { height: 6px; background: var(--card2); border-radius: 99px; overflow: hidden; margin-top: 3px; }
  .desglose .b div { height: 100%; background: var(--pri); border-radius: 99px; }
  .meds { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .med { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 12px 6px; text-align: center; }
  .med .i { font-size: 30px; line-height: 1.1; }
  .meds.mini { grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .meds.mini .med { padding: 8px 4px; border-radius: 12px; }
  .meds.mini .i { font-size: 22px; }
  .meds.mini .n { font-size: 11px; font-weight: 600; }
  .med .n { font-size: 12.5px; font-weight: 700; margin-top: 4px; line-height: 1.2; }
  .med .p { font-size: 11px; color: var(--muted); margin-top: 3px; }
  .med.no { background: var(--card2); }
  .med.no .i { filter: grayscale(1); opacity: .4; }
  .med .mb { height: 4px; background: var(--line); border-radius: 99px; overflow: hidden; margin: 6px 8px 0; }
  .med .mb div { height: 100%; background: var(--pri); }
  .dias { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin: 8px 0 4px; }
  .dias button { border: 1.5px solid var(--line); background: var(--card); border-radius: 10px; padding: 9px 0; font-weight: 700; font-size: 13px; color: var(--muted); }
  .dias button.on { background: var(--pri); border-color: var(--pri); color: var(--on-pri); }
  .bv label { display: block; font-weight: 700; margin: 14px 0 4px; }
  .bv input[type=number] { width: 100%; padding: 12px; border: 1.5px solid var(--line); border-radius: 12px; background: var(--card2); color: var(--text); font-size: 18px; font-weight: 700; }
  .pesobtn.vacio { color: var(--pri); font-size: 15px; font-weight: 700; }
  .nota { display: block; width: 100%; text-align: left; border: 0; background: var(--card2); color: var(--text); border-radius: 12px; padding: 9px 12px; font-size: 13.5px; margin: 0 0 10px; }
  .nota .ed { float: right; color: var(--pri); font-weight: 700; font-size: 12.5px; margin-left: 8px; }
  .ajuste-ed { display: flex; gap: 8px; margin: 0 0 10px; }
  .ajuste-ed input { flex: 1; min-width: 0; padding: 10px 12px; border: 1.5px solid var(--pri); border-radius: 12px; background: var(--card2); color: var(--text); font-size: 15px; }
  .swapbtn { flex: none; border: 1.5px solid var(--line); background: var(--card2); color: var(--pri); border-radius: 99px; padding: 6px 10px; font-size: 12.5px; font-weight: 700; }
  .links { display: flex; flex-wrap: wrap; gap: 6px 16px; align-items: center; margin-top: 10px; }
  .esf { margin-top: 10px; }
  .esf .pills { margin-top: 4px; }
  .celebra { text-align: center; padding: 6px 0 2px; }
  .celebra .i { font-size: 64px; line-height: 1.1; animation: pop .5s ease; }
  /* v5.5: volumen en vivo, esfuerzo al terminar, completados y coach IA */
  .vol { display: flex; flex-wrap: wrap; gap: 6px; margin: -4px 0 12px; }
  .vol span { background: var(--card2); border: 1px solid var(--line); border-radius: 99px; padding: 5px 10px; font-size: 12.5px; color: var(--muted); }
  .vol b { color: var(--text); font-weight: 700; margin-right: 3px; }
  .esf.pide { background: var(--acc-weak); border-radius: 14px; padding: 10px 12px; }
  .esf.pide > .muted { color: var(--text); font-weight: 700; }
  details.hechos > summary { color: var(--ok); }
  .ia { display: flex; gap: 8px; align-items: flex-start; background: var(--card2); border-left: 3px solid var(--pri); border-radius: 10px; padding: 9px 12px; margin: 0 0 10px; font-size: 14px; }
  .ia .btn { flex: none; margin-left: auto; }
  .ia.cargando { color: var(--muted); }
  .pasoq { background: var(--card2); border-radius: 12px; padding: 9px 12px; margin: -4px 0 10px; font-size: 13px; color: var(--muted); }
  .pasoq div { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 6px; }
  .pasoq button { border: 1.5px solid var(--line); background: var(--card); color: var(--text); border-radius: 10px; padding: 8px 0; font-weight: 700; }
  .pasoq button.on { border-color: var(--pri); color: var(--pri); }
  /* v5.6: esfuerzo por serie, comida con IA, chat con el coach */
  .set .e { font-size: 10px; font-weight: 800; color: inherit; opacity: .85; display: block; line-height: 1; margin-top: 2px; }
  .iacard textarea, .chatin textarea { width: 100%; min-height: 64px; padding: 10px 12px; border: 1.5px solid var(--line); border-radius: 12px;
    background: var(--card2); color: var(--text); font: inherit; font-size: 15px; resize: vertical; }
  .iacard textarea:focus, .chatin textarea:focus { outline: none; border-color: var(--pri); }
  .iitem { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--line); }
  .iitem:last-of-type { border-bottom: 0; }
  .iitem .nm { flex: 1; min-width: 0; }
  .iitem .nm small { display: block; color: var(--muted); font-size: 12px; }
  .iitem .g { font-weight: 800; color: var(--pri); min-width: 46px; text-align: center; }
  .iitem button.mini { border: 1.5px solid var(--line); background: var(--card); border-radius: 10px; width: 32px; height: 32px; font-weight: 800; }
  .iitem button.mini.on { background: var(--pri); border-color: var(--pri); color: var(--on-pri); }
  .iitem.off .nm, .iitem.off .g { opacity: .4; text-decoration: line-through; }
  .food.fav b::after { content: ' ⭐'; font-size: 11px; }
  .food.quitar { border-color: var(--acc); }
  .chat { display: flex; flex-direction: column; gap: 10px; margin: 6px 0 12px; }
  .msg { max-width: 88%; padding: 10px 13px; border-radius: 16px; font-size: 15px; line-height: 1.45; white-space: normal; word-wrap: break-word; }
  .msg.yo { align-self: flex-end; background: var(--pri); color: var(--on-pri); border-bottom-right-radius: 5px; }
  .msg.coach { align-self: flex-start; background: var(--card); border: 1px solid var(--line); border-bottom-left-radius: 5px; }
  .msg.err { border-color: var(--acc); color: var(--muted); }
  .msg.pensando span { display: inline-block; width: 7px; height: 7px; margin: 0 2px; border-radius: 50%; background: var(--muted); animation: bote 1.2s infinite; }
  .msg.pensando span:nth-child(2) { animation-delay: .15s; } .msg.pensando span:nth-child(3) { animation-delay: .3s; }
  @keyframes bote { 0%, 60%, 100% { opacity: .3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-4px); } }
  .sugs { display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 0 14px; }
  .sugs button { border: 1.5px solid var(--line); background: var(--card); border-radius: 99px; padding: 8px 12px; font-size: 13.5px; text-align: left; }
  .chatin { display: flex; gap: 8px; align-items: flex-end; }
  .chatin textarea { min-height: 46px; }
  @media (prefers-reduced-motion: no-preference) { ::view-transition-group(*) { animation-duration: .28s; } }
  /* v5.7: RIR en línea, pareja, técnica y video */
  .rirx { margin: -2px 0 10px; padding: 8px 10px; border-radius: 12px; background: var(--card2); }
  .rirx .q { font-size: 12.5px; color: var(--muted); margin-bottom: 6px; }
  .rirx .pills { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 0; }
  .rirx .pills button { padding: 9px 4px; font-size: 13px; }
  .rirx.pide { background: var(--acc-weak); }
  .rirx.pide .q { color: var(--text); font-weight: 700; }
  .vidbtn { border: 0; background: transparent; color: var(--muted); padding: 0 0 0 6px; vertical-align: -3px; }
  .vidbtn svg { width: 18px; height: 18px; }
  .vidbtn.tiene { color: var(--pri); }
  .media { position: relative; width: 100%; aspect-ratio: 16 / 9; border-radius: 14px; overflow: hidden; background: #000; margin: 10px 0 12px; }
  .media.vert { aspect-ratio: 9 / 16; height: 48vh; width: auto; margin-left: auto; margin-right: auto; }
  .media iframe, .media video { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
  .media.img { aspect-ratio: auto; background: transparent; }
  .media.img img { width: 100%; display: block; border-radius: 14px; }
  .tecnica { margin: 8px 0 12px; padding-left: 22px; font-size: 17px; line-height: 1.45; }
  .tecnica li { margin-bottom: 6px; }
  .medialink { display: flex; gap: 8px; margin-top: 14px; }
  .medialink input { flex: 1; min-width: 0; padding: 10px 12px; border: 1.5px solid var(--line); border-radius: 12px; background: var(--card2); color: var(--text); font-size: 14px; }
  .parbtn { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 10px; border: 1.5px solid var(--line); background: var(--card);
    color: var(--text); border-radius: 14px; padding: 11px 14px; margin: 0 0 10px; font-weight: 700; font-size: 14.5px; text-align: left; }
  .parbtn .sw { flex: none; width: 40px; height: 24px; border-radius: 99px; background: var(--line); position: relative; transition: background .2s; }
  .parbtn .sw::after { content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform .2s; }
  .parbtn.on { border-color: var(--pri); }
  .parbtn.on .sw { background: var(--pri); }
  .parbtn.on .sw::after { transform: translateX(16px); }
  .quien { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; background: var(--card2); padding: 4px; border-radius: 12px; margin-bottom: 12px; }
  .quien button { border: 0; background: transparent; border-radius: 9px; padding: 9px 6px; font-weight: 700; font-size: 14px; color: var(--muted); }
  .quien button.on { background: var(--pri); color: var(--on-pri); }
  /* v5.8: modalidad, menú ⋮, modo enfoque, video con respaldo, IA en contexto, animaciones */
  .mod { display: inline-block; font-size: 10.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--muted);
    border: 1px solid var(--line); border-radius: 6px; padding: 1px 6px; margin-right: 6px; vertical-align: 1px; }
  .menubtn { flex: none; width: 36px; height: 36px; border-radius: 50%; border: 0; background: transparent; color: var(--muted); font-size: 22px; line-height: 1; font-weight: 800; }
  .menubtn:active { background: var(--card2); }
  .menu { display: flex; flex-direction: column; margin-top: 10px; }
  .menu button { display: flex; gap: 14px; align-items: center; text-align: left; border: 0; background: transparent; color: var(--text); padding: 12px 4px; border-bottom: 1px solid var(--line); }
  .menu button:last-child { border-bottom: 0; }
  .menu .i { width: 28px; text-align: center; font-size: 19px; flex: none; }
  .menu small { display: block; color: var(--muted); font-size: 12.5px; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 70vw; }
  .set.hecho .chk { animation: none; }
  .set.recien .chk { animation: pop .28s ease; }
  .set { transition: opacity .3s ease, background-color .3s ease, box-shadow .3s ease; border-radius: 14px; }
  body.descansando .ex.open .set.hecho { opacity: .42; }
  body.descansando .ex.open .set:not(.hecho):not(.sig) { opacity: .6; }
  body.descansando .ex.open .set.sig { background: var(--pri-weak); box-shadow: 0 0 0 1.5px var(--pri); }
  body.descansando .ex.open .set.sig .tipo { color: var(--pri); }
  .ex-body.entra, .ia.entra, .foco.entra { animation: entra .24s ease-out; }
  @keyframes entra { from { opacity: 0; transform: translateY(-6px); } }
  .foco { display: flex; gap: 10px; align-items: flex-start; background: linear-gradient(135deg, var(--pri-weak), transparent); border: 1px solid var(--line);
    border-radius: 16px; padding: 12px 14px; margin: 0 0 12px; font-size: 14.5px; line-height: 1.4; }
  .foco .i { font-size: 18px; flex: none; }
  .tip.plan { background: var(--pri-weak); color: var(--text); }
  .brillo { background: linear-gradient(90deg, var(--card2) 0%, var(--line) 50%, var(--card2) 100%); background-size: 200% 100%; animation: brillo 1.3s linear infinite; border-radius: 8px; }
  @keyframes brillo { from { background-position: 200% 0; } to { background-position: -200% 0; } }
  .linea-esq { height: 12px; margin: 6px 0; }
  .media .thumb { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .media .play { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 64px; height: 64px; border-radius: 50%; border: 0;
    background: rgba(0, 0, 0, .55); color: #fff; display: grid; place-items: center; z-index: 2; }
  .media .play svg { width: 30px; height: 30px; margin-left: 3px; }
  .media .esq { position: absolute; inset: 0; display: grid; place-items: center; z-index: 1; }
  .media .esq .brillo { position: absolute; inset: 0; border-radius: 0; opacity: .9; }
  .media .esq span { position: relative; color: var(--muted); font-size: 13.5px; font-weight: 700; background: var(--card); padding: 6px 12px; border-radius: 99px; opacity: 0; transition: opacity .2s; }
  .media.lento .esq span, .media.falla .esq span { opacity: 1; }
  .media.falla .esq .brillo { animation: none; }
  .media.falla .play, .media.falla .thumb { display: none; }
  .media.ok .esq { display: none; }
  .media.img { min-height: 180px; position: relative; }
  .media.img.ok { min-height: 0; }
  .media.jugando .thumb, .media.jugando .play { display: none; }
  .mem { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 10px 14px; margin: 4px 0 12px; }
  .mem summary { font-weight: 700; list-style: none; }
  .mem ul { list-style: none; padding: 0; margin: 8px 0 4px; }
  .mem li { display: flex; gap: 8px; align-items: flex-start; padding: 7px 0; border-top: 1px solid var(--line); font-size: 14px; }
  .mem li span { flex: 1; }
  .mem li button { border: 0; background: transparent; color: var(--muted); font-size: 16px; padding: 0 4px; }
  .msg .aprendio { display: block; margin-top: 6px; font-size: 12.5px; color: var(--muted); }
  .debrief .sec2 { margin: 12px 0 0; }
  .debrief .sec2 b { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin-bottom: 3px; }
  .zbar { display: inline-block; flex: 1; height: 6px; border-radius: 99px; background: var(--line); overflow: hidden; min-width: 40px; vertical-align: middle; }
  .zbar.w { display: block; height: 8px; margin-top: 6px; } .zbar i { display: block; height: 100%; border-radius: 99px; }
  .region { margin-top: 10px; } .region > .muted { font-size: 12px; text-transform: uppercase; letter-spacing: .05em; font-weight: 700; margin-bottom: 4px; }
  .region button { display: flex; align-items: center; gap: 10px; width: 100%; border: 0; background: none; padding: 5px 2px; font-size: 13.5px; text-align: left; }
  .region button > span:first-child { width: 130px; flex-shrink: 0; } .region button .num { width: 44px; text-align: right; color: var(--muted); font-size: 12.5px; }
  .region button.on > span:first-child { font-weight: 700; }
  .accion { border-top: 1px solid var(--line); margin-top: 10px; padding-top: 10px; font-size: 14px; }
  .accion .btn.block { width: 100%; margin-top: 2px; } .accion .porque { font-size: 12.5px; margin: 6px 2px 0; }
  .accion .alts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .accion .alt { border: 1px solid var(--line); background: var(--card); color: var(--text); border-radius: 99px; padding: 6px 11px; font-size: 13px; }
  .aviso2 { background: var(--acc-weak); border-radius: 10px; padding: 8px 10px; font-size: 13px; margin-bottom: 8px; }
  .falta { font-size: 13.5px; margin-top: 8px; } .falta .link { font-size: 13.5px; padding: 0; }
  .mchips button.on { border-color: var(--pri); }
  .regiones { display: grid; gap: 8px; margin: 8px 0; } .regiones > div > .muted { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
  .musbtn { display: block; width: 100%; margin: 14px 0 0; padding: 14px; border: 1.5px dashed var(--line); border-radius: 16px; background: none; font-weight: 700; text-align: left; }
  .musbtn span { display: block; font-weight: 400; color: var(--muted); font-size: 13.5px; }
  .discos { margin: -4px 2px 10px; font-size: 13px; color: var(--muted); }
  .saltar { text-align: right; margin: -6px 2px 8px; font-size: 13px; }
  .saltar .link { color: var(--muted); }
  .mapa { display: flex; justify-content: space-between; gap: 10px; align-items: center; background: var(--card2); border-radius: 12px; padding: 9px 12px; margin: -4px 0 12px; font-size: 13.5px; }
  .cquien { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; background: var(--card2); padding: 4px; border-radius: 12px; margin: 8px 0 10px; }
  .cquien button { border: 0; background: transparent; border-radius: 9px; padding: 9px 4px; font-weight: 700; font-size: 13.5px; color: var(--muted); }
  .cquien button.on { background: var(--pri); color: var(--on-pri); }
  /* v5.9: trote, check-in, mapa muscular y dictado */
  .polar { height: 14px; border-radius: 99px; background: var(--card2); overflow: hidden; display: flex; position: relative; margin: 10px 0 6px; }
  .polar .f { background: var(--ok); } .polar .i { background: var(--acc); }
  .polar .meta { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--text); opacity: .7; left: 80%; }
  .leyenda { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12.5px; color: var(--muted); }
  .leyenda i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }
  .cap { display: flex; gap: 10px; align-items: center; justify-content: center; width: 100%; border: 1.5px dashed var(--pri); background: var(--pri-weak); color: var(--text);
    border-radius: 14px; padding: 12px; font-weight: 700; margin-bottom: 12px; }
  .datos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 10px 0; }
  .datos div { background: var(--card2); border-radius: 12px; padding: 8px; text-align: center; }
  .datos b { display: block; font-size: 18px; } .datos span { font-size: 11.5px; color: var(--muted); }
  .zonas { display: flex; height: 10px; border-radius: 99px; overflow: hidden; margin: 6px 0 2px; }
  .zonas div:nth-child(1) { background: #60A5FA; } .zonas div:nth-child(2) { background: #34D399; } .zonas div:nth-child(3) { background: #FBBF24; }
  .zonas div:nth-child(4) { background: #FB923C; } .zonas div:nth-child(5) { background: #EF4444; }
  .ready .fila { margin-top: 10px; } .ready .fila .muted { font-size: 13px; margin-bottom: 4px; }
  .ready .pills { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 0; }
  .ready .pills button { padding: 10px 4px; }
  .cuerpo { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin: 6px 0 2px; }
  .cuerpo svg { width: 100%; max-height: 380px; }
  .cuerpo { --sil: #ECE8F4; --silb: #CFC8DC; --nzc: #DDD7E8; --z0: #C4BCD4; }
  @media (prefers-color-scheme: dark) { .cuerpo { --sil: #262230; --silb: #3A3546; --nzc: #322D3D; --z0: #4A4458; } }
  .cuerpo .sil { fill: var(--sil); } .cuerpo .sil.borde { stroke: var(--silb); stroke-width: 2; }
  .cuerpo .nz { fill: var(--nzc); stroke: var(--card); stroke-width: 1.1; }
  .cuerpo [data-m] { stroke: var(--card); stroke-width: 1.1; stroke-linejoin: round; cursor: pointer; transition: fill .45s ease, fill-opacity .45s ease; }
  .cuerpo [data-m]:active { opacity: .75; }
  .cuerpo .fib { fill: none; stroke: var(--card); stroke-width: .7; opacity: .55; pointer-events: none; }
  .mz0 { fill: var(--z0); } .mz1 { fill: var(--acc); fill-opacity: .9; } .mz2 { fill: var(--ok); fill-opacity: .9; } .mz3 { fill: var(--bad); }
  .cuerpo .sel { stroke: var(--text) !important; stroke-width: 2 !important; }
  .cuerpo text { fill: var(--muted); font-size: 10px; text-anchor: middle; font-weight: 700; letter-spacing: .06em; }
  .semana { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 6px; }
  .semana .dia { font-weight: 700; font-size: 14px; min-height: 18px; }
  .semana .btn { white-space: nowrap; flex-shrink: 0; }
  .msel { background: var(--card2); border-radius: 12px; padding: 10px 12px; margin-top: 8px; font-size: 14px; }
  .mchips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .mchips button { border: 1px solid var(--line); background: var(--card); color: var(--text); border-radius: 99px; padding: 5px 10px; font-size: 12.5px; }
  .mchips button i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
  .mic { flex: none; width: 52px; height: 52px; border-radius: 50%; border: 0; background: var(--pri-weak); color: var(--pri); display: grid; place-items: center; }
  .mic svg { width: 24px; height: 24px; }
  .mic.oye { background: var(--bad); color: #fff; animation: oye 1.1s ease-in-out infinite; }
  @keyframes oye { 0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, .45); } 50% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } }
  .fila-ia { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
  .fila-ia .btn { flex: 1; }
  @media (prefers-reduced-motion: reduce) { .entra, .set.recien .chk, .brillo, .mic.oye { animation: none !important; } .set { transition: none; } }
`;

// v7: diseño nuevo (paleta de las capturas, tarjetas con profundidad, barra con Entrenar al centro).
// Va después de CSS_V53 para ganarle a los estilos anteriores sin tener que tocarlos uno por uno.
const CSS_V7 = `
  /* Acento de la rutina elegida: chips, botón central y botones principales */
  :root { --rut: var(--pri); --rut-g: var(--g-pri); --rut-weak: var(--pri-weak); }
  body[data-rut=Push] { --rut: var(--acc); --rut-g: var(--g-acc); --rut-weak: var(--acc-weak); }
  body[data-rut=Pull] { --rut: var(--cyan); --rut-g: var(--g-cg); --rut-weak: var(--cyan-weak); }
  body[data-rut=Core] { --rut: var(--ok); --rut-g: linear-gradient(90deg, #22C55E, var(--ok)); --rut-weak: var(--ok-weak); }
  body[data-rut=Trote] { --rut: var(--red); --rut-g: var(--g-red); --rut-weak: var(--red-weak); }

  /* Encabezado */
  .top { margin-top: 8px; }
  /* GYM MB: "MB" toma el color de la sección (Entrenar rojo, Comida ámbar, Progreso cian-verde, Músculos verde, Coach morado) */
  :root { --marca: var(--g-red); }
  body[data-tab=Comida] { --marca: linear-gradient(90deg, var(--acc), #FACC15); }
  body[data-tab=Progreso] { --marca: var(--g-cg); }
  body[data-tab=Musculos] { --marca: linear-gradient(90deg, var(--ok), #A3E635); }
  body[data-tab=Coach] { --marca: var(--g-pri); }
  .brand { font-size: 25px; font-weight: 900; letter-spacing: -.01em; }
  .brand span { background: var(--marca); -webkit-background-clip: text; background-clip: text; color: transparent; padding-right: 2px; }
  .sync { font-weight: 700; padding: 5px 11px; }
  .sync.ok { border: 1px solid color-mix(in srgb, var(--ok) 35%, transparent); }
  .gear { width: 38px; height: 38px; border-radius: 50%; background: transparent; border: 1px solid var(--line); }
  .sub { font-size: 13.5px; }
  .sub .link { color: var(--cyan) !important; }

  /* Tarjetas con profundidad sutil */
  .card, .ex, .kpi, .med, .mem, .parbtn { border-radius: 20px; box-shadow: var(--shadow); }
  .card { padding: 18px; }
  h2 { letter-spacing: .1em; font-size: 11.5px; margin-top: 22px; }
  .t2 { letter-spacing: -.02em; }

  /* Botones: los principales con degradado y brillo */
  .btn { background: var(--g-pri); color: #fff; box-shadow: 0 8px 22px -8px var(--glow); letter-spacing: -.01em; }
  .btn.ghost { box-shadow: none; }
  .btn.acc { background: var(--g-acc); color: var(--on-acc); }
  .btn.verde { background: color-mix(in srgb, var(--ok) 14%, transparent); color: var(--ok); border: 1px solid color-mix(in srgb, var(--ok) 45%, transparent); box-shadow: none; }
  .btn:active { transform: scale(.98); }
  #vEntrenar .ex-body .acts .btn:not(.ghost), #vEntrenar .card.trote > .btn.block { background: var(--rut-g); box-shadow: 0 10px 26px -10px var(--rut); }
  .link { color: var(--pri); }

  /* Buscador con lupa */
  .buscar { border-radius: 16px; padding-left: 42px; border-width: 1px; background: var(--card) no-repeat 14px center / 18px
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238A84A0' stroke-width='2.2' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='M20 20l-3.5-3.5'/%3E%3C/svg%3E"); }
  #troteNotas { padding-left: 14px; background-image: none; }

  /* Entrenar con pareja */
  .parbtn { border-width: 1px; padding: 14px 16px; }
  .parbtn .sw { width: 50px; height: 30px; } .parbtn .sw::after { width: 24px; height: 24px; }
  .parbtn.on .sw::after { transform: translateX(20px); }

  /* Chips de rutina: cada una con su color; Trote activo en degradado rojo */
  .chips { gap: 9px; padding: 2px 0 8px; }
  .chip { --c: var(--pri); border-radius: 14px; border: 1.5px solid color-mix(in srgb, var(--c) 45%, transparent); color: var(--c); background: var(--card);
    font-weight: 700; padding: 9px 18px; display: inline-flex; align-items: center; gap: 6px; }
  .chip .icon { width: 16px; height: 16px; }
  .chip.r-Push { --c: var(--acc); } .chip.r-Pull { --c: var(--cyan); } .chip.r-Legs { --c: var(--pri); } .chip.r-Core { --c: var(--ok); } .chip.r-Trote { --c: var(--red); }
  .chip.on { background: color-mix(in srgb, var(--c) 16%, transparent); border-color: var(--c); color: var(--c); box-shadow: 0 0 0 3px color-mix(in srgb, var(--c) 14%, transparent); }
  .chip.r-Trote.on { background: var(--g-red); color: #fff; border-color: transparent; box-shadow: 0 8px 20px -8px var(--red); }
  .chip .dot { background: var(--c); margin-left: 2px; }
  .chip.on .dot { background: currentColor; }

  /* Tarjeta de ejercicio */
  .ex { border-width: 1px; }
  .ex.open { border-color: color-mix(in srgb, var(--rut) 70%, transparent); box-shadow: 0 0 0 1px color-mix(in srgb, var(--rut) 35%, transparent), 0 14px 34px -14px var(--rut); }
  .ex-ico { background: var(--rut-weak); color: var(--rut); border-radius: 12px; }
  .ex.done .ex-ico { background: var(--ok-weak); color: var(--ok); }
  .ex-name { font-size: 16px; letter-spacing: -.01em; }
  .mod { color: var(--rut); border-color: color-mix(in srgb, var(--rut) 40%, transparent); background: color-mix(in srgb, var(--rut) 10%, transparent); border-radius: 7px; }
  .unit { border-width: 1px; border-radius: 12px; background: var(--card2); }
  .unit button.on { background: var(--rut); color: var(--on-pri); border-radius: 9px; }
  .tip { border-radius: 14px; }
  .tip.plan, .foco { background: color-mix(in srgb, var(--acc) 9%, var(--card)); border: 1px solid color-mix(in srgb, var(--acc) 40%, transparent); }

  /* Series: la marcada se pone verde */
  .val, .chk { border-width: 1px; border-radius: 14px; }
  .set.hecho { background: color-mix(in srgb, var(--ok) 7%, transparent); box-shadow: 0 0 0 1px color-mix(in srgb, var(--ok) 30%, transparent); }
  .set.hecho .val { background: transparent; border-color: color-mix(in srgb, var(--ok) 25%, transparent); }
  .set.hecho .chk { background: var(--ok); border-color: var(--ok); color: #0E0C14; }
  .sets-h { letter-spacing: .08em; }

  /* Barra de sesión arriba */
  .sesbar { background: var(--rut-g); box-shadow: 0 10px 26px -10px var(--rut); }

  /* Plan de carrera */
  .plan5k { background: radial-gradient(120% 90% at 0% 0%, color-mix(in srgb, var(--red) 10%, var(--card)) 0%, var(--card) 60%);
    border-color: color-mix(in srgb, var(--red) 35%, transparent); }
  .plan5k .count { font-size: 54px; letter-spacing: -.05em; }
  .plan5k .count span { font-size: 20px; font-weight: 800; letter-spacing: -.02em; margin-left: 4px; }
  .pseslist { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; }
  .pses { border: 1px solid var(--line); border-radius: 16px; padding: 12px 14px; background: color-mix(in srgb, var(--bg) 45%, transparent); }
  .pses:first-of-type { border-top: 1px solid var(--line); }
  .pses .ck { border-radius: 50%; }
  .pses.ok { border-color: color-mix(in srgb, var(--ok) 50%, transparent); background: color-mix(in srgb, var(--ok) 8%, transparent); }
  .pses.ok .t1 { text-decoration: none; opacity: 1; }
  .pses .ritmo { color: var(--muted); font-weight: 600; font-size: 13px; }
  .pses .estado { font-size: 13px; color: var(--muted); font-weight: 600; }
  .pses.ok .estado { color: var(--ok); }
  .minbar { height: 4px; border-radius: 9px; background: var(--card2); overflow: hidden; margin-top: 8px; }
  .minbar div { height: 100%; background: var(--g-red); border-radius: 9px; }

  /* Registrar trote */
  .card.trote .cap-t { font-size: 12px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
  .card.trote .sincro { font-size: 12.5px; font-weight: 700; color: var(--cyan); }
  .cap { border: 0; background: var(--g-pri); color: #fff; box-shadow: 0 10px 24px -10px var(--pri); }
  .cap .icon { width: 18px; height: 18px; }
  .datos3 > div { background: var(--card2); border: 1px solid var(--line); border-radius: 16px; padding: 10px 12px; }
  .datos3 > div > .muted { font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
  .datos3 .val { border: 0; background: transparent; text-align: left; padding: 0; height: 38px; font-size: 24px; }
  .datos3 .val.vacio { font-size: 15px; }
  .card.trote .pills button.on, body[data-rut=Trote] .pills button.on { background: var(--cyan); border-color: var(--cyan); color: #0E0C14; }
  .card.trote .pills button { border-color: color-mix(in srgb, var(--cyan) 35%, transparent); }
  .medal.int { background: var(--red-weak); color: var(--red); } .medal.fac { background: var(--cyan-weak); color: var(--cyan); }
  .rojo { color: var(--red); } .cian { color: var(--cyan); }
  .polar .f { background: var(--cyan); }
  #vEntrenar .minis .kpi:nth-child(2) .v { color: var(--cyan); }

  /* Comida */
  .protcard .ventana { font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--ok); margin-bottom: 2px; }
  .protcard .pill .icon { width: 13px; height: 13px; }
  .ring { width: 200px; height: 200px; margin: 18px auto 14px; border: 0; background: none; padding: 0; color: inherit; }
  .ring .lbl { font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
  .ring .v { font-size: 46px; letter-spacing: -.04em; line-height: 1.05; }
  .ring .v small { font-size: 20px; color: var(--muted); font-weight: 700; }
  .protcard .falta { margin-top: 2px; }
  .pill.prio { background: var(--red); color: #fff; text-transform: uppercase; letter-spacing: .06em; font-size: 10.5px; }
  .consejo { margin-top: 10px; padding: 10px 12px; border-radius: 14px; background: color-mix(in srgb, var(--acc) 9%, transparent); color: var(--muted); font-size: 13.5px; }
  .iacard { border-color: color-mix(in srgb, var(--pri) 40%, transparent); }
  .iacard .btn { background: var(--g-cg); color: var(--on-cg); box-shadow: 0 10px 24px -10px var(--cyan); }
  .tipico { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; padding: 16px; margin: 0 0 6px; border-radius: 20px; font: inherit; color: var(--text);
    border: 1px solid color-mix(in srgb, var(--pri) 45%, transparent); background: color-mix(in srgb, var(--pri) 8%, var(--card)); }
  .tipico .ic { font-size: 24px; } .tipico b { font-size: 16px; } .tipico small { display: block; color: var(--muted); font-size: 13px; margin-top: 3px; }
  .tipico .mas, .food .mas { color: var(--pri); font-size: 22px; font-weight: 700; }
  .rapido { font-size: 12px; font-weight: 700; color: var(--ok); }
  .row:has(> h2) { align-items: baseline; }
  .foods { gap: 9px; }
  .food { border-width: 1px; border-radius: 16px; padding: 12px; min-height: 84px; display: flex; flex-direction: column; gap: 8px; box-shadow: var(--shadow); }
  .food .ic { font-size: 20px; line-height: 1; }
  .food b { position: absolute; top: 10px; right: 10px; color: var(--ok); background: color-mix(in srgb, var(--ok) 13%, transparent); border-radius: 99px; padding: 2px 8px; font-size: 12.5px; }
  .food .nom { font-size: 14px; line-height: 1.3; }
  .food .c { top: auto; bottom: 8px; color: var(--acc); }
  .foods.tops { grid-template-columns: 1fr; }
  .foods.tops .food { flex-direction: row; align-items: center; min-height: 0; gap: 12px; }
  .foods.tops .food b { position: static; order: 3; }
  .foods.tops .food .nom { flex: 1; font-weight: 700; }
  .foods.tops .food .ic { width: 36px; height: 36px; border-radius: 12px; display: grid; place-items: center; background: var(--acc-weak); order: 0; }
  .foods.tops .food .mas { order: 4; color: var(--muted); }
  .foods.tops .food .c { position: static; order: 2; }
  .food.top { border-color: var(--line); background: var(--card); }
  .eaten button { background: var(--card); border: 1px solid var(--line); }

  /* Progreso: pestañas con punto de color */
  .seg { background: var(--card); border-radius: 16px; padding: 5px; }
  .seg button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid transparent; }
  .seg.s4 button::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--c, var(--pri)); }
  .seg.s4 button:nth-child(1) { --c: var(--pri); } .seg.s4 button:nth-child(2) { --c: var(--cyan); }
  .seg.s4 button:nth-child(3) { --c: var(--ok); } .seg.s4 button:nth-child(4) { --c: var(--acc); }
  .seg button.on { background: color-mix(in srgb, var(--c, var(--pri)) 14%, transparent); border-color: color-mix(in srgb, var(--c, var(--pri)) 60%, transparent); color: var(--text); box-shadow: none; }
  .week i { border-radius: 11px; width: 36px; height: 36px; border-width: 1px; }
  .week .y i { background: var(--g-pri); border: 0; box-shadow: 0 6px 14px -6px var(--pri); }
  .medal { border-radius: 12px; }
  .kpi .v { font-size: 28px; }
  .metabar div { background: var(--g-cg); }
  .chart .grid { stroke-dasharray: 3 5; }
  .legend i { background: var(--cyan); }
  select { border-width: 1px; border-radius: 14px; }
  .desglose .b div { background: var(--g-pri); }
  .pts b { color: var(--text); font-size: 48px; } .pts span { color: var(--acc); font-weight: 800; }
  .med { border-radius: 16px; } .med:not(.no) { border-color: color-mix(in srgb, var(--acc) 45%, transparent); background: color-mix(in srgb, var(--acc) 7%, var(--card)); }
  .med .mb div { background: var(--g-pri); }
  .mz1 { fill: var(--acc); } .mz2 { fill: var(--ok); } .mz3 { fill: var(--red); }

  /* Coach: el nombre se queda arriba y la caja de texto abajo, como en una app de mensajes */
  body[data-tab=Coach] .top { position: sticky; top: var(--sat); z-index: 16; background: var(--bg); margin: 0 -16px; padding: 8px 16px;
    box-shadow: 0 calc(-1 * var(--sat)) 0 var(--bg), 0 12px 16px -14px rgba(0, 0, 0, .5); }
  body[data-tab=Coach] .chatin { position: sticky; bottom: calc(var(--nav-h) + var(--sab) + 6px); z-index: 14; background: var(--bg); padding: 8px 0; }
  .chatmas { display: block; width: 100%; border: 1px dashed var(--line); background: none; color: var(--muted); border-radius: 14px; padding: 9px; margin: 4px 0 10px; font-size: 13.5px; font-weight: 600; }
  .chat.anterior { opacity: .6; border-bottom: 1px solid var(--line); padding-bottom: 12px; }
  /* Músculos de hoy */
  .hoycard .cuerpo { margin-top: 10px; }
  .zfila { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-top: 1px solid var(--line); }
  .zfila:first-child { border-top: 0; padding-top: 2px; }
  .zfila .zt { flex: 1; min-width: 0; }
  .zfila .btn { flex: none; white-space: nowrap; }
  .zfila .cnt { white-space: nowrap; font-size: 13px; } .zfila .ej { font-size: 12.5px; margin-top: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* Interruptores */
  .tog { background: var(--line); }
  .tog.on { background: var(--pri); box-shadow: 0 0 0 3px color-mix(in srgb, var(--pri) 18%, transparent); }

  /* Ventanas (hojas) */
  .modal { backdrop-filter: blur(3px); }
  .sheet { border-radius: 28px 28px 0 0; border-top: 1px solid var(--line); }
  .sheet:not(.completa)::before { content: ''; display: block; width: 40px; height: 4px; border-radius: 9px; background: var(--line); margin: -10px auto 12px; }

  /* Ajustes a pantalla completa */
  .modal.completa { align-items: stretch; background: var(--bg); backdrop-filter: none; }
  .sheet.completa { max-width: 560px; max-height: none; height: 100%; border-radius: 0; border: 0; background: var(--bg);
    padding: calc(14px + var(--sat)) 16px calc(28px + var(--sab)); animation: entraLado .22s ease-out; }
  @keyframes entraLado { from { transform: translateY(16px); opacity: 0; } }
  .ajhead { margin-bottom: 14px; } .ajhead .t2 { font-size: 26px; }
  .cerrar { width: 38px; height: 38px; border-radius: 50%; border: 0; background: var(--card2); color: var(--muted); font-size: 15px; font-weight: 800; }
  .completa .opt { border-top: 1px solid var(--line); padding: 18px 0; }
  .completa .opt.tarj { background: var(--card); border: 1px solid var(--line); border-radius: 20px; padding: 14px; margin-bottom: 10px; box-shadow: var(--shadow); }
  .completa .opt.tarj + .opt:not(.tarj) { border-top: 0; margin-top: 6px; }
  .aic { --c: var(--pri); flex: none; width: 42px; height: 42px; border-radius: 13px; display: grid; place-items: center; color: var(--c);
    background: color-mix(in srgb, var(--c) 12%, transparent); border: 1px solid color-mix(in srgb, var(--c) 35%, transparent); }
  .aic svg { width: 20px; height: 20px; }
  .asec { display: flex; align-items: center; gap: 8px; font-size: 15.5px; margin-bottom: 6px; }
  .asec svg { width: 19px; height: 19px; display: block; }
  .completa .pills button { border-width: 1px; border-radius: 12px; padding: 12px 6px; font-weight: 700; background: var(--card2); }
  .pills.c-cyan button.on { background: linear-gradient(135deg, #06B6D4, #22D3EE); border-color: transparent; color: #0E0C14; }
  .pills.c-pri button.on { background: var(--g-pri); border-color: transparent; color: #fff; }
  .pills.c-red button.on { background: var(--g-red); border-color: transparent; color: #fff; }
  .unit.paso { border: 0; background: transparent; gap: 6px; overflow: visible; }
  .unit.paso button { min-width: 40px; height: 40px; padding: 0 8px; border-radius: 99px; border: 1px solid var(--line); background: var(--card2); color: var(--muted); }
  .unit.paso button.on { min-width: 76px; color: #0E0C14; border: 0; background: var(--ok); }
  .unit.paso.c-cyan button.on { background: var(--cyan); }
  .dias { gap: 8px; } .dias button { border-width: 1px; border-radius: 12px; padding: 11px 0; }
  .dias button.on { background: var(--g-pri); border-color: transparent; color: #fff; }
  .completa input[type=date] { background: var(--card); border: 1px solid color-mix(in srgb, var(--red) 35%, transparent); border-radius: 16px; padding: 14px 16px; font-weight: 700; letter-spacing: .05em; }
  .hoja { display: flex !important; align-items: center; justify-content: center; gap: 10px; text-decoration: none; margin-top: 8px; padding: 16px; border-radius: 18px; }
  .hoja svg { width: 20px; height: 20px; color: var(--ok); }

  /* Barra inferior: Entrenar al centro, más grande y con el color de la rutina */
  .nav { background: color-mix(in srgb, var(--card) 94%, transparent); backdrop-filter: saturate(1.4) blur(16px); -webkit-backdrop-filter: saturate(1.4) blur(16px); }
  .nav .in2 { align-items: stretch; }
  .nav button { position: relative; font-size: 11.5px; font-weight: 700; letter-spacing: .01em; }
  #nComida { order: 1; } #nProgreso { order: 2; } #nEntrenar { order: 3; } #nMusculos { order: 4; } #nCoach { order: 5; }
  .nav button.on::before { content: ''; position: absolute; top: 0; left: 50%; width: 26px; height: 3px; margin-left: -13px; border-radius: 0 0 4px 4px; background: currentColor; }
  #nEntrenar::before { display: none; }
  #nEntrenar .bola { display: grid; place-items: center; width: 58px; height: 58px; margin-top: -26px; border-radius: 20px; color: #fff; background: var(--rut-g);
    box-shadow: 0 0 0 5px var(--bg), 0 12px 26px -8px var(--rut); transition: transform .2s ease, filter .2s ease; }
  #nEntrenar .bola .icon { width: 28px; height: 28px; }
  #nEntrenar:not(.on) .bola { filter: saturate(.75) brightness(.92); }
  #nEntrenar.on { color: var(--rut); }
  #nEntrenar:active .bola { transform: scale(.94); }
`;
/* v7.2: ruta de hoy, cambio de equipo, avisos */
const CSS_V72 = `
  .equipo { margin-left: 6px; padding: 2px 8px; border-radius: 7px; border: 1px solid color-mix(in srgb, var(--rut) 45%, transparent);
            background: color-mix(in srgb, var(--rut) 12%, transparent); color: var(--rut); font-size: 10.5px; font-weight: 800; letter-spacing: .05em; vertical-align: 1px; }
  .lista.vars button { border-color: color-mix(in srgb, var(--rut) 35%, var(--line)); }
  .lista.vars .mod { margin-right: 6px; }
  #kpSheet .anota { color: var(--text); font-weight: 800; }
  .ia.pide { border-left-style: dashed; color: var(--muted); }
  .protocolo { margin-top: 10px; padding: 9px 12px; border-radius: 12px; background: color-mix(in srgb, var(--cyan) 9%, transparent); font-size: 13px; color: var(--muted); line-height: 1.45; }
  .protocolo b { color: var(--text); font-weight: 700; }
  .ruta.card { border-color: color-mix(in srgb, var(--ok) 35%, var(--line)); background: linear-gradient(160deg, color-mix(in srgb, var(--ok) 8%, var(--card)), var(--card)); }
  .ruta .msg { margin: 6px 0 10px; font-size: 15px; line-height: 1.4; }
  .ruta ol { list-style: none; margin: 0 0 12px; padding: 0; display: grid; gap: 6px; }
  .ruta li button { width: 100%; display: flex; align-items: center; gap: 10px; text-align: left; padding: 10px 12px; border-radius: 14px; border: 1px solid var(--line); background: var(--card2); color: var(--text); }
  .ruta li b { display: block; font-size: 14.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ruta li small { display: block; color: var(--muted); font-size: 12.5px; margin-top: 2px; }
  .ruta li .n { flex: none; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: 13px;
                background: color-mix(in srgb, var(--ok) 18%, transparent); color: var(--ok); }
  .ruta.corta { display: flex; gap: 10px; align-items: center; padding: 10px 14px; margin: 0 0 12px; border-radius: 14px; border: 1px solid var(--line);
                background: color-mix(in srgb, var(--ok) 7%, transparent); font-size: 14px; }
  .ruta.corta .i { font-size: 17px; }
  .tip.baja { background: color-mix(in srgb, var(--cyan) 10%, var(--card2)); }
  .aviso-script { border-color: color-mix(in srgb, var(--acc) 45%, var(--line)); }
  .tipico-ed { display: block; margin: -4px 2px 14px; font-size: 13.5px; }
  .tipico-lista { display: grid; gap: 6px; max-height: 52vh; overflow: auto; margin: 0 -4px; padding: 0 4px; }
  .tipico-lista .tl { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 14px; border: 1px solid var(--line); background: var(--card2); }
  .tipico-lista .tl.on { border-color: color-mix(in srgb, var(--ok) 45%, var(--line)); }
  .tipico-lista .ic { font-size: 20px; } .tipico-lista .nm { flex: 1; min-width: 0; font-size: 14px; }
  .tipico-lista .nm small { display: block; color: var(--muted); font-size: 12px; }
  .tipico-lista b { min-width: 18px; text-align: center; }
  .tipico-lista button.mini { border: 1.5px solid var(--line); background: var(--card); color: var(--text); border-radius: 10px; width: 34px; height: 34px; font-weight: 800; font-size: 17px; }
  .tipico-lista button.mini:disabled { opacity: .35; }
  .prot6 .botones { display: flex; gap: 8px; } .prot6 .botones .btn { flex: 1; padding-left: 8px; padding-right: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .prot6 .botones .ghost { flex: none; }
  .prot6 { border-color: color-mix(in srgb, var(--acc) 40%, var(--line)); background: linear-gradient(160deg, color-mix(in srgb, var(--acc) 9%, var(--card)), var(--card)); }
  .descarga { border-color: color-mix(in srgb, var(--red) 35%, var(--line)); }
  .btn.reporte { margin-top: 12px; letter-spacing: .04em; font-weight: 800; }
`;
/* v8: rediseño "pizarra del gym". Una sola familia (Archivo): normal para leer, angosta y gruesa para los números.
   Colores sólidos (sin degradados), cada grupo con el color de su disco, etiquetas en minúsculas.
   Lo único que se mueve solo es el disco nuevo en la barra de Entrenar. */
const CSS_V8 = `
  :root { --g-pri: var(--pri); --g-cg: var(--cyan); --g-acc: var(--acc); --g-red: var(--red); --glow: transparent; }
  body[data-rut=Legs] { --rut: var(--leg); --rut-g: var(--leg); --rut-weak: var(--leg-weak); }
  body[data-rut=Core] { --rut-g: var(--ok); }
  .chip.r-Legs { --c: var(--leg); }
  /* Números: angostos, gruesos y alineados (peso, reps, gramos, km) */
  .num, .val, .pts b, .v.num, .count { font-stretch: 78%; font-variant-numeric: tabular-nums; }
  .val { font-size: 26px; font-weight: 750; letter-spacing: -.01em; }
  .t2, .brand { font-stretch: 88%; letter-spacing: -.015em; }
  /* Etiquetas en minúsculas, sin espaciado de anuncio */
  h2, details.sec > summary, .sets-h, .mod, .equipo, .card.trote .cap-t, .datos3 > div > .muted, .protcard .ventana, .ring .lbl,
  .pill.prio, .debrief .sec2 b, .region > .muted, .regiones > div > .muted, .diag .dh { text-transform: none; letter-spacing: normal; }
  h2, details.sec > summary { font-size: 15px; font-weight: 650; color: var(--text); margin: 24px 2px 10px; }
  details.sec > summary { color: var(--muted); }
  .sets-h { font-size: 12.5px; font-weight: 600; }
  .mod, .equipo { font-size: 12px; font-weight: 650; }
  .ex.open .ex-head .mod { display: none; }   /* el equipo ya se ve (y se cambia) dentro de la tarjeta */
  /* Botones de acción: color sólido del grupo, sin brillo */
  .btn { background: var(--pri); box-shadow: none; }
  #vEntrenar .ex-body .acts .btn:not(.ghost), #vEntrenar .card.trote > .btn.block { background: var(--rut); color: var(--on-rut); box-shadow: none; }
  .sesbar { background: var(--rut); color: var(--on-rut); box-shadow: none; }
  .sesbar .btn { background: color-mix(in srgb, var(--on-rut) 16%, transparent); color: var(--on-rut); }
  #nEntrenar .bola { background: var(--rut); color: var(--on-rut); box-shadow: 0 0 0 5px var(--bg); }
  .ex.open { box-shadow: none; border-color: color-mix(in srgb, var(--rut) 60%, var(--line)); }
  .week .y i, .week div.y i { background: var(--pri); box-shadow: none; }
  :focus-visible { outline: 2px solid var(--rut, var(--pri)); outline-offset: 2px; }

  .sheet .pendiente .card { margin: 0; border: 0; padding: 0; background: transparent; box-shadow: none; }
  .pesohdr { margin-left: 6px; padding: 2px 10px; border-radius: 999px; background: var(--card2); color: var(--text); font: inherit; font-weight: 650;
             font-stretch: 80%; font-variant-numeric: tabular-nums; border: 0; }
  .ring .v { font-stretch: 72%; }
  /* v8.1 — Hoy compacto: grupo a la izquierda, avance a la derecha y el rack debajo */
  .hoy { margin: 0 0 12px; }
  .hoy .grupo { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
  .hoy .grupo b { font-size: 54px; line-height: .86; font-weight: 850; font-stretch: 70%; letter-spacing: -.02em; color: var(--rut); }
  .hoy .grupo span { color: var(--muted); font-size: 13.5px; text-align: right; line-height: 1.25; }
  .hoy .grupo span strong { display: block; color: var(--text); font-size: 20px; font-weight: 750; font-stretch: 78%; font-variant-numeric: tabular-nums; }
  .rack { display: block; height: auto; max-width: 100%; margin-top: 10px; overflow: visible; }
  .rack .repisa { fill: var(--line); }
  .rack .mancuerna rect { fill: var(--rut); }
  .rack .falta rect { fill: color-mix(in srgb, var(--rut) 8%, transparent); stroke: color-mix(in srgb, var(--rut) 65%, var(--line)); stroke-width: 1.3; stroke-dasharray: 3 2.5; }
  @media (prefers-reduced-motion: no-preference) {
    .rack .mancuerna.entra { animation: cae .55s cubic-bezier(.3, 1.4, .5, 1) both; transform-box: fill-box; transform-origin: 50% 100%; }
    @keyframes cae { from { transform: translateY(-16px); opacity: 0; } 50% { opacity: 1; } to { transform: none; } }
    ::view-transition-group(*) { animation-duration: .38s; animation-timing-function: cubic-bezier(.2, .8, .2, 1); }
  }
  /* Tu día en mosaicos chicos, sin borde: estado, no botones de grupo */
  .mosaicos { display: flex; gap: 8px; overflow-x: auto; margin: 0 -16px 12px; padding: 0 16px 2px; scrollbar-width: none; }
  .mosaicos::-webkit-scrollbar { display: none; }
  .mosaicos button { flex: 1 0 calc((100% - 16px) / 3); min-width: 0; position: relative; display: flex; flex-direction: column; gap: 1px; text-align: left;
                     border: 0; border-radius: 14px; background: var(--card); color: var(--text); padding: 9px 12px 13px; overflow: hidden; }
  .mosaicos .et { font-size: 12px; font-weight: 600; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mosaicos .v { font-size: 14px; font-weight: 600; font-stretch: 85%; white-space: nowrap; }
  .mosaicos .v b { font-size: 19px; font-weight: 750; }
  .mosaicos button.ojo .et::after { content: ''; display: inline-block; width: 6px; height: 6px; margin-left: 6px; border-radius: 50%; background: var(--acc); vertical-align: 2px; }
  .mosaicos i { position: absolute; left: 12px; right: 12px; bottom: 6px; height: 3px; border-radius: 2px; background: var(--card2); }
  .mosaicos i::after { content: ''; display: block; width: var(--p); height: 100%; border-radius: inherit; background: var(--rut, var(--pri)); }
  body[data-tab=Entrenar] .pesohdr { display: none; }
  /* Buscador: una lupa al inicio de la fila de grupos */
  .chip.lupa { --c: var(--muted); padding: 9px 13px; }
  .chip.lupa .icon { width: 18px; height: 18px; }
  .buscarfila { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .buscarfila .buscar { flex: 1; margin: 0; }
  h2.conboton { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
  h2.conboton .link { font-size: 14px; }
  /* Series: la hecha se rellena del color del grupo y se apaga; la que sigue lleva una raya a la izquierda */
  .set.hecho { background: color-mix(in srgb, var(--rut) 8%, transparent); box-shadow: none; }
  .set.hecho .val, .set.hecho .ant, .set.hecho .tipo { opacity: .55; }
  .set.hecho .val { background: transparent; border-color: transparent; }
  .set.hecho .chk { background: var(--rut); border-color: var(--rut); color: var(--on-rut); }
  .ex.open .set.sig, body.descansando .ex.open .set.sig { background: color-mix(in srgb, var(--rut) 6%, transparent); box-shadow: inset 3px 0 0 var(--rut); }
  .ex.open .set.sig .tipo, body.descansando .ex.open .set.sig .tipo { color: var(--rut); }
  /* Avisos: fondo sólido con borde, nunca se transparenta con el texto de atrás */
  .toast { background: var(--card2); color: var(--text); border: 1px solid var(--line); box-shadow: 0 14px 34px -10px rgba(0, 0, 0, .6); }
  /* Comida: anillo 20 % más chico para que los botones de agregar entren en la primera pantalla */
  .ring { width: 160px; height: 160px; margin: 8px auto 10px; }
  .ring .v { font-size: 40px; }
  .ring .lbl { display: none; }
  /* Barra inferior: todas iguales; la pestaña donde estás crece y sube (con su color) para que sepas dónde estás */
  #nav { --tabc: var(--pri); --on-tabc: var(--on-pri); }
  body[data-tab=Entrenar] #nav { --tabc: var(--rut); --on-tabc: var(--on-rut); }
  #nav button::before { display: none; }
  #nav button { color: var(--muted); gap: 2px; }
  #nav button.on { color: var(--tabc); }
  #nav button .bola { display: grid; place-items: center; width: 40px; height: 30px; margin-top: 0; border-radius: 15px; background: transparent; color: inherit;
                      box-shadow: none; filter: none; transition: width .4s cubic-bezier(.3, 1.4, .5, 1), height .4s cubic-bezier(.3, 1.4, .5, 1),
                      margin .4s cubic-bezier(.3, 1.4, .5, 1), border-radius .4s, background-color .25s, box-shadow .25s; }
  #nav button .bola .icon { width: 22px; height: 22px; transform: none; transition: width .4s, height .4s; }
  #nav button.on .bola { width: 56px; height: 56px; margin-top: -26px; border-radius: 20px; background: var(--tabc); color: var(--on-tabc); box-shadow: 0 0 0 5px var(--bg); }
  #nav button.on .bola .icon { width: 27px; height: 27px; }
  #nav button:active .bola { transform: scale(.94); }
  @media (prefers-reduced-motion: reduce) { #nav button .bola, #nav button .bola .icon { transition: none; } }
  /* El grupo elegido se ve como un disco: relleno de su color, sin brillo */
  .chip.on, .chip.r-Trote.on { background: var(--c); border-color: var(--c); color: var(--on-rut); box-shadow: none; }
  .plan5k { background: var(--card); }
`;
/* v8.5: nada se sale de la pantalla ni se arrastra de lado; mosaicos en dos filas; músculo en dos pasos */
const CSS_V85 = `
  html { overflow-x: hidden; overscroll-behavior: none; } body { overflow-x: clip; }
  html.conmodal { overflow: hidden; }
  .sheet { overflow-x: hidden; touch-action: pan-y; overflow-wrap: anywhere; }
  .sheet .btn, .sheet .alt, .sheet .mchips button { max-width: 100%; white-space: normal; text-align: left; }
  .sheet .btn.block { text-align: center; }
  .mosaicos { flex-wrap: wrap; overflow: visible; margin: 0 0 12px; padding: 0; }
  .mosaicos button { flex: 0 0 calc((100% - 16px) / 3); }
  .volver { display: inline-flex; align-items: center; gap: 6px; border: 0; background: var(--card2); color: var(--text); border-radius: 99px; padding: 8px 14px; font-size: 14px; font-weight: 600; }
  .accion .alt small { display: block; font-size: 11.5px; color: var(--muted); margin-top: 1px; }
  .hechos { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
  .maqfoto { display: block; width: 100%; max-height: 220px; object-fit: cover; border-radius: 16px; margin: 10px 0; }
  .maqok, .maqnuevo { background: var(--card2); border-radius: 14px; padding: 12px 14px; font-size: 14.5px; }
  .maqok small { display: block; color: var(--muted); font-size: 13px; margin-top: 4px; }
  .hechos span { background: color-mix(in srgb, var(--ok) 13%, transparent); color: var(--ok); border-radius: 99px; padding: 4px 10px; font-size: 12.5px; font-weight: 600; }
`;
/* v8.6: modo sencillo, Hoy te toca, tour, foto de tu máquina, grupos con nombre normal */
const CSS_V86 = `
  body.sencillo #nMusculos, body.sencillo #nCoach { display: none; }
  body.sencillo #nEntrenar { order: 2; } body.sencillo #nProgreso { order: 3; }
  .chip .cht { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.1; }
  .chip .cht small { font-size: 11px; font-weight: 600; opacity: .75; margin-top: 2px; white-space: nowrap; }
  .chip.on .cht small { opacity: .9; }
  .hoytoca { background: var(--card); border: 2px solid var(--pri); border-radius: 22px; padding: 14px 14px 12px; margin: 0 0 14px; }
  .hoytoca .t2 { margin: 0 2px 10px; }
  .hoytoca ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .hoytoca li button { width: 100%; display: flex; align-items: center; gap: 12px; padding: 11px 12px; border: 0; border-radius: 14px; background: var(--card2); color: var(--text); text-align: left; font-weight: 650; font-size: 16px; }
  .hoytoca li i { flex: none; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; font-style: normal; font-weight: 800; background: var(--card); border: 2px solid var(--line); color: var(--pri); }
  .hoytoca li small { display: block; font-weight: 500; font-size: 13px; color: var(--muted); margin-top: 1px; }
  .hoytoca li.ok button { background: color-mix(in srgb, var(--ok) 13%, transparent); color: var(--ok); }
  .hoytoca li.ok i { background: var(--ok); border-color: var(--ok); color: #fff; }
  .hoytoca li.ya button { background: var(--pri); color: #fff; }
  .hoytoca li.ya small { color: inherit; opacity: .85; }
  .hoytoca li.ya i { border-color: currentColor; background: transparent; color: inherit; }
  .facil { background: var(--pri); color: #fff; border-radius: 14px; padding: 12px 14px; font-weight: 650; font-size: 16px; line-height: 1.35; margin-bottom: 10px; }
  .exfoto { display: block; width: 100%; height: 120px; object-fit: cover; border-radius: 14px; margin-bottom: 10px; }
  .exfoto.grande { height: 190px; }
  .exfoto-vacia { display: block; width: 100%; border: 1.5px dashed var(--line); background: none; color: var(--text); border-radius: 14px; padding: 12px; margin-bottom: 10px; font-weight: 650; text-align: left; }
  .exfoto-vacia small { display: block; color: var(--muted); font-weight: 500; font-size: 12.5px; }
  .sets-h span { white-space: nowrap; }
  #tour { position: fixed; inset: 0; z-index: 300; }
  #tour .tour-tapa { position: absolute; inset: 0; }
  #tour .tour-luz { position: fixed; border-radius: 18px; box-shadow: 0 0 0 4px #fff, 0 0 0 9999px rgba(15, 10, 35, .66); pointer-events: none; }
  #tour .tour-burbuja { position: fixed; left: 16px; right: 16px; max-width: 480px; margin: 0 auto; background: var(--card); color: var(--text); border-radius: 20px; padding: 16px 18px; font-size: 16px; line-height: 1.4;
    box-shadow: 0 18px 40px -12px rgba(0, 0, 0, .5); animation: up2 .25s ease; }
  .falla { background: var(--card2); border-radius: 12px; padding: 9px 12px; margin-bottom: 6px; font-size: 13.5px; }
  .falla small { display: block; color: var(--muted); font-size: 12px; margin-top: 2px; }
`;
/* v7.5: pasos de la tarde, ritmo de peso, proteína por comida, después de la carrera, diagnóstico */
const CSS_V75 = `
  .pill.red { background: color-mix(in srgb, var(--red) 15%, transparent); color: var(--red); }
  .pasos5 { border-color: color-mix(in srgb, var(--cyan) 40%, var(--line)); background: linear-gradient(160deg, color-mix(in srgb, var(--cyan) 9%, var(--card)), var(--card)); }
  .escala { position: relative; height: 10px; background: var(--card2); border-radius: 99px; margin: 12px 0 4px; }
  .escala .zona { position: absolute; top: 0; bottom: 0; background: var(--ok); opacity: .45; border-radius: 99px; }
  .escala i { position: absolute; top: -4px; width: 4px; height: 18px; margin-left: -2px; background: var(--text); border-radius: 2px; }
  .escala-l { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); }
  .comidas3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 10px; }
  .comidas3 button { border: 1.5px solid var(--line); background: var(--card2); color: var(--text); border-radius: 14px; padding: 9px 4px; display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .comidas3 button span { font-size: 12px; color: var(--muted); white-space: nowrap; }
  .comidas3 button b { font-size: 19px; font-weight: 800; }
  .comidas3 button small { font-size: 11px; color: var(--muted); }
  .comidas3 button.ok b, .comidas3 button.ok small { color: var(--ok); }
  .comidas3 button.baja small { color: var(--acc); }
  .comidas3 button.on { border-color: var(--pri); box-shadow: 0 0 0 1px var(--pri) inset; }
  .comida-l { font-size: 12.5px; margin: 10px 4px 4px; }
  .postcarrera { border-color: color-mix(in srgb, var(--red) 40%, var(--line)); background: linear-gradient(160deg, color-mix(in srgb, var(--red) 9%, var(--card)), var(--card)); }
  .diag { margin-top: 6px; }
  .diag .dh { margin: 14px 0 6px; font-size: 13px; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
  .diag .dl { display: flex; gap: 10px; align-items: flex-start; padding: 7px 0; border-bottom: 1px solid var(--line); font-size: 14px; line-height: 1.4; }
  .diag .dl b { flex: none; width: 16px; text-align: center; }
  .diag-bt { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 4px; }
`;

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
  else { el.className = 'sync ok'; el.textContent = '✓ Al día'; }
}
function avisoErrores() {
  const e = LS.get('gym_errores', []);
  if (!e.length) return '';
  return '<div class="card" style="background:var(--acc-weak);border-color:transparent">' +
    '<div class="t1" style="color:var(--acc)">La hoja no aceptó ' + (e.length === 1 ? 'un dato' : e.length + ' datos') + '</div>' +
    '<div class="muted" style="margin:4px 0 10px">' + e.slice(-3).map(x => esc(x.que + ' (' + ddmm(x.cuando) + '): ' + x.msg)).join('<br>') +
    '<br>Quedó en tu celular, pero no en la hoja. Si no sabes por qué, mándale captura a tu coach.</div>' +
    '<button class="btn ghost sm" onclick="LS.del(\'gym_errores\');pintarEntrenar()">Entendido</button></div>';
}

/* ===================== Arranque ===================== */
function arrancar() {
  const st = document.createElement('style'); st.textContent = CSS_V53 + CSS_V7 + CSS_V72 + CSS_V75 + CSS_V8 + CSS_V85 + CSS_V86; document.head.appendChild(st);
  aplicarSencillo();
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
const VERSION_APP = 'v8.6';
let ULT_LECTURA = 0;
// Al volver a la app o recuperar la señal: lee la hoja si pasó más de un minuto desde la última vez
function refrescar() { if (Date.now() - ULT_LECTURA > 60000) actualizar(); }
// Otra persona en este celular: se borra todo lo de la cuenta anterior menos la cola (sus pendientes se suben con su clave)
function cambiarDeCuenta() {
  Object.keys(localStorage).filter(k => /^gym_/.test(k) && !['gym_queue', 'gym_api', 'gym_key'].includes(k)).forEach(k => LS.del(k));
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
    if (ENVIOS !== n0 && (intento || 0) < 2) return actualizar((intento || 0) + 1);
    ULT_LECTURA = Date.now();
    const igual = DATA && JSON.stringify(d) === JSON.stringify(DATA);
    DATA = d; LS.set('gym_data', d);
    if (!igual || DIA_PINTADO !== hoy()) pintarTodo();   // si no cambió nada, no se borra lo que estés escribiendo
    if (!NATIVO_LISTO) iniciarNativo();                   // primera vez en este celular (sin datos guardados)
    seguroNut(primerSyncNut, 'primer envío');           // script 7.7 recién puesto: sube hoy y ayer a la pestaña Comidas
    precargarMedia();
    if (DATA.perfil === false && !LS.get('gym_bienvenida', false)) abrirBienvenida();
    else { revisarMedallas(); setTimeout(tourSiToca, 700); }
  } catch (e) {
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
/* ----- Entrenamiento en pareja: registras a tu compañero en tu celular y se guarda en SU hoja ----- */
let PAR = null;          // { nombre, key, data, exs } cuando el modo pareja está activo hoy
const QUIEN = {};        // pestaña visible por ejercicio: 'yo' | 'par'
const esPar = n => typeof n === 'string' && n.indexOf('P|') === 0;
const baseDe = n => esPar(n) ? n.slice(2) : n;
const claveDe = n => esPar(n) && PAR ? PAR.key : KEY;
const quienDe = n => esPar(n) && PAR ? PAR.nombre + ': ' : '';
function parOn() { return !!(PAR && PAR.exs && !FECHA); }
function parejaDisponible() { return DATA && DATA.pareja && DATA.pareja.length ? DATA.pareja[0] : null; }
function parejaHoy() { const c = LS.get('gym_pareja', null); return c && c.dia === hoy() ? c : null; }
function estadoDe(ex, clave, fresh, pend, w, viejo, dia) {
  const real = baseDe(ex.name);
  let done = !FECHA && fresh && ex.done, id = !FECHA && fresh ? (ex.uid || '') : '';
  pend.forEach(op => {
    if ((op.k || KEY) !== clave) return;
    if (op.action === 'saveExercise' && op.args[0].name === real && op.args[0].day === dia) { done = true; id = op.args[0].uid; }
    if (op.action === 'undoById' && op.args[0] === id) { done = false; id = ''; }
  });
  const prev = viejo[ex.name];
  if (prev && prev.dia === dia && prev.edited && !prev.done && !done) return prev;
  const g = w[ex.name];
  const st = g && !done ? { unit: g.unit, sets: g.sets, rir: g.rir || '', notas: g.notas || '', uid: '', done: false, edited: true } : nuevoEstado(ex, done, id);
  st.dia = dia;
  return st;
}
function construirEstadosPar(viejo) {
  if (!PAR || !PAR.exs) return;
  const pend = cola(), w = wip(), dia = diaReg(), fresh = PAR.data.todayKey === hoy();
  Object.keys(PAR.exs).forEach(k => { state[k] = estadoDe(PAR.exs[k], PAR.key, fresh, pend, w, viejo || state, dia); });
}
function prepararPar() {
  aplicarProgresion(PAR.data.exercises, PAR.data.ultimoPeso);
  PAR.exs = {};
  PAR.data.exercises.forEach(e => { PAR.exs['P|' + e.name] = Object.assign({}, e, { name: 'P|' + e.name }); });
  construirEstadosPar(state);
}
// Con qué se identifica a tu compañero: su clave (script anterior) o "para:nombre" (script 7.6, que ya no manda claves)
const idPar = p => p.key || 'para:' + p.nombre;
async function cargarPareja() {
  const cfg = parejaHoy(), p = parejaDisponible();
  if (!cfg || !p) { PAR = null; return; }
  if (!PAR || PAR.key !== idPar(p)) {
    PAR = { nombre: p.nombre, key: idPar(p), data: LS.get('gym_par_' + idPar(p), null), exs: null };
    if (PAR.data) prepararPar();
  }
  if (PAR.cargando) return;
  PAR.cargando = true;
  try {
    const d = await apiGet('data', idPar(p));
    if (!PAR || PAR.key !== idPar(p)) return;
    PAR.data = d; LS.set('gym_par_' + idPar(p), d); prepararPar();
  } catch (e) { if (PAR && !PAR.data) toast('No pude cargar los datos de ' + p.nombre + '; revisa la señal'); }
  if (PAR) PAR.cargando = false;
  if (TAB === 'Entrenar') pintarEntrenar();
}
function alternarPareja() {
  const p = parejaDisponible();
  if (!p) return;
  if (parejaHoy()) {
    guardarPendientes();
    LS.del('gym_pareja'); PAR = null;
    Object.keys(state).filter(esPar).forEach(k => delete state[k]);
    toast('Modo pareja apagado');
  } else {
    LS.set('gym_pareja', { key: idPar(p), dia: hoy() });
    toast('Entrenando con ' + p.nombre + ': cada ejercicio tiene su pestaña');
    cargarPareja();
  }
  pintarEntrenar();
}
// Un ejercicio en pareja pasa a "Completados" cuando los dos terminaron (o uno terminó y el otro ni lo empezó)
// "Cambiar solo para Aaron": cada día guarda qué ejercicio hace él en la tarjeta de cada uno de los tuyos
function mapaPar() { return LS.get('gym_parmap_' + hoy(), {}); }
function guardarMapaPar(m) { LS.set('gym_parmap_' + hoy(), m); }
function parKey(base) { const m = mapaPar(); return 'P|' + (m[base] || base); }
// La tarjeta donde vive un registro del compañero (puede estar en otro ejercicio si se cambió solo para él)
function baseVista(name) {
  if (!esPar(name)) return name;
  const real = baseDe(name), m = mapaPar(), ks = Object.keys(m).filter(k => m[k] === real && exDe(k));
  return ks.find(k => exDe(k).group === GRUPO) || ks[0] || real;
}
function quitarMapa(base) { const m = mapaPar(); delete m[base]; guardarMapaPar(m); ANIM_ABRE = base; pintarEntrenar(); }
// En pareja cada quien es independiente: la tarjeta pasa a "Completados" solo cuando cada uno terminó
// o se marcó que hoy no lo hace (no se asume que el otro lo hará o no).
function saltosPar() { return LS.get('gym_parskip_' + hoy(), {}); }
function saltado(base, lado) {
  const m = saltosPar()[base] || {};
  if (m[lado] !== undefined) return !!m[lado];            // lo que elegiste hoy manda
  const a = asignadoDe(base);                              // si no, lo que dice el Catálogo (columna U)
  if (!a || !PAR) return false;
  return !mismoNombre(a, lado === 'par' ? PAR.nombre : DATA.nombre);
}
function saltarLado(base, lado) {
  const ahora = !saltado(base, lado), a = asignadoDe(base);
  const m = saltosPar(); m[base] = Object.assign({}, m[base]); m[base][lado] = ahora; LS.set('gym_parskip_' + hoy(), m);
  hap('tecla');
  // Si se repite, que no tengas que marcarlo cada vez: ofrece guardarlo como regla del ejercicio
  const otro = lado === 'yo' ? PAR.nombre : DATA.nombre, nom = (exDe(base) || {}).ejercicio || '';
  if (ahora && !a) toast((lado === 'yo' ? 'Hoy no lo haces' : PAR.nombre + ' no lo hace hoy'), '', { txt: '¿Siempre solo ' + otro + '?', fn: () => fijarAsignado(base, otro) });
  else if (!ahora && a) toast((lado === 'yo' ? 'Hoy sí lo haces' : PAR.nombre + ' sí lo hace hoy'), '', { txt: '¿Siempre los dos?', fn: () => fijarAsignado(base, 'Ambos') });
  if (m[base][lado] && OPEN === base) OPEN = siguiente(GRUPO, base);
  conTransicion(pintarEntrenar);
}
function ladoListo(base, lado) { const st = state[lado === 'par' ? parKey(base) : base]; return !st || st.done || saltado(base, lado); }
function cardDone(base) {
  const yo = state[base], pa = parOn() ? state[parKey(base)] : null;
  if (!pa) return yo.done;
  return ladoListo(base, 'yo') && ladoListo(base, 'par');
}
// Pestaña que se ve al abrir: la que elegiste; si no, la de quien todavía tiene series por hacer
function ladoVisible(base) {
  if (QUIEN[base]) return QUIEN[base];
  return ladoListo(base, 'yo') && !ladoListo(base, 'par') ? 'par' : 'yo';
}
function verLado(base, lado) { QUIEN[base] = lado; ANIM_ABRE = base; hap('tecla'); pintarEntrenar(); }
// Sugerencia al empezar cada ejercicio (subir, bajar o mantener, con números). El script 7.4 ya la manda calculada
// con la misma función (motor.js → progresionInicio); con un script anterior, la calcula la app con tu última sesión.
const SCRIPT_ESPERADO = '7.8';
const versionNum = v => String(v || '0').split('.').map(Number).reduce((a, x, i) => a + x / Math.pow(100, i), 0);
const scriptAlDia = () => !!(DATA && DATA.scriptVersion && versionNum(DATA.scriptVersion) >= versionNum(SCRIPT_ESPERADO));
// Un solo motor: si la hoja trae el mismo motor (misma huella que motor.js) se usa lo que calculó; si no, lo calcula la app
const motorAlDia = () => !!DATA.motorFirma && DATA.motorFirma === MOTOR.firmaProgresion();
function aplicarProgresion(lista, corpKg) {
  if ((scriptAlDia() && motorAlDia()) || DATA.descargaCarrera) return;
  const rirDe = rpe => vacio(rpe) ? null : Number(rpe) >= 9.5 ? 0 : Number(rpe) <= 7 ? 3 : 1.5;
  (lista || []).forEach(ex => {
    const t = (ex.anterior || []).filter(a => a.t !== 'C' && a.t !== 'D' && Number(a.r) > 0);
    if (!t.length || ex.done) return;
    const series = t.map((a, i) => ({ w: Number(a.w) || 0, r: Number(a.r),
      rir: a.rpe !== undefined ? rirDe(a.rpe) : (i === t.length - 1 && ex.rirUlt !== undefined ? ex.rirUlt : null) }));
    const pr = MOTOR.progresionInicio({ series: series, min: ex.min, max: ex.max, paso: ex.paso || ex.step, unidad: ex.unit, mult: ex.mult,
      barra: ex.barra, inc: ex.inc, modalidad: ex.modalidad, sinPeso: ex.sinPeso, corpKg: corpKg, nSeries: (ex.sets || []).filter(s => s.t !== 'C').length });
    ex.prog = { accion: pr.accion, peso: pr.peso, reps: pr.reps };
    ex.up = pr.accion === 'subir'; ex.hint = pr.mensaje;
    ex.sets = (ex.sets || []).filter(s => s.t === 'C').concat(pr.objetivo.map(o => ({ w: o.w, r: o.r, t: 'T' })));
  });
}
function nuevoEstado(ex, done, id) {
  const st = { unit: ex.unit, sets: ex.sets.map(s => ({ w: s.w, r: s.r, t: s.t || 'T', ok: false })), rir: '', notas: '',
               uid: id, done: done, edited: false };
  if (!done && !FECHA && !esPar(ex.name) && descargaActiva()) aplicarDescarga(ex, st);
  return st;
}
function superserie() { const s = LS.get('gym_super_' + diaReg(), null); return s && s.length === 2 ? s : null; }
function companero(name) { const s = superserie(); return s && s.includes(name) ? s.find(x => x !== name) : null; }

let DIA_PINTADO = null;
function revisarDia() { if (DATA && DIA_PINTADO && DIA_PINTADO !== hoy()) { pintarTodo(); return true; } return false; }
function pintarTodo() {
  DIA_PINTADO = hoy();
  const pend = cola(), w = wip(), viejo = state, dia = diaReg();
  aplicarProgresion(DATA.exercises, DATA.ultimoPeso);
  state = {};
  DATA.exercises.forEach(ex => { state[ex.name] = estadoDe(ex, KEY, fresco(), pend, w, viejo, dia); });
  if (parejaHoy() && parejaDisponible()) { if (PAR && PAR.exs) construirEstadosPar(viejo); if (!PAR || !PAR.cargando) cargarPareja(); }
  else PAR = null;
  // Grupo del día: al abrir, al cambiar de día o cuando llegan datos nuevos, salvo que hoy hayas elegido otro a mano
  if (!FECHA) {
    if (GRUPO_DIA !== hoy()) { GRUPO_MANUAL = false; GRUPO_DIA = hoy(); }
    const gHoy = grupoDeHoy();
    if (!GRUPO || (!GRUPO_MANUAL && GRUPO !== gHoy)) { GRUPO = gHoy; OPEN = null; }
  } else if (!GRUPO) GRUPO = DATA.sugGrupo;
  if (OPEN === null || (OPEN && !exDe(OPEN))) OPEN = siguiente(GRUPO, '');
  if (COMIDA_DIA && COMIDA_DIA !== sumarDias(hoy(), -1)) COMIDA_DIA = null;   // pasó la medianoche
  usarProt(diaComida());
  asegurarTabCoach();
  $('brand').innerHTML = 'GYM <span>' + (DATA.dueno ? 'MB' : esc((DATA.nombre || '').toUpperCase())) + '</span>';
  document.title = 'Gym' + (DATA.nombre ? ' ' + DATA.nombre : '');
  pintarFecha();
  $('loading').classList.add('hide'); $('app').classList.remove('hide'); $('nav').classList.remove('hide');
  pintarTab(); pintarSync();
  programarAvisoProt(); actualizarWidgets();
}
// Lo que te toca hoy: lo que ya empezaste hoy; si los datos son de otro día, el siguiente de la rotación
function grupoDeHoy() {
  const yaHoy = sesion().log.map(l => l.name.split(':')[0]).filter(g => GRUPOS3.includes(g)).pop();
  if (yaHoy) return yaHoy;
  if (DATA.todayKey === hoy() || !GRUPOS3.includes(DATA.ultimoGrupo)) return DATA.sugGrupo;
  return DATA.ultimoGrupoFecha === hoy() ? DATA.ultimoGrupo : GRUPOS3[(GRUPOS3.indexOf(DATA.ultimoGrupo) + 1) % 3];
}
// Lo que comiste un día: primero lo guardado en el celular, luego lo que tiene la hoja
// La lista de comida en pantalla y de qué día es (si la app se quedó abierta de noche, se recarga antes de tocarla)
let PROT_DIA = null;
function usarProt(dia) { prot = cargarProt(dia); PROT_DIA = dia; }
function asegurarProt() { if (PROT_DIA !== diaComida()) usarProt(diaComida()); }
function cargarProt(dia) {
  const local = LS.get('gym_prot_' + dia, null);
  if (local) return local;
  // Script 7.7: cada cosa con sus macros (pestaña Comidas); si no, solo la proteína del detalle de Peso diario
  const conMacros = DATA && DATA.comidasDias ? listaDesdeHoja(dia) : null;
  if (conMacros) return conMacros;
  const desdeHoja = dia === hoy() ? (fresco() ? DATA.protHoy : null) : (DATA.protAyer && DATA.protAyer.k === dia ? DATA.protAyer : null);
  return desdeHoja && desdeHoja.detalle ? desdeHoja.detalle.split(', ').filter(k => FOODS.some(f => f.k === k) || RE_PROPIO.test(k)) : [];
}
// Lo que registras puede ser un botón fijo (FOODS) o algo propio guardado como "Tacos de asada (27 g)"
const RE_PROPIO = /^(.+) \((\d+(?:\.\d+)?) g\)$/;
// Y desde la v8.2, '#id' = un registro con todos sus macros y '@receta' = una de tus recetas (comida.js)
function gDe(k) { const n = gDeNut(k); if (n !== null) return n; const f = FOODS.find(x => x.k === k); if (f) return f.g; const m = RE_PROPIO.exec(k); return m ? Number(m[2]) : 0; }
function tDe(k) { const n = tDeNut(k); if (n !== null) return n; const f = FOODS.find(x => x.k === k); if (f) return f.t; const m = RE_PROPIO.exec(k); return m ? m[1] + ' · ' + m[2] + ' g' : k; }
const clavePropia = (t, g) => String(t).replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) + ' (' + Math.round(g) + ' g)';
// Tus recetas como botones (widget y día típico): '@licuado' se vuelve registro con lo que lleve tu receta ese día
function recetasComoBotones() { return seguroNut(() => nutCfg().recetas.map(r => ({ k: '@' + r.id, t: r.n, g: Math.round((totReceta(r.id) || { p: 0 }).p), rec: true })), 'recetas') || []; }
// Mis comidas: las que guardaste con ⭐ (se guardan en tu configuración, no en el código)
function misComidas() { return (DATA.comidas || []).map(c => ({ k: clavePropia(c.t, c.g), t: c.t, g: c.g, fav: true })); }
function pesoDe(dia) {
  const local = LS.get('gym_peso_' + dia, null);
  return local !== null ? local : (dia === hoy() && fresco() ? DATA.pesoHoy : null);
}
function pintarFecha() {
  const p = pesoDe(hoy());
  const dia = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  const toca = (DATA.dias || [1, 2, 3, 4, 5]).includes(new Date().getDay()) ? '' : ', descansas (próximo: ' + esc(DATA.sugGrupo) + ')';
  $('fecha').innerHTML = esc(dia.charAt(0).toUpperCase() + dia.slice(1)) + toca + (fresco() ? '' : ', sin conexión') +
    (p !== null ? ' <button class="link pesohdr" onclick="PESO_TMP=' + p + ';tecladoPeso(hoy())" aria-label="Corregir peso de hoy">' + p + ' kg</button>' : '');
}

function verTab(t) {
  if (t !== 'Comida' && COMIDA_DIA) { COMIDA_DIA = null; usarProt(hoy()); }
  TAB = t;
  document.body.dataset.tab = t;
  ['Entrenar', 'Comida', 'Progreso', 'Musculos', 'Coach'].forEach(x => {
    if (!$('v' + x)) return;
    $('v' + x).classList.toggle('hide', x !== t);
    $('n' + x).classList.toggle('on', x === t);
  });
  window.scrollTo(0, 0);
  if (!LS.get('gym_rest', null)) ocultarRest();
  pintarTab();
  if (t === 'Progreso') enviar().then(refrescar);
}
function pintarTab() {
  if (TAB === 'Entrenar') pintarEntrenar();
  else if (TAB === 'Comida') pintarComida();
  else if (TAB === 'Musculos') pintarMusculos();
  else if (TAB === 'Coach') { if ($('vCoach')) pintarCoach(); else verTab('Entrenar'); }
  else pintarProgreso();
}

/* ===================== ENTRENAR ===================== */
function ordenGrupo(g) {
  // Lo que añadiste hoy desde el mapa va al final de lo recomendado, sea del grupo que sea
  const extra = extrasHoy().map(x => exDe(x.name)).filter(Boolean), esX = e => extra.includes(e);
  // Cambio de equipo "solo hoy": la variante toma el lugar del original
  const cam = cambiosHoy(), puestos = Object.values(cam), pon = l => l.map(e => cam[e.name] ? exDe(cam[e.name]) || e : e);
  const exs = DATA.exercises.filter(ex => ex.group === g && !esX(ex) && !puestos.includes(ex.name));
  let secs;
  if (g === 'Core') secs = [pon(exs).concat(extra)];
  else {
    const rec = DATA.bloquePara[g], otro = rec === 'A' ? 'B' : 'A';
    secs = [pon(exs.filter(e => e.bloque === rec)).concat(extra), pon(exs.filter(e => e.bloque === otro)), pon(exs.filter(e => e.bloque !== 'A' && e.bloque !== 'B'))];
  }
  // Con la ruta de hoy aceptada, sus ejercicios van primero (y "siguiente" los sigue en ese orden)
  const ruta = rutaAceptada(g);
  if (!ruta) return secs;
  const enRuta = pon(ruta.map(x => exDe(x.name)).filter(Boolean));
  return [enRuta].concat(secs.map(l => l.filter(e => !enRuta.includes(e))));
}
// La unidad que va después: segundos en la plancha, nada si no hay peso, "lb por lado" en barra y discos
function unidadSets(l) {
  const ex = exDe(l.name), sinPeso = (l.sets || []).every(s => s.t === 'C' || !Number(s.w));
  if (sinPeso) return ex && ex.sinPeso && ex.min >= 20 ? ' s' : '';
  return ' ' + l.unit + (ex && ex.mult === 2 ? ' por lado' : '');
}
// "4×12 con 22.5" si todas las series son iguales; "85: 10, 10, 9, 8" si solo cambia la repetición
function resumenSets(sets) {
  const t = (sets || []).filter(s => s.t !== 'C');
  if (!t.length) return '';
  const mismoPeso = t.every(s => s.w === t[0].w), mismasReps = t.every(s => s.r === t[0].r);
  if (mismoPeso && mismasReps) return t.length + '×' + t[0].r + (t[0].w ? ' con ' + t[0].w : '');
  if (mismoPeso) return (t[0].w ? t[0].w + ': ' : '') + t.map(s => s.r).join(', ');
  return t.map(s => s.w + '×' + s.r).join(' · ');
}

/* ----- Hoy (v8): el grupo en grande y un rack con una mancuerna por ejercicio; las que guardas se llenan ----- */
const DISCOS_VISTOS = {};
function tarjetaHoy() {
  const secs = ordenGrupo(GRUPO), todos = secs.flat(), hechosL = todos.filter(e => cardDone(e.name));
  // Lo planeado: la primera sección (tu ruta o el bloque recomendado) más lo que ya hiciste de otras
  const total = Math.max(1, new Set((secs[0] || []).map(e => e.name).concat(hechosL.map(e => e.name))).size), hechos = hechosL.length;
  const clave = hoy() + GRUPO, antes = DISCOS_VISTOS[clave] === undefined ? hechos : Math.min(DISCOS_VISTOS[clave], hechos);
  DISCOS_VISTOS[clave] = hechos;
  const bloque = GRUPOS3.includes(GRUPO) && DATA.bloquePara ? DATA.bloquePara[GRUPO] : '';
  const lado = hechos ? '<strong>' + hechos + ' de ' + total + '</strong>' + (hechos >= total ? 'completo' : 'hechos')
    : '<strong>' + total + ' ejercicio' + (total === 1 ? '' : 's') + '</strong>' + (bloque ? 'bloque ' + bloque : 'para hoy');
  return '<div class="hoy"><div class="grupo"><b>' + esc(GRUPO) + '</b><span>' + lado + '</span></div>' + rack(hechos, total, antes) + '</div>';
}
// Rack de mancuernas: una por ejercicio; las que faltan, punteadas. Las recién guardadas caen en su lugar
function rack(hechos, total, antes) {
  const n = Math.min(total, 10), W = 40;
  let d = '<rect class="repisa" x="0" y="27" width="' + n * W + '" height="3" rx="1.5"/>';
  for (let k = 0; k < n; k++) {
    const x = k * W + 4, cls = k < hechos ? 'mancuerna' + (k >= antes ? ' entra' : '') : 'falta';
    d += '<g class="' + cls + '"' + (k >= antes && k < hechos ? ' style="animation-delay:' + ((k - antes) * 110) + 'ms"' : '') + '>' +
      '<rect x="' + x + '" y="4" width="8" height="21" rx="2.5"/><rect x="' + (x + 8) + '" y="12" width="16" height="5" rx="2"/><rect x="' + (x + 24) + '" y="4" width="8" height="21" rx="2.5"/></g>';
  }
  return '<svg class="rack" viewBox="0 0 ' + n * W + ' 30" style="width:' + Math.min(100, n * 15) + '%" role="img" aria-label="' + hechos + ' de ' + total + ' ejercicios hechos">' + d + '</svg>';
}
// Tu día en una fila de mosaicos chicos (peso, proteína, pasos y lo que esté pendiente): cada uno abre su tarjeta
let PEND = [];
function pendientesHoy(activa, conDescarga) {
  PEND = [];
  if (FECHA) return '';
  const add = (o) => { if (o.html || o.fn) PEND.push(o); };
  const p = pesoDe(hoy());
  add({ et: 'Peso', val: p !== null ? '<b>' + p + '</b> kg' : 'Pesarte', ojo: p === null, fn: p !== null ? 'PESO_TMP=' + p + ';tecladoPeso(hoy())' : "PESO_TMP='';tecladoPeso()" });
  const tot = protTotal(cargarProt(hoy())), meta = metaProt(), p6 = activa ? '' : tarjetaProt6();
  add({ et: 'Proteína', val: '<b>' + tot + '</b>/' + meta + ' g', pct: tot / meta, ojo: !!p6, html: p6, fn: p6 ? '' : "verTab('Comida')" });
  const sal = LS.get('gym_salud', null), x = sal && (sal.pasos || []).find(q => q.k === hoy());
  if (x) { const pa = tarjetaPasos(); add({ et: 'Pasos', val: '<b>' + x.v.toLocaleString('es-MX') + '</b>', pct: x.v / META_PASOS(), ojo: !!pa, html: pa, fn: pa ? '' : "verTab('Progreso')" }); }
  if (new Date().getDay() === 0 && !activa) add({ et: 'Cintura', val: 'Medir', ojo: true, html: tarjetaCintura() });
  if (!activa) add({ et: 'Comida de ayer', val: 'Anotar', html: tarjetaAyer() });
  add({ et: 'Aviso de pasos', val: 'Permiso', ojo: true, html: tarjetaPermisoFondo() });
  if (conDescarga && !activa) add({ et: 'Recuperación', val: 'Descarga', ojo: true, html: tarjetaDescarga() });
  if (sencillo() && !activa) return hoyTeToca(p, tot, meta);
  return '<div class="mosaicos">' + PEND.map((t, i) => '<button class="' + (t.ojo ? 'ojo' : '') + '" onclick="' + (t.html ? 'abrirPendiente(' + i + ')' : t.fn) + '">' +
    '<span class="et">' + t.et + '</span><span class="v num">' + t.val + '</span>' +
    (t.pct !== undefined ? '<i style="--p:' + Math.min(100, Math.round(t.pct * 100)) + '%"></i>' : '') + '</button>').join('') + '</div>';
}
// Modo sencillo: tu día en 3 pasos en orden (pesarte, entrenar, comida); el que sigue va resaltado
function hoyTeToca(p, tot, meta) {
  const g = GRUPO && GRUPO !== 'Trote' ? GRUPO : DATA.sugGrupo, recs = g && g !== 'Trote' ? recomendadosHoy(g) : [];
  const hechos = recs.filter(e => state[e.name] && state[e.name].done).length;
  const pasos = [
    { ok: p !== null, t: 'Pesarte', s: p !== null ? p + ' kg · listo' : 'En ayunas, después del baño: toca aquí', fn: p !== null ? 'PESO_TMP=' + p + ';tecladoPeso(hoy())' : "PESO_TMP='';tecladoPeso()" },
    { ok: recs.length > 0 && hechos === recs.length, t: g === 'Trote' ? 'Salir a correr' : 'Entrenar ' + (NOMBRE_GRUPO[g] || g || '').toLowerCase(),
      s: !recs.length ? 'Toca para ver tu plan' : hechos === recs.length ? 'Listo por hoy 💪' : hechos ? hechos + ' de ' + recs.length + ' ejercicios · toca para seguir' : recs.length + ' ejercicios · toca para empezar',
      fn: 'empezarHoy()' },
    { ok: tot >= meta, t: 'Anotar lo que comes', s: 'Llevas ' + tot + ' de ' + meta + ' g de proteína', fn: "verTab('Comida')" }
  ];
  const sig = pasos.findIndex(x => !x.ok);
  return '<div class="hoytoca"><div class="t2">Hoy te toca</div><ol>' + pasos.map((x, i) => '<li class="' + (x.ok ? 'ok' : i === sig ? 'ya' : '') + '"><button onclick="' + x.fn + '">' +
    '<i>' + (x.ok ? '✓' : i + 1) + '</i><span>' + esc(x.t) + '<small>' + esc(x.s) + '</small></span></button></li>').join('') + '</ol></div>';
}
function empezarHoy() {
  const g = GRUPO && GRUPO !== 'Trote' ? GRUPO : DATA.sugGrupo;
  const e = g && g !== 'Trote' ? recomendadosHoy(g).find(x => !(state[x.name] && state[x.name].done)) : null;
  if (e) return irAEjercicio(e.name);
  const c = document.querySelector('#vEntrenar .chips'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function abrirPendiente(i) {
  const x = PEND[i];
  if (!x) return;
  $('sheet').innerHTML = '<button class="cerrar" style="float:right;margin:0 0 8px 12px" onclick="cerrarModal()" aria-label="Cerrar">✕</button><div class="pendiente">' + x.html + '</div>';
  abrirModal();
  $('sheet').dataset.pend = '1';
}
function pintarEntrenar() {
  const ses = sesion(), activa = sesionActiva();
  document.body.dataset.rut = GRUPO || '';
  let h = '';
  if (activa && !FECHA) {
    h += '<div class="sesbar"><span class="dotlive"></span><div><b id="sesT">' + minutos(Date.now() - ses.start) + '</b>' +
      '<div style="font-size:12px;opacity:.9">' + ses.log.length + ' ejercicio' + (ses.log.length === 1 ? '' : 's') + ' · ' +
      (n => n + (n === 1 ? ' serie' : ' series'))(seriesSesion()) + '</div></div>' +
      '<button class="btn" onclick="terminarSesion()">Terminar</button></div>';
    h += chipsVolumen();
  }
  if (FECHA) h += '<div class="otro">' + ICO.cal + '<span>Registrando para el ' + diaCorto(FECHA) + '</span><button class="btn" onclick="cambiarFecha(null)">Volver a hoy</button></div>';
  h += avisoErrores();
  if (!FECHA && DATA.descargaCarrera) h += '<div class="aviso">' + ICO.flame + '<span>Semana de carrera: descarga. Mitad de series con el mismo peso (ya viene así). Legs a más tardar el lunes; el viernes descansas.</span></div>';
  else if (!FECHA && descargaActiva()) h += '<div class="aviso">' + ICO.flame + '<span>Descarga adelantada hasta el ' + diaCorto(LS.get('gym_descarga', {}).hasta) +
    ': mitad de series y ~10 % menos carga que la vez pasada, sin llegar al fallo. <button class="link" onclick="terminarDescarga()">Terminarla</button></span></div>';
  if (!FECHA && !activa) h += tarjetaPostCarrera();   // una decisión: se queda a la vista
  if (!FECHA && GRUPO && GRUPO !== 'Trote') h += tarjetaHoy();
  h += pendientesHoy(activa, !FECHA && !DATA.descargaCarrera && !descargaActiva());
  const diasSin = DATA.ultimoGrupoFecha ? difDias(DATA.ultimoGrupoFecha, hoy()) - 1 : 0;
  if (!FECHA && !activa && diasSin >= 3 && !sesion().log.length)
    h += '<div class="aviso">' + ICO.flame + '<span>Llevas ' + diasSin + ' días sin ir. Hoy toca ' + esc(DATA.sugGrupo) + ': aunque sean 30 minutos, cuenta.</span></div>';
  if (FECHA && pesoDe(FECHA) === null) h += tarjetaPeso();   // otro día: el peso de ese día, a la vista
  // El buscador se abre con la lupa de la fila de grupos (casi siempre sigues tu rutina: no ocupa una fila diario)
  if (BUSCA_ABIERTA || BUSCA) h += '<div class="buscarfila"><input class="buscar" id="buscar" type="search" placeholder="Buscar ejercicio…" value="' + esc(BUSCA) + '" oninput="buscar(this.value)">' +
    '<button class="link" onclick="cerrarBuscar()">Cancelar</button></div>';
  const corte = h.length;   // de aquí para abajo es lo que cambia al buscar
  if (BUSCA) {
    const q = BUSCA.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const res = DATA.exercises.filter(ex => (ex.ejercicio + ' ' + ex.musculo).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q));
    h += '<h2>' + res.length + ' resultado' + (res.length === 1 ? '' : 's') + '</h2>' + res.map(tarjetaEjercicio).join('');
    if (DATA.ia) h += '<button class="musbtn" onclick="abrirMaquina()">📷 ¿No aparece? Tómale foto a la máquina <span>Te digo qué ejercicio es y lo agrego a tu catálogo</span></button>';
    return ponerEntrenar(h, corte);
  }
  const comp = parejaDisponible();
  if (comp && !FECHA) h += '<button class="parbtn' + (parejaHoy() ? ' on' : '') + '" onclick="alternarPareja()"><span>👥 ' +
    (parejaHoy() ? 'Entrenando con ' + esc(comp.nombre) + (PAR && !PAR.exs ? ' · cargando…' : '') : '¿Entrenas con ' + esc(comp.nombre) + ' hoy?') + '</span><span class="sw"></span></button>';
  h += '<div class="chips">' + (BUSCA_ABIERTA ? '' : '<button class="chip lupa" onclick="abrirBuscar()" aria-label="Buscar ejercicio">' + ICO_LUPA + '</button>') + DATA.chips.concat(['Trote']).map(g => '<button class="chip r-' + g + (g === GRUPO ? ' on' : '') + '" onclick="elegirGrupo(\'' + g + '\')">' +
    (g === 'Trote' ? ICO.flame : '') + '<span class="cht"><span>' + g + (g === DATA.sugGrupo ? '<span class="dot"></span>' : '') + '</span>' +
    (NOMBRE_GRUPO[g] ? '<small>' + NOMBRE_GRUPO[g] + '</small>' : '') + '</span></button>').join('') + '</div>';
  if (GRUPO === 'Trote') return ponerEntrenar(h + vistaTrote() + pieFecha(), corte);
  h += tarjetaFoco();
  h += tarjetaRuta();
  const hechos = ordenGrupo(GRUPO).flat().filter(e => cardDone(e.name));
  if (hechos.length) h += '<details class="sec hechos"' + (PLEG['hechos' + GRUPO] || hechos.some(e => e.name === OPEN) ? ' open' : '') +
    ' ontoggle="PLEG[\'hechos' + GRUPO + '\']=this.open"><summary>✓ Completados · ' + hechos.length + '</summary>' + hechos.map(tarjetaEjercicio).join('') + '</details>';
  // Lo que estás haciendo (tú o tu compañero) sube aquí y se queda abierto: no tienes que buscarlo
  const ahora = ordenGrupo(GRUPO).flat().filter(e => !cardDone(e.name) && enMarcha(e.name));
  if (ahora.length) h += '<h2>Ahora</h2>' + ahora.map(tarjetaEjercicio).join('');
  const secs = ordenGrupo(GRUPO).map(items => items.filter(e => !cardDone(e.name) && !ahora.includes(e)));
  if (hechos.length && !ahora.length && !secs.some(x => x.length)) h += '<div class="tip">' + ICO.check + ' Terminaste todo ' + esc(GRUPO) + '. Toca «Terminar» arriba para ver tu resumen.</div>';
  const acep = rutaAceptada(GRUPO), hR = acep ? acep.filter(x => cardDone(x.name)).length : 0;
  const titulos = (acep ? ['<span>🧭 Tu ruta de hoy: ' + hR + ' de ' + acep.length + '</span><button class="link" onclick="quitarRuta()">Quitar</button>'] : []).concat(GRUPO === 'Core' ? ['Elige 1 o 2 al final de cualquier día']
    : ['Recomendado · bloque ' + DATA.bloquePara[GRUPO], 'Bloque ' + (DATA.bloquePara[GRUPO] === 'A' ? 'B' : 'A'), 'Más ejercicios']);
  let primera = true;
  secs.forEach((items, i) => {
    if (!items.length) return;
    // La primera sección con ejercicios va abierta; las demás plegadas salvo que tengan algo en curso o las abras
    const activa2 = items.some(e => e.name === OPEN || state[e.name].done || state[e.name].sets.some(s => s.ok));
    const abierta = primera || activa2 || PLEG[GRUPO + i];
    if (primera) h += '<h2' + (acep && i === 0 ? ' class="conboton"' : '') + '>' + titulos[i] + '</h2>' + items.map(tarjetaEjercicio).join('');
    else h += '<details class="sec"' + (abierta ? ' open' : '') + ' ontoggle="PLEG[\'' + GRUPO + i + '\']=this.open"><summary>' + titulos[i] + ' · ' + items.length + '</summary>' +
      items.map(tarjetaEjercicio).join('') + '</details>';
    primera = false;
  });
  if (!FECHA && DATA.exercises.some(e => (e.zonas || []).length)) h += '<button class="musbtn" onclick="elegirMusculo()">🎯 ¿Quieres trabajar un músculo? <span>Te digo qué hacer hoy</span></button>';
  ponerEntrenar(h + pieFecha(), corte);
  ANIM_ABRE = ANIM_SET = ANIM_IA = null; ANIM_PLAN = false;
  if (!planHoy() && !PLAN_CARGANDO) setTimeout(pedirPlan, 0);
}
function pieFecha() {
  return FECHA ? '' : '<div style="text-align:center;margin:18px 0 4px"><button class="link" onclick="elegirFecha()">' + ICO.cal.replace('class="icon"', 'class="icon" style="width:16px;height:16px;vertical-align:-3px"') + ' ¿Se te olvidó registrar otro día?</button></div>';
}
// Mientras escribes en el buscador, la casilla no se vuelve a dibujar (el teclado de Google se confunde y repite letras):
// solo cambia lo de abajo
let SOLO_CUERPO = false;
function ponerEntrenar(html, corte) {
  if (SOLO_CUERPO && $('buscar') && $('entCuerpo')) { $('entCuerpo').innerHTML = html.slice(corte); return; }
  $('vEntrenar').innerHTML = html.slice(0, corte) + '<div id="entCuerpo">' + html.slice(corte) + '</div>';
}
let BUSCA_ABIERTA = false;
const ICO_LUPA = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>';
function abrirBuscar() { BUSCA_ABIERTA = true; pintarEntrenar(); setTimeout(() => { const b = $('buscar'); if (b) b.focus(); }, 30); }
function cerrarBuscar() { BUSCA_ABIERTA = false; BUSCA = ''; pintarEntrenar(); }
function buscar(v) {
  BUSCA = v;
  SOLO_CUERPO = true;
  try { pintarEntrenar(); } finally { SOLO_CUERPO = false; }
}

/* ----- Registrar otro día ----- */
function elegirFecha() {
  const ayer = sumarDias(hoy(), -1), antier = sumarDias(hoy(), -2);
  $('sheet').innerHTML = '<div class="t2">¿Qué día quieres registrar?</div>' +
    '<div class="muted" style="margin:4px 0 10px">Lo que guardes quedará con esa fecha: cuenta para la rotación, tus días y tus récords.</div>' +
    '<div class="acts" style="margin-top:0"><button class="btn ghost" onclick="cambiarFecha(\'' + ayer + '\')">Ayer · ' + diaCorto(ayer) + '</button>' +
    '<button class="btn ghost" onclick="cambiarFecha(\'' + antier + '\')">' + diaCorto(antier) + '</button></div>' +
    '<input type="date" id="fechaOtra" max="' + ayer + '" min="' + sumarDias(hoy(), -60) + '" value="' + sumarDias(hoy(), -3) + '">' +
    '<div class="acts"><button class="btn ghost" onclick="cerrarModal()">Cancelar</button><button class="btn" onclick="cambiarFecha($(\'fechaOtra\').value)">Usar esta fecha</button></div>';
  abrirModal();
}
function cambiarFecha(f) {
  if (f && f >= hoy()) f = null;
  FECHA = f || null;
  cerrarModal();
  OPEN = null; BUSCA = '';
  if (FECHA) detenerRest();
  pintarTodo();
  window.scrollTo(0, 0);
  if (FECHA) toast('Registrando para el ' + diaCorto(FECHA));
}

/* ----- Peso y cintura ----- */
let PESO_TMP = null, PESO_DIA = null;   // PESO_DIA: el botón del encabezado corrige el de HOY aunque estés en otro día
// La casilla empieza vacía: así nunca se guarda por error el peso de ayer
function tarjetaPeso() {
  const dia = diaReg();
  if (PESO_TMP === null) PESO_TMP = '';
  return '<div class="card"><div class="peso"><div class="lbl"><div class="t1">' + (FECHA ? 'Peso del ' + diaCorto(dia) : 'Peso de hoy') + '</div>' +
    '<div class="muted">' + (DATA.ultimoPeso !== null ? 'Último: <b class="num">' + DATA.ultimoPeso + '</b> kg · en ayunas' : 'En ayunas, después del baño') + '</div></div>' +
    '<button class="pesobtn num' + (PESO_TMP === '' ? ' vacio' : '') + '" onclick="tecladoPeso()">' + (PESO_TMP === '' ? 'Pesar' : PESO_TMP) + '</button>' +
    '<button class="okmark" onclick="' + (PESO_TMP === '' ? 'tecladoPeso()' : 'guardarPeso()') + '" aria-label="Guardar peso">' + ICO.check + '</button></div></div>';
}
function tarjetaCintura() {
  if (LS.get('gym_cint_' + hoy(), null) !== null) return '';
  const ult = DATA.cuerpo && DATA.cuerpo.serie && DATA.cuerpo.serie[DATA.cuerpo.serie.length - 1];
  if (ult && ult.cint !== null && ult.d === ddmm(hoy())) return '';      // ya está en la hoja (desde otro celular o desde el chat)
  const ant = cinturaAnterior();
  return '<div class="card"><div class="peso"><div class="lbl"><div class="t1">Cintura del domingo</div><div class="muted">' + (ant !== null ? 'La vez pasada: <b class="num">' + ant + '</b> cm' : 'Una vez por semana') + '</div></div>' +
    '<input id="cintura" class="in num" type="number" inputmode="decimal" step="0.5" placeholder="cm" value="' + esc(BORR.cintura || '') + '" oninput="BORR.cintura=this.value">' +
    '<button class="okmark" onclick="guardarCintura()" aria-label="Guardar cintura">' + ICO.check + '</button></div>' +
    '<div class="protocolo">📏 A la altura del <b>ombligo</b> · <b>en ayunas</b> · <b>al soltar el aire</b> · cinta pegada <b>sin apretar</b></div></div>';
}
function cinturaAnterior() {
  const s = (DATA.cuerpo && DATA.cuerpo.serie) || [];
  for (let i = s.length - 1; i >= 0; i--) if (s[i].cint !== null && s[i].cint !== undefined && s[i].d !== ddmm(hoy())) return s[i].cint;
  return DATA.cuerpo && DATA.cuerpo.actual !== undefined ? DATA.cuerpo.actual : null;
}
function guardarPeso() {
  const v = Number(PESO_TMP);
  if (!v) return toast('Pon tu peso');
  if (v < 30 || v > 250) return toast('Revisa el peso: ' + v + ' kg no parece correcto');
  PESO_TMP = null;
  const dia = PESO_DIA || diaReg(); PESO_DIA = null;
  LS.set('gym_peso_' + dia, v);
  encolar('savePeso', [v, dia], 'peso-' + dia);
  actualizarWidgets(); programarAvisoProt();
  hap('ok'); toast('Peso guardado ✓'); pintarFecha(); pintarEntrenar();
}
function guardarCintura(confirmada) {
  const v = confirmada || $('cintura').value;
  if (!v) return toast('Escribe tu cintura');
  if (Number(v) < 40 || Number(v) > 200) return toast('Revisa la cintura: ' + v + ' cm no parece correcto');
  const ant = cinturaAnterior(), dif = ant !== null ? Math.round((Number(v) - ant) * 10) / 10 : 0;
  // Más de 2 cm en una semana casi siempre es la medición, no tu cuerpo: vibra y pide confirmar
  if (!confirmada && Math.abs(dif) > 2) {
    hap('atencion'); vibrar([120, 80, 120]);
    $('sheet').innerHTML = '<div class="t2">¿' + v + ' cm?</div><div class="muted" style="margin:6px 0 12px">Son <b>' + (dif > 0 ? '+' : '') + dif + ' cm</b> contra la vez pasada (' + ant +
      ' cm). En una semana casi nunca cambia tanto. Revisa: ombligo, en ayunas, al soltar el aire, sin apretar la cinta.</div>' +
      '<div class="acts"><button class="btn ghost" onclick="cerrarModal();delete BORR.cintura;setTimeout(()=>{const c=$(\'cintura\');if(c){c.value=\'\';c.focus();}},50)">Medir otra vez</button>' +
      '<button class="btn" onclick="cerrarModal();guardarCintura(' + Number(v) + ')">Sí, guardar ' + v + '</button></div>';
    return abrirModal();
  }
  LS.set('gym_cint_' + hoy(), Number(v)); delete BORR.cintura;
  encolar('saveCintura', [Number(v), hoy()], 'cintura-' + hoy());
  programarAvisoProt();
  hap('ok'); toast('Cintura guardada ✓'); pintarEntrenar();
}

/* ----- Tarjeta de ejercicio ----- */
function anillo(hechas, total, done) {
  const R = 16, C = 2 * Math.PI * R, pct = total ? hechas / total : 0;
  return '<svg class="ring2" viewBox="0 0 38 38"><circle cx="19" cy="19" r="' + R + '" fill="none" stroke="var(--line)" stroke-width="3.5"/>' +
    (pct ? '<circle cx="19" cy="19" r="' + R + '" fill="none" stroke="' + (done ? 'var(--ok)' : 'var(--acc)') + '" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="' + (C * (1 - pct)) + '"/>' : '') +
    '</svg>';
}
const tarjetaVisible = b => OPEN === b || (enMarcha(b) && !CERRADAS[b]);
// La tarjeta cambia de lugar (sube a "Ahora" al marcar su primera serie, o regresa): se desliza a su nuevo lugar y la pantalla la sigue
function moverTarjeta(base) {
  conTransicion(() => {
    pintarEntrenar();
    const el = document.getElementById('ex-' + base);
    if (el) window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.scrollY - (sesionActiva() && !FECHA ? 76 : 12)));
  });
}
function abiertaTarjeta(name) {
  if (state[name].done) return false;
  if (OPEN === name || (enMarcha(name) && !CERRADAS[name])) return true;
  const p = companero(name);
  return !!(p && OPEN === p);
}
function tarjetaEjercicio(ex) {
  if (parOn() && state[parKey(ex.name)]) return tarjetaPareja(ex);
  const st = state[ex.name], abierto = abiertaTarjeta(ex.name);
  const trabajo = st.sets.filter(s => s.t !== 'C');
  const hechas = trabajo.filter(s => s.ok).length;
  const enCurso = !st.done && st.sets.some(s => s.ok);
  const log = sesion().log.find(l => l.name === ex.name);
  const par = companero(ex.name);
  let meta;
  if (st.done) {
    const sets = log ? log.sets : ex.hoySets;
    meta = (sets && sets.length ? resumenSets(sets) : 'Registrado') +
      (log && log.prs && log.prs.length ? ' · <b style="color:var(--acc)">Récord</b>'
        : log && log.cambio >= 1 ? ' · <b style="color:var(--ok)">↑ ' + log.cambio + '%</b>' : '');
  } else if (enCurso) meta = '<b style="color:var(--acc)">' + hechas + ' de ' + trabajo.length + ' series</b>';
  else meta = ex.anterior.length ? 'Última (' + ex.lastWhen + '): ' + resumenSets(ex.anterior) : ex.min + '–' + ex.max + ' reps · primera vez';
  if (!st.done && esExtra(ex.name)) meta = '<b style="color:var(--pri)">➕ Añadido hoy</b> · ' + meta;
  else if (!st.done && esDeOtro(ex)) meta = 'Normalmente lo hace ' + esc(ex.asignado) + ' · ' + meta;
  let ico;
  if (st.done) ico = ICO.check;
  else if (enCurso || abierto) ico = anillo(hechas, trabajo.length, false) + '<span class="rt num">' + hechas + '/' + trabajo.length + '</span>';
  else ico = '<span class="num">' + trabajo.length + '</span>';
  const n = jsq(ex.name);
  let h = '<div class="ex' + (abierto ? ' open' : '') + (st.done ? ' done' : '') + (enCurso ? ' prog' : '') + '" id="ex-' + esc(ex.name) + '" style="view-transition-name:ex' + DATA.exercises.indexOf(ex) + '">' +
    '<div class="ex-head" onclick="abrir(\'' + n + '\')"><div class="ex-ico">' + ico + '</div>' +
    '<div style="flex:1;min-width:0"><div class="ex-name">' + esc(ex.ejercicio) + botonTecnica(ex) + (par && !st.done ? '<span class="sstag">Superserie</span>' : '') + '</div><div class="ex-meta">' + badgeMod(ex) + meta + '</div></div>' +
    (ex.up && !st.done && (FECHA || esPar(ex.name) || !descargaActiva()) ? '<span class="pill acc">' + ICO.up + 'Sube</span>' : '') +
    (abierto ? '<button class="swapbtn" onclick="event.stopPropagation();elegirCambio(\'' + n + '\')" aria-label="Máquina ocupada: cambiar ejercicio">⇄</button>' +
      '<button class="menubtn" onclick="event.stopPropagation();menuEjercicio(\'' + n + '\')" aria-label="Más opciones">⋮</button>' : '') + '</div>';
  if (st.done && OPEN === ex.name) {
    h += '<div class="ex-body"><div class="acts">' + (st.uid ? '<button class="btn ghost sm" onclick="deshacer(\'' + n + '\')">Borrar</button>' : '') +
      '<button class="btn ghost sm" onclick="corregir(\'' + n + '\')">' + (st.uid ? 'Corregir' : 'Registrar otra vez') + '</button></div></div>';
  } else if (abierto) h += '<div class="ex-body' + (ANIM_ABRE === ex.name ? ' entra' : '') + '">' + cuerpoEjercicio(ex, st) + '</div>';
  return h + '</div>';
}

// Modo sencillo: una sola instrucción con lo que toca en la siguiente serie
function instruccionFacil(ex, st) {
  const k = st.sets.findIndex(x => !x.ok);
  if (k < 0) return '¡Terminaste! Toca «Guardar ejercicio» abajo.';
  const s = st.sets[k], trabajo = st.sets.filter(x => x.t !== 'C'), num = st.sets.slice(0, k + 1).filter(x => x.t !== 'C').length;
  const paso1 = String(ex.tecnica || '').split(' · ')[0].replace(/[.\s]+$/, '');
  const veces = !vacio(s.r) ? s.r : ex.min + ' a ' + ex.max;
  const peso = !vacio(s.w) && Number(s.w) > 0 ? ' con ' + s.w + ' ' + st.unit : ex.anterior.length || ex.sinPeso ? '' : ' con un peso que puedas mover bien';
  const quien = s.t === 'C' ? 'Calentamiento: hazlo ' : 'Serie ' + num + ' de ' + trabajo.length + ': hazlo ';
  return (paso1 ? paso1.charAt(0).toUpperCase() + paso1.slice(1) + '. ' : '') + quien + veces + ' veces' + peso + ' y toca ✓. Luego descansa ' + mmss(ajuste('descanso', 90)) + '.';
}
/* ----- Foto de TU máquina en el ejercicio (se queda en este celular) ----- */
const fotoMaqDe = name => LS.get('gym_fotomaq', {})[name] || null;
function guardarFotoMaq(name, url) {
  const m = LS.get('gym_fotomaq', {});
  if (url) m[name] = url; else delete m[name];
  try { localStorage.setItem('gym_fotomaq', JSON.stringify(m)); return true; }
  catch (e) { toast('No cupo la foto en el celular: quita fotos de otras máquinas'); return false; }
}
// La foto se guarda chica (560 px): se ve bien en la tarjeta y caben muchas
function fotoChica(cv) {
  const s = Math.min(1, 560 / Math.max(cv.width, cv.height)), c = document.createElement('canvas');
  c.width = Math.round(cv.width * s); c.height = Math.round(cv.height * s);
  c.getContext('2d').drawImage(cv, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.72);
}
let FOTO_EJ = null;
function fotoParaEjercicio(name) {
  FOTO_EJ = name;
  let inp = $('fotoEj');
  if (!inp) {
    inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.id = 'fotoEj'; inp.style.display = 'none'; inp.setAttribute('capture', 'environment');
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0]; inp.value = '';
      if (!f || !FOTO_EJ) return;
      try { const r = await achicarFoto(f, 1280); if (guardarFotoMaq(FOTO_EJ, fotoChica(r.cv))) { hap('ok'); toast('Foto guardada ✓'); } }
      catch (e) { toast(e.message); }
      cerrarModal(); pintarEntrenar();
    });
    document.body.appendChild(inp);
  }
  inp.click();
}
function verFotoMaq(name, borrar) {
  const n = jsq(name), ex = exDe(name);
  $('sheet').innerHTML = '<div class="row between"><div class="t2">' + esc(ex ? ex.ejercicio : 'Tu máquina') + '</div><button class="btn ghost sm" onclick="cerrarModal()">✕</button></div>' +
    '<img class="maqfoto" style="max-height:60vh;object-fit:contain" src="' + fotoMaqDe(name) + '" alt="">' +
    (borrar ? '<div class="muted" style="margin:4px 0 8px">¿Quitar esta foto? Solo se borra de este celular.</div><div class="acts"><button class="btn ghost" onclick="verFotoMaq(\'' + n + '\')">No</button>' +
      '<button class="btn" onclick="guardarFotoMaq(\'' + n + '\', null);cerrarModal();pintarEntrenar();toast(\'Foto quitada\')">Sí, quitarla</button></div>'
      : '<div class="acts"><button class="btn ghost" onclick="verFotoMaq(\'' + n + '\', true)">Quitar</button><button class="btn" onclick="fotoParaEjercicio(\'' + n + '\')">📷 Tomar otra</button></div>');
  if (!$('modal').classList.contains('show')) abrirModal();
}
/* ----- Técnica y video del ejercicio (Catálogo: Q = link, R = técnica) ----- */
function badgeMod(ex) { return ex && ex.modalidad ? '<span class="mod">' + esc(ex.modalidad) + '</span>' : ''; }
function botonTecnica(ex) {
  return '<button class="vidbtn' + (ex.media ? ' tiene' : '') + '" onclick="event.stopPropagation();verTecnica(\'' + jsq(ex.name) + '\')" aria-label="Ver técnica y video">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M10 8.5v7l5.5-3.5z" fill="currentColor"/></svg></button>';
}
// YouTube (normal, Shorts o youtu.be) se incrusta; MP4/WebM se reproduce en bucle; GIF o imagen se muestra; lo demás, botón para abrir
function reproductor(url) {
  if (!url) return '';
  const esq = '<div class="esq"><div class="brillo"></div><span>Cargando…</span></div>';
  const yt = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) {
    // Primero la miniatura (queda guardada en el celular); el video solo se carga si tocas ▶
    return '<div class="media' + (/shorts\//.test(url) ? ' vert' : '') + '" data-yt="' + yt[1] + '">' +
      '<img class="thumb" src="https://i.ytimg.com/vi/' + yt[1] + '/hqdefault.jpg" alt="" onload="mediaOk(this)" onerror="mediaFalla(this)">' +
      '<button class="play" onclick="reproducirYT(this.parentNode)" aria-label="Reproducir video"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>' + esq + '</div>';
  }
  if (/\.(mp4|webm|mov)(\?|#|$)/i.test(url)) return '<div class="media"><video src="' + esc(url) + '" autoplay muted loop playsinline controls oncanplay="mediaOk(this)" onerror="mediaFalla(this)"></video>' + esq + '</div>';
  if (/\.(gif|png|jpe?g|webp)(\?|#|$)/i.test(url) || /giphy\.com\/media|tenor\.com\/.*\.gif/i.test(url))
    return '<div class="media img"><img src="' + esc(url) + '" alt="Demostración del ejercicio" onload="mediaOk(this)" onerror="mediaFalla(this)">' + esq + '</div>';
  return '<a class="btn ghost block" style="display:block;text-align:center;text-decoration:none" href="' + esc(url) + '" target="_blank" rel="noopener">▶ Abrir video</a>';
}
function mediaOk(el) { const m = el.closest('.media'); if (m) m.classList.add('ok'); }
function mediaFalla(el) {
  const m = el.closest('.media'); if (!m) return;
  m.classList.remove('ok'); m.classList.add('falla');
  m.querySelector('.esq span').textContent = 'Sin conexión para el video';
}
// Si a los 3 s no cargó: avisa en vez de dejar un cuadro negro (sigue intentando por si llega la señal)
function vigilarMedia() {
  setTimeout(() => document.querySelectorAll('#sheet .media:not(.ok):not(.falla)').forEach(m => {
    m.classList.add('lento');
    m.querySelector('.esq span').textContent = navigator.onLine ? 'Señal lenta: sigue cargando…' : 'Sin conexión para el video';
  }), 3000);
}
function reproducirYT(m) {
  if (!navigator.onLine) return mediaFalla(m.querySelector('.thumb'));
  m.classList.remove('ok', 'lento', 'falla'); m.classList.add('jugando');
  m.querySelector('.esq span').textContent = 'Cargando…';
  m.insertAdjacentHTML('beforeend', '<iframe src="https://www.youtube-nocookie.com/embed/' + m.dataset.yt + '?autoplay=1&rel=0&playsinline=1&modestbranding=1" ' +
    'title="Video del ejercicio" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen onload="mediaOk(this)"></iframe>');
  vigilarMedia();
}
// Le pide al service worker que guarde las miniaturas y GIF del catálogo mientras hay señal
let MEDIA_PEDIDA = false;
function precargarMedia() {
  if (MEDIA_PEDIDA || !navigator.onLine || !('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return;
  const urls = [];
  DATA.exercises.forEach(e => {
    if (!e.media) return;
    const yt = e.media.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
    if (yt) urls.push('https://i.ytimg.com/vi/' + yt[1] + '/hqdefault.jpg');
    else if (/\.(gif|png|jpe?g|webp)(\?|#|$)/i.test(e.media)) urls.push(e.media);
  });
  if (!urls.length) return;
  MEDIA_PEDIDA = true;
  navigator.serviceWorker.controller.postMessage({ tipo: 'precache', urls: urls });
}
function verTecnica(name) {
  const ex = exDe(name), n = jsq(name);
  const puntos = (ex.tecnica || '').split(/\s*·\s*/).filter(Boolean);
  const buscar = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(ex.ejercicio + ' técnica correcta');
  $('sheet').innerHTML = '<div class="row between"><div class="t2" style="padding-right:8px">' + esc(ex.ejercicio) + '</div><button class="btn ghost sm" onclick="cerrarModal()">✕</button></div>' +
    reproductor(ex.media) +
    (puntos.length ? '<ol class="tecnica">' + puntos.map(p => '<li>' + esc(p.charAt(0).toUpperCase() + p.slice(1)) + '</li>').join('') + '</ol>' : '<div class="muted" style="margin:10px 0">Sin técnica escrita: agrégala en la columna R del Catálogo.</div>') +
    '<div class="muted" style="font-size:13.5px;margin:4px 0 2px"><b style="color:var(--text)">Cómo anotar el peso:</b> ' + esc(ex.howTo || '—') + ' · ' + ex.min + '–' + ex.max + ' reps</div>' +
    (ex.ajuste ? '<div class="muted" style="font-size:13.5px">⚙️ ' + esc(ex.ajuste) + '</div>' : '') +
    '<div class="medialink"><input id="mediaUrl" type="url" inputmode="url" placeholder="Pega un link de YouTube, GIF o MP4" value="' + esc(ex.media || '') + '">' +
    '<button class="btn sm" onclick="guardarMedia(\'' + n + '\')">Guardar</button></div>' +
    '<a class="link" style="display:inline-block;margin-top:8px" href="' + buscar + '" target="_blank" rel="noopener">Buscar un video en YouTube ↗</a>';
  abrirModal();
  vigilarMedia();
}
function guardarMedia(name) {
  const v = ($('mediaUrl').value || '').trim();
  if (v && !/^https:\/\//i.test(v)) return toast('El link debe empezar con https://');
  const base = baseDe(name);
  // El video es del ejercicio, no de la persona: se guarda en tu catálogo y, si entrenas en pareja, también en el de tu compañero
  [base, 'P|' + base].forEach(k => { const e = exDe(k); if (e) e.media = v; });
  LS.set('gym_data', DATA);
  encolar('saveMedia', [base, v], 'media-' + base);
  if (PAR && PAR.exs && PAR.exs['P|' + base]) encolar('saveMedia', [base, v], 'media-P|' + base, PAR.key);
  hap('ok'); toast(v ? 'Video guardado ✓' : 'Video quitado');
  verTecnica(name); pintarEntrenar();
}

const RIR_DE_RPE = { 10: 0, 8.5: 1.5, 7: 3 };
async function resumenCoach(s) {
  $('sheet').innerHTML = '<div class="debrief"><div class="t2">✨ Tu coach está revisando la sesión</div>' +
    '<div class="brillo linea-esq" style="width:95%;margin-top:14px"></div><div class="brillo linea-esq" style="width:80%"></div><div class="brillo linea-esq" style="width:88%"></div>' +
    '<div class="muted" style="margin-top:10px;font-size:13px">Compara cada ejercicio con la vez pasada y anota lo que aprende de ti. Puedes cerrar: te lo deja en la pestaña Coach.</div>' +
    '<div class="acts"><button class="btn ghost" onclick="cerrarModal()">Cerrar</button></div></div>';
  abrirModal();
  const memAntes = (DATA.memoria || []).length;
  const ses = { fecha: DATA.today, grupo: GRUPO, duracion_min: Math.max(1, Math.round((Date.now() - (s.start || Date.now())) / 60000)),
    con: parOn() ? PAR.nombre : null, foco_del_plan: planHoy() ? planHoy().foco : null, recuperacion: recuperacion(),
    ejercicios: s.log.map(l => { const ex = exDe(l.name) || {}; return {
      ejercicio: l.ej, modalidad: ex.modalidad || '', unidad: l.unit, rango: ex.min ? ex.min + '–' + ex.max : '',
      hoy: l.sets.map(x => ({ peso: x.w, reps: x.r, tipo: x.t, rir: x.rpe ? RIR_DE_RPE[x.rpe] : null })),
      anterior: (ex.anterior || []).map(a => ({ peso: Number(a.w) || 0, reps: Number(a.r) || 0, tipo: a.t || 'T' })),
      rir_anterior: ex.rirUlt === undefined ? null : ex.rirUlt, records: l.prs || [], cambio_fuerza_pct: l.cambio,
      nota: state[l.name] ? state[l.name].notas || '' : '', meta_del_plan: planHoy() ? (planHoy().ej || {})[l.name] || null : null }; }) };
  let r;
  try { r = await conLimite(apiPost('debrief', [ses]), 90000); }
  catch (e) { if ($('modal').classList.contains('show') && $('sheet').querySelector('.debrief')) cerrarModal(); return toast('No pude hacer el resumen: ' + e.message.slice(0, 80)); }
  LS.set('gym_debrief_' + hoy(), r);
  DATA.memoria = r.memoria || DATA.memoria; LS.set('gym_data', DATA);
  const nuevas = Math.max(0, (DATA.memoria || []).length - memAntes);
  const texto = '**' + r.titulo + '**\n' + r.resumen + '\n\n**Aprende:** ' + r.leccion + '\n\n**Próxima vez:** ' + r.proxima;
  const lista = chatLista(); lista.push({ rol: 'coach', texto: texto, ts: Date.now(), resumen: true }); LS.set('gym_chat', lista.slice(-40));
  if ($('modal').classList.contains('show') && $('sheet').querySelector('.debrief')) {
    $('sheet').innerHTML = '<div class="debrief"><div class="t2">✨ ' + esc(r.titulo) + '</div><div style="margin-top:8px;line-height:1.45">' + esc(r.resumen) + '</div>' +
      '<div class="sec2"><b>Aprende</b>' + esc(r.leccion) + '</div><div class="sec2"><b>Próxima vez</b>' + esc(r.proxima) + '</div>' +
      (nuevas ? '<div class="muted" style="margin-top:12px;font-size:13px">🧠 Aprendió ' + nuevas + (nuevas === 1 ? ' cosa nueva' : ' cosas nuevas') + ' de ti</div>' : '') +
      '<div class="acts">' + ($('nCoach') ? '<button class="btn ghost" onclick="cerrarModal();verTab(\'Coach\')">Ver en Coach</button>' : '') + '<button class="btn" onclick="cerrarModal()">Listo</button></div></div>';
    hap('ok');
  } else toast('Tu coach dejó el resumen de la sesión', '', { txt: 'Ver', fn: () => verTab('Coach') });
}

/* ----- Plan del día: la IA mira tu última sesión, tu RIR y lo que ha aprendido de ti ----- */
let PLAN_CARGANDO = false;
const PLAN_FALLO = {};
const clavePlan = () => 'gym_plan_' + hoy() + '_' + GRUPO;
// Los únicos pesos que el plan puede proponer: el de la última vez y un paso arriba o abajo (los que existen en ese equipo)
function pesosValidos(e) {
  const t = (e.anterior || []).filter(a => a.t !== 'C' && Number(a.w) > 0);
  const sug = (e.sets || []).filter(x => x.t !== 'C' && Number(x.w) > 0).map(x => Number(x.w));
  if (!t.length && !sug.length) return [];
  const w0 = t.length ? Math.max.apply(null, t.map(a => Number(a.w))) : sug[0], p = Math.abs(e.paso || e.step || 2.5);
  return [alPaso(w0 - p, p), w0, alPaso(w0 + p, p)].concat(sug).filter((x, i, a) => x > 0 && a.indexOf(x) === i).sort((a, b) => a - b);
}
function planHoy() { return GRUPOS3.includes(GRUPO) ? LS.get(clavePlan(), null) : null; }
function planAplica() { return !!(DATA && DATA.ia && !FECHA && GRUPOS3.includes(GRUPO) && ajuste('iaPlan', true)); }
async function pedirPlan() {
  if (!planAplica() || PLAN_CARGANDO || planHoy() || PLAN_FALLO[clavePlan()] || !navigator.onLine || pideReady()) return;
  const exs = (recomendadosHoy(GRUPO).length ? recomendadosHoy(GRUPO) : ordenGrupo(GRUPO).find(x => x.length) || []).filter(e => (!state[e.name] || !state[e.name].done) && (parOn() || !esDeOtro(e)));
  if (!exs.length) return;
  const g = GRUPO, k = clavePlan();
  PLAN_CARGANDO = true;
  if (TAB === 'Entrenar') pintarEntrenar();
  try {
    const r = await conLimite(apiPost('plan', [{ grupo: g, descarga: !!DATA.descargaCarrera, recuperacion: recuperacion(), objetivo: FOCOS[focoMus()][0],
      zonas_bajas: zonasAtrasadas(5).map(x => ({ zona: x.m, series: Math.round(x.v * 2) / 2, meta: x.meta })), ejercicios: exs.map(e => ({
      nombre: e.ejercicio, modalidad: e.modalidad || '', rango: e.min + '–' + e.max,
      ultima: e.anterior.length ? e.lastWhen + ': ' + resumenSets(e.anterior) + ' ' + e.unit : 'primera vez',
      rir_ultima: e.rirUlt === undefined ? null : e.rirUlt, regla: e.hint || '', sube: !!e.up, pesos_validos: pesosValidos(e) })) }]), 45000);
    const norm = x => String(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const ej = {};
    exs.forEach(e => { const kk = Object.keys(r.ejercicios || {}).find(x => norm(x) === norm(e.ejercicio)); if (kk) ej[e.name] = r.ejercicios[kk]; });
    LS.set(k, { foco: r.foco, ej: ej });
    ANIM_PLAN = true;
  } catch (e) { PLAN_FALLO[k] = true; }   // sin plan la app sigue con sus reglas
  PLAN_CARGANDO = false;
  if (TAB === 'Entrenar' && GRUPO === g) pintarEntrenar();
}
/* ----- Check-in: cómo vienes hoy (antes del plan del día) ----- */
const READY = { sueno: ['Mal', 'Normal', 'Excelente'], energia: ['Baja', 'Media', 'A tope'], dolor: ['Adolorido', 'Normal', 'Fresco'] };
const READY_TIT = { sueno: '😴 Sueño', energia: '⚡ Energía', dolor: '💪 Músculos' };
let READY_TMP = {};
function readyHoy() { return LS.get('gym_ready_' + hoy(), null); }
function pideReady() {
  return planAplica() && !planHoy() && !readyHoy() && !sesion().log.length && !Object.keys(state).some(k => !esPar(k) && state[k].sets.some(x => x.ok));
}
function tarjetaReady() {
  return '<div class="card ready entra"><div class="row between"><div class="t1">¿Cómo vienes hoy?</div><button class="link" onclick="guardarReady(true)">Saltar</button></div>' +
    '<div class="muted" style="font-size:13px">3 toques: tu coach ajusta el plan y el esfuerzo de hoy</div>' +
    Object.keys(READY).map(k => '<div class="fila"><div class="muted">' + READY_TIT[k] + '</div><div class="pills">' +
      READY[k].map(v => '<button class="' + (READY_TMP[k] === v ? 'on' : '') + '" onclick="elegirReady(\'' + k + '\',\'' + v + '\')">' + v + '</button>').join('') + '</div></div>').join('') + '</div>';
}
function elegirReady(k, v) {
  READY_TMP[k] = v; hap('tecla');
  if (Object.keys(READY).every(x => READY_TMP[x])) guardarReady(false); else pintarEntrenar();
}
function guardarReady(saltar) {
  LS.set('gym_ready_' + hoy(), saltar ? { saltado: true } : Object.assign({}, READY_TMP));
  // v8.3: el check-in también va a la pestaña Salud de tu hoja (columnas E–G) para que tu coach lo vea en el reporte
  if (!saltar) encolar('saveSalud', [{ dias: [], trotes: [], checkin: { k: hoy(), sueno: READY_TMP.sueno, energia: READY_TMP.energia, dolor: READY_TMP.dolor } }], 'ready');
  READY_TMP = {};
  const bajos = saltar ? 0 : ['Mal', 'Baja', 'Adolorido'].filter(v => Object.values(readyHoy()).includes(v)).length;
  if (!saltar) toast(bajos >= 2 ? 'Día conservador: tu coach baja la exigencia' : bajos ? 'Anotado: hoy sin subir de peso' : '¡A tope! Tu coach busca subir donde toca');
  pintarEntrenar();
}
function recuperacion() { const r = readyHoy(); return r && !r.saltado ? r : null; }

function tarjetaFoco() {
  if (!planAplica()) return '';
  if (pideReady()) return tarjetaReady();
  const p = planHoy();
  if (p && p.foco) return '<div class="foco' + (ANIM_PLAN ? ' entra' : '') + '"><span class="i">✨</span><div><b>Foco de hoy:</b> ' + esc(p.foco) + '</div></div>';
  if (PLAN_CARGANDO) return '<div class="foco"><span class="i">✨</span><div style="flex:1"><div class="muted" style="font-size:13px">Tu coach está preparando el plan de hoy…</div>' +
    '<div class="brillo linea-esq" style="width:90%"></div><div class="brillo linea-esq" style="width:60%"></div></div></div>';
  return '';
}

/* ----- Menú ⋮ del ejercicio: lo secundario, fuera de la vista mientras entrenas ----- */
function menuEjercicio(k) {
  const ex = exDe(k), st = state[k], n = jsq(k), base = baseVista(k), par = esPar(k) ? null : companero(k);
  const item = (ico, txt, sub, fn) => '<button onclick="' + fn + '"><span class="i">' + ico + '</span><span><b>' + esc(txt) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span></button>';
  let h = '<div class="row between"><div class="t2">' + esc(ex.ejercicio) + (esPar(k) ? ' · ' + esc(PAR.nombre) : '') + '</div><button class="btn ghost sm" onclick="cerrarModal()">✕</button></div><div class="menu">';
  h += item('▶', 'Técnica y video', ex.tecnica ? 'Cómo se hace, punto por punto' : 'Agrega un video o GIF', "verTecnica('" + n + "')");
  if (!st.sets.some(s => s.t === 'C') && calientaConSeries(ex)) h += item('🔥', 'Agregar calentamiento', 'Series ligeras antes del peso de trabajo', "cerrarModal();agregarCalentamiento('" + n + "')");
  const bf = jsq(baseDe(k));
  h += fotoMaqDe(baseDe(k)) ? item('📷', 'Foto de tu máquina', 'Verla, cambiarla o quitarla', "verFotoMaq('" + bf + "')")
    : item('📷', 'Tómale foto a la máquina', 'Te aparece en el ejercicio para reconocerla en el gym', "cerrarModal();fotoParaEjercicio('" + bf + "')");
  h += item('⚙️', ex.ajuste ? 'Editar ajuste de máquina' : 'Ajuste de máquina', ex.ajuste || 'Asiento, banco o agarre: te aparece siempre', "cerrarModal();editarAjuste('" + n + "')");
  h += item('⚖️', 'Paso del equipo: ' + pasoEj(ex, st) + ' ' + st.unit + (ex.pasoFijo ? '' : ' (supuesto)'), 'El cambio de peso más chico que permite; toca para cambiarlo', "menuPaso('" + n + "')");
  h += item('📝', st.notas ? 'Editar nota de hoy' : 'Nota de hoy', st.notas || 'Solo de esta sesión: «hombro cargado», «dormí mal»', "notaDeHoy('" + n + "')");
  if (!esPar(k)) h += par ? item('⇆', 'Quitar superserie', 'Con ' + exDe(par).ejercicio, "cerrarModal();quitarSuper()")
                          : item('⇆', 'Superserie', 'Alterna con otro ejercicio y descansa al final del par', "elegirSuper('" + n + "')");
  h += item('⇄', 'Cambiar ejercicio', (variantesDe(base).length ? 'Otro equipo, ' : '') + 'máquina ocupada o molestia' + (parOn() ? ' (para los dos o solo uno)' : ''), "elegirCambio('" + jsq(base) + "')");
  if (originalDe(base)) h += item('↩', 'Volver a ' + exDe(originalDe(base)).ejercicio.split(' (')[0], 'Solo hoy lo cambiaste por este', "volverOriginal('" + jsq(base) + "')");
  if (parejaDisponible()) { const a = asignadoDe(base); h += item('👥', 'Quién lo hace: ' + (a ? 'solo ' + a : 'los dos'), 'En pareja, al otro se le marca «no lo hace hoy» de entrada', "menuAsignado('" + jsq(base) + "')"); }
  if (esExtra(baseDe(k)) && !state[baseDe(k)].sets.some(s => s.ok)) h += item('✕', 'Quitar de hoy', 'Lo añadiste desde el mapa de músculos', "quitarDeHoy('" + jsq(baseDe(k)) + "')");
  $('sheet').innerHTML = h + '</div>';
  abrirModal();
}
function menuPaso(k) {
  const ex = exDe(k), st = state[k], p = pasoEj(ex, st);
  $('sheet').innerHTML = '<div class="t2">¿De cuánto en cuánto sube?</div><div class="muted" style="margin:4px 0 10px">' + esc(ex.ejercicio) + ' · ' + esc(ex.howTo) +
    '. Con esto ningún consejo te pedirá un peso que no existe en ese equipo.</div><div class="pills" style="display:grid;grid-template-columns:repeat(4,1fr)">' +
    (st.unit === 'kg' ? [1, 1.25, 2.5, 5, 10, 2, 4, 20] : [1, 2.5, 5, 10, 15, 20, 7.5, 12.5]).map(v => '<button class="' + (v === p ? 'on' : '') + '" onclick="cerrarModal();fijarPaso(\'' + jsq(k) + '\',' + v + ')">' + v + ' ' + st.unit + '</button>').join('') +
    '</div><div class="acts"><button class="btn ghost" onclick="cerrarModal()">Cancelar</button></div>';
  abrirModal();
}
function notaDeHoy(k) {
  $('sheet').innerHTML = '<div class="t2">Nota de hoy</div><div class="muted" style="margin:4px 0 8px">' + esc(exDe(k).ejercicio) + ' · solo de esta sesión; la próxima vez te aparece como «La última vez anotaste»</div>' +
    '<textarea id="notaTxt" rows="3" maxlength="200" style="width:100%;padding:10px 12px;border:1.5px solid var(--line);border-radius:12px;background:var(--card2);color:var(--text);font:inherit">' + esc(state[k].notas || '') + '</textarea>' +
    '<div class="acts"><button class="btn ghost" onclick="cerrarModal()">Cancelar</button><button class="btn" onclick="setNotas(\'' + jsq(k) + '\', $(\'notaTxt\').value.trim());cerrarModal();pintarEntrenar()">Guardar</button></div>';
  abrirModal();
  setTimeout(() => { const t = $('notaTxt'); if (t) t.focus(); }, 60);
}

// Vista en pareja: el encabezado resume a los dos; el cuerpo es el de la pestaña elegida
function tarjetaPareja(ex) {
  const base = ex.name, pk = parKey(base), yo = state[base], pa = state[pk], mapeado = pk !== 'P|' + base;
  const lado = ladoVisible(base) === 'par' ? 'par' : 'yo', k = lado === 'par' ? pk : base, st = state[k], exV = exDe(k);
  const hecho = cardDone(base), abierto = OPEN === base || (companero(base) && OPEN === companero(base)) || (!hecho && enMarcha(base) && !CERRADAS[base]);
  const cuenta = x => { const t = x.sets.filter(s => s.t !== 'C'); return { h: t.filter(s => s.ok).length, t: t.length }; };
  const cy = cuenta(yo), cp = cuenta(pa);
  const prog = (x, c, l) => x.done ? '✓' : saltado(base, l) ? 'no hoy' : c.h + '/' + c.t;
  const meta = badgeMod(ex) + 'Tú ' + prog(yo, cy, 'yo') + ' · ' + esc(PAR.nombre) + (mapeado && exDe(pk) ? ' (' + esc(exDe(pk).ejercicio.split(' (')[0]) + ')' : '') + ' ' + prog(pa, cp, 'par');
  const enCurso = !hecho && (cy.h + cp.h > 0 || yo.done || pa.done);
  const ico = hecho ? ICO.check : anillo(cy.h + cp.h + (yo.done ? cy.t - cy.h : 0) + (pa.done ? cp.t - cp.h : 0), cy.t + cp.t, false);
  const n = jsq(base);
  let h = '<div class="ex' + (abierto ? ' open' : '') + (hecho ? ' done' : '') + (enCurso ? ' prog' : '') + '" id="ex-' + esc(base) + '" style="view-transition-name:ex' + DATA.exercises.indexOf(ex) + '">' +
    '<div class="ex-head" onclick="abrir(\'' + n + '\')"><div class="ex-ico">' + ico + '</div>' +
    '<div style="flex:1;min-width:0"><div class="ex-name">' + esc(ex.ejercicio) + botonTecnica(ex) + '</div><div class="ex-meta">' + meta + '</div></div>' +
    (abierto && !hecho ? '<button class="swapbtn" onclick="event.stopPropagation();elegirCambio(\'' + n + '\')" aria-label="Máquina ocupada: cambiar ejercicio">⇄</button>' : '') +
    (abierto && exV && !st.done ? '<button class="menubtn" onclick="event.stopPropagation();menuEjercicio(\'' + jsq(k) + '\')" aria-label="Más opciones">⋮</button>' : '') + '</div>';
  if (!abierto) return h + '</div>';
  h += '<div class="ex-body' + (ANIM_ABRE === base ? ' entra' : '') + '"><div class="quien">' +
    '<button class="' + (lado === 'yo' ? 'on' : '') + '" onclick="verLado(\'' + n + '\',\'yo\')">Tú · ' + prog(yo, cy, 'yo') + '</button>' +
    '<button class="' + (lado === 'par' ? 'on' : '') + '" onclick="verLado(\'' + n + '\',\'par\')">' + esc(PAR.nombre) + ' · ' + prog(pa, cp, 'par') + '</button></div>';
  // Cada quien puede no hacer este ejercicio: así no se registra nada a su nombre y la tarjeta se puede completar
  const asig = asignadoDe(base), habitual = asig && saltado(base, lado) && (saltosPar()[base] || {})[lado] === undefined;
  if (saltado(base, lado)) return h + '<div class="mapa"><span>' + (lado === 'par' ? esc(PAR.nombre) + ' no lo hace hoy' : 'Hoy no lo haces') +
    (habitual ? '<br><small class="muted">Normalmente lo hace solo ' + esc(asig) + '</small>' : '') + '</span><button class="link" onclick="saltarLado(\'' + n + '\',\'' + lado + '\')">' +
    (lado === 'par' ? 'Sí lo hace hoy' : 'Sí lo hago hoy') + '</button></div></div></div>';
  if (st && !st.done && !st.sets.some(x => x.ok)) h += '<div class="saltar"><button class="link" onclick="saltarLado(\'' + n + '\',\'' + lado + '\')">' +
    (lado === 'par' ? esc(PAR.nombre) + ' no lo hace hoy' : 'Hoy no lo hago') + '</button></div>';
  if (lado === 'par' && mapeado && exV) h += '<div class="mapa"><span>' + esc(PAR.nombre) + ' hace <b>' + esc(exV.ejercicio) + '</b></span>' +
    '<button class="link" onclick="quitarMapa(\'' + n + '\')">Que haga ' + esc(ex.ejercicio.split(' (')[0]) + '</button></div>';
  if (!exV) h += '<div class="tip">Este ejercicio no está en el catálogo de ' + esc(PAR.nombre) + '.</div>';
  else if (st.done) h += '<div class="acts">' + (st.uid ? '<button class="btn ghost sm" onclick="deshacer(\'' + jsq(k) + '\')">Borrar</button>' : '') +
    '<button class="btn ghost sm" onclick="corregir(\'' + jsq(k) + '\')">' + (st.uid ? 'Corregir' : 'Registrar otra vez') + '</button></div>';
  else h += cuerpoEjercicio(exV, st);
  return h + '</div></div>';
}
function cuerpoEjercicio(ex, st) {
  const n = jsq(ex.name), facil = sencillo() && !esPar(ex.name), foto = fotoMaqDe(baseDe(ex.name));
  const vars = esPar(ex.name) ? [] : variantesDe(ex.name);
  let h = foto ? '<img class="exfoto' + (facil ? ' grande' : '') + '" src="' + foto + '" alt="Tu máquina" onclick="verFotoMaq(\'' + jsq(baseDe(ex.name)) + '\')">'
    : facil ? '<button class="exfoto-vacia" onclick="fotoParaEjercicio(\'' + jsq(baseDe(ex.name)) + '\')">📷 Tómale foto a tu máquina<small>Para reconocerla la próxima vez</small></button>' : '';
  h += '<div class="row between" style="margin-bottom:10px"><div class="muted">' + ex.min + '–' + ex.max + ' reps · ' + esc(ex.howTo) +
    (vars.length ? ' <button class="equipo" onclick="elegirCambio(\'' + n + '\')">' + esc(ex.modalidad || 'Equipo') + ' ⇄</button>' : '') + '</div>' +
    '<div class="unit">' + ['lb', 'kg'].map(u => '<button class="' + (st.unit === u ? 'on' : '') + '" onclick="setUnit(\'' + n + '\',\'' + u + '\')">' + u + '</button>').join('') + '</div></div>';
  const trabAnt = ex.anterior.filter(a => a.t !== 'C');
  const pesoAnt = trabAnt.length ? Math.max.apply(null, trabAnt.map(a => Number(a.w) || 0)) : null;
  const meta = !esPar(ex.name) && planHoy() ? (planHoy().ej || {})[ex.name] : null;
  if (facil) h += '<div class="facil">' + esc(instruccionFacil(ex, st)) + '</div>';
  else if (meta) h += '<div class="tip plan">🎯 ' + esc(meta) + '</div>';
  else if (ex.up && !FECHA && !esPar(ex.name) && descargaActiva()) h += '<div class="tip">Semana de descarga: estas series ya vienen con −10 % y la mitad. Sin llegar al fallo.</div>';
  else if (ex.up) h += '<div class="tip acc">' + ICO.up + esc(ex.hint) + '</div>';
  else if (ex.prog && ex.hint) h += '<div class="tip' + (ex.prog.accion === 'bajar' ? ' baja' : '') + '">' + (ex.prog.accion === 'bajar' ? '↓ ' : '') + esc(ex.hint) + '</div>';
  else if (ex.hint && /al fallo/.test(ex.hint)) h += '<div class="tip">' + esc(ex.hint) + '</div>';
  else if (ex.sugerido && (pesoAnt === null || ex.sugerido.w > pesoAnt)) h += '<div class="sug">Sugerido hoy: ' + ex.sugerido.w + ' ' + ex.unit + ' × ' + ex.sugerido.r + ' (RPE 8)' +
    '<button class="btn" onclick="usarSugerido(\'' + n + '\')">Usar</button></div>';
  else if (!trabAnt.length) h += '<div class="tip">Elige un peso que te deje ' + ex.min + '–' + ex.max + ' reps con 1–2 de reserva</div>';
  else if (!/Semana de carrera/.test(ex.hint || '')) h += '<div class="tip">Meta de hoy: mismo peso y 1 rep más en alguna serie (la última vez: ' + trabAnt.map(a => a.r).join(', ') + ')</div>';
  else h += '<div class="tip">' + esc(ex.hint) + '</div>';
  if (st.editAjuste) h += '<div class="ajuste-ed"><input id="aj-' + esc(ex.name) + '" maxlength="120" placeholder="Ej. banco a 30°, asiento en 4, agarre neutro" value="' + esc(BORR['aj-' + ex.name] !== undefined ? BORR['aj-' + ex.name] : (ex.ajuste || '')) + '" oninput="BORR[\'aj-' + n + '\']=this.value">' +
    '<button class="btn sm" onclick="guardarAjuste(\'' + n + '\')">Guardar</button></div>';
  else if (ex.ajuste) h += '<button class="nota" onclick="editarAjuste(\'' + n + '\')">⚙️ ' + esc(ex.ajuste) + '<span class="ed">Editar</span></button>';
  if (ex.notaUlt) h += '<div class="muted" style="margin:-4px 2px 10px;font-size:13px">La última vez anotaste: «' + esc(ex.notaUlt) + '»</div>';
  h += facil ? '<div class="sets-h"><span>#</span><span>Antes</span><span>Peso</span><span>Veces</span><span></span></div>'
    : '<div class="sets-h"><span>#</span><span>Anterior</span><span>' + st.unit + '</span><span>Reps</span><span></span></div>';
  const kUlt = ultimaMarcada(st), kSig = st.sets.findIndex(x => !x.ok);
  let num = 0, nc = 0;
  const antC = ex.anterior.filter(a => a.t === 'C'), antT = ex.anterior.filter(a => a.t !== 'C');
  st.sets.forEach((s, i) => {
    if (s.t !== 'C') num++; else nc++;
    const a = s.t === 'C' ? antC[nc - 1] : antT[num - 1];
    const etiqueta = s.t === 'C' ? 'C' : s.t === 'D' ? 'D' : num;
    h += '<div class="set' + (s.ok ? ' hecho' : '') + (i === kSig ? ' sig' : '') + (ANIM_SET === ex.name + '#' + i ? ' recien' : '') + '">' +
      '<button class="tipo ' + (s.t === 'T' ? '' : s.t) + '" onclick="cambiarTipo(\'' + n + '\',' + i + ')" aria-label="Tipo de serie">' + etiqueta + '</button>' +
      '<button class="ant num" onclick="copiarAnterior(\'' + n + '\',' + i + ')">' + (a ? a.w + '×' + a.r : '—') + '</button>' +
      '<button class="val num' + (vacio(s.w) ? ' vacio' : '') + '" onclick="teclado(\'' + n + '\',' + i + ',\'w\')">' + (vacio(s.w) ? 'peso' : s.w) + '</button>' +
      '<button class="val num' + (vacio(s.r) ? ' vacio' : '') + '" onclick="teclado(\'' + n + '\',' + i + ',\'r\')">' + (vacio(s.r) ? (facil ? 'veces' : 'reps') : s.r) + '</button>' +
      '<button class="chk" onclick="marcar(\'' + n + '\',' + i + ')" aria-label="Serie hecha">' + ICO.check + (s.ok && s.e ? '<span class="e">' + ETQ_E[s.e] + '</span>' : '') + '</button></div>';
    if (i === kUlt) h += filaEsfuerzo(n, st, s) + tipIA(n, st);
  });
  const vistas = LS.get('gym_tipcount', 0);
  if (vistas < 3 && !facil) h += '<div class="muted" style="margin:-2px 0 8px;font-size:12px">Toca el # para cambiarla a calentamiento (C) o drop (D) · "Anterior" la copia · ⋮ arriba: calentamiento, ajuste, nota y superserie</div>';
  // Si toca subir, "Igual que antes" te regresaría al peso viejo: no se muestra
  const igual = ex.anterior.length && !ex.up;
  h += '<div class="setacts" style="grid-template-columns:' + (igual ? '1.6fr 1fr 1fr' : '1fr 1fr') + '">' +
    (igual ? '<button class="btn ghost sm" onclick="igualQueAntes(\'' + n + '\')">Igual que antes</button>' : '') +
    '<button class="btn ghost sm" onclick="addSet(\'' + n + '\')"' + (st.sets.length >= 10 ? ' disabled' : '') + '>+ Serie</button>' +
    '<button class="btn ghost sm" onclick="delSet(\'' + n + '\')"' + (st.sets.length <= 1 ? ' disabled' : '') + '>− Serie</button></div>';
  // Lo secundario (calentamiento, ajuste, superserie, nota) vive en el menú ⋮; aquí solo se muestra si ya existe
  const par = esPar(ex.name) ? null : companero(ex.name);
  if (par) h += '<div class="muted" style="font-size:13px;margin-top:8px">' + ICO.swap + ' Superserie con <b>' + esc(exDe(par).ejercicio) + '</b></div>';
  if (st.notas) h += '<button class="nota" style="margin-top:8px" onclick="notaDeHoy(\'' + n + '\')">📝 ' + esc(st.notas) + '<span class="ed">Editar</span></button>';

  const hechas = st.sets.filter(s => s.ok).length;
  h += '<div class="acts"><button class="btn" onclick="guardar(\'' + n + '\')">' +
    (hechas && hechas < st.sets.length ? 'Guardar ' + hechas + ' series' : 'Guardar ejercicio') + '</button></div>';
  return h;
}

// Esfuerzo de la serie que acabas de marcar, justo debajo de ella (sin bajar al fondo de la tarjeta)
const CORTO_E = { 'Al fallo': 'Al fallo', 'Casi (1–2 más)': 'Quedaban 1–2', 'Sobraban 3+': 'Sobraban 3+' };
function filaEsfuerzo(n, st, s) {
  const final = terminado(st);
  return '<div class="rirx' + (final && !s.e ? ' pide' : '') + '"><div class="q">' + (final ? (s.e ? 'Última serie: ' : '¿Cómo terminó? Toca uno y se guarda') : '¿Cómo terminó esta serie?') + '</div><div class="pills">' +
    Object.keys(RPE).map(v => '<button class="' + (s.e === v ? 'on' : '') + '" onclick="setRir(\'' + n + '\',\'' + v + '\')">' + CORTO_E[v] + '</button>').join('') + '</div></div>';
}
// Barra y máquinas de discos: qué discos poner o quitar por lado para el peso sugerido
function cambioDiscos(ex, de, a, unit) {
  if (!ex || ex.mult !== 2 || a === null || a === undefined || Number(a) === Number(de)) return '';
  const pa = platos(Number(a), unit), pd = platos(Number(de) || 0, unit);
  if (!pa) return '';
  const resta = (x, y) => { const c = y.slice(); return x.filter(v => { const k = c.indexOf(v); if (k > -1) { c.splice(k, 1); return false; } return true; }); };
  const poner = pd ? resta(pa, pd) : pa, quitar = pd ? resta(pd, pa) : [];
  const fmt = l => l.join(' + ');
  return 'Por lado: ' + (pa.length ? fmt(pa) : 'sin discos') + (pd && (poner.length || quitar.length) ? ' · ' +
    [quitar.length ? 'quita ' + fmt(quitar) : '', poner.length ? 'pon ' + fmt(poner) : ''].filter(Boolean).join(' y ') : '');
}
function tipIA(n, st) {
  if (st.ia && st.ia.pideRir) return '<div class="ia pide' + (ANIM_IA === n ? ' entra' : '') + '"><span>👆 Toca cómo terminó y te digo peso y reps de la siguiente</span></div>';
  if (!st.ia || !st.ia.mensaje) return '';
  const p = st.ia.motor ? st.ia.motor.paso : null;
  const sAct = st.sets[st.ia.i], disc = sAct ? cambioDiscos(exDe(n), sAct.w, st.ia.peso, st.unit) : '';
  return '<div class="ia' + (ANIM_IA === n ? ' entra' : '') + '"><span>' + (st.ia.fuente === 'ia' ? '✨ ' : '💡 ') + esc(st.ia.mensaje) +
    (st.ia.afinando ? ' <i class="muted" style="font-size:12px">· tu coach lo revisa…</i>' : '') + '</span>' +
    (st.ia.usar ? '<button class="btn sm" onclick="usarIA(\'' + n + '\')">Usar</button>' : '') + '</div>' +
    (disc ? '<div class="discos">🏋️ ' + esc(disc) + '</div>' : '') +
    (st.ia.pasoDudoso && p ? '<div class="pasoq"><span>¿De cuánto en cuánto sube este equipo? (' + esc(st.unit) + ')</span><div>' +
      (st.unit === 'kg' ? [1.25, 2.5, 5, 10] : [2.5, 5, 10, 15]).map(v => '<button class="' + (v === p ? 'on' : '') + '" onclick="fijarPaso(\'' + n + '\',' + v + ')">' + v + '</button>').join('') + '</div></div>' : '');
}

// El siguiente ejercicio pendiente: primero en la sección del que acabas de hacer, luego en las demás
function siguiente(g, actual) {
  if (!DATA.exercises.some(e => e.group === g)) return '';
  const secs = ordenGrupo(g).filter(x => x.length);
  const dentro = secs.find(x => x.some(e => e.name === actual));
  const orden = dentro ? [dentro].concat(secs.filter(x => x !== dentro)) : secs;
  for (const sec of orden) { const e = sec.find(e => !state[e.name].done && !cardDone(e.name) && e.name !== actual && (parOn() || !esDeOtro(e))); if (e) return e.name; }
  return '';
}
function elegirGrupo(g) {
  if (!FECHA) { GRUPO_MANUAL = g !== grupoDeHoy(); GRUPO_DIA = hoy(); }
  guardarPendientes();
  GRUPO = g; BUSCA = ''; OPEN = siguiente(g, ''); pintarEntrenar();
}
// Varias tarjetas pueden estar abiertas: la que tocaste (OPEN) y las que van a la mitad (las cierras tocándolas)
const CERRADAS = {};
function enMarcha(base) {
  const yo = state[base], pa = parOn() ? state[parKey(base)] : null, va = st => !!st && !st.done && st.sets.some(s => s.ok);
  return va(yo) || va(pa);
}
function abrir(name) {
  guardarPendientes(name);
  const p = companero(name), abierta = OPEN === name || (p && OPEN === p) || (enMarcha(name) && !CERRADAS[name] && !cardDone(name));
  if (abierta) { CERRADAS[name] = true; if (p) CERRADAS[p] = true; OPEN = ''; } else { delete CERRADAS[name]; if (p) delete CERRADAS[p]; OPEN = name; }
  ANIM_ABRE = OPEN;
  if (OPEN && ajuste('calentamiento', true) && calientaConSeries(exDe(OPEN)) && !state[OPEN].edited && !state[OPEN].sets.some(s => s.t === 'C')) agregarCalentamiento(OPEN, true);
  if (OPEN) LS.set('gym_tipcount', LS.get('gym_tipcount', 0) + 1);
  pintarEntrenar();
  if (OPEN) irA(OPEN);
}
function irA(name) {
  setTimeout(() => {
    const el = document.getElementById('ex-' + name);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - (sesionActiva() && !FECHA ? 76 : 12);
    window.scrollTo({ top: y, behavior: 'smooth' });
  }, 40);
}
function cambio(name, redibujar) {
  state[name].edited = true; guardarWip(name);
  if (redibujar !== false) pintarEntrenar();
}
// Al cambiar el peso de la primera serie de trabajo, las pendientes que tenían ese mismo peso lo copian
function ponerPeso(st, i, nv) {
  const old = st.sets[i].w;
  const primera = st.sets.findIndex(s => s.t === 'T');
  st.sets[i].w = nv;
  if (i === primera) st.sets.forEach((s, k) => { if (k > i && !s.ok && s.t === 'T' && (s.w === old || vacio(s.w))) s.w = nv; });
}
function addSet(name) { const st = state[name], l = st.sets[st.sets.length - 1]; st.sets.push({ w: l.w, r: l.r, t: 'T', ok: false }); cambio(name); }
function delSet(name) { if (state[name].sets.length > 1) state[name].sets.pop(); cambio(name); }
// El esfuerzo es de la última serie que marcaste (cada serie guarda el suyo)
function ultimaMarcada(st) { for (let k = st.sets.length - 1; k >= 0; k--) if (st.sets[k].ok) return k; return -1; }
function setRir(name, v) {
  const st = state[name], k = ultimaMarcada(st);
  if (k < 0) { st.rir = st.rir === v ? '' : v; return cambio(name); }
  const s = st.sets[k];
  s.e = s.e === v ? '' : v;
  st.rir = s.e;
  // Con todas las series hechas, elegir el esfuerzo es el último paso: guarda y pasa al siguiente
  if (s.e && terminado(st) && !st.done) { cambio(name, false); return setTimeout(() => guardar(name, true), 250); }
  if (s.t !== 'C') decidirSerie(name, k);
  cambio(name);
  if (s.e && s.t !== 'C') { clearTimeout(IA_TIMER[name]); consejoIA(name, k); }
  // En pareja ya no se cambia de pestaña solo: el otro puede estar en otro ejercicio o no hacer este
}
// Terminado = todas las series de TRABAJO palomeadas: un calentamiento que no marcaste no lo frena
function terminado(st) {
  const t = st.sets.filter(x => x.t !== 'C');
  return st.sets.length > 0 && (t.length ? t : st.sets).every(x => x.ok);
}
// Ejercicios terminados sin guardar: se guardan al irte a otro. Al terminar la sesión (parciales) también los que
// llevan alguna serie de trabajo hecha: se suben solo las series que palomeaste
function guardarPendientes(excepto, parciales) {
  Object.keys(state).forEach(k => {
    const st = state[k];
    if (baseDe(k) === excepto || baseVista(k) === excepto || st.done || !st.sets.length) return;
    if (terminado(st) || (parciales && st.sets.some(x => x.ok && x.t !== 'C'))) guardar(k, false, true);
  });
}
function setNotas(name, v) { state[name].notas = v; cambio(name, false); }
function setUnit(name, u) {
  const st = state[name], ex = exDe(name), de = st.unit;
  if (u !== de && ex) {
    const f = u === 'kg' ? 1 / KG_A_LB : KG_A_LB, p = pasoEj(ex, { unit: u });
    st.sets.forEach(s => { if (!vacio(s.w) && Number(s.w)) s.w = alPaso(Number(s.w) * f, p); });
  }
  st.unit = u; cambio(name);
}
function cambiarTipo(name, i) {
  const s = state[name].sets[i];
  s.t = s.t === 'T' ? 'C' : s.t === 'C' ? 'D' : 'T';
  cambio(name);
}
function anteriorDe(name, i) {
  const ex = exDe(name), st = state[name], s = st.sets[i];
  const pos = st.sets.slice(0, i + 1).filter(x => (x.t === 'C') === (s.t === 'C')).length - 1;
  return ex.anterior.filter(a => (a.t === 'C') === (s.t === 'C'))[pos];
}
function copiarAnterior(name, i) {
  const a = anteriorDe(name, i);
  if (!a) return;
  const st = state[name], s = st.sets[i], ex = exDe(name);
  // "Anterior" viene en la unidad de la vez pasada: si hoy anotas en la otra, se convierte
  const f = ex && ex.unit !== st.unit && Number(a.w) ? (st.unit === 'kg' ? 1 / KG_A_LB : KG_A_LB) : 1;
  s.w = f === 1 ? a.w : alPaso(Number(a.w) * f, pasoEj(ex, st)); s.r = a.r; s.t = a.t || s.t; hap('tecla');
  cambio(name);
}
function igualQueAntes(name) {
  const ex = exDe(name), st = state[name];
  // Los calentamientos de hoy se quedan (si no hay, van los de la vez pasada); las de trabajo copian peso y reps
  // de la vez pasada y conservan solo la palomita de la serie de trabajo con el mismo número
  const calHoy = st.sets.filter(x => x.t === 'C'), hechas = st.sets.filter(x => x.t !== 'C').map(x => !!x.ok);
  const cal = calHoy.length ? calHoy : ex.anterior.filter(a => a.t === 'C').map(a => ({ w: a.w, r: a.r, t: 'C', ok: false }));
  st.sets = cal.concat(ex.anterior.filter(a => a.t !== 'C').map((a, i) => ({ w: a.w, r: a.r, t: a.t || 'T', ok: !!hechas[i] })));
  hap('tecla'); cambio(name);
}
function usarSugerido(name) {
  const ex = exDe(name), st = state[name];
  st.sets.forEach(s => { if (s.t === 'T' && !s.ok) { s.w = ex.sugerido.w; s.r = ex.sugerido.r; } });
  cambio(name);
}

/* ----- v5.4: nota fija, cambio por máquina ocupada, calentamiento ----- */
// Cómo vas contra la última vez (fuerza estimada). Si fue menos, no se dice: un día malo es ruido, no retroceso
function textoCambio(p) {
  if (p === null || p === undefined) return '';
  if (p >= 1.5) return '↑ +' + p + '% de fuerza vs. la última vez';
  if (p > -1.5) return '= Igual que la última vez: carga consolidada';
  return '';
}
function editarAjuste(name) {
  state[name].editAjuste = true; pintarEntrenar();
  setTimeout(() => { const el = document.getElementById('aj-' + name); if (el) el.focus(); }, 50);
}
function guardarAjuste(name) {
  const el = document.getElementById('aj-' + name), v = el ? el.value.trim() : '';
  exDe(name).ajuste = v; state[name].editAjuste = false; delete BORR['aj-' + name];
  LS.set('gym_data', DATA);
  encolar('saveAjuste', [baseDe(name), v], 'aj-' + name, claveDe(name));
  toast(v ? 'Ajuste guardado: te aparece cada vez ✓' : 'Ajuste borrado');
  pintarEntrenar();
}
// Básicos con barra o por lado: ahí sí vale la pena calentar con series de aproximación
function esBasico(ex) { return ex.barra > 0 || ex.mult === 2 || ex.modalidad === 'Barra fija'; }
// Calentar con porcentajes solo donde el peso que anotas es la carga (no en dominadas ni con asistencia)
function calientaConSeries(ex) { return !!ex && esBasico(ex) && ex.modalidad !== 'Barra fija' && !(Number(ex.inc) < 0); }
function agregarCalentamiento(name, silencioso) {
  const ex = exDe(name), st = state[name];
  const t = st.sets.find(s => s.t === 'T' && !vacio(s.w) && Number(s.w) > 0);
  if (!t) { if (!silencioso) toast('Pon primero tu peso de trabajo'); return false; }
  const barra = st.unit === 'kg' ? Math.round(ex.barra / KG_A_LB) : ex.barra;
  // Barra sola × 10, 50 % × 8 y 75 % × 3 (motor.js); van marcadas C y no cuentan para volumen ni progresión
  const cal = MOTOR.calentamiento({ carga: Number(t.w) * ex.mult + barra, barra: barra, mult: ex.mult, paso: ex.step || 2.5 })
    .map(c => ({ w: c.w, r: c.r, t: 'C', ok: false }));
  if (!cal.length) { if (!silencioso) toast('Con ese peso no hace falta calentar con series'); return false; }
  st.sets = cal.concat(st.sets.filter(s => s.t !== 'C'));
  cambio(name);
  if (!silencioso) toast(cal.length + ' series de calentamiento: ' + cal.map(c => (c.w || (barra ? 'barra' : 0)) + '×' + c.r).join(', '));
  return true;
}
// Máquina ocupada: primero los del mismo movimiento (equivalentes de verdad), luego otros del mismo músculo.
// Dentro de cada grupo, los que ya has hecho van primero porque traen tu peso.
let CAMBIO = { de: null, quien: 'ambos' };
function elegirCambio(name, todos) {
  if (CAMBIO.de !== name) CAMBIO = { de: name, quien: 'ambos' };
  const ex = exDe(name);
  const libres = DATA.exercises.filter(e => e.name !== name && !state[e.name].done && !cardDone(e.name));
  const orden = (a, b) => (b.anterior.length ? 1 : 0) - (a.anterior.length ? 1 : 0);
  const mismo = ex.patron ? libres.filter(e => e.patron === ex.patron).sort(orden) : [];
  const musc = libres.filter(e => e.musculo === ex.musculo && !mismo.includes(e)).sort(orden);
  const fila = e => '<button onclick="usarCambio(\'' + jsq(e.name) + '\')"><b style="flex:1">' + esc(e.ejercicio) + '</b><span class="muted">' +
    (e.anterior.length ? resumenSets(e.anterior) : 'nuevo') + '</span></button>';
  const vars = esPar(name) ? [] : variantesDe(name).filter(e => libres.includes(e));
  const filaVar = e => '<button onclick="elegirVariante(\'' + jsq(name) + '\',\'' + jsq(e.name) + '\')"><b style="flex:1">' + badgeMod(e) + esc(e.ejercicio) + '</b><span class="muted">' +
    (e.anterior.length ? resumenSets(e.anterior) + ' ' + e.unit : 'nuevo') + '</span></button>';
  const sinVar = l => l.filter(e => !vars.includes(e));
  const top = sinVar(mismo.length ? mismo : musc).slice(0, 3), resto = sinVar(mismo.concat(musc)).filter(e => !top.includes(e));
  const q = parOn() ? '<div class="cquien">' + [['ambos', 'Los dos'], ['yo', 'Solo yo'], ['par', 'Solo ' + PAR.nombre]].map(o =>
    '<button class="' + (CAMBIO.quien === o[0] ? 'on' : '') + '" onclick="CAMBIO.quien=\'' + o[0] + '\';elegirCambio(\'' + jsq(name) + '\',' + !!todos + ')">' + esc(o[1]) + '</button>').join('') + '</div>' : '';
  $('sheet').innerHTML = '<div class="t2">Cambiar ' + esc(ex.ejercicio) + '</div>' + q +
    (vars.length ? '<div class="muted" style="margin:4px 0 6px">Mismo ejercicio, otro equipo (ahora: ' + esc(ex.modalidad || ex.howTo) + ')</div><div class="lista vars">' + vars.map(filaVar).join('') + '</div>' +
      '<div class="muted" style="margin:12px 0 0">O algo parecido:</div>' : '') + '<div class="muted" style="margin:4px 0 8px">' +
    (mismo.length ? 'Mismo movimiento (' + esc(ex.patron.toLowerCase()) + '). ' : 'Mismo músculo (' + esc(ex.musculo) + '). ') + 'Te carga tu peso de la última vez.</div>' +
    '<div class="lista">' + (top.length ? top.map(fila).join('') : '<div class="muted" style="padding:12px 0">No hay otro ejercicio equivalente en tu catálogo.</div>') +
    (todos && resto.length ? '<div class="muted" style="padding:10px 2px 2px">Otros de ' + esc(ex.musculo) + '</div>' + resto.map(fila).join('') : '') + '</div>' +
    '<div class="acts">' + (!todos && resto.length ? '<button class="btn ghost" onclick="elegirCambio(\'' + jsq(name) + '\', true)">Ver ' + resto.length + ' más</button>' : '') +
    '<button class="btn ghost" onclick="cerrarModal()">Cancelar</button></div>';
  abrirModal();
}
function usarCambio(name) {
  cerrarModal();
  const de = CAMBIO.de, quien = parOn() && de ? CAMBIO.quien : 'ambos';
  CAMBIO = { de: null, quien: 'ambos' };
  if (quien === 'par') {
    // Tú sigues en tu ejercicio; en tu tarjeta, la pestaña del compañero pasa a la variante
    const m = mapaPar(); m[de] = name; guardarMapaPar(m);
    QUIEN[de] = 'par'; OPEN = de; ANIM_ABRE = de;
    pintarEntrenar(); irA(de);
    return toast(PAR.nombre + ' hará ' + exDe(name).ejercicio + '; tú sigues en ' + exDe(de).ejercicio);
  }
  if (quien === 'yo') {
    // Tú cambias; tu compañero se queda con el original (su pestaña en tu tarjeta nueva)
    const m = mapaPar(); m[name] = m[de] || de; guardarMapaPar(m); QUIEN[name] = 'yo';
  }
  const g = exDe(name).group;
  if (g !== GRUPO) { GRUPO = g; GRUPO_MANUAL = true; GRUPO_DIA = hoy(); }
  BUSCA = ''; OPEN = name; ANIM_ABRE = name;
  pintarEntrenar(); irA(name);
  toast((quien === 'yo' ? 'Solo tú: ' : 'Cambiado: ') + exDe(name).ejercicio);
}

// Lo que toca hoy en un grupo: la ruta aceptada (si hay) y lo recomendado con lo añadido desde el mapa
const recomendadosHoy = g => ordenGrupo(g).slice(0, rutaAceptada(g) ? 2 : 1).flat();
/* ----- Mismo ejercicio, otro equipo (Catálogo V "Variante de"): barra ⇄ mancuerna ⇄ máquina ----- */
function variantesDe(name) {
  const ex = exDe(name);
  if (!ex || !ex.variante) return [];
  return DATA.exercises.filter(e => e.name !== ex.name && e.variante === ex.variante).sort((a, b) => (b.anterior.length ? 1 : 0) - (a.anterior.length ? 1 : 0));
}
function cambiosHoy() {
  if (FECHA) return {};
  const c = LS.get('gym_cambio_' + hoy(), {});
  Object.keys(c).forEach(k => { if (!exDe(k) || !exDe(c[k])) delete c[k]; });
  return c;
}
const originalDe = name => Object.keys(cambiosHoy()).find(k => cambiosHoy()[k] === name) || '';
function elegirVariante(de, a) {
  const ex = exDe(originalDe(de) || de), v = exDe(a), enRutina = ex.bloque === 'A' || ex.bloque === 'B';
  if (parOn()) { CAMBIO = { de: de, quien: CAMBIO.quien }; return usarCambio(a); }   // en pareja: el cambio de siempre (los dos, solo yo o solo él)
  $('sheet').innerHTML = '<div class="t2">' + esc(v.ejercicio) + '</div><div class="muted" style="margin:4px 0 12px">En lugar de ' + esc(ex.ejercicio) +
    '. ' + esc(MOTOR.comoAnotar(v).texto) + '.</div><div class="menu">' +
    '<button onclick="usarVariante(\'' + jsq(de) + '\',\'' + jsq(a) + '\',false)"><span class="i">📅</span><span><b>' + (FECHA ? 'Usarlo ese día' : 'Solo hoy') + '</b><small>' +
      (FECHA ? 'Sin cambiar tu rutina' : 'Mañana vuelve ' + esc(ex.ejercicio.split(' (')[0])) + '</small></span></button>' +
    (enRutina ? '<button onclick="usarVariante(\'' + jsq(de) + '\',\'' + jsq(a) + '\',true)"><span class="i">📌</span><span><b>Siempre en mi rutina</b><small>Queda en tu bloque ' + ex.bloque + ' (también en tu hoja)</small></span></button>' : '') +
    '</div><div class="acts"><button class="btn ghost" onclick="elegirCambio(\'' + jsq(de) + '\')">Atrás</button></div>';
  abrirModal();
}
function usarVariante(de, a, siempre) {
  cerrarModal();
  if (FECHA && !siempre) { CAMBIO = { de: de, quien: 'ambos' }; return usarCambio(a); }   // otro día: solo te lleva al otro
  const st = state[de];
  if (st && st.sets.some(s => s.ok)) { CAMBIO = { de: de, quien: 'ambos' }; return usarCambio(a); }   // ya empezaste: solo te lleva al otro
  // Siempre se cambia desde el original (si hoy ya lo habías cambiado por otra variante)
  const raiz = originalDe(de) || de, c = cambiosHoy();
  delete c[raiz]; delete c[de]; delete c[a];
  if (siempre) {
    // El bloque pasa a la variante: aparece sola en tu rutina, sin cambio "de hoy"
    const ex = exDe(raiz), v = exDe(a), b = ex.bloque;
    ex.bloque = v.bloque; v.bloque = b;
    LS.set('gym_data', DATA);
    encolar('cambiarVariante', [raiz, a, ex.bloque || '', v.bloque || ''], 'var-' + raiz);
  } else if (a !== raiz) c[raiz] = a;
  LS.set('gym_cambio_' + hoy(), c);
  BUSCA = ''; OPEN = a; ANIM_ABRE = a; hap('ok');
  pintarEntrenar(); irA(a);
  toast((siempre ? 'En tu rutina: ' : 'Solo hoy: ') + exDe(a).ejercicio);
}
function volverOriginal(a) {
  const c = cambiosHoy(), de = originalDe(a);
  delete c[de]; LS.set('gym_cambio_' + hoy(), c);
  cerrarModal(); OPEN = de; ANIM_ABRE = de; pintarEntrenar(); irA(de);
}

/* ----- Superserie: dos ejercicios alternados; el descanso se sugiere al terminar el par ----- */
function elegirSuper(name) {
  const ex = exDe(name);
  const opciones = DATA.exercises.filter(e => e.group === ex.group && e.name !== name && !state[e.name].done);
  $('sheet').innerHTML = '<div class="t2">Superserie con…</div><div class="muted" style="margin:4px 0 8px">Haces una serie de cada uno, alternando. El descanso se sugiere al terminar el par.</div>' +
    '<div class="lista">' + opciones.map(e => '<button onclick="ponerSuper(\'' + jsq(name) + '\',\'' + jsq(e.name) + '\')"><b style="flex:1">' + esc(e.ejercicio) + '</b><span class="muted">' + esc(e.musculo) + '</span></button>').join('') + '</div>' +
    '<div class="acts"><button class="btn ghost" onclick="cerrarModal()">Cancelar</button></div>';
  abrirModal();
}
function ponerSuper(a, b) { LS.set('gym_super_' + diaReg(), [a, b]); cerrarModal(); OPEN = a; pintarEntrenar(); irA(a); }
function quitarSuper() { LS.del('gym_super_' + diaReg()); pintarEntrenar(); }

/* ----- Teclado numérico grande ----- */
let KP = null;
const PLATOS = { lb: [45, 35, 25, 10, 5, 2.5], kg: [20, 15, 10, 5, 2.5, 1.25] };
// Discos por lado para un peso "por lado" (o null si no se puede armar exacto)
function platos(porLado, unit) {
  let resto = Math.round(porLado * 100) / 100;
  const out = [];
  for (const p of PLATOS[unit] || PLATOS.lb) { while (resto >= p - 0.001) { out.push(p); resto = Math.round((resto - p) * 100) / 100; } }
  return resto > 0.01 ? null : out;
}
function teclado(name, i, f) {
  const st = state[name], ex = exDe(name), s = st.sets[i];
  KP = { name: name, i: i, f: f, val: vacio(s[f]) ? '' : String(s[f]), nuevo: true };
  // Con el paso del equipo confirmado (ej. barra fija de 10 en 10), los ± solo ofrecen pesos que existen
  const pf = pasoEj(ex, st);
  const quick = f === 'w' ? (ex.pasoFijo ? [-2 * pf, -pf, pf, 2 * pf] : [-10, -5, -ex.step, ex.step, 5, 10]).map(v => Math.round(v * 100) / 100) : [-2, -1, 1, 2];
  const unicos = quick.filter((v, k) => quick.indexOf(v) === k);
  const num = st.sets.slice(0, i + 1).filter(x => x.t !== 'C').length;
  const como = MOTOR.comoAnotar(ex);
  const titulo = (s.t === 'C' ? 'Calentamiento' : s.t === 'D' ? 'Drop' : 'Serie ' + num) + ' · ' + (f === 'w' ? '<b class="anota">' + esc(como.texto || 'Peso') + ' (' + st.unit + ')</b>' : 'repeticiones');
  $('kpSheet').innerHTML = '<div class="row between"><div class="t1">' + esc(ex.ejercicio) + '</div><button class="btn ghost sm" onclick="cerrarTeclado()">✕</button></div>' +
    '<div class="muted" style="text-align:center;margin-top:8px">' + titulo + '</div><div class="disp num" id="kpDisp"></div>' +
    (f === 'w' && ex.mult === 2 ? '<div class="platos" id="kpPlatos"></div>' : '') +
    (f === 'w' && como.corto === 'total' ? '<div class="platos">Es el total' + (ex.modalidad === 'Barra fija' ? ' de la barra fija' : '') + ': no lo dividas entre 2</div>' : '') +
    '<div class="quick" style="grid-template-columns:repeat(' + unicos.length + ',1fr)">' + unicos.map(v => '<button onclick="kpSumar(' + v + ')">' + (v > 0 ? '+' : '−') + Math.abs(v) + '</button>').join('') + '</div>' +
    teclas() +
    '<div class="acts"><button class="btn ghost" onclick="kpListo(false)">Listo</button>' +
    '<button class="btn" onclick="kpListo(true)">' + ICO.check.replace('class="icon"', 'class="icon" style="vertical-align:-4px;margin-right:4px"') + 'Y serie hecha</button></div>';
  kpPintar();
  $('kp').classList.add('show');
}
function teclas() { return '<div class="keys">' + ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map(k => '<button onclick="kpTecla(\'' + k + '\')">' + k + '</button>').join('') + '</div>'; }
function kpPintar() {
  $('kpDisp').textContent = KP.val === '' ? '0' : KP.val;
  const el = $('kpPlatos');
  if (el && KP.name) {
    const ex = exDe(KP.name), unit = state[KP.name].unit, w = Number(KP.val) || 0;
    const lista = platos(w, unit);
    const total = Math.round((w * 2 + (unit === 'kg' ? Math.round(ex.barra / KG_A_LB) : ex.barra)) * 10) / 10;
    el.innerHTML = w ? 'Por lado: <b>' + (lista ? lista.join(' + ') : 'no sale exacto con discos') + '</b> · total ' + total + ' ' + unit + (ex.barra ? ' con barra' : '') : 'Pon el peso de un lado';
  }
}
function kpTecla(k) {
  if (k === '⌫') KP.val = KP.nuevo ? '' : KP.val.slice(0, -1);
  else if (k === '.') { if (KP.f === 'r') return; KP.val = (KP.nuevo || KP.val === '' ? '0' : KP.val) + (KP.val.includes('.') && !KP.nuevo ? '' : '.'); }
  else KP.val = (KP.nuevo ? '' : KP.val) + k;
  KP.nuevo = false; hap('tecla'); kpPintar();
}
function kpSumar(v) {
  // En el peso, los botones ± parten de tu último peso si la casilla está vacía
  const cur = KP.val === '' && KP.peso && DATA.ultimoPeso !== null ? DATA.ultimoPeso : (Number(KP.val) || 0);
  KP.val = String(Math.max(0, Math.round((cur + v) * 100) / 100));
  KP.nuevo = false; hap('tecla'); kpPintar();
}
function kpListo(marcarSerie) {
  const st = state[KP.name], nv = KP.val === '' ? '' : Number(KP.val);
  if (KP.f === 'w') ponerPeso(st, KP.i, nv); else st.sets[KP.i].r = nv;
  const { name, i } = KP;
  cerrarTeclado();
  cambio(name);
  if (marcarSerie && !st.sets[i].ok) marcar(name, i);
}
function cerrarTeclado() { $('kp').classList.remove('show'); }
function tecladoPeso(dia) {
  PESO_DIA = dia || null;
  // Sin peso de hoy, arranca en el último: solo le subes o bajas (o tecleas encima, se borra al primer número)
  const tmp = PESO_TMP === null || PESO_TMP === undefined ? '' : PESO_TMP, ult = DATA.ultimoPeso;
  const base = tmp !== '' ? tmp : ult !== null && ult !== undefined ? ult : '';
  KP = { peso: true, val: base === '' ? '' : String(base), nuevo: true, f: 'w' };
  $('kpSheet').innerHTML = '<div class="row between"><div class="t1">Peso en ayunas (kg)</div><button class="btn ghost sm" onclick="cerrarTeclado()">✕</button></div>' +
    (tmp === '' && base !== '' ? '<div class="muted" style="text-align:center;margin-top:6px">Te puse el último (' + ult + ' kg): ajústalo con − / + o escribe el nuevo</div>'
      : ult !== null && ult !== undefined ? '<div class="muted" style="text-align:center;margin-top:6px">Último: ' + ult + ' kg</div>' : '') +
    '<div class="disp num" id="kpDisp"></div><div class="quick" style="grid-template-columns:repeat(4,1fr)">' +
    [-0.5, -0.1, 0.1, 0.5].map(v => '<button onclick="kpSumar(' + v + ')">' + (v > 0 ? '+' : '−') + Math.abs(v) + '</button>').join('') + '</div>' + teclas() +
    '<div class="acts"><button class="btn ghost" onclick="kpPeso(false)">Listo</button><button class="btn" onclick="kpPeso(true)">Guardar peso</button></div>';
  kpPintar(); $('kp').classList.add('show');
}
function kpPeso(guardarYa) { PESO_TMP = KP.val === '' ? '' : Number(KP.val); cerrarTeclado(); if (guardarYa) guardarPeso(); else pintarEntrenar(); }

/* ----- Series y guardado ----- */
function iniciarSesion() {
  if (FECHA) return;
  const s = sesion();
  if (!s.start || s.ended) { s.start = Date.now(); s.ended = false; if (!s.log) s.log = []; guardarSesion(s); }
  pedirPantalla();
}
let CERO_OK = '', ULT_SERIE = '';
function marcar(name, i) {
  desbloquearAudio();
  const st = state[name], s = st.sets[i], ex = exDe(name);
  if (!s.ok && vacio(s.r)) return toast('Pon las repeticiones de esta serie');
  if (!s.ok && vacio(s.w) && !ex.sinPeso) return toast('Pon el peso de esta serie');
  // 0 en una máquina con peso casi siempre es un error (o una serie que no era tuya): pide confirmar
  if (!s.ok && Number(s.w) === 0 && !ex.sinPeso && ex.inc > 0 && !ex.barra && ex.modalidad !== 'Corporal' && CERO_OK !== name + '#' + i) {
    CERO_OK = name + '#' + i; setTimeout(() => { if (CERO_OK === name + '#' + i) CERO_OK = ''; }, 5000);
    hap('atencion'); return toast((esPar(name) ? quienDe(name) : '') + '¿0 ' + state[name].unit + '? Pon el peso, o toca ✓ otra vez si de verdad fue sin peso');
  }
  const base = baseVista(name), antes = enMarcha(base);
  delete CERRADAS[base];
  s.ok = !s.ok;
  if (s.ok) { hap('serie'); iniciarSesion(); ANIM_SET = name + '#' + i; ULT_SERIE = name; }
  cambio(name, false);
  const pinta = () => antes !== enMarcha(base) && TAB === 'Entrenar' && !BUSCA ? moverTarjeta(base) : pintarEntrenar();
  if (!s.ok) return pinta();
  if (!terminado(st) && s.t !== 'C') { decidirSerie(name, i); clearTimeout(IA_TIMER[name]); }
  pinta();
  // Última serie: la tarjeta se queda abierta para que marques cómo terminó; al tocar el esfuerzo se guarda
  if (terminado(st)) {
    setTimeout(() => { const el = document.querySelector('[id="ex-' + baseVista(name) + '"] .rirx'); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60);
    return;
  }
  // Coach IA: espera unos segundos por si marcas el esfuerzo de esta serie; si lo marcas, pregunta al momento
  if (s.t !== 'C' && st.ia && !st.ia.pideRir) IA_TIMER[name] = setTimeout(() => consejoIA(name, i), 4000);
  if (s.t === 'C' || FECHA) return;
  const p = companero(name);
  if (p && !state[p].done) {
    // Superserie: el descanso va cuando la misma serie DE TRABAJO del otro ejercicio también está hecha
    // (se cuentan sin calentamientos: si uno los tiene y el otro no, los números no coinciden)
    const n = st.sets.slice(0, i + 1).filter(x => x.t !== 'C').length, otra = state[p].sets.filter(x => x.t !== 'C')[n - 1];
    if (!otra || otra.ok) sugerirDescanso();
    return;
  }
  sugerirDescanso();
}
/* ----- Coach IA: después de cada serie de trabajo te dice qué hacer en la siguiente ----- */
const RIR_DE = { 'Al fallo': 0, 'Casi (1–2 más)': 1.5, 'Sobraban 3+': 3 };
const ETQ_E = { 'Al fallo': 'FALLO', 'Casi (1–2 más)': 'RIR 1–2', 'Sobraban 3+': 'RIR 3+' };
const IA_TIMER = {};
let IA_AVISADO = false;
// i = índice de la serie que acabas de marcar en state[name].sets
function payloadIA(name, i) {
  const ex = exDe(name), st = state[name], s = st.sets[i];
  const trabajo = st.sets.filter(x => x.t !== 'C');
  const serie = x => ({ peso: Number(x.w) || 0, reps: Number(x.r) || 0, tipo: x.t || 'T', rir: x.e ? RIR_DE[x.e] : null });
  return {
    ejercicio: ex.ejercicio,
    modalidad: ex.modalidad || '',
    unidad: st.unit,
    como_anotar: ex.howTo,
    rango_reps: [ex.min, ex.max],
    paso: ex.paso || ex.step,
    serie_actual: Object.assign(serie(s), { numero: trabajo.indexOf(s) + 1, de: trabajo.length }),
    series_hoy: st.sets.filter(x => x.ok).map(serie),
    rir_ultima_serie: s.e ? RIR_DE[s.e] : null,
    sesion_anterior: ex.anterior.length
      ? { fecha: ex.lastWhen, series: ex.anterior.filter(a => a.t !== 'C').map(a => ({ peso: Number(a.w) || 0, reps: Number(a.r) || 0 })), rir: ex.rirUlt === undefined ? null : ex.rirUlt }
      : null,
    regla_app: ex.hint || '',
    descarga: !!DATA.descargaCarrera,
    recuperacion: esPar(name) ? null : recuperacion(),
    ejercicio_terminado: terminado(st)
  };
}
/* ----- Motor de la siguiente serie: matemática exacta, al instante y sin señal ----- */
// Paso real del equipo en la unidad que estás anotando (Catálogo P; si no, el que se dedujo de tu historial)
function pasoEj(ex, st) {
  const p = Math.abs(ex.paso || ex.step || 2.5);
  if (!st || st.unit === ex.unit) return p;
  return st.unit === 'kg' ? (p >= 10 ? 5 : p >= 5 ? 2.5 : 1.25) : (p >= 5 ? 10 : 5);
}
const alPaso = (w, p, modo) => { const f = modo === 'abajo' ? Math.floor : modo === 'arriba' ? Math.ceil : Math.round; return Math.round(f(Number(w) / p + 1e-9) * p * 100) / 100; };
// Opciones para la serie que sigue: la matemática vive en motor.js (probada en tests/motor.test.js)
function motorSerie(name, i) {
  const ex = exDe(name), st = state[name], s = st && st.sets[i];
  if (!ex || !s || s.t === 'C' || vacio(s.r) || terminado(st)) return null;
  const pend = st.sets.filter(x => !x.ok && x.t !== 'C');
  const rec = esPar(name) ? null : recuperacion();
  const m = MOTOR.siguienteSerie({
    peso: Number(s.w) || 0, reps: Number(s.r), rir: s.e ? RIR_DE[s.e] : null, min: ex.min, max: ex.max,
    paso: pasoEj(ex, st), unidad: st.unit, mult: ex.mult, barra: ex.barra, inc: ex.inc, modalidad: ex.modalidad, sinPeso: ex.sinPeso,
    corpKg: (esPar(name) && PAR && PAR.data ? PAR.data.ultimoPeso : DATA.ultimoPeso) || 72, ultima: pend.length === 1,
    recMala: !!(rec && (rec.sueno === 'Mal' || rec.energia === 'Baja')), sinSubir: !!DATA.descargaCarrera || (!FECHA && !esPar(name) && descargaActiva()), caida: ex.caida
  });
  if (!m || m.pideRir) return m;
  const op = m.opciones.find(o => o.id === m.eleccion);
  m.pasoDudoso = !ex.pasoFijo && (op.accion === 'bajar' || op.accion === 'subir');
  return m;
}
// Lo que se ve debajo de la serie: el motor responde al instante; si hay IA y señal, la IA elige y explica
function decidirSerie(name, i) {
  const st = state[name], m = motorSerie(name, i);
  if (!m) { if (st) st.ia = null; return; }
  // Sin el esfuerzo de la serie no hay consejo: primero un toque en "¿Cómo terminó?"
  if (m.pideRir) { st.ia = { pideRir: true, i: i }; return; }
  const op = m.opciones.find(o => o.id === m.eleccion);
  const dudo = m.pasoDudoso && op.accion !== 'mantener';
  st.ia = { mensaje: op.mensaje + (dudo ? ' Si tu equipo no sube de ' + m.paso + ' en ' + m.paso + ', elige su paso abajo.' : ''), peso: op.peso, reps: op.reps, fuente: 'reglas', motor: m, i: i, pasoDudoso: dudo,
            usar: usarAplica(st, op) };
  ANIM_IA = jsq(name);
}
function usarAplica(st, op) { const sig = st.sets.find(x => !x.ok && x.t !== 'C'); return !!sig && op.peso !== null && (Number(sig.w) !== op.peso || Number(sig.r) !== op.reps); }
let IA_SEQ = 0;
async function consejoIA(name, i) {
  const st = state[name];
  if (!st || st.done || FECHA || terminado(st)) return;
  decidirSerie(name, i);
  if (TAB === 'Entrenar' && tarjetaVisible(baseVista(name))) pintarEntrenar();
  if (!st.ia || st.ia.pideRir || !ajuste('ia', true) || !navigator.onLine || !DATA.ia) return;
  const seq = ++IA_SEQ, m = st.ia.motor;
  st.ia.afinando = true;
  try {
    const pl = Object.assign(payloadIA(name, i), { opciones: m.opciones.map(o => ({ id: o.id, accion: o.accion, peso: o.peso, reps: o.reps, mensaje: o.mensaje })),
      eleccion_reglas: m.eleccion, caida_reps: exDe(name).caida || null, paso: m.paso || pasoEj(exDe(name), st) });
    const r = await conLimite(apiPost('ia', [pl], claveDe(name)), 12000);
    if (seq !== IA_SEQ || !state[name] || state[name].done || !state[name].ia) return;
    const op = m.opciones.find(o => o.id === r.opcion) || m.opciones.find(o => o.id === m.eleccion);   // la IA solo elige; los números son del motor
    // Todo consejo lleva números: si el texto de la IA no trae ninguno, se queda el del motor
    Object.assign(state[name].ia, { mensaje: r.mensaje && /\d/.test(r.mensaje) ? r.mensaje : op.mensaje, peso: op.peso, reps: op.reps, fuente: r.ia === false ? 'reglas' : 'ia', afinando: false,
      pasoDudoso: m.pasoDudoso && op.accion !== 'mantener', usar: usarAplica(state[name], op) });
    ANIM_IA = jsq(name);
  } catch (e) {
    if (state[name] && state[name].ia) state[name].ia.afinando = false;   // se queda el consejo del motor
    if (e.message !== 'tiempo' && !/Failed to fetch|NetworkError|Load failed/i.test(e.message) && !IA_AVISADO) { IA_AVISADO = true; toast('Coach IA: ' + e.message.slice(0, 120)); }
  }
  if (TAB === 'Entrenar' && tarjetaVisible(baseVista(name))) pintarEntrenar();
}
// "Usar": el peso nuevo va a TODAS las series pendientes (una serie de retroceso se sostiene) y las reps a la siguiente
function usarIA(name) {
  const st = state[name], ia = st.ia, pend = st.sets.filter(x => !x.ok && x.t !== 'C');
  if (!ia || !pend.length) return;
  pend.forEach((x, k) => { x.w = ia.peso; if (k === 0) x.r = ia.reps; });
  st.ia.usar = false; hap('ok');
  cambio(name);
  const r = LS.get('gym_rest', null);
  if (r && !r.fired) programarAviso(r);   // el aviso del descanso ya dice el peso nuevo
}
// Paso de la máquina: se confirma una vez y queda en el Catálogo (columna P)
function fijarPaso(name, p) {
  const ex = exDe(name), base = baseDe(name);
  [base, 'P|' + base].forEach(k => { const e = exDe(k); if (e) { e.paso = p; e.step = p; e.pasoFijo = true; } });
  LS.set('gym_data', DATA);
  encolar('savePaso', [base, p], 'paso-' + base);
  if (PAR && PAR.exs && PAR.exs['P|' + base]) encolar('savePaso', [base, p], 'paso-P|' + base, PAR.key);
  hap('ok'); toast('Listo: ' + ex.ejercicio + ' sube de ' + p + ' en ' + p);
  const st = state[name];
  if (st && st.ia && st.ia.i !== undefined) consejoIA(name, st.ia.i); else pintarEntrenar();
}
function cargaReal(ex, w, unit) { return (Number(w) || 0) * ex.mult * (unit === 'kg' ? KG_A_LB : 1) + ex.barra; }
// Para el volumen: en las asistidas la carga es tu peso menos la asistencia (más asistencia = menos trabajo)
function cargaVol(ex, w, unit) {
  return Number(ex.inc) < 0 ? Math.max(0, (Number(DATA.ultimoPeso) || 72) * KG_A_LB - (Number(w) || 0) * (unit === 'kg' ? KG_A_LB : 1)) : cargaReal(ex, w, unit);
}

function guardar(name, auto, silencioso) {
  const st = state[name], ex = exDe(name);
  if (st.done) return;
  const marcadas = st.sets.filter(s => s.ok);
  const sets = (marcadas.length ? marcadas : st.sets).filter(s => !vacio(s.r))
    .map(s => ({ w: Number(s.w || 0), r: Number(s.r), t: s.t || 'T', rpe: RPE[s.e] || '' }));
  if (!sets.length) return toast('Pon al menos las repeticiones de una serie');
  iniciarSesion();
  st.uid = uid(); st.done = true; st.edited = false; guardarWip(name);
  encolar('saveExercise', [{ name: baseDe(name), unit: st.unit, sets: sets, rpe: RPE[st.rir] || '', notas: st.notas,
                              ts: tsReg(), uid: st.uid, day: diaReg() }], null, claveDe(name));
  // Récords: fuerza estimada, peso y repeticiones con el mismo peso; y cómo vas contra la última vez
  const prs = [];
  let cambioPct = null;
  if (!ex.sinPeso && ex.inc > 0) {
    const efectivas = sets.filter(s => s.t !== 'C' && s.r > 0);
    const cargas = efectivas.map(s => ({ c: cargaReal(ex, s.w, st.unit), r: s.r }));
    const mejorE1 = Math.max.apply(null, cargas.map(x => x.c * (1 + x.r / 30)).concat([0]));
    const mejorCarga = Math.max.apply(null, cargas.map(x => x.c).concat([0]));
    if (ex.best && mejorE1 > ex.best + 0.05) prs.push('fuerza');
    if (ex.bestCarga && mejorCarga > ex.bestCarga + 0.05) prs.push('peso');
    if (!prs.length && cargas.some(x => { const prev = ex.repsEn[String(Math.round(x.c * 2) / 2)]; return prev && x.r > prev; })) prs.push('repeticiones');
    if (ex.ultE1 && mejorE1 > 0) cambioPct = Math.round((mejorE1 / ex.ultE1 - 1) * 1000) / 10;
  }
  if (!FECHA && !esPar(name)) {
    const ses = sesion();
    ses.log = ses.log.filter(l => l.name !== name);
    ses.log.push({ name: name, ej: ex.ejercicio, sets: sets, unit: st.unit, prs: prs, uid: st.uid, cambio: cambioPct,
                   vol: sets.filter(s => s.t !== 'C').reduce((a, s) => a + cargaVol(ex, s.w, st.unit) * s.r, 0) });
    guardarSesion(ses);
    actualizarWidgets();
  }
  const deshacerUlt = { txt: 'Deshacer', fn: () => corregir(name) };
  const vsUlt = textoCambio(cambioPct);
  if (prs.length) { hap('pr'); toast(quienDe(name) + '¡Récord de ' + prs.join(' y ') + '!' + (cambioPct >= 1 ? ' ' + vsUlt : ''), 'pr', deshacerUlt); }
  else toast(quienDe(name) + (vsUlt || (navigator.onLine ? 'Guardado ✓' : 'Guardado en el celular; se sube con señal')), '', deshacerUlt);
  const p = companero(name);
  if (p && state[p].done) LS.del('gym_super_' + diaReg());
  if (silencioso) return;
  // En pareja: al guardar uno, la tarjeta sigue abierta en la pestaña del otro si le falta
  if (parOn()) {
    const base = baseVista(name), otro = esPar(name) ? base : parKey(base);
    const so = state[otro], ladoOtro = esPar(name) ? 'yo' : 'par';
    // Solo se queda abierta en la pestaña del otro si él ya va a la mitad de este ejercicio
    if (so && !so.done && !saltado(base, ladoOtro) && so.sets.some(x => x.ok)) { QUIEN[base] = ladoOtro; OPEN = base; conTransicion(pintarEntrenar); irA(base); return; }
    delete QUIEN[base];
    name = base;
  }
  if (auto && p && !state[p].done) OPEN = p;
  else OPEN = auto && ex.group === GRUPO && !BUSCA ? siguiente(GRUPO, name) : '';
  conTransicion(pintarEntrenar);
  if (OPEN) irA(OPEN);
}
// La tarjeta terminada se desliza a "Completados" en vez de saltar (Chrome; sin efecto si no lo soporta)
function conTransicion(fn) {
  const quieto = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (document.startViewTransition && !quieto) document.startViewTransition(fn); else fn();
}
function quitarRegistro(name) {
  const st = state[name];
  const q = cola(), pend = q.find(op => op.action === 'saveExercise' && op.args[0].uid === st.uid);
  if (pend) guardarCola(q.filter(op => op !== pend));
  // Si ya iba en camino (o la respuesta se perdió), la hoja pudo guardarlo: se manda el borrado (si no estaba, no pasa nada)
  if ((!pend || pend.enviado) && st.uid) encolar('undoById', [st.uid], null, claveDe(name));
  if (!esPar(name)) { const ses = sesion(); ses.log = ses.log.filter(l => l.name !== name); guardarSesion(ses); }
  st.uid = ''; st.done = false; OPEN = baseVista(name);
  if (parOn()) QUIEN[baseVista(name)] = esPar(name) ? 'par' : 'yo';
}
function deshacer(name) {
  quitarRegistro(name);
  state[name] = nuevoEstado(exDe(name), false, '');
  state[name].dia = diaReg();
  pintarEntrenar(); toast('Borrado');
}
// Regresa el ejercicio a edición con las series que habías marcado
function corregir(name) {
  const st = state[name];
  const op = cola().find(o => o.action === 'saveExercise' && o.args[0].uid === st.uid);
  const log = sesion().log.find(l => l.name === name);
  const sets = op ? op.args[0].sets : log ? log.sets : null;
  quitarRegistro(name);
  const eDe = rpe => Object.keys(RPE).find(k => RPE[k] === rpe) || '';
  if (sets) st.sets = sets.map(s => ({ w: s.w, r: s.r, t: s.t, ok: true, e: eDe(s.rpe) }));
  else st.sets.forEach(s => { s.ok = false; });
  cambio(name);
  irA(baseVista(name));
}

/* ----- Sesión, pantalla encendida y resumen ----- */
let wakeLock = null;
async function pedirPantalla() {
  if (!ajuste('pantalla', true) || !('wakeLock' in navigator) || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (e) {}
}
function soltarPantalla() { try { wakeLock && wakeLock.release(); } catch (e) {} wakeLock = null; }
function tickSesion() {
  if (document.hidden) return;
  if (revisarDia()) return;
  const el = $('sesT'), s = sesion();
  if (el && s.start) el.textContent = minutos(Date.now() - s.start);
}
// Series de trabajo de hoy: las guardadas más las que llevas marcadas en ejercicios sin guardar
function seriesSesion() {
  const ses = sesion();
  let n = ses.log.reduce((a, l) => a + l.sets.filter(s => s.t !== 'C').length, 0);
  Object.keys(state).forEach(k => { const st = state[k]; if (!st.done && !esPar(k)) n += st.sets.filter(s => s.ok && s.t !== 'C').length; });
  return n;
}
// Volumen de la sesión por músculo: principal 1 serie, secundario 0.5 (igual que el correo); sin calentamientos.
// Incluye lo guardado hoy y las series que llevas marcadas en ejercicios sin guardar.
function volumenSesion() {
  const vol = {};
  const sumar = (name, sets) => {
    const ex = exDe(name), n = sets.filter(s => s.t !== 'C').length;
    if (!ex || !n) return;
    const m = ex.musculo || 'Otro';
    vol[m] = vol[m] || { series: 0, ej: 0 };
    vol[m].series += n; vol[m].ej += 1;
    if (ex.sec && ex.sec !== m) { vol[ex.sec] = vol[ex.sec] || { series: 0, ej: 0 }; vol[ex.sec].series += n * 0.5; }
  };
  sesion().log.forEach(l => sumar(l.name, l.sets));
  Object.keys(state).forEach(k => { const st = state[k]; if (!st.done && !esPar(k)) sumar(k, st.sets.filter(s => s.ok)); });
  return Object.keys(vol).map(m => ({ musculo: m, series: vol[m].series, ej: vol[m].ej })).sort((a, b) => b.series - a.series);
}
function chipsVolumen() {
  const v = volumenSesion();
  if (!v.length) return '';
  const medio = n => (Math.floor(n) || '') + (n % 1 ? '½' : '');
  return '<div class="vol">' + v.map(x => '<span><b>' + esc(x.musculo) + '</b>' + medio(x.series) + (x.series <= 1 ? ' serie' : ' series') +
    (x.ej ? ' · ' + x.ej + ' ej.' : ' (apoyo)') + '</span>').join('') + '</div>';
}
function resumenSesion() {
  const s = sesion();
  return {
    s: s, min: Math.max(1, Math.round((Date.now() - (s.start || Date.now())) / 60000)),
    series: s.log.reduce((a, l) => a + l.sets.filter(x => x.t !== 'C').length, 0),
    vol: Math.round(s.log.reduce((a, l) => a + (l.vol || 0), 0)),
    prs: s.log.filter(l => l.prs && l.prs.length)
  };
}
function terminarSesion() {
  guardarPendientes(null, true);
  const r = resumenSesion();
  let h = '<div class="t2">' + (r.s.log.length ? '¡Buena sesión!' : 'Sesión sin ejercicios') + '</div>' +
    '<div class="muted">' + esc(DATA.today) + '</div>' +
    '<div class="stats"><div><b class="num">' + r.min + '</b><span class="muted">minuto' + (r.min === 1 ? '' : 's') + '</span></div>' +
    '<div><b class="num">' + r.s.log.length + '</b><span class="muted">ejercicios</span></div>' +
    '<div><b class="num">' + r.series + '</b><span class="muted">series</span></div></div>';
  if (r.vol) h += '<div class="muted" style="margin-bottom:10px">Volumen: <b class="num" style="color:var(--text)">' + r.vol.toLocaleString('es-MX') +
    ' lb</b> (carga real × reps, sin calentamientos)</div>';
  if (r.prs.length) h += '<div class="card" style="background:var(--acc-weak);border-color:transparent">' + r.prs.map(l =>
    '<div class="row" style="color:var(--acc);font-weight:700;margin:4px 0">' + ICO.trophy + '<span>Récord de ' + l.prs.join(' y ') + ' en ' + esc(l.ej) + '</span></div>').join('') + '</div>';
  if (r.s.log.length) h += '<button class="btn ghost block" style="margin-top:4px" onclick="compartirSesion()">' + ICO.share.replace('class="icon"', 'class="icon" style="vertical-align:-4px;margin-right:6px"') + 'Compartir resumen</button>';
  h += '<div class="acts"><button class="btn ghost" onclick="cerrarModal()">Seguir entrenando</button>' +
    '<button class="btn" onclick="cerrarSesion()">Terminar</button></div>';
  $('sheet').innerHTML = h; abrirModal();
}
function abrirModal(clase) {
  delete $('sheet').dataset.pend;
  $('sheet').className = 'sheet' + (clase ? ' ' + clase : '');
  $('modal').className = 'modal show' + (clase ? ' ' + clase : '');
  $('toast').className = 'toast';
  document.documentElement.classList.add('conmodal');
}
function cerrarModal() { $('modal').classList.remove('show'); document.documentElement.classList.remove('conmodal'); }

/* ----- Tour de la primera vez: 4 burbujas sobre la pantalla real (se vuelve a ver en Ajustes) ----- */
const TOUR = [
  { el: () => document.querySelector('#vEntrenar .hoytoca li, #vEntrenar .mosaicos button'), t: 'Primero, pésate 🌅', d: 'En ayunas, después del baño. Toca aquí: ya te pongo tu último peso y solo le subes o bajas.' },
  { el: () => document.querySelector('#vEntrenar .chips'), t: 'Elige qué entrenas', d: 'Cada botón es un día: pecho y hombro, espalda y bíceps, pierna… El del puntito es el que te toca hoy.' },
  { el: () => document.querySelector('#vEntrenar .ex .ex-head'), t: 'Anota cada serie', d: 'Toca un ejercicio: escribe el peso y cuántas veces lo hiciste, y toca ✓ al terminar cada serie. Al final, «Guardar ejercicio».' },
  { el: () => $('nComida'), t: 'Anota lo que comes', d: 'Escribe o dicta lo que comiste y la IA calcula la proteína. Lo de siempre lo agregas con un toque.' }
];
let TOUR_I = -1;
function tourSiToca() {
  if (LS.get('gym_tour', false) || TOUR_I >= 0 || TAB !== 'Entrenar' || FECHA || sesionActiva() || (DATA.perfil === false && !LS.get('gym_bienvenida', false))) return;
  if ($('modal').classList.contains('show') || $('kp').classList.contains('show')) return;
  iniciarTour();
}
function iniciarTour() {
  cerrarModal(); cerrarTeclado();
  if (TAB !== 'Entrenar') verTab('Entrenar');
  TOUR_I = 0; pintarTour();
}
function pintarTour() {
  let el = null;
  while (TOUR_I < TOUR.length && !(el = TOUR[TOUR_I].el())) TOUR_I++;
  quitarTour();
  if (TOUR_I >= TOUR.length) return terminarTour(true);
  if (!el.closest('.nav')) el.scrollIntoView({ block: 'center' });
  document.documentElement.classList.add('conmodal');
  const r = el.getBoundingClientRect(), paso = TOUR[TOUR_I], ultimo = TOUR_I === TOUR.length - 1, abajo = r.top + r.height / 2 < innerHeight / 2;
  const t = document.createElement('div'); t.id = 'tour';
  t.innerHTML = '<div class="tour-tapa"></div><div class="tour-luz" style="left:' + (r.left - 6) + 'px;top:' + (r.top - 6) + 'px;width:' + (r.width + 12) + 'px;height:' + (r.height + 12) + 'px"></div>' +
    '<div class="tour-burbuja" style="' + (abajo ? 'top:' + Math.min(innerHeight - 220, r.bottom + 16) : 'bottom:' + Math.min(innerHeight - 220, innerHeight - r.top + 16)) + 'px">' +
    '<div class="muted" style="font-size:13px">Paso ' + (TOUR_I + 1) + ' de ' + TOUR.length + '</div><div class="t2" style="margin:2px 0 4px">' + paso.t + '</div><div>' + paso.d + '</div>' +
    '<div class="row between" style="margin-top:12px"><button class="link" onclick="terminarTour()">Saltar</button><button class="btn" onclick="TOUR_I++;pintarTour()">' + (ultimo ? '¡Listo!' : 'Siguiente') + '</button></div></div>';
  document.body.appendChild(t);
}
function quitarTour() { const t = $('tour'); if (t) t.remove(); document.documentElement.classList.remove('conmodal'); }
function terminarTour(completo) {
  quitarTour(); TOUR_I = -1; LS.set('gym_tour', true);
  window.scrollTo(0, 0);
  toast(completo ? '¡Listo! Lo vuelves a ver en Ajustes' : 'Lo puedes ver cuando quieras en Ajustes');
}
/* ----- Gesto o botón "atrás" de Android ----- */
// Siempre queda una entrada extra en el historial (la "guardia"): el gesto atrás la consume, la app cierra lo que esté
// encima y la vuelve a poner. En la pantalla principal, dos veces seguidas mandan la app al fondo (APK) o salen (navegador).
// En el APK hace falta el plugin @capacitor/app; sin él, Android cierra la app sin pasar por aquí.
let ATRAS_T = 0;
function ponerGuardia() { if (!(history.state && history.state.guardia)) history.pushState({ guardia: 1 }, ''); }
function cerrarLoDeArriba() {
  if (TOUR_I >= 0) { terminarTour(); return true; }
  if ($('kp').classList.contains('show')) { cerrarTeclado(); return true; }
  if ($('modal').classList.contains('show')) { cerrarModal(); return true; }
  if (TAB !== 'Entrenar') { verTab('Entrenar'); return true; }
  if (BUSCA) { BUSCA = ''; pintarEntrenar(); return true; }
  if (OPEN) { abrir(OPEN); return true; }
  return false;
}
window.addEventListener('popstate', () => {
  // Si cerró algo, el siguiente atrás vuelve a pedir confirmación antes de salir
  if (cerrarLoDeArriba()) { ATRAS_T = 0; ponerGuardia(); return; }
  if (Date.now() - ATRAS_T < 2200) {
    ATRAS_T = 0;
    if (NATIVO) { nativo('App', 'minimizeApp'); ponerGuardia(); }
    else history.back();
    return;
  }
  ATRAS_T = Date.now();
  toast('Desliza atrás otra vez para salir');
  ponerGuardia();
});
function cerrarSesion() {
  guardarPendientes(null, true);
  const s = sesion(); s.ended = true; guardarSesion(s);
  const conResumen = DATA.ia && s.log.length && navigator.onLine && !LS.get('gym_debrief_' + hoy(), null);
  if (conResumen) resumenCoach(s); else cerrarModal();
  OPEN = ''; detenerRest(); soltarPantalla(); pintarEntrenar();
  if (!conResumen) toast('Sesión terminada. ¡A descansar!');
}
// Imagen 1080×1350 con el resumen, para mandarla por WhatsApp o subirla a historias
async function compartirSesion() {
  const r = resumenSesion(), W = 1080, H = 1350;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#2A1470'); g.addColorStop(1, '#6D3BE8');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const F = (peso, tam) => peso + ' ' + tam + 'px Archivo, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  c.fillStyle = '#fff'; c.font = F(800, 64); c.fillText('Gym ' + (DATA.nombre || ''), 80, 140);
  c.fillStyle = 'rgba(255,255,255,.7)'; c.font = F(500, 38); c.fillText(DATA.today, 80, 200);
  const stats = [[r.min, r.min === 1 ? 'minuto' : 'minutos'], [r.s.log.length, 'ejercicios'], [r.series, 'series']];
  stats.forEach((s, i) => {
    const x = 80 + i * 320;
    c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.roundRect ? c.roundRect(x, 270, 290, 220, 32) : c.rect(x, 270, 290, 220); c.fill();
    c.fillStyle = '#fff'; c.font = F(800, 96); c.fillText(String(s[0]), x + 36, 400);
    c.fillStyle = 'rgba(255,255,255,.75)'; c.font = F(500, 34); c.fillText(s[1], x + 36, 455);
  });
  let y = 590;
  c.fillStyle = '#fff'; c.font = F(700, 40);
  r.s.log.slice(0, 6).forEach(l => {
    c.fillText((l.prs && l.prs.length ? '🏆 ' : '• ') + l.ej, 80, y);
    c.fillStyle = 'rgba(255,255,255,.7)'; c.font = F(500, 34); c.fillText(resumenSets(l.sets) + unidadSets(l), 80, y + 46);
    c.fillStyle = '#fff'; c.font = F(700, 40); y += 112;
  });
  if (r.s.log.length > 6) { c.font = F(500, 34); c.fillText('+' + (r.s.log.length - 6) + ' más', 80, y); }
  c.fillStyle = '#FF9A55'; c.font = F(800, 44);
  const racha = DATA.resumen && DATA.resumen.racha ? '🔥 ' + DATA.resumen.racha + ' semana' + (DATA.resumen.racha === 1 ? '' : 's') + ' de racha' : '';
  c.fillText(r.prs.length ? r.prs.length + ' récord' + (r.prs.length === 1 ? '' : 's') + ' hoy' + (racha ? ' · ' + racha : '') : racha, 80, H - 90);
  const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
  const file = new File([blob], 'sesion-' + hoy() + '.png', { type: 'image/png' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Mi sesión de gym' }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  toast('Imagen descargada');
}

/* ----- Descanso (opcional) con aviso al reloj ----- */
let restInt = null, audioCtx = null, sugTimer = null;
function desbloquearAudio() { try { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
function beep() {
  try {
    if (!audioCtx) return;
    [0, 0.25, 0.5].forEach(t => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.25, audioCtx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + t + 0.2);
      o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + 0.2);
    });
  } catch (e) {}
}
function avisoReloj(dur) {
  if (!ajuste('reloj', false) || !('Notification' in window) || Notification.permission !== 'granted') return;
  navigator.serviceWorker.ready.then(reg => reg.showNotification('¡Siguiente serie!', {
    body: proxSerieTexto() || 'Terminó tu descanso de ' + mmss(dur), tag: 'descanso', renotify: true,
    vibrate: [300, 150, 300], icon: 'icon-192.png', badge: 'icon-192.png'
  })).catch(() => {});
}
function sugerirDescanso() {
  if (TAB !== 'Entrenar') return;
  if (LS.get('gym_rest', null)) detenerRest();   // marcaste otra serie con el reloj corriendo: empieza de nuevo
  const def = ajuste('descanso', 90);
  if (ajuste('autoDescanso', false)) return iniciarRest(def);
  const el = $('rest');
  el.className = 'rest show';
  el.innerHTML = '<div class="rrow">' + ICO.timer + DESCANSOS.map(s => '<button class="rbtn' + (s === def ? ' def' : '') + '" onclick="iniciarRest(' + s + ')">' + mmss(s) + '</button>').join('') +
    '<button class="rbtn x" onclick="ocultarRest()" aria-label="Cerrar">✕</button></div>';
  clearTimeout(sugTimer); sugTimer = setTimeout(() => { if (!LS.get('gym_rest', null)) ocultarRest(); }, 12000);
}
function iniciarRest(seg) {
  desbloquearAudio();
  clearTimeout(sugTimer);
  setAjuste('descanso', seg);
  LS.set('gym_rest', { end: Date.now() + seg * 1000, dur: seg, fired: false });
  programarAviso(LS.get('gym_rest', null));
  arrancarRest();
}
// En el APK el aviso lo agenda Android (AlarmManager): llega aunque la pantalla esté bloqueada y la app congelada.
// No hace falta mantener vivo tickRest(): el descanso se guarda como hora de fin y al volver se recalcula.
const AVISO_ID = 7;
let canalListo = false;
// "Te toca" para el aviso del descanso (pantalla bloqueada y reloj): la siguiente serie del ejercicio que acabas de marcar
// y, en pareja, la del otro si va a la mitad del mismo ejercicio.
function proxSerieTexto() {
  const n = ULT_SERIE, st = state[n];
  if (!st || FECHA) return '';
  const una = (k, quien) => {
    const x = state[k], e = exDe(k);
    if (!x || !e || x.done) return '';
    const s = x.sets.find(y => !y.ok && y.t !== 'C');
    if (!s || vacio(s.r)) return '';
    const sug = x.ia && x.ia.usar && x.ia.peso !== null ? x.ia : null;
    const w = sug ? sug.peso : s.w, r = sug ? sug.reps : s.r;
    return quien + (vacio(w) || (Number(w) === 0 && e.sinPeso) ? '' : w + ' ' + x.unit + ' × ') + r + (sug ? ' (consejo)' : '');
  };
  const ej = (exDe(n) || {}).ejercicio || '';
  if (!parOn()) { const t = una(n, ''); return t ? 'Te toca ' + ej.split(' (')[0] + ': ' + t : ''; }
  const base = baseVista(n), otro = esPar(n) ? base : parKey(base);
  const partes = [una(esPar(n) ? n : base, esPar(n) ? PAR.nombre + ' ' : 'Tú '), state[otro] && state[otro].sets.some(y => y.ok) ? una(otro, esPar(n) ? 'Tú ' : PAR.nombre + ' ') : ''].filter(Boolean);
  return partes.length ? ej.split(' (')[0] + ' · ' + partes.join(' · ') : '';
}
function programarAviso(r) {
  if (!NATIVO || !r || !ajuste('reloj', true)) return;
  const agendar = () => nativo('LocalNotifications', 'schedule', { notifications: [{
    id: AVISO_ID, title: '¡Siguiente serie!', body: proxSerieTexto() || 'Terminó tu descanso de ' + mmss(r.dur), channelId: 'descanso',
    schedule: { at: new Date(r.end), allowWhileIdle: true } }] });
  nativo('LocalNotifications', 'cancel', { notifications: [{ id: AVISO_ID }] }).then(() => {
    if (canalListo) return agendar();
    canalListo = true;
    return nativo('LocalNotifications', 'createChannel', { id: 'descanso', name: 'Fin del descanso',
      description: 'Te avisa cuando toca la siguiente serie', importance: 5, visibility: 1, vibration: true }).then(agendar);
  });
}
function cancelarAviso() { if (NATIVO) nativo('LocalNotifications', 'cancel', { notifications: [{ id: AVISO_ID }] }); }
function arrancarRest() { tickRest(); clearInterval(restInt); restInt = setInterval(tickRest, 250); }
function sumarRest(seg) { const r = LS.get('gym_rest', null); if (!r) return; r.end += seg * 1000; r.dur += seg; r.fired = false; LS.set('gym_rest', r); programarAviso(r); tickRest(); }
function detenerRest() { LS.del('gym_rest'); clearInterval(restInt); restInt = null; ocultarRest(); cancelarAviso(); enfoque(false); }
function ocultarRest() { const el = $('rest'); el.className = 'rest'; el.innerHTML = ''; }
function enfoque(on) { if (document.body.classList.contains('descansando') !== on) document.body.classList.toggle('descansando', on); }
function tickRest() {
  const r = LS.get('gym_rest', null), el = $('rest');
  if (!r) { clearInterval(restInt); restInt = null; enfoque(false); return; }
  const left = (r.end - Date.now()) / 1000;
  enfoque(left > 0 && TAB === 'Entrenar');
  if (left <= 0) {
    if (!r.fired) { r.fired = true; LS.set('gym_rest', r); hap('fin'); beep(); if (!NATIVO) avisoReloj(r.dur); }
    el.className = 'rest show fin';
    el.innerHTML = '<div class="rrow"><div style="flex:1"><div class="big">¡Siguiente serie!</div></div>' +
      '<button class="rbtn" style="flex:none;padding:10px 16px" onclick="detenerRest()">OK</button></div>';
    if (left < -20) detenerRest();
    return;
  }
  el.className = 'rest show';
  el.innerHTML = '<div class="rrow">' + ICO.timer + '<div class="big num" style="min-width:64px">' + mmss(left) + '</div>' +
    '<div style="flex:1"></div><button class="rbtn" style="flex:none;padding:10px 12px" onclick="sumarRest(30)">+30 s</button>' +
    '<button class="rbtn" style="flex:none;padding:10px 12px" onclick="detenerRest()">Omitir</button></div>' +
    '<div class="rbar"><div style="width:' + Math.max(0, Math.min(100, 100 - left / r.dur * 100)) + '%"></div></div>';
}

/* ----- Trote y plan para la carrera ----- */
// El grupo de tu siguiente día de gym: si ya entrenaste hoy, el que sigue; si no, el que te toca
function proximoGrupo() {
  const hoyYa = DATA.ultimoGrupoFecha === DATA.todayKey || sesion().log.some(l => GRUPOS3.includes(l.name.split(':')[0]));
  if (!hoyYa) return DATA.sugGrupo;
  const ult = sesion().log.map(l => l.name.split(':')[0]).filter(g => GRUPOS3.includes(g)).pop() || DATA.ultimoGrupo;
  return GRUPOS3[(GRUPOS3.indexOf(ult) + 1) % 3];
}
let TROTE = { km: '', min: '', fc: '', cad: '', tipo: null, ia: null, leyendo: false };
const BORR = {};   // texto a medio escribir (notas del trote, chat, cintura, ajuste): sobrevive si la pantalla se vuelve a dibujar
/* Calibración con tu prueba de 5K del 16/10 (Samsung Health): 29:44 a 5:55/km, FC prom. 182, cadencia 173.
   Tus zonas (FC máx. ~197): Z1 98–118 · Z2 119–137 · Z3 138–157 · Z4 158–177 · Z5 178–197.
   "Fácil" = FC promedio ≤ 150 (≈76 % de tu máxima, mitad baja de Z3). Sin pulso: ritmo de 6:50/km o más lento
   (tu ritmo de 5K + 55 s). Calidad y Carrera cuentan como intensas aunque el promedio salga lento (incluyen caminatas). */
const FC_FACIL = 150, RITMO_FACIL_S = 410;
function intensidad(t) {
  if (t.fc) return t.fc <= FC_FACIL ? 'facil' : 'intenso';
  if (t.tipo === 'Calidad' || t.tipo === 'Carrera') return 'intenso';
  if (t.min && t.km) return t.min * 60 / t.km >= RITMO_FACIL_S ? 'facil' : 'intenso';
  return t.tipo === 'Fácil' || t.tipo === 'Larga' ? 'facil' : null;
}
// Polarización de los últimos 7 días: km fáciles contra km intensos (incluye lo que aún no se sube)
function polarizacion() {
  const pend = trotesPendientes().filter(t => difDias(claveDia(new Date(t.ts)), hoy()) < 7)
    .map(t => ({ d: ddmm(claveDia(new Date(t.ts))), km: Number(t.km), min: t.min, fc: t.fc || null, tipo: t.tipo }));
  const lista = (DATA.trotes.ult7 || []).concat(pend);
  let facil = 0, intenso = 0;
  const lentos = [];
  lista.forEach(t => {
    const i = intensidad(t);
    if (i === 'facil') facil += t.km; else if (i === 'intenso') intenso += t.km;
    if ((t.tipo === 'Fácil' || t.tipo === 'Larga') && i === 'intenso') lentos.push(t);
  });
  const total = facil + intenso;
  return { facil: facil, intenso: intenso, total: total, pct: total ? Math.round(facil / total * 100) : null, lentos: lentos, n: lista.length };
}
function tarjetaPolar() {
  const p = polarizacion();
  if (!p.total) return '';
  let msg, cls = 'tip';
  if (p.lentos.length) {
    const t = p.lentos[p.lentos.length - 1];
    msg = 'Estás corriendo demasiado rápido tus días fáciles: el ' + t.d + ' fuiste ' + (t.fc ? 'a ' + t.fc + ' ppm' : 'a ' + mmss(t.min * 60 / t.km) + '/km') +
      '. Fácil = menos de ' + FC_FACIL + ' ppm (unos ' + ((DATA.plan && DATA.plan.ritmos && DATA.plan.ritmos.facil) || '7:15–8:00') + '/km con este calor). Recuerda el entrenamiento polarizado.';
    cls = 'tip acc';
  } else if (p.pct < 75) {
    msg = 'Semana intensa: solo ' + p.pct + ' % de tus km fueron fáciles. Está bien si hubo prueba o calidad; los próximos trotes, fáciles (menos de ' + FC_FACIL + ' ppm).';
    cls = 'tip acc';
  } else msg = 'Bien polarizado: ' + p.pct + ' % fácil. Así se construye la base sin acumular fatiga.';
  return '<div class="card"><div class="row between"><div class="t1">Fácil vs. intenso · 7 días</div><span class="num muted">' + (Math.round(p.total * 10) / 10) + ' km</span></div>' +
    '<div class="polar"><div class="f" style="width:' + (p.facil / p.total * 100) + '%"></div><div class="i" style="width:' + (p.intenso / p.total * 100) + '%"></div><div class="meta"></div></div>' +
    '<div class="leyenda"><span><i style="background:var(--cyan)"></i>Fácil ' + p.pct + ' %</span><span><i style="background:var(--acc)"></i>Intenso ' + (100 - p.pct) + ' %</span><span>| meta: 80 / 20</span></div>' +
    '<div class="' + cls + '" style="margin:10px 0 0">' + esc(msg) + '</div></div>';
}
// Hidratación al guardar: temperatura actual de Hermosillo (Open-Meteo, gratis y sin clave) + duración + intensidad
async function climaHermosillo() {
  try {
    const r = await conLimite(fetch('https://api.open-meteo.com/v1/forecast?latitude=29.07&longitude=-110.96&current=temperature_2m,relative_humidity_2m,apparent_temperature&timezone=America%2FHermosillo'), 4000);
    const j = await r.json();
    return { temp: Math.round(j.current.apparent_temperature ?? j.current.temperature_2m), hum: j.current.relative_humidity_2m };
  } catch (e) {
    const mes = new Date().getMonth();   // sin señal: promedio de Hermosillo por mes
    return { temp: [19, 21, 24, 28, 32, 36, 36, 35, 34, 30, 24, 19][mes], hum: null, aprox: true };
  }
}
function consejoHidratacion(t, clima) {
  const min = Number(t.min) || Number(t.km) * 7;
  const tasa = clima.temp >= 33 ? 1.4 : clima.temp >= 27 ? 1.1 : clima.temp >= 20 ? 0.8 : 0.6;   // litros de sudor por hora
  const perdida = Math.round(tasa * (intensidad(t) === 'intenso' ? 1.15 : 1) * min / 60 * 1000 / 50) * 50;
  const tomar = Math.round(perdida * 1.25 / 50) * 50, tomarMax = Math.round(perdida * 1.5 / 50) * 50;
  const electro = min >= 60 || clima.temp >= 30 || perdida >= 900;
  return 'Trote guardado. Perdiste ~' + perdida + ' ml de sudor (' + clima.temp + ' °C' + (clima.aprox ? ', promedio del mes' : ' en Hermosillo') + '). ' +
    'Toma ' + tomar + '–' + tomarMax + ' ml en la próxima hora' +
    (electro ? ' y repón electrolitos (suero oral o una pizca de sal con limón): el clima de Hermosillo te drena más rápido.' : '; con esta duración basta con agua.');
}
// Captura de Samsung Health → la IA llena km, minutos, pulso y cadencia
function elegirCapturas() {
  let inp = $('capInput');
  if (!inp) {
    inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true; inp.id = 'capInput'; inp.style.display = 'none';
    inp.onchange = () => { leerCapturas(Array.from(inp.files || [])); inp.value = ''; };
    document.body.appendChild(inp);
  }
  inp.click();
}
// Achica la imagen (lado mayor 1600 px, JPEG 0.75): se lee bien y pesa ~200 KB
function comprimir(file) {
  return new Promise((ok, no) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.width, img.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      ok({ mime: 'image/jpeg', data: cv.toDataURL('image/jpeg', 0.75).split(',')[1] });
    };
    img.onerror = () => { URL.revokeObjectURL(url); no(new Error('No pude abrir la imagen')); };
    img.src = url;
  });
}
async function leerCapturas(files) {
  if (!files.length) return;
  if (!navigator.onLine) return toast('Necesitas señal para leer la captura');
  TROTE.leyendo = true; TROTE.ia = null; pintarEntrenar();
  try {
    const imgs = await Promise.all(files.slice(0, 4).map(comprimir));
    const r = await conLimite(apiPost('troteIA', [imgs, { tipo_elegido: TROTE.tipo }]), 60000);
    ['km', 'min', 'fc', 'cad'].forEach(k => { if (r[k] !== null && r[k] !== undefined) TROTE[k] = r[k]; });
    if (r.tipo && r.tipo !== 'Libre') TROTE.tipo = r.tipo;
    TROTE.ia = r; hap('ok');
  } catch (e) { toast('No pude leer la captura: ' + (e.message === 'tiempo' ? 'tardó demasiado' : e.message).slice(0, 80)); }
  TROTE.leyendo = false; pintarEntrenar();
}
function tarjetaLectura() {
  if (TROTE.leyendo) return '<div class="foco"><span class="i">✨</span><div style="flex:1"><div class="muted" style="font-size:13px">Leyendo tu captura…</div><div class="brillo linea-esq" style="width:85%"></div><div class="brillo linea-esq" style="width:55%"></div></div></div>';
  const r = TROTE.ia;
  if (!r) return '';
  const z = r.zonas || {}, zs = ['z1', 'z2', 'z3', 'z4', 'z5'].map(k => Number(z[k]) || 0), zt = zs.reduce((a, b) => a + b, 0);
  return '<div class="foco entra" style="display:block"><b>✨ Leído de tu captura</b>' +
    '<div class="datos">' + [[r.km, 'km'], [r.min ? mmss(r.min * 60) : null, 'tiempo'], [r.fc, 'ppm prom.'], [r.cad, 'cadencia'], [r.desnivel !== null && r.desnivel !== undefined ? r.desnivel + ' m' : null, 'desnivel'], [r.temp !== null && r.temp !== undefined ? r.temp + ' °C' : null, 'clima']]
      .filter(x => x[0] !== null && x[0] !== undefined).map(x => '<div><b class="num">' + esc(String(x[0])) + '</b><span>' + x[1] + '</span></div>').join('') + '</div>' +
    (zt ? '<div class="muted" style="font-size:12px">Tiempo por zona (Z1 → Z5)</div><div class="zonas">' + zs.map(v => '<div style="width:' + (v / zt * 100) + '%"></div>').join('') + '</div>' : '') +
    (r.vueltas && r.vueltas.length ? '<div class="muted" style="font-size:12.5px;margin-top:6px">Vueltas: ' + r.vueltas.map(v => esc(v.ritmo)).join(' → ') + '/km</div>' : '') +
    (r.analisis ? '<div style="margin-top:8px;font-size:14px">' + esc(r.analisis) + '</div>' : '') +
    '<div class="muted" style="font-size:12px;margin-top:6px">Ya llené el registro de abajo: revisa y toca Guardar.</div></div>';
}
function trotesPendientes() { return cola().filter(op => op.action === 'saveTrote').map(op => op.args[0]); }
/* ----- Después de la carrera: al día siguiente la app sale sola del modo carrera y pregunta qué sigue ----- */
function carreraTerminada() { const c = DATA.carrera; return !!(c && c.fecha && c.fecha < hoy()); }
const nombreCarrera = c => c.nombre || c.km + 'K';
function tarjetaPostCarrera() {
  if (!carreraTerminada()) return '';
  return '<div class="card postcarrera"><div class="t1">🏅 Ya pasó tu ' + esc(nombreCarrera(DATA.carrera)) + ' del ' + diaCorto(DATA.carrera.fecha) + '. ¿Qué sigue?</div>' +
    '<div class="muted" style="margin:4px 0 12px">El plan de carrera terminó. Elige tu siguiente objetivo:</div>' +
    '<button class="btn block" onclick="elegirMantenimiento()">💪 Músculo + trote de mantenimiento</button>' +
    '<button class="btn ghost block" style="margin-top:8px" onclick="otraCarrera()">🏃 Otra carrera</button>' +
    '<div class="muted" style="font-size:12.5px;margin-top:10px">Mantenimiento: 2 trotes fáciles de 25–30 min por semana para no perder la condición, y la prioridad pasa al gym.</div></div>';
}
function elegirMantenimiento() {
  DATA.carrera = null; DATA.plan = null; setAjuste('troteMant', true); LS.set('gym_data', DATA);
  encolar('saveConfig', [{ carrera: null }], 'cfg-carrera');
  hap('ok'); toast('Listo: músculo primero y 2 trotes fáciles por semana'); pintarTab(); actualizarWidgets();
}
function otraCarrera() {
  abrirAjustes();
  setTimeout(() => { const el = $('carFecha'); if (el) { el.scrollIntoView({ block: 'center' }); try { el.showPicker(); } catch (e) { el.focus(); } } }, 150);
}
// Trotes desde el lunes (lo que ya tiene la hoja y lo que aún no se sube)
function trotesSemana() {
  const lunes = sumarDias(hoy(), -((new Date().getDay() + 6) % 7));
  return ((DATA.trotes && DATA.trotes.ult7) || []).filter(t => t.k >= lunes).length + trotesPendientes().filter(t => claveDia(new Date(t.ts)) >= lunes).length;
}
const enMantenimiento = () => !DATA.plan && !DATA.carrera && ajuste('troteMant', false);
function tarjetaMantenimiento() {
  if (!enMantenimiento()) return '';
  const n = trotesSemana();
  return '<div class="card"><div class="row between"><div class="t1">Trote de mantenimiento</div><span class="pill ' + (n >= 2 ? 'ok' : 'pri') + ' num">' + Math.min(n, 2) + ' de 2</span></div>' +
    '<div class="muted" style="margin-top:4px">2 salidas fáciles de 25–30 min por semana, a ritmo en el que puedas platicar. Mantienen tu condición sin quitarle piernas al gym.' +
    (n >= 2 ? ' Esta semana ya cumpliste ✓' : '') + '</div></div>';
}
// Sesiones del plan de esta semana, marcando también lo que hiciste y aún no se sube
function sesionesPlan() {
  const p = DATA.plan;
  if (!p || !p.sesiones) return null;
  const ses = p.sesiones.map(s => Object.assign({}, s));
  const lunes = (() => { const d = new Date(); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return claveDia(d); })();
  trotesPendientes().filter(t => claveDia(new Date(t.ts)) >= lunes).forEach(t => {
    let s = ses.find(x => !x.hecho && x.tipo === t.tipo);
    if (!s && (!t.tipo || t.tipo === 'Libre')) s = ses.find(x => !x.hecho);
    if (s) { s.hecho = true; s.real = t.min || null; }
  });
  return ses;
}
function vistaTrote() {
  const pend = trotesPendientes();
  const lista = pend.map(t => ({ d: ddmm(claveDia(new Date(t.ts))), km: t.km, min: t.min, fc: t.fc, uid: t.uid, tipo: t.tipo, pend: true })).concat(DATA.trotes.ultimos);
  const km7 = DATA.trotes.km7 + pend.filter(t => difDias(claveDia(new Date(t.ts)), hoy()) < 7).reduce((a, t) => a + Number(t.km), 0);
  const p = DATA.plan, ses = sesionesPlan();
  if (TROTE.tipo === null) { const sig = ses && ses.find(s => !s.hecho); TROTE.tipo = sig ? sig.tipo : 'Libre'; }
  let h = tarjetaMantenimiento();   // la de "¿qué sigue?" ya sale arriba, con las demás tarjetas de Entrenar
  if (p) {
    h += '<div class="card plan5k"><div class="row between" style="align-items:flex-start"><div><div class="count num">' + p.faltan + '<span> día' + (p.faltan === 1 ? '' : 's') + ' para tu ' + esc(p.carrera.nombre) + '</span></div>' +
      '<div class="muted">Fecha objetivo: <b style="color:var(--red)">' + diaCorto(p.carrera.fecha) + '</b></div></div>' +
      (ses ? '<span class="pill pri">Semana ' + p.semana + ' de ' + p.total + '</span>' : '') + '</div>';
    if (ses) {
      const minHechos = ses.filter(s => s.hecho).reduce((a, s) => a + (s.real || s.min), 0);
      h += '<div class="pseslist">' + ses.map((s, i) => '<div class="pses' + (s.hecho ? ' ok' : '') + '"><div class="ck">' + (s.hecho ? ICO.check.replace('class="icon"', 'class="icon" style="width:16px;height:16px"') : i + 1) + '</div>' +
        '<div style="flex:1"><div class="t1" style="font-size:15px">' + s.tipo + (s.ritmo ? ' <span class="num ritmo">· ' + s.ritmo + '/km</span>' : '') + '</div><div class="muted">' + esc(s.txt) + '</div></div>' +
        '<span class="estado">' + (s.hecho ? 'Listo' : 'Pendiente') + '</span></div>').join('') + '</div>' +
        '<div class="muted" style="margin-top:12px">Esta semana: <b class="num" style="color:var(--text)">' + Math.round(minHechos) + ' de ~' + p.minMeta + ' min</b>' +
        (p.ritmos ? (p.ritmos.fijos ? ' · ritmos de tu plan; meta de carrera ' + p.ritmos.carrera + '/km' : ' · ritmos según tu mejor salida reciente (' + p.ritmos.ref + '/km)')
                  : ' · aún sin salidas de 4 km o más para calcular tus ritmos') + '</div>' +
        '<div class="minbar"><div style="width:' + Math.min(100, minHechos / p.minMeta * 100) + '%"></div></div>';
    } else if (p.empieza) h += '<div class="muted" style="margin-top:8px">Tu plan de 6 semanas empieza el ' + diaCorto(p.empieza) + '. Mientras, trota como siempre.</div>';
    h += '</div>';
  }
  const ritmo = TROTE.km && TROTE.min ? mmss(TROTE.min * 60 / TROTE.km) + ' min/km' : '—';
  const hid = LS.get('gym_hidrata_' + hoy(), null);
  if (hid && !FECHA) h += '<div class="tip" style="margin:0 0 12px">💧 ' + esc(hid) + '</div>';
  h += '<div class="card trote"><div class="row between" style="margin-bottom:12px"><div class="cap-t">Registrar trote' + (FECHA ? ' · ' + diaCorto(FECHA) : '') + '</div>' +
    (DATA.ia ? '<span class="sincro">⚡ Sync auto</span>' : '') + '</div>' +
    (DATA.ia ? '<button class="cap" onclick="elegirCapturas()"' + (TROTE.leyendo ? ' disabled' : '') + '>' + ICO_CAM + ' Leer captura de Samsung Health</button>' : '') + tarjetaLectura() +
    '<div class="row datos3" style="gap:10px">' +
    '<div style="flex:1"><div class="muted">Kilómetros</div><button class="val num' + (TROTE.km === '' ? ' vacio' : '') + '" style="margin-top:4px" onclick="tecladoTrote(\'km\')">' + (TROTE.km === '' ? 'km' : TROTE.km) + '</button></div>' +
    '<div style="flex:1"><div class="muted">Minutos</div><button class="val num' + (TROTE.min === '' ? ' vacio' : '') + '" style="margin-top:4px" onclick="tecladoTrote(\'min\')">' + (TROTE.min === '' ? 'min' : Number(TROTE.min) % 1 ? mmss(TROTE.min * 60) : TROTE.min) + '</button></div>' +
    '<div style="flex:1"><div class="muted">FC prom.</div><button class="val num' + (TROTE.fc === '' ? ' vacio' : '') + '" style="margin-top:4px" onclick="tecladoTrote(\'fc\')">' + (TROTE.fc === '' ? 'ppm' : TROTE.fc) + '</button></div></div>' +
    '<div class="muted" style="margin:10px 0 4px">Ritmo: <b class="num" style="color:var(--text)">' + ritmo + '</b>' +
    (TROTE.fc !== '' ? ' · ' + (Number(TROTE.fc) <= FC_FACIL ? '<b style="color:var(--ok)">zona fácil</b>' : '<b style="color:var(--acc)">intenso</b>') : '') + '</div>' +
    '<div class="pills">' + TIPOS_TROTE.map(t => '<button class="' + (TROTE.tipo === t ? 'on' : '') + '" onclick="TROTE.tipo=\'' + t + '\';pintarEntrenar()">' + t + '</button>').join('') + '</div>' +
    ((TROTE.tipo === 'Larga' || TROTE.tipo === 'Calidad') && proximoGrupo() === 'Legs' && !FECHA
      ? '<div class="tip acc" style="margin:4px 0 8px">⚠️ Tu siguiente día de gym es Legs. Si es mañana, hoy mejor una salida fácil: la larga o la de calidad te dejan las piernas cansadas para Legs.</div>' : '') +
    '<input class="buscar" id="troteNotas" placeholder="Notas (opcional)" style="margin:4px 0 10px" value="' + esc(BORR.troteNotas || '') + '" oninput="BORR.troteNotas=this.value">' +
    '<button class="btn block" onclick="guardarTrote()">Guardar trote</button></div>';
  h += tarjetaPolar();
  // Récords de trote (incluye lo que no se ha subido)
  let mejor = DATA.trotes.mejorRitmo ? Object.assign({}, DATA.trotes.mejorRitmo) : null, larga = DATA.trotes.masLarga ? Object.assign({}, DATA.trotes.masLarga) : null;
  pend.forEach(t => {
    const d = ddmm(claveDia(new Date(t.ts)));
    if (t.min && t.km >= 3 && (!mejor || t.min / t.km < mejor.ritmo)) mejor = { ritmo: t.min / t.km, km: t.km, d: d };
    if (!larga || t.km > larga.km) larga = { km: t.km, d: d };
  });
  h += '<div class="minis"><div class="kpi"><div class="v num">' + (mejor ? mmss(mejor.ritmo * 60) : '—') + '</div><div class="l">Mejor ritmo (3 km o más)</div>' + (mejor ? '<div class="d">' + mejor.km + ' km · ' + mejor.d + '</div>' : '') + '</div>' +
    '<div class="kpi"><div class="v num">' + (larga ? larga.km + ' km' : '—') + '</div><div class="l">Salida más larga</div>' + (larga ? '<div class="d">' + larga.d + '</div>' : '') + '</div></div>';
  if (DATA.trotes.semanas && DATA.trotes.semanas.some(s => s.km)) h += '<div class="card chart"><div class="row between"><div class="t1">Km por semana</div><span class="muted">Últimos 7 días: <b class="num" style="color:var(--text)">' + Math.round(km7 * 10) / 10 + '</b></span></div>' + barras(DATA.trotes.semanas) + '</div>';
  if (lista.length) h += '<h2>Últimas salidas</h2><div class="card">' + lista.slice(0, 6).map(t =>
    '<div class="rec"><div class="medal ' + (intensidad(t) === 'intenso' ? 'int' : 'fac') + '">' + ICO.pausa + '</div><div style="flex:1"><div class="t1 num" style="font-size:15px">' + t.km + ' km' +
    (t.min ? ' · ' + mmss(t.min * 60) + ' · <span class="' + (intensidad(t) === 'intenso' ? 'rojo' : 'cian') + '">' + mmss(t.min * 60 / t.km) + '/km</span>' : '') + '</div><div class="muted">' + t.d + (t.tipo ? ' · ' + esc(t.tipo) : '') +
    (t.fc ? ' · ' + t.fc + ' ppm' + (intensidad(t) === 'facil' ? ' (fácil)' : ' (intenso)') : '') + (t.pend ? ' · sin subir' : '') + '</div></div>' +
    (t.uid ? '<button class="btn ghost sm" onclick="borrarTrote(\'' + jsq(t.uid) + '\')">Borrar</button>' : '') + '</div>').join('') + '</div>';
  return h;
}
function tecladoTrote(f) {
  KP = { trote: f, val: TROTE[f] === '' ? '' : String(TROTE[f]), nuevo: true, f: f === 'km' ? 'w' : 'r' };
  const quick = f === 'km' ? [-1, -0.5, 0.5, 1] : f === 'fc' ? [-10, -1, 1, 10] : [-5, -1, 1, 5];
  $('kpSheet').innerHTML = '<div class="row between"><div class="t1">Trote · ' + (f === 'km' ? 'kilómetros' : f === 'fc' ? 'pulso promedio (ppm)' : 'minutos') + '</div><button class="btn ghost sm" onclick="cerrarTeclado()">✕</button></div>' +
    '<div class="disp num" id="kpDisp"></div><div class="quick" style="grid-template-columns:repeat(4,1fr)">' +
    quick.map(v => '<button onclick="kpSumar(' + v + ')">' + (v > 0 ? '+' : '−') + Math.abs(v) + '</button>').join('') + '</div>' + teclas() +
    '<div class="acts"><button class="btn" onclick="kpTrote()">Listo</button></div>';
  kpPintar(); $('kp').classList.add('show');
}
function kpTrote() { TROTE[KP.trote] = KP.val === '' ? '' : Number(KP.val); cerrarTeclado(); pintarEntrenar(); }
function guardarTrote() {
  if (!TROTE.km) return toast('Pon los kilómetros');
  const nota = ($('troteNotas') || {}).value || '';
  const t = { km: Number(TROTE.km), min: TROTE.min ? Number(TROTE.min) : '', fc: TROTE.fc ? Number(TROTE.fc) : '', cad: TROTE.cad ? Number(TROTE.cad) : '',
              notas: (nota + (TROTE.ia && TROTE.ia.analisis ? (nota ? ' · ' : '') + 'IA: ' + TROTE.ia.analisis : '')).slice(0, 480),
              tipo: TROTE.tipo === 'Libre' ? '' : TROTE.tipo, ts: tsReg(), uid: uid() };
  encolar('saveTrote', [t]);
  actualizarWidgets();
  TROTE = { km: '', min: '', fc: '', cad: '', tipo: null, ia: null, leyendo: false }; delete BORR.troteNotas;
  hap('ok'); toast('Trote guardado ✓'); pintarEntrenar();
  // Consejo de hidratación con el clima real del momento (solo para salidas de hoy)
  if (!FECHA) climaHermosillo().then(c => { const m = consejoHidratacion(t, c); LS.set('gym_hidrata_' + hoy(), m); toast('💧 ' + m.slice(0, 110) + '…'); if (TAB === 'Entrenar' && GRUPO === 'Trote') pintarEntrenar(); });
}
function borrarTrote(id) {
  const q = cola(), pend = q.find(op => op.action === 'saveTrote' && op.args[0].uid === id);
  if (pend) guardarCola(q.filter(op => op !== pend));
  if (!pend || pend.enviado) { encolar('undoTrote', [id]); DATA.trotes.ultimos = DATA.trotes.ultimos.filter(t => t.uid !== id); }
  toast('Trote borrado'); pintarEntrenar();
}

/* ===================== COMIDA ===================== */
function protTotal(lista) { return Math.round((lista || prot).reduce((s, k) => s + gDe(k), 0)); }
/* ----- Proteína por comida: ~30 g en desayuno, comida y cena. Cada cosa que anotas lleva su comida (solo en este celular) ----- */
const COMIDAS = [['d', 'Desayuno', '🌅'], ['c', 'Comida', '☀️'], ['n', 'Cena', '🌙']], META_COMIDA = 30;
let COMIDA_SEL = null, COMIDA_SEL_T = 0;   // la que elegiste a mano vale 2 horas; si no, según la hora
const comidaPorHora = h => h < 12 ? 'd' : h < 18 ? 'c' : 'n';
const nombreDeComida = m => (COMIDAS.find(c => c[0] === m) || [m, m])[1];
function comidaActual() { return COMIDA_SEL && Date.now() - COMIDA_SEL_T < 2 * 3600e3 ? COMIDA_SEL : comidaPorHora(new Date().getHours()); }
// Una etiqueta por cosa anotada, en el mismo orden que la lista del día (las que vienen de la hoja no tienen)
function etiquetas(dia, n) { const t = LS.get('gym_protmeal_' + dia, []); return Array.from({ length: n }, (_, i) => t[i] || null); }
// Para el día típico: la comida en que sueles anotar eso (la que más veces le has puesto)
function comidaHabitual(k, porDefecto) {
  const c = LS.get('gym_food_meal', {})[k];
  const m = c ? Object.keys(c).sort((a, b) => c[b] - c[a])[0] : null;
  return m || (/^cena/i.test(k) ? 'n' : porDefecto);
}
function agregarAProt(claves, comidas) {
  asegurarProt();
  const dia = diaComida(), t = etiquetas(dia, prot.length), usos = LS.get('gym_food_meal', {});
  // En qué comida sueles anotar cada cosa se cuenta por plantilla (botón, receta), no por registro
  claves.forEach((k, i) => { const r = regDe(k), pk = !r ? k : r.src === 'receta' ? '@' + r.ref : r.src === 'boton' || r.src === 'fav' ? r.ref : null;
    if (pk) (usos[pk] = usos[pk] || {})[comidas[i]] = (usos[pk][comidas[i]] || 0) + 1; });
  claves = claves.map(expandirClave);
  claves.forEach((k, i) => { prot.push(k); t.push(comidas[i]); });
  LS.set('gym_protmeal_' + dia, t); LS.set('gym_food_meal', usos);
}
function gramosPorComida(lista, t) {
  const g = { d: 0, c: 0, n: 0, sin: 0 };
  lista.forEach((k, i) => { g[t[i] || 'sin'] += gDe(k); });
  return g;
}
// La comida que más falla en las últimas 2 semanas (entre semana o en fin de semana), si ya hay datos
function comidaQueFalla() {
  const acc = {};
  for (let i = 1; i <= 14; i++) {
    const dia = sumarDias(hoy(), -i), lista = LS.get('gym_prot_' + dia, null);
    if (!lista || !lista.length) continue;
    const t = etiquetas(dia, lista.length);
    if (t.some(x => !x)) continue;   // algo de ese día no tiene comida marcada (vino de la hoja): no se sabe de cuál fue
    const fin = [0, 6].includes(new Date(dia + 'T12:00:00').getDay()), g = gramosPorComida(lista, t);
    COMIDAS.forEach(c => { const k = c[0] + (fin ? 'F' : 'S'); (acc[k] = acc[k] || []).push(g[c[0]]); });
  }
  let peor = null;
  Object.keys(acc).forEach(k => {
    const l = acc[k], p = l.reduce((a, b) => a + b, 0) / l.length;
    if (l.length >= 2 && p < META_COMIDA - 5 && (!peor || p < peor.g)) peor = { m: k[0], fin: k[1] === 'F', g: Math.round(p), dias: l.length };
  });
  return peor;
}
const textoFalla = f => 'tu ' + nombreDeComida(f.m).toLowerCase() + (f.fin ? ' del fin de semana' : ' entre semana') + ' promedia ' + f.g + ' g';
function tarjetaPorComida() {
  const dia = diaComida(), g = gramosPorComida(prot, etiquetas(dia, prot.length)), sel = comidaActual(), falla = COMIDA_DIA ? null : comidaQueFalla();
  const ayuda = falla ? completarProt(META_COMIDA - falla.g) : [];
  return '<div class="card porcomida"><div class="row between"><div class="t1">Por comida</div><span class="muted" style="font-size:12px">~' + META_COMIDA + ' g en cada una</span></div>' +
    '<div class="comidas3">' + COMIDAS.map(c => {
      const v = Math.round(g[c[0]]);
      return '<button class="' + (c[0] === sel ? 'on' : '') + (v >= META_COMIDA ? ' ok' : v > 0 ? ' baja' : '') + '" onclick="COMIDA_SEL=\'' + c[0] + '\';COMIDA_SEL_T=Date.now();hap(\'tecla\');pintarComida()">' +
        '<span>' + c[2] + ' ' + c[1] + '</span><b class="num">' + v + ' g</b><small>' + (v >= META_COMIDA ? '✓ listo' : v > 0 ? 'faltan ' + (META_COMIDA - v) : 'sin anotar') + '</small></button>';
    }).join('') + '</div>' +
    '<div class="muted" style="font-size:12.5px;margin-top:8px">Lo que agregues va a <b style="color:var(--text)">' + nombreDeComida(sel) + '</b>' + (sel === COMIDA_SEL && Date.now() - COMIDA_SEL_T < 2 * 3600e3 ? '' : ' (por la hora)') + ' · toca otra para cambiar' +
    (g.sin ? ' · ' + Math.round(g.sin) + ' g sin comida marcada' : '') + '</div>' +
    (falla ? '<div class="tip acc" style="margin:10px 0 0">⚠️ En 2 semanas, ' + esc(textoFalla(falla)) + ': ahí se te escapa la proteína.' +
      (ayuda.length ? ' Con ' + esc(ayuda.map(nombreComida).join(' + ')) + ' llegas a ' + META_COMIDA + ' g.' : '') + '</div>' : '') + '</div>';
}

// "¿Ayer comiste tu día típico?": si ayer quedó sin proteína, se registra con un toque
function ayerPendiente() {
  const ayer = sumarDias(hoy(), -1);
  return fresco() && DATA.protAyer && DATA.protAyer.k === ayer && !(DATA.protAyer.g > 0) &&
    LS.get('gym_prot_' + ayer, null) === null && !LS.get('gym_ayer_no_' + ayer, false) ? ayer : null;
}
function tarjetaAyer() {
  const ayer = ayerPendiente();
  if (!ayer) return '';
  const tipico = diaTipicoLista(), g = protTotal(tipico);
  return '<div class="card"><div class="row between"><div class="t1">¿Qué comiste ayer?</div>' +
    '<button class="btn ghost sm" onclick="LS.set(\'gym_ayer_no_' + ayer + '\', true);pintarTab()" aria-label="No registrar">✕</button></div>' +
    '<div class="muted" style="margin:2px 0 10px">Se quedó sin registrar la proteína del ' + diaCorto(ayer) + '.</div><div class="acts" style="margin-top:0">' +
    (tipico.length ? '<button class="btn" style="white-space:nowrap" onclick="ayerTipico()">Día típico · ' + g + ' g</button>' : '') +
    '<button class="btn ghost" onclick="comidaDe(\'' + ayer + '\')">' + (tipico.length ? 'Fue diferente' : 'Registrar ayer') + '</button></div></div>';
}
function ayerTipico() {
  const ayer = sumarDias(hoy(), -1), plantilla = diaTipicoLista(), lista = plantilla.map(expandirClave);
  LS.set('gym_prot_' + ayer, lista); LS.set('gym_protmeal_' + ayer, plantilla.map(k => comidaHabitual(k, null)));
  sincronizarDia(ayer, lista);
  hap('ok'); toast('Ayer: ' + protTotal(lista) + ' g ✓'); pintarTab();
}
function comidaDe(dia) {
  COMIDA_DIA = dia && dia !== hoy() ? dia : null;
  usarProt(diaComida());
  verTab('Comida');
}
function diaTipicoLista() {
  // El que armaste tú (se guarda en el celular y en tu configuración de la hoja)
  const propio = ajuste('diaTipico', null) || DATA.diaTipico;
  if (Array.isArray(propio)) return propio.map(k => k === 'Licuado' ? '@licuado' : k).filter(k => gDe(k) > 0);
  // Si nunca lo has editado: el de antes (Martin) o lo que más registras
  if (DATA.dueno) return ['@licuado', 'Tupper carne', 'Cena huevos', 'Scoop'];
  const cuenta = LS.get('gym_food_counts', {});
  return FOODS.slice().sort((a, b) => (cuenta[b.k] || 0) - (cuenta[a.k] || 0)).filter(f => cuenta[f.k]).slice(0, 3).map(f => f.k);
}
function pintarComida() {
  asegurarProt();
  const meta = metaProt(), tot = protTotal(), pct = Math.min(1, tot / meta), falta = meta - tot;
  const R = 74, C = 2 * Math.PI * R;
  const cuenta = LS.get('gym_food_counts', {});
  const todas = FOODS.concat(misComidas());
  const top = todas.slice().sort((a, b) => (cuenta[b.k] || 0) - (cuenta[a.k] || 0)).slice(0, 3).filter(f => cuenta[f.k]);
  const tipico = diaTipicoLista();
  let h = '';
  if (COMIDA_DIA) h += '<div class="otro">' + ICO.cal + '<span>Comida del ' + diaCorto(COMIDA_DIA) + '</span><button class="btn" onclick="comidaDe(null)">Volver a hoy</button></div>';
  else h += tarjetaAyer();
  // Anillo: al tocarlo alterna entre lo registrado y lo que te falta
  const verFalta = RING_FALTA && falta > 0;
  h += '<div class="card protcard"><div class="row between"><div class="t2">Proteína de ' + (COMIDA_DIA ? 'ese día' : 'hoy') + '</div>' +
    '<span class="muted">Meta ' + meta + ' g</span></div>' +
    '<button class="ring" onclick="RING_FALTA=!RING_FALTA;hap(\'tecla\');pintarComida()" aria-label="Cambiar entre registrado y lo que falta"><svg viewBox="0 0 170 170">' +
    '<circle cx="85" cy="85" r="' + R + '" fill="none" stroke="var(--card2)" stroke-width="13"/>' +
    '<circle cx="85" cy="85" r="' + (R - 14) + '" fill="none" stroke="var(--line)" stroke-width="1" stroke-dasharray="2 5"/>' +
    '<circle cx="85" cy="85" r="' + R + '" fill="none" stroke="var(--ok)" stroke-width="13" stroke-linecap="round" ' +
    'stroke-dasharray="' + C + '" stroke-dashoffset="' + (C * (1 - pct)) + '" style="transition:stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)"/></svg>' +
    '<div><div class="lbl">' + (verFalta ? 'Te faltan' : 'Registrado') + '</div><div class="v num">' + (verFalta ? falta : tot) +
    (verFalta ? '' : '<small>/' + meta + '</small>') + '</div><div class="muted">gramos</div></div></button>' +
    '<div class="row between falta"><div class="t1">' + (falta > 0 ? 'Te faltan ~' + falta + ' g' : '¡Meta cumplida!') + '</div>' +
    (falta <= 0 ? '<span class="pill ok">✓ Listo</span>' : '') + '</div>' +
    '<div class="consejo">💡 ' + (falta > 0 ? textoCompletar(falta) : 'Bien hecho hoy') + '</div>' + seguroNut(tarjetaMacros, 'macros') + '</div>';
  h += seguroNut(filaSiempre, 'de siempre');
  h += botonRepetirAyer();
  if (!prot.length && tipico.length) h += '<button class="tipico" onclick="diaTipico()"><span class="ic">🍽️</span><span style="flex:1"><b>Mi día típico</b> <span class="pill ok">+' +
    protTotal(tipico) + ' g</span><small>' + esc(tipico.map(k => FOODS.some(f => f.k === k) ? k : tDe(k).split(' · ')[0]).join(' · ')) + '</small></span><span class="mas">＋</span></button>';
  if (top.length) h += '<div class="row between"><h2>Lo que más comes</h2><span class="muted" style="font-size:12px">Frecuentes</span></div><div class="foods tops">' + top.map(f => botonComida(f, true)).join('') + '</div>';
  const favs = misComidas().filter(f => !top.some(t => t.k === f.k));
  if (favs.length || QUITAR_FAV) h += '<div class="row between"><h2>Mis comidas</h2><button class="link" onclick="QUITAR_FAV=!QUITAR_FAV;pintarComida()">' + (QUITAR_FAV ? 'Listo' : 'Editar') + '</button></div>' +
    (QUITAR_FAV ? '<div class="muted" style="margin:-4px 0 8px;font-size:13px">Toca una para quitarla de tus comidas</div>' : '') +
    '<div class="foods">' + (QUITAR_FAV ? misComidas() : favs).map(f => botonComida(f, false)).join('') + '</div>';
  h += '<div class="row between"><h2>Agregar</h2><span class="rapido">Toque rápido</span></div><div class="foods">' + FOODS.filter(f => !top.includes(f) && f.k !== 'Licuado').map(f => botonComida(f, false)).join('') + '</div>';
  // Primero los botones para agregar (lo que más usas); después en qué comida va y tu día típico
  h += tarjetaPorComida() + tarjetaComidaIA();
  if (!COMIDA_DIA) h += '<button class="link tipico-ed" onclick="editarTipico(true)">✏️ ' + (tipico.length ? 'Editar mi día típico' : 'Arma tu día típico: lo agregas con un toque') + '</button>';
  if (prot.length) {
    const t = etiquetas(diaComida(), prot.length);
    h += '<h2>' + (COMIDA_DIA ? 'Ese día comiste' : 'Hoy comiste') + ' · toca para quitar</h2>' + COMIDAS.concat([[null, 'Sin comida marcada', '•']]).map(c => {
      const idx = prot.map((k, i) => i).filter(i => (t[i] || null) === c[0]);
      return idx.length ? '<div class="muted comida-l">' + c[2] + ' ' + c[1] + '</div><div class="eaten">' + idx.map(i => { const m = macrosDe(prot[i]); return '<button onclick="quitarProt(' + i + ')">' + esc(tDe(prot[i])) + ' ✕' +
        '<span class="mac">' + Math.round(m.p || 0) + ' g prot' + (m.k !== null && m.k !== undefined ? ' · ' + Math.round(m.k) + ' kcal' : '') + '</span></button>'; }).join('') + '</div>' : '';
    }).join('');
  }
  h += '<p class="muted" style="margin-top:14px">Cantidades aproximadas. Lo que cuenta es acercarte a la meta casi todos los días.</p>';
  $('vComida').innerHTML = h;
}
function botonComida(f, esTop) {
  const c = prot.filter(k => k === f.k).length;
  const quitar = QUITAR_FAV && f.fav;
  return '<button class="food' + (esTop ? ' top' : '') + (f.fav ? ' fav' : '') + (quitar ? ' quitar' : '') + '" onclick="' +
    (quitar ? 'quitarFav(\'' + jsq(f.t) + '\')' : 'addProt(\'' + jsq(f.k) + '\')') + '">' +
    '<span class="ic">' + iconoComida(f) + '</span><b>+' + f.g + ' g</b><span class="nom">' + esc(f.t) + '</span>' +
    (c && !quitar ? '<span class="c">×' + c + '</span>' : '') + (esTop ? '<span class="mas">＋</span>' : '') + '</button>';
}
// Ícono de cada acceso rápido (los que agregas tú usan uno genérico)
const ICONO_COMIDA = { 'Licuado': '🥤', 'Scoop': '🥛', 'Tupper carne': '🍗', 'Tupper pasta': '🍝', 'Cena huevos': '🍳', 'Cena pollo': '🌮', 'Quesadillas': '🫓',
  'Huevos': '🥚', 'Atún': '🐟', 'Carne': '🥩', 'Leche': '🥛', 'Yogurt': '🍶', 'Calle': '🌯' };
function iconoComida(f) {
  if (esRec(f.k)) { const r = recetaDe(f.k.slice(1)); return r && r.ico || '🍽️'; }
  return ICONO_COMIDA[f.k] || '🍽️';
}
function cambiarProt() {
  const dia = diaComida();
  LS.set('gym_prot_' + dia, prot);
  sincronizarDia(dia, prot);
  if (dia === hoy()) { programarAvisoProt(); actualizarWidgets(); }
  pintarComida();
}
function addProt(k) {
  agregarAProt([k], [comidaActual()]); hap('tecla');
  const c = LS.get('gym_food_counts', {}); c[k] = (c[k] || 0) + 1; LS.set('gym_food_counts', c);
  cambiarProt();
}
// "Repetir lo de ayer": todo lo que anotaste ayer, en la misma comida (desayuno, comida, cena), con un toque
function botonRepetirAyer() {
  if (COMIDA_DIA || LS.get('gym_repetido_' + hoy(), false)) return '';
  const l = cargarProt(sumarDias(hoy(), -1)) || [];
  if (!l.length) return '';
  return '<button class="tipico" onclick="repetirAyer()"><span class="ic">↺</span><span style="flex:1"><b>Repetir lo de ayer</b> <span class="pill ok">+' + protTotal(l) + ' g</span><small>' +
    esc(l.slice(0, 5).map(k => tDe(k).split(' · ')[0]).join(' · ') + (l.length > 5 ? ' y ' + (l.length - 5) + ' más' : '')) + '</small></span><span class="mas">＋</span></button>';
}
function repetirAyer() {
  const ayer = sumarDias(hoy(), -1), l = cargarProt(ayer) || [], t = etiquetas(ayer, l.length);
  // Los registros con macros se copian (cada día tiene los suyos)
  const claves = l.map(k => esReg(k) && regDe(k) ? nuevoRegistro(regDe(k)) : k);
  agregarAProt(claves, t.map(x => x || comidaActual()));
  LS.set('gym_repetido_' + hoy(), true);
  hap('ok'); cambiarProt(); toast('+' + protTotal(l) + ' g: lo mismo que ayer ✓');
}
function diaTipico() { const l = diaTipicoLista(); agregarAProt(l, l.map(k => comidaHabitual(k, comidaActual()))); cambiarProt(); }
// Editor del día típico: cuántas veces va cada comida (la misma puede ir 2 veces)
let TIPICO_TMP = null;
function editarTipico(nuevo) {
  if (nuevo || !TIPICO_TMP) TIPICO_TMP = diaTipicoLista().slice();
  const vistas = {}, todas = recetasComoBotones().concat(misComidas(), FOODS.filter(f => f.k !== 'Licuado')).filter(f => !vistas[f.k] && (vistas[f.k] = true));
  const cuantas = k => TIPICO_TMP.filter(x => x === k).length, tot = protTotal(TIPICO_TMP);
  $('sheet').innerHTML = '<div class="row between"><div class="t2">Mi día típico</div><button class="btn ghost sm" onclick="TIPICO_TMP=null;cerrarModal()">✕</button></div>' +
    '<div class="muted" style="margin:4px 0 10px">Lo que comes casi todos los días. Con un toque en Comida se agrega todo junto. Total: <b class="num" style="color:' +
    (tot >= metaProt() ? 'var(--ok)' : 'var(--text)') + '">' + tot + ' g</b> de ' + metaProt() + ' g.</div><div class="tipico-lista">' +
    todas.map(f => { const n = cuantas(f.k); return '<div class="tl' + (n ? ' on' : '') + '"><span class="ic">' + iconoComida(f) + '</span><span class="nm">' + esc(f.t) + '<small>' + f.g + ' g</small></span>' +
      '<button class="mini" onclick="tipicoMas(\'' + jsq(f.k) + '\',-1)"' + (n ? '' : ' disabled') + ' aria-label="Menos">−</button><b class="num">' + n + '</b>' +
      '<button class="mini" onclick="tipicoMas(\'' + jsq(f.k) + '\',1)" aria-label="Más">+</button></div>'; }).join('') + '</div>' +
    '<div class="acts"><button class="btn ghost" onclick="TIPICO_TMP=[];editarTipico()">Vaciar</button><button class="btn" onclick="guardarTipico()">Guardar</button></div>';
  if (!$('modal').classList.contains('show')) abrirModal();
}
function tipicoMas(k, d) {
  if (d > 0) TIPICO_TMP.push(k);
  else { const i = TIPICO_TMP.lastIndexOf(k); if (i > -1) TIPICO_TMP.splice(i, 1); }
  hap('tecla'); editarTipico();
}
function guardarTipico() {
  const l = TIPICO_TMP || [];
  setAjuste('diaTipico', l); DATA.diaTipico = l; LS.set('gym_data', DATA);
  encolar('saveConfig', [{ diaTipico: l }], 'cfg-tipico');
  TIPICO_TMP = null; cerrarModal(); hap('ok');
  toast(l.length ? 'Día típico guardado: ' + protTotal(l) + ' g' : 'Día típico vacío');
  pintarComida(); actualizarWidgets();
}

/* ----- Proteína a las 6 pm: cuánto llevas, cuánto falta y qué de lo que sí comes la completa ----- */
const AVISO_PROT = 80;   // un aviso por día de la semana: ids 80 (dom) a 86 (sáb)
function completarProt(falta) {
  if (falta <= 0) return [];
  const cuenta = LS.get('gym_food_counts', {}), vistas = {};
  const lista = recetasComoBotones().concat(misComidas(), FOODS.filter(f => f.k !== 'Licuado')).filter(f => f.g > 0 && !vistas[f.k] && (vistas[f.k] = true))
    .sort((a, b) => ((cuenta[b.k] || 0) + (b.fav || b.rec ? 2 : 0)) - ((cuenta[a.k] || 0) + (a.fav || a.rec ? 2 : 0))).slice(0, 6);
  // Una sola que alcance (la más chica), o la pareja que alcanza con menos de sobra
  const una = lista.filter(f => f.g >= falta).sort((a, b) => a.g - b.g)[0];
  let par = null;
  lista.forEach((a, i) => lista.slice(i + 1).forEach(b => { const t = a.g + b.g; if (t >= falta && (!par || t < par.t)) par = { t: t, l: [a, b] }; }));
  if (una && (!par || una.g <= par.t)) return [una];
  return par ? par.l : lista.sort((a, b) => b.g - a.g).slice(0, 2);
}
const nombreComida = f => (f.fav || f.rec ? f.t.toLowerCase() : f.k.toLowerCase()) + ' (' + f.g + ' g)';
function textoCompletar(falta) {
  const c = completarProt(falta), suma = c.reduce((a, f) => a + f.g, 0);
  return c.length ? 'Con ' + c.map(nombreComida).join(' + ') + (suma >= falta ? ' la cierras' : ' te acercas') : 'Te faltan ' + falta + ' g';
}
function tarjetaProt6() {
  if (new Date().getHours() < 18 || !ajuste('avisoProt', true)) return '';
  const tot = protTotal(cargarProt(hoy())), falta = metaProt() - tot;
  if (falta <= 0) return '';
  const c = completarProt(falta);
  return '<div class="card prot6"><div class="t1">🥩 Llevas ' + tot + ' g, te faltan ' + falta + '</div><div class="muted" style="margin:4px 0 10px">' + esc(textoCompletar(falta)) + ' · meta ' + metaProt() + ' g</div>' +
    '<div class="botones">' + c.map(f => '<button class="btn sm" onclick="COMIDA_DIA=null;usarProt(hoy());addProt(\'' + jsq(f.k) + '\');pintarTab()">+' + f.g + ' g ' + esc(f.fav ? f.t : f.k) + '</button>').join('') +
    '<button class="btn ghost sm" onclick="verTab(\'Comida\')">Otra…</button></div></div>';
}
/* ----- Pasos contra el trabajo de escritorio (Health Connect, lunes a viernes desde las 5 pm) ----- */
// Lo esperado a esta hora si repartes la meta de 7 am a 10 pm (el aviso nativo usa la misma cuenta)
function pasosEsperados(meta, d) { const h = d.getHours() + d.getMinutes() / 60; return Math.max(0, Math.min(meta, meta * (h - 7) / 15)); }
const horaTexto = d => (d.getHours() % 12 || 12) + (d.getMinutes() ? ':' + String(d.getMinutes()).padStart(2, '0') : '') + (d.getHours() < 12 ? ' am' : ' pm');
// ~100 pasos por minuto caminando; de 10 a 30 minutos, en múltiplos de 5
// Quien ya tenía Health Connect con el APK anterior no ha visto el permiso "en segundo plano": se le pide una vez
function tarjetaPermisoFondo() {
  const e = ESTADO_N;
  if (!NATIVO || !e || !ajuste('salud', false) || !ajuste('avisoPasos', true) || e.fondo || !e.fondoDisponible || LS.get('gym_fondo_no', false)) return '';
  return '<div class="card pasos5"><div class="t1">🚶 Un permiso más para el aviso de pasos</div>' +
    '<div class="muted" style="margin:4px 0 10px">Para que a las 5 pm te avise aunque la app esté cerrada, Health Connect necesita "Acceder a datos en segundo plano". Solo lectura, como lo demás.</div>' +
    '<div class="acts" style="margin-top:0"><button class="btn ghost" onclick="LS.set(\'gym_fondo_no\', true);pintarTab()">Ahora no</button>' +
    '<button class="btn" onclick="permisoFondo()">Permitir</button></div></div>';
}
async function permisoFondo() { if (await conectarSalud()) configurarPasos(); pintarTab(); }
const minutosCaminar = faltan => Math.max(10, Math.min(30, Math.round(faltan / 100 / 5) * 5));
function tarjetaPasos() {
  if (!NATIVO || !ajuste('salud', false) || !ajuste('avisoPasos', true)) return '';
  const ahora = new Date(), dow = ahora.getDay(), s = LS.get('gym_salud', null);
  if (ahora.getHours() < HORA_PASOS || dow === 0 || dow === 6 || !s || Date.now() - s.ts > 3 * 3600e3) return '';
  const x = (s.pasos || []).find(p => p.k === hoy());
  if (!x) return '';   // hoy ninguna app ha mandado pasos: no se puede saber
  const meta = META_PASOS(), esperado = pasosEsperados(meta, ahora);
  if (x.v >= esperado) return '';
  const min = minutosCaminar(esperado - x.v);
  return '<div class="card pasos5"><div class="t1">🚶 Son las ' + horaTexto(ahora) + ' y llevas ' + x.v.toLocaleString('es-MX') + ' pasos: camina ' + min + ' minutos</div>' +
    '<div class="muted" style="margin-top:4px">Meta ' + meta.toLocaleString('es-MX') + ' al día; a esta hora irías en ~' + (Math.round(esperado / 100) * 100).toLocaleString('es-MX') +
    '. Después de horas sentado, una vuelta de ' + min + ' min te pone al día.</div></div>';
}
// APK: hoy a las 6 pm con tus números; sábado y domingo que vienen, un recordatorio aunque no abras la app
function programarAvisoProt() {
  if (!NATIVO || !DATA) return;
  nativo('LocalNotifications', 'cancel', { notifications: [0, 1, 2, 3, 4, 5, 6].map(d => ({ id: AVISO_PROT + d })).concat([0, 1, 2, 3, 4, 5, 6].map(d => ({ id: AVISO_PESO + d })), [{ id: AVISO_CINTURA }]) }).then(() => {
    const ahora = new Date(), lista = [];
    // 7 am: ¿ya te pesaste? (al tocarla abre el teclado con tu último peso); hoy solo si aún no te pesas
    if (ajuste('avisoPeso', true)) for (let d = 0; d < 7; d++) {
      const f = new Date(); f.setDate(f.getDate() + d); f.setHours(7, 0, 0, 0);
      if (f <= ahora || (d === 0 && pesoDe(hoy()) !== null)) continue;
      lista.push({ id: AVISO_PESO + f.getDay(), channelId: 'proteina', schedule: { at: f, allowWhileIdle: true }, title: '⚖️ ¿Ya te pesaste?',
                   body: 'En ayunas, después del baño. Toca aquí: ya trae tu último peso' + (DATA.ultimoPeso ? ' (' + DATA.ultimoPeso + ' kg)' : '') + ' y solo le subes o bajas.', extra: { accion: 'peso' } });
    }
    // Domingo 8 am: medir la cintura con el protocolo (si ese domingo aún no la guardas)
    const dom = new Date(); dom.setDate(dom.getDate() + (7 - dom.getDay()) % 7); dom.setHours(8, 0, 0, 0);
    if (dom <= ahora || LS.get('gym_cint_' + claveDia(dom), null) !== null) dom.setDate(dom.getDate() + 7);
    lista.push({ id: AVISO_CINTURA, channelId: 'proteina', schedule: { at: dom, allowWhileIdle: true }, title: '📏 Hoy toca medir tu cintura',
                 body: 'A la altura del ombligo, en ayunas, al soltar el aire y sin apretar la cinta.' });
    if (!ajuste('avisoProt', true)) return canalProt().then(() => nativo('LocalNotifications', 'schedule', { notifications: lista }));
    for (let d = 0; d < 7; d++) {
      const f = new Date(); f.setDate(f.getDate() + d); f.setHours(18, 0, 0, 0);
      if (f <= ahora) continue;
      const dow = f.getDay(), base = { id: AVISO_PROT + dow, channelId: 'proteina', schedule: { at: f, allowWhileIdle: true } };
      if (d === 0) {
        const tot = protTotal(cargarProt(hoy())), falta = metaProt() - tot;
        if (falta > 0) lista.push(Object.assign(base, { title: 'Llevas ' + tot + ' g, te faltan ' + falta, body: textoCompletar(falta) + ' · meta ' + metaProt() + ' g' }));
      } else if (dow === 0 || dow === 6) {
        lista.push(Object.assign(base, { title: '¿Cómo vas de proteína?', body: 'Meta ' + metaProt() + ' g. Anota lo que llevas: el fin de semana es cuando más se escapa.' }));
      }
    }
    return canalProt().then(() => nativo('LocalNotifications', 'schedule', { notifications: lista }));
  });
}
const AVISO_CINTURA = 90, AVISO_PESO = 70;   // peso: ids 70 (dom) a 76 (sáb)
const canalProt = () => nativo('LocalNotifications', 'createChannel', { id: 'proteina', name: 'Proteína y cintura', description: 'A las 6 pm: cuánto llevas de proteína. Domingo: medir la cintura', importance: 3, visibility: 1 });

/* ----- Comida con IA: escribes lo que comiste y calcula la proteína ----- */
let COMIDA_IA = null, QUITAR_FAV = false, RING_FALTA = false;
function tarjetaComidaIA() {
  if (!DATA.ia) return '';
  const c = COMIDA_IA || {};
  let h = '<div class="card iacard"><div class="row between" style="margin-bottom:8px"><div class="t1">✨ Registro Inteligente</div><span class="pill pri">IA asistida</span></div>' +
    '<textarea id="iaComida" maxlength="600" placeholder="Ej. 3 tacos de asada y una coca · o: la etiqueta dice 24 g por porción y me comí 2" oninput="(COMIDA_IA=COMIDA_IA||{}).texto=this.value">' + esc(c.texto || '') + '</textarea>' +
    '<div class="fila-ia">' + botonMic('iaComida', 'calcularComida') + '<button class="btn" onclick="calcularComida()">' + (c.cargando ? 'Preguntar de nuevo' : 'Calcular') + '</button></div>';
  // Mientras piensa puedes corregir el texto y volver a preguntar: la respuesta vieja se ignora
  if (c.cargando) h += '<div class="muted" style="margin-top:8px">⏳ Calculando… ¿te equivocaste? Corrige y toca «Preguntar de nuevo».</div>';
  if (c.error) h += '<div class="muted" style="margin-top:8px;color:var(--acc)">' + esc(c.error) + '</div>';
  if (c.locales) h += '<div style="margin-top:8px">' + (c.locales.length ? '<div class="muted" style="font-size:13.5px;margin-bottom:4px">¿Es alguno de estos? (catálogo, funciona sin internet)</div>' +
      c.locales.map(a => '<button class="bres" onclick="elegirNut(\'' + jsq(a.id) + '\')"><span class="nm">' + esc(a.n) + '<small>por 100 ' + a.u + ': <b>' + Math.round(a.p * 10) / 10 + ' g prot</b> · ' + Math.round(a.k) + ' kcal</small></span></button>').join('') : '') +
      '<button class="link" style="margin:6px 2px" onclick="abrirBuscador({ q: COMIDA_IA.texto })">🔎 Buscar en el catálogo</button></div>';
  if (c.items && c.items.length) {
    const tot = c.items.filter(x => x.on).reduce((a, x) => a + x.g, 0), kcal = c.items.filter(x => x.on).reduce((a, x) => a + (x.k || 0), 0);
    h += '<div style="margin-top:10px">' + c.items.map((x, i) => '<div class="iitem' + (x.on ? '' : ' off') + '">' +
      '<button class="mini' + (x.on ? ' on' : '') + '" onclick="COMIDA_IA.items[' + i + '].on=!COMIDA_IA.items[' + i + '].on;pintarComida()" aria-label="Incluir">✓</button>' +
      '<div class="nm">' + esc(x.nombre) + (x.nota ? '<small>' + esc(x.nota) + '</small>' : '') + '</div>' +
      '<button class="mini" onclick="ajustarItem(' + i + ',-2)" aria-label="Menos">−</button><span class="g num">' + x.g + ' g</span>' +
      '<button class="mini" onclick="ajustarItem(' + i + ',2)" aria-label="Más">+</button>' +
      '<button class="mini' + (x.fav ? ' on' : '') + '" onclick="guardarFav(' + i + ')" aria-label="Guardar en mis comidas">⭐</button></div>').join('') + '</div>';
    if (c.consejo) h += '<div class="muted" style="margin:8px 0 0;font-size:13.5px">💡 ' + esc(c.consejo) + '</div>';
    h += '<div class="acts"><button class="btn ghost" onclick="COMIDA_IA=null;pintarComida()">Descartar</button>' +
      '<button class="btn"' + (tot || kcal ? '' : ' disabled') + ' onclick="agregarComidaIA()">Agregar +' + tot + ' g' + (kcal ? ' · ' + kcal + ' kcal' : '') + '</button></div>';
  }
  return h + '</div>';
}
async function calcularComida() {
  const c = COMIDA_IA = COMIDA_IA || {};
  c.texto = ($('iaComida') || {}).value || c.texto || '';
  if (!c.texto.trim()) return toast('Escribe qué comiste');
  const id = ++COMIDA_SEQ, texto = c.texto;
  c.error = ''; c.items = null; c.locales = null;
  if (!navigator.onLine) { c.error = 'Sin señal no puedo preguntarle a la IA.'; c.locales = await sugerenciasCatalogo(texto); return repintarComidaIA(); }
  c.cargando = true; repintarComidaIA();
  let r = null, err = null;
  try { r = await conLimite(apiPost('comidaIA', [texto, { meta: metaProt(), llevas: protTotal(), comido: prot.map(tDe) }]), 40000); } catch (e) { err = e; }
  if (id !== COMIDA_SEQ || COMIDA_IA !== c) return;   // ya preguntaste otra cosa o la descartaste
  c.cargando = false;
  if (r && r.items && r.items.length) { c.items = r.items.map(x => Object.assign(x, { on: true })); c.consejo = r.consejo; }
  else {
    const msg = !err ? 'La IA no reconoció la comida' : err.message === 'tiempo' ? 'La IA tardó demasiado' : err.message;
    c.error = 'No se pudo calcular: ' + msg + '. Prueba con otras palabras o elige del catálogo.';
    registrarError('IA comida: ' + msg + ' · «' + texto.slice(0, 80) + '»', 'calcularComida');
    c.locales = await sugerenciasCatalogo(texto);
    if (id !== COMIDA_SEQ || COMIDA_IA !== c) return;
  }
  repintarComidaIA();
}
let COMIDA_SEQ = 0;
// Repinta sin quitarte el teclado si sigues escribiendo
function repintarComidaIA() {
  if (TAB !== 'Comida') return;
  const a = document.activeElement, enTexto = a && a.id === 'iaComida', pos = enTexto ? a.selectionStart : null;
  pintarComida();
  const t = enTexto && $('iaComida');
  if (t) { t.focus(); t.setSelectionRange(pos, pos); }
}
// Si la IA no encuentra la comida: lo más parecido del catálogo, por cada cosa que escribiste ("tacos de asada, coca")
async function sugerenciasCatalogo(texto) {
  if (typeof listaBusqueda !== 'function') return [];
  try { await conLimite(cargarCatalogo(), 8000); } catch (e) { /* sin catálogo grande: busca en lo básico y lo tuyo */ }
  const lista = listaBusqueda(), out = [];
  texto.toLowerCase().split(/[,.;+\n]|\by\b/).map(x => x.trim()).filter(x => x.length > 2).slice(0, 4)
    .forEach(q => {
      // Si con todas las palabras no hay nada (un error de dedo), palabra por palabra
      let r = NUT.buscar(lista, q, 2);
      if (!r.length) r = q.split(/\s+/).filter(w => w.length > 3).sort((a, b) => b.length - a.length).slice(0, 2).map(w => NUT.buscar(lista, w, 1)[0]).filter(Boolean);
      r.forEach(a => { if (!out.some(x => x.id === a.id)) out.push(a); });
    });
  return out.slice(0, 6);
}
function ajustarItem(i, d) { const x = COMIDA_IA.items[i]; x.g = Math.max(0, x.g + d); pintarComida(); }
function agregarComidaIA() {
  // También lo que casi no trae proteína (refresco, fruta, pan): suma calorías y carbohidratos
  const items = COMIDA_IA.items.filter(x => x.on && (x.g > 0 || x.k > 0));
  const cuenta = LS.get('gym_food_counts', {});
  const claves = items.map(x => x.k !== undefined && x.k !== null
    ? nuevoRegistro({ n: x.nombre, q: x.gramos || null, u: x.gramos ? 'g' : '', src: COMIDA_IA.deFoto ? 'foto' : 'ia', p: x.g, c: x.c, f: x.f, k: x.k, fib: x.fib })
    : clavePropia(x.nombre, x.g));
  items.forEach(x => { const k = clavePropia(x.nombre, x.g); cuenta[k] = (cuenta[k] || 0) + 1; });
  agregarAProt(claves, claves.map(() => comidaActual()));
  LS.set('gym_food_counts', cuenta);
  const tot = items.reduce((a, x) => a + x.g, 0);
  const kcal = items.reduce((a, x) => a + (x.k || 0), 0);
  COMIDA_IA = null; hap('ok'); cambiarProt(); toast('+' + tot + ' g' + (kcal ? ' · ' + kcal + ' kcal' : '') + ' ✓');
}
function guardarFav(i) {
  const x = COMIDA_IA.items[i];
  DATA.comidas = (DATA.comidas || []).filter(c => c.t !== x.nombre);
  if (!x.fav) DATA.comidas.unshift(x.k !== undefined && x.k !== null ? { t: x.nombre, g: x.g, c: x.c, f: x.f, k: x.k, fib: x.fib } : { t: x.nombre, g: x.g });
  x.fav = !x.fav;
  encolar('saveConfig', [{ comidas: DATA.comidas.slice(0, 30) }], 'cfg-comidas');
  toast(x.fav ? 'Guardada en Mis comidas ⭐' : 'Quitada de Mis comidas'); pintarComida();
}
function quitarFav(t) {
  DATA.comidas = (DATA.comidas || []).filter(c => c.t !== t);
  encolar('saveConfig', [{ comidas: DATA.comidas }], 'cfg-comidas');
  if (!DATA.comidas.length) QUITAR_FAV = false;
  pintarComida();
}
// Promesa con tiempo máximo
function conLimite(pr, ms) { return Promise.race([pr, new Promise((_, no) => setTimeout(() => no(new Error('tiempo')), ms))]); }

/* ----- Dictado por voz: en el APK usa el reconocedor de Android; en Chrome, el del navegador ----- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const ICO_CAM = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/></svg>';
const ICO_MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/></svg>';
let VOZ = null;   // { id, rec } mientras escucha
function botonMic(idTexto, alTerminar) {
  if (!NATIVO && !SR) return '';
  return '<button class="mic' + (VOZ && VOZ.id === idTexto ? ' oye' : '') + '" id="mic-' + idTexto + '" onclick="dictar(\'' + idTexto + '\',\'' + alTerminar + '\')" aria-label="Dictar por voz">' + ICO_MIC + '</button>';
}
function marcarMic(id, on) { const b = $('mic-' + id); if (b) b.classList.toggle('oye', on); }
async function dictar(id, alTerminar) {
  const ta = $(id);
  if (!ta) return;
  if (VOZ) { const v = VOZ; VOZ = null; marcarMic(v.id, false); try { v.rec ? v.rec.stop() : nativo('SpeechRecognition', 'stop'); } catch (e) {} return; }
  const base = ta.value.trim();
  const terminar = texto => {
    VOZ = null; marcarMic(id, false);
    if (!texto) return toast('No te escuché; intenta otra vez');
    const el = $(id); if (!el) return;
    el.value = (base ? base + ' ' : '') + texto; el.dispatchEvent(new Event('input'));
    hap('ok');
    if (alTerminar && typeof window[alTerminar] === 'function') setTimeout(() => window[alTerminar](), 250);
  };
  if (NATIVO) {
    VOZ = { id: id }; marcarMic(id, true); hap('tecla');
    try {
      await window.Capacitor.nativePromise('SpeechRecognition', 'requestPermissions', {});
      const r = await window.Capacitor.nativePromise('SpeechRecognition', 'start', { language: 'es-MX', maxResults: 1, partialResults: false, popup: false });
      if (VOZ && VOZ.id === id) terminar(r && r.matches && r.matches[0]);
    } catch (e) {
      VOZ = null; marcarMic(id, false);
      toast(/not implemented|no implementado/i.test(String(e && e.message)) ? 'Actualiza el APK para dictar; mientras, usa el micrófono de tu teclado' : 'No pude escucharte: ' + String(e && e.message || e).slice(0, 60));
    }
    return;
  }
  const rec = new SR();
  rec.lang = 'es-MX'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
  let final = '';
  rec.onresult = ev => {
    let parcial = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) { const t = ev.results[i][0].transcript; if (ev.results[i].isFinal) final += t; else parcial += t; }
    const el = $(id); if (el) el.value = (base ? base + ' ' : '') + (final + parcial).trim();   // se ve en vivo
  };
  rec.onerror = ev => { if (ev.error === 'not-allowed') toast('Da permiso de micrófono para dictar'); };
  rec.onend = () => { if (VOZ && VOZ.id === id) terminar(final.trim()); };
  VOZ = { id: id, rec: rec }; marcarMic(id, true); hap('tecla');
  try { rec.start(); } catch (e) { VOZ = null; marcarMic(id, false); toast('No pude usar el micrófono'); }
}

/* ===================== COACH (chat con la IA y el contexto de la app) ===================== */
let CHAT_CARGANDO = false, MEM_ABIERTA = false;
async function borrarMemoria(i) {
  if (!navigator.onLine) return toast('Necesitas señal');
  const antes = DATA.memoria.slice(); DATA.memoria.splice(i, 1); pintarCoach();
  try { DATA.memoria = await apiPost('memoria', [{ borrar: i }]); LS.set('gym_data', DATA); toast('Listo, lo olvidó'); }
  catch (e) { DATA.memoria = antes; toast('No se pudo: ' + e.message.slice(0, 60)); }
  pintarCoach();
}
const SUGS_CHAT = ['¿Cómo voy esta semana?', '¿Qué hago hoy en el gym?', '¿Qué ceno para llegar a mi proteína?', '¿Voy bien para mi carrera?', '¿Qué músculo estoy dejando atrás?'];
function chatLista() { return LS.get('gym_chat', []); }
function asegurarTabCoach() {
  if (!DATA.ia || $('vCoach')) return;
  const v = document.createElement('div'); v.id = 'vCoach'; v.className = 'hide';
  $('vProgreso').after(v);
  const b = document.createElement('button'); b.id = 'nCoach';
  b.setAttribute('onclick', "verTab('Coach')");
  b.innerHTML = '<span class="bola"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/></svg></span>Coach';
  // Con Coach la barra queda simétrica: Comida · Progreso · ENTRENAR · Músculos · Coach
  $('nMusculos').after(b);
}
// Texto del coach: **negritas**, viñetas y saltos de línea; todo lo demás escapado
function formatoChat(t) {
  return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^\s*[-*•]\s+/gm, '• ').replace(/\n/g, '<br>');
}
// Una conversación por día: al día siguiente la de ayer pasa al archivo y empiezas en limpio
function rotarChat() {
  const l = chatLista(), u = l[l.length - 1];
  if (!CHAT_CARGANDO && u && u.ts && claveDia(new Date(u.ts)) !== hoy()) { LS.set('gym_chat_ant', l); LS.set('gym_chat', []); CHAT_TODO = false; }
}
let CHAT_TODO = false, CHAT_ANT = false;
const CHAT_VISIBLES = 6;   // mensajes a la vista; los anteriores se abren con un botón
function burbuja(m) {
  return '<div class="msg ' + (m.rol === 'yo' ? 'yo' : 'coach') + (m.err ? ' err' : '') + '">' +
    (m.rol === 'yo' ? esc(m.texto).replace(/\n/g, '<br>') : formatoChat(m.texto)) +
    (m.aprendio && m.aprendio.length ? '<span class="aprendio">🧠 Lo anoté: ' + esc(m.aprendio.join(' · ')) + '</span>' : '') +
    (m.err ? '<br><button class="link" onclick="reintentarChat()">Reintentar</button>' : '') + '</div>';
}
function pintarCoach() {
  rotarChat();
  const lista = chatLista(), ant = LS.get('gym_chat_ant', []);
  let h = '<div class="row between" style="margin:4px 0 6px"><div class="t1">Pregúntale a tu coach</div>' +
    (lista.length ? '<button class="link" onclick="nuevaCharla()">Nueva conversación</button>' : '') + '</div>';
  const mem = DATA.memoria || [];
  h += '<details class="mem"' + (MEM_ABIERTA ? ' open' : '') + ' ontoggle="MEM_ABIERTA=this.open"><summary>🧠 Lo que tu coach ha aprendido de ti · ' + mem.length + '</summary>' +
    (mem.length ? '<ul>' + mem.map((m, i) => '<li><span>' + esc(m) + '</span><button onclick="borrarMemoria(' + i + ')" aria-label="Olvidar esto">✕</button></li>').join('') + '</ul>'
      : '<div class="muted" style="font-size:13.5px;margin-top:6px">Todavía nada. Aprende al terminar cada sesión y cuando le cuentas algo duradero (una molestia, un cambio de horario).</div>') +
    '<div class="muted" style="font-size:12px;margin-top:4px">Lo usa en cada consejo entre series, en el plan del día y en el chat. Toca ✕ para que lo olvide.</div></details>';
  if (!lista.length) h += '<div class="muted" style="margin-bottom:10px">Conoce tus pesos, tu proteína, tu cintura, tus trotes y tu plan. Pregúntale lo que quieras.</div>' +
    '<div class="sugs">' + SUGS_CHAT.map(q => '<button onclick="preguntar(\'' + jsq(q) + '\')">' + esc(q) + '</button>').join('') + '</div>';
  // La conversación anterior (de otro día) se puede abrir, pero no estorba
  if (ant.length) h += '<button class="chatmas" onclick="CHAT_ANT=!CHAT_ANT;pintarCoach()">' + (CHAT_ANT ? 'Ocultar' : 'Ver') + ' la conversación anterior · ' +
    diaCorto(claveDia(new Date(ant[ant.length - 1].ts || Date.now()))) + '</button>' +
    (CHAT_ANT ? '<div class="chat anterior">' + ant.map(burbuja).join('') + '</div>' : '');
  const ocultos = CHAT_TODO ? 0 : Math.max(0, lista.length - CHAT_VISIBLES);
  if (ocultos) h += '<button class="chatmas" onclick="CHAT_TODO=true;pintarCoach()">Ver ' + ocultos + ' mensaje' + (ocultos === 1 ? '' : 's') + ' anterior' + (ocultos === 1 ? '' : 'es') + ' de hoy</button>';
  h += '<div class="chat">' + lista.slice(ocultos).map(burbuja).join('') +
    (CHAT_CARGANDO ? '<div class="msg coach pensando" aria-label="Pensando"><span></span><span></span><span></span></div>' : '') + '</div>';
  h += '<div class="chatin">' + botonMic('chatTxt', 'preguntar') + '<textarea id="chatTxt" rows="1" maxlength="1500" placeholder="Escribe o dicta tu pregunta…" oninput="BORR.chatTxt=this.value">' + esc(BORR.chatTxt || '') + '</textarea>' +
    '<button class="btn"' + (CHAT_CARGANDO ? ' disabled' : '') + ' onclick="preguntar()">Enviar</button></div>' +
    '<p class="muted" style="font-size:12px;margin-top:8px">Respuestas de IA (Gemini): pueden equivocarse. Si tienes dolor o una lesión, consulta a un médico.</p>';
  $('vCoach').innerHTML = h;
  if (lista.length || CHAT_CARGANDO) setTimeout(() => window.scrollTo({ top: document.body.scrollHeight }), 30);
}
function nuevaCharla() {
  if (CHAT_CARGANDO) return;
  const l = chatLista();
  if (l.length) LS.set('gym_chat_ant', l);
  LS.set('gym_chat', []); CHAT_TODO = false; CHAT_ANT = false; pintarCoach();
}
function preguntar(q) {
  if (CHAT_CARGANDO) return;
  const txt = (q || ($('chatTxt') || {}).value || '').trim();
  if (!txt) return;
  if (!navigator.onLine) return toast('Necesitas señal para hablar con el coach');
  rotarChat();
  const lista = chatLista().filter(m => !m.err);
  delete BORR.chatTxt;
  lista.push({ rol: 'yo', texto: txt, ts: Date.now() });
  LS.set('gym_chat', lista.slice(-40));
  pedirRespuesta();
}
function reintentarChat() { LS.set('gym_chat', chatLista().filter(m => !m.err)); pedirRespuesta(); }
async function pedirRespuesta() {
  CHAT_CARGANDO = true; pintarCoach();
  const hist = chatLista().slice(-10).map(m => ({ rol: m.rol, texto: m.texto }));
  let msg;
  try {
    const r = await conLimite(apiPost('chat', [hist, contextoIA()]), 90000);
    msg = { rol: 'coach', texto: r.texto, ts: Date.now(), aprendio: r.aprendio || [] };
    if (r.memoria) { DATA.memoria = r.memoria; LS.set('gym_data', DATA); }
  } catch (e) {
    msg = { rol: 'coach', err: true, texto: 'No pude responder: ' + (e.message === 'tiempo' ? 'tardé demasiado.' : e.message), ts: Date.now() };
  }
  const lista = chatLista(); lista.push(msg); LS.set('gym_chat', lista.slice(-40));
  CHAT_CARGANDO = false;
  if (TAB === 'Coach') pintarCoach(); else if (!msg.err) toast('El coach te respondió', '', { txt: 'Ver', fn: () => verTab('Coach') });
}
// Lo que el coach ve de la app en cada pregunta (compacto: solo lo que ayuda a decidir)
function contextoIA() {
  const R = DATA.resumen || {}, Cu = DATA.cuerpo || {}, T = DATA.trotes || {};
  const protHoyLista = cargarProt(hoy());
  return {
    fecha: DATA.today, dias_de_gym: DATA.dias, grupo_de_hoy: grupoDeHoy(), bloque: DATA.bloquePara, semana_de_carrera: !!DATA.descargaCarrera,
    peso: { hoy: pesoDe(hoy()), promedio_7_dias: R.promedio7, cambio_vs_semana_pasada: R.cambioSemana,
            ultimos_30_dias: (R.serie30 || []).map(x => x.d + ' ' + x.v).join(', ') },
    cintura: { base: Cu.base, actual: Cu.actual, meta: Cu.meta, por_semana: (Cu.serie || []).map(x => x.d + ': ' + (x.cint || '—') + ' cm, ' + (x.peso || '—') + ' kg').join(' | ') },
    proteina: { meta: metaProt(), hoy_g: protTotal(protHoyLista), comido_hoy: protHoyLista.map(tDe), promedio_7_dias: R.protProm7 },
    macros: (() => { const t = totalMacros(protHoyLista), m = metasHoy(); return { hoy: { kcal: t.k, carbs_g: t.c, grasa_g: t.f, fibra_g: t.fib }, metas: { kcal: m.k, carbs_g: m.c, grasa_g: m.f, fibra_g: m.fib },
      promedio_7_dias: DATA.macros7 || null }; })(),
    gym: { dias_ultimos_7: R.gymDias7, dias_esta_semana: R.diasSemana, racha_semanas: R.racha,
           series_por_musculo_7_dias: (R.musculos || []).map(m => m.m + ' ' + m.series7).join(', '),
           records_recientes: (R.records || []).slice(0, 5) },
    sesion_de_hoy: sesion().log.map(l => l.ej + ': ' + resumenSets(l.sets) + ' ' + l.unit),
    ejercicios: DATA.exercises.filter(e => e.anterior && e.anterior.length).map(e => e.group + ' · ' + e.ejercicio + ' (' + e.min + '–' + e.max + ' reps) · ' +
      'última vez ' + e.lastWhen + ' → ' + resumenSets(e.anterior) + ' ' + e.unit + (e.hint ? ' · siguiente: ' + e.hint : '')),
    trote: { km_7_dias: T.km7, ultimos: (T.ultimos || []).map(t => t.d + ' ' + t.km + ' km en ' + t.min + ' min' + (t.tipo ? ' (' + t.tipo + ')' : '')),
             carrera: DATA.carrera, plan_semana: DATA.plan ? (DATA.plan.sesiones || []).map(x => x.tipo + ' ' + x.txt + (x.hecho ? ' ✓' : '')) : null },
    puntos_semana: DATA.logros ? DATA.logros.semana : null
  };
}
function quitarProt(i) {
  asegurarProt();
  const dia = diaComida(), t = etiquetas(dia, prot.length);
  prot.splice(i, 1); t.splice(i, 1); LS.set('gym_protmeal_' + dia, t);
  cambiarProt();
}

/* ===================== PROGRESO ===================== */
let EJ_GRAF = null;
function fmt(v, signo) {
  if (v === null || v === undefined) return '—';
  const n = Math.round(v * 10) / 10;
  return (signo && n > 0 ? '+' : '') + n.toFixed(1);
}
const kpi = (v, l, d, good) => '<div class="kpi"><div class="v num">' + v + '</div><div class="l">' + l + '</div>' + (d ? '<div class="d' + (good ? ' good' : '') + '">' + d + '</div>' : '') + '</div>';
function pintarProgreso() {
  let h = '<div class="seg s4">' + ['Semana', 'Fuerza', 'Cuerpo', 'Logros'].map(t => '<button class="' + (PTAB === t ? 'on' : '') + '" onclick="PTAB=\'' + t + '\';pintarProgreso();window.scrollTo(0,0)">' + t + '</button>').join('') + '</div>';
  if (PTAB === 'Semana') h += progresoSemana();
  else if (PTAB === 'Fuerza') h += tarjetaFuerza() + tarjetaMusculos(DATA.resumen.musculos || []);
  else if (PTAB === 'Logros') h += progresoLogros();
  else h += progresoCuerpo();
  $('vProgreso').innerHTML = h;
  if (PTAB === 'Cuerpo' && DATA.fotos && DATA.fotos.activas) cargarFotos();
}
function progresoSemana() {
  const r = DATA.resumen;
  const dias = ['L', 'M', 'M', 'J', 'V', 'S', 'D'], hoyIdx = (new Date().getDay() + 6) % 7;
  // Lo que hiciste hoy y aún no llega a la hoja también cuenta
  const semana = (r.semana || []).slice(), hoyLocal = sesion().log.length > 0;
  let diasSemana = r.diasSemana || 0;
  if (hoyLocal && !semana[hoyIdx]) { semana[hoyIdx] = true; diasSemana++; }
  const subir = (r.subir || []).filter(s => !DATA.exercises.some(e => e.ejercicio === s.ej && state[e.name] && state[e.name].done));
  let h = '<div class="card"><div class="row between"><div><div class="t2">' + (diasSemana >= META_DIAS ? diasSemana + ' días ✓' : diasSemana + ' de ' + META_DIAS + ' días') + '</div><div class="muted">esta semana · ' + fmt(r.km7) + ' km trotados</div></div>' +
    (r.racha ? '<span class="pill acc" style="font-size:13px;padding:6px 10px">' + ICO.flame + r.racha + ' semana' + (r.racha === 1 ? '' : 's') + '</span>' : '') + '</div>' +
    '<div class="week">' + dias.map((d, i) => '<div class="' + (semana[i] ? 'y' : '') + (i === hoyIdx ? ' hoy' : '') + '"><i></i>' + d + '</div>').join('') + '</div>' +
    '<div class="muted" style="margin-top:8px">La racha cuenta semanas seguidas con 3 o más días de gym.</div>' +
    (DATA.logros ? '<button class="link" style="margin-top:10px" onclick="PTAB=\'Logros\';pintarProgreso();window.scrollTo(0,0)">' +
      ICO.trophy.replace('class="icon"', 'class="icon" style="width:16px;height:16px;vertical-align:-3px"') + ' Llevas ' + DATA.logros.semana.pts + ' puntos esta semana · ver logros</button>' : '') + '</div>';
  if (r.descarga) h += '<div class="card" style="background:var(--acc-weak);border-color:transparent"><div class="t1" style="color:var(--acc)">Considera una semana de descarga</div>' +
    '<div class="muted" style="margin-top:4px">Estos ejercicios no mejoraron en sus últimas 3 sesiones: ' + esc(r.descarga.estancados.join(', ')) +
    '. Una semana con la mitad de series y el mismo peso suele destrabarlos.</div></div>';
  if (subir.length) h += '<h2>Te toca subir peso</h2><div class="card">' + subir.map(s => '<div class="rec"><div class="medal">' + ICO.up + '</div><div style="flex:1">' +
    '<div class="t1" style="font-size:15px">' + esc(s.ej) + '</div><div class="muted">Próxima vez</div></div><b class="num" style="color:var(--acc)">' + s.peso + ' ' + s.unit + '</b></div>').join('') + '</div>';
  if (r.records && r.records.length) h += '<h2>Récords recientes</h2><div class="card">' + r.records.map(x =>
    '<div class="rec"><div class="medal">' + ICO.trophy + '</div><div style="flex:1;min-width:0"><div class="t1" style="font-size:15px">' + esc(x.ej) + '</div>' +
    '<div class="muted num">' + x.w + ' ' + x.unit + ' × ' + x.r + ' · ' + x.k.slice(8, 10) + '/' + x.k.slice(5, 7) + (/peso/.test(x.tipo) ? ' · más peso que nunca' : '') + '</div></div>' +
    (x.pct > 0 ? '<b class="num up">+' + x.pct + '%</b>' : '') + '</div>').join('') + '</div>';
  h += '<h2>Hábitos</h2><div class="kpis">' +
    (DATA.plan && DATA.plan.sesiones
      ? kpi(DATA.plan.sesiones.filter(x => x.hecho).length + '/' + DATA.plan.sesiones.length, 'Trotes del plan', 'Semana ' + DATA.plan.semana + ' de ' + DATA.plan.total, DATA.plan.sesiones.every(x => x.hecho))
      : kpi(fmt(r.km7), 'Km trotados (7 días)', '', false)) +
    kpi(r.protProm7 !== null ? r.protProm7 + ' g' : '—', 'Proteína promedio', 'Meta: ' + metaProt() + ' g', r.protProm7 !== null && r.protProm7 >= metaProt()) + kpisSalud() + '</div>';
  h += '<a class="btn ghost block" style="display:block;text-align:center;text-decoration:none;margin-top:6px" href="' + r.sheetUrl + '" target="_blank" rel="noopener">Abrir dashboard completo</a>';
  const boton = '<button class="btn block reporte" onclick="copiarReporte()">📋 COPIAR REPORTE DEL DOMINGO</button>';
  return new Date().getDay() === 0 ? boton + h : h + boton;
}
// Texto para pegar donde quieras: promedios de los últimos 7 días; lo que la app no tiene se queda en blanco
function textoReporte() {
  const r = DATA.resumen || {}, v = (x, u) => x === null || x === undefined || x === '' ? '' : x + u;
  const cint = LS.get('gym_cint_' + hoy(), null) !== null ? LS.get('gym_cint_' + hoy(), null) : r.cintura;
  const hoyContado = DATA.todayKey === hoy() && DATA.exercises.some(e => e.done);
  const gym = (r.gymDias7 || 0) + (!hoyContado && sesion().log.length ? 1 : 0);
  const sal = LS.get('gym_salud', null);             // Health Connect (APK), cuando esté conectado
  const prom = a => a && a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length * 10) / 10 : null;
  const pasos = sal && sal.pasos ? prom(sal.pasos.filter(x => x.k < hoy()).map(x => x.v)) : null, sueno = sal && sal.sueno ? prom(sal.sueno.map(x => x.h)) : null;
  const rp = ritmoPeso(), falla = comidaQueFalla();
  return ['Reporte semanal · ' + ddmm(sumarDias(hoy(), -6)) + ' al ' + ddmm(hoy()),
    'Peso promedio (7 días): ' + v(r.promedio7, ' kg') + (r.cambioSemana !== null && r.cambioSemana !== undefined ? ' (' + signo(r.cambioSemana) + ' kg vs semana anterior)' : ''),
    'Ritmo de peso: ' + (rp ? signo(rp.pct) + ' %/semana (ideal −0.25 a −0.5 %)' : ''),
    'Cintura: ' + v(cint, ' cm'),
    'Días de gym: ' + gym,
    'Km corridos: ' + v(r.km7, ' km'),
    'Proteína promedio: ' + v(r.protProm7, ' g') + ' (meta ' + metaProt() + ' g)' + (falla ? '; ' + textoFalla(falla) : ''),
    'Pasos promedio: ' + v(pasos === null ? null : Math.round(pasos).toLocaleString('es-MX'), ''),
    'Sueño promedio: ' + v(sueno, ' h')].join('\n');
}
async function copiarTexto(t, msg) {
  try { await navigator.clipboard.writeText(t); }
  catch (e) {
    const a = document.createElement('textarea'); a.value = t; a.style.position = 'fixed'; a.style.opacity = '0';
    document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (e2) {} a.remove();
  }
  hap('ok'); toast(msg);
}
function copiarReporte() { return copiarTexto(textoReporte(), 'Reporte copiado ✓ Pégalo donde quieras'); }
// Health Connect: promedio de 7 días de pasos y sueño (solo si lo conectaste en el APK)
function kpisSalud() {
  const s = LS.get('gym_salud', null);
  if (!s) return '';
  const prom = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const p = prom((s.pasos || []).filter(x => x.k < hoy()).map(x => x.v)), h = prom((s.sueno || []).map(x => x.h));   // hoy va a medias: no cuenta
  return (p !== null ? kpi(Math.round(p).toLocaleString('es-MX'), 'Pasos promedio', 'Health Connect · 7 días', p >= 8000) : '') +
    (h !== null ? kpi(Math.round(h * 10) / 10 + ' h', 'Sueño promedio', 'Health Connect · 7 días', h >= 7) : '');
}
/* ----- Ritmo de peso: bajar 0.25–0.5 % por semana, medido con el promedio de 7 días ----- */
const signo = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v);
function ritmoPeso() {
  const r = DATA.resumen || {};
  if (r.promedio7 === null || r.promedio7 === undefined || r.cambioSemana === null || r.cambioSemana === undefined) return null;
  const antes = r.promedio7 - r.cambioSemana, pct = antes > 0 ? r.cambioSemana / antes * 100 : 0;
  const cs = ((DATA.cuerpo && DATA.cuerpo.serie) || []).filter(x => x.cint !== null && x.cint !== undefined);
  const cint = cs.length >= 2 ? Math.round((cs[cs.length - 1].cint - cs[cs.length - 2].cint) * 10) / 10 : null, bajaCint = cint !== null && cint < 0;
  let estado, txt;
  if (pct < -1) { estado = 'red'; txt = 'Demasiado rápido: así también se va músculo. Come ~300 kcal más al día (una porción extra de arroz, avena o pan) sin bajar la proteína.'; }
  else if (pct < -0.5) { estado = 'acc'; txt = 'Un poco rápido: agrega ~150–200 kcal al día (una fruta y un puño de nueces) para no perder músculo.'; }
  else if (pct <= -0.25) { estado = 'ok'; txt = 'Ritmo ideal: bajas panza sin perder músculo. Sigue igual.'; }
  else if (pct <= 0.1) { estado = bajaCint ? 'ok' : 'acc'; txt = bajaCint ? 'Lento en la báscula, pero tu cintura bajó ' + Math.abs(cint) + ' cm: cambias grasa por músculo. Sigue igual.'
                                                                 : 'Lento. Si en 2 semanas sigue así y la cintura no baja, quita ~150 kcal al día (una tortilla o un refresco menos).'; }
  else { estado = bajaCint ? 'acc' : 'red'; txt = bajaCint ? 'Subiste, pero tu cintura bajó: puede ser músculo o agua. Revisa la semana que viene antes de cambiar algo.'
                                                           : 'Estás subiendo: ajusta. Quita ~200 kcal al día (bebidas con azúcar, pan dulce o una porción de tortillas) sin bajar la proteína.'; }
  const kg = f => Math.round(antes * f) / 100;
  return { pct: Math.round(pct * 100) / 100, kg: r.cambioSemana, ideal: [kg(0.25), kg(0.5)], estado: estado, txt: txt, n7: DATA.n7 === undefined ? null : DATA.n7 };
}
function tarjetaRitmoPeso() {
  const x = ritmoPeso();
  if (!x) return '<div class="card"><div class="t1">Ritmo de peso semanal</div><div class="muted" style="margin-top:4px">Aparece con 2 semanas de pesajes. La meta: bajar 0.25–0.5 % de tu peso por semana.</div></div>';
  // Escala de −1.5 % a +1 %: la zona verde es el ritmo ideal
  const pos = v => Math.max(0, Math.min(100, (v + 1.5) / 2.5 * 100));
  return '<div class="card ritmo"><div class="row between"><div class="t1">Ritmo de peso semanal</div><span class="pill ' + x.estado + ' num">' + signo(x.pct) + ' %/sem</span></div>' +
    '<div class="escala"><div class="zona" style="left:' + pos(-0.5) + '%;width:' + (pos(-0.25) - pos(-0.5)) + '%"></div><i style="left:' + pos(x.pct) + '%"></i></div>' +
    '<div class="escala-l"><span>−1.5 %</span><span>ideal −0.25 a −0.5 %</span><span>+1 %</span></div>' +
    '<div class="muted" style="margin:8px 0 6px">Promedio de 7 días: <b class="num" style="color:var(--text)">' + signo(x.kg) + ' kg</b> vs la semana anterior. Para ti, ideal: bajar ' + x.ideal[0] + '–' + x.ideal[1] + ' kg por semana.</div>' +
    '<div style="font-size:14.5px">' + esc(x.txt) + '</div>' +
    (x.n7 !== null && x.n7 < 3 ? '<div class="muted" style="font-size:12.5px;margin-top:6px">Esta semana llevas ' + x.n7 + ' pesaje' + (x.n7 === 1 ? '' : 's') + ': con 3 o más mañanas el promedio es confiable.</div>' : '') + '</div>';
}
function progresoCuerpo() {
  const r = DATA.resumen;
  let h = '<div class="kpis">' +
    kpi(fmt(r.promedio7), 'Peso promedio 7 días (kg)', r.cambioSemana !== null ? fmt(r.cambioSemana, true) + ' vs semana anterior' : '', r.cambioSemana !== null && r.cambioSemana <= 0) +
    kpi(fmt(r.cintura), 'Cintura (cm)', r.cambioCintura !== null ? fmt(r.cambioCintura, true) + ' desde el inicio' : '', r.cambioCintura !== null && r.cambioCintura < 0) + '</div>';
  h += tarjetaRitmoPeso() + tarjetaMetaCintura();
  const serie = (DATA.cuerpo && DATA.cuerpo.serie) || [];
  const cs = serie.filter(x => x.cint !== null).map(x => ({ d: x.d, v: x.cint }));
  const ps = serie.filter(x => x.peso !== null).map(x => ({ d: x.d, v: x.peso }));
  h += '<div class="card chart"><div class="t1">Cintura desde el inicio</div>' + (cs.length >= 2 ? linea(cs, false, 'var(--cyan)')
    : '<div class="muted" style="margin-top:6px">La gráfica aparece con 2 domingos medidos. Tu cintura es el mejor indicador de la grasa de la panza.</div>') + '</div>';
  h += '<div class="card chart"><div class="t1">Peso promedio por semana</div>' + (ps.length >= 2 ? linea(ps, false, 'var(--pri)')
    : '<div class="muted" style="margin-top:6px">Aparece con 2 semanas de pesajes. El promedio semanal no se mueve con el agua de un día.</div>') + '</div>';
  h += '<div class="card chart"><div class="t1">Peso, últimos 30 días</div>' + graficaPeso(r.serie30) + '</div>';
  if (DATA.fotos && DATA.fotos.activas) h += tarjetaFotos();
  return h;
}
function tarjetaMetaCintura() {
  const c = DATA.cuerpo;
  if (!c) return '';
  if (!c.meta) return '<div class="card"><div class="t1">Tu meta de cintura</div><div class="muted" style="margin:4px 0 10px">Ponle número a la panza: con una meta ves cuánto llevas.</div>' +
    '<button class="btn ghost sm" onclick="abrirAjustes()">Ponerla en Ajustes</button></div>';
  if (c.actual === null) return '<div class="card"><div class="t1">Meta de cintura: ' + c.meta + ' cm</div><div class="muted" style="margin-top:4px">Mide tu cintura el domingo para empezar a ver tu avance.</div></div>';
  const total = c.base - c.meta, lleva = c.base - c.actual;
  const pct = total > 0 ? Math.max(0, Math.min(1, lleva / total)) : (c.actual <= c.meta ? 1 : 0);
  const fx = v => (Math.round(v * 10) / 10).toString();
  return '<div class="card"><div class="row between"><div class="t1">Meta de cintura</div><span class="pill ' + (pct >= 1 ? 'ok' : 'pri') + '">' + Math.round(pct * 100) + '%</span></div>' +
    '<div class="metabar"><div style="width:' + Math.max(pct * 100, 3) + '%"></div></div>' +
    '<div class="row between muted"><span>Inicio ' + fx(c.base) + ' cm</span><b style="color:var(--text)">Hoy ' + fx(c.actual) + ' cm</b><span>Meta ' + fx(c.meta) + ' cm</span></div>' +
    '<div class="muted" style="margin-top:8px">' + (pct >= 1 ? '¡Meta cumplida! Pon la siguiente en Ajustes.' : lleva > 0 ? 'Llevas ' + fx(lleva) + ' de ' + fx(total) + ' cm. Te faltan ' + fx(c.actual - c.meta) + '.' : 'Aún no baja: es normal las primeras semanas. Lo que cuenta es la tendencia.') + '</div></div>';
}
function progresoLogros() {
  const L = DATA.logros;
  if (!L) return '<div class="card muted">Los logros aparecen cuando la app se conecta.</div>';
  const s = L.semana;
  const parte = (nom, v, max) => '<div><div class="l"><span>' + nom + '</span><b class="num">' + Math.min(v, max) + '/' + max + '</b></div><div class="b"><div style="width:' + Math.min(100, v / max * 100) + '%"></div></div></div>';
  let h = '<div class="card"><div class="row between"><div><div class="muted">Esta semana</div><div class="pts"><b class="num">' + s.pts + '</b><span class="muted">/ 100 puntos</span></div></div>' +
    (L.total > 1 ? '<span class="pill ' + (L.rank === 1 ? 'acc' : 'pri') + '" style="font-size:13px;padding:6px 10px">' + (L.rank === 1 ? '🥇 Tu mejor semana' : 'Lugar ' + L.rank + ' de ' + L.total) + '</span>' : '') + '</div>' +
    '<div class="desglose">' + parte('Gym', s.gym, 4) + parte('Proteína en meta', s.prot, 7) + parte('Trote', s.trote, 3) + parte('Pesarte', s.peso, 7) + '</div>' +
    '<div class="muted" style="margin-top:10px">' + (L.mejor === null ? 'Tu primera semana: esta es la marca a superar.' : (L.rank === 1 ? '¡Es tu mejor semana! Compites solo contra ti.' : 'Tu mejor semana: ' + L.mejor + ' puntos' + (L.mejor - s.pts <= 10 ? ' · te faltan ' + (L.mejor - s.pts + 1) + ' para superarla' : '') + '. Compites solo contra ti.')) + '</div></div>';
  if (L.hist.length >= 2) h += '<div class="card chart"><div class="t1">Tus puntos por semana</div>' + barras(L.hist) + '</div>';
  // Medallas: todas las ganadas y solo la siguiente de cada tipo, con su avance
  const ganadas = L.medallas.filter(m => m.ok), vistas = {};
  const siguientes = L.medallas.filter(m => !m.ok && !vistas[m.fam] && (vistas[m.fam] = true));
  const med = m => '<div class="med' + (m.ok ? '' : ' no') + '"><div class="i">' + m.ico + '</div><div class="n">' + esc(m.nom) + '</div>' +
    (m.ok ? '<div class="p">' + esc(m.desc) + '</div>' : '<div class="mb"><div style="width:' + Math.round(m.val / m.meta * 100) + '%"></div></div><div class="p num">' + m.val + ' / ' + m.meta + '</div>') + '</div>';
  h += '<h2>Medallas · ' + ganadas.length + ' de ' + L.medallas.length + '</h2>';
  if (ganadas.length) h += '<div class="meds mini">' + ganadas.map(m => '<div class="med"><div class="i">' + m.ico + '</div><div class="n">' + esc(m.nom) + '</div></div>').join('') + '</div>';
  else h += '<div class="muted" style="margin:0 4px 8px">Todavía ninguna: la primera llega con tu primer entrenamiento registrado.</div>';
  h += '<h2>Siguientes</h2><div class="meds">' + siguientes.map(med).join('') + '</div>';
  return h;
}
// Al ganar una medalla nueva: celebración (o un aviso corto si estás a media sesión)
function revisarMedallas() {
  if (!DATA || !DATA.logros) return;
  const ok = DATA.logros.medallas.filter(m => m.ok).map(m => m.id);
  const vistas = LS.get('gym_medallas', null);
  if (vistas === null) { LS.set('gym_medallas', ok); return; }      // primera vez con esta versión: sin avalancha
  const nuevas = DATA.logros.medallas.filter(m => m.ok && !vistas.includes(m.id));
  if (!nuevas.length) return;
  LS.set('gym_medallas', vistas.concat(nuevas.map(m => m.id)));
  hap('pr');
  if (sesionActiva() || $('modal').classList.contains('show')) return toast('🏅 Medalla nueva: ' + nuevas.map(m => m.nom).join(', '), 'pr');
  $('sheet').innerHTML = '<div class="celebra"><div class="i">' + nuevas[0].ico + '</div><div class="t2" style="margin-top:6px">' +
    (nuevas.length === 1 ? '¡Medalla nueva!' : '¡' + nuevas.length + ' medallas nuevas!') + '</div>' +
    nuevas.map(m => '<div style="margin-top:8px"><b>' + esc(m.nom) + '</b><div class="muted">' + esc(m.desc) + '</div></div>').join('') + '</div>' +
    '<div class="acts"><button class="btn ghost" onclick="cerrarModal()">Seguir</button><button class="btn" onclick="cerrarModal();verTab(\'Progreso\');PTAB=\'Logros\';pintarProgreso()">Ver mis logros</button></div>';
  abrirModal();
}
function tarjetaFuerza() {
  const conHist = DATA.exercises.filter(e => e.hist && e.hist.length >= 2 && e.inc > 0);
  let h = '<div class="card chart">';
  if (!conHist.length) return h + '<div class="t1">Fuerza por ejercicio</div><div class="muted" style="margin-top:6px">Aparece cuando registres un ejercicio con peso al menos 2 días.</div></div>';
  if (!EJ_GRAF || !conHist.some(e => e.name === EJ_GRAF)) EJ_GRAF = conHist.slice().sort((a, b) => b.hist.length - a.hist.length)[0].name;
  const ex = exDe(EJ_GRAF);
  const pts = ex.hist, mejor = Math.max.apply(null, pts.map(p => p.e1)), cambio = (pts[pts.length - 1].e1 / pts[0].e1 - 1) * 100;
  h += '<select onchange="EJ_GRAF=this.value;pintarProgreso()">' + conHist.map(e => '<option value="' + esc(e.name) + '"' + (e.name === EJ_GRAF ? ' selected' : '') + '>' + esc(e.ejercicio) + '</option>').join('') + '</select>' +
    '<div class="row between" style="margin:6px 0"><div class="muted">Fuerza estimada (1RM, lb de carga real)</div><b class="num ' + (cambio >= 0 ? 'up' : 'down') + '">' + (cambio > 0 ? '+' : '') + cambio.toFixed(1) + '%</b></div>' +
    linea(pts.map(p => ({ d: p.d, v: p.e1 })), false, 'var(--cyan)', 'var(--pri)') +
    '<div class="muted" style="margin-top:4px">Mejor: <b class="num" style="color:var(--text)">' + mejor.toFixed(1) + ' lb</b> · ' + pts.length + ' sesiones</div></div>';
  return h;
}
/* ----- Mapa muscular por zonas específicas (Catálogo T): cada ejercicio suma a sus zonas (principal 1, apoyo ½) ----- */
// Por zona, contra la meta de tu objetivo (metaZona): falta · poco · en meta · arriba del tope.
// Es más bajo que el 10–20 por músculo completo porque cada zona es una parte del músculo.
let MUS_SEL = null;
// Mapa muscular anatómico (dibujo propio). Se define la mitad izquierda (x < 100) de cada figura y la derecha es su espejo.
// Cada pieza: [zona que cuenta series | '' = anatomía que no se cuenta, path SVG].
const ANAT = {
  sil: 'M100,9 C88,9 82,18 82,31 C82,43 86,51 91,56 L90,64 C84,70 76,74 66,77 C54,78 45,88 43,104 C42,118 42,134 42,150 C41,158 40,164 39,168 C35,180 32,196 30,212 C29,222 29,229 30,234 C26,240 23,250 24,258 C25,266 28,272 32,274 C34,272 34,267 34,263 L36,266 C38,268 40,266 39,260 C39,252 40,244 41,236 C44,224 48,206 52,190 C55,180 57,172 58,164 C60,150 61,136 63,124 C65,140 66,158 68,176 C70,190 68,200 66,206 C62,216 60,226 59,236 C56,260 56,286 60,308 C62,320 64,330 66,340 C63,354 62,368 64,382 C66,396 70,408 72,418 C70,424 66,430 66,434 C68,438 78,438 84,436 C88,434 88,428 87,420 C87,410 88,398 90,384 C92,370 92,354 91,340 C92,330 93,318 94,306 C96,290 98,270 98,252 L100,250 Z',
  frente: [
    ['', 'M91,56 C92,62 93,68 96,74 L100,76 L100,58 C97,58 94,57 91,56 Z'],
    ['Trapecio', 'M91,60 C86,67 78,72 66,78 L77,80 C84,77 90,74 94,71 Z'],
    ['Deltoide lateral', 'M66,78 C54,78 46,88 44,104 C43,114 45,122 48,126 C50,114 52,101 57,91 C60,85 63,81 66,78 Z'],
    ['Deltoide frontal', 'M67,79 C61,84 57,91 54,101 C52,110 50,119 49,126 C55,123 59,117 62,109 C65,100 69,91 74,83 Z'],
    ['Pecho superior', 'M99,81 C91,79 81,80 75,83 C70,89 67,96 65,104 C74,99 86,95 99,97 Z'],
    ['Pecho medio', 'M99,98.5 C86,97 74,101 65,105.5 C63,111 65,119 71,124 C79,130 90,132 99,129 Z'],
    ['', 'M70,126 C67,131 66,137 67,143 L74,141 C74,135 73,130 70,126 Z'],
    ['', 'M70,141 C68,145 68,150 69,155 L76,152 C75,148 74,144 70,141 Z'],
    ['Oblicuos', 'M85,133 C78,132 74,138 72,146 C70,158 69,172 70,186 C71,198 77,207 86,213 C86,196 85,176 85,156 Z'],
    ['Abdomen', 'M87,133 L99,133 L99,150 L87,150 C86,144 86,139 87,133 Z'],
    ['Abdomen', 'M87,152 L99,152 L99,169 L87,169 C86,163 86,158 87,152 Z'],
    ['Abdomen', 'M87.5,171 L99,171 L99,188 L88,188 C87,182 87,177 87.5,171 Z'],
    ['Abdomen', 'M88,190 L99,190 L99,232 L97,232 C91,220 88,206 88,190 Z'],
    ['Bíceps', 'M55,113 C49,119 46,132 46,145 C46,155 48,162 52,166 C56,160 58,148 58,136 C58,126 58,118 55,113 Z'],
    ['Tríceps', 'M47,122 C44,131 43,145 43,156 C44,161 46,164 49,166 C46,152 46,136 47,122 Z'],
    ['Antebrazo', 'M47,166 C41,172 37,184 34,198 C32,207 31,215 31,223 C35,207 40,191 49,176 Z'],
    ['Antebrazo', 'M51,169 C45,178 40,192 36,208 C34,217 33,225 33,232 L40,233 C42,222 45,207 49,193 C52,184 53,175 51,169 Z'],
    ['Glúteo medio', 'M66,207 C62,215 60,225 60,236 C63,236 66,232 68,226 C70,218 69,211 66,207 Z'],
    ['Cuádriceps', 'M61,238 C57,258 57,282 60,302 C62,314 65,323 68,329 C70,313 70,292 70,272 C70,257 67,245 61,238 Z'],
    ['Cuádriceps', 'M72,230 C68,248 68,272 70,293 C72,309 76,320 80,327 C84,317 86,301 85,283 C84,263 80,244 72,230 Z'],
    ['Cuádriceps', 'M86,288 C84,301 82,313 82,322 C85,330 90,332 92,326 C93,314 92,301 86,288 Z'],
    ['', 'M69,222 C78,240 86,262 90,290 C91,296 92,301 92,305 L94.5,302 C92.5,280 86,254 73,225 Z'],
    ['Aductores', 'M92,243 C87,253 85,268 86,288 C89,282 94,272 97.5,261 C98.5,253 98,247 96,243 Z'],
    ['', 'M80,330 C75,330 72,335 73,341 C74,346 78,348 82,347 C86,345 87,340 86,335 C85,332 83,330 80,330 Z'],
    ['', 'M70,348 C67,362 68,381 71,399 C73,407 76,413 79,417 C80,401 80,381 79,361 C78,352 75,348 70,348 Z'],
    ['Pantorrilla', 'M84,346 C89,354 92,368 91,383 C90,392 87,398 84,401 C81,389 81,369 82,354 Z'],
    ['Pantorrilla', 'M67,349 C63,359 62,374 65,387 C67,380 68,366 67,349 Z']
  ],
  espalda: [
    ['Trapecio', 'M100,56 C95,60 92,65 90,69 C84,74 76,77 66,79 C74,84 82,91 87,100 C92,113 96,131 100,152 Z'],
    ['Deltoide lateral', 'M66,78 C54,78 46,88 44,104 C43,114 45,122 48,126 C50,117 52,108 55,100 C57,92 61,84 66,78 Z'],
    ['Deltoide posterior', 'M67,80 C62,84 58,91 56,99 C55,106 55,112 57,116 C63,109 69,100 75,89 C73,85 70,82 67,80 Z'],
    ['Espalda media', 'M76,90 C70,98 64,106 61,113 C63,119 69,123 76,124 C82,122 86,116 87,108 C85,100 81,94 76,90 Z'],
    ['Espalda media', 'M61,115 C59,121 60,126 64,129 C70,129 74,127 77,125 C71,124 65,120 61,115 Z'],
    ['Dorsal', 'M62,124 C60,136 62,152 66,168 C70,183 76,196 84,204 C90,207 96,201 98,187 C98,172 97,161 96,153 C91,139 84,130 77,127 C71,127 66,126 62,124 Z'],
    ['Lumbar', 'M99,160 C95,164 93,176 92,190 C91,204 92,214 94,222 L99,224 Z'],
    ['Oblicuos', 'M66,170 C66,184 68,197 72,207 C76,211 80,211 84,207 C78,199 72,187 68,172 Z'],
    ['Tríceps', 'M55,113 C49,119 45,130 44,144 C43,154 45,162 49,166 C53,166 56,160 57,150 C58,138 58,124 55,113 Z'],
    ['Antebrazo', 'M47,166 C41,172 37,184 34,198 C32,207 31,215 31,223 C35,207 40,191 49,176 Z'],
    ['Antebrazo', 'M51,169 C45,178 40,192 36,208 C34,217 33,225 33,232 L40,233 C42,222 45,207 49,193 C52,184 53,175 51,169 Z'],
    ['Glúteo medio', 'M68,207 C64,213 62,220 62,228 C68,226 76,222 84,216 C80,211 74,207 68,207 Z'],
    ['Glúteo', 'M63,228 C60,238 60,252 64,262 C70,270 80,274 90,272 C96,270 99,264 99,256 L99,232 C92,224 82,221 72,222 C68,223 65,225 63,228 Z'],
    ['Isquiosurales', 'M63,272 C61,290 63,307 67,322 C69,328 71,332 74,335 C76,317 78,299 78,283 C75,277 69,273 63,272 Z'],
    ['Isquiosurales', 'M80,277 C80,295 82,313 84,329 C86,333 88,335 90,333 C92,313 93,295 93,279 C89,277 84,276 80,277 Z'],
    ['Aductores', 'M95,272 C97,286 97,300 95,313 C93,300 93,287 95,272 Z'],
    ['', 'M74,337 C72,340 72,344 74,346 L88,346 C90,343 90,339 88,336 Z'],
    ['Pantorrilla', 'M68,346 C64,356 63,369 66,381 C68,389 72,393 76,393 C78,381 78,365 76,351 C74,347 72,346 68,346 Z'],
    ['Pantorrilla', 'M80,344 C86,348 90,358 90,372 C90,384 88,393 84,399 C80,395 78,385 78,371 C78,359 78,349 80,344 Z'],
    ['Pantorrilla', 'M69,390 C71,401 73,410 76,416 L84,416 C86,408 87,401 87,396 C83,401 77,401 72,395 Z']
  ],
  // Líneas de detalle (fibras y separaciones), sin color propio
  fibras: {
    frente: ['M98,90 C88,88 78,89 70,93', 'M98,112 C88,111 78,113 69,116', 'M99,151 L87,151', 'M60,92 C56,100 52,110 50,120', 'M64,250 C64,270 65,290 67,310', 'M76,250 C76,272 78,292 80,312'],
    espalda: ['M100,70 C94,76 88,82 80,86', 'M90,104 C86,112 82,118 78,122', 'M70,140 C74,160 80,180 88,196', 'M50,128 C48,140 48,152 49,162', 'M80,240 C84,250 88,258 92,264', 'M72,300 C72,312 73,322 74,330', 'M86,300 C86,314 87,324 88,330']
  }
};
// clase(m, v) y accion(m) permiten reusar el dibujo con otra escala (por ejemplo, solo lo de hoy)
function svgCuerpo(z, espalda, clase, accion) {
  const lado = espalda ? 'espalda' : 'frente';
  clase = clase || ((m, v) => 'mz' + zonaZ(v, m) + (MUS_SEL === m ? ' sel' : ''));
  accion = accion || (m => 'MUS_SEL=\'' + m + '\';pintarProgreso()');
  const pieza = (m, d) => m ? '<path class="' + clase(m, z[m] || 0) + '" data-m="' + m + '" d="' + d + '" onclick="' + accion(m) + '"><title>' + m + '</title></path>'
    : '<path class="nz" d="' + d + '"/>';
  const mitad = ANAT[lado].map(x => pieza(x[0], x[1])).join('') + ANAT.fibras[lado].map(d => '<path class="fib" d="' + d + '"/>').join('');
  const espejo = c => '<g' + (c ? ' transform="matrix(-1 0 0 1 200 0)"' : '') + '>';
  // La silueta va dos veces: con borde abajo y sin borde encima, para que no se vea la costura del centro
  const sil = cls => espejo(false) + '<path class="' + cls + '" d="' + ANAT.sil + '"/></g>' + espejo(true) + '<path class="' + cls + '" d="' + ANAT.sil + '"/></g>';
  return '<svg viewBox="18 4 164 448" role="img" aria-label="' + (espalda ? 'Espalda' : 'Frente') + '">' + sil('sil borde') + sil('sil') +
    espejo(false) + mitad + '</g>' + espejo(true) + mitad + '</g><text x="100" y="449">' + (espalda ? 'ESPALDA' : 'FRENTE') + '</text></svg>';
}
const ZONAS = ['Pecho superior', 'Pecho medio', 'Deltoide frontal', 'Deltoide lateral', 'Deltoide posterior', 'Trapecio', 'Dorsal', 'Espalda media', 'Lumbar',
  'Bíceps', 'Tríceps', 'Antebrazo', 'Abdomen', 'Oblicuos', 'Cuádriceps', 'Isquiosurales', 'Glúteo', 'Glúteo medio', 'Aductores', 'Pantorrilla'];
/* ----- Metas por zona según tu objetivo (Ajustes → Objetivo de músculo) -----
   meta = series efectivas por semana para "en meta" (verde); tope = arriba de eso, rojo (vigila recuperación).
   Las zonas chicas reciben mucho trabajo indirecto (el press ya trabaja deltoide frontal y tríceps), por eso su meta es baja. */
const FOCOS = {
  balanceado: ['Balanceado', 'Todo el cuerpo parejo (recomendado para ganar músculo en general)'],
  v: ['Torso en V', 'Espalda ancha y hombros redondos: más dorsal y deltoide lateral; pierna en mantenimiento'],
  pierna: ['Énfasis pierna', 'Más cuádriceps, glúteo e isquiosurales; torso en mantenimiento']
};
const META_BASE = {
  'Pecho superior': [6, 14], 'Pecho medio': [8, 18], 'Deltoide frontal': [4, 18], 'Deltoide lateral': [8, 18], 'Deltoide posterior': [6, 14],
  'Trapecio': [4, 12], 'Dorsal': [10, 20], 'Espalda media': [8, 18], 'Lumbar': [3, 10], 'Bíceps': [8, 16], 'Tríceps': [8, 16], 'Antebrazo': [3, 12],
  'Abdomen': [6, 14], 'Oblicuos': [3, 10], 'Cuádriceps': [10, 20], 'Isquiosurales': [8, 16], 'Glúteo': [8, 18], 'Glúteo medio': [3, 10],
  'Aductores': [3, 10], 'Pantorrilla': [6, 14]
};
const META_FOCO = {
  v: { 'Deltoide lateral': [12, 22], 'Dorsal': [12, 22], 'Espalda media': [10, 20], 'Deltoide posterior': [8, 16],
       'Cuádriceps': [8, 18], 'Isquiosurales': [6, 14], 'Glúteo': [6, 16] },
  pierna: { 'Cuádriceps': [12, 22], 'Glúteo': [12, 22], 'Isquiosurales': [10, 18], 'Glúteo medio': [4, 12], 'Aductores': [4, 12], 'Pantorrilla': [8, 16],
            'Pecho medio': [6, 16], 'Dorsal': [8, 18], 'Espalda media': [6, 16], 'Bíceps': [6, 14], 'Tríceps': [6, 14], 'Deltoide lateral': [6, 16] }
};
function focoMus() { const f = ajuste('foco', (DATA && DATA.foco) || 'balanceado'); return FOCOS[f] ? f : 'balanceado'; }
// Se guarda también en tu configuración de la hoja: así el correo del domingo y el APK usan el mismo objetivo
function setFoco(f) { setAjuste('foco', f); DATA.foco = f; LS.set('gym_data', DATA); encolar('saveConfig', [{ foco: f }], 'cfg-foco'); hap('tecla'); abrirAjustes(); if (TAB === 'Progreso') pintarProgreso(); }
function metaZona(m) { const t = (META_FOCO[focoMus()] || {})[m] || META_BASE[m] || [6, 16]; return { meta: t[0], tope: t[1] }; }
// 0 falta (menos de la mitad de la meta) · 1 poco · 2 en meta · 3 arriba del tope
const zonaZ = (n, m) => { const t = metaZona(m); return n > t.tope ? 3 : n >= t.meta ? 2 : n >= t.meta / 2 ? 1 : 0; };
const ZONA_TXT = ['Falta trabajo', 'Poco: súmale series', 'En meta', 'Arriba del tope: vigila la recuperación'];
const REGIONES = {
  Espalda: ['Dorsal', 'Espalda media', 'Trapecio', 'Lumbar'], Hombro: ['Deltoide lateral', 'Deltoide posterior', 'Deltoide frontal'],
  Pecho: ['Pecho superior', 'Pecho medio'], Brazos: ['Bíceps', 'Tríceps', 'Antebrazo'], Core: ['Abdomen', 'Oblicuos'],
  Pierna: ['Cuádriceps', 'Isquiosurales', 'Glúteo', 'Glúteo medio', 'Aductores', 'Pantorrilla']
};
const regionDe = m => Object.keys(REGIONES).find(r => REGIONES[r].includes(m)) || '';
// Series de la semana por zona, incluyendo lo que guardaste hoy y la hoja todavía no devuelve
function zonasVivas() {
  const z = Object.assign({}, (DATA.resumen && DATA.resumen.zonas7) || {});
  if (FECHA) return z;
  sesion().log.forEach(l => {
    const e = exDe(l.name);
    if (!e || e.uid === l.uid) return;
    const ef = l.sets.filter(s => s.t !== 'C' && s.r > 0).length;
    (e.zonas || []).forEach(x => { z[x.z] = (z[x.z] || 0) + ef * x.w; });
  });
  return z;
}
// Series de una zona en las últimas 48 h (para no recomendar machacar algo que trabajaste ayer)
function zonaReciente(m) {
  const ayer = sumarDias(hoy(), -1);
  let n = 0, cuando = '';
  ((DATA.resumen || {}).zonasDias || []).forEach(d => { if (d.k >= ayer && d.z[m]) { n += d.z[m]; cuando = d.k === hoy() ? 'hoy' : 'ayer'; } });
  sesion().log.forEach(l => { const e = exDe(l.name); if (!e || e.uid === l.uid) return; const x = (e.zonas || []).find(y => y.z === m); if (x) { n += l.sets.filter(s => s.t !== 'C').length * x.w; cuando = 'hoy'; } });
  return { n: n, cuando: cuando };
}
const fmtSer = v => String(Math.round(v * 2) / 2).replace(/^0\.5$/, '½').replace('.5', '½');
/* ----- Ejercicios añadidos a la sesión de hoy desde el mapa ----- */
function extrasHoy() { return FECHA ? [] : LS.get('gym_extra_' + hoy(), []).filter(x => exDe(x.name)); }
const esExtra = name => extrasHoy().some(x => x.name === name);
function anadirHoy(name, n) {
  const ex = exDe(name);
  if (!ex) return;
  const l = LS.get('gym_extra_' + hoy(), []).filter(x => x.name !== name);
  l.push({ name: name, n: n || 0 }); LS.set('gym_extra_' + hoy(), l);
  const st = state[name];
  // Si te recomendó menos series que las del catálogo, la tarjeta ya viene con esas
  if (st && !st.done && !st.edited && n && st.sets.filter(s => s.t !== 'C').length > n) {
    let quedan = n; st.sets = st.sets.filter(s => s.t === 'C' || quedan-- > 0);
    cambio(name, false);
  }
  cerrarModal(); hap('ok');
  BUSCA = ''; OPEN = name; ANIM_ABRE = name;
  if (TAB !== 'Entrenar') verTab('Entrenar'); else pintarEntrenar();
  irA(name);
  toast('Añadido a hoy: ' + ex.ejercicio.split(' (')[0] + (n ? ' · ' + n + ' series' : ''));
}
function quitarDeHoy(name) {
  LS.set('gym_extra_' + hoy(), LS.get('gym_extra_' + hoy(), []).filter(x => x.name !== name));
  cerrarModal(); if (OPEN === name) OPEN = ''; pintarEntrenar(); toast('Quitado de hoy');
}
function irAEjercicio(name) {
  cerrarModal();
  const g = exDe(name).group;
  if (g !== GRUPO && !esExtra(name)) { GRUPO = g; GRUPO_MANUAL = true; GRUPO_DIA = hoy(); }
  BUSCA = ''; OPEN = name; ANIM_ABRE = name;
  if (TAB !== 'Entrenar') verTab('Entrenar'); else pintarEntrenar();
  irA(name);
}
/* ----- Foto de una máquina: la IA dice qué ejercicio es; si no está en tu Catálogo, lo agrega (script con Maquina.gs) ----- */
let MAQ = null;
function abrirMaquina() {
  if (!DATA.ia) return toast('La IA no está activada en tu hoja');
  MAQ = null;
  $('sheet').innerHTML = '<div class="row between"><div class="t2">¿Qué máquina es?</div><button class="btn ghost sm" onclick="cerrarModal()">✕</button></div>' +
    '<div class="muted" style="margin:6px 0 12px">Tómale foto a la máquina (o a alguien usándola) y te digo qué ejercicio es, qué trabaja y si ya lo tienes.</div>' +
    '<div class="camopts"><button onclick="fotoMaquina(false)"><span>📷</span><b>Tomar foto</b><small>Que se vea completa, con el asiento y los agarres</small></button>' +
    '<button onclick="fotoMaquina(true)"><span>🖼️</span><b>Elegir de la galería</b><small>Una foto que ya tomaste</small></button></div>';
  if (!$('modal').classList.contains('show')) abrirModal();
}
function fotoMaquina(galeria) {
  let inp = $('fotoMaq');
  if (!inp) {
    inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.id = 'fotoMaq'; inp.style.display = 'none';
    inp.addEventListener('change', () => { const f = inp.files && inp.files[0]; inp.value = ''; if (f) procesarMaquina(f); });
    document.body.appendChild(inp);
  }
  if (galeria) inp.removeAttribute('capture'); else inp.setAttribute('capture', 'environment');
  inp.click();
}
async function procesarMaquina(file) {
  if (!navigator.onLine) return toast('Necesitas señal para que la IA vea la foto');
  cargandoFoto('Viendo la máquina…');
  try {
    const f = await achicarFoto(file, 1280);
    const cat = DATA.exercises.filter(e => !/^Otro ejercicio/.test(e.ejercicio)).map(e => ({ n: e.ejercicio, g: e.group }));
    const r = await conLimite(apiPost('maquinaIA', [f.b64, 'image/jpeg', { catalogo: cat, zonas: ZONAS }]), 45000);
    MAQ = Object.assign(r, { foto: f.cv.toDataURL('image/jpeg', 0.6), chica: fotoChica(f.cv) });
    pintarMaquina();
  } catch (e) {
    cerrarModal();
    toast(/desconocida/i.test(e.message) ? 'Tu script todavía no reconoce máquinas: agrégale Maquina.gs' : 'No pude ver la foto: ' + (e.message === 'tiempo' ? 'tardó demasiado' : e.message));
  }
}
function pintarMaquina() {
  const r = MAQ, ex = r.enCatalogo && DATA.exercises.find(e => e.ejercicio === r.enCatalogo);
  let h = '<div class="row between"><div class="t2">' + esc(r.maquina || r.ejercicio || 'Máquina') + '</div><button class="btn ghost sm" onclick="cerrarModal()">✕</button></div>' +
    '<img class="maqfoto" src="' + r.foto + '" alt="">';
  if (r.confianza === 'baja') h += '<div class="aviso2">🤔 No estoy seguro. ' + esc(r.como || 'Tómale otra foto donde se vea completa.') + '</div>';
  if (ex) {
    h += '<div class="maqok">✓ Ya está en tu catálogo: <b>' + esc(ex.ejercicio) + '</b> · ' + esc(ex.group) + '<small>' +
      (ex.anterior.length ? 'Ya lo has hecho: la última vez (' + esc(ex.lastWhen) + ') ' + esc(resumenSets(ex.anterior)) + ' ' + ex.unit : 'Todavía no lo has hecho') + '</small></div>' +
      '<div class="acts"><button class="btn ghost" onclick="irAEjercicio(\'' + jsq(ex.name) + '\')">Ver cómo se hace</button>' +
      (esExtra(ex.name) ? '' : '<button class="btn" onclick="anadirHoy(\'' + jsq(ex.name) + '\',' + seriesDe(ex) + ')">Añadir a hoy</button>') + '</div>' +
      (fotoMaqDe(ex.name) === MAQ.chica ? '<div class="muted" style="margin-top:8px">📌 Foto guardada en el ejercicio</div>'
        : '<button class="btn ghost block" style="margin-top:8px" onclick="if(guardarFotoMaq(\'' + jsq(ex.name) + '\',MAQ.chica)){toast(\'Foto guardada en el ejercicio ✓\');pintarMaquina()}">📌 Guardar esta foto en el ejercicio</button>');
  } else if (r.confianza !== 'baja') {
    h += '<div class="maqnuevo"><div class="muted" style="margin-bottom:6px">No está en tu catálogo. Esto es lo que te propongo:</div>' +
      '<b>' + esc(r.ejercicio) + '</b> · ' + esc(r.grupo) + '<br>' + esc(r.musculo) + (r.secundario ? ' (y ' + esc(r.secundario) + ')' : '') +
      '<br><span class="muted">' + r.series + ' series de ' + r.min + '–' + r.max + ' · anota: ' + esc(r.anotar) + '</span>' +
      (r.como ? '<div class="muted" style="margin-top:6px;font-size:13.5px">💡 ' + esc(r.como) + '</div>' : '') + '</div>' +
      '<button class="btn block" style="margin-top:12px" onclick="agregarMaquina()">' + (r.guardando ? 'Agregando…' : '➕ Agregarlo a mi catálogo') + '</button>' +
      '<div class="muted" style="font-size:12.5px;margin-top:6px">Se agrega al final de ' + esc(r.grupo) + ' en tu hoja; no cambia tu rutina A/B ni borra nada.</div>';
  }
  if (r.otros && r.otros.length) h += '<div class="muted" style="font-size:13px;margin-top:10px">En esa máquina también se hace: ' + esc(r.otros.join(', ')) + '</div>';
  h += '<button class="link" style="margin-top:10px" onclick="abrirMaquina()">📷 Otra foto</button>';
  $('sheet').innerHTML = h;
}
async function agregarMaquina() {
  if (!MAQ || MAQ.guardando) return;
  if (!navigator.onLine) return toast('Necesitas señal para agregarlo a tu hoja');
  MAQ.guardando = true; pintarMaquina();
  try {
    const r = await conLimite(apiPost('nuevoEjercicio', [Object.assign({}, MAQ, { foto: undefined, chica: undefined, guardando: undefined })]), 30000);
    cerrarModal(); hap('ok');
    toast(r.ya ? 'Ya lo tenías: ' + r.ejercicio : 'Agregado a ' + r.grupo + ': ' + r.ejercicio);
    guardarFotoMaq(r.grupo + ': ' + r.ejercicio, MAQ.chica);   // la foto que tomaste queda en su tarjeta
    await actualizar();
  } catch (e) {
    MAQ.guardando = false; pintarMaquina();
    toast(/desconocida/i.test(e.message) ? 'Tu script todavía no puede agregar ejercicios: agrégale Maquina.gs' : 'No se pudo agregar: ' + e.message);
  }
}
// Qué hacer para una zona: lo que ya tienes hoy y los mejores ejercicios para añadir
function opcionesZona(m) {
  const z = zonasVivas(), hoyEx = (GRUPO && GRUPO !== 'Trote' ? recomendadosHoy(GRUPO) : []).map(e => e.name);
  const peso = e => ((e.zonas || []).find(x => x.z === m) || {}).w || 0;
  let cands = DATA.exercises.filter(e => peso(e) > 0 && !/^Otro ejercicio/.test(e.ejercicio));
  const directos = cands.filter(e => peso(e) >= 1);
  if (directos.length) cands = directos;
  const hechoHoy = cands.filter(e => state[e.name] && state[e.name].done);
  const pendHoy = cands.filter(e => hoyEx.includes(e.name) && state[e.name] && !state[e.name].done);
  const rojo = e => (e.zonas || []).some(x => x.z !== m && x.w >= 0.5 && zonaZ(z[x.z] || 0, x.z) === 3);
  const score = e => (e.anterior.length ? 3 : 0) + (e.group === GRUPO ? 2 : 0) + ((e.zonas || []).length <= 2 ? 1 : 0) +
    (e.bloque && e.bloque === DATA.bloquePara[e.group] ? 0.5 : 0) - (rojo(e) ? 2 : 0) - (esDeOtro(e) ? 3 : 0);
  const resto = cands.filter(e => !hoyEx.includes(e.name) && !(state[e.name] && state[e.name].done)).sort((a, b) => score(b) - score(a));
  const semana = cands.filter(e => !hechoHoy.includes(e) && e.anterior.length && (diasDesdeDM(e.lastWhen) ?? 99) <= 6);
  return { pendHoy: pendHoy, hechoHoy: hechoHoy, semana: semana, top: resto.slice(0, 3), peso: peso, rojo: rojo };
}
// Por qué te recomienda ese ejercicio, en pocas palabras
function porQue(e, m, o) {
  const p = [];
  if (e.anterior.length) p.push('la última vez (' + e.lastWhen + '): ' + resumenSets(e.anterior) + ' ' + e.unit);
  else p.push('nuevo para ti: empieza ligero, 1–2 en reserva');
  if ((e.zonas || []).length <= 2) p.push('trabaja directo ' + m.toLowerCase());
  if (o.rojo(e)) p.push('ojo: también carga una zona que ya va alta');
  return p.join(' · ');
}
// Series de trabajo que trae el ejercicio hoy (el script no manda el número del Catálogo)
function seriesDe(e) { return ((e && e.sets) || []).filter(x => x.t !== 'C').length || 4; }
// Panel de una zona (en Progreso y en "🎯 Trabajar un músculo")
function panelZona(m, modal) {
  const z = zonasVivas(), v = z[m] || 0, t = metaZona(m), est = zonaZ(v, m), falta = Math.max(0, t.meta - v);
  const sel = x => modal ? 'elegirMusculo(\'' + jsq(x) + '\')' : 'MUS_SEL=\'' + jsq(x) + '\';pintarProgreso()';
  const col = ['var(--muted)', 'var(--acc)', 'var(--ok)', 'var(--bad)'];
  const barra = (x, w) => '<span class="zbar' + (w ? ' w' : '') + '"><i style="width:' + Math.min(100, Math.round((z[x] || 0) / metaZona(x).meta * 100)) + '%;background:' + col[zonaZ(z[x] || 0, x)] + '"></i></span>';
  let h = '<div class="msel entra"><div class="row between" style="align-items:baseline"><b>' + esc(m) + '</b><span class="num">' + fmtSer(v) + ' / ' + t.meta + ' series</span></div>' +
    barra(m, true) + '<div class="muted" style="font-size:13px;margin-top:4px">' + ZONA_TXT[est] + (focoMus() !== 'balanceado' ? ' · meta con tu objetivo «' + FOCOS[focoMus()][0] + '»' : '') + '</div>';
  const r = regionDe(m);
  if (r) h += '<div class="region"><div class="muted">' + r + '</div>' + REGIONES[r].map(x => '<button class="' + (x === m ? 'on' : '') + '" onclick="' + sel(x) + '">' +
    '<span>' + esc(x) + '</span>' + barra(x) + '<span class="num">' + fmtSer(z[x] || 0) + '/' + metaZona(x).meta + '</span></button>').join('') + '</div>';
  const o = opcionesZona(m), rec = zonaReciente(m);
  const boton = (e, grande) => {
    const n = Math.min(seriesDe(e), Math.max(2, Math.ceil(falta / o.peso(e)) || 3));
    if (esExtra(e.name)) return '<button class="' + (grande ? 'btn block' : 'alt') + '" onclick="irAEjercicio(\'' + jsq(e.name) + '\')">✓ Ya está en tu sesión: ' + esc(e.ejercicio.split(' (')[0]) + ' → Ir</button>';
    return grande ? '<button class="btn block" onclick="anadirHoy(\'' + jsq(e.name) + '\',' + n + ')">➕ Añadir ' + esc(e.ejercicio.split(' (')[0]) + ' a hoy · ' + n + ' series</button>' +
      '<div class="muted porque">' + esc(porQue(e, m, o)) + '</div>'
      : '<button class="alt" onclick="anadirHoy(\'' + jsq(e.name) + '\',' + n + ')">' + (o.pendHoy.length || est === 2 ? '➕ ' : 'o ') + esc(e.ejercicio.split(' (')[0]) +
        '<small>' + (e.anterior.length ? '✓ ya lo has hecho · ' + esc(e.lastWhen) : 'nuevo para ti') + '</small></button>';
  };
  h += '<div class="accion">';
  if (est === 3) h += '<div>Ya pasaste el tope esta semana: no le sumes más; dale descanso para que crezca.</div>';
  else {
    if (est === 2) h += '<div class="muted" style="margin-bottom:6px">Vas en meta. Si aun así quieres darle más:</div>';
    else h += '<div style="margin-bottom:6px">Te faltan <b>~' + Math.ceil(falta) + ' series</b> esta semana.</div>';
    if (rec.n >= 4) h += '<div class="aviso2">⏳ Ya le diste ' + fmtSer(rec.n) + ' series ' + rec.cuando + ': si la sientes cargada, mejor en tu próxima sesión (48 h de recuperación).</div>';
    if (o.pendHoy.length) h += '<div style="margin:2px 0 8px">Ya está en tu rutina de hoy: ' + o.pendHoy.slice(0, 2).map(e => '<button class="alt" onclick="irAEjercicio(\'' + jsq(e.name) + '\')">' + esc(e.ejercicio.split(' (')[0]) + ' → Ir</button>').join(' ') + '</div>';
    // Si el grupo que la trabaja es tu próximo día, se cubre ahí (no hace falta adelantarlo)
    const rot = ['Push', 'Pull', 'Legs'], gHoy = rot.includes(GRUPO) ? GRUPO : DATA.sugGrupo, prox = rot[(rot.indexOf(gHoy) + 1) % 3];
    if (est < 2 && o.top.length && o.top[0].group === prox && prox !== GRUPO) h += '<div class="muted" style="font-size:13px;margin-bottom:6px">Tu próximo día es ' + prox + ': ahí la cubres. Si quieres adelantarla o no vas a ir:</div>';
    if (o.top.length) {
      const n0 = Math.min(seriesDe(o.top[0]), Math.max(2, Math.ceil(falta / o.peso(o.top[0])) || 3));
      // Si ya tienes uno pendiente hoy, lo demás va como alternativa chica (primero haz lo que ya está)
      h += o.pendHoy.length || est === 2 ? '<div class="alts">' + (o.pendHoy.length ? '<span class="muted" style="font-size:13px;align-self:center">¿Quieres otro?</span>' : '') + o.top.map(e => boton(e, false)).join('') + '</div>'
        : boton(o.top[0], true) + (o.top.length > 1 ? '<div class="alts">' + o.top.slice(1).map(e => boton(e, false)).join('') + '</div>' : '');
      if (est < 2 && !o.pendHoy.length && falta > n0 + 0.5) h += '<div class="muted" style="font-size:12.5px;margin-top:6px">Las otras ~' + Math.ceil(falta - n0) + ' series, en tu próxima sesión: más de 4–5 series de una zona en un día rinden menos.</div>';
    }
    else if (!o.pendHoy.length) h += '<div class="muted">No hay otro ejercicio en tu catálogo que la trabaje directo.</div>';
  }
  // Lo que ya hiciste para esta zona (hoy y en la semana), para no repetir sin querer
  const hechos = o.hechoHoy.map(e => [e, 'hoy']).concat(o.semana.map(e => [e, DSEM[new Date(sumarDias(hoy(), -diasDesdeDM(e.lastWhen)) + 'T12:00:00').getDay()]]));
  if (hechos.length) h += '<div class="muted" style="font-size:12.5px;margin-top:10px">Esta semana ya hiciste:</div><div class="hechos">' +
    hechos.map(x => '<span>✓ ' + esc(x[0].ejercicio.split(' (')[0]) + ' · ' + x[1] + '</span>').join('') + '</div>';
  return h + '</div></div>';
}
// Las zonas más atrasadas contra su meta (para "Lo que más te falta")
function zonasAtrasadas(n) {
  // Primero lo que más series te falta, y las zonas grandes pesan más que las chicas (antebrazo, lumbar…)
  const z = zonasVivas(), peso = x => (x.meta - x.v) * (x.meta >= 8 ? 1.5 : 1);
  return ZONAS.map(m => ({ m: m, v: z[m] || 0, meta: metaZona(m).meta })).filter(x => x.v < x.meta)
    .sort((a, b) => peso(b) - peso(a)).slice(0, n || 3);
}
// "🎯 Trabajar un músculo" desde Entrenar: eliges zona y te dice qué hacer hoy
function elegirMusculo(m) {
  const z = zonasVivas(), col = ['var(--muted)', 'var(--acc)', 'var(--ok)', 'var(--bad)'];
  const atr = zonasAtrasadas(3);
  if (m) {
    $('sheet').innerHTML = '<div class="row between"><button class="volver" onclick="elegirMusculo()">← Otro músculo</button><button class="btn ghost sm" onclick="cerrarModal()">✕</button></div>' + panelZona(m, true);
    if (!$('modal').classList.contains('show')) abrirModal();
    $('sheet').scrollTop = 0;
    return;
  }
  let h = '<div class="row between"><div class="t2">¿Qué quieres trabajar?</div><button class="btn ghost sm" onclick="cerrarModal()">✕</button></div>';
  if (atr.length) h += '<div class="muted" style="margin:4px 0 6px">Lo que más te falta esta semana:</div><div class="mchips" style="margin-top:0">' +
    atr.map(x => '<button onclick="elegirMusculo(\'' + jsq(x.m) + '\')"><i style="background:' + col[zonaZ(x.v, x.m)] + '"></i>' + esc(x.m) + ' <b class="num">' + fmtSer(x.v) + '/' + x.meta + '</b></button>').join('') + '</div>';
  h += '<div class="regiones">' + Object.keys(REGIONES).map(r => '<div><div class="muted">' + r + '</div><div class="mchips" style="margin-top:4px">' + REGIONES[r].map(x =>
    '<button class="' + (x === m ? 'on' : '') + '" onclick="elegirMusculo(\'' + jsq(x) + '\')"><i style="background:' + col[zonaZ(z[x] || 0, x)] + '"></i>' + esc(x) + '</button>').join('') + '</div></div>').join('') + '</div>';
  if (DATA.ia) h += '<button class="musbtn" onclick="abrirMaquina()">📷 ¿Una máquina que no conoces? <span>Tómale foto y te digo qué trabaja</span></button>';
  $('sheet').innerHTML = h;
  if (!$('modal').classList.contains('show')) abrirModal();
  $('sheet').scrollTop = 0;
}
/* ----- Ruta de hoy: qué te falta de la semana en este día y con cuáles ejercicios se cierra -----
   Máximo 4 ejercicios, mínimo 3 series cada uno, uno por familia (Catálogo V), prefiere la variante con historial
   y castiga lo que pasaría a una zona de su tope. */
const famDe = e => e.variante || e.ejercicio;
const claveRuta = g => 'gym_ruta_' + hoy() + '_' + g;
let RUTA_TMP = null;
function rutaAceptada(g) {
  if (FECHA || !GRUPOS3.includes(g)) return null;
  const r = LS.get(claveRuta(g), null);
  return r && r.length ? r.filter(x => exDe(x.name)) : null;
}
// Series de la semana por zona, contando las series ya marcadas de lo que estás haciendo
function zonasSemanaYa() {
  const z = zonasVivas(), enLog = {};
  if (FECHA) return z;
  sesion().log.forEach(l => { enLog[l.name] = true; });
  Object.keys(state).forEach(n => {
    const st = state[n], e = exDe(n);
    if (esPar(n) || !e || st.done || enLog[n]) return;
    const ok = st.sets.filter(x => x.ok && x.t !== 'C').length;
    if (ok) (e.zonas || []).forEach(x => { z[x.z] = (z[x.z] || 0) + ok * x.w; });
  });
  return z;
}
function calcularRuta(g) {
  const z = zonasSemanaYa(), hoyZ = zonasHoy();
  const delDia = DATA.exercises.filter(e => e.group === g && (e.zonas || []).some(x => x.w >= 1) && !/^Otro ejercicio/.test(e.ejercicio) && (parOn() || !esDeOtro(e)));
  const zonasG = [];
  delDia.forEach(e => e.zonas.forEach(x => { if (x.w >= 1 && !zonasG.includes(x.z)) zonasG.push(x.z); }));
  const falta = {};
  zonasG.forEach(m => { falta[m] = Math.max(0, metaZona(m).meta - (z[m] || 0)); });
  const empezado = e => { const st = state[e.name]; return !!st && (st.done || cardDone(e.name) || st.sets.some(x => x.ok)); };
  const fams = new Set(delDia.filter(empezado).map(famDe));
  const D = Object.assign({}, falta), suma = {}, items = [];
  while (items.length < 4) {
    let mejor = null;
    delDia.forEach(e => {
      if (empezado(e) || fams.has(famDe(e))) return;
      const prim = e.zonas.filter(x => x.w >= 1);
      const n = Math.max(3, Math.min(Math.max(3, seriesDe(e)), Math.ceil(Math.max.apply(null, prim.map(x => (D[x.z] || 0) / x.w)))));
      let gana = 0, castigo = 0;
      e.zonas.forEach(x => {
        const aporta = n * x.w, t = metaZona(x.z), topeDia = Math.ceil(t.tope / 2);
        gana += Math.min(D[x.z] || 0, aporta) * (x.w >= 1 ? 1 : 0.5);
        const semana = (z[x.z] || 0) + (suma[x.z] || 0) + aporta, dia = (hoyZ[x.z] || 0) + (suma[x.z] || 0) + aporta;
        if (semana > t.tope) castigo += (semana - t.tope) * 1.5;
        if (dia > topeDia) castigo += (dia - topeDia) * 0.5;
      });
      const pts = gana - castigo + (e.anterior.length ? 1.5 : 0) + (e.bloque === DATA.bloquePara[g] ? 0.5 : 0);
      if (gana >= 2 && pts > 0 && (!mejor || pts > mejor.pts))
        mejor = { name: e.name, n: n, pts: pts, zona: prim.slice().sort((a, b) => (D[b.z] || 0) / b.w - (D[a.z] || 0) / a.w)[0].z };
    });
    if (!mejor) break;
    const e = exDe(mejor.name);
    mejor.antes = (z[mejor.zona] || 0) + (suma[mejor.zona] || 0);
    items.push(mejor); fams.add(famDe(e));
    e.zonas.forEach(x => { D[x.z] = Math.max(0, (D[x.z] || 0) - mejor.n * x.w); suma[x.z] = (suma[x.z] || 0) + mejor.n * x.w; });
  }
  const total = zonasG.reduce((a, m) => a + falta[m], 0), quedan = zonasG.reduce((a, m) => a + D[m], 0);
  items.sort((a, b) => falta[b.zona] - falta[a.zona]);   // primero lo de la zona que más falta (la del mensaje)
  return { g: g, items: items, falta: falta, zonasG: zonasG, total: total, quedan: quedan };
}
// "Hoy te falta más hombro que pecho": por región; en pierna y brazos, por músculo
const PALABRA_REGION = { Pecho: 'pecho', Hombro: 'hombro', Espalda: 'espalda', Core: 'core' };
const PALABRA_ZONA = { 'Isquiosurales': 'femoral', 'Glúteo medio': 'glúteo medio' };
function textoRuta(r) {
  const porReg = {};
  r.zonasG.forEach(m => { if (!r.falta[m]) return; const k = PALABRA_REGION[regionDe(m)] || PALABRA_ZONA[m] || m.toLowerCase(); porReg[k] = (porReg[k] || 0) + r.falta[m]; });
  const orden = Object.keys(porReg).sort((a, b) => porReg[b] - porReg[a]), n = r.items.length;
  const que = orden.length >= 2 ? 'Hoy te falta más ' + orden[0] + ' que ' + orden[1] + '.' : 'Hoy lo que te falta es ' + orden[0] + '.';
  return que + ' Haz ' + (n === 1 ? 'este' : 'estos ' + n) + (r.quedan <= 1 ? ' y cierras ' + r.g + ' de la semana.' : '; lo que quede va en tu próximo ' + r.g + '.');
}
function tarjetaRuta() {
  if (FECHA || !GRUPOS3.includes(GRUPO) || !ajuste('ruta', true) || sencillo() || !DATA.exercises.some(e => (e.zonas || []).length)) return '';
  const k = claveRuta(GRUPO), acep = rutaAceptada(GRUPO);
  if (acep) {
    const hechos = acep.filter(x => cardDone(x.name) || (state[x.name] && state[x.name].done)).length;
    if (hechos < acep.length) return '';
    return '<div class="ruta corta"><span class="i">🧭</span><div style="flex:1"><b>Ruta de hoy: ' + hechos + ' de ' + acep.length + '</b>' +
      (hechos === acep.length ? ' · ✓ cerraste lo que faltaba' : '') + '</div><button class="link" onclick="quitarRuta()">Quitar</button></div>';
  }
  if (LS.get(k + '_no', false)) return '';
  const r = RUTA_TMP = calcularRuta(GRUPO);
  if (!r.total) return '<div class="ruta corta"><span class="i">✓</span><div style="flex:1">' + esc(GRUPO) + ' de la semana ya está en meta: si entrenas, no pases de 3 series por ejercicio.</div></div>';
  if (!r.items.length) return '';
  return '<div class="card ruta' + (ANIM_PLAN ? ' entra' : '') + '"><div class="row between"><div class="t1">🧭 Ruta de hoy</div><button class="link" onclick="LS.set(\'' + k + '_no\', true);pintarEntrenar()">Ocultar</button></div>' +
    '<div class="msg">' + esc(textoRuta(r)) + '</div><ol>' + r.items.map((x, i) => {
      const e = exDe(x.name), w = (e.zonas.find(y => y.z === x.zona) || { w: 1 }).w, t = metaZona(x.zona);
      return '<li><button onclick="irAEjercicio(\'' + jsq(x.name) + '\')"><span class="n num">' + (i + 1) + '</span><span style="flex:1;min-width:0"><b>' + esc(e.ejercicio) + '</b><small>' +
        x.n + ' series · ' + esc(x.zona.toLowerCase()) + ' ' + fmtSer(x.antes) + ' → ' + fmtSer(x.antes + x.n * w) + ' de ' + t.meta + '</small></span>' + badgeMod(e) + '</button></li>';
    }).join('') + '</ol><button class="btn block" onclick="seguirRuta()">Seguir esta ruta</button></div>';
}
function seguirRuta() {
  const r = RUTA_TMP;
  if (!r || !r.items.length) return;
  LS.set(claveRuta(r.g), r.items.map(x => ({ name: x.name, n: x.n })));
  // Cada ejercicio de la ruta viene con las series que te recomendó (mínimo 3)
  r.items.forEach(x => {
    const st = state[x.name];
    if (st && !st.done && !st.edited && st.sets.filter(y => y.t !== 'C').length > x.n) { let q = x.n; st.sets = st.sets.filter(y => y.t === 'C' || q-- > 0); cambio(x.name, false); }
  });
  OPEN = r.items[0].name; ANIM_ABRE = OPEN; hap('ok');
  pintarEntrenar(); irA(OPEN);
  actualizarWidgets();
}
function quitarRuta() { LS.del(claveRuta(GRUPO)); LS.set(claveRuta(GRUPO) + '_no', true); pintarEntrenar(); actualizarWidgets(); }

/* ----- Descarga anticipada: la fuerza estimada baja 2 sesiones seguidas en 2+ ejercicios y vienes con poco sueño o energía ----- */
function descargaActiva() { const d = LS.get('gym_descarga', null); return !!(d && d.hasta >= hoy() && !(DATA && DATA.descargaCarrera)); }
function e1De(ex, sets, unit) {
  let m = 0;
  (sets || []).forEach(x => { if (x.t === 'C' || !x.r) return; const L = cargaReal(ex, x.w, unit); if (L > 0) m = Math.max(m, L * (1 + x.r / 30)); });
  return Math.round(m * 10) / 10;
}
function fuerzaBajando() {
  const lista = [];
  DATA.exercises.forEach(e => {
    if (!(e.inc > 0) || !e.hist) return;
    const h = e.hist.map(x => x.e1);
    const l = sesion().log.find(x => x.name === e.name && x.uid !== e.uid);   // lo de hoy que la hoja aún no devuelve
    if (l) { const v = e1De(e, l.sets, l.unit || e.unit); if (v) h.push(v); }
    const n = h.length;
    if (n >= 3 && h[n - 1] < h[n - 2] && h[n - 2] < h[n - 3]) lista.push(e.ejercicio.split(' (')[0]);
  });
  return lista;
}
function recuperacionBaja() {
  const malo = x => x && !x.saltado && (x.sueno === 'Mal' || x.energia === 'Baja');
  if (malo(readyHoy())) return true;
  let n = 0;
  for (let d = 1; d <= 6; d++) if (malo(LS.get('gym_ready_' + sumarDias(hoy(), -d), null))) n++;
  const sal = LS.get('gym_salud', null), noches = sal && sal.sueno ? sal.sueno.slice(-3) : [];
  if (noches.length >= 2 && noches.filter(x => x.h < 6).length >= 2) n += 2;   // Health Connect: 2 de las últimas 3 noches con menos de 6 h
  return n >= 2;
}
const lunesDe = k => sumarDias(k, -((new Date(k + 'T12:00:00').getDay() + 6) % 7));
function tarjetaDescarga() {
  if (DATA.descargaCarrera || LS.get('gym_descarga_no_' + lunesDe(hoy()), false)) return '';
  const bajan = fuerzaBajando();
  if (bajan.length < 2 || !recuperacionBaja()) return '';
  return '<div class="card descarga"><div class="t1">📉 Te propongo adelantar la descarga</div><div class="muted" style="margin:4px 0 10px">' +
    esc(bajan.slice(0, 3).join(', ')) + (bajan.length > 3 ? ' y ' + (bajan.length - 3) + ' más' : '') + ' bajaron 2 sesiones seguidas y vienes con poco sueño o energía. ' +
    'Esta semana: mitad de series y ~10 % menos carga que la vez pasada, sin llegar al fallo. La fuerza suele volver más alta la siguiente.</div>' +
    '<div class="acts"><button class="btn ghost" onclick="LS.set(\'gym_descarga_no_' + lunesDe(hoy()) + '\', true);pintarEntrenar()">Ahora no</button>' +
    '<button class="btn" onclick="empezarDescarga()">Hacer descarga esta semana</button></div></div>';
}
function aplicarDescarga(ex, st) {
  if (!st || st.done || st.edited || st.sets.some(x => x.ok) || st.descarga) return;
  const lim = Math.ceil(st.sets.filter(x => x.t !== 'C').length / 2), p = pasoEj(ex, st);
  // −10 % sobre la CARGA REAL de la vez pasada (con barra), no sobre el peso que hoy ya venía subido
  const ant = (ex.anterior || []).filter(a => a.t !== 'C' && Number(a.w) > 0).map(a => Number(a.w));
  const base = ant.length ? Math.max.apply(null, ant) : null, conv = st.unit === 'kg' ? KG_A_LB : 1;
  let w = null;
  if (base !== null && ex.inc > 0) {
    w = alPaso((cargaReal(ex, base, st.unit) * 0.9 - (ex.barra || 0)) / (ex.mult || 1) / conv, p, 'abajo');
    if (w >= base) w = base - p;   // con discos grandes el 10 % puede no alcanzar un paso: baja uno
    w = Math.max(0, Math.round(w * 100) / 100);
    // Si el equipo no permite bajar poco (mancuerna de 10 → 5 es −50 %), se queda el peso y la descarga es solo de series
    if (cargaReal(ex, w, st.unit) < 0.75 * cargaReal(ex, base, st.unit)) w = base;
  }
  let n = 0;
  st.sets = st.sets.filter(x => x.t === 'C' || ++n <= lim).map(x => x.t === 'C' || w === null || vacio(x.w) ? x : Object.assign({}, x, { w: w }));
  st.descarga = true;
}
function empezarDescarga() {
  LS.set('gym_descarga', { desde: hoy(), hasta: sumarDias(lunesDe(hoy()), 6) });
  Object.keys(state).forEach(k => { if (!esPar(k)) aplicarDescarga(exDe(k), state[k]); });
  hap('ok'); toast('Descarga hasta el domingo: mitad de series y −10 %'); pintarEntrenar();
}
function terminarDescarga() { LS.del('gym_descarga'); toast('Descarga terminada: desde el próximo ejercicio, todo normal'); pintarTodo(); }

/* ----- Quién hace cada ejercicio en pareja (Catálogo U): "Ambos" o el nombre de uno ----- */
const mismoNombre = (a, b) => { const n = x => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim().split(' ')[0]; return !!a && n(a) === n(b); };
function asignadoDe(name) { const e = DATA.exercises.find(x => x.name === baseDe(name)); return e ? e.asignado || '' : ''; }
// En tu catálogo dice que lo hace otra persona (en pareja se marca "no lo haces hoy"; solo, no te lo propone)
function esDeOtro(e) { const a = e && (e.asignado || asignadoDe(e.name)); return !!a && !mismoNombre(a, DATA.nombre); }
function fijarAsignado(base, quien) {
  const e = DATA.exercises.find(x => x.name === base);
  if (!e) return;
  e.asignado = quien === 'Ambos' ? '' : quien;
  LS.set('gym_data', DATA);
  const m = saltosPar(); delete m[base]; LS.set('gym_parskip_' + hoy(), m);   // la regla nueva aplica desde ya
  encolar('saveAsignado', [base, quien], 'asig-' + base);
  cerrarModal(); hap('ok');
  toast(quien === 'Ambos' ? e.ejercicio.split(' (')[0] + ': lo hacen los dos' : e.ejercicio.split(' (')[0] + ': normalmente solo ' + quien);
  pintarEntrenar();
}
function menuAsignado(k) {
  const base = baseDe(k), a = asignadoDe(base), otro = (PAR && PAR.nombre) || (parejaDisponible() || {}).nombre || 'tu compañero';
  const ops = [['Ambos', 'Los dos'], [DATA.nombre, 'Solo yo'], [otro, 'Solo ' + otro]];
  const on = v => v === 'Ambos' ? !a : mismoNombre(a, v);
  $('sheet').innerHTML = '<div class="t2">¿Quién lo hace normalmente?</div><div class="muted" style="margin:4px 0 10px">' + esc(exDe(base).ejercicio) +
    '. En pareja, al que no lo hace se le marca «no lo hace hoy» desde el inicio (lo puedes cambiar ese día).</div><div class="pills" style="display:grid;grid-template-columns:repeat(3,1fr)">' +
    ops.map(o => '<button class="' + (on(o[0]) ? 'on' : '') + '" onclick="fijarAsignado(\'' + jsq(base) + '\',\'' + jsq(o[0]) + '\')">' + esc(o[1]) + '</button>').join('') +
    '</div><div class="acts"><button class="btn ghost" onclick="cerrarModal()">Cancelar</button></div>';
  abrirModal();
}
// "▶ Tu semana": el mapa empieza en gris y se pinta día por día con lo que entrenaste
let SEM_T = [];
function verSemana() {
  const dias = ((DATA.resumen || {}).zonasDias || []), piezas = [...document.querySelectorAll('.cuerpo [data-m]')], lbl = $('semDia'), btn = $('semBtn');
  if (!dias.length || !piezas.length) return;
  SEM_T.forEach(clearTimeout); SEM_T = [];
  const pintar = acc => piezas.forEach(el => el.setAttribute('class', 'mz' + zonaZ(acc[el.dataset.m] || 0, el.dataset.m)));
  const acc = {};
  pintar(acc); if (btn) btn.disabled = true; if (lbl) lbl.textContent = 'Empieza la semana…';
  dias.forEach((d, i) => SEM_T.push(setTimeout(() => {
    let n = 0;
    Object.keys(d.z).forEach(m => { acc[m] = (acc[m] || 0) + d.z[m]; n += d.z[m]; });
    pintar(acc); hap('tecla');
    const f = new Date(d.k + 'T12:00:00');
    if (lbl) lbl.textContent = f.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric' }).replace(/^./, c => c.toUpperCase()) + ' · +' + String(Math.round(n * 2) / 2).replace('.5', '½') + ' series';
  }, 700 + i * 1100)));
  SEM_T.push(setTimeout(() => {
    pintar(zonasVivas());
    piezas.forEach(el => { if (el.dataset.m === MUS_SEL) el.classList.add('sel'); });
    if (lbl) lbl.textContent = 'Así quedó tu semana'; if (btn) btn.disabled = false;
  }, 700 + dias.length * 1100 + 600));
}
function tarjetaMusculos(ms) {
  const z = zonasVivas();
  const col = ['var(--muted)', 'var(--acc)', 'var(--ok)', 'var(--bad)'];
  let h = '<h2>Tus músculos</h2><div class="card"><div class="muted" style="margin-bottom:2px">Series efectivas de 7 días por zona contra tu meta' +
    (focoMus() !== 'balanceado' ? ' (objetivo: ' + FOCOS[focoMus()][0] + ')' : '') + '. Toca una zona y te digo qué hacer.</div>' +
    '<div class="cuerpo">' + svgCuerpo(z, false) + svgCuerpo(z, true) + '</div>' +
    '<div class="leyenda">' + ['Falta', 'Poco', 'En meta', 'Arriba del tope'].map((t, i) => '<span><i style="background:' + col[i] + (i === 0 ? ';opacity:.4' : '') + '"></i>' + t + '</span>').join('') + '</div>';
  if (((DATA.resumen || {}).zonasDias || []).length) h += '<div class="semana"><span class="dia" id="semDia"></span><button class="btn ghost sm" id="semBtn" onclick="verSemana()">▶ Tu semana</button></div>';
  const atr = zonasAtrasadas(3);
  if (atr.length && !MUS_SEL) h += '<div class="falta"><span class="muted">Lo que más te falta:</span> ' + atr.map(x => '<button class="link" onclick="MUS_SEL=\'' + jsq(x.m) + '\';pintarProgreso()">' +
    esc(x.m) + ' ' + fmtSer(x.v) + '/' + x.meta + '</button>').join(' · ') + '</div>';
  if (MUS_SEL) h += panelZona(MUS_SEL, false);
  h += '<div class="mchips">' + ZONAS.slice().sort((a, b) => (z[a] || 0) / metaZona(a).meta - (z[b] || 0) / metaZona(b).meta).map(m => '<button class="' + (m === MUS_SEL ? 'on' : '') + '" onclick="MUS_SEL=\'' + jsq(m) + '\';pintarProgreso()"><i style="background:' + col[zonaZ(z[m] || 0, m)] + '"></i>' +
    esc(m) + ' <b class="num">' + fmtSer(z[m] || 0) + '/' + metaZona(m).meta + '</b></button>').join('') + '</div>';
  // Resumen por músculo completo (el que usa el correo semanal), en una línea
  const g = (ms || []).filter(x => x.series7 > 0).sort((a, b) => b.series7 - a.series7);
  if (g.length) h += '<div class="muted" style="font-size:12.5px;margin-top:10px">Por músculo completo: ' + g.map(x => esc(x.m) + ' ' + String(x.series7).replace('.5', '½')).join(' · ') + '</div>';
  return h + '</div>';
}

/* ----- Músculos de hoy (pestaña de la barra): qué zonas llevas en la sesión de hoy y qué te falta por añadir ----- */
// Series efectivas de HOY por zona: lo guardado en la sesión + las series marcadas que aún no guardas
function zonasHoy() {
  const z = {}, sumar = (name, n) => { const e = exDe(name); if (e && n) (e.zonas || []).forEach(x => { z[x.z] = (z[x.z] || 0) + n * x.w; }); };
  if (FECHA) return z;
  const enLog = {};
  sesion().log.forEach(l => { if (esPar(l.name)) return; enLog[l.name] = true; sumar(l.name, l.sets.filter(s => s.t !== 'C' && s.r > 0).length); });
  Object.keys(state).forEach(n => { if (!esPar(n) && !enLog[n] && state[n] && !state[n].done) sumar(n, state[n].sets.filter(s => s.ok && s.t !== 'C').length); });
  return z;
}
// Meta de un día: la mitad de la semanal (la zona se trabaja ~2 veces por semana); arriba de la mitad del tope ya es mucho para un día
const metaHoy = m => Math.max(2, Math.ceil(metaZona(m).meta / 2));
const zonaHoyZ = (v, m) => v > Math.ceil(metaZona(m).tope / 2) ? 3 : v >= metaHoy(m) ? 2 : v > 0 ? 1 : 0;
function pintarMusculos() {
  const g = GRUPO && GRUPO !== 'Trote' ? GRUPO : DATA.sugGrupo;
  const zh = zonasHoy(), total = Object.values(zh).reduce((a, b) => a + b, 0);
  const col = ['var(--muted)', 'var(--acc)', 'var(--ok)', 'var(--bad)'];
  // Zonas que trabaja directo la rutina de hoy (lo recomendado + lo que añadiste desde el mapa)
  const rutina = recomendadosHoy(g), deHoy = [];
  rutina.forEach(e => (e.zonas || []).forEach(x => { if (x.w >= 1 && !deHoy.includes(x.z)) deHoy.push(x.z); }));
  const faltan = deHoy.filter(m => (zh[m] || 0) < metaHoy(m)), listas = ZONAS.filter(m => zonaHoyZ(zh[m] || 0, m) >= 2);
  const barra = m => '<span class="zbar w"><i style="width:' + Math.min(100, Math.round((zh[m] || 0) / metaHoy(m) * 100)) + '%;background:' + col[zonaHoyZ(zh[m] || 0, m)] + '"></i></span>';
  let h = '<div class="card hoycard"><div class="row between"><div><div class="t2">Músculos de hoy</div><div class="muted">' + esc(g) +
    (DATA.bloquePara && DATA.bloquePara[g] ? ' · bloque ' + DATA.bloquePara[g] : '') + ' · ' + fmtSer(total) + ' series efectivas</div></div>' +
    '<span class="pill ' + (faltan.length ? 'acc' : 'ok') + '">' + (faltan.length ? faltan.length + ' por cubrir' : '✓ Todo cubierto') + '</span></div>' +
    '<div class="cuerpo">' + svgCuerpo(zh, false, (m, v) => 'mz' + zonaHoyZ(v, m), m => 'elegirMusculo(\'' + m + '\')') +
    svgCuerpo(zh, true, (m, v) => 'mz' + zonaHoyZ(v, m), m => 'elegirMusculo(\'' + m + '\')') + '</div>' +
    '<div class="leyenda">' + ['Sin trabajar', 'Empezado', 'Cubierto hoy', 'Mucho para un día'].map((t, i) => '<span><i style="background:' + col[i] + (i === 0 ? ';opacity:.4' : '') + '"></i>' + t + '</span>').join('') + '</div>' +
    '<div class="muted" style="font-size:12.5px;margin-top:8px">Solo cuenta lo de hoy. Toca una zona para ver opciones y añadirla a tu sesión.</div></div>';
  if (FECHA) return ($('vMusculos').innerHTML = h + '<div class="tip">Estás registrando otro día; este mapa es solo para la sesión de hoy.</div>');
  if (faltan.length) {
    h += '<h2>Te falta hoy · ' + esc(g) + '</h2><div class="card">' + faltan.map(m => {
      const ej = rutina.find(e => (e.zonas || []).some(x => x.z === m && x.w >= 1) && !(state[e.name] && state[e.name].done));
      return '<div class="zfila"><div class="zt"><div class="row between"><b>' + esc(m) + '</b><span class="num muted cnt">' + fmtSer(zh[m] || 0) + ' / ' + metaHoy(m) + ' series</span></div>' + barra(m) +
        '<div class="muted ej">' + (ej ? 'Con: ' + esc(ej.ejercicio.split(' (')[0]) : 'No está en tu rutina de hoy') + '</div></div>' +
        (ej ? '<button class="btn sm" onclick="irAEjercicio(\'' + jsq(ej.name) + '\')">Ir →</button>'
            : '<button class="btn ghost sm" onclick="elegirMusculo(\'' + jsq(m) + '\')">＋ Añadir</button>') + '</div>';
    }).join('') + '</div>';
  }
  if (listas.length) h += '<h2>Ya cubriste hoy</h2><div class="mchips">' + listas.map(m => '<button onclick="elegirMusculo(\'' + jsq(m) + '\')"><i style="background:' + col[zonaHoyZ(zh[m] || 0, m)] + '"></i>' +
    esc(m) + ' <b class="num">' + fmtSer(zh[m] || 0) + '</b></button>').join('') + '</div>';
  // Lo que va atrasado en la semana y no toca hoy: por si te sobra tiempo
  const atr = zonasAtrasadas(4).filter(x => !deHoy.includes(x.m));
  if (atr.length) h += '<h2>Si te sobra tiempo · atrasado en la semana</h2><div class="mchips">' + atr.map(x => '<button onclick="elegirMusculo(\'' + jsq(x.m) + '\')"><i style="background:var(--acc)"></i>' +
    esc(x.m) + ' <b class="num">' + fmtSer(x.v) + '/' + x.meta + '</b></button>').join('') + '</div>';
  $('vMusculos').innerHTML = h;
}

/* ----- Fotos de progreso (una al mes, la imagen se guarda en tu Drive) ----- */
let FOTOS = LS.get('gym_fotos', null), cargandoFotos = false;
function fotosConPendientes() {
  const pend = cola().filter(op => op.action === 'saveFoto').map(op => Object.assign({ pend: true }, op.args[0], { d: op.args[0].fecha }));
  return (FOTOS || []).concat(pend).sort((a, b) => a.d < b.d ? -1 : 1);
}
async function cargarFotos() {
  if (cargandoFotos) return;
  cargandoFotos = true;
  try {
    const f = await apiGet('fotos');
    const antes = JSON.stringify(FOTOS);
    FOTOS = f; LS.set('gym_fotos', f);
    if (antes !== JSON.stringify(f) && TAB === 'Progreso' && PTAB === 'Cuerpo') pintarProgreso();
  } catch (e) {} finally { cargandoFotos = false; }
}
function tarjetaFotos() {
  const fotos = fotosConPendientes();
  const ultima = fotos.length ? fotos[fotos.length - 1].d : null;
  const toca = !ultima || difDias(ultima, hoy()) >= 28;
  const img = f => f.thumb ? '<img src="data:image/jpeg;base64,' + f.thumb + '" alt="Foto del ' + ddmm(f.d) + '">' : '<img alt="">';
  let h = '<h2>Fotos de progreso</h2><div class="card">';
  if (toca) h += '<div class="aviso" style="margin-bottom:10px">' + ICO.camara + '<span>' + (ultima ? 'Ya pasó un mes: toca la foto de este mes.' : 'Toma tu primera foto: misma luz, mismo lugar y misma pose cada mes.') + '</span></div>';
  if (fotos.length >= 2) {
    const a = fotos[0], b = fotos[fotos.length - 1];
    h += '<div class="comp"><div>' + img(a) + '<div class="muted" style="text-align:center;margin-top:4px">' + ddmm(a.d) + (a.cintura ? ' · ' + a.cintura + ' cm' : '') + '</div></div>' +
      '<div>' + img(b) + '<div class="muted" style="text-align:center;margin-top:4px">' + ddmm(b.d) + (b.cintura ? ' · ' + b.cintura + ' cm' : '') + '</div></div></div>';
  }
  if (fotos.length === 1 || fotos.length > 2) h += '<div class="fotos">' + fotos.slice().reverse().map(f => '<a ' + (f.url ? 'href="' + esc(f.url) + '" target="_blank" rel="noopener"' : '') + ' style="text-decoration:none">' + img(f) + '<div>' + ddmm(f.d) + (f.pend ? ' · sin subir' : '') + '</div></a>').join('') + '</div>';
  h += '<label class="btn ' + (toca ? '' : 'ghost ') + 'block" style="display:block;text-align:center;margin-top:10px">' + ICO.camara.replace('class="icon"', 'class="icon" style="vertical-align:-4px;margin-right:6px"') + 'Tomar foto' +
    '<input type="file" accept="image/*" capture="environment" style="display:none" onchange="procesarFoto(this)"></label>' +
    '<div class="muted" style="margin-top:8px;font-size:12.5px">La foto completa se guarda en tu Google Drive; aquí solo ves una miniatura.</div></div>';
  return h;
}
function reducirImagen(img, max, calidad) {
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const cv = document.createElement('canvas'); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/jpeg', calidad).split(',')[1];
}
function procesarFoto(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  toast('Preparando foto…');
  const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => {
    const b64 = reducirImagen(img, 1280, 0.82), thumb = reducirImagen(img, 300, 0.6);
    URL.revokeObjectURL(url);
    encolar('saveFoto', [{ fecha: diaReg(), b64: b64, thumb: thumb, peso: DATA.promedio7, cintura: DATA.resumen.cintura, uid: uid() }]);
    hap('ok'); toast('Foto guardada ✓'); pintarProgreso();
  };
  img.onerror = () => toast('No pude leer la foto');
  img.src = url;
}

/* ===================== BIENVENIDA (una sola vez, para quien no es el dueño) ===================== */
let BV = null;
function abrirBienvenida() {
  if (BV_POSPUESTA || sesionActiva() || $('modal').classList.contains('show')) return;
  if (!BV) BV = { peso: '', dias: (DATA.dias || [1, 2, 3, 4, 5]).slice(), km: 0, fecha: '' };
  const meta = BV.peso ? Math.round(Number(BV.peso) * 1.6 / 5) * 5 : null;
  $('sheet').innerHTML = '<div class="bv"><div class="t2">¡Bienvenido, ' + esc(DATA.nombre || '') + '!</div>' +
    '<div class="muted" style="margin-top:4px">3 datos y listo: con esto ajusto tu meta de proteína y tus avisos.</div>' +
    '<label>1. Tu peso (kg)</label><input type="number" inputmode="decimal" step="0.1" id="bvPeso" placeholder="Ej. 72" value="' + esc(BV.peso) + '" oninput="BV.peso=this.value;bvMeta()">' +
    '<div class="muted" id="bvMeta" style="margin-top:6px">' + (meta ? 'Tu meta de proteína: <b style="color:var(--text)">' + meta + ' g al día</b>' : 'Con tu peso calculo tu meta de proteína.') + '</div>' +
    '<label>2. ¿Qué días entrenas?</label><div class="muted">Esos días te llega el aviso a las 5:00 am.</div><div class="dias">' +
    [1, 2, 3, 4, 5, 6, 0].map(d => '<button class="' + (BV.dias.includes(d) ? 'on' : '') + '" onclick="BV.dias=bvToggle(BV.dias,' + d + ');abrirBienvenida()">' + DIAS_CORTOS[d] + '</button>').join('') + '</div>' +
    '<label>3. ¿Tienes alguna carrera?</label><div class="pills" style="display:grid;grid-template-columns:repeat(4,1fr);margin:0">' +
    [[0, 'No'], [5, '5 km'], [10, '10 km'], [21, '21 km']].map(x => '<button class="' + (BV.km === x[0] ? 'on' : '') + '" onclick="BV.km=' + x[0] + ';abrirBienvenida()">' + x[1] + '</button>').join('') + '</div>' +
    (BV.km ? '<input type="date" id="bvFecha" min="' + hoy() + '" value="' + esc(BV.fecha) + '" onchange="BV.fecha=this.value">' : '') +
    '<label>4. ¿Ya sabes usar las máquinas del gym?</label><div class="pills" style="display:grid;grid-template-columns:1fr 1fr;margin:0">' +
    [[false, 'Sí, ya sé'], [true, 'Soy nuevo']].map(x => '<button class="' + (!!BV.sencillo === x[0] ? 'on' : '') + '" onclick="BV.sencillo=' + x[0] + ';abrirBienvenida()">' + x[1] + '</button>').join('') + '</div>' +
    (BV.sencillo ? '<div class="muted" style="margin-top:6px">Te pongo el modo sencillo: te digo qué hacer paso a paso. Lo quitas en Ajustes.</div>' : '') +
    '<div class="acts"><button class="btn ghost" onclick="BV_POSPUESTA=true;cerrarModal()">Ahora no</button><button class="btn" onclick="guardarBienvenida()">Listo</button></div></div>';
  abrirModal();
}
function bvToggle(lista, d) { return lista.includes(d) ? lista.filter(x => x !== d) : lista.concat([d]).sort(); }
function bvMeta() {
  const m = Number(BV.peso) >= 30 ? Math.round(Number(BV.peso) * 1.6 / 5) * 5 : null;
  $('bvMeta').innerHTML = m ? 'Tu meta de proteína: <b style="color:var(--text)">' + m + ' g al día</b>' : 'Con tu peso calculo tu meta de proteína.';
}
function guardarBienvenida() {
  const p = Number(BV.peso);
  if (!(p >= 30 && p <= 250)) return toast('Pon tu peso en kg');
  if (!BV.dias.length) return toast('Elige al menos un día');
  if (BV.km && !BV.fecha) return toast('Elige la fecha de tu carrera');
  const cfg = { metaProteina: Math.round(p * 1.6 / 5) * 5, dias: BV.dias, perfil: true };
  cfg.carrera = BV.km ? { fecha: BV.fecha, km: BV.km, nombre: BV.km === 21 ? 'medio maratón' : BV.km + 'K' } : null;
  Object.assign(DATA, { metaProteina: cfg.metaProteina, dias: cfg.dias, perfil: true, carrera: cfg.carrera });
  LS.set('gym_data', DATA); LS.set('gym_bienvenida', true);
  setAjuste('sencillo', !!BV.sencillo); aplicarSencillo();
  encolar('saveConfig', [cfg], 'cfg-bienvenida');
  cerrarModal(); hap('ok');
  toast('¡Listo! Meta de proteína: ' + cfg.metaProteina + ' g');
  pintarTab(); setTimeout(tourSiToca, 900);
  setTimeout(() => enviar().then(actualizar), 1500);
}

/* ===================== AJUSTES ===================== */
const svgA = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
const AIC = {
  cel: svgA('<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M11 18h2"/>'),
  campana: svgA('<path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20a2 2 0 0 0 4 0M3 5l2-2M21 5l-2-2"/>'),
  reloj: svgA('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M10 2h4"/>'),
  chispa: svgA('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>'),
  cerebro: svgA('<path d="M12 5a3 3 0 0 0-5.9.8A3 3 0 0 0 4 11a3 3 0 0 0 1.5 5.2A3 3 0 0 0 12 18zM12 5a3 3 0 0 1 5.9.8A3 3 0 0 1 20 11a3 3 0 0 1-1.5 5.2A3 3 0 0 1 12 18z"/>'),
  flama: svgA('<path d="M12 22c4 0 7-2.7 7-6.8 0-3.7-2.6-6.6-4.6-8.7-.6 2.4-1.6 3.6-3 4C11.9 7.6 10.5 4.6 8 2.5 8 7 5 9 5 15.2 5 19.3 8 22 12 22z"/>'),
  flechas: svgA('<path d="M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6"/>'),
  cubiertos: svgA('<path d="M7 2v9a2 2 0 0 0 2 2v9M11 2v7M3 2v7a2 2 0 0 0 2 2M17 22V2c2.5 1 4 3.5 4 7v4h-4"/>'),
  cal: svgA('<rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M3 10h18M8 2.5v4M16 2.5v4"/>'),
  regla: svgA('<rect x="2" y="8" width="20" height="8" rx="2"/><path d="M6 8v3M10 8v4M14 8v3M18 8v4"/>'),
  corre: svgA('<circle cx="14" cy="4.5" r="2"/><path d="M5 21l3.5-6 3 2.5V22M8.5 11.5l3-3.5 3 2 2.5 3.5H20M11.5 8l-3 1.5-2 3"/>'),
  nube: svgA('<path d="M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19.5 10 4 4 0 0 1 18 18z"/><path d="M12 11v6m-2.5-2.5L12 17l2.5-2.5"/>'),
  tabla: svgA('<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M3 9h18M3 15h18M9 3v18"/>')
};
function abrirAjustes() {
  if (!DATA) return;
  // Cada interruptor va en su tarjeta con un ícono de color
  const tog = (k, d, txt, sub, ic, color) => '<div class="opt tarj"><span class="aic" style="--c:var(--' + color + ')">' + ic + '</span><div class="txt"><div class="t1" style="font-size:15px">' + txt + '</div><div class="muted">' + sub + '</div></div>' +
    '<button class="tog' + (ajuste(k, d) ? ' on' : '') + '" onclick="toggleAjuste(\'' + k + '\',' + d + ')" aria-label="' + esc(txt) + '"></button></div>';
  const def = ajuste('descanso', 90), c = DATA.carrera;
  const sec = (ic, color, txt) => '<div class="t1 asec"><span style="color:var(--' + color + ')">' + ic + '</span>' + txt + '</div>';
  const fallas = LS.get('gym_jserr', []).length + LS.get('gym_errores', []).length;
  $('sheet').innerHTML = '<div class="row between ajhead"><div class="t2">Ajustes</div><button class="cerrar" onclick="cerrarModal()" aria-label="Cerrar">✕</button></div>' +
    tog('sencillo', false, 'Modo sencillo', 'Para quien empieza: «Hoy te toca» en 3 pasos, una instrucción por serie y menos pestañas (sin Músculos ni Coach)', AIC.chispa, 'ok') +
    '<div class="opt tarj"><span class="aic" style="--c:var(--pri)">' + AIC.flechas + '</span><div class="txt"><div class="t1" style="font-size:15px">Tour de la app</div><div class="muted">4 pasos: dónde pesarte, elegir el día, anotar series y la comida</div></div>' +
    '<button class="btn ghost sm" onclick="iniciarTour()">Ver</button></div>' +
    tog('pantalla', true, 'Pantalla encendida en la sesión', 'Para que el descanso suene y no tengas que desbloquear', AIC.cel, 'cyan') +
    tog('reloj', NATIVO, 'Avisar al terminar el descanso', NATIVO ? 'Notificación con vibración aunque la pantalla esté bloqueada; llega a tu reloj' : 'Notificación al terminar (solo si la app está abierta; en el APK llega aunque bloquees)', AIC.campana, 'acc') +
    tog('autoDescanso', false, 'Iniciar el descanso solo', 'Si está apagado, solo te sugiere tiempos al marcar una serie', AIC.reloj, 'ok') +
    tog('iaPlan', true, 'Plan del día con IA', 'Al abrir Entrenar: un foco para la sesión y una meta por ejercicio', AIC.chispa, 'pri') +
    tog('ia', true, 'La IA afina el consejo entre series', 'El motor te dice al instante qué hacer en la siguiente serie (sin señal); con señal, Gemini elige entre sus opciones y te explica por qué', AIC.cerebro, 'pri') +
    (!scriptAlDia() ? '<div class="opt tarj aviso-script"><span class="aic" style="--c:var(--acc)">' + AIC.tabla + '</span><div class="txt"><div class="t1" style="font-size:15px">Actualiza tu script a la ' + SCRIPT_ESPERADO + '</div>' +
      '<div class="muted">Tu hoja tiene la ' + esc(DATA.scriptVersion || 'anterior a la 7.4') + '. La app funciona, pero sin las mejoras nuevas del script (te lo manda tu coach).</div></div></div>'
      : !motorAlDia() ? '<div class="opt tarj aviso-script"><span class="aic" style="--c:var(--acc)">' + AIC.tabla + '</span><div class="txt"><div class="t1" style="font-size:15px">Actualiza Progresion.gs en tu script</div>' +
      '<div class="muted">' + (DATA.motorFirma ? 'El motor de progresión de tu hoja es de otra versión' : 'A tu proyecto de Apps Script le falta el archivo Progresion.gs') +
      '. Mientras, la app calcula la sugerencia de cada ejercicio con su propio motor.</div></div></div>' : '') +
    (NATIVO && APK_OK === false ? '<div class="opt tarj aviso-script"><span class="aic" style="--c:var(--acc)">' + AIC.cel + '</span><div class="txt"><div class="t1" style="font-size:15px">Instala el APK nuevo</div>' +
      '<div class="muted">Tu APK es anterior a la 7.5: descarga Gym.apk de nuevo (Releases del repo) e instálalo encima, sin desinstalar. Trae el aviso de pasos, el diagnóstico y los trotes con distancia.</div></div></div>' : '') +
    (NATIVO ? tog('salud', false, 'Health Connect (solo lectura)', 'Lee tus pasos, sueño y carreras de los últimos 7 días y los pasa a tu hoja. Nunca escribe nada', AIC.corre, 'ok') +
      (ajuste('salud', false) ? tog('avisoPasos', true, 'Aviso de pasos a las 5 pm', 'De lunes a viernes, si vas atrasado: "Son las 5 pm y llevas 3,200 pasos: camina 15 minutos"', AIC.corre, 'cyan') +
        (ajuste('avisoPasos', true) ? '<div class="opt"><span class="aic" style="--c:var(--cyan)">' + AIC.corre + '</span><div class="txt"><div class="t1" style="font-size:15px">Meta de pasos</div><div class="muted">Al día; el aviso compara con lo que llevarías a esa hora</div></div>' +
          '<div class="unit paso c-cyan"><button onclick="cambiarMetaPasos(-500)">−</button><button class="on num" style="pointer-events:none">' + META_PASOS().toLocaleString('es-MX') + '</button><button onclick="cambiarMetaPasos(500)">+</button></div></div>' : '') : '') +
      '<div class="opt tarj"><span class="aic" style="--c:var(--cyan)">' + AIC.cel + '</span><div class="txt"><div class="t1" style="font-size:15px">Widgets y accesos directos</div>' +
      '<div class="muted">Widgets: mantén presionada la pantalla de inicio → Widgets → Gym. Accesos: mantén presionado el ícono de la app</div></div></div>' +
      '<div class="opt tarj"><span class="aic" style="--c:var(--pri)">' + AIC.cerebro + '</span><div class="txt"><div class="t1" style="font-size:15px">Diagnóstico</div>' +
      '<div class="muted">¿Health Connect o un widget no responden? Revisa permisos, de qué apps llegan tus datos y qué widgets tienes</div></div>' +
      '<button class="btn ghost sm" onclick="abrirDiagnostico()">Revisar</button></div>' : '') +
    tog('ruta', true, 'Ruta de hoy', 'Te dice qué zona te falta en la semana y cuáles 2–4 ejercicios la cierran', AIC.flechas, 'ok') +
    (NATIVO ? tog('avisoPeso', true, 'Aviso para pesarte a las 7 am', 'Solo si ese día aún no te pesas; al tocarlo abre el teclado con tu último peso', AIC.campana, 'cyan') : '') +
    tog('avisoProt', true, 'Aviso de proteína a las 6 pm', 'Cuánto llevas y qué de lo que comes la completa (sábado y domingo aunque no abras la app)', AIC.cubiertos, 'acc') +
    tog('calentamiento', true, 'Calentamiento automático', 'En los básicos, al abrirlos: barra sola × 10, 50 % × 8 y 75 % × 3, marcadas C (no cuentan para tu volumen)', AIC.flama, 'red') +
    '<div class="opt" style="display:block">' + sec(AIC.reloj, 'cyan', 'Descanso predeterminado') + '<div class="pills c-cyan" style="margin:0;display:grid;grid-template-columns:repeat(4,1fr)">' +
    DESCANSOS.map(s => '<button class="' + (s === def ? 'on' : '') + '" onclick="setAjuste(\'descanso\',' + s + ');abrirAjustes()">' + mmss(s) + '</button>').join('') + '</div></div>' +
    '<div class="opt" style="display:block">' + sec(AIC.flechas, 'pri', 'Objetivo de músculo') + '<div class="muted">' + esc(FOCOS[focoMus()][1]) + '. Cambia las metas del mapa de músculos.</div>' +
    '<div class="pills c-pri" style="margin:8px 0 0;display:grid;grid-template-columns:repeat(3,1fr)">' + Object.keys(FOCOS).map(f => '<button class="' + (f === focoMus() ? 'on' : '') + '" onclick="setFoco(\'' + f + '\')">' + FOCOS[f][0] + '</button>').join('') + '</div></div>' +
    '<div class="opt"><span class="aic" style="--c:var(--ok)">' + AIC.cubiertos + '</span><div class="txt"><div class="t1" style="font-size:15px">Meta de proteína</div><div class="muted">Unos 1.6–2 g por kilo de tu peso</div></div>' +
    '<div class="unit paso c-ok"><button onclick="cambiarMeta(-5)">−5</button><button class="on num" style="pointer-events:none">' + metaProt() + ' g</button><button onclick="cambiarMeta(5)">+5</button></div></div>' +
    '<div class="opt" style="display:block">' + sec(AIC.cal, 'acc', 'Días de aviso') + '<div class="muted">Esos días te llega a las 5:00 am lo que te toca</div><div class="dias">' +
    [1, 2, 3, 4, 5, 6, 0].map(d => '<button class="' + ((DATA.dias || []).includes(d) ? 'on' : '') + '" onclick="cambiarDias(' + d + ')">' + DIAS_CORTOS[d] + '</button>').join('') + '</div></div>' +
    '<div class="opt"><span class="aic" style="--c:var(--cyan)">' + AIC.regla + '</span><div class="txt"><div class="t1" style="font-size:15px">Meta de cintura</div><div class="muted">' +
    (DATA.cuerpo && DATA.cuerpo.actual ? 'Hoy: ' + DATA.cuerpo.actual + ' cm' : 'A la altura del ombligo') + '</div></div>' +
    (DATA.cuerpo && DATA.cuerpo.meta
      ? '<div class="unit paso c-cyan"><button onclick="cambiarMetaCintura(-0.5)">−</button><button class="on num" style="pointer-events:none">' + DATA.cuerpo.meta + ' cm</button><button onclick="cambiarMetaCintura(0.5)">+</button></div>'
      : '<button class="btn ghost sm" onclick="cambiarMetaCintura(0)">Poner meta</button>') + '</div>' +
    '<div class="opt" style="display:block">' + sec(AIC.corre, 'red', 'Carrera') + '<div class="muted">Con una carrera de 5 km activa tu plan de 6 semanas en la pestaña Trote</div>' +
    '<input type="date" id="carFecha" min="' + hoy() + '" value="' + (c ? c.fecha : '') + '">' +
    '<div class="pills c-red" style="display:grid;grid-template-columns:repeat(4,1fr);margin:0">' + [5, 10, 21].map(k => '<button class="' + (c && c.km === k ? 'on' : '') + '" onclick="guardarCarrera(' + k + ')">' + k + ' km</button>').join('') +
    '<button onclick="guardarCarrera(0)">Ninguna</button></div></div>' +
    '<div class="opt tarj"><span class="aic" style="--c:var(--ok)">' + AIC.nube + '</span><div class="txt"><div class="t1" style="font-size:15px">Respaldo</div><div class="muted">Descarga lo que tiene la app en este celular</div></div>' +
    '<button class="btn sm verde" onclick="descargarRespaldo()">⬇ Descargar</button></div>' +
    '<div class="opt tarj"><span class="aic" style="--c:var(--acc)">' + AIC.cerebro + '</span><div class="txt"><div class="t1" style="font-size:15px">Lo que falló</div><div class="muted">' +
    (fallas ? fallas + ' aviso' + (fallas === 1 ? '' : 's') + ' guardado' + (fallas === 1 ? '' : 's') + ' en este celular' : 'Nada falló últimamente') + '</div></div>' +
    (fallas ? '<button class="btn ghost sm" onclick="abrirFallas()">Ver</button>' : '') + '</div>' +
    '<a class="btn ghost block hoja" href="' + DATA.resumen.sheetUrl + '" target="_blank" rel="noopener">' + AIC.tabla + ' Abrir mi hoja de Google</a>' +
    (NATIVO ? '' : '<div class="opt"><div class="txt"><div class="t1" style="font-size:15px">Pasar a la app nativa (APK)</div><div class="muted">Copia tu link y pégalo en la app la primera vez</div></div>' +
      '<button class="btn ghost sm" onclick="copiarLinkConfig()">Copiar</button></div>') +
    '<div class="muted" style="text-align:center;margin-top:14px;font-size:12px">Gym ' + VERSION_APP + (NATIVO ? ' (app)' : '') + ' · ' + esc(DATA.nombre || '') + '</div>';
  abrirModal('completa');
}
// Lo que falló: errores de la app y datos que la hoja no aceptó (los de la app también se mandan solos a tu hoja, pestaña Errores)
function abrirFallas(borrar) {
  const js = LS.get('gym_jserr', []).slice().reverse().map(x => ({ cuando: x.ts || x.dia, msg: x.msg, donde: x.donde }));
  const hoja = LS.get('gym_errores', []).slice().reverse().map(x => ({ cuando: x.cuando, msg: (x.que ? x.que + ': ' : '') + x.msg, donde: 'La hoja no lo aceptó' }));
  const l = hoja.concat(js).slice(0, 25), fecha = c => { const d = new Date(c); return isNaN(d) ? String(c || '') : ddmm(claveDia(d)) + (String(c).length > 10 ? ' ' + horaTexto(d) : ''); };
  $('sheet').innerHTML = '<div class="row between"><div class="t2">Lo que falló</div><button class="btn ghost sm" onclick="abrirAjustes()">←</button></div>' +
    '<div class="muted" style="margin:4px 0 10px">Lo más reciente arriba. Los errores de la app también llegan a tu hoja (pestaña Errores); si algo se repite, mándale captura a tu coach.</div>' +
    (l.length ? l.map(x => '<div class="falla"><b>' + esc(fecha(x.cuando)) + '</b> ' + esc(x.msg) + (x.donde ? '<small>' + esc(x.donde) + '</small>' : '') + '</div>').join('') : '<div class="muted">Nada por aquí.</div>') +
    (l.length ? (borrar ? '<div class="muted" style="margin-top:10px">¿Borrar la lista de este celular? (lo de tu hoja se queda)</div><div class="acts"><button class="btn ghost" onclick="abrirFallas()">No</button>' +
      '<button class="btn" onclick="LS.del(\'gym_jserr\');LS.del(\'gym_errores\');abrirAjustes();toast(\'Lista borrada\')">Sí, borrar</button></div>'
      : '<div class="acts"><button class="btn ghost" onclick="abrirFallas(true)">Borrar la lista</button></div>') : '');
}
async function toggleAjuste(k, d) {
  const nuevo = !ajuste(k, d);
  if (k === 'reloj' && nuevo && NATIVO) {
    await nativo('LocalNotifications', 'requestPermissions');
    const ex = await nativo('LocalNotifications', 'checkExactNotificationSetting');
    if (ex && ex.exact_alarm && ex.exact_alarm !== 'granted') { toast('Activa "Alarmas y recordatorios" para que el aviso sea puntual'); await nativo('LocalNotifications', 'changeExactNotificationSetting'); }
  } else if (k === 'reloj' && nuevo) {
    if (!('Notification' in window)) return toast('Este navegador no permite notificaciones');
    const p = await Notification.requestPermission();
    if (p !== 'granted') return toast('Necesito permiso de notificaciones para avisarte');
  }
  if ((k === 'avisoProt' || k === 'avisoPasos' || k === 'avisoPeso') && nuevo && NATIVO) await nativo('LocalNotifications', 'requestPermissions');
  if (k === 'salud' && nuevo && !(await conectarSalud())) return abrirAjustes();
  setAjuste(k, nuevo);
  if (k === 'avisoProt' || k === 'avisoPeso') programarAvisoProt();
  if (k === 'sencillo') { aplicarSencillo(); pintarTab(); }
  if (k === 'salud' && nuevo) leerSalud(true);
  if (k === 'salud' && !nuevo) { LS.del('gym_salud'); LS.del('gym_salud_firma'); actualizarWidgets(); }
  if (k === 'salud' || k === 'avisoPasos') configurarPasos();
  if (k === 'pantalla') { if (nuevo && sesionActiva()) pedirPantalla(); if (!nuevo) soltarPantalla(); }
  abrirAjustes();
}
function cambiarMetaPasos(d) {
  setAjuste('metaPasos', Math.max(3000, Math.min(20000, META_PASOS() + d)));
  configurarPasos(); abrirAjustes();
}
/* ----- Diagnóstico (APK): qué ve la app de Health Connect, los widgets y el aviso de pasos ----- */
const APPS_SALUD = { 'com.google.android.apps.fitness': 'Google Fit', 'com.fitbit.FitbitMobile': 'Fitbit', 'com.sec.android.app.shealth': 'Samsung Health',
  'com.google.android.apps.healthdata': 'Health Connect', 'com.strava': 'Strava', 'com.garmin.android.apps.connectmobile': 'Garmin Connect', 'fi.polar.polarflow': 'Polar Flow',
  'com.mi.health': 'Mi Fitness', 'com.xiaomi.wearable': 'Mi Fitness', 'com.huawei.health': 'Huawei Salud', 'com.google.android.gms': 'Google', 'android': 'el celular' };
const nombreApp = p => APPS_SALUD[p] || String(p).split('.').pop();
const cuandoTexto = d => diaCorto(claveDia(d)) + ', ' + horaTexto(d);
const haceCuanto = ms => { const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? 'hace un momento' : m < 60 ? 'hace ' + m + ' min' : m < 1440 ? 'hace ' + Math.round(m / 60) + ' h' : 'hace ' + Math.round(m / 1440) + ' días'; };
let DIAG = null;
async function abrirDiagnostico() {
  $('sheet').innerHTML = '<div class="row between ajhead"><div class="t2">Diagnóstico</div><button class="cerrar" onclick="abrirAjustes()" aria-label="Volver">✕</button></div>' +
    '<div class="muted" style="margin:14px 0">Revisando el APK, Health Connect y los widgets…</div>';
  if (!$('modal').classList.contains('show')) abrirModal('completa');
  const [e, info] = await Promise.all([nativo('GymNativo', 'estado'), nativo('App', 'getInfo')]);
  DIAG = { e: e || null, apk: (e && e.apk) || (info && info.version) || '' };
  if (!DIAG.e) DIAG.hc = await hc('isAvailable');
  pintarDiagnostico();
}
function lineasDiagnostico() {
  const L = [], d = DIAG || {}, e = d.e, s = LS.get('gym_salud', null);
  L.push(['h', 'App']);
  L.push([true, 'App ' + VERSION_APP + ' · APK ' + (d.apk || 'sin versión')]);
  if (!e) L.push([false, 'Tu APK es anterior a la 7.5: descarga Gym.apk de nuevo (Releases) e instálalo encima. Sin él no hay aviso de pasos ni este diagnóstico completo.']);
  L.push(['h', 'Health Connect']);
  if (e) {
    L.push([e.sdk === 'disponible', e.sdk === 'disponible' ? 'Disponible en este celular' : e.sdk === 'actualizar' ? 'Hay que actualizar Health Connect (Play Store)' : 'No está en este celular']);
    if (e.errorHC || e.error) L.push([false, 'Health Connect respondió con error: ' + (e.errorHC || e.error) + '. Vuelve a intentar en un momento.']);
    if (e.notificaciones === false) L.push([false, 'Notificaciones apagadas para Gym: el aviso de pasos no puede salir. Actívalas en Ajustes del celular → Apps → Gym → Notificaciones.']);
    const P = { READ_STEPS: 'Pasos', READ_DISTANCE: 'Distancia', READ_SLEEP: 'Sueño', READ_EXERCISE: 'Ejercicio' };
    if (e.permisos) Object.keys(P).forEach(k => L.push([e.permisos.includes(k), P[k] + (e.permisos.includes(k) ? ': con permiso' : ': sin permiso')]));
    if (e.permisos) L.push([e.fondo ? true : e.fondoDisponible ? false : null, e.fondo ? 'En segundo plano: con permiso (el aviso de las 5 pm lee tus pasos con la app cerrada)'
      : e.fondoDisponible ? 'En segundo plano: sin permiso (el aviso de las 5 pm no puede leer tus pasos con la app cerrada)' : 'En segundo plano: tu Health Connect no lo tiene; el aviso solo sale en la app']);
  } else if (d.hc) L.push([!!d.hc.available, d.hc.available ? 'Disponible en este celular' : 'No disponible']);
  L.push([ajuste('salud', false) ? true : false, ajuste('salud', false) ? 'Conectado en Ajustes' : 'Apagado en Ajustes: actívalo para leer tus datos']);
  if (s) {
    const f = s.fuentes || {}, de = l => l && l.length ? ' (de ' + l.map(nombreApp).join(', ') + ')' : '';
    L.push(['h', 'Lo último que leyó · ' + haceCuanto(s.ts)]);
    L.push([s.pasos.length > 0, s.pasos.length ? s.pasos.length + (s.pasos.length === 1 ? ' día' : ' días') + ' con pasos' + de(f.pasos) : 'Sin pasos: ninguna app le está mandando pasos a Health Connect']);
    L.push([s.sueno.length > 0 ? true : null, s.sueno.length ? s.sueno.length + (s.sueno.length === 1 ? ' noche' : ' noches') + ' de sueño' + de(f.sueno) : 'Sin sueño: hace falta un reloj o una app que lo mida']);
    L.push([s.runs.length > 0 ? true : null, (s.sesiones || 0) + (s.sesiones === 1 ? ' sesión' : ' sesiones') + ' de ejercicio' + de(f.ejercicio) + ' · ' + s.runs.length + ' carrera' + (s.runs.length === 1 ? '' : 's') + ' con distancia' +
      (s.sinDistancia ? ' · ' + s.sinDistancia + ' sin distancia (esas no se suben)' : '')]);
    (s.errores || []).forEach(x => L.push([false, 'Error al leer ' + x]));
  }
  if (e) {
    const W = { proteina: 'Proteína', hoy: 'Hoy toca', carrera: 'Carrera', semana: 'Tu semana' }, w = e.widgets || {}, total = Object.keys(W).reduce((a, k) => a + (w[k] || 0), 0);
    L.push(['h', 'Widgets']);
    L.push([total > 0 ? true : null, total ? 'En tu pantalla: ' + Object.keys(W).filter(k => w[k]).map(k => W[k] + (w[k] > 1 ? ' ×' + w[k] : '')).join(', ')
      : 'No hay widgets puestos: mantén presionado un espacio vacío de la pantalla de inicio → Widgets → Gym']);
    L.push([e.widgetsTs > 0 && Date.now() - e.widgetsTs < 864e5, e.widgetsTs ? 'Datos que les mandó la app: ' + haceCuanto(e.widgetsTs) : 'La app todavía no les ha mandado datos']);
    if (e.cola) L.push([null, e.cola + ' comida' + (e.cola === 1 ? '' : 's') + ' del widget esperando a sumarse']);
    const p = e.pasos || {};
    L.push(['h', 'Aviso de pasos']);
    L.push([p.activo ? true : null, p.activo ? 'Prendido: ' + horaTexto(new Date(2000, 0, 1, p.hora, p.min)) + ' de lunes a viernes · meta ' + Number(p.meta).toLocaleString('es-MX') +
      (p.proximo ? ' · siguiente revisión: ' + cuandoTexto(new Date(p.proximo)) : '') : 'Apagado']);
    // "2026-10-21T17:00:04 Son las 5 pm y llevas…": la fecha (hora del celular) y lo que pasó
    if (p.resultado) { const i = p.resultado.indexOf(' '), f = new Date(p.resultado.slice(0, i)); L.push([null, 'Última revisión' + (isNaN(f) ? '' : ' (' + cuandoTexto(f) + ')') + ': ' + p.resultado.slice(i + 1)]); }
  }
  return L;
}
function textoDiagnostico() {
  return ['Diagnóstico Gym · ' + new Date().toLocaleString('es-MX')].concat(lineasDiagnostico().map(l => l[0] === 'h' ? '\n' + l[1].toUpperCase() : (l[0] === true ? '✓ ' : l[0] === false ? '✗ ' : '• ') + l[1])).join('\n');
}
function pintarDiagnostico() {
  const ic = { true: ['✓', 'ok'], false: ['✗', 'red'], null: ['•', 'muted'] };
  $('sheet').innerHTML = '<div class="row between ajhead"><div class="t2">Diagnóstico</div><button class="cerrar" onclick="abrirAjustes()" aria-label="Volver">✕</button></div>' +
    '<div class="diag">' + lineasDiagnostico().map(l => l[0] === 'h' ? '<div class="t1 dh">' + esc(l[1]) + '</div>'
      : '<div class="dl"><b style="color:var(--' + ic[l[0]][1] + ')">' + ic[l[0]][0] + '</b><span>' + esc(l[1]) + '</span></div>').join('') + '</div>' +
    '<div class="diag-bt"><button class="btn sm" onclick="leerSalud(true).then(abrirDiagnostico)">Leer ahora</button>' +
    '<button class="btn ghost sm" onclick="permisosDiagnostico()">Dar permisos</button>' +
    '<button class="btn ghost sm" onclick="hc(\'openHealthConnectSettings\')">Abrir Health Connect</button>' +
    '<button class="btn ghost sm" onclick="widgetsYa()">Actualizar widgets</button>' +
    '<button class="btn ghost sm" onclick="copiarTexto(textoDiagnostico(), \'Diagnóstico copiado ✓\')">Copiar</button></div>' +
    '<div class="protocolo"><b>¿Sin pasos o sin carreras?</b> Health Connect solo guarda lo que otra app le manda. Abre la app que cuenta tus pasos o registra tus trotes ' +
    '(Fitbit, Samsung Health, Google Fit, Strava…) y activa compartir con Health Connect. En el Pixel: Ajustes → Seguridad y privacidad → Privacidad → Health Connect → Permisos de apps.</div>';
}
async function permisosDiagnostico() {
  if (await conectarSalud()) { if (!ajuste('salud', false)) setAjuste('salud', true); configurarPasos(); await leerSalud(true); }
  abrirDiagnostico();
}
function widgetsYa() {
  if (!DATA) return;
  clearTimeout(WIDGET_T);
  nativo('GymNativo', 'guardarWidgets', { datos: datosWidgets() }).then(() => { toast('Widgets actualizados ✓'); abrirDiagnostico(); });
}
function cambiarMeta(d) {
  DATA.metaProteina = Math.max(40, Math.min(300, metaProt() + d));
  LS.set('gym_data', DATA);
  encolar('saveConfig', [{ metaProteina: DATA.metaProteina }], 'cfg-meta');
  abrirAjustes();
}
function cambiarDias(d) {
  const nuevos = bvToggle(DATA.dias || [], d);
  if (!nuevos.length) return toast('Deja al menos un día');
  DATA.dias = nuevos; LS.set('gym_data', DATA);
  encolar('saveConfig', [{ dias: nuevos }], 'cfg-dias');
  abrirAjustes();
}
function cambiarMetaCintura(d) {
  if (!DATA.cuerpo) return;
  const base = DATA.cuerpo.meta || (DATA.cuerpo.actual ? Math.round((DATA.cuerpo.actual - 4) * 2) / 2 : 80);
  DATA.cuerpo.meta = Math.max(50, Math.min(150, base + d));
  LS.set('gym_data', DATA);
  encolar('saveConfig', [{ metaCintura: DATA.cuerpo.meta }], 'cfg-cintura');
  abrirAjustes();
}
function guardarCarrera(km) {
  const f = ($('carFecha') || {}).value;
  if (km && !f) return toast('Elige primero la fecha de la carrera');
  if (km && f < hoy()) return toast('Esa fecha ya pasó: elige la de tu siguiente carrera');
  DATA.carrera = km ? { fecha: f, km: km, nombre: km === 21 ? 'medio maratón' : km + 'K' } : null;
  if (!km) DATA.plan = null;
  if (km) setAjuste('troteMant', false);
  LS.set('gym_data', DATA);
  encolar('saveConfig', [{ carrera: DATA.carrera }], 'cfg-carrera');
  toast(km ? 'Carrera guardada ✓' : 'Sin carrera');
  abrirAjustes();
  setTimeout(() => enviar().then(actualizar), 1500);
}
function descargarRespaldo() {
  const datos = { exportado: new Date().toISOString(), pendientes: cola().map(op => op.action === 'saveFoto' ? Object.assign({}, op, { args: ['(foto)'] }) : op), datos: DATA, sesion: sesion() };
  const url = URL.createObjectURL(new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'gym-respaldo-' + hoy() + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ===================== Gráficas ===================== */
function graficaPeso(s) {
  if (!s || s.length < 2) return '<div class="muted" style="margin-top:8px">La gráfica aparece cuando tengas al menos 2 días de peso.</div>';
  const prom = s.map((p, i) => { const v = s.slice(Math.max(0, i - 6), i + 1).map(x => x.v); return { d: p.d, v: v.reduce((a, b) => a + b, 0) / v.length }; });
  return linea(prom, s, 'var(--cyan)') + '<div class="legend"><span><i></i>Promedio 7 días</span><span><i class="p"></i>Peso de cada día</span></div>';
}
// Curva suave que pasa por todos los puntos (Catmull-Rom convertida a Bézier)
function curva(pts) {
  if (pts.length < 3) return 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L');
  let d = 'M' + pts[0][0].toFixed(1) + ',' + pts[0][1].toFixed(1);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ' C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ',' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + ' ' +
      (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ',' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + ' ' + p2[0].toFixed(1) + ',' + p2[1].toFixed(1);
  }
  return d;
}
let GRAF_ID = 0;
// Línea suavizada con área en degradado; si se pasa "puntos", la línea es el promedio y los puntos son los valores diarios.
// color: color de la línea (por defecto el morado de la app); de: color de inicio para una línea en degradado
function linea(serie, puntos, color, de) {
  const W = 340, H = 160, pl = 38, pr = 10, pt = 14, pb = 22, id = 'g' + (++GRAF_ID);
  color = color || 'var(--pri)';
  const todos = serie.map(p => p.v).concat(puntos ? puntos.map(p => p.v) : []);
  let mn = Math.min.apply(null, todos), mx = Math.max.apply(null, todos);
  if (mx - mn < 1) { mn -= 0.5; mx += 0.5; }
  const n = serie.length;
  const x = i => pl + (W - pl - pr) * (n === 1 ? 0.5 : i / (n - 1));
  const y = v => pt + (H - pt - pb) * (1 - (v - mn) / (mx - mn));
  const xy = serie.map((p, i) => [x(i), y(p.v)]), d = curva(xy), ult = xy[n - 1];
  let g = '<svg viewBox="0 0 ' + W + ' ' + H + '"><defs>' +
    '<linearGradient id="' + id + 'a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + color + '" stop-opacity=".32"/><stop offset="1" stop-color="' + color + '" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="' + id + 'l" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="' + (de || color) + '"/><stop offset="1" stop-color="' + color + '"/></linearGradient></defs>';
  [mn, (mn + mx) / 2, mx].forEach(v => {
    g += '<line class="grid" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>' +
      '<text class="ax" x="' + (pl - 5) + '" y="' + (y(v) + 3) + '" text-anchor="end">' + v.toFixed(1) + '</text>';
  });
  if (n > 1) g += '<path d="' + d + ' L' + ult[0].toFixed(1) + ',' + (H - pb) + ' L' + xy[0][0].toFixed(1) + ',' + (H - pb) + ' Z" fill="url(#' + id + 'a)"/>';
  if (puntos) puntos.forEach((p, i) => { g += '<circle class="pt" cx="' + x(i) + '" cy="' + y(p.v) + '" r="3.2"/>'; });
  g += '<path d="' + d + '" fill="none" stroke="url(#' + id + 'l)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
  if (!puntos) {
    g += '<circle cx="' + xy[0][0] + '" cy="' + xy[0][1] + '" r="4" fill="var(--card)" stroke="' + (de || color) + '" stroke-width="2"/>';
    if (n > 1) g += '<circle cx="' + ult[0] + '" cy="' + ult[1] + '" r="9" fill="' + color + '" opacity=".22"/>' +
      '<circle cx="' + ult[0] + '" cy="' + ult[1] + '" r="4.5" fill="#fff" stroke="' + color + '" stroke-width="2.5"/>';
  }
  g += '<text class="ax" x="' + pl + '" y="' + (H - 5) + '">' + serie[0].d + '</text>' +
    '<text class="ax" x="' + (W - pr) + '" y="' + (H - 5) + '" text-anchor="end" style="fill:' + color + '">' + serie[n - 1].d + '</text></svg>';
  return g;
}
function barras(semanas) {
  const W = 340, H = 130, pb = 20, pt = 18, n = semanas.length, mx = Math.max.apply(null, semanas.map(s => s.km).concat([1]));
  const bw = (W - 10) / n;
  let g = '<svg viewBox="0 0 ' + W + ' ' + H + '"><defs><linearGradient id="barAcc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFB46E"/><stop offset="1" stop-color="var(--acc)"/></linearGradient></defs>';
  semanas.forEach((s, i) => {
    const actual = i === n - 1, h = (H - pb - pt) * s.km / mx, x = 5 + i * bw + 4, yy = H - pb - Math.max(h, 4);
    g += '<rect x="' + x + '" y="' + yy + '" width="' + (bw - 8) + '" height="' + Math.max(h, 4) + '" rx="6" fill="' + (actual ? 'url(#barAcc)' : 'var(--line)') + '"/>' +
      (s.km && (actual || s.km === mx) ? '<text class="ax" x="' + (x + (bw - 8) / 2) + '" y="' + (yy - 5) + '" text-anchor="middle" style="fill:' + (actual ? 'var(--acc)' : 'var(--muted)') + ';font-weight:700">' + s.km + '</text>' : '') +
      '<text class="ax" x="' + (x + (bw - 8) / 2) + '" y="' + (H - 5) + '" text-anchor="middle"' + (actual ? ' style="fill:var(--acc);font-weight:700"' : '') + '>' + s.d + '</text>';
  });
  return g + '</svg>';
}

arrancar();
