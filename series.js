// Series: plan del día, check-in, menú del ejercicio, cambios de equipo, superserie, teclado, guardado y motor de la siguiente serie
// (Parte de la app: se carga después de entrenar.js; ver el orden en index.html)

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
  return crudo(html`<div class="card ready entra"><div class="row between"><div class="t1">¿Cómo vienes hoy?</div><button class="link" ${on('guardarReady', true)}>Saltar</button></div>` +
    html`<div class="muted" style="font-size:13px">3 toques: tu coach ajusta el plan y el esfuerzo de hoy</div>` +
    html`${Object.keys(READY).map(k => html`<div class="fila"><div class="muted">${READY_TIT[k]}</div><div class="pills">${
      READY[k].map(v => html`<button class="${READY_TMP[k] === v ? 'on' : ''}" ${on('elegirReady', String(k), String(v))}>${v}</button>`)}</div></div>`)}</div>`);
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
  if (p && p.foco) return html`<div class="foco${ANIM_PLAN ? ' entra' : ''}"><span class="i">✨</span><div><b>Lo importante hoy:</b> ${p.foco}</div></div>`;
  if (PLAN_CARGANDO) return crudo(html`<div class="foco"><span class="i">✨</span><div style="flex:1"><div class="muted" style="font-size:13px">Tu coach está preparando el plan de hoy…</div>` +
    html`<div class="brillo linea-esq" style="width:90%"></div><div class="brillo linea-esq" style="width:60%"></div></div></div>`);
  return '';
}

/* ----- Menú ⋮ del ejercicio: lo secundario, fuera de la vista mientras entrenas ----- */
function menuEjercicio(k) {
  const ex = exDe(k), st = state[k], base = baseVista(k), par = esPar(k) ? null : companero(k);
  const item = (ico, txt, sub, accion) => html`<button ${accion}><span class="i">${ico}</span><span><b>${txt}</b>${sub ? html`<small>${sub}</small>` : ''}</span></button>`;
  let h = html`<div class="row between"><div class="t2">${ex.ejercicio}${esPar(k) ? ' · ' + PAR.nombre : ''}</div><button class="btn ghost sm" ${on('cerrarModal')}>✕</button></div><div class="menu">`;
  h += item('▶', 'Técnica y video', ex.tecnica ? 'Cómo se hace, punto por punto' : 'Agrega un video o GIF', on('verTecnica', k));
  if (!st.sets.some(s => s.t === 'C') && calientaConSeries(ex)) h += item('🔥', 'Agregar calentamiento', 'Series ligeras antes del peso de trabajo', on('cerrarY', 'agregarCalentamiento', k));
  h += fotoMaqDe(baseDe(k)) ? item('📷', 'Foto de tu máquina', 'Verla, cambiarla o quitarla', on('verFotoMaq', baseDe(k)))
    : item('📷', 'Tómale foto a la máquina', 'Te aparece en el ejercicio para reconocerla en el gym', on('cerrarY', 'fotoParaEjercicio', baseDe(k)));
  h += item('⚙️', ex.ajuste ? 'Editar ajuste de máquina' : 'Ajuste de máquina', ex.ajuste || 'Asiento, banco o agarre: te aparece siempre', on('cerrarY', 'editarAjuste', k));
  h += item('⚖️', 'Paso del equipo: ' + pasoEj(ex, st) + ' ' + st.unit + (ex.pasoFijo ? '' : ' (supuesto)'), 'El cambio de peso más chico que permite; toca para cambiarlo', on('menuPaso', k));
  h += item('📝', st.notas ? 'Editar nota de hoy' : 'Nota de hoy', st.notas || 'Solo de esta sesión: «hombro cargado», «dormí mal»', on('notaDeHoy', k));
  if (!esPar(k)) h += par ? item('⇆', 'Quitar superserie', 'Con ' + exDe(par).ejercicio, on('cerrarY', 'quitarSuper'))
                          : item('⇆', 'Alternar con otro', 'Una serie de cada uno (superserie) y descansas al final del par', on('elegirSuper', k));
  h += item('⇄', 'Cambiar ejercicio', (variantesDe(base).length ? 'Otro equipo, ' : '') + 'máquina ocupada o molestia' + (parOn() ? ' (para los dos o solo uno)' : ''), on('elegirCambio', base));
  if (originalDe(base)) h += item('↩', 'Volver a ' + exDe(originalDe(base)).ejercicio.split(' (')[0], 'Solo hoy lo cambiaste por este', on('volverOriginal', base));
  if (parejaDisponible()) { const a = asignadoDe(base); h += item('👥', 'Quién lo hace: ' + (a ? 'solo ' + a : 'los dos'), 'En pareja, al otro se le marca «no lo hace hoy» de entrada', on('menuAsignado', base)); }
  if (esExtra(baseDe(k)) && !state[baseDe(k)].sets.some(s => s.ok)) h += item('✕', 'Quitar de hoy', 'Lo añadiste desde el mapa de músculos', on('quitarDeHoy', baseDe(k)));
  $('sheet').innerHTML = h + '</div>';
  abrirModal();
}
function menuPaso(k) {
  const ex = exDe(k), st = state[k], p = pasoEj(ex, st);
  $('sheet').innerHTML = html`<div class="t2">¿De cuánto en cuánto sube?</div><div class="muted" style="margin:4px 0 10px">${ex.ejercicio} · ${ex.howTo}` +
    html`. Con esto ningún consejo te pedirá un peso que no existe en ese equipo.</div><div class="pills" style="display:grid;grid-template-columns:repeat(4,1fr)">` +
    html`${(st.unit === 'kg' ? [1, 1.25, 2.5, 5, 10, 2, 4, 20] : [1, 2.5, 5, 10, 15, 20, 7.5, 12.5]).map(v => html`<button class="${v === p ? 'on' : ''}" ${on('cerrarY', 'fijarPaso', k, v)}>${v} ${st.unit}</button>`)}` +
    html`</div><div class="acts"><button class="btn ghost" ${on('cerrarModal')}>Cancelar</button></div>`;
  abrirModal();
}
function notaDeHoy(k) {
  $('sheet').innerHTML = html`<div class="t2">Nota de hoy</div><div class="muted" style="margin:4px 0 8px">${exDe(k).ejercicio} · solo de esta sesión; la próxima vez te aparece como «La última vez anotaste»</div>` +
    html`<textarea id="notaTxt" aria-label="Nota de hoy" rows="3" maxlength="200" style="width:100%;padding:10px 12px;border:1.5px solid var(--line);border-radius:12px;background:var(--card2);color:var(--text);font:inherit">${state[k].notas || ''}</textarea>` +
    html`<div class="acts"><button class="btn ghost" ${on('cerrarModal')}>Cancelar</button><button class="btn" ${on('guardarNotaDeHoy', k)}>Guardar</button></div>`;
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
  const meta = html`${badgeMod(ex)}Tú ${prog(yo, cy, 'yo')} · ${PAR.nombre}${mapeado && exDe(pk) ? ' (' + exDe(pk).ejercicio.split(' (')[0] + ')' : ''} ${prog(pa, cp, 'par')}`;
  const enCurso = !hecho && (cy.h + cp.h > 0 || yo.done || pa.done);
  const ico = hecho ? crudo(ICO.check) : anillo(cy.h + cp.h + (yo.done ? cy.t - cy.h : 0) + (pa.done ? cp.t - cp.h : 0), cy.t + cp.t, false);
  let h = html`<div class="ex${abierto ? ' open' : ''}${hecho ? ' done' : ''}${enCurso ? ' prog' : ''}" id="ex-${base}" style="view-transition-name:ex${DATA.exercises.indexOf(ex)}">` +
    html`<div class="ex-head" ${on('abrir', base)}><div class="ex-ico">${ico}</div>` +
    html`<div style="flex:1;min-width:0"><div class="ex-name">${ex.ejercicio}${botonTecnica(ex)}</div><div class="ex-meta">${abierto && !hecho ? badgeMod(ex) : meta}</div></div>` +
    (abierto && !hecho ? html`<button class="swapbtn" ${on('elegirCambio', base)} aria-label="Máquina ocupada: cambiar ejercicio">⇄</button>` : '') +
    (abierto && exV && !st.done ? html`<button class="menubtn" ${on('menuEjercicio', k)} aria-label="Más opciones">⋮</button>` : '') + '</div>';
  if (!abierto) return h + '</div>';
  h += html`<div class="ex-body${ANIM_ABRE === base ? ' entra' : ''}"><div class="quien">` +
    html`<button class="${lado === 'yo' ? 'on' : ''}" ${on('verLado', base, 'yo')}>Tú · ${prog(yo, cy, 'yo')}</button>` +
    html`<button class="${lado === 'par' ? 'on' : ''}" ${on('verLado', base, 'par')}>${PAR.nombre} · ${prog(pa, cp, 'par')}</button></div>`;
  // Cada quien puede no hacer este ejercicio: así no se registra nada a su nombre y la tarjeta se puede completar
  const asig = asignadoDe(base), habitual = asig && saltado(base, lado) && (saltosPar()[base] || {})[lado] === undefined;
  if (saltado(base, lado)) return h + html`<div class="mapa"><span>${lado === 'par' ? PAR.nombre + ' no lo hace hoy' : 'Hoy no lo haces'}${
    habitual ? html`<br><small class="muted">Normalmente lo hace solo ${asig}</small>` : ''}</span><button class="link" ${on('saltarLado', base, String(lado))}>${
    lado === 'par' ? 'Sí lo hace hoy' : 'Sí lo hago hoy'}</button></div></div></div>`;
  if (st && !st.done && !st.sets.some(x => x.ok)) h += html`<div class="saltar"><button class="link" ${on('saltarLado', base, String(lado))}>${
    lado === 'par' ? PAR.nombre + ' no lo hace hoy' : 'Hoy no lo hago'}</button></div>`;
  if (lado === 'par' && mapeado && exV) h += html`<div class="mapa"><span>${PAR.nombre} hace <b>${exV.ejercicio}</b></span>` +
    html`<button class="link" ${on('quitarMapa', base)}>Que haga ${ex.ejercicio.split(' (')[0]}</button></div>`;
  if (!exV) h += html`<div class="tip">Este ejercicio no está en el catálogo de ${PAR.nombre}.</div>`;
  else if (st.done) h += html`<div class="acts">${st.uid ? html`<button class="btn ghost sm" ${on('deshacer', k)}>Borrar</button>` : ''}` +
    html`<button class="btn ghost sm" ${on('corregir', k)}>${st.uid ? 'Corregir' : 'Registrar otra vez'}</button></div>`;
  else h += cuerpoEjercicio(exV, st);
  return h + '</div></div>';
}
function cuerpoEjercicio(ex, st) {
  const n = jsq(ex.name), facil = sencillo() && !esPar(ex.name), foto = fotoMaqDe(baseDe(ex.name));
  const vars = esPar(ex.name) ? [] : variantesDe(ex.name);
  // Arriba: la foto de tu máquina (si la tomaste) y la animación del movimiento, lado a lado
  const fotoH = foto ? html`<img class="exfoto${facil ? ' grande' : ''}" src="${foto}" alt="Tu máquina" ${on('verFotoMaq', baseDe(ex.name))}>` : '';
  const animH = placaAnimacion(ex, st, facil);
  let h = fotoH || animH ? html`<div class="exvis${fotoH && animH ? ' dos' : ''}">${fotoH}${animH}</div>` : '';
  if (!foto && facil) h += html`<button class="exfoto-vacia" ${on('fotoParaEjercicio', baseDe(ex.name))}>📷 Tómale foto a tu máquina<small>Para reconocerla la próxima vez</small></button>`;
  h += html`<div class="row between" style="margin-bottom:10px"><div class="muted">${ex.min}–${ex.max} reps · ${ex.howTo}${
    vars.length ? html` <button class="equipo" ${on('elegirCambio', ex.name)}>${ex.modalidad || 'Equipo'} ⇄</button>` : ''}</div>` +
    html`<div class="unit">${['lb', 'kg'].map(u => html`<button class="${st.unit === u ? 'on' : ''}" ${on('setUnit', ex.name, String(u))}>${u}</button>`)}</div></div>`;
  const trabAnt = ex.anterior.filter(a => a.t !== 'C');
  const pesoAnt = trabAnt.length ? Math.max.apply(null, trabAnt.map(a => Number(a.w) || 0)) : null;
  const meta = !esPar(ex.name) && planHoy() ? (planHoy().ej || {})[ex.name] : null;
  if (facil) h += html`<div class="facil">${instruccionFacil(ex, st)}</div>`;
  else if (meta) h += html`<div class="tip plan">🎯 ${meta}</div>`;
  else if (ex.up && !FECHA && !esPar(ex.name) && descargaActiva()) h += html`<div class="tip">Semana de descarga: estas series ya vienen con −10 % y la mitad. Sin llegar al fallo.</div>`;
  else if (ex.up) h += html`<div class="tip acc">${crudo(ICO.up)}${ex.hint}</div>`;
  else if (ex.prog && ex.hint) h += html`<div class="tip${ex.prog.accion === 'bajar' ? ' baja' : ''}">${ex.prog.accion === 'bajar' ? '↓ ' : ''}${ex.hint}</div>`;
  else if (ex.hint && /al fallo/.test(ex.hint)) h += html`<div class="tip">${ex.hint}</div>`;
  else if (ex.sugerido && (pesoAnt === null || ex.sugerido.w > pesoAnt)) h += html`<div class="sug">Sugerido hoy: ${ex.sugerido.w} ${ex.unit} × ${ex.sugerido.r} (RPE 8)` +
    html`<button class="btn" ${on('usarSugerido', ex.name)}>Usar</button></div>`;
  else if (!trabAnt.length) h += html`<div class="tip">Elige un peso que te deje ${ex.min}–${ex.max} reps y que te queden 1 o 2 por hacer</div>`;
  else if (!/Semana de carrera/.test(ex.hint || '')) h += html`<div class="tip">Meta de hoy: mismo peso y 1 rep más en alguna serie (la última vez: ${trabAnt.map(a => a.r).join(', ')})</div>`;
  else h += html`<div class="tip">${ex.hint}</div>`;
  if (st.editAjuste) h += html`<div class="ajuste-ed"><input id="aj-${ex.name}" maxlength="120" placeholder="Ej. banco a 30°, asiento en 4, agarre neutro" value="${BORR['aj-' + ex.name] !== undefined ? BORR['aj-' + ex.name] : (ex.ajuste || '')}" ${ev('input', 'borrador', 'aj-' + ex.name, VALOR)}>` +
    html`<button class="btn sm" ${on('guardarAjuste', ex.name)}>Guardar</button></div>`;
  else if (ex.ajuste) h += html`<button class="nota" ${on('editarAjuste', ex.name)}>⚙️ ${ex.ajuste}<span class="ed">Editar</span></button>`;
  if (ex.notaUlt) h += html`<div class="muted" style="margin:-4px 2px 10px;font-size:13px">La última vez anotaste: «${ex.notaUlt}»</div>`;
  h += facil ? html`<div class="sets-h"><span>#</span><span>Antes</span><span>Peso</span><span>Veces</span><span></span></div>`
    : html`<div class="sets-h"><span>#</span><span>Anterior</span><span>${st.unit}</span><span>Reps</span><span></span></div>`;
  const kUlt = ultimaMarcada(st), kSig = st.sets.findIndex(x => !x.ok);
  let num = 0, nc = 0;
  const antC = ex.anterior.filter(a => a.t === 'C'), antT = ex.anterior.filter(a => a.t !== 'C');
  st.sets.forEach((s, i) => {
    if (s.t !== 'C') num++; else nc++;
    const a = s.t === 'C' ? antC[nc - 1] : antT[num - 1];
    const etiqueta = s.t === 'C' ? 'C' : s.t === 'D' ? 'D' : num;
    h += html`<div class="set${s.ok ? ' hecho' : ''}${i === kSig ? ' sig' : ''}${ANIM_SET === ex.name + '#' + i ? ' recien' : ''}">` +
      html`<button class="tipo ${s.t === 'T' ? '' : s.t}" ${on('cambiarTipo', ex.name, i)} aria-label="Tipo de serie">${etiqueta}</button>` +
      html`<button class="ant num" ${on('copiarAnterior', ex.name, i)}>${a ? a.w + '×' + a.r : '—'}</button>` +
      html`<button class="val num${vacio(s.w) ? ' vacio' : ''}" ${on('teclado', ex.name, i, 'w')}>${vacio(s.w) ? 'peso' : s.w}</button>` +
      html`<button class="val num${vacio(s.r) ? ' vacio' : ''}" ${on('teclado', ex.name, i, 'r')}>${vacio(s.r) ? (facil ? 'veces' : 'reps') : s.r}</button>` +
      html`<button class="chk" ${on('marcar', ex.name, i)} aria-label="Serie hecha">${crudo(ICO.check)}${s.ok && s.e ? html`<span class="e">${ETQ_E[s.e]}</span>` : ''}</button></div>`;
    if (i === kUlt) h += filaEsfuerzo(n, st, s) + tipIA(n, st);
  });
  const vistas = LS.get('gym_tipcount', 0);
  if (vistas < 3 && !facil) h += html`<div class="muted" style="margin:-2px 0 8px;font-size:12px">Toca el # para cambiarla a calentamiento (C) o drop (D) · "Anterior" la copia · ⋮ arriba: calentamiento, ajuste, nota y superserie</div>`;
  // Si toca subir, "Igual que antes" te regresaría al peso viejo: no se muestra
  const igual = ex.anterior.length && !ex.up;
  h += html`<div class="setacts" style="grid-template-columns:${igual ? '1.6fr 1fr 1fr' : '1fr 1fr'}">` +
    (igual ? html`<button class="btn ghost sm" ${on('igualQueAntes', ex.name)}>Igual que antes</button>` : '') +
    html`<button class="btn ghost sm" ${on('addSet', ex.name)}${st.sets.length >= 10 ? ' disabled' : ''}>+ Serie</button>` +
    html`<button class="btn ghost sm" ${on('delSet', ex.name)}${st.sets.length <= 1 ? ' disabled' : ''}>− Serie</button></div>`;
  // Lo secundario (calentamiento, ajuste, superserie, nota) vive en el menú ⋮; aquí solo se muestra si ya existe
  const par = esPar(ex.name) ? null : companero(ex.name);
  if (par) h += html`<div class="muted" style="font-size:13px;margin-top:8px">${crudo(ICO.swap)} Alternado con <b>${exDe(par).ejercicio}</b></div>`;
  if (st.notas) h += html`<button class="nota" style="margin-top:8px" ${on('notaDeHoy', ex.name)}>📝 ${st.notas}<span class="ed">Editar</span></button>`;

  const hechas = st.sets.filter(s => s.ok).length;
  h += html`<div class="acts"><button class="btn" ${on('guardar', ex.name)}>${
    hechas && hechas < st.sets.length ? 'Guardar ' + hechas + ' series' : 'Guardar ejercicio'}</button></div>`;
  return h;
}

// Esfuerzo de la serie que acabas de marcar, justo debajo de ella (sin bajar al fondo de la tarjeta)
const CORTO_E = { 'Al fallo': 'Al fallo', 'Casi (1–2 más)': 'Quedaban 1–2', 'Sobraban 3+': 'Sobraban 3+' };
function filaEsfuerzo(n, st, s) {
  const final = terminado(st);
  return html`<div class="rirx${final && !s.e ? ' pide' : ''}"><div class="q">${final ? (s.e ? 'Última serie: ' : '¿Cómo terminó? Toca uno y se guarda') : '¿Cómo terminó esta serie?'}</div><div class="pills">${
    Object.keys(RPE).map(v => html`<button class="${s.e === v ? 'on' : ''}" ${on('setRir', String(n), String(v))}>${CORTO_E[v]}</button>`)}</div></div>`;
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
  if (st.ia && st.ia.pideRir) return html`<div class="ia pide${ANIM_IA === n ? ' entra' : ''}"><span>👆 Toca cómo terminó y te digo peso y reps de la siguiente</span></div>`;
  if (!st.ia || !st.ia.mensaje) return '';
  const p = st.ia.motor ? st.ia.motor.paso : null;
  const sAct = st.sets[st.ia.i], disc = sAct ? cambioDiscos(exDe(n), sAct.w, st.ia.peso, st.unit) : '';
  return crudo(html`<div class="ia${ANIM_IA === n ? ' entra' : ''}"><span>${st.ia.fuente === 'ia' ? '✨ ' : '💡 '}${st.ia.mensaje}${
    st.ia.afinando ? html` <i class="muted" style="font-size:12px">· tu coach lo revisa…</i>` : ''}</span>` +
    html`${st.ia.usar ? html`<button class="btn sm" ${on('usarIA', String(n))}>Usar</button>` : ''}</div>` +
    html`${disc ? html`<div class="discos">🏋️ ${disc}</div>` : ''}` +
    html`${st.ia.pasoDudoso && p ? html`<div class="pasoq"><span>¿De cuánto en cuánto sube este equipo? (${st.unit})</span><div>${
      (st.unit === 'kg' ? [1.25, 2.5, 5, 10] : [2.5, 5, 10, 15]).map(v => html`<button class="${v === p ? 'on' : ''}" ${on('fijarPaso', String(n), v)}>${v}</button>`)}</div></div>` : ''}`);
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
  const fila = e => html`<button ${on('usarCambio', e.name)}><b style="flex:1">${e.ejercicio}</b><span class="muted">${e.anterior.length ? resumenSets(e.anterior) : 'nuevo'}</span></button>`;
  const vars = esPar(name) ? [] : variantesDe(name).filter(e => libres.includes(e));
  const filaVar = e => html`<button ${on('elegirVariante', name, e.name)}><b style="flex:1">${badgeMod(e)}${e.ejercicio}</b><span class="muted">${
    e.anterior.length ? resumenSets(e.anterior) + ' ' + e.unit : 'nuevo'}</span></button>`;
  const sinVar = l => l.filter(e => !vars.includes(e));
  const top = sinVar(mismo.length ? mismo : musc).slice(0, 3), resto = sinVar(mismo.concat(musc)).filter(e => !top.includes(e));
  const q = parOn() ? html`<div class="cquien">${[['ambos', 'Los dos'], ['yo', 'Solo yo'], ['par', 'Solo ' + PAR.nombre]].map(o =>
    html`<button class="${CAMBIO.quien === o[0] ? 'on' : ''}" ${on('cambioQuien', o[0], name, !!todos)}>${o[1]}</button>`)}</div>` : '';
  $('sheet').innerHTML = html`<div class="t2">Cambiar ${ex.ejercicio}</div>${q}` +
    (vars.length ? html`<div class="muted" style="margin:4px 0 6px">Mismo ejercicio, otro equipo (ahora: ${ex.modalidad || ex.howTo})</div><div class="lista vars">${vars.map(filaVar)}</div>` +
      html`<div class="muted" style="margin:12px 0 0">O algo parecido:</div>` : '') + html`<div class="muted" style="margin:4px 0 8px">` +
    html`${mismo.length ? 'Mismo movimiento (' + ex.patron.toLowerCase() + '). ' : 'Mismo músculo (' + ex.musculo + '). '}Te carga tu peso de la última vez.</div>` +
    html`<div class="lista">${top.length ? top.map(fila) : html`<div class="muted" style="padding:12px 0">No hay otro ejercicio equivalente en tu catálogo.</div>`}${
      todos && resto.length ? html`<div class="muted" style="padding:10px 2px 2px">Otros de ${ex.musculo}</div>${resto.map(fila)}` : ''}</div>` +
    html`<div class="acts">${!todos && resto.length ? html`<button class="btn ghost" ${on('elegirCambio', name, true)}>Ver ${resto.length} más</button>` : ''}` +
    html`<button class="btn ghost" ${on('cerrarModal')}>Cancelar</button></div>`;
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
  $('sheet').innerHTML = html`<div class="t2">${v.ejercicio}</div><div class="muted" style="margin:4px 0 12px">En lugar de ${ex.ejercicio}` +
    html`. ${MOTOR.comoAnotar(v).texto}.</div><div class="menu">` +
    html`<button ${on('usarVariante', de, a, false)}><span class="i">📅</span><span><b>${FECHA ? 'Usarlo ese día' : 'Solo hoy'}</b><small>${
      FECHA ? 'Sin cambiar tu rutina' : 'Mañana vuelve ' + ex.ejercicio.split(' (')[0]}</small></span></button>` +
    (enRutina ? html`<button ${on('usarVariante', de, a, true)}><span class="i">📌</span><span><b>Siempre en mi rutina</b><small>Queda en tu bloque ${ex.bloque} (también en tu hoja)</small></span></button>` : '') +
    html`</div><div class="acts"><button class="btn ghost" ${on('elegirCambio', de)}>Atrás</button></div>`;
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
  $('sheet').innerHTML = html`<div class="t2">Alternar con…</div><div class="muted" style="margin:4px 0 8px">Haces una serie de cada uno, alternando. El descanso se sugiere al terminar el par.</div>` +
    html`<div class="lista">${opciones.map(e => html`<button ${on('ponerSuper', name, e.name)}><b style="flex:1">${e.ejercicio}</b><span class="muted">${e.musculo}</span></button>`)}</div>` +
    html`<div class="acts"><button class="btn ghost" ${on('cerrarModal')}>Cancelar</button></div>`;
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
  const titulo = html`${s.t === 'C' ? 'Calentamiento' : s.t === 'D' ? 'Drop' : 'Serie ' + num} · ${f === 'w' ? html`<b class="anota">${como.texto || 'Peso'} (${st.unit})</b>` : 'repeticiones'}`;
  $('kpSheet').innerHTML = html`<div class="row between"><div class="t1">${ex.ejercicio}</div><button class="btn ghost sm" ${on('cerrarTeclado')}>✕</button></div>` +
    html`<div class="muted" style="text-align:center;margin-top:8px">${titulo}</div><div class="disp num" id="kpDisp"></div>` +
    (f === 'w' && ex.mult === 2 ? html`<div class="platos" id="kpPlatos"></div>` : '') +
    (f === 'w' && como.corto === 'total' ? html`<div class="platos">Es el total${ex.modalidad === 'Barra fija' ? ' de la barra fija' : ''}: no lo dividas entre 2</div>` : '') +
    html`<div class="quick" style="grid-template-columns:repeat(${unicos.length},1fr)">${unicos.map(v => html`<button ${on('kpSumar', v)}>${v > 0 ? '+' : '−'}${Math.abs(v)}</button>`)}</div>` +
    teclas() +
    html`<div class="acts"><button class="btn ghost" ${on('kpListo', false)}>Listo</button>` +
    html`<button class="btn" ${on('kpListo', true)}>${crudo(ICO.check.replace('class="icon"', 'class="icon" style="vertical-align:-4px;margin-right:4px"'))}Y serie hecha</button></div>`;
  kpPintar();
  $('kp').classList.add('show');
}
function teclas() { return html`<div class="keys">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map(k => html`<button ${on('kpTecla', String(k))}>${k}</button>`)}</div>`; }
function kpPintar() {
  $('kpDisp').textContent = KP.val === '' ? '0' : KP.val;
  const el = $('kpPlatos');
  if (el && KP.name) {
    const ex = exDe(KP.name), unit = state[KP.name].unit, w = Number(KP.val) || 0;
    const lista = platos(w, unit);
    const total = Math.round((w * 2 + (unit === 'kg' ? Math.round(ex.barra / KG_A_LB) : ex.barra)) * 10) / 10;
    el.innerHTML = w ? html`Por lado: <b>${lista ? lista.join(' + ') : 'no sale exacto con discos'}</b> · total ${total} ${unit}${ex.barra ? ' con barra' : ''}` : 'Pon el peso de un lado';
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
  $('kpSheet').innerHTML = html`<div class="row between"><div class="t1">Peso en ayunas (kg)</div><button class="btn ghost sm" ${on('cerrarTeclado')}>✕</button></div>` +
    (tmp === '' && base !== '' ? html`<div class="muted" style="text-align:center;margin-top:6px">Te puse el último (${ult} kg): ajústalo con − / + o escribe el nuevo</div>`
      : ult !== null && ult !== undefined ? html`<div class="muted" style="text-align:center;margin-top:6px">Último: ${ult} kg</div>` : '') +
    html`<div class="disp num" id="kpDisp"></div><div class="quick" style="grid-template-columns:repeat(4,1fr)">` +
    html`${[-0.5, -0.1, 0.1, 0.5].map(v => html`<button ${on('kpSumar', v)}>${v > 0 ? '+' : '−'}${Math.abs(v)}</button>`)}</div>${teclas()}` +
    html`<div class="acts"><button class="btn ghost" ${on('kpPeso', false)}>Listo</button><button class="btn" ${on('kpPeso', true)}>Guardar peso</button></div>`;
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
const ETQ_E = { 'Al fallo': 'AL FALLO', 'Casi (1–2 más)': 'QUEDABAN 1–2', 'Sobraban 3+': 'SOBRABAN 3+' };
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
