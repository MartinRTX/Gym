// Qué hacer hoy (3 de 3 de lo que antes era progreso.js): la ruta de hoy, la descarga anticipada, quién hace cada ejercicio
// en pareja y los músculos de hoy. Va después de maquina.js (index.html).

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
    /** @type {any} */
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
    return html`<div class="ruta corta"><span class="i">🧭</span><div style="flex:1"><b>Ruta de hoy: ${hechos} de ${acep.length}</b>${
      hechos === acep.length ? ' · ✓ cerraste lo que faltaba' : ''}</div><button class="link" ${on('quitarRuta')}>Quitar</button></div>`;
  }
  if (LS.get(k + '_no', false)) return '';
  const r = RUTA_TMP = calcularRuta(GRUPO);
  if (!r.total) return html`<div class="ruta corta"><span class="i">✓</span><div style="flex:1">${GRUPO} de la semana ya está en meta: si entrenas, no pases de 3 series por ejercicio.</div></div>`;
  if (!r.items.length) return '';
  return crudo(html`<div class="card ruta${ANIM_PLAN ? ' entra' : ''}"><div class="row between"><div class="t1">🧭 Ruta de hoy</div><button class="link" ${on('ocultarRuta', k)}>Ocultar</button></div>` +
    html`<div class="msg">${textoRuta(r)}</div><ol>${r.items.map((x, i) => {
      const e = exDe(x.name), w = (e.zonas.find(y => y.z === x.zona) || { w: 1 }).w, t = metaZona(x.zona);
      return crudo(html`<li><button ${on('irAEjercicio', x.name)}><span class="n num">${i + 1}</span><span style="flex:1;min-width:0"><b>${e.ejercicio}</b><small>` +
        html`${x.n} series · ${zn(x.zona).toLowerCase()} ${fmtSer(x.antes)} → ${fmtSer(x.antes + x.n * w)} de ${t.meta}</small></span>${badgeMod(e)}</button></li>`);
    })}</ol><button class="btn block" ${on('seguirRuta')}>Seguir esta ruta</button></div>`);
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
  return crudo(html`<div class="card descarga"><div class="t1">📉 Te propongo adelantar la descarga</div><div class="muted" style="margin:4px 0 10px">` +
    html`${bajan.slice(0, 3).join(', ')}${bajan.length > 3 ? ' y ' + (bajan.length - 3) + ' más' : ''} bajaron 2 sesiones seguidas y vienes con poco sueño o energía. ` +
    html`Esta semana: mitad de series y ~10 % menos carga que la vez pasada, sin llegar al fallo. La fuerza suele volver más alta la siguiente.</div>` +
    html`<div class="acts"><button class="btn ghost" ${on('noDescarga')}>Ahora no</button>` +
    html`<button class="btn" ${on('empezarDescarga')}>Hacer descarga esta semana</button></div></div>`);
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
  const elegido = v => v === 'Ambos' ? !a : mismoNombre(a, v);
  $('sheet').innerHTML = html`<div class="t2">¿Quién lo hace normalmente?</div><div class="muted" style="margin:4px 0 10px">${exDe(base).ejercicio}` +
    html`. En pareja, al que no lo hace se le marca «no lo hace hoy» desde el inicio (lo puedes cambiar ese día).</div><div class="pills" style="display:grid;grid-template-columns:repeat(3,1fr)">` +
    html`${ops.map(o => html`<button class="${elegido(o[0]) ? 'on' : ''}" ${on('fijarAsignado', base, o[0])}>${o[1]}</button>`)}` +
    html`</div><div class="acts"><button class="btn ghost" ${on('cerrarModal')}>Cancelar</button></div>`;
  abrirModal();
}
// "▶ Tu semana": el mapa empieza en gris y se pinta día por día con lo que entrenaste
let SEM_T = [];
function verSemana() {
  const dias = ((DATA.resumen || {}).zonasDias || []), piezas = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('.cuerpo [data-m]')]), lbl = $('semDia'), btn = $('semBtn');
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
  let h = html`<h2>Tus músculos</h2><div class="card"><div class="muted" style="margin-bottom:2px">Series efectivas de 7 días por zona contra tu meta${
    focoMus() !== 'balanceado' ? ' (objetivo: ' + FOCOS[focoMus()][0] + ')' : ''}. Toca una zona y te digo qué hacer.</div>` +
    html`<div class="cuerpo">${svgCuerpo(z, false)}${svgCuerpo(z, true)}</div>` +
    html`<div class="leyenda">${['Falta', 'Poco', 'En meta', 'Arriba del tope'].map((t, i) => html`<span><i style="background:${col[i]}${i === 0 ? ';opacity:.4' : ''}"></i>${t}</span>`)}</div>`;
  if (((DATA.resumen || {}).zonasDias || []).length) h += html`<div class="semana"><span class="dia" id="semDia"></span><button class="btn ghost sm" id="semBtn" ${on('verSemana')}>▶ Tu semana</button></div>`;
  const atr = zonasAtrasadas(3);
  if (atr.length && !MUS_SEL) h += html`<div class="falta"><span class="muted">Lo que más te falta:</span> ${atr.map((x, i) => html`${i ? ' · ' : ''}<button class="link" ${on('verMusculo', x.m)}>` +
    html`${x.m} ${fmtSer(x.v)}/${x.meta}</button>`).map(crudo)}</div>`;
  if (MUS_SEL) h += panelZona(MUS_SEL, false);
  h += html`<div class="mchips">${ZONAS.slice().sort((a, b) => (z[a] || 0) / metaZona(a).meta - (z[b] || 0) / metaZona(b).meta).map(m => html`<button class="${m === MUS_SEL ? 'on' : ''}" ${on('verMusculo', m)}><i style="background:${col[zonaZ(z[m] || 0, m)]}"></i>` +
    html`${zn(m)} <b class="num">${fmtSer(z[m] || 0)}/${metaZona(m).meta}</b></button>`).map(crudo)}</div>`;
  // Resumen por músculo completo (el que usa el correo semanal), en una línea
  const g = (ms || []).filter(x => x.series7 > 0).sort((a, b) => b.series7 - a.series7);
  if (g.length) h += html`<div class="muted" style="font-size:12.5px;margin-top:10px">Por músculo completo: ${g.map(x => x.m + ' ' + String(x.series7).replace('.5', '½')).join(' · ')}</div>`;
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
  const barra = m => html`<span class="zbar w"><i style="width:${Math.min(100, Math.round((zh[m] || 0) / metaHoy(m) * 100))}%;background:${col[zonaHoyZ(zh[m] || 0, m)]}"></i></span>`;
  let h = html`<div class="card hoycard"><div class="row between"><div><div class="t2">Músculos de hoy</div><div class="muted">${g}${
    QUE_TRABAJA[g] ? ' · ' + QUE_TRABAJA[g] : ''} · ${fmtSer(total)}${Number(total) === 1 ? ' serie efectiva' : ' series efectivas'}</div></div>` +
    html`<span class="pill ${faltan.length ? 'acc' : 'ok'}">${faltan.length ? faltan.length + ' por cubrir' : '✓ Todo cubierto'}</span></div>` +
    html`<div class="cuerpo">${svgCuerpo(zh, false, (m, v) => 'mz' + zonaHoyZ(v, m), m => on('elegirMusculo', m))}` +
    html`${svgCuerpo(zh, true, (m, v) => 'mz' + zonaHoyZ(v, m), m => on('elegirMusculo', m))}</div>` +
    html`<div class="leyenda">${['Sin trabajar', 'Empezado', 'Cubierto hoy', 'Mucho para un día'].map((t, i) => html`<span><i style="background:${col[i]}${i === 0 ? ';opacity:.4' : ''}"></i>${t}</span>`)}</div>` +
    html`<div class="muted" style="font-size:12.5px;margin-top:8px">Solo cuenta lo de hoy. Toca una zona para ver opciones y añadirla a tu sesión.</div></div>`;
  if (FECHA) return ($('vMusculos').innerHTML = h + html`<div class="tip">Estás registrando otro día; este mapa es solo para la sesión de hoy.</div>`);
  if (faltan.length) {
    h += html`<h2>Te falta hoy · ${g}</h2><div class="card">${faltan.map(m => {
      const ej = rutina.find(e => (e.zonas || []).some(x => x.z === m && x.w >= 1) && !(state[e.name] && state[e.name].done));
      return crudo(html`<div class="zfila"><div class="zt"><div class="row between"><b>${znL(m)}</b><span class="num muted cnt">${fmtSer(zh[m] || 0)} / ${metaHoy(m)} series</span></div>${barra(m)}` +
        html`<div class="muted ej">${ej ? 'Con: ' + ej.ejercicio.split(' (')[0] : 'No está en tu rutina de hoy'}</div></div>` +
        (ej ? html`<button class="btn sm" ${on('irAEjercicio', ej.name)}>Ir →</button>`
            : html`<button class="btn ghost sm" ${on('elegirMusculo', m)}>＋ Añadir</button>`) + '</div>');
    })}</div>`;
  }
  if (listas.length) h += html`<h2>Ya cubriste hoy</h2><div class="mchips">${listas.map(m => html`<button ${on('elegirMusculo', m)}><i style="background:${col[zonaHoyZ(zh[m] || 0, m)]}"></i>` +
    html`${zn(m)} <b class="num">${fmtSer(zh[m] || 0)}</b></button>`).map(crudo)}</div>`;
  // Lo que va atrasado en la semana y no toca hoy: por si te sobra tiempo
  const atr = zonasAtrasadas(4).filter(x => !deHoy.includes(x.m));
  if (atr.length) h += html`<h2>Si te sobra tiempo · atrasado en la semana</h2><div class="mchips">${atr.map(x => html`<button ${on('elegirMusculo', x.m)}><i style="background:var(--acc)"></i>` +
    html`${x.m} <b class="num">${fmtSer(x.v)}/${x.meta}</b></button>`).map(crudo)}</div>`;
  $('vMusculos').innerHTML = h;
}

