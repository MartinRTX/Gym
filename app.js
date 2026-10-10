/* Gym v5 – app instalable (sirve para varias personas: cada quien con su clave y su propia hoja).
 * Lee y escribe la hoja de Google a través del script de Apps Script (la "API").
 * Todo lo que guardas se queda primero en el celular y se sube en cuanto hay señal.
 */

/* ===================== Utilidades ===================== */
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');
function claveDia(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function hoy() { return claveDia(new Date()); }
function sumarDias(k, n) { const d = new Date(k + 'T12:00:00'); d.setDate(d.getDate() + n); return claveDia(d); }
function difDias(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000); }
function ddmm(k) { return k.slice(8, 10) + '/' + k.slice(5, 7); }
const DSEM = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
function diaCorto(k) { return DSEM[new Date(k + 'T12:00:00').getDay()] + ' ' + ddmm(k); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function jsq(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function mmss(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + pad(s % 60); }
function minutos(ms) { const m = Math.floor(ms / 60000); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + pad(m % 60) + ' min'; }
function vibrar(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }
function vacio(v) { return v === '' || v === null || v === undefined; }
let toastFn = null;
// toast(mensaje, tipo, {txt, fn}) — con acción (por ejemplo "Deshacer") dura 5 segundos
function toast(msg, tipo, accion) {
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

/* ===================== Configuración y datos ===================== */
let API = LS.get('gym_api', ''), KEY = LS.get('gym_key', '');
let DATA = null, GRUPO = null, TAB = 'Entrenar', OPEN = null, BUSCA = '', PTAB = 'Semana';
let FECHA = null;              // null = hoy; 'aaaa-mm-dd' = registrando otro día
let state = {};
let prot = [];
let flushing = false, flushTimer = null;
const PLEG = {};               // secciones abiertas a mano

const FOODS = [
  { k: 'Licuado', t: 'Licuado (scoop + leche)', g: 32 },
  { k: 'Scoop', t: 'Scoop con agua', g: 22 },
  { k: 'Tupper carne', t: 'Tupper con carne o pollo', g: 28 },
  { k: 'Tupper pasta', t: 'Tupper de pasta o papa', g: 12 },
  { k: 'Quesadillas', t: '2 quesadillas', g: 16 },
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
const setAjuste = (k, v) => LS.set('gym_cfg_' + k, v);
const diaReg = () => FECHA || hoy();
const tsReg = () => FECHA ? new Date(FECHA + 'T07:00:00').getTime() : Date.now();

/* ===================== API ===================== */
async function apiGet(action) {
  const r = await fetch(API + '?action=' + action + '&k=' + encodeURIComponent(KEY), { redirect: 'follow' });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'Error de la API');
  return j.result;
}
async function apiPost(action, args, clave) {
  // text/plain evita la verificación previa de CORS que Apps Script no contesta
  const r = await fetch(API, { method: 'POST', redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ k: clave || KEY, action: action, args: args }) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'Error de la API');
  return j.result;
}

/* ===================== Cola de cambios (funciona sin señal) ===================== */
function cola() { return LS.get('gym_queue', []); }
function guardarCola(q) {
  if (!LS.set('gym_queue', q)) toast('El celular no tiene espacio para guardar esto sin señal');
  pintarSync();
}
function encolar(action, args, tag) {
  let q = cola();
  if (tag) q = q.filter(op => op.tag !== tag);
  q.push({ id: uid(), action: action, args: args, tag: tag || null, k: KEY });
  guardarCola(q);
  clearTimeout(flushTimer); flushTimer = setTimeout(enviar, 1200);
}
async function enviar() {
  const q = cola();
  if (flushing || !q.length || !API) return;
  flushing = true; pintarSync();
  try {
    // Cada cambio se manda con la clave con la que se hizo (por si alguien cambió de cuenta en este celular)
    const claves = [...new Set(q.map(op => op.k || KEY))];
    const listos = new Set();
    for (const c of claves) {
      const ops = q.filter(op => (op.k || KEY) === c).map(op => ({ id: op.id, action: op.action, args: op.args }));
      const res = await apiPost('batch', [ops], c);
      res.forEach(r => { listos.add(r.id); if (!r.ok) toast('No se guardó: ' + r.error); });
    }
    guardarCola(cola().filter(op => !listos.has(op.id)));
  } catch (e) {
    if (/Clave/.test(e.message)) toast('La clave no coincide; revisa la configuración');
    clearTimeout(flushTimer); flushTimer = setTimeout(enviar, 20000);
  } finally { flushing = false; pintarSync(); }
}
function pintarSync() {
  const n = cola().length, el = $('sync');
  if (!el) return;
  if (flushing) { el.className = 'sync'; el.textContent = 'Subiendo…'; }
  else if (n) { el.className = 'sync pend'; el.textContent = n + ' sin subir' + (navigator.onLine ? '' : ' · sin señal'); }
  else { el.className = 'sync ok'; el.textContent = '✓ Al día'; }
}

/* ===================== Arranque ===================== */
function arrancar() {
  const p = new URLSearchParams(location.search);
  if (p.get('api') && p.get('k')) {
    const nuevaClave = p.get('k').trim();
    if (KEY && nuevaClave !== KEY) {
      // Otra persona en este celular: borra lo guardado de la cuenta anterior (los pendientes se suben con su clave)
      Object.keys(localStorage).filter(k => /^gym_(data|ses_|wip_|prot_|peso_|cint_|super_|fotos|tipcount)/.test(k)).forEach(k => LS.del(k));
    }
    API = p.get('api').trim(); KEY = nuevaClave;
    LS.set('gym_api', API); LS.set('gym_key', KEY);
    toast('App configurada ✓');
  }
  const g = p.get('g');
  if (g) { GRUPO = g; OPEN = null; }
  if (p.toString()) history.replaceState(null, '', location.pathname);
  if ('serviceWorker' in navigator) {
    const teniaVersion = !!navigator.serviceWorker.controller;
    let recargada = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (teniaVersion && !recargada) { recargada = true; location.reload(); }
    });
    navigator.serviceWorker.register('sw.js').then(reg => reg.update()).catch(() => {});
  }
  if (!API || !KEY) { $('loading').classList.add('hide'); $('setup').classList.remove('hide'); return; }

  DATA = LS.get('gym_data', null);
  if (DATA) pintarTodo();
  actualizar();
  enviar();
  window.addEventListener('online', () => { pintarSync(); enviar(); actualizar(); });
  window.addEventListener('offline', pintarSync);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      enviar(); actualizar(); tickRest();
      if (sesionActiva()) pedirPantalla();
    }
  });
  setInterval(enviar, 30000);
  setInterval(tickSesion, 15000);
  if (LS.get('gym_rest', null)) arrancarRest();
  if (sesionActiva()) pedirPantalla();
}
function guardarConfig() {
  const a = $('cfgApi').value.trim(), k = $('cfgKey').value.trim();
  if (!/^https:\/\/script\.google\.com\//.test(a) || !k) return toast('Revisa la URL y la clave');
  LS.set('gym_api', a); LS.set('gym_key', k);
  location.reload();
}
async function actualizar() {
  try {
    const d = await apiGet('data');
    DATA = d; LS.set('gym_data', d);
    pintarTodo();
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
function exDe(name) { return DATA.exercises.find(e => e.name === name); }
function nuevoEstado(ex, done, id) {
  return { unit: ex.unit, sets: ex.sets.map(s => ({ w: s.w, r: s.r, t: s.t || 'T', ok: false })), rir: '', notas: '',
           uid: id, done: done, edited: false };
}
function superserie() { const s = LS.get('gym_super_' + diaReg(), null); return s && s.length === 2 ? s : null; }
function companero(name) { const s = superserie(); return s && s.includes(name) ? s.find(x => x !== name) : null; }

function pintarTodo() {
  const pend = cola(), w = wip(), viejo = state, dia = diaReg();
  state = {};
  DATA.exercises.forEach(ex => {
    let done = !FECHA && fresco() && ex.done, id = !FECHA && fresco() ? (ex.uid || '') : '';
    pend.forEach(op => {
      if (op.action === 'saveExercise' && op.args[0].name === ex.name && op.args[0].day === dia) { done = true; id = op.args[0].uid; }
      if (op.action === 'undoById' && op.args[0] === id) { done = false; id = ''; }
    });
    const prev = viejo[ex.name];
    if (prev && prev.dia === dia && prev.edited && !prev.done && !done) { state[ex.name] = prev; return; }
    const g = w[ex.name];
    state[ex.name] = g && !done
      ? { unit: g.unit, sets: g.sets, rir: g.rir || '', notas: g.notas || '', uid: '', done: false, edited: true }
      : nuevoEstado(ex, done, id);
    state[ex.name].dia = dia;
  });
  if (!GRUPO) GRUPO = DATA.sugGrupo;
  if (OPEN === null) OPEN = siguiente(GRUPO, '');
  const protLocal = LS.get('gym_prot_' + hoy(), null);
  if (protLocal) prot = protLocal;
  else if (fresco() && DATA.protHoy.detalle) prot = DATA.protHoy.detalle.split(', ').filter(k => FOODS.some(f => f.k === k));
  else prot = [];
  $('brand').innerHTML = 'Gym <span>' + esc(DATA.nombre || '') + '</span>';
  document.title = 'Gym' + (DATA.nombre ? ' ' + DATA.nombre : '');
  pintarFecha();
  $('loading').classList.add('hide'); $('app').classList.remove('hide'); $('nav').classList.remove('hide');
  pintarTab(); pintarSync();
}
function pesoDe(dia) {
  const local = LS.get('gym_peso_' + dia, null);
  return local !== null ? local : (dia === hoy() && fresco() ? DATA.pesoHoy : null);
}
function pintarFecha() {
  const p = pesoDe(hoy());
  $('fecha').innerHTML = esc(fresco() ? DATA.today : 'Sin conexión') + ' · hoy toca ' + esc(DATA.sugGrupo) +
    ' (' + DATA.bloquePara[DATA.sugGrupo] + ')' + (p !== null ? ' · ' + p + ' kg ✓' : '');
}

function verTab(t) {
  TAB = t;
  ['Entrenar', 'Comida', 'Progreso'].forEach(x => {
    $('v' + x).classList.toggle('hide', x !== t);
    $('n' + x).classList.toggle('on', x === t);
  });
  window.scrollTo(0, 0);
  if (!LS.get('gym_rest', null)) ocultarRest();
  pintarTab();
  if (t === 'Progreso') enviar().then(actualizar);
}
function pintarTab() {
  if (TAB === 'Entrenar') pintarEntrenar();
  else if (TAB === 'Comida') pintarComida();
  else pintarProgreso();
}

/* ===================== ENTRENAR ===================== */
function ordenGrupo(g) {
  const exs = DATA.exercises.filter(ex => ex.group === g);
  if (g === 'Core') return [exs];
  const rec = DATA.bloquePara[g], otro = rec === 'A' ? 'B' : 'A';
  return [exs.filter(e => e.bloque === rec), exs.filter(e => e.bloque === otro), exs.filter(e => e.bloque !== 'A' && e.bloque !== 'B')];
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

function pintarEntrenar() {
  const ses = sesion(), activa = sesionActiva();
  let h = '';
  if (activa && !FECHA) {
    h += '<div class="sesbar"><span class="dotlive"></span><div><b id="sesT">' + minutos(Date.now() - ses.start) + '</b>' +
      '<div style="font-size:12px;opacity:.9">' + ses.log.length + ' ejercicio' + (ses.log.length === 1 ? '' : 's') + ' · ' +
      (n => n + (n === 1 ? ' serie' : ' series'))(seriesSesion()) + '</div></div>' +
      '<button class="btn" onclick="terminarSesion()">Terminar</button></div>';
  }
  if (FECHA) h += '<div class="otro">' + ICO.cal + '<span>Registrando para el ' + diaCorto(FECHA) + '</span><button class="btn" onclick="cambiarFecha(null)">Volver a hoy</button></div>';
  const diasSin = DATA.ultimoGrupoFecha ? difDias(DATA.ultimoGrupoFecha, hoy()) - 1 : 0;
  if (!FECHA && !activa && diasSin >= 3 && !sesion().log.length)
    h += '<div class="aviso">' + ICO.flame + '<span>Llevas ' + diasSin + ' días sin ir. Hoy toca ' + esc(DATA.sugGrupo) + ': aunque sean 30 minutos, cuenta.</span></div>';
  if (FECHA ? pesoDe(FECHA) === null : (pesoDe(hoy()) === null && !activa)) h += tarjetaPeso();
  else if (!FECHA && new Date().getDay() === 0 && !activa) h += tarjetaCintura();
  h += '<input class="buscar" id="buscar" type="search" placeholder="Buscar ejercicio…" value="' + esc(BUSCA) + '" oninput="buscar(this.value)">';
  if (BUSCA) {
    const q = BUSCA.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const res = DATA.exercises.filter(ex => (ex.ejercicio + ' ' + ex.musculo).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q));
    h += '<h2>' + res.length + ' resultado' + (res.length === 1 ? '' : 's') + '</h2>' + res.map(tarjetaEjercicio).join('');
    $('vEntrenar').innerHTML = h;
    return;
  }
  h += '<div class="chips">' + DATA.chips.concat(['Trote']).map(g => '<button class="chip' + (g === GRUPO ? ' on' : '') + '" onclick="elegirGrupo(\'' + g + '\')">' +
    g + (g === DATA.sugGrupo ? '<span class="dot"></span>' : '') + '</button>').join('') + '</div>';
  if (GRUPO === 'Trote') { $('vEntrenar').innerHTML = h + vistaTrote() + pieFecha(); return; }
  const secs = ordenGrupo(GRUPO);
  const titulos = GRUPO === 'Core' ? ['Elige 1 o 2 al final de cualquier día']
    : ['Recomendado · bloque ' + DATA.bloquePara[GRUPO], 'Bloque ' + (DATA.bloquePara[GRUPO] === 'A' ? 'B' : 'A'), 'Más ejercicios'];
  let primera = true;
  secs.forEach((items, i) => {
    if (!items.length) return;
    // La primera sección con ejercicios va abierta; las demás plegadas salvo que tengan algo en curso o las abras
    const activa2 = items.some(e => e.name === OPEN || state[e.name].done || state[e.name].sets.some(s => s.ok));
    const abierta = primera || activa2 || PLEG[GRUPO + i];
    if (primera) h += '<h2>' + titulos[i] + '</h2>' + items.map(tarjetaEjercicio).join('');
    else h += '<details class="sec"' + (abierta ? ' open' : '') + ' ontoggle="PLEG[\'' + GRUPO + i + '\']=this.open"><summary>' + titulos[i] + ' · ' + items.length + '</summary>' +
      items.map(tarjetaEjercicio).join('') + '</details>';
    primera = false;
  });
  $('vEntrenar').innerHTML = h + pieFecha();
}
function pieFecha() {
  return FECHA ? '' : '<div style="text-align:center;margin:18px 0 4px"><button class="link" onclick="elegirFecha()">' + ICO.cal.replace('class="icon"', 'class="icon" style="width:16px;height:16px;vertical-align:-3px"') + ' ¿Se te olvidó registrar otro día?</button></div>';
}
function buscar(v) {
  BUSCA = v;
  pintarEntrenar();
  const el = $('buscar'); el.focus(); el.setSelectionRange(v.length, v.length);
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
let PESO_TMP = null;
function tarjetaPeso() {
  const dia = diaReg();
  if (PESO_TMP === null) PESO_TMP = DATA.ultimoPeso !== null ? DATA.ultimoPeso : '';
  return '<div class="card"><div class="peso"><div class="lbl"><div class="t1">' + (FECHA ? 'Peso del ' + diaCorto(dia) : 'Peso de hoy') + '</div>' +
    '<div class="muted">' + (DATA.promedio7 !== null ? 'Promedio 7 días: <b class="num">' + DATA.promedio7.toFixed(1) + '</b> kg' : 'En ayunas, después del baño') + '</div></div>' +
    '<button class="pesobtn num" onclick="tecladoPeso()">' + (PESO_TMP === '' ? '—' : PESO_TMP) + '</button>' +
    '<button class="okmark" onclick="guardarPeso()" aria-label="Guardar peso">' + ICO.check + '</button></div></div>';
}
function tarjetaCintura() {
  if (LS.get('gym_cint_' + hoy(), null) !== null) return '';
  return '<div class="card"><div class="peso"><div class="lbl"><div class="t1">Cintura</div><div class="muted">Domingo: a la altura del ombligo</div></div>' +
    '<input id="cintura" class="in num" type="number" inputmode="decimal" step="0.5" placeholder="cm">' +
    '<button class="okmark" onclick="guardarCintura()" aria-label="Guardar cintura">' + ICO.check + '</button></div></div>';
}
function guardarPeso() {
  const v = Number(PESO_TMP);
  if (!v) return toast('Pon tu peso');
  const dia = diaReg();
  LS.set('gym_peso_' + dia, v);
  encolar('savePeso', [v, dia], 'peso-' + dia);
  vibrar(15); toast('Peso guardado ✓'); pintarFecha(); pintarEntrenar();
}
function guardarCintura() {
  const v = $('cintura').value;
  if (!v) return toast('Escribe tu cintura');
  LS.set('gym_cint_' + hoy(), Number(v));
  encolar('saveCintura', [Number(v), hoy()], 'cintura-' + hoy());
  vibrar(15); toast('Cintura guardada ✓'); pintarEntrenar();
}

/* ----- Tarjeta de ejercicio ----- */
function anillo(hechas, total, done) {
  const R = 16, C = 2 * Math.PI * R, pct = total ? hechas / total : 0;
  return '<svg class="ring2" viewBox="0 0 38 38"><circle cx="19" cy="19" r="' + R + '" fill="none" stroke="var(--line)" stroke-width="3.5"/>' +
    (pct ? '<circle cx="19" cy="19" r="' + R + '" fill="none" stroke="' + (done ? 'var(--ok)' : 'var(--acc)') + '" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="' + (C * (1 - pct)) + '"/>' : '') +
    '</svg>';
}
function abiertaTarjeta(name) {
  if (state[name].done) return false;
  if (OPEN === name) return true;
  const p = companero(name);
  return !!(p && OPEN === p);
}
function tarjetaEjercicio(ex) {
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
      (log && log.prs && log.prs.length ? ' · <b style="color:var(--acc)">Récord</b>' : '');
  } else if (enCurso) meta = '<b style="color:var(--acc)">' + hechas + ' de ' + trabajo.length + ' series</b>';
  else meta = ex.anterior.length ? 'Última (' + ex.lastWhen + '): ' + resumenSets(ex.anterior) : ex.min + '–' + ex.max + ' reps · primera vez';
  let ico;
  if (st.done) ico = ICO.check;
  else if (enCurso || abierto) ico = anillo(hechas, trabajo.length, false) + '<span class="rt num">' + hechas + '/' + trabajo.length + '</span>';
  else ico = '<span class="num">' + trabajo.length + '</span>';
  const n = jsq(ex.name);
  let h = '<div class="ex' + (abierto ? ' open' : '') + (st.done ? ' done' : '') + (enCurso ? ' prog' : '') + '" id="ex-' + esc(ex.name) + '">' +
    '<div class="ex-head" onclick="abrir(\'' + n + '\')"><div class="ex-ico">' + ico + '</div>' +
    '<div style="flex:1;min-width:0"><div class="ex-name">' + esc(ex.ejercicio) + (par && !st.done ? '<span class="sstag">Superserie</span>' : '') + '</div><div class="ex-meta">' + meta + '</div></div>' +
    (ex.up && !st.done ? '<span class="pill acc">' + ICO.up + 'Sube</span>' : '') + '</div>';
  if (st.done && OPEN === ex.name) {
    h += '<div class="ex-body"><div class="acts">' + (st.uid ? '<button class="btn ghost sm" onclick="deshacer(\'' + n + '\')">Borrar</button>' : '') +
      '<button class="btn ghost sm" onclick="corregir(\'' + n + '\')">' + (st.uid ? 'Corregir' : 'Registrar otra vez') + '</button></div></div>';
  } else if (abierto) h += '<div class="ex-body">' + cuerpoEjercicio(ex, st) + '</div>';
  return h + '</div>';
}

function cuerpoEjercicio(ex, st) {
  const n = jsq(ex.name);
  let h = '<div class="row between" style="margin-bottom:10px"><div class="muted">' + ex.min + '–' + ex.max + ' reps · ' + esc(ex.howTo) + '</div>' +
    '<div class="unit">' + ['lb', 'kg'].map(u => '<button class="' + (st.unit === u ? 'on' : '') + '" onclick="setUnit(\'' + n + '\',\'' + u + '\')">' + u + '</button>').join('') + '</div></div>';
  if (ex.up) h += '<div class="tip acc">' + ICO.up + esc(ex.hint) + '</div>';
  else if (ex.sugerido) h += '<div class="sug">Sugerido hoy: ' + ex.sugerido.w + ' ' + ex.unit + ' × ' + ex.sugerido.r + ' (RPE 8)' +
    '<button class="btn" onclick="usarSugerido(\'' + n + '\')">Usar</button></div>';
  else if (!ex.anterior.length) h += '<div class="tip">Elige un peso que te deje ' + ex.min + '–' + ex.max + ' reps con 1–2 de reserva</div>';
  h += '<div class="sets-h"><span>#</span><span>Anterior</span><span>' + st.unit + '</span><span>Reps</span><span></span></div>';
  let num = 0;
  st.sets.forEach((s, i) => {
    if (s.t !== 'C') num++;
    const a = ex.anterior[i];
    const etiqueta = s.t === 'C' ? 'C' : s.t === 'D' ? 'D' : num;
    h += '<div class="set' + (s.ok ? ' hecho' : '') + '">' +
      '<button class="tipo ' + (s.t === 'T' ? '' : s.t) + '" onclick="cambiarTipo(\'' + n + '\',' + i + ')" aria-label="Tipo de serie">' + etiqueta + '</button>' +
      '<button class="ant num" onclick="copiarAnterior(\'' + n + '\',' + i + ')">' + (a ? a.w + '×' + a.r : '—') + '</button>' +
      '<button class="val num' + (vacio(s.w) ? ' vacio' : '') + '" onclick="teclado(\'' + n + '\',' + i + ',\'w\')">' + (vacio(s.w) ? 'peso' : s.w) + '</button>' +
      '<button class="val num' + (vacio(s.r) ? ' vacio' : '') + '" onclick="teclado(\'' + n + '\',' + i + ',\'r\')">' + (vacio(s.r) ? 'reps' : s.r) + '</button>' +
      '<button class="chk" onclick="marcar(\'' + n + '\',' + i + ')" aria-label="Serie hecha">' + ICO.check + '</button></div>';
  });
  const vistas = LS.get('gym_tipcount', 0);
  if (vistas < 3) h += '<div class="muted" style="margin:-2px 0 8px;font-size:12px">Toca el # para cambiarla a calentamiento (C) o drop (D) · toca "Anterior" para copiarla</div>';
  // Si toca subir, "Igual que antes" te regresaría al peso viejo: no se muestra
  const igual = ex.anterior.length && !ex.up;
  h += '<div class="setacts" style="grid-template-columns:' + (igual ? '1.6fr 1fr 1fr' : '1fr 1fr') + '">' +
    (igual ? '<button class="btn ghost sm" onclick="igualQueAntes(\'' + n + '\')">Igual que antes</button>' : '') +
    '<button class="btn ghost sm" onclick="addSet(\'' + n + '\')"' + (st.sets.length >= 10 ? ' disabled' : '') + '>+ Serie</button>' +
    '<button class="btn ghost sm" onclick="delSet(\'' + n + '\')"' + (st.sets.length <= 1 ? ' disabled' : '') + '>− Serie</button></div>';
  const par = companero(ex.name);
  h += '<div class="row between" style="margin-top:8px">' +
    (par ? '<span class="muted" style="font-size:13px">' + ICO.swap + ' Superserie con <b>' + esc(exDe(par).ejercicio) + '</b></span><button class="link" onclick="quitarSuper()">Quitar</button>'
         : '<button class="link" onclick="elegirSuper(\'' + n + '\')">' + ICO.swap + ' Hacer superserie</button>') + '</div>';
  h += '<details class="more"' + (st.rir || st.notas ? ' open' : '') + '><summary>Esfuerzo y notas</summary><div class="pills">' +
    Object.keys(RPE).map(v => '<button class="' + (st.rir === v ? 'on' : '') + '" onclick="setRir(\'' + n + '\',\'' + v + '\')">' + v + '</button>').join('') +
    '</div><textarea rows="2" placeholder="Notas (opcional)" onchange="setNotas(\'' + n + '\', this.value)">' + esc(st.notas) + '</textarea></details>';
  const hechas = st.sets.filter(s => s.ok).length;
  h += '<div class="acts"><button class="btn" onclick="guardar(\'' + n + '\')">' +
    (hechas && hechas < st.sets.length ? 'Guardar ' + hechas + ' series' : 'Guardar ejercicio') + '</button></div>';
  return h;
}

// El siguiente ejercicio pendiente: primero en la sección del que acabas de hacer, luego en las demás
function siguiente(g, actual) {
  if (!DATA.exercises.some(e => e.group === g)) return '';
  const secs = ordenGrupo(g).filter(x => x.length);
  const dentro = secs.find(x => x.some(e => e.name === actual));
  const orden = dentro ? [dentro].concat(secs.filter(x => x !== dentro)) : secs;
  for (const sec of orden) { const e = sec.find(e => !state[e.name].done && e.name !== actual); if (e) return e.name; }
  return '';
}
function elegirGrupo(g) { GRUPO = g; BUSCA = ''; OPEN = siguiente(g, ''); pintarEntrenar(); }
function abrir(name) {
  const p = companero(name);
  OPEN = (OPEN === name || (p && OPEN === p)) ? '' : name;
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
function setRir(name, v) { const st = state[name]; st.rir = st.rir === v ? '' : v; cambio(name); }
function setNotas(name, v) { state[name].notas = v; cambio(name, false); }
function setUnit(name, u) { state[name].unit = u; cambio(name); }
function cambiarTipo(name, i) {
  const s = state[name].sets[i];
  s.t = s.t === 'T' ? 'C' : s.t === 'C' ? 'D' : 'T';
  cambio(name);
}
function copiarAnterior(name, i) {
  const a = exDe(name).anterior[i];
  if (!a) return;
  const s = state[name].sets[i];
  s.w = a.w; s.r = a.r; s.t = a.t || s.t; vibrar(10);
  cambio(name);
}
function igualQueAntes(name) {
  const ex = exDe(name), st = state[name];
  st.sets = ex.anterior.map((a, i) => ({ w: a.w, r: a.r, t: a.t || 'T', ok: st.sets[i] ? st.sets[i].ok : false }));
  vibrar(10); cambio(name);
}
function usarSugerido(name) {
  const ex = exDe(name), st = state[name];
  st.sets.forEach(s => { if (s.t === 'T' && !s.ok) { s.w = ex.sugerido.w; s.r = ex.sugerido.r; } });
  cambio(name);
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
  const quick = f === 'w' ? [-10, -5, -ex.step, ex.step, 5, 10].map(v => Math.round(v * 100) / 100) : [-2, -1, 1, 2];
  const unicos = quick.filter((v, k) => quick.indexOf(v) === k);
  const num = st.sets.slice(0, i + 1).filter(x => x.t !== 'C').length;
  const titulo = (s.t === 'C' ? 'Calentamiento' : s.t === 'D' ? 'Drop' : 'Serie ' + num) + ' · ' + (f === 'w' ? 'peso (' + st.unit + ')' : 'repeticiones');
  $('kpSheet').innerHTML = '<div class="row between"><div class="t1">' + esc(ex.ejercicio) + '</div><button class="btn ghost sm" onclick="cerrarTeclado()">✕</button></div>' +
    '<div class="muted" style="text-align:center;margin-top:8px">' + titulo + '</div><div class="disp num" id="kpDisp"></div>' +
    (f === 'w' && ex.mult === 2 ? '<div class="platos" id="kpPlatos"></div>' : '') +
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
    const total = Math.round((w * 2 + (unit === 'kg' ? ex.barra / KG_A_LB : ex.barra)) * 10) / 10;
    el.innerHTML = w ? 'Por lado: <b>' + (lista ? lista.join(' + ') : 'no sale exacto con discos') + '</b> · total ' + total + ' ' + unit + (ex.barra ? ' con barra' : '') : 'Pon el peso de un lado';
  }
}
function kpTecla(k) {
  if (k === '⌫') KP.val = KP.nuevo ? '' : KP.val.slice(0, -1);
  else if (k === '.') { if (KP.f === 'r') return; KP.val = (KP.nuevo || KP.val === '' ? '0' : KP.val) + (KP.val.includes('.') && !KP.nuevo ? '' : '.'); }
  else KP.val = (KP.nuevo ? '' : KP.val) + k;
  KP.nuevo = false; vibrar(5); kpPintar();
}
function kpSumar(v) {
  const cur = Number(KP.val) || 0;
  KP.val = String(Math.max(0, Math.round((cur + v) * 100) / 100));
  KP.nuevo = false; vibrar(5); kpPintar();
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
function tecladoPeso() {
  KP = { peso: true, val: PESO_TMP === '' ? '' : String(PESO_TMP), nuevo: true, f: 'w' };
  $('kpSheet').innerHTML = '<div class="row between"><div class="t1">Peso en ayunas (kg)</div><button class="btn ghost sm" onclick="cerrarTeclado()">✕</button></div>' +
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
function marcar(name, i) {
  desbloquearAudio();
  const st = state[name], s = st.sets[i], ex = exDe(name);
  if (!s.ok && vacio(s.r)) return toast('Pon las repeticiones de esta serie');
  if (!s.ok && vacio(s.w) && !ex.sinPeso) return toast('Pon el peso de esta serie');
  s.ok = !s.ok;
  if (s.ok) { vibrar(15); iniciarSesion(); }
  cambio(name);
  if (!s.ok) return;
  if (st.sets.every(x => x.ok)) return setTimeout(() => guardar(name, true), 450);
  if (s.t === 'C' || FECHA) return;
  const p = companero(name);
  if (p && !state[p].done) {
    // Superserie: el descanso va cuando la misma serie del otro ejercicio también está hecha
    const otra = state[p].sets[i];
    if (!otra || otra.ok) sugerirDescanso();
    return;
  }
  sugerirDescanso();
}
function cargaReal(ex, w, unit) { return (Number(w) || 0) * ex.mult * (unit === 'kg' ? KG_A_LB : 1) + ex.barra; }

function guardar(name, auto) {
  const st = state[name], ex = exDe(name);
  if (st.done) return;
  const marcadas = st.sets.filter(s => s.ok);
  const sets = (marcadas.length ? marcadas : st.sets).filter(s => !vacio(s.r))
    .map(s => ({ w: Number(s.w || 0), r: Number(s.r), t: s.t || 'T' }));
  if (!sets.length) return toast('Pon al menos las repeticiones de una serie');
  iniciarSesion();
  st.uid = uid(); st.done = true; st.edited = false; guardarWip(name);
  encolar('saveExercise', [{ name: name, unit: st.unit, sets: sets, rpe: RPE[st.rir] || '', notas: st.notas,
                              ts: tsReg(), uid: st.uid, day: diaReg() }]);
  // Récords: fuerza estimada, peso y repeticiones con el mismo peso
  const prs = [];
  if (!ex.sinPeso && ex.inc > 0) {
    const efectivas = sets.filter(s => s.t !== 'C' && s.r > 0);
    const cargas = efectivas.map(s => ({ c: cargaReal(ex, s.w, st.unit), r: s.r }));
    const mejorE1 = Math.max.apply(null, cargas.map(x => x.c * (1 + x.r / 30)).concat([0]));
    const mejorCarga = Math.max.apply(null, cargas.map(x => x.c).concat([0]));
    if (ex.best && mejorE1 > ex.best + 0.05) prs.push('fuerza');
    if (ex.bestCarga && mejorCarga > ex.bestCarga + 0.05) prs.push('peso');
    if (!prs.length && cargas.some(x => { const prev = ex.repsEn[String(Math.round(x.c * 2) / 2)]; return prev && x.r > prev; })) prs.push('repeticiones');
  }
  if (!FECHA) {
    const ses = sesion();
    ses.log = ses.log.filter(l => l.name !== name);
    ses.log.push({ name: name, ej: ex.ejercicio, sets: sets, unit: st.unit, prs: prs, uid: st.uid,
                   vol: sets.filter(s => s.t !== 'C').reduce((a, s) => a + cargaReal(ex, s.w, st.unit) * s.r, 0) });
    guardarSesion(ses);
  }
  const deshacerUlt = { txt: 'Deshacer', fn: () => corregir(name) };
  if (prs.length) { vibrar([40, 60, 40, 60, 120]); toast('¡Récord de ' + prs.join(' y ') + '!', 'pr', deshacerUlt); }
  else toast(navigator.onLine ? 'Guardado ✓' : 'Guardado en el celular; se sube con señal', '', deshacerUlt);
  const p = companero(name);
  if (p && state[p].done) LS.del('gym_super_' + diaReg());
  if (auto && p && !state[p].done) OPEN = p;
  else OPEN = auto && ex.group === GRUPO && !BUSCA ? siguiente(GRUPO, name) : '';
  pintarEntrenar();
  if (OPEN) irA(OPEN);
}
function quitarRegistro(name) {
  const st = state[name];
  const q = cola(), pend = q.find(op => op.action === 'saveExercise' && op.args[0].uid === st.uid);
  if (pend) guardarCola(q.filter(op => op !== pend));
  else if (st.uid) encolar('undoById', [st.uid]);
  const ses = sesion(); ses.log = ses.log.filter(l => l.name !== name); guardarSesion(ses);
  st.uid = ''; st.done = false; OPEN = name;
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
  if (sets) st.sets = sets.map(s => ({ w: s.w, r: s.r, t: s.t, ok: true }));
  else st.sets.forEach(s => { s.ok = false; });
  cambio(name);
  irA(name);
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
  const el = $('sesT'), s = sesion();
  if (el && s.start) el.textContent = minutos(Date.now() - s.start);
}
// Series de trabajo de hoy: las guardadas más las que llevas marcadas en ejercicios sin guardar
function seriesSesion() {
  const ses = sesion();
  let n = ses.log.reduce((a, l) => a + l.sets.filter(s => s.t !== 'C').length, 0);
  Object.keys(state).forEach(k => { const st = state[k]; if (!st.done) n += st.sets.filter(s => s.ok && s.t !== 'C').length; });
  return n;
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
function abrirModal() { $('toast').className = 'toast'; $('modal').classList.add('show'); }
function cerrarModal() { $('modal').classList.remove('show'); }
function cerrarSesion() {
  const s = sesion(); s.ended = true; guardarSesion(s);
  cerrarModal(); OPEN = ''; detenerRest(); soltarPantalla(); pintarEntrenar(); toast('Sesión terminada. ¡A descansar!');
}
// Imagen 1080×1350 con el resumen, para mandarla por WhatsApp o subirla a historias
async function compartirSesion() {
  const r = resumenSesion(), W = 1080, H = 1350;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#2A1470'); g.addColorStop(1, '#6D3BE8');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const F = (peso, tam) => peso + ' ' + tam + 'px -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
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
    c.fillStyle = 'rgba(255,255,255,.7)'; c.font = F(500, 34); c.fillText(resumenSets(l.sets) + ' ' + l.unit, 80, y + 46);
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
    body: 'Terminó tu descanso de ' + mmss(dur), tag: 'descanso', renotify: true,
    vibrate: [300, 150, 300], icon: 'icon-192.png', badge: 'icon-192.png'
  })).catch(() => {});
}
function sugerirDescanso() {
  if (LS.get('gym_rest', null) || TAB !== 'Entrenar') return;
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
  arrancarRest();
}
function arrancarRest() { tickRest(); clearInterval(restInt); restInt = setInterval(tickRest, 250); }
function sumarRest(seg) { const r = LS.get('gym_rest', null); if (!r) return; r.end += seg * 1000; r.dur += seg; r.fired = false; LS.set('gym_rest', r); tickRest(); }
function detenerRest() { LS.del('gym_rest'); clearInterval(restInt); restInt = null; ocultarRest(); }
function ocultarRest() { const el = $('rest'); el.className = 'rest'; el.innerHTML = ''; }
function tickRest() {
  const r = LS.get('gym_rest', null), el = $('rest');
  if (!r) { clearInterval(restInt); restInt = null; return; }
  const left = (r.end - Date.now()) / 1000;
  if (left <= 0) {
    if (!r.fired) { r.fired = true; LS.set('gym_rest', r); vibrar([300, 150, 300]); beep(); avisoReloj(r.dur); }
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
let TROTE = { km: '', min: '', tipo: null };
function trotesPendientes() { return cola().filter(op => op.action === 'saveTrote').map(op => op.args[0]); }
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
  const lista = pend.map(t => ({ d: ddmm(claveDia(new Date(t.ts))), km: t.km, min: t.min, uid: t.uid, tipo: t.tipo, pend: true })).concat(DATA.trotes.ultimos);
  const km7 = DATA.trotes.km7 + pend.filter(t => difDias(claveDia(new Date(t.ts)), hoy()) < 7).reduce((a, t) => a + Number(t.km), 0);
  const p = DATA.plan, ses = sesionesPlan();
  if (TROTE.tipo === null) { const sig = ses && ses.find(s => !s.hecho); TROTE.tipo = sig ? sig.tipo : 'Libre'; }
  let h = '';
  if (p) {
    h += '<div class="card"><div class="row between"><div><div class="count num">' + p.faltan + '</div><div class="muted">día' + (p.faltan === 1 ? '' : 's') + ' para tu ' + esc(p.carrera.nombre) + ' · ' + diaCorto(p.carrera.fecha) + '</div></div>' +
      (ses ? '<span class="pill pri">Semana ' + p.semana + ' de ' + p.total + '</span>' : '') + '</div>';
    if (ses) {
      const minHechos = ses.filter(s => s.hecho).reduce((a, s) => a + (s.real || s.min), 0);
      h += '<div style="margin-top:10px">' + ses.map((s, i) => '<div class="pses' + (s.hecho ? ' ok' : '') + '"><div class="ck">' + (s.hecho ? ICO.check.replace('class="icon"', 'class="icon" style="width:16px;height:16px"') : i + 1) + '</div>' +
        '<div style="flex:1"><div class="t1" style="font-size:15px">' + s.tipo + (s.ritmo ? ' · <span class="num">' + s.ritmo + '/km</span>' : '') + '</div><div class="muted">' + esc(s.txt) + '</div></div></div>').join('') + '</div>' +
        '<div class="muted" style="margin-top:8px">Esta semana: <b class="num" style="color:var(--text)">' + Math.round(minHechos) + ' de ~' + p.minMeta + ' min</b>' +
        (p.ritmos ? (p.ritmos.fijos ? ' · ritmos de tu plan; meta de carrera ' + p.ritmos.carrera + '/km' : ' · ritmos según tu mejor salida reciente (' + p.ritmos.ref + '/km)')
                  : ' · aún sin salidas de 4 km o más para calcular tus ritmos') + '</div>';
    } else if (p.empieza) h += '<div class="muted" style="margin-top:8px">Tu plan de 6 semanas empieza el ' + diaCorto(p.empieza) + '. Mientras, trota como siempre.</div>';
    h += '</div>';
  }
  const ritmo = TROTE.km && TROTE.min ? mmss(TROTE.min * 60 / TROTE.km) + ' min/km' : '—';
  h += '<h2>Registrar trote' + (FECHA ? ' · ' + diaCorto(FECHA) : '') + '</h2><div class="card"><div class="row" style="gap:10px">' +
    '<div style="flex:1"><div class="muted">Kilómetros</div><button class="val num' + (TROTE.km === '' ? ' vacio' : '') + '" style="margin-top:4px" onclick="tecladoTrote(\'km\')">' + (TROTE.km === '' ? 'km' : TROTE.km) + '</button></div>' +
    '<div style="flex:1"><div class="muted">Minutos</div><button class="val num' + (TROTE.min === '' ? ' vacio' : '') + '" style="margin-top:4px" onclick="tecladoTrote(\'min\')">' + (TROTE.min === '' ? 'min' : TROTE.min) + '</button></div></div>' +
    '<div class="muted" style="margin:10px 0 4px">Ritmo: <b class="num" style="color:var(--text)">' + ritmo + '</b></div>' +
    '<div class="pills">' + TIPOS_TROTE.map(t => '<button class="' + (TROTE.tipo === t ? 'on' : '') + '" onclick="TROTE.tipo=\'' + t + '\';pintarEntrenar()">' + t + '</button>').join('') + '</div>' +
    '<input class="buscar" id="troteNotas" placeholder="Notas (opcional)" style="margin:4px 0 10px">' +
    '<button class="btn block" onclick="guardarTrote()">Guardar trote</button></div>';
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
    '<div class="rec"><div class="medal" style="background:var(--pri-weak);color:var(--pri)">' + ICO.pausa + '</div><div style="flex:1"><div class="t1 num" style="font-size:15px">' + t.km + ' km' +
    (t.min ? ' · ' + t.min + ' min · ' + mmss(t.min * 60 / t.km) + '/km' : '') + '</div><div class="muted">' + t.d + (t.tipo ? ' · ' + esc(t.tipo) : '') + (t.pend ? ' · sin subir' : '') + '</div></div>' +
    (t.uid ? '<button class="btn ghost sm" onclick="borrarTrote(\'' + jsq(t.uid) + '\')">Borrar</button>' : '') + '</div>').join('') + '</div>';
  return h;
}
function tecladoTrote(f) {
  KP = { trote: f, val: TROTE[f] === '' ? '' : String(TROTE[f]), nuevo: true, f: f === 'km' ? 'w' : 'r' };
  const quick = f === 'km' ? [-1, -0.5, 0.5, 1] : [-5, -1, 1, 5];
  $('kpSheet').innerHTML = '<div class="row between"><div class="t1">Trote · ' + (f === 'km' ? 'kilómetros' : 'minutos') + '</div><button class="btn ghost sm" onclick="cerrarTeclado()">✕</button></div>' +
    '<div class="disp num" id="kpDisp"></div><div class="quick" style="grid-template-columns:repeat(4,1fr)">' +
    quick.map(v => '<button onclick="kpSumar(' + v + ')">' + (v > 0 ? '+' : '−') + Math.abs(v) + '</button>').join('') + '</div>' + teclas() +
    '<div class="acts"><button class="btn" onclick="kpTrote()">Listo</button></div>';
  kpPintar(); $('kp').classList.add('show');
}
function kpTrote() { TROTE[KP.trote] = KP.val === '' ? '' : Number(KP.val); cerrarTeclado(); pintarEntrenar(); }
function guardarTrote() {
  if (!TROTE.km) return toast('Pon los kilómetros');
  const t = { km: Number(TROTE.km), min: TROTE.min ? Number(TROTE.min) : '', notas: ($('troteNotas') || {}).value || '',
              tipo: TROTE.tipo === 'Libre' ? '' : TROTE.tipo, ts: tsReg(), uid: uid() };
  encolar('saveTrote', [t]);
  TROTE = { km: '', min: '', tipo: null };
  vibrar(15); toast('Trote guardado ✓'); pintarEntrenar();
}
function borrarTrote(id) {
  const q = cola(), pend = q.find(op => op.action === 'saveTrote' && op.args[0].uid === id);
  if (pend) guardarCola(q.filter(op => op !== pend));
  else { encolar('undoTrote', [id]); DATA.trotes.ultimos = DATA.trotes.ultimos.filter(t => t.uid !== id); }
  toast('Trote borrado'); pintarEntrenar();
}

/* ===================== COMIDA ===================== */
function protTotal() { return prot.reduce((s, k) => s + (FOODS.find(f => f.k === k) || { g: 0 }).g, 0); }
function diaTipicoLista() {
  if (DATA.dueno) return ['Licuado', 'Tupper carne', 'Quesadillas'];
  const cuenta = LS.get('gym_food_counts', {});
  return FOODS.slice().sort((a, b) => (cuenta[b.k] || 0) - (cuenta[a.k] || 0)).filter(f => cuenta[f.k]).slice(0, 3).map(f => f.k);
}
function pintarComida() {
  const meta = metaProt(), tot = protTotal(), pct = Math.min(1, tot / meta), falta = meta - tot;
  const R = 74, C = 2 * Math.PI * R;
  const cuenta = LS.get('gym_food_counts', {});
  const top = FOODS.slice().sort((a, b) => (cuenta[b.k] || 0) - (cuenta[a.k] || 0)).slice(0, 3).filter(f => cuenta[f.k]);
  const tipico = diaTipicoLista();
  let h = '<div class="card" style="text-align:center"><div class="ring"><svg viewBox="0 0 170 170">' +
    '<circle cx="85" cy="85" r="' + R + '" fill="none" stroke="var(--card2)" stroke-width="14"/>' +
    '<circle cx="85" cy="85" r="' + R + '" fill="none" stroke="' + (tot >= meta ? 'var(--ok)' : 'var(--pri)') + '" stroke-width="14" stroke-linecap="round" ' +
    'stroke-dasharray="' + C + '" stroke-dashoffset="' + (C * (1 - pct)) + '" style="transition:stroke-dashoffset .4s"/></svg>' +
    '<div><div class="v num">' + tot + ' g</div><div class="muted">de ' + meta + ' g</div></div></div>' +
    '<div class="t1" style="margin-top:4px">' + (falta > 0 ? 'Te faltan ~' + falta + ' g' : '¡Meta cumplida!') + '</div>' +
    '<div class="muted">' + (falta > 0 ? 'Lo más barato: un scoop con agua (22 g)' : 'Bien hecho hoy') + '</div></div>';
  if (!prot.length && tipico.length) h += '<button class="btn block" style="margin-bottom:12px" onclick="diaTipico()">Mi día típico · +' +
    tipico.reduce((s, k) => s + FOODS.find(f => f.k === k).g, 0) + ' g</button>';
  if (top.length) h += '<h2>Lo que más comes</h2><div class="foods">' + top.map(f => botonComida(f, true)).join('') + '</div>';
  h += '<h2>Agregar</h2><div class="foods">' + FOODS.filter(f => !top.includes(f)).map(f => botonComida(f, false)).join('') + '</div>';
  if (prot.length) h += '<h2>Hoy comiste · toca para quitar</h2><div class="eaten">' +
    prot.map((k, i) => '<button onclick="quitarProt(' + i + ')">' + esc((FOODS.find(f => f.k === k) || {}).t || k) + ' ✕</button>').join('') + '</div>';
  h += '<p class="muted" style="margin-top:14px">Cantidades aproximadas. Lo que cuenta es acercarte a la meta casi todos los días.</p>';
  $('vComida').innerHTML = h;
}
function botonComida(f, esTop) {
  const c = prot.filter(k => k === f.k).length;
  return '<button class="food' + (esTop ? ' top' : '') + '" onclick="addProt(\'' + jsq(f.k) + '\')">' + (c ? '<span class="c">×' + c + '</span>' : '') +
    '<b>+' + f.g + ' g</b>' + esc(f.t) + '</button>';
}
function cambiarProt() {
  LS.set('gym_prot_' + hoy(), prot);
  encolar('saveProteina', [protTotal(), prot.join(', '), hoy()], 'prot-' + hoy());
  pintarComida();
}
function addProt(k) {
  prot.push(k); vibrar(10);
  const c = LS.get('gym_food_counts', {}); c[k] = (c[k] || 0) + 1; LS.set('gym_food_counts', c);
  cambiarProt();
}
function diaTipico() { prot = prot.concat(diaTipicoLista()); cambiarProt(); }
function quitarProt(i) { prot.splice(i, 1); cambiarProt(); }

/* ===================== PROGRESO ===================== */
let EJ_GRAF = null;
function fmt(v, signo) {
  if (v === null || v === undefined) return '—';
  const n = Math.round(v * 10) / 10;
  return (signo && n > 0 ? '+' : '') + n.toFixed(1);
}
const kpi = (v, l, d, good) => '<div class="kpi"><div class="v num">' + v + '</div><div class="l">' + l + '</div>' + (d ? '<div class="d' + (good ? ' good' : '') + '">' + d + '</div>' : '') + '</div>';
function pintarProgreso() {
  let h = '<div class="seg">' + ['Semana', 'Fuerza', 'Cuerpo'].map(t => '<button class="' + (PTAB === t ? 'on' : '') + '" onclick="PTAB=\'' + t + '\';pintarProgreso();window.scrollTo(0,0)">' + t + '</button>').join('') + '</div>';
  if (PTAB === 'Semana') h += progresoSemana();
  else if (PTAB === 'Fuerza') h += tarjetaFuerza() + tarjetaMusculos(DATA.resumen.musculos || []);
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
  let h = '<div class="card"><div class="row between"><div><div class="t2">' + diasSemana + ' de ' + META_DIAS + ' días</div><div class="muted">esta semana · ' + fmt(r.km7) + ' km trotados</div></div>' +
    (r.racha ? '<span class="pill acc" style="font-size:13px;padding:6px 10px">' + ICO.flame + r.racha + ' semana' + (r.racha === 1 ? '' : 's') + '</span>' : '') + '</div>' +
    '<div class="week">' + dias.map((d, i) => '<div class="' + (semana[i] ? 'y' : '') + (i === hoyIdx ? ' hoy' : '') + '"><i></i>' + d + '</div>').join('') + '</div>' +
    '<div class="muted" style="margin-top:8px">La racha cuenta semanas seguidas con 3 o más días de gym.</div></div>';
  if (r.descarga) h += '<div class="card" style="background:var(--acc-weak);border-color:transparent"><div class="t1" style="color:var(--acc)">Considera una semana de descarga</div>' +
    '<div class="muted" style="margin-top:4px">Estos ejercicios no mejoraron en sus últimas 3 sesiones: ' + esc(r.descarga.estancados.join(', ')) +
    '. Una semana con la mitad de series y el mismo peso suele destrabarlos.</div></div>';
  if (subir.length) h += '<h2>Te toca subir peso</h2><div class="card">' + subir.map(s => '<div class="rec"><div class="medal">' + ICO.up + '</div><div style="flex:1">' +
    '<div class="t1" style="font-size:15px">' + esc(s.ej) + '</div><div class="muted">Próxima vez</div></div><b class="num" style="color:var(--acc)">' + s.peso + ' ' + s.unit + '</b></div>').join('') + '</div>';
  if (r.records && r.records.length) h += '<h2>Récords recientes</h2><div class="card">' + r.records.map(x =>
    '<div class="rec"><div class="medal">' + ICO.trophy + '</div><div style="flex:1;min-width:0"><div class="t1" style="font-size:15px">' + esc(x.ej) + '</div>' +
    '<div class="muted num">' + x.w + ' ' + x.unit + ' × ' + x.r + ' · ' + x.k.slice(8, 10) + '/' + x.k.slice(5, 7) + ' · ' + x.tipo + '</div></div>' +
    (x.pct > 0 ? '<b class="num up">+' + x.pct + '%</b>' : '') + '</div>').join('') + '</div>';
  h += '<h2>Hábitos</h2><div class="kpis">' +
    kpi(r.gymDias7, 'Días de gym (7 días)', 'Meta: ' + META_DIAS, r.gymDias7 >= META_DIAS) +
    kpi(r.protProm7 !== null ? r.protProm7 + ' g' : '—', 'Proteína promedio', 'Meta: ' + metaProt() + ' g', r.protProm7 !== null && r.protProm7 >= metaProt()) + '</div>';
  h += '<a class="btn ghost block" style="display:block;text-align:center;text-decoration:none;margin-top:6px" href="' + r.sheetUrl + '" target="_blank" rel="noopener">Abrir dashboard completo</a>';
  return h;
}
function progresoCuerpo() {
  const r = DATA.resumen;
  let h = '<div class="kpis">' +
    kpi(fmt(r.promedio7), 'Peso promedio 7 días (kg)', r.cambioSemana !== null ? fmt(r.cambioSemana, true) + ' vs semana anterior' : '', r.cambioSemana !== null && r.cambioSemana <= 0) +
    kpi(fmt(r.cintura), 'Cintura (cm)', r.cambioCintura !== null ? fmt(r.cambioCintura, true) + ' desde el inicio' : '', r.cambioCintura !== null && r.cambioCintura < 0) + '</div>';
  h += '<div class="card chart"><div class="t1">Peso, últimos 30 días</div>' + graficaPeso(r.serie30) + '</div>';
  if (DATA.fotos && DATA.fotos.activas) h += tarjetaFotos();
  return h;
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
    linea(pts.map(p => ({ d: p.d, v: p.e1 })), false) +
    '<div class="muted" style="margin-top:4px">Mejor: <b class="num" style="color:var(--text)">' + mejor.toFixed(1) + ' lb</b> · ' + pts.length + ' sesiones</div></div>';
  return h;
}
function tarjetaMusculos(ms) {
  const con = ms.filter(x => x.series7 > 0 || x.pct !== null || x.ultimo).sort((a, b) => a.series7 - b.series7);
  const sin = ms.filter(x => !con.includes(x));
  let h = '<h2>Tus músculos</h2><div class="card"><div class="muted" style="margin-bottom:4px">Series efectivas de los últimos 7 días (sin calentamientos; los secundarios cuentan media serie). La rayita marca el mínimo: 10.</div>';
  con.forEach(x => {
    const pct = x.pct === null ? '<span class="muted">—</span>'
      : Math.abs(x.pct) < 0.5 ? '<span class="muted">fuerza igual</span>'
      : '<b class="num ' + (x.pct > 0 ? 'up' : 'down') + '">' + (x.pct > 0 ? '+' : '') + x.pct.toFixed(1) + '% fuerza</b>';
    h += '<div class="mus"><div class="row between"><div class="t1" style="font-size:15px">' + esc(x.m) + '</div>' + pct + '</div>' +
      '<div class="mbar"><div class="' + (x.series7 >= 10 ? 'ok' : '') + '" style="width:' + Math.min(100, Math.round(x.series7 / 20 * 100)) + '%"></div><i></i></div>' +
      '<div class="row between muted" style="margin-top:4px"><span class="num">' + x.series7 + ' series</span><span>' + (x.ultimo ? 'Última vez ' + x.ultimo : '') + '</span></div></div>';
  });
  if (!con.length) h += '<div class="muted" style="padding:8px 0">Aquí verás tu progreso cuando registres tus primeros entrenamientos.</div>';
  if (sin.length) h += '<div class="muted" style="padding-top:10px;border-top:1px solid var(--line)">Sin registros aún: ' + sin.map(x => x.m).join(', ') + '</div>';
  return h + '</div>';
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
    vibrar(15); toast('Foto guardada ✓'); pintarProgreso();
  };
  img.onerror = () => toast('No pude leer la foto');
  img.src = url;
}

/* ===================== AJUSTES ===================== */
function abrirAjustes() {
  if (!DATA) return;
  const tog = (k, d, txt, sub) => '<div class="opt"><div class="txt"><div class="t1" style="font-size:15px">' + txt + '</div><div class="muted">' + sub + '</div></div>' +
    '<button class="tog' + (ajuste(k, d) ? ' on' : '') + '" onclick="toggleAjuste(\'' + k + '\',' + d + ')" aria-label="' + esc(txt) + '"></button></div>';
  const def = ajuste('descanso', 90), c = DATA.carrera;
  $('sheet').innerHTML = '<div class="row between"><div class="t2">Ajustes</div><button class="btn ghost sm" onclick="cerrarModal()">✕</button></div>' +
    tog('pantalla', true, 'Pantalla encendida en la sesión', 'Para que el descanso suene y no tengas que desbloquear') +
    tog('reloj', false, 'Avisar en el reloj', 'Al terminar el descanso llega una notificación (tu reloj la recibe si refleja las de Chrome)') +
    tog('autoDescanso', false, 'Iniciar el descanso solo', 'Si está apagado, solo te sugiere tiempos al marcar una serie') +
    '<div class="opt" style="display:block"><div class="t1" style="font-size:15px;margin-bottom:8px">Descanso predeterminado</div><div class="pills" style="margin:0;display:grid;grid-template-columns:repeat(4,1fr)">' +
    DESCANSOS.map(s => '<button class="' + (s === def ? 'on' : '') + '" onclick="setAjuste(\'descanso\',' + s + ');abrirAjustes()">' + mmss(s) + '</button>').join('') + '</div></div>' +
    '<div class="opt"><div class="txt"><div class="t1" style="font-size:15px">Meta de proteína</div><div class="muted">Unos 1.6–2 g por kilo de tu peso</div></div>' +
    '<div class="unit"><button onclick="cambiarMeta(-5)">−5</button><button class="on num" style="pointer-events:none">' + metaProt() + ' g</button><button onclick="cambiarMeta(5)">+5</button></div></div>' +
    '<div class="opt" style="display:block"><div class="t1" style="font-size:15px">Carrera</div><div class="muted">Con una carrera de 5 km activa tu plan de 6 semanas en la pestaña Trote</div>' +
    '<input type="date" id="carFecha" min="' + hoy() + '" value="' + (c ? c.fecha : '') + '">' +
    '<div class="pills" style="display:grid;grid-template-columns:repeat(4,1fr);margin:0">' + [5, 10, 21].map(k => '<button class="' + (c && c.km === k ? 'on' : '') + '" onclick="guardarCarrera(' + k + ')">' + k + ' km</button>').join('') +
    '<button onclick="guardarCarrera(0)">Ninguna</button></div></div>' +
    '<div class="opt"><div class="txt"><div class="t1" style="font-size:15px">Respaldo</div><div class="muted">Descarga lo que tiene la app en este celular</div></div>' +
    '<button class="btn ghost sm" onclick="descargarRespaldo()">Descargar</button></div>' +
    '<a class="btn ghost block" style="display:block;text-align:center;text-decoration:none;margin-top:8px" href="' + DATA.resumen.sheetUrl + '" target="_blank" rel="noopener">Abrir mi hoja de Google</a>' +
    '<div class="muted" style="text-align:center;margin-top:10px;font-size:12px">Gym v5.1 · ' + esc(DATA.nombre || '') + '</div>';
  abrirModal();
}
async function toggleAjuste(k, d) {
  const nuevo = !ajuste(k, d);
  if (k === 'reloj' && nuevo) {
    if (!('Notification' in window)) return toast('Este navegador no permite notificaciones');
    const p = await Notification.requestPermission();
    if (p !== 'granted') return toast('Necesito permiso de notificaciones para avisarte');
  }
  setAjuste(k, nuevo);
  if (k === 'pantalla') { if (nuevo && sesionActiva()) pedirPantalla(); if (!nuevo) soltarPantalla(); }
  abrirAjustes();
}
function cambiarMeta(d) {
  DATA.metaProteina = Math.max(40, Math.min(300, metaProt() + d));
  LS.set('gym_data', DATA);
  encolar('saveConfig', [{ metaProteina: DATA.metaProteina }], 'cfg-meta');
  abrirAjustes();
}
function guardarCarrera(km) {
  const f = ($('carFecha') || {}).value;
  if (km && !f) return toast('Elige primero la fecha de la carrera');
  DATA.carrera = km ? { fecha: f, km: km, nombre: km === 21 ? 'medio maratón' : km + 'K' } : null;
  if (!km) DATA.plan = null;
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
  return linea(prom, s) + '<div class="legend"><span><i></i>Promedio 7 días</span><span><i class="p"></i>Peso de cada día</span></div>';
}
// Línea con puntos; si se pasa "puntos", la línea es el promedio y los puntos son los valores diarios
function linea(serie, puntos) {
  const W = 340, H = 160, pl = 38, pr = 8, pt = 12, pb = 22;
  const todos = serie.map(p => p.v).concat(puntos ? puntos.map(p => p.v) : []);
  let mn = Math.min.apply(null, todos), mx = Math.max.apply(null, todos);
  if (mx - mn < 1) { mn -= 0.5; mx += 0.5; }
  const n = serie.length;
  const x = i => pl + (W - pl - pr) * (n === 1 ? 0.5 : i / (n - 1));
  const y = v => pt + (H - pt - pb) * (1 - (v - mn) / (mx - mn));
  let g = '<svg viewBox="0 0 ' + W + ' ' + H + '">';
  [mn, (mn + mx) / 2, mx].forEach(v => {
    g += '<line class="grid" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>' +
      '<text class="ax" x="' + (pl - 5) + '" y="' + (y(v) + 3) + '" text-anchor="end">' + v.toFixed(1) + '</text>';
  });
  if (puntos) puntos.forEach((p, i) => { g += '<circle class="pt" cx="' + x(i) + '" cy="' + y(p.v) + '" r="3.2"/>'; });
  g += '<polyline class="avg" points="' + serie.map((p, i) => x(i) + ',' + y(p.v)).join(' ') + '"/>';
  if (!puntos) serie.forEach((p, i) => { g += '<circle cx="' + x(i) + '" cy="' + y(p.v) + '" r="3.5" fill="var(--pri)"/>'; });
  g += '<text class="ax" x="' + pl + '" y="' + (H - 5) + '">' + serie[0].d + '</text>' +
    '<text class="ax" x="' + (W - pr) + '" y="' + (H - 5) + '" text-anchor="end">' + serie[n - 1].d + '</text></svg>';
  return g;
}
function barras(semanas) {
  const W = 340, H = 120, pb = 20, pt = 16, n = semanas.length, mx = Math.max.apply(null, semanas.map(s => s.km).concat([1]));
  const bw = (W - 10) / n;
  let g = '<svg viewBox="0 0 ' + W + ' ' + H + '">';
  semanas.forEach((s, i) => {
    const h = (H - pb - pt) * s.km / mx, x = 5 + i * bw + 4, yy = H - pb - h;
    g += '<rect x="' + x + '" y="' + yy + '" width="' + (bw - 8) + '" height="' + Math.max(h, s.km ? 2 : 0) + '" rx="5" fill="' + (i === n - 1 ? 'var(--acc)' : 'var(--pri)') + '" opacity="' + (i === n - 1 ? 1 : 0.75) + '"/>' +
      (s.km ? '<text class="ax" x="' + (x + (bw - 8) / 2) + '" y="' + (yy - 4) + '" text-anchor="middle">' + s.km + '</text>' : '') +
      '<text class="ax" x="' + (x + (bw - 8) / 2) + '" y="' + (H - 5) + '" text-anchor="middle">' + s.d + '</text>';
  });
  return g + '</svg>';
}

arrancar();
