/* Gym Martin – app instalable.
 * Lee y escribe tu hoja de Google a través del script de Apps Script (la "API").
 * Todo lo que guardas se queda primero en el celular y se sube en cuanto hay señal.
 */

/* ---------- Almacenamiento local ---------- */
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};

let API = LS.get('gym_api', ''), KEY = LS.get('gym_key', '');
let DATA = null, GRUPO = null;
let state = {};        // por ejercicio: {unit, sets, rir, notas, uid, done, open}
let prot = [];         // lo que comiste hoy (claves de FOODS)
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
const META_PROT = 130;

/* ---------- Utilidades ---------- */
const $ = id => document.getElementById(id);
function pad(n) { return String(n).padStart(2, '0'); }
function hoy() { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function esc(s) { return String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2400);
}
function datosDeHoy() { return DATA && DATA.todayKey === hoy(); }

/* ---------- Comunicación con la API ---------- */
async function apiGet(action) {
  const r = await fetch(API + '?action=' + action + '&k=' + encodeURIComponent(KEY), { redirect: 'follow' });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'Error de la API');
  return j.result;
}
async function apiPost(action, args) {
  // text/plain evita la verificación previa de CORS que Apps Script no contesta
  const r = await fetch(API, {
    method: 'POST', redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ k: KEY, action: action, args: args })
  });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'Error de la API');
  return j.result;
}

/* ---------- Cola de cambios (funciona sin señal) ---------- */
function cola() { return LS.get('gym_queue', []); }
function guardarCola(q) { LS.set('gym_queue', q); pintarSync(); }
function encolar(action, args, tag) {
  let q = cola();
  if (tag) q = q.filter(op => op.tag !== tag);       // el último valor reemplaza al anterior
  q.push({ id: uid(), action: action, args: args, tag: tag || null });
  guardarCola(q);
  programarEnvio(1200);
}
function programarEnvio(ms) { clearTimeout(flushTimer); flushTimer = setTimeout(enviar, ms); }

async function enviar() {
  const q = cola();
  if (flushing || !q.length || !API) return;
  flushing = true; pintarSync();
  try {
    const res = await apiPost('batch', [q]);
    const listos = new Set();
    res.forEach(r => {
      listos.add(r.id);   // si falló por un dato (ej. fecha fuera de la hoja), no se reintenta
      if (!r.ok) toast('No se guardó: ' + r.error);
    });
    guardarCola(cola().filter(op => !listos.has(op.id)));
  } catch (e) {
    if (/Clave/.test(e.message)) toast('La clave no coincide; revisa la configuración');
    programarEnvio(20000);   // sin señal: se reintenta solo
  } finally {
    flushing = false; pintarSync();
  }
}

function pintarSync() {
  const n = cola().length, el = $('sync');
  if (!el) return;
  if (flushing) { el.className = 'sync'; el.textContent = 'Subiendo…'; }
  else if (n) { el.className = 'sync pend'; el.textContent = n + ' sin subir' + (navigator.onLine ? '' : ' · sin señal'); }
  else { el.className = 'sync ok'; el.textContent = '✓ Al día'; }
}

/* ---------- Arranque ---------- */
function arrancar() {
  // Configuración por link: ...?api=URL&k=CLAVE (se guarda y se limpia de la barra)
  const p = new URLSearchParams(location.search);
  if (p.get('api') && p.get('k')) {
    API = p.get('api').trim(); KEY = p.get('k').trim();
    LS.set('gym_api', API); LS.set('gym_key', KEY);
    history.replaceState(null, '', location.pathname);
    toast('App configurada ✓');
  }
  if ('serviceWorker' in navigator) {
    // Cuando hay versión nueva, el celular la baja y la app se recarga sola una vez
    const teniaVersion = !!navigator.serviceWorker.controller;
    let recargada = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (teniaVersion && !recargada) { recargada = true; location.reload(); }
    });
    navigator.serviceWorker.register('sw.js').then(reg => reg.update()).catch(() => {});
  }
  if (!API || !KEY) { $('loading').style.display = 'none'; $('setup').style.display = 'block'; return; }

  DATA = LS.get('gym_data', null);
  if (DATA) pintarTodo();
  actualizar();
  enviar();
  window.addEventListener('online', () => { pintarSync(); enviar(); actualizar(); });
  window.addEventListener('offline', pintarSync);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { enviar(); actualizar(); }
  });
  setInterval(enviar, 30000);
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
    if (!DATA) {
      $('loading').textContent = /Clave/.test(e.message)
        ? 'La clave no coincide. Vuelve a abrir el link de configuración.'
        : 'Necesitas internet la primera vez que abres la app.';
    }
  }
}

/* ---------- Pintar ---------- */
function pintarTodo() {
  const fresco = datosDeHoy();
  const pendientes = cola();
  const viejo = state;
  state = {};
  DATA.exercises.forEach(ex => {
    const rec = !!ex.bloque && ex.bloque === DATA.bloquePara[ex.group];
    const prev = viejo[ex.name];
    let done = fresco && ex.done, id = fresco ? (ex.uid || '') : '';
    // Lo que está en la cola manda sobre lo que dice la hoja
    pendientes.forEach(op => {
      if (op.action === 'saveExercise' && op.args[0].name === ex.name && op.args[0].day === hoy()) { done = true; id = op.args[0].uid; }
      if (op.action === 'undoById' && op.args[0] === id) { done = false; id = ''; }
    });
    // Si lo estabas editando, conserva tus cambios
    if (prev && !prev.done && !done && prev.edited) { state[ex.name] = prev; return; }
    state[ex.name] = {
      unit: ex.unit, sets: ex.sets.map(s => ({ w: s.w, r: s.r })), rir: '', notas: '',
      uid: id, done: done, open: prev ? prev.open : rec, edited: false
    };
  });
  if (!GRUPO) GRUPO = DATA.sugGrupo;

  $('fecha').textContent = (fresco ? DATA.today : 'Sin conexión') + ' · te toca ' + DATA.sugGrupo +
    ' (bloque ' + DATA.bloquePara[DATA.sugGrupo] + ' recomendado)';

  const pesoLocal = LS.get('gym_peso_' + hoy(), null);
  const pesoHoy = pesoLocal !== null ? pesoLocal : (fresco ? DATA.pesoHoy : null);
  if (document.activeElement !== $('peso')) $('peso').value = pesoHoy !== null ? pesoHoy : (DATA.ultimoPeso !== null ? DATA.ultimoPeso : '');
  $('pesoCard').classList.toggle('done', pesoHoy !== null);
  $('pesoInfo').textContent = DATA.promedio7 !== null
    ? 'Promedio 7 días: ' + DATA.promedio7 + ' kg (' + DATA.n7 + ' días)' : 'En ayunas, después del baño';
  $('cinturaRow').style.display = new Date().getDay() === 0 ? 'flex' : 'none';

  const protLocal = LS.get('gym_prot_' + hoy(), null);
  if (protLocal) prot = protLocal;
  else if (fresco && DATA.protHoy.detalle) prot = DATA.protHoy.detalle.split(', ').filter(k => FOODS.some(f => f.k === k));
  else prot = [];

  renderProt(); renderChips(); renderList(); pintarSync();
  if ($('vistaRes').style.display === 'block') renderResumen();
  $('loading').style.display = 'none'; $('app').style.display = 'block';
}

/* ---------- Proteína ---------- */
function protTotal() { return prot.reduce((s, k) => s + (FOODS.find(f => f.k === k) || { g: 0 }).g, 0); }
function renderProt() {
  const tot = protTotal(), pct = Math.min(100, Math.round(tot / META_PROT * 100)), falta = META_PROT - tot;
  let h = '<div class="row between"><div class="ex-title">Proteína de hoy</div>' +
    '<div style="font-weight:700">' + tot + ' / ' + META_PROT + ' g</div></div>' +
    '<div class="bar"><div style="width:' + pct + '%"></div></div>' +
    '<div class="muted">' + (falta > 0 ? 'Te faltan ~' + falta + ' g. Un scoop con agua son 22 g.' : 'Llegaste a la meta ✓') +
    ' Toca lo que vayas comiendo; son cantidades aproximadas.</div>';
  h += '<div class="foods">' + FOODS.map(f => {
    const c = prot.filter(k => k === f.k).length;
    return '<button onclick="addProt(\'' + f.k + '\')">' + (c ? '<span class="cnt">×' + c + '</span>' : '') +
      '<b>+' + f.g + ' g</b>' + esc(f.t) + '</button>';
  }).join('') + '</div>';
  h += '<div class="actions">' +
    (prot.length ? '<button class="ghost" onclick="quitarProt()">Quitar el último</button>'
      : '<button class="ghost" onclick="diaTipico()">Mi día típico (+' + TIPICO.reduce((s, k) => s + FOODS.find(f => f.k === k).g, 0) + ' g)</button>') +
    '</div>';
  $('protCard').innerHTML = h;
  $('protCard').classList.toggle('done', tot >= META_PROT);
}
function cambiarProt() {
  LS.set('gym_prot_' + hoy(), prot);
  renderProt();
  encolar('saveProteina', [protTotal(), prot.join(', '), hoy()], 'prot-' + hoy());
}
function addProt(k) { prot.push(k); cambiarProt(); }
function diaTipico() { prot = prot.concat(TIPICO); cambiarProt(); }
function quitarProt() { prot.pop(); cambiarProt(); }

/* ---------- Peso y cintura ---------- */
function guardarPeso() {
  const v = $('peso').value;
  if (!v) return toast('Escribe tu peso');
  LS.set('gym_peso_' + hoy(), Number(v));
  encolar('savePeso', [Number(v), hoy()], 'peso-' + hoy());
  $('pesoCard').classList.add('done'); toast('Peso guardado ✓');
}
function guardarCintura() {
  const v = $('cintura').value;
  if (!v) return toast('Escribe tu cintura');
  encolar('saveCintura', [Number(v), hoy()], 'cintura-' + hoy());
  toast('Cintura guardada ✓');
}

/* ---------- Entrenamiento ---------- */
function renderChips() {
  const c = $('chips'); c.innerHTML = '';
  DATA.chips.forEach(g => {
    const b = document.createElement('button');
    b.className = 'chip' + (g === GRUPO ? ' on' : '') + (g === DATA.sugGrupo ? ' sug' : '');
    b.textContent = g;
    b.onclick = () => { GRUPO = g; renderChips(); renderList(); };
    c.appendChild(b);
  });
}

function renderList() {
  const list = $('list'); list.innerHTML = '';
  const exs = DATA.exercises.filter(ex => ex.group === GRUPO);
  let secciones;
  if (GRUPO === 'Core') secciones = [['Elige 1 o 2 al final de cualquier día', exs]];
  else {
    const rec = DATA.bloquePara[GRUPO], otro = rec === 'A' ? 'B' : 'A';
    secciones = [
      ['Recomendado hoy · Bloque ' + rec, exs.filter(e => e.bloque === rec)],
      ['Bloque ' + otro, exs.filter(e => e.bloque === otro)],
      ['Más ejercicios de ' + GRUPO, exs.filter(e => e.bloque !== 'A' && e.bloque !== 'B')]
    ];
  }
  let i = 0;
  secciones.forEach(([titulo, items]) => {
    if (!items.length) return;
    const h = document.createElement('h2'); h.textContent = titulo; list.appendChild(h);
    items.forEach(ex => list.appendChild(card(ex, 'ex' + (i++))));
  });
  const nota = document.createElement('div');
  nota.className = 'muted'; nota.style.margin = '8px 2px';
  nota.textContent = 'Puedes mezclar ejercicios de cualquier bloque o grupo; toca uno para abrirlo.';
  list.appendChild(nota);
}

function card(ex, id) {
  const st = state[ex.name];
  const div = document.createElement('div');
  div.className = 'card' + (st.done ? ' done' : '');
  div.id = id; div.dataset.name = ex.name;
  const abierto = st.open && !st.done;
  let h = '<div class="row between ex-head" onclick="toggleOpen(\'' + id + '\')">' +
    '<div><div class="ex-title">' + esc(ex.ejercicio) + '</div>' +
    '<div class="muted">' + ex.min + '–' + ex.max + ' reps' +
    (ex.lastTxt ? ' · Última (' + ex.lastWhen + '): ' + ex.lastTxt : '') + '</div></div>' +
    '<div class="chev">' + (st.done ? '' : (abierto ? '▾' : '▸')) + '</div></div>';
  if (st.done) {
    h += '<div class="actions">' + (st.uid
      ? '<button class="ghost" onclick="deshacer(\'' + id + '\')">Deshacer</button><button class="ghost" onclick="corregir(\'' + id + '\')">Corregir</button>'
      : '<button class="ghost" onclick="corregir(\'' + id + '\')">Registrar otra vez</button>') + '</div>';
  } else if (abierto) {
    h += '<div class="row between" style="margin-top:6px"><div class="muted">' + esc(ex.howTo || '') + '</div>' +
      '<div class="unit">' + ['lb', 'kg'].map(u => '<button class="' + (st.unit === u ? 'on' : '') +
      '" onclick="setUnit(\'' + id + '\',\'' + u + '\')">' + u + '</button>').join('') + '</div></div>';
    h += '<div class="hint' + (ex.up ? ' up' : '') + '">' + esc(ex.hint) + '</div>';
    st.sets.forEach((s, k) => {
      h += '<div class="set"><div class="n">S' + (k + 1) + '</div>' + stepper(id, k, 'w', s.w, ex.step) +
        '<div class="x">×</div>' + stepper(id, k, 'r', s.r, ex.max >= 30 ? 5 : 1) + '</div>';
    });
    h += '<div class="muted" style="margin-top:6px">¿Cambiaste de peso en alguna serie? Ajusta solo esa.</div>';
    h += '<div class="actions" style="margin-top:8px">' +
      (st.sets.length < 4 ? '<button class="ghost" onclick="addSet(\'' + id + '\')">+ serie</button>' : '') +
      (st.sets.length > 1 ? '<button class="ghost" onclick="delSet(\'' + id + '\')">− serie</button>' : '') + '</div>';
    h += '<div class="muted" style="margin-top:10px">Opcional: ¿cómo terminó tu última serie?</div><div class="pills">' +
      ['Al fallo', 'Casi (1–2 más)', 'Sobraban 3+'].map(v => '<button class="' + (st.rir === v ? 'on' : '') +
        '" onclick="setRir(\'' + id + '\',\'' + v + '\')">' + v + '</button>').join('') + '</div>';
    h += '<details><summary>Notas</summary><textarea rows="2" oninput="setNotas(\'' + id + '\', this.value)">' +
      esc(st.notas) + '</textarea></details>';
    h += '<div class="actions"><button class="save" onclick="guardar(\'' + id + '\')">Guardar ✓</button></div>';
  }
  div.innerHTML = h;
  return div;
}

function stepper(id, i, f, v, step) {
  return '<div class="stepper"><button onclick="bump(\'' + id + '\',' + i + ',\'' + f + '\',' + (-step) + ')">−</button>' +
    '<input type="number" inputmode="decimal" value="' + (v === null ? '' : v) + '" placeholder="' + (f === 'w' ? 'peso' : 'reps') +
    '" onchange="setVal(\'' + id + '\',' + i + ',\'' + f + '\',this.value)">' +
    '<button onclick="bump(\'' + id + '\',' + i + ',\'' + f + '\',' + step + ')">+</button></div>';
}

function nameOf(id) { return $(id).dataset.name; }
function stOf(id) { return state[nameOf(id)]; }
function redraw(id) {
  const old = $(id), ex = DATA.exercises.find(e => e.name === old.dataset.name);
  old.replaceWith(card(ex, id));
}
function toggleOpen(id) { const st = stOf(id); if (st.done) return; st.open = !st.open; redraw(id); }
function bump(id, i, f, d) {
  const st = stOf(id), cur = Number(st.sets[i][f]) || 0;
  const nv = Math.max(0, Math.round((cur + d) * 100) / 100);
  if (f === 'w' && i === 0) copyS1(st, nv); else st.sets[i][f] = nv;
  st.edited = true; redraw(id);
}
function setVal(id, i, f, v) {
  const st = stOf(id), nv = v === '' ? '' : Number(v);
  st.edited = true;
  if (f === 'w' && i === 0) { copyS1(st, nv); redraw(id); } else st.sets[i][f] = nv;
}
// Al cambiar el peso de la serie 1, las series que tenían ese mismo peso lo copian.
function copyS1(st, nv) {
  const old = st.sets[0].w;
  st.sets.forEach((s, k) => { if (k === 0 || s.w === old || s.w === '') s.w = nv; });
}
function addSet(id) { const st = stOf(id), l = st.sets[st.sets.length - 1]; st.sets.push({ w: l.w, r: l.r }); st.edited = true; redraw(id); }
function delSet(id) { const st = stOf(id); st.sets.pop(); st.edited = true; redraw(id); }
function setRir(id, v) { const st = stOf(id); st.rir = st.rir === v ? '' : v; st.edited = true; redraw(id); }
function setNotas(id, v) { const st = stOf(id); st.notas = v; st.edited = true; }
function setUnit(id, u) { const st = stOf(id); st.unit = u; st.edited = true; redraw(id); }

function guardar(id) {
  const name = nameOf(id), st = state[name];
  const sets = st.sets.filter(s => s.r !== '' && s.r !== null);
  if (!sets.length) return toast('Pon al menos las reps de una serie');
  st.uid = uid(); st.done = true; st.edited = false;
  encolar('saveExercise', [{ name: name, unit: st.unit, sets: sets, rir: st.rir, notas: st.notas,
                              ts: Date.now(), uid: st.uid, day: hoy() }]);
  redraw(id);
  toast(navigator.onLine ? 'Guardado ✓' : 'Guardado en el celular; se sube cuando haya señal');
}
function quitarRegistro(st) {
  const q = cola(), pend = q.find(op => op.action === 'saveExercise' && op.args[0].uid === st.uid);
  if (pend) guardarCola(q.filter(op => op !== pend));           // aún no se subía: se borra aquí
  else if (st.uid) encolar('undoById', [st.uid]);              // ya estaba en la hoja: se borra allá
  st.uid = ''; st.done = false; st.open = true;
}
function deshacer(id) { quitarRegistro(stOf(id)); redraw(id); toast('Borrado'); }
function corregir(id) { quitarRegistro(stOf(id)); stOf(id).edited = true; redraw(id); }

/* ---------- Resumen ---------- */
function verTab(t) {
  $('vistaReg').style.display = t === 'reg' ? 'block' : 'none';
  $('vistaRes').style.display = t === 'res' ? 'block' : 'none';
  $('tabReg').className = t === 'reg' ? 'on' : '';
  $('tabRes').className = t === 'res' ? 'on' : '';
  if (t === 'res') { renderResumen(); enviar().then(actualizar); }
}
function fmt(v, signo) {
  if (v === null || v === undefined) return '—';
  const s = (Math.round(v * 10) / 10).toFixed(1);
  return signo && v > 0 ? '+' + s : s;
}
function renderResumen() {
  const r = DATA.resumen;
  const kpi = (v, l, d, good) => '<div class="kpi"><div class="v">' + v + '</div><div class="l">' + l + '</div>' +
    (d ? '<div class="d' + (good ? ' good' : '') + '">' + d + '</div>' : '') + '</div>';
  let h = '<div class="kpis">' +
    kpi(fmt(r.promedio7), 'Peso promedio 7 días (kg)',
      r.cambioSemana !== null ? fmt(r.cambioSemana, true) + ' kg vs semana anterior' : '', r.cambioSemana !== null && r.cambioSemana <= 0) +
    kpi(fmt(r.cintura), 'Cintura (cm)',
      r.cambioCintura !== null ? fmt(r.cambioCintura, true) + ' cm desde el inicio' : '', r.cambioCintura !== null && r.cambioCintura < 0) +
    kpi(r.gymDias7, 'Días de gym (7 días)', r.gymDias7 >= 4 ? 'Meta cumplida' : 'Meta: 4', r.gymDias7 >= 4) +
    kpi(r.protProm7 !== null ? r.protProm7 + ' g' : '—', 'Proteína promedio (7 días)',
      'Meta: ' + META_PROT + ' g', r.protProm7 !== null && r.protProm7 >= META_PROT) +
    '</div>';
  h += '<div class="card chart"><div class="ex-title">Peso, últimos 30 días</div>' + grafica(r.serie30) + '</div>';
  if (r.musculos) h += tarjetaMusculos(r.musculos);
  h += '<div class="card"><div class="ex-title">Te toca subir peso</div>';
  h += r.subir.length
    ? r.subir.map(s => '<div class="row between" style="margin-top:8px"><div>' + esc(s.ej) +
      '</div><div style="font-weight:600;white-space:nowrap">' + s.peso + ' ' + s.unit + '</div></div>').join('')
    : '<div class="muted" style="margin-top:6px">Nada por ahora: sigue sumando repeticiones.</div>';
  h += '</div><a class="save link" href="' + r.sheetUrl + '" target="_blank" rel="noopener">Abrir dashboard completo</a>';
  $('vistaRes').innerHTML = h;
}
// Por músculo: cuánto ha subido tu fuerza desde que empezaste y cuántas series hiciste esta semana
function tarjetaMusculos(ms) {
  let h = '<div class="card"><div class="ex-title">Tus músculos</div>' +
    '<div class="muted">Fuerza: cambio desde tu primera vez en cada ejercicio (aprox.). ' +
    'Series: lo que hiciste en 7 días; la meta es 10–20 por músculo.</div>';
  ms.forEach(x => {
    const pct = x.pct === null ? '<span class="pct">—</span>'
      : '<span class="pct ' + (x.pct > 0 ? 'up' : x.pct < 0 ? 'down' : '') + '">' + (x.pct > 0 ? '+' : '') + x.pct.toFixed(1) + '%</span>';
    const ancho = Math.min(100, Math.round(x.series7 / 20 * 100));
    h += '<div class="mus"><div class="row between"><div class="ex-title" style="font-size:15px">' + esc(x.m) + '</div>' + pct + '</div>' +
      '<div class="mbar"><div class="' + (x.series7 >= 10 ? 'ok' : '') + '" style="width:' + ancho + '%"></div></div>' +
      '<div class="row between muted" style="margin-top:3px"><span>' + x.series7 + ' series esta semana</span><span>' +
      (x.pct === null ? (x.ultimo ? 'Última vez ' + x.ultimo : 'Sin registros aún') : x.n + ' ejercicio' + (x.n > 1 ? 's' : '')) +
      '</span></div></div>';
  });
  return h + '</div>';
}

function grafica(s) {
  if (!s || s.length < 2) return '<div class="muted" style="margin-top:8px">La gráfica aparece cuando tengas al menos 2 días de peso.</div>';
  const W = 340, H = 150, pl = 34, pr = 8, pt = 10, pb = 22;
  const vs = s.map(p => p.v);
  let mn = Math.min.apply(null, vs), mx = Math.max.apply(null, vs);
  if (mx - mn < 1) { mn -= 0.5; mx += 0.5; }
  const x = i => pl + (W - pl - pr) * (i / (s.length - 1));
  const y = v => pt + (H - pt - pb) * (1 - (v - mn) / (mx - mn));
  let g = '<svg viewBox="0 0 ' + W + ' ' + H + '">';
  [mn, (mn + mx) / 2, mx].forEach(v => {
    g += '<line class="grid" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>' +
      '<text class="axis" x="' + (pl - 4) + '" y="' + (y(v) + 3) + '" text-anchor="end">' + v.toFixed(1) + '</text>';
  });
  g += '<polyline class="ln" points="' + s.map((p, i) => x(i) + ',' + y(p.v)).join(' ') + '"/>';
  s.forEach((p, i) => { g += '<circle class="pt" cx="' + x(i) + '" cy="' + y(p.v) + '" r="2.5"/>'; });
  g += '<text class="axis" x="' + pl + '" y="' + (H - 6) + '">' + s[0].d + '</text>' +
    '<text class="axis" x="' + (W - pr) + '" y="' + (H - 6) + '" text-anchor="end">' + s[s.length - 1].d + '</text></svg>';
  return g;
}

arrancar();
