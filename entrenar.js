// Entrenar: pareja, pantalla de hoy, peso y cintura, tarjeta del ejercicio, foto de tu máquina, animación y técnica
// (Parte de la app: se carga después de app.js; ver el orden en index.html)

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
    (p !== null ? ' <button class="link pesohdr" ' + on('corregirPesoHoy', p) + ' aria-label="Corregir peso de hoy">' + p + ' kg</button>' : '');
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
// Lo que trabaja cada día, en palabras de todos
const QUE_TRABAJA = { Push: 'pecho, hombros y tríceps', Pull: 'espalda y bíceps', Legs: 'piernas y glúteos', Core: 'abdomen y zona media' };
function tarjetaHoy() {
  const secs = ordenGrupo(GRUPO), todos = secs.flat(), hechosL = todos.filter(e => cardDone(e.name));
  // Lo planeado: la primera sección (tu ruta o el bloque recomendado) más lo que ya hiciste de otras
  const total = Math.max(1, new Set((secs[0] || []).map(e => e.name).concat(hechosL.map(e => e.name))).size), hechos = hechosL.length;
  const clave = hoy() + GRUPO, antes = DISCOS_VISTOS[clave] === undefined ? hechos : Math.min(DISCOS_VISTOS[clave], hechos);
  DISCOS_VISTOS[clave] = hechos;
  const lado = hechos ? '<strong>' + hechos + ' de ' + total + '</strong>' + (hechos >= total ? 'completo' : 'hechos')
    : '<strong>' + total + ' ejercicio' + (total === 1 ? '' : 's') + '</strong>' + (QUE_TRABAJA[GRUPO] || 'para hoy');
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
  add({ et: 'Peso', val: p !== null ? '<b>' + p + '</b> kg' : 'Pesarte', ojo: p === null, fn: p !== null ? on('corregirPesoHoy', p) : on('pesarseAhora') });
  const tot = protTotal(cargarProt(hoy())), meta = metaProt(), p6 = activa ? '' : tarjetaProt6();
  add({ et: 'Proteína', val: '<b>' + tot + '</b>/' + meta + ' g', pct: tot / meta, ojo: !!p6, html: p6, fn: p6 ? '' : on('verTab', 'Comida') });
  const sal = LS.get('gym_salud', null), x = sal && (sal.pasos || []).find(q => q.k === hoy());
  if (x) { const pa = tarjetaPasos(); add({ et: 'Pasos', val: '<b>' + x.v.toLocaleString('es-MX') + '</b>', pct: x.v / META_PASOS(), ojo: !!pa, html: pa, fn: pa ? '' : on('verTab', 'Progreso') }); }
  if (new Date().getDay() === 0 && !activa) add({ et: 'Cintura', val: 'Medir', ojo: true, html: tarjetaCintura() });
  if (!activa) add({ et: 'Comida de ayer', val: 'Anotar', html: tarjetaAyer() });
  add({ et: 'Aviso de pasos', val: 'Permiso', ojo: true, html: tarjetaPermisoFondo() });
  if (conDescarga && !activa) add({ et: 'Recuperación', val: 'Descarga', ojo: true, html: tarjetaDescarga() });
  if (sencillo() && !activa) return hoyTeToca(p, tot, meta);
  return '<div class="mosaicos">' + PEND.map((t, i) => '<button class="' + (t.ojo ? 'ojo' : '') + '" ' + (t.html ? on('abrirPendiente', i) : t.fn) + '>' +
    '<span class="et">' + t.et + '</span><span class="v num">' + t.val + '</span>' +
    (t.pct !== undefined ? '<i style="--p:' + Math.min(100, Math.round(t.pct * 100)) + '%"></i>' : '') + '</button>').join('') + '</div>';
}
// Modo sencillo: tu día en 3 pasos en orden (pesarte, entrenar, comida); el que sigue va resaltado
function hoyTeToca(p, tot, meta) {
  const g = GRUPO && GRUPO !== 'Trote' ? GRUPO : DATA.sugGrupo, recs = g && g !== 'Trote' ? recomendadosHoy(g) : [];
  const hechos = recs.filter(e => state[e.name] && state[e.name].done).length;
  const pasos = [
    { ok: p !== null, t: 'Pesarte', s: p !== null ? p + ' kg · listo' : 'En ayunas, después del baño: toca aquí', fn: p !== null ? on('corregirPesoHoy', p) : on('pesarseAhora') },
    { ok: recs.length > 0 && hechos === recs.length, t: g === 'Trote' ? 'Salir a correr' : 'Entrenar ' + (NOMBRE_GRUPO[g] || g || '').toLowerCase(),
      s: !recs.length ? 'Toca para ver tu plan' : hechos === recs.length ? 'Listo por hoy 💪' : hechos ? hechos + ' de ' + recs.length + ' ejercicios · toca para seguir' : recs.length + ' ejercicios · toca para empezar',
      fn: on('empezarHoy') },
    { ok: tot >= meta, t: 'Anotar lo que comes', s: 'Llevas ' + tot + ' de ' + meta + ' g de proteína', fn: on('verTab', 'Comida') }
  ];
  const sig = pasos.findIndex(x => !x.ok);
  return '<div class="hoytoca"><div class="t2">Hoy te toca</div><ol>' + pasos.map((x, i) => '<li class="' + (x.ok ? 'ok' : i === sig ? 'ya' : '') + '"><button ' + x.fn + '>' +
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
  $('sheet').innerHTML = '<button class="cerrar" style="float:right;margin:0 0 8px 12px" ' + on('cerrarModal') + ' aria-label="Cerrar">✕</button><div class="pendiente">' + x.html + '</div>';
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
      '<button class="btn" ' + on('terminarSesion') + '>Terminar</button></div>';
    h += chipsVolumen();
  }
  if (FECHA) h += '<div class="otro">' + ICO.cal + '<span>Registrando para el ' + diaCorto(FECHA) + '</span><button class="btn" ' + on('cambiarFecha', null) + '>Volver a hoy</button></div>';
  h += avisoErrores();
  if (!FECHA && DATA.descargaCarrera) h += '<div class="aviso">' + ICO.flame + '<span>Semana de carrera: descarga. Mitad de series con el mismo peso (ya viene así). Legs a más tardar el lunes; el viernes descansas.</span></div>';
  else if (!FECHA && descargaActiva()) h += '<div class="aviso">' + ICO.flame + '<span>Descarga adelantada hasta el ' + diaCorto(LS.get('gym_descarga', {}).hasta) +
    ': mitad de series y ~10 % menos carga que la vez pasada, sin llegar al fallo. <button class="link" ' + on('terminarDescarga') + '>Terminarla</button></span></div>';
  if (!FECHA && !activa) h += tarjetaPostCarrera();   // una decisión: se queda a la vista
  if (!FECHA && GRUPO && GRUPO !== 'Trote') h += tarjetaHoy();
  h += pendientesHoy(activa, !FECHA && !DATA.descargaCarrera && !descargaActiva());
  const diasSin = DATA.ultimoGrupoFecha ? difDias(DATA.ultimoGrupoFecha, hoy()) - 1 : 0;
  if (!FECHA && !activa && diasSin >= 3 && !sesion().log.length)
    h += '<div class="aviso">' + ICO.flame + '<span>Llevas ' + diasSin + ' días sin ir. Hoy toca ' + esc(DATA.sugGrupo) + ': aunque sean 30 minutos, cuenta.</span></div>';
  if (FECHA && pesoDe(FECHA) === null) h += tarjetaPeso();   // otro día: el peso de ese día, a la vista
  // El buscador se abre con la lupa de la fila de grupos (casi siempre sigues tu rutina: no ocupa una fila diario)
  if (BUSCA_ABIERTA || BUSCA) h += '<div class="buscarfila"><input class="buscar" id="buscar" type="search" placeholder="Buscar ejercicio…" value="' + esc(BUSCA) + '" ' + ev('input', 'buscar', VALOR) + '>' +
    '<button class="link" ' + on('cerrarBuscar') + '>Cancelar</button></div>';
  const corte = h.length;   // de aquí para abajo es lo que cambia al buscar
  if (BUSCA) {
    const q = BUSCA.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const res = DATA.exercises.filter(ex => (ex.ejercicio + ' ' + ex.musculo).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q));
    h += '<h2>' + res.length + ' resultado' + (res.length === 1 ? '' : 's') + '</h2>' + res.map(tarjetaEjercicio).join('');
    if (DATA.ia) h += '<button class="musbtn" ' + on('abrirMaquina') + '>📷 ¿No aparece? Tómale foto a la máquina <span>Te digo qué ejercicio es y lo agrego a tu catálogo</span></button>';
    return ponerEntrenar(h, corte);
  }
  const comp = parejaDisponible();
  if (comp && !FECHA) h += '<button class="parbtn' + (parejaHoy() ? ' on' : '') + '" ' + on('alternarPareja') + '><span>👥 ' +
    (parejaHoy() ? 'Entrenando con ' + esc(comp.nombre) + (PAR && !PAR.exs ? ' · cargando…' : '') : '¿Entrenas con ' + esc(comp.nombre) + ' hoy?') + '</span><span class="sw"></span></button>';
  h += '<div class="chips">' + (BUSCA_ABIERTA ? '' : '<button class="chip lupa" ' + on('abrirBuscar') + ' aria-label="Buscar ejercicio">' + ICO_LUPA + '</button>') + DATA.chips.concat(['Trote']).map(g => '<button class="chip r-' + g + (g === GRUPO ? ' on' : '') + '" ' + on('elegirGrupo', String(g)) + '>' +
    (g === 'Trote' ? ICO.flame : '') + '<span class="cht"><span>' + g + (g === DATA.sugGrupo ? '<span class="dot"></span>' : '') + '</span>' +
    (NOMBRE_GRUPO[g] ? '<small>' + NOMBRE_GRUPO[g] + '</small>' : '') + '</span></button>').join('') + '</div>';
  if (GRUPO === 'Trote') return ponerEntrenar(h + vistaTrote() + pieFecha(), corte);
  h += tarjetaFoco();
  h += tarjetaRuta();
  const hechos = ordenGrupo(GRUPO).flat().filter(e => cardDone(e.name));
  if (hechos.length) h += '<details class="sec hechos"' + (PLEG['hechos' + GRUPO] || hechos.some(e => e.name === OPEN) ? ' open' : '') +
    ' ' + ev('toggle', 'plegar', 'hechos' + GRUPO, ABIERTO) + '><summary>✓ Ejercicios hechos hoy · ' + hechos.length + '</summary>' + hechos.map(tarjetaEjercicio).join('') + '</details>';
  // Lo que estás haciendo (tú o tu compañero) sube aquí y se queda abierto: no tienes que buscarlo
  const ahora = ordenGrupo(GRUPO).flat().filter(e => !cardDone(e.name) && enMarcha(e.name));
  if (ahora.length) h += '<h2>Ahora</h2>' + ahora.map(tarjetaEjercicio).join('');
  const secs = ordenGrupo(GRUPO).map(items => items.filter(e => !cardDone(e.name) && !ahora.includes(e)));
  if (hechos.length && !ahora.length && !secs.some(x => x.length)) h += '<div class="tip">' + ICO.check + ' Terminaste todo ' + esc(GRUPO) + '. Toca «Terminar» arriba para ver tu resumen.</div>';
  const acep = rutaAceptada(GRUPO), hR = acep ? acep.filter(x => cardDone(x.name)).length : 0;
  const titulos = (acep ? ['<span>🧭 Tu ruta de hoy: ' + hR + ' de ' + acep.length + '</span><button class="link" ' + on('quitarRuta') + '>Quitar</button>'] : []).concat(GRUPO === 'Core' ? ['Elige 1 o 2 al final de cualquier día']
    : ['Recomendados para hoy', 'Otros ejercicios del plan', 'Más ejercicios']);
  let primera = true;
  secs.forEach((items, i) => {
    if (!items.length) return;
    // La primera sección con ejercicios va abierta; las demás plegadas salvo que tengan algo en curso o las abras
    const activa2 = items.some(e => e.name === OPEN || state[e.name].done || state[e.name].sets.some(s => s.ok));
    const abierta = primera || activa2 || PLEG[GRUPO + i];
    // La que sigue lleva "Empezar" (solo si no hay nada en curso ni abierto; en modo sencillo ya está "Hoy te toca")
    if (primera) { SIG_NAME = !ahora.length && !OPEN && !sencillo() && !FECHA ? items[0].name : null;
      h += '<h2' + (acep && i === 0 ? ' class="conboton"' : '') + '>' + titulos[i] + '</h2>' + items.map(tarjetaEjercicio).join(''); SIG_NAME = null; }
    else h += '<details class="sec"' + (abierta ? ' open' : '') + ' ' + ev('toggle', 'plegar', GRUPO + i, ABIERTO) + '><summary>' + titulos[i] + ' · ' + items.length + '</summary>' +
      items.map(tarjetaEjercicio).join('') + '</details>';
    primera = false;
  });
  if (!FECHA && DATA.exercises.some(e => (e.zonas || []).length)) h += '<button class="musbtn" ' + on('elegirMusculo') + '>🎯 ¿Quieres trabajar un músculo? <span>Te digo qué hacer hoy</span></button>';
  ponerEntrenar(h + pieFecha(), corte);
  ANIM_ABRE = ANIM_SET = ANIM_IA = null; ANIM_PLAN = false;
  if (!planHoy() && !PLAN_CARGANDO) setTimeout(pedirPlan, 0);
}
function pieFecha() {
  return FECHA ? '' : '<div style="text-align:center;margin:18px 0 4px"><button class="link" ' + on('elegirFecha') + '>' + ICO.cal.replace('class="icon"', 'class="icon" style="width:16px;height:16px;vertical-align:-3px"') + ' ¿Se te olvidó registrar otro día?</button></div>';
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
    '<div class="acts" style="margin-top:0"><button class="btn ghost" ' + on('cambiarFecha', String(ayer)) + '>Ayer · ' + diaCorto(ayer) + '</button>' +
    '<button class="btn ghost" ' + on('cambiarFecha', String(antier)) + '>' + diaCorto(antier) + '</button></div>' +
    '<input type="date" id="fechaOtra" max="' + ayer + '" min="' + sumarDias(hoy(), -60) + '" value="' + sumarDias(hoy(), -3) + '">' +
    '<div class="acts"><button class="btn ghost" ' + on('cerrarModal') + '>Cancelar</button><button class="btn" ' + on('usarFechaOtra') + '>Usar esta fecha</button></div>';
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
    '<button class="pesobtn num' + (PESO_TMP === '' ? ' vacio' : '') + '" ' + on('tecladoPeso') + '>' + (PESO_TMP === '' ? 'Pesar' : PESO_TMP) + '</button>' +
    '<button class="okmark" ' + on(PESO_TMP === '' ? 'tecladoPeso' : 'guardarPeso') + ' aria-label="Guardar peso">' + ICO.check + '</button></div></div>';
}
function tarjetaCintura() {
  if (LS.get('gym_cint_' + hoy(), null) !== null) return '';
  const ult = DATA.cuerpo && DATA.cuerpo.serie && DATA.cuerpo.serie[DATA.cuerpo.serie.length - 1];
  if (ult && ult.cint !== null && ult.d === ddmm(hoy())) return '';      // ya está en la hoja (desde otro celular o desde el chat)
  const ant = cinturaAnterior();
  return '<div class="card"><div class="peso"><div class="lbl"><div class="t1">Cintura del domingo</div><div class="muted">' + (ant !== null ? 'La vez pasada: <b class="num">' + ant + '</b> cm' : 'Una vez por semana') + '</div></div>' +
    '<input id="cintura" class="in num" type="number" inputmode="decimal" step="0.5" placeholder="cm" value="' + esc(BORR.cintura || '') + '" ' + ev('input', 'borrador', 'cintura', VALOR) + '>' +
    '<button class="okmark" ' + on('guardarCintura') + ' aria-label="Guardar cintura">' + ICO.check + '</button></div>' +
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
      '<div class="acts"><button class="btn ghost" ' + on('medirCinturaOtraVez') + '>Medir otra vez</button>' +
      '<button class="btn" ' + on('confirmarCintura', Number(v)) + '>Sí, guardar ' + v + '</button></div>';
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
let SIG_NAME = null;   // la tarjeta que sigue en la lista (solo mientras se pinta la lista)
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
  let h = '<div class="ex' + (abierto ? ' open' : '') + (st.done ? ' done' : '') + (enCurso ? ' prog' : '') + (SIG_NAME === ex.name ? ' sig' : '') + '" id="ex-' + esc(ex.name) + '" style="view-transition-name:ex' + DATA.exercises.indexOf(ex) + '">' +
    (SIG_NAME === ex.name && !abierto ? '<div class="sigtxt">Siguiente</div>' : '') +
    '<div class="ex-head" ' + on('abrir', ex.name) + '><div class="ex-ico">' + ico + '</div>' +
    '<div style="flex:1;min-width:0"><div class="ex-name">' + esc(ex.ejercicio) + botonTecnica(ex) + (par && !st.done ? '<span class="sstag">Alternado</span>' : '') + '</div><div class="ex-meta">' + (ex.up && !st.done && (FECHA || esPar(ex.name) || !descargaActiva()) ? '<span class="pill acc sube">' + ICO.up + 'Sube peso</span>' : '') + badgeMod(ex) + meta + '</div></div>' +
    (SIG_NAME === ex.name && !abierto && !st.done ? '<button class="btn sm empezar" ' + on('abrir', ex.name) + '>Empezar</button>' : '') +
    (abierto ? '<button class="swapbtn" ' + on('elegirCambio', ex.name) + ' aria-label="Máquina ocupada: cambiar ejercicio">⇄</button>' +
      '<button class="menubtn" ' + on('menuEjercicio', ex.name) + ' aria-label="Más opciones">⋮</button>' : '') + '</div>';
  if (st.done && OPEN === ex.name) {
    h += '<div class="ex-body"><div class="acts">' + (st.uid ? '<button class="btn ghost sm" ' + on('deshacer', ex.name) + '>Borrar</button>' : '') +
      '<button class="btn ghost sm" ' + on('corregir', ex.name) + '>' + (st.uid ? 'Corregir' : 'Registrar otra vez') + '</button></div></div>';
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
// Van en IndexedDB (cientos de MB disponibles), no en localStorage (~5 MB para todo); en memoria para pintar al instante
const IDB = (() => {
  let db = null;
  const abrir = () => db || (db = new Promise((ok, no) => {
    const r = indexedDB.open('gym', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('fotos');
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  }));
  const tx = (modo, f) => abrir().then(d => new Promise((ok, no) => { const t = d.transaction('fotos', modo); f(t.objectStore('fotos')); t.oncomplete = () => ok(); t.onerror = () => no(t.error); }));
  return {
    todas: () => abrir().then(d => new Promise((ok, no) => {
      const out = {}, c = d.transaction('fotos').objectStore('fotos').openCursor();
      c.onsuccess = () => { const x = c.result; if (x) { out[x.key] = x.value; x.continue(); } else ok(out); };
      c.onerror = () => no(c.error);
    })),
    poner: (k, v) => tx('readwrite', st => st.put(v, k)),
    quitar: k => tx('readwrite', st => st.delete(k))
  };
})();
let FOTOS_MAQ = {}, FOTOS_IDB = false;
const fotoMaqDe = name => FOTOS_MAQ[name] || null;
// Al abrir: lee las fotos y pasa a IndexedDB las que la v8.6 guardó en localStorage
function cargarFotosMaq() {
  const viejas = LS.get('gym_fotomaq', null);
  if (viejas) FOTOS_MAQ = Object.assign({}, viejas);
  if (!window.indexedDB) return;
  IDB.todas().then(m => {
    FOTOS_IDB = true;
    FOTOS_MAQ = Object.assign(m, FOTOS_MAQ);
    if (!viejas) return Object.keys(m).length && DATA && pintarTab();
    return Promise.all(Object.keys(viejas).map(k => IDB.poner(k, viejas[k]))).then(() => LS.del('gym_fotomaq'));
  }).catch(e => registrarError('Fotos de máquina: ' + (e && e.message || e), 'cargarFotosMaq'));
}
function guardarFotoMaq(name, url) {
  if (url) FOTOS_MAQ[name] = url; else delete FOTOS_MAQ[name];
  if (FOTOS_IDB) {
    (url ? IDB.poner(name, url) : IDB.quitar(name)).catch(() => toast('No se pudo guardar la foto en el celular'));
    return true;
  }
  // Sin IndexedDB (navegador muy viejo): como antes
  if (LS.set('gym_fotomaq', FOTOS_MAQ)) return true;
  toast('No cupo la foto en el celular: quita fotos de otras máquinas'); return false;
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
  $('sheet').innerHTML = '<div class="row between"><div class="t2">' + esc(ex ? ex.ejercicio : 'Tu máquina') + '</div><button class="btn ghost sm" ' + on('cerrarModal') + '>✕</button></div>' +
    '<img class="maqfoto" style="max-height:60vh;object-fit:contain" src="' + fotoMaqDe(name) + '" alt="">' +
    (borrar ? '<div class="muted" style="margin:4px 0 8px">¿Quitar esta foto? Solo se borra de este celular.</div><div class="acts"><button class="btn ghost" ' + on('verFotoMaq', name) + '>No</button>' +
      '<button class="btn" ' + on('quitarFotoMaq', name) + '>Sí, quitarla</button></div>'
      : '<div class="acts"><button class="btn ghost" ' + on('verFotoMaq', name, true) + '>Quitar</button><button class="btn" ' + on('fotoParaEjercicio', name) + '>📷 Tomar otra</button></div>');
  if (!$('modal').classList.contains('show')) abrirModal();
}
/* ----- Animación del movimiento (animaciones.js): se dibuja sola, sin video ni internet ----- */
// Lugar para la animación: se monta sola en cuanto aparece en pantalla (ver montarAnimaciones)
function placaAnimacion(ex, st, grande) {
  if (!window.ANIM || !ajuste('animaciones', true) || !ex) return '';
  const sig = st && st.sets ? st.sets.find(x => !x.ok && x.t !== 'C') : null;
  return '<div class="anim-ej' + (grande ? ' grande' : '') + '" data-ej="' + esc(ex.name) + '" data-reps="' + (sig && Number(sig.r) > 0 ? Number(sig.r) : 0) + '"></div>';
}
function montarAnimaciones() {
  if (!window.ANIM) return;
  document.querySelectorAll('.anim-ej:not([data-lista])').forEach(el => {
    const ex = exDe(el.getAttribute('data-ej'));
    el.setAttribute('data-lista', '1');
    if (!ex) return;
    try {
      const fase = document.createElement('div'); fase.className = 'anim-fase';
      ANIM.montar(el, ex, { reps: Number(el.getAttribute('data-reps')) || 0, textoFase: fase });
      el.appendChild(fase);
    } catch (e) { el.remove(); registrarError('Animación de ' + ex.ejercicio + ': ' + e.message, 'montarAnimaciones', e.stack); }
  });
}
// Cualquier pantalla que pinte un lugar para animación lo recibe dibujado (las tarjetas se repintan seguido)
let ANIM_PEND = false;
new MutationObserver(() => { if (ANIM_PEND) return; ANIM_PEND = true; requestAnimationFrame(() => { ANIM_PEND = false; montarAnimaciones(); }); })
  .observe(document.documentElement, { childList: true, subtree: true });
/* ----- Técnica y video del ejercicio (Catálogo: Q = link, R = técnica) ----- */
function badgeMod(ex) { return ex && ex.modalidad ? '<span class="mod">' + esc(ex.modalidad) + '</span>' : ''; }
function botonTecnica(ex) {
  return '<button class="vidbtn' + (ex.media ? ' tiene' : '') + '" ' + on('verTecnica', ex.name) + ' aria-label="Ver técnica y video">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M10 8.5v7l5.5-3.5z" fill="currentColor"/></svg></button>';
}
// YouTube (normal, Shorts o youtu.be) se incrusta; MP4/WebM se reproduce en bucle; GIF o imagen se muestra; lo demás, botón para abrir
function reproductor(url) {
  url = urlSegura(url);
  if (!url) return '';
  const esq = '<div class="esq"><div class="brillo"></div><span>Cargando…</span></div>';
  const yt = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) {
    // Primero la miniatura (queda guardada en el celular); el video solo se carga si tocas ▶
    return '<div class="media' + (/shorts\//.test(url) ? ' vert' : '') + '" data-yt="' + yt[1] + '">' +
      '<img class="thumb" src="https://i.ytimg.com/vi/' + yt[1] + '/hqdefault.jpg" alt="" ' + ev('load', 'mediaOk', EL) + ' ' + ev('error', 'mediaFalla', EL) + '>' +
      '<button class="play" ' + on('reproducirYT', PADRE) + ' aria-label="Reproducir video"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>' + esq + '</div>';
  }
  if (/\.(mp4|webm|mov)(\?|#|$)/i.test(url)) return '<div class="media"><video src="' + esc(url) + '" autoplay muted loop playsinline controls ' + ev('canplay', 'mediaOk', EL) + ' ' + ev('error', 'mediaFalla', EL) + '></video>' + esq + '</div>';
  if (/\.(gif|png|jpe?g|webp)(\?|#|$)/i.test(url) || /giphy\.com\/media|tenor\.com\/.*\.gif/i.test(url))
    return '<div class="media img"><img src="' + esc(url) + '" alt="Demostración del ejercicio" ' + ev('load', 'mediaOk', EL) + ' ' + ev('error', 'mediaFalla', EL) + '>' + esq + '</div>';
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
    'title="Video del ejercicio" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen ' + ev('load', 'mediaOk', EL) + '></iframe>');
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
  $('sheet').innerHTML = '<div class="row between"><div class="t2" style="padding-right:8px">' + esc(ex.ejercicio) + '</div><button class="btn ghost sm" ' + on('cerrarModal') + '>✕</button></div>' +
    placaAnimacion(ex, state[name] || null, true) +
    (window.ANIM && ajuste('animaciones', true) ? '<div class="muted anim-tempo">⏱ ' + esc(ANIM.tempoTexto(ex.tempo)) + (ex.tempo ? '' : ' · tempo de hipertrofia; cámbialo en el Catálogo (columna W, ej. 3-1-1-0)') + '</div>' : '') +
    reproductor(ex.media) +
    (puntos.length ? '<ol class="tecnica">' + puntos.map(p => '<li>' + esc(p.charAt(0).toUpperCase() + p.slice(1)) + '</li>').join('') + '</ol>' : '<div class="muted" style="margin:10px 0">Sin técnica escrita: agrégala en la columna R del Catálogo.</div>') +
    '<div class="muted" style="font-size:13.5px;margin:4px 0 2px"><b style="color:var(--text)">Cómo anotar el peso:</b> ' + esc(ex.howTo || '—') + ' · ' + ex.min + '–' + ex.max + ' reps</div>' +
    (ex.ajuste ? '<div class="muted" style="font-size:13.5px">⚙️ ' + esc(ex.ajuste) + '</div>' : '') +
    '<div class="medialink"><input id="mediaUrl" type="url" inputmode="url" placeholder="Pega un link de YouTube, GIF o MP4" value="' + esc(ex.media || '') + '">' +
    '<button class="btn sm" ' + on('guardarMedia', name) + '>Guardar</button></div>' +
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
    '<div class="acts"><button class="btn ghost" ' + on('cerrarModal') + '>Cerrar</button></div></div>';
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
      '<div class="acts">' + ($('nCoach') ? '<button class="btn ghost" ' + on('cerrarY', 'verTab', 'Coach') + '>Ver en Coach</button>' : '') + '<button class="btn" ' + on('cerrarModal') + '>Listo</button></div></div>';
    hap('ok');
  } else toast('Tu coach dejó el resumen de la sesión', '', { txt: 'Ver', fn: () => verTab('Coach') });
}
