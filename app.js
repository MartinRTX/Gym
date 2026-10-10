/* Gym Martin v3 – app instalable.
 * Lee y escribe tu hoja de Google a través del script de Apps Script (la "API").
 * Todo lo que guardas se queda primero en el celular y se sube en cuanto hay señal.
 */

/* ===================== Almacenamiento y utilidades ===================== */
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');
function hoy() { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function jsq(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function e1rm(w, r) { return w > 0 && r > 0 ? w * (1 + r / 30) : 0; }
function mmss(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + pad(s % 60); }
function vibrar(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }
function toast(msg, tipo) {
  const t = $('toast'); t.textContent = msg; t.className = 'toast show' + (tipo ? ' ' + tipo : '');
  clearTimeout(t._h); t._h = setTimeout(() => { t.className = 'toast'; }, tipo === 'pr' ? 3500 : 2400);
}
const ICO = {
  check: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  trophy: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/></svg>',
  up: '<svg class="icon" style="width:16px;height:16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  flame: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21c-3.9 0-6.5-2.7-6.5-6.3 0-3.2 2.3-5.4 3.6-7.7.4 1.6 1.3 2.7 2.4 3.2C11.8 7.7 13 5 15.2 3c.1 3 3.3 5.6 3.3 10.7 0 4-2.7 7.3-6.5 7.3z"/></svg>',
  timer: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg>'
};
const ABREV = { 'Pecho': 'Pe', 'Espalda': 'Es', 'Hombro': 'Ho', 'Bíceps': 'Bí', 'Tríceps': 'Tr', 'Cuádriceps': 'Cu',
                'Femoral y glúteo': 'Fg', 'Pantorrilla': 'Pa', 'Core': 'Co' };

/* ===================== Configuración y datos ===================== */
let API = LS.get('gym_api', ''), KEY = LS.get('gym_key', '');
let DATA = null, GRUPO = null, TAB = 'Entrenar', OPEN = null;
let state = {};
let prot = [];
let flushing = false, flushTimer = null;

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
  { k: 'Calle', t: 'Comida de la calle', g: 25 }
];
const TIPICO = ['Licuado', 'Tupper carne', 'Quesadillas'];
const META_PROT = 130, META_DIAS = 4;
const DESCANSOS = [60, 90, 120, 180];

/* ===================== API ===================== */
async function apiGet(action) {
  const r = await fetch(API + '?action=' + action + '&k=' + encodeURIComponent(KEY), { redirect: 'follow' });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'Error de la API');
  return j.result;
}
async function apiPost(action, args) {
  // text/plain evita la verificación previa de CORS que Apps Script no contesta
  const r = await fetch(API, { method: 'POST', redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ k: KEY, action: action, args: args }) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'Error de la API');
  return j.result;
}

/* ===================== Cola de cambios (funciona sin señal) ===================== */
function cola() { return LS.get('gym_queue', []); }
function guardarCola(q) { LS.set('gym_queue', q); pintarSync(); }
function encolar(action, args, tag) {
  let q = cola();
  if (tag) q = q.filter(op => op.tag !== tag);
  q.push({ id: uid(), action: action, args: args, tag: tag || null });
  guardarCola(q);
  clearTimeout(flushTimer); flushTimer = setTimeout(enviar, 1200);
}
async function enviar() {
  const q = cola();
  if (flushing || !q.length || !API) return;
  flushing = true; pintarSync();
  try {
    const res = await apiPost('batch', [q]);
    const listos = new Set();
    res.forEach(r => { listos.add(r.id); if (!r.ok) toast('No se guardó: ' + r.error); });
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
    API = p.get('api').trim(); KEY = p.get('k').trim();
    LS.set('gym_api', API); LS.set('gym_key', KEY);
    history.replaceState(null, '', location.pathname);
    toast('App configurada ✓');
  }
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
    if (document.visibilityState === 'visible') { enviar(); actualizar(); tickRest(); }
  });
  setInterval(enviar, 30000);
  setInterval(tickSesion, 1000);
  if (LS.get('gym_rest', null)) arrancarRest();
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
function wip() { return LS.get('gym_wip_' + hoy(), {}); }
function guardarWip(name) {
  const w = wip(), st = state[name];
  if (st && !st.done && st.edited) w[name] = { unit: st.unit, sets: st.sets, rir: st.rir, notas: st.notas };
  else delete w[name];
  LS.set('gym_wip_' + hoy(), w);
}
function exDe(name) { return DATA.exercises.find(e => e.name === name); }

function pintarTodo() {
  const pend = cola(), w = wip(), ses = sesion(), viejo = state;
  state = {};
  DATA.exercises.forEach(ex => {
    let done = fresco() && ex.done, id = fresco() ? (ex.uid || '') : '';
    pend.forEach(op => {
      if (op.action === 'saveExercise' && op.args[0].name === ex.name && op.args[0].day === hoy()) { done = true; id = op.args[0].uid; }
      if (op.action === 'undoById' && op.args[0] === id) { done = false; id = ''; }
    });
    const prev = viejo[ex.name];
    if (prev && prev.edited && !prev.done && !done) { state[ex.name] = prev; return; }
    const g = w[ex.name];
    state[ex.name] = g && !done
      ? { unit: g.unit, sets: g.sets, rir: g.rir || '', notas: g.notas || '', uid: '', done: false, edited: true }
      : { unit: ex.unit, sets: ex.sets.map(s => ({ w: s.w, r: s.r, ok: false })), rir: '', notas: '', uid: id, done: done, edited: false };
  });
  if (!GRUPO) GRUPO = DATA.sugGrupo;
  if (OPEN === null) {
    const rec = ordenGrupo(GRUPO)[0] || [];
    const sig = rec.find(ex => !state[ex.name].done);
    OPEN = sig ? sig.name : '';
  }
  const protLocal = LS.get('gym_prot_' + hoy(), null);
  if (protLocal) prot = protLocal;
  else if (fresco() && DATA.protHoy.detalle) prot = DATA.protHoy.detalle.split(', ').filter(k => FOODS.some(f => f.k === k));
  else prot = [];

  $('fecha').textContent = (fresco() ? DATA.today : 'Sin conexión') + ' · hoy toca ' + DATA.sugGrupo +
    ' · bloque ' + DATA.bloquePara[DATA.sugGrupo];
  $('loading').classList.add('hide'); $('app').classList.remove('hide'); $('nav').classList.remove('hide');
  pintarTab(); pintarSync();
}

function verTab(t) {
  TAB = t;
  ['Entrenar', 'Comida', 'Progreso'].forEach(x => {
    $('v' + x).classList.toggle('hide', x !== t);
    $('n' + x).classList.toggle('on', x === t);
  });
  window.scrollTo(0, 0);
  if (!LS.get('gym_rest', null)) ocultarRest();   // la sugerencia de descanso solo vive en Entrenar
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

function pintarEntrenar() {
  const ses = sesion();
  let h = tarjetaPeso();
  if (ses.start && !ses.ended) {
    h += '<div class="session"><div><div style="font-size:13px;opacity:.85">Sesión en curso</div>' +
      '<b class="num" id="sesT">' + mmss((Date.now() - ses.start) / 1000) + '</b>' +
      '<span style="font-size:13px;opacity:.85"> · ' + ses.log.length + ' ejercicio' + (ses.log.length === 1 ? '' : 's') + '</span></div>' +
      '<button class="btn sm" onclick="terminarSesion()">Terminar</button></div>';
  }
  h += '<div class="chips">' + DATA.chips.map(g => '<button class="chip' + (g === GRUPO ? ' on' : '') + '" onclick="elegirGrupo(\'' + g + '\')">' +
    g + (g === DATA.sugGrupo ? '<span class="dot"></span>' : '') + '</button>').join('') + '</div>';
  const secs = ordenGrupo(GRUPO);
  const titulos = GRUPO === 'Core' ? ['Elige 1 o 2 al final de cualquier día']
    : ['Recomendado · bloque ' + DATA.bloquePara[GRUPO], 'Bloque ' + (DATA.bloquePara[GRUPO] === 'A' ? 'B' : 'A'), 'Más ejercicios'];
  secs.forEach((items, i) => {
    if (!items.length) return;
    h += '<h2>' + titulos[i] + '</h2>' + items.map(tarjetaEjercicio).join('');
  });
  $('vEntrenar').innerHTML = h;
}

function tarjetaPeso() {
  const pesoLocal = LS.get('gym_peso_' + hoy(), null);
  const pesoHoy = pesoLocal !== null ? pesoLocal : (fresco() ? DATA.pesoHoy : null);
  const val = pesoHoy !== null ? pesoHoy : (DATA.ultimoPeso !== null ? DATA.ultimoPeso : '');
  const domingo = new Date().getDay() === 0;
  let h = '<div class="card' + (pesoHoy !== null ? ' done-card' : '') + '"><div class="peso"><div class="lbl"><div class="t1">Peso de hoy</div>' +
    '<div class="muted">' + (DATA.promedio7 !== null ? 'Promedio 7 días: <b class="num">' + DATA.promedio7.toFixed(1) + '</b> kg' : 'En ayunas, después del baño') + '</div></div>' +
    '<input id="peso" class="in num" type="number" inputmode="decimal" step="0.1" value="' + val + '">' +
    '<button class="okmark" onclick="guardarPeso()" aria-label="Guardar peso">' + ICO.check + '</button></div>';
  if (domingo) h += '<div class="peso" style="margin-top:12px"><div class="lbl"><div class="t1">Cintura</div><div class="muted">Domingo: a la altura del ombligo</div></div>' +
    '<input id="cintura" class="in num" type="number" inputmode="decimal" step="0.5" placeholder="cm">' +
    '<button class="okmark" onclick="guardarCintura()" aria-label="Guardar cintura">' + ICO.check + '</button></div>';
  return h + '</div>';
}

function tarjetaEjercicio(ex) {
  const st = state[ex.name], abierto = OPEN === ex.name && !st.done;
  const hechas = st.sets.filter(s => s.ok).length;
  const enCurso = !st.done && hechas > 0;
  const log = sesion().log.find(l => l.name === ex.name);
  let meta;
  if (st.done) meta = (log ? log.sets.map(s => s.w + '×' + s.r).join(' · ') : 'Registrado hoy') + (log && log.pr ? ' · <b style="color:var(--acc)">Récord</b>' : '');
  else if (enCurso) meta = '<b style="color:var(--acc)">' + hechas + ' de ' + st.sets.length + ' series</b>';
  else meta = ex.lastTxt ? 'Última (' + ex.lastWhen + '): ' + ex.lastTxt : ex.min + '–' + ex.max + ' reps · primera vez';
  const ico = st.done ? ICO.check : esc(ABREV[ex.musculo] || ex.ejercicio.slice(0, 2));
  let h = '<div class="ex' + (abierto ? ' open' : '') + (st.done ? ' done' : '') + (enCurso ? ' prog' : '') + '">' +
    '<div class="ex-head" onclick="abrir(\'' + jsq(ex.name) + '\')"><div class="ex-ico">' + ico + '</div>' +
    '<div style="flex:1;min-width:0"><div class="ex-name">' + esc(ex.ejercicio) + '</div><div class="ex-meta">' + meta + '</div></div>' +
    (ex.up && !st.done ? '<span class="pill acc">' + ICO.up + 'Sube</span>' : '') + '</div>';
  if (st.done && OPEN === ex.name) {
    h += '<div class="ex-body"><div class="acts">' + (st.uid ? '<button class="btn ghost sm" onclick="deshacer(\'' + jsq(ex.name) + '\')">Deshacer</button>' : '') +
      '<button class="btn ghost sm" onclick="corregir(\'' + jsq(ex.name) + '\')">' + (st.uid ? 'Corregir' : 'Registrar otra vez') + '</button></div></div>';
  } else if (abierto) {
    h += '<div class="ex-body">' + cuerpoEjercicio(ex, st) + '</div>';
  }
  return h + '</div>';
}

function cuerpoEjercicio(ex, st) {
  const n = jsq(ex.name);
  let h = '<div class="row between" style="margin-bottom:10px"><div class="muted">' + esc(ex.howTo || '') + '</div>' +
    '<div class="unit">' + ['lb', 'kg'].map(u => '<button class="' + (st.unit === u ? 'on' : '') + '" onclick="setUnit(\'' + n + '\',\'' + u + '\')">' + u + '</button>').join('') + '</div></div>';
  if (ex.up) h += '<div class="tip acc">' + ICO.up + ex.hint.replace(/^⬆\s*/, '') + '</div>';
  else if (!ex.lastTxt) h += '<div class="tip">Elige un peso que te deje ' + ex.min + '–' + ex.max + ' reps con 1–2 de reserva</div>';
  h += '<div class="sets-h"><span></span><span style="text-align:center">' + st.unit + '</span><span style="text-align:center">reps</span><span></span></div>';
  st.sets.forEach((s, i) => {
    h += '<div class="set' + (s.ok ? ' hecho' : '') + '"><div class="n">' + (i + 1) + '</div>' +
      stepper(n, i, 'w', s.w, ex.step) + stepper(n, i, 'r', s.r, ex.max >= 30 ? 5 : 1) +
      '<button class="chk" onclick="marcar(\'' + n + '\',' + i + ')" aria-label="Serie hecha">' + ICO.check + '</button></div>';
  });
  h += '<div class="row" style="gap:8px;margin-top:2px">' +
    (st.sets.length < 4 ? '<button class="btn ghost sm" onclick="addSet(\'' + n + '\')">+ Serie</button>' : '') +
    (st.sets.length > 1 ? '<button class="btn ghost sm" onclick="delSet(\'' + n + '\')">− Serie</button>' : '') + '</div>';
  h += '<details class="more"' + (st.rir || st.notas ? ' open' : '') + '><summary>Cómo terminó y notas</summary><div class="pills">' +
    ['Al fallo', 'Casi (1–2 más)', 'Sobraban 3+'].map(v => '<button class="' + (st.rir === v ? 'on' : '') + '" onclick="setRir(\'' + n + '\',\'' + v + '\')">' + v + '</button>').join('') +
    '</div><textarea rows="2" placeholder="Notas (opcional)" onchange="setNotas(\'' + n + '\', this.value)">' + esc(st.notas) + '</textarea></details>';
  const hechas = st.sets.filter(s => s.ok).length;
  h += '<div class="acts"><button class="btn" onclick="guardar(\'' + n + '\')">' +
    (hechas && hechas < st.sets.length ? 'Guardar ' + hechas + ' series' : 'Guardar ejercicio') + '</button></div>';
  return h;
}

function stepper(n, i, f, v, step) {
  return '<div class="stp"><button onclick="bump(\'' + n + '\',' + i + ',\'' + f + '\',' + (-step) + ')">−</button>' +
    '<input class="num" type="number" inputmode="decimal" value="' + (v === null || v === undefined ? '' : v) + '" placeholder="' + (f === 'w' ? 'peso' : 'reps') +
    '" onchange="setVal(\'' + n + '\',' + i + ',\'' + f + '\',this.value)">' +
    '<button onclick="bump(\'' + n + '\',' + i + ',\'' + f + '\',' + step + ')">+</button></div>';
}

function elegirGrupo(g) { GRUPO = g; OPEN = ''; pintarEntrenar(); }
function abrir(name) {
  OPEN = OPEN === name ? '' : name;
  pintarEntrenar();
  if (OPEN) setTimeout(() => {
    const el = [...document.querySelectorAll('.ex.open, .ex.done')].find(e => e.querySelector('.ex-body'));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 30);
}
function cambio(name, redibujar) {
  const st = state[name]; st.edited = true; guardarWip(name);
  if (redibujar !== false) pintarEntrenar();
}
function bump(name, i, f, d) {
  const st = state[name], cur = Number(st.sets[i][f]) || 0;
  const nv = Math.max(0, Math.round((cur + d) * 100) / 100);
  if (f === 'w' && i === 0) copyS1(st, nv); else st.sets[i][f] = nv;
  cambio(name);
}
function setVal(name, i, f, v) {
  const st = state[name], nv = v === '' ? '' : Number(v);
  if (f === 'w' && i === 0) { copyS1(st, nv); cambio(name); } else { st.sets[i][f] = nv; cambio(name, false); }
}
// Al cambiar el peso de la serie 1, las series pendientes que tenían ese mismo peso lo copian.
function copyS1(st, nv) {
  const old = st.sets[0].w;
  st.sets.forEach((s, k) => { if (k === 0 || (!s.ok && (s.w === old || s.w === ''))) s.w = nv; });
}
function addSet(name) { const st = state[name], l = st.sets[st.sets.length - 1]; st.sets.push({ w: l.w, r: l.r, ok: false }); cambio(name); }
function delSet(name) { state[name].sets.pop(); cambio(name); }
function setRir(name, v) { const st = state[name]; st.rir = st.rir === v ? '' : v; cambio(name); }
function setNotas(name, v) { state[name].notas = v; cambio(name, false); }
function setUnit(name, u) { state[name].unit = u; cambio(name); }

function iniciarSesion() {
  const s = sesion();
  if (!s.start || s.ended) { s.start = Date.now(); s.ended = false; if (!s.log) s.log = []; guardarSesion(s); }
}

function marcar(name, i) {
  desbloquearAudio();
  const st = state[name], s = st.sets[i];
  if (!s.ok && (s.r === '' || s.r === null)) return toast('Pon las repeticiones de esta serie');
  if (!s.ok && (s.w === '' || s.w === null) && !/^Peso 0/.test(String(exDe(name).howTo))) return toast('Pon el peso de esta serie');
  s.ok = !s.ok;
  if (s.ok) { vibrar(15); iniciarSesion(); }
  cambio(name);
  if (s.ok) {
    if (st.sets.every(x => x.ok)) setTimeout(() => guardar(name, true), 450);
    else sugerirDescanso();
  }
}

function guardar(name, auto) {
  const st = state[name], ex = exDe(name);
  if (st.done) return;
  const marcadas = st.sets.filter(s => s.ok);
  const sets = (marcadas.length ? marcadas : st.sets).filter(s => s.r !== '' && s.r !== null)
    .map(s => ({ w: Number(s.w || 0), r: Number(s.r) }));
  if (!sets.length) return toast('Pon al menos las repeticiones de una serie');
  iniciarSesion();
  st.uid = uid(); st.done = true; st.edited = false; guardarWip(name);
  encolar('saveExercise', [{ name: name, unit: st.unit, sets: sets, rir: st.rir, notas: st.notas,
                              ts: Date.now(), uid: st.uid, day: hoy() }]);
  // ¿Récord? Comparamos la mejor serie de hoy contra tu mejor marca anterior
  const mejorHoy = Math.max.apply(null, sets.map(s => e1rm(s.w, s.r)));
  const pr = !!(ex.best && st.unit === ex.unit && mejorHoy > ex.best + 0.01);
  const ses = sesion();
  ses.log = ses.log.filter(l => l.name !== name);
  ses.log.push({ name: name, ej: ex.ejercicio, sets: sets, unit: st.unit, pr: pr, uid: st.uid });
  guardarSesion(ses);
  if (pr) { vibrar([40, 60, 40, 60, 120]); toast('¡Nuevo récord en ' + ex.ejercicio + '!', 'pr'); }
  else toast(navigator.onLine ? 'Guardado ✓' : 'Guardado en el celular; se sube cuando haya señal');
  // Abre el siguiente ejercicio pendiente del bloque recomendado
  const rec = ordenGrupo(ex.group)[0] || [];
  const sig = rec.find(e => !state[e.name].done && e.name !== name);
  OPEN = auto && sig && ex.group === GRUPO ? sig.name : '';
  pintarEntrenar();
  if (auto && sig) sugerirDescanso();
}

function quitarRegistro(name) {
  const st = state[name];
  const q = cola(), pend = q.find(op => op.action === 'saveExercise' && op.args[0].uid === st.uid);
  if (pend) guardarCola(q.filter(op => op !== pend));
  else if (st.uid) encolar('undoById', [st.uid]);
  const ses = sesion(); ses.log = ses.log.filter(l => l.name !== name); guardarSesion(ses);
  st.uid = ''; st.done = false; OPEN = name;
}
function deshacer(name) { quitarRegistro(name); state[name].sets.forEach(s => { s.ok = false; }); pintarEntrenar(); toast('Borrado'); }
function corregir(name) { quitarRegistro(name); state[name].sets.forEach(s => { s.ok = false; }); cambio(name); }

/* ----- Sesión ----- */
function tickSesion() {
  const el = $('sesT'), s = sesion();
  if (el && s.start) el.textContent = mmss((Date.now() - s.start) / 1000);
}
function terminarSesion() {
  const s = sesion();
  const series = s.log.reduce((a, l) => a + l.sets.length, 0);
  const vol = Math.round(s.log.reduce((a, l) => a + l.sets.reduce((b, x) => b + x.w * x.r * (l.unit === 'kg' ? 2.2046 : 1), 0), 0));
  const prs = s.log.filter(l => l.pr);
  let h = '<div class="t2">' + (s.log.length ? '¡Buena sesión!' : 'Sesión sin ejercicios') + '</div>' +
    '<div class="muted">' + DATA.today + '</div>' +
    '<div class="stats"><div><b class="num">' + mmss((Date.now() - s.start) / 1000) + '</b><span class="muted">duración</span></div>' +
    '<div><b class="num">' + s.log.length + '</b><span class="muted">ejercicios</span></div>' +
    '<div><b class="num">' + series + '</b><span class="muted">series</span></div></div>';
  if (vol) h += '<div class="muted" style="margin-bottom:10px">Volumen total: <b class="num" style="color:var(--text)">' + vol.toLocaleString('es-MX') + ' lb</b> (peso × reps; aproximado)</div>';
  if (prs.length) h += '<div class="card" style="background:var(--acc-weak);border-color:transparent">' + prs.map(l =>
    '<div class="row" style="color:var(--acc);font-weight:700;margin:4px 0">' + ICO.trophy + '<span>Récord en ' + esc(l.ej) + '</span></div>').join('') + '</div>';
  h += '<div class="acts"><button class="btn ghost" onclick="cerrarModal()">Seguir entrenando</button>' +
    '<button class="btn" onclick="cerrarSesion()">Terminar</button></div>';
  $('sheet').innerHTML = h; $('modal').classList.add('show');
}
function cerrarModal() { $('modal').classList.remove('show'); }
function cerrarSesion() { const s = sesion(); s.ended = true; guardarSesion(s); cerrarModal(); OPEN = ''; detenerRest(); pintarEntrenar(); toast('Sesión terminada. ¡A descansar!'); }

/* ----- Temporizador de descanso (opcional) ----- */
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
function sugerirDescanso() {
  if (LS.get('gym_rest', null) || TAB !== 'Entrenar') return;                       // ya hay uno corriendo
  if (LS.get('gym_rest_auto', false)) return iniciarRest(LS.get('gym_rest_def', 90));
  const def = LS.get('gym_rest_def', 90);
  const el = $('rest');
  el.className = 'rest show';
  el.innerHTML = '<div class="row between" style="margin-bottom:8px"><div class="row" style="gap:6px;font-weight:700">' + ICO.timer + 'Descanso</div>' +
    '<button class="rbtn" style="flex:none;padding:6px 10px" onclick="ocultarRest()">✕</button></div>' +
    '<div class="row" style="gap:6px">' + DESCANSOS.map(s => '<button class="rbtn" style="' + (s === def ? 'outline:2px solid var(--acc)' : '') + '" onclick="iniciarRest(' + s + ')">' + mmss(s) + '</button>').join('') + '</div>' +
    '<label class="switch" style="margin-top:8px"><input type="checkbox" onchange="setAuto(this.checked)"> Iniciar solo la próxima vez</label>';
  clearTimeout(sugTimer); sugTimer = setTimeout(() => { if (!LS.get('gym_rest', null)) ocultarRest(); }, 15000);
}
function setAuto(v) { LS.set('gym_rest_auto', v); toast(v ? 'El descanso arrancará solo' : 'Descanso manual'); }
function iniciarRest(seg) {
  desbloquearAudio();
  clearTimeout(sugTimer);
  LS.set('gym_rest_def', seg);
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
    if (!r.fired) { r.fired = true; LS.set('gym_rest', r); vibrar([300, 150, 300]); beep(); }
    el.className = 'rest show fin';
    el.innerHTML = '<div class="row between"><div><div class="big">¡Siguiente serie!</div><div style="font-size:13px">Descanso de ' + mmss(r.dur) + ' terminado</div></div>' +
      '<button class="rbtn" style="flex:none;padding:10px 14px" onclick="detenerRest()">OK</button></div>';
    if (left < -20) detenerRest();
    return;
  }
  el.className = 'rest show';
  el.innerHTML = '<div class="row between"><div class="row" style="gap:10px">' + ICO.timer + '<div><div class="big num">' + mmss(left) + '</div>' +
    '<div style="font-size:12px;opacity:.75">Descanso</div></div></div>' +
    '<div class="row" style="gap:6px"><button class="rbtn" style="padding:9px 12px" onclick="sumarRest(30)">+30 s</button>' +
    '<button class="rbtn" style="padding:9px 12px" onclick="detenerRest()">Omitir</button></div></div>' +
    '<div class="rbar"><div style="width:' + Math.max(0, Math.min(100, 100 - left / r.dur * 100)) + '%"></div></div>';
}

/* ----- Peso y cintura ----- */
function guardarPeso() {
  const v = $('peso').value;
  if (!v) return toast('Escribe tu peso');
  LS.set('gym_peso_' + hoy(), Number(v));
  encolar('savePeso', [Number(v), hoy()], 'peso-' + hoy());
  vibrar(15); toast('Peso guardado ✓'); pintarEntrenar();
}
function guardarCintura() {
  const v = $('cintura').value;
  if (!v) return toast('Escribe tu cintura');
  encolar('saveCintura', [Number(v), hoy()], 'cintura-' + hoy());
  vibrar(15); toast('Cintura guardada ✓');
}

/* ===================== COMIDA ===================== */
function protTotal() { return prot.reduce((s, k) => s + (FOODS.find(f => f.k === k) || { g: 0 }).g, 0); }
function pintarComida() {
  const tot = protTotal(), pct = Math.min(1, tot / META_PROT), falta = META_PROT - tot;
  const R = 74, C = 2 * Math.PI * R;
  const cuenta = LS.get('gym_food_counts', {});
  const top = FOODS.slice().sort((a, b) => (cuenta[b.k] || 0) - (cuenta[a.k] || 0)).slice(0, 3).filter(f => cuenta[f.k]);
  let h = '<div class="card" style="text-align:center"><div class="ring"><svg viewBox="0 0 170 170">' +
    '<circle cx="85" cy="85" r="' + R + '" fill="none" stroke="var(--card2)" stroke-width="14"/>' +
    '<circle cx="85" cy="85" r="' + R + '" fill="none" stroke="' + (tot >= META_PROT ? 'var(--ok)' : 'var(--pri)') + '" stroke-width="14" stroke-linecap="round" ' +
    'stroke-dasharray="' + C + '" stroke-dashoffset="' + (C * (1 - pct)) + '" style="transition:stroke-dashoffset .4s"/></svg>' +
    '<div><div class="v num">' + tot + ' g</div><div class="muted">de ' + META_PROT + ' g</div></div></div>' +
    '<div class="t1" style="margin-top:4px">' + (falta > 0 ? 'Te faltan ~' + falta + ' g' : '¡Meta cumplida!') + '</div>' +
    '<div class="muted">' + (falta > 0 ? 'Lo más barato: un scoop con agua (22 g)' : 'Bien hecho hoy') + '</div></div>';
  if (!prot.length) h += '<button class="btn block" style="margin-bottom:12px" onclick="diaTipico()">Mi día típico · +' +
    TIPICO.reduce((s, k) => s + FOODS.find(f => f.k === k).g, 0) + ' g</button>';
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
function diaTipico() { prot = prot.concat(TIPICO); cambiarProt(); }
function quitarProt(i) { prot.splice(i, 1); cambiarProt(); }

/* ===================== PROGRESO ===================== */
function fmt(v, signo) {
  if (v === null || v === undefined) return '—';
  const s = (Math.round(v * 10) / 10).toFixed(1);
  return signo && v > 0 ? '+' + s : s;
}
function pintarProgreso() {
  const r = DATA.resumen;
  const dias = ['L', 'M', 'M', 'J', 'V', 'S', 'D'], hoyIdx = (new Date().getDay() + 6) % 7;
  const ds = r.diasSemana || 0;
  let h = '<div class="card"><div class="row between"><div><div class="t2">' + ds + ' de ' + META_DIAS + ' días</div><div class="muted">esta semana</div></div>' +
    (r.racha ? '<span class="pill acc" style="font-size:13px;padding:6px 10px">' + ICO.flame + r.racha + ' semana' + (r.racha === 1 ? '' : 's') + ' seguidas</span>' : '') + '</div>' +
    '<div class="week">' + dias.map((d, i) => '<div class="' + ((r.semana || [])[i] ? 'y' : '') + (i === hoyIdx ? ' hoy' : '') + '"><i></i>' + d + '</div>').join('') + '</div>' +
    '<div class="muted" style="margin-top:8px">La racha cuenta semanas con 3 o más días de gym.</div></div>';

  if (r.subir && r.subir.length) {
    h += '<h2>Te toca subir peso</h2><div class="card">' + r.subir.map(s => '<div class="rec"><div class="medal">' + ICO.up + '</div><div style="flex:1">' +
      '<div class="t1" style="font-size:15px">' + esc(s.ej.split(': ').slice(1).join(': ')) + '</div><div class="muted">Próxima vez</div></div>' +
      '<b class="num" style="color:var(--acc)">' + s.peso + ' ' + s.unit + '</b></div>').join('') + '</div>';
  }
  if (r.records && r.records.length) {
    h += '<h2>Récords recientes</h2><div class="card">' + r.records.map(x => {
      const f = x.k.slice(8, 10) + '/' + x.k.slice(5, 7);
      return '<div class="rec"><div class="medal">' + ICO.trophy + '</div><div style="flex:1;min-width:0"><div class="t1" style="font-size:15px">' + esc(x.ej) + '</div>' +
        '<div class="muted num">' + x.w + ' ' + x.unit + ' × ' + x.r + ' · ' + f + '</div></div><b class="num up">+' + x.pct + '%</b></div>';
    }).join('') + '</div>';
  }
  const kpi = (v, l, d, good) => '<div class="kpi"><div class="v num">' + v + '</div><div class="l">' + l + '</div>' + (d ? '<div class="d' + (good ? ' good' : '') + '">' + d + '</div>' : '') + '</div>';
  h += '<h2>Números</h2><div class="kpis">' +
    kpi(fmt(r.promedio7), 'Peso promedio 7 días (kg)', r.cambioSemana !== null ? fmt(r.cambioSemana, true) + ' vs semana anterior' : '', r.cambioSemana !== null && r.cambioSemana <= 0) +
    kpi(fmt(r.cintura), 'Cintura (cm)', r.cambioCintura !== null ? fmt(r.cambioCintura, true) + ' desde el inicio' : '', r.cambioCintura !== null && r.cambioCintura < 0) +
    kpi(r.protProm7 !== null ? r.protProm7 + ' g' : '—', 'Proteína promedio', 'Meta: ' + META_PROT + ' g', r.protProm7 !== null && r.protProm7 >= META_PROT) +
    kpi(r.gymDias7, 'Días de gym (7 días)', 'Meta: ' + META_DIAS, r.gymDias7 >= META_DIAS) + '</div>';
  h += '<div class="card chart"><div class="t1">Peso, últimos 30 días</div>' + grafica(r.serie30) + '</div>';
  h += tarjetaMusculos(r.musculos || []);
  h += '<a class="btn ghost block" style="display:block;text-align:center;text-decoration:none;margin-top:6px" href="' + r.sheetUrl + '" target="_blank" rel="noopener">Abrir dashboard completo</a>';
  $('vProgreso').innerHTML = h;
}
function tarjetaMusculos(ms) {
  const con = ms.filter(x => x.series7 > 0 || x.pct !== null || x.ultimo).sort((a, b) => a.series7 - b.series7);
  const sin = ms.filter(x => !con.includes(x));
  let h = '<h2>Tus músculos</h2><div class="card"><div class="muted" style="margin-bottom:4px">Arriba, los que necesitan más trabajo esta semana. Meta: 10–20 series por músculo.</div>';
  con.forEach(x => {
    const pct = x.pct === null ? '<span class="muted">—</span>'
      : '<b class="num ' + (x.pct > 0 ? 'up' : x.pct < 0 ? 'down' : '') + '">' + (x.pct > 0 ? '+' : '') + x.pct.toFixed(1) + '% fuerza</b>';
    h += '<div class="mus"><div class="row between"><div class="t1" style="font-size:15px">' + esc(x.m) + '</div>' + pct + '</div>' +
      '<div class="mbar"><div class="' + (x.series7 >= 10 ? 'ok' : '') + '" style="width:' + Math.min(100, Math.round(x.series7 / 20 * 100)) + '%"></div></div>' +
      '<div class="row between muted" style="margin-top:4px"><span>' + x.series7 + ' series esta semana</span><span>' +
      (x.ultimo ? 'Última vez ' + x.ultimo : '') + '</span></div></div>';
  });
  if (!con.length) h += '<div class="muted" style="padding:8px 0">Aquí verás tu progreso cuando registres tus primeros entrenamientos.</div>';
  if (sin.length) h += '<div class="muted" style="padding-top:10px;border-top:1px solid var(--line)">Sin registros aún: ' + sin.map(x => x.m).join(', ') + '</div>';
  return h + '</div>';
}
function grafica(s) {
  if (!s || s.length < 2) return '<div class="muted" style="margin-top:8px">La gráfica aparece cuando tengas al menos 2 días de peso.</div>';
  const W = 340, H = 160, pl = 34, pr = 8, pt = 12, pb = 22;
  const prom = s.map((p, i) => { const v = s.slice(Math.max(0, i - 6), i + 1).map(x => x.v); return v.reduce((a, b) => a + b, 0) / v.length; });
  const vs = s.map(p => p.v);
  let mn = Math.min.apply(null, vs), mx = Math.max.apply(null, vs);
  if (mx - mn < 1) { mn -= 0.5; mx += 0.5; }
  const x = i => pl + (W - pl - pr) * (i / (s.length - 1));
  const y = v => pt + (H - pt - pb) * (1 - (v - mn) / (mx - mn));
  let g = '<svg viewBox="0 0 ' + W + ' ' + H + '">';
  [mn, (mn + mx) / 2, mx].forEach(v => {
    g += '<line class="grid" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>' +
      '<text class="ax" x="' + (pl - 5) + '" y="' + (y(v) + 3) + '" text-anchor="end">' + v.toFixed(1) + '</text>';
  });
  s.forEach((p, i) => { g += '<circle class="pt" cx="' + x(i) + '" cy="' + y(p.v) + '" r="3.2"/>'; });
  g += '<polyline class="avg" points="' + prom.map((v, i) => x(i) + ',' + y(v)).join(' ') + '"/>';
  g += '<text class="ax" x="' + pl + '" y="' + (H - 5) + '">' + s[0].d + '</text>' +
    '<text class="ax" x="' + (W - pr) + '" y="' + (H - 5) + '" text-anchor="end">' + s[s.length - 1].d + '</text></svg>';
  return g + '<div class="legend"><span><i></i>Promedio 7 días</span><span><i class="p"></i>Peso de cada día</span></div>';
}

arrancar();
