// Progreso: ritmo de peso, mapa muscular, foto de máquina, descarga, pareja, músculos de hoy, fotos y gráficas
// (Parte de la app: se carga después de coach.js; ver el orden en index.html)

/* ===================== PROGRESO ===================== */
let EJ_GRAF = null;
function fmt(v, signo) {
  if (v === null || v === undefined) return '—';
  const n = Math.round(v * 10) / 10;
  return (signo && n > 0 ? '+' : '') + n.toFixed(1);
}
const kpi = (v, l, d, good) => '<div class="kpi"><div class="v num">' + v + '</div><div class="l">' + l + '</div>' + (d ? '<div class="d' + (good ? ' good' : '') + '">' + d + '</div>' : '') + '</div>';
function pintarProgreso() {
  let h = '<div class="seg s4">' + ['Semana', 'Fuerza', 'Cuerpo', 'Logros'].map(t => '<button class="' + (PTAB === t ? 'on' : '') + '" ' + on('verPTab', t) + '>' + t + '</button>').join('') + '</div>';
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
    (DATA.logros ? '<button class="link" style="margin-top:10px" ' + on('verPTab', 'Logros') + '>' +
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
  h += '<a class="btn ghost block" style="display:block;text-align:center;text-decoration:none;margin-top:6px" href="' + esc(urlSegura(r.sheetUrl)) + '" target="_blank" rel="noopener">Abrir dashboard completo</a>';
  const boton = '<button class="btn block reporte" ' + on('copiarReporte') + '>📋 COPIAR REPORTE DEL DOMINGO</button>';
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
    '<button class="btn ghost sm" ' + on('abrirAjustes') + '>Ponerla en Ajustes</button></div>';
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
    '<div class="acts"><button class="btn ghost" ' + on('cerrarModal') + '>Seguir</button><button class="btn" ' + on('verLogros') + '>Ver mis logros</button></div>';
  abrirModal();
}
function tarjetaFuerza() {
  const conHist = DATA.exercises.filter(e => e.hist && e.hist.length >= 2 && e.inc > 0);
  let h = '<div class="card chart">';
  if (!conHist.length) return h + '<div class="t1">Fuerza por ejercicio</div><div class="muted" style="margin-top:6px">Aparece cuando registres un ejercicio con peso al menos 2 días.</div></div>';
  if (!EJ_GRAF || !conHist.some(e => e.name === EJ_GRAF)) EJ_GRAF = conHist.slice().sort((a, b) => b.hist.length - a.hist.length)[0].name;
  const ex = exDe(EJ_GRAF);
  const pts = ex.hist, mejor = Math.max.apply(null, pts.map(p => p.e1)), cambio = (pts[pts.length - 1].e1 / pts[0].e1 - 1) * 100;
  h += '<select ' + ev('change', 'elegirGrafica', VALOR) + '>' + conHist.map(e => '<option value="' + esc(e.name) + '"' + (e.name === EJ_GRAF ? ' selected' : '') + '>' + esc(e.ejercicio) + '</option>').join('') + '</select>' +
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
  accion = accion || (m => on('verMusculo', m));
  const pieza = (m, d) => m ? '<path class="' + clase(m, z[m] || 0) + '" data-m="' + m + '" d="' + d + '" ' + accion(m) + '><title>' + znL(m) + '</title></path>'
    : '<path class="nz" d="' + d + '"/>';
  const mitad = ANAT[lado].map(x => pieza(x[0], x[1])).join('') + ANAT.fibras[lado].map(d => '<path class="fib" d="' + d + '"/>').join('');
  const espejo = c => '<g' + (c ? ' transform="matrix(-1 0 0 1 200 0)"' : '') + '>';
  // La silueta va dos veces: con borde abajo y sin borde encima, para que no se vea la costura del centro
  const sil = cls => espejo(false) + '<path class="' + cls + '" d="' + ANAT.sil + '"/></g>' + espejo(true) + '<path class="' + cls + '" d="' + ANAT.sil + '"/></g>';
  return '<svg viewBox="18 4 164 448" role="img" aria-label="' + (espalda ? 'Espalda' : 'Frente') + '">' + sil('sil borde') + sil('sil') +
    espejo(false) + mitad + '</g>' + espejo(true) + mitad + '</g><text x="100" y="449">' + (espalda ? 'ESPALDA' : 'FRENTE') + '</text></svg>';
}
// Nombre para mostrar (las claves de ZONAS, de la hoja y del correo no cambian). zn: corto; znL: con el técnico entre paréntesis
const ZONA_NOM = { 'Deltoide frontal': 'Hombro de enfrente', 'Deltoide lateral': 'Hombro de lado', 'Deltoide posterior': 'Hombro de atrás', 'Dorsal': 'Espalda ancha',
  'Lumbar': 'Espalda baja', 'Cuádriceps': 'Muslo de adelante', 'Isquiosurales': 'Muslo de atrás', 'Glúteo medio': 'Glúteo de lado', 'Aductores': 'Entrepierna', 'Oblicuos': 'Costados' };
const zn = m => ZONA_NOM[m] || m;
const znL = m => ZONA_NOM[m] ? ZONA_NOM[m] + ' (' + m.toLowerCase() + ')' : m;
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
  $('sheet').innerHTML = '<div class="row between"><div class="t2">¿Qué máquina es?</div><button class="btn ghost sm" ' + on('cerrarModal') + '>✕</button></div>' +
    '<div class="muted" style="margin:6px 0 12px">Tómale foto a la máquina (o a alguien usándola) y te digo qué ejercicio es, qué trabaja y si ya lo tienes.</div>' +
    '<div class="camopts"><button ' + on('fotoMaquina', false) + '><span>📷</span><b>Tomar foto</b><small>Que se vea completa, con el asiento y los agarres</small></button>' +
    '<button ' + on('fotoMaquina', true) + '><span>🖼️</span><b>Elegir de la galería</b><small>Una foto que ya tomaste</small></button></div>';
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
  let h = html`<div class="row between"><div class="t2">${r.maquina || r.ejercicio || 'Máquina'}</div><button class="btn ghost sm" ${on('cerrarModal')}>✕</button></div>` +
    html`<img class="maqfoto" src="${/^data:image\//.test(r.foto) ? r.foto : ''}" alt="">`;
  if (r.confianza === 'baja') h += html`<div class="aviso2">🤔 No estoy seguro. ${r.como || 'Tómale otra foto donde se vea completa.'}</div>`;
  if (ex) {
    h += html`<div class="maqok">✓ Ya está en tu catálogo: <b>${ex.ejercicio}</b> · ${ex.group}<small>${ex.anterior.length
      ? 'Ya lo has hecho: la última vez (' + ex.lastWhen + ') ' + resumenSets(ex.anterior) + ' ' + ex.unit : 'Todavía no lo has hecho'}</small></div>` +
      html`<div class="acts"><button class="btn ghost" ${on('irAEjercicio', ex.name)}>Ver cómo se hace</button>${esExtra(ex.name) ? ''
        : html`<button class="btn" ${on('anadirHoy', ex.name, seriesDe(ex))}>Añadir a hoy</button>`}</div>` +
      (fotoMaqDe(ex.name) === MAQ.chica ? html`<div class="muted" style="margin-top:8px">📌 Foto guardada en el ejercicio</div>`
        : html`<button class="btn ghost block" style="margin-top:8px" ${on('guardarFotoDeMaquina', ex.name)}>📌 Guardar esta foto en el ejercicio</button>`);
  } else if (r.confianza !== 'baja') {
    h += html`<div class="maqnuevo"><div class="muted" style="margin-bottom:6px">No está en tu catálogo. Esto es lo que te propongo:</div>` +
      html`<b>${r.ejercicio}</b> · ${r.grupo}<br>${r.musculo}${r.secundario ? ' (y ' + r.secundario + ')' : ''}` +
      html`<br><span class="muted">${r.series} series de ${r.min}–${r.max} · anota: ${r.anotar}</span>` +
      (r.como ? html`<div class="muted" style="margin-top:6px;font-size:13.5px">💡 ${r.como}</div>` : '') + '</div>' +
      html`<button class="btn block" style="margin-top:12px" ${on('agregarMaquina')}>${r.guardando ? 'Agregando…' : '➕ Agregarlo a mi catálogo'}</button>` +
      html`<div class="muted" style="font-size:12.5px;margin-top:6px">Se agrega al final de ${r.grupo} en tu hoja; no cambia tu rutina A/B ni borra nada.</div>`;
  }
  if (r.otros && r.otros.length) h += html`<div class="muted" style="font-size:13px;margin-top:10px">En esa máquina también se hace: ${r.otros.join(', ')}</div>`;
  h += html`<button class="link" style="margin-top:10px" ${on('abrirMaquina')}>📷 Otra foto</button>`;
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
  else p.push('nuevo para ti: empieza ligero, que te queden 1 o 2 por hacer');
  if ((e.zonas || []).length <= 2) p.push('trabaja directo ' + m.toLowerCase());
  if (o.rojo(e)) p.push('ojo: también carga una zona que ya va alta');
  return p.join(' · ');
}
// Series de trabajo que trae el ejercicio hoy (el script no manda el número del Catálogo)
function seriesDe(e) { return ((e && e.sets) || []).filter(x => x.t !== 'C').length || 4; }
// Panel de una zona (en Progreso y en "🎯 Trabajar un músculo")
function panelZona(m, modal) {
  const z = zonasVivas(), v = z[m] || 0, t = metaZona(m), est = zonaZ(v, m), falta = Math.max(0, t.meta - v);
  const sel = x => modal ? on('elegirMusculo', x) : on('verMusculo', x);
  const col = ['var(--muted)', 'var(--acc)', 'var(--ok)', 'var(--bad)'];
  const barra = (x, w) => '<span class="zbar' + (w ? ' w' : '') + '"><i style="width:' + Math.min(100, Math.round((z[x] || 0) / metaZona(x).meta * 100)) + '%;background:' + col[zonaZ(z[x] || 0, x)] + '"></i></span>';
  let h = '<div class="msel entra"><div class="row between" style="align-items:baseline"><b>' + esc(znL(m)) + '</b><span class="num">' + fmtSer(v) + ' / ' + t.meta + ' series</span></div>' +
    barra(m, true) + '<div class="muted" style="font-size:13px;margin-top:4px">' + ZONA_TXT[est] + (focoMus() !== 'balanceado' ? ' · meta con tu objetivo «' + FOCOS[focoMus()][0] + '»' : '') + '</div>';
  const r = regionDe(m);
  if (r) h += '<div class="region"><div class="muted">' + r + '</div>' + REGIONES[r].map(x => '<button class="' + (x === m ? 'on' : '') + '" ' + sel(x) + '>' +
    '<span>' + esc(x) + '</span>' + barra(x) + '<span class="num">' + fmtSer(z[x] || 0) + '/' + metaZona(x).meta + '</span></button>').join('') + '</div>';
  const o = opcionesZona(m), rec = zonaReciente(m);
  const boton = (e, grande) => {
    const n = Math.min(seriesDe(e), Math.max(2, Math.ceil(falta / o.peso(e)) || 3));
    if (esExtra(e.name)) return '<button class="' + (grande ? 'btn block' : 'alt') + '" ' + on('irAEjercicio', e.name) + '>✓ Ya está en tu sesión: ' + esc(e.ejercicio.split(' (')[0]) + ' → Ir</button>';
    return grande ? '<button class="btn block" ' + on('anadirHoy', e.name, n) + '>➕ Añadir ' + esc(e.ejercicio.split(' (')[0]) + ' a hoy · ' + n + ' series</button>' +
      '<div class="muted porque">' + esc(porQue(e, m, o)) + '</div>'
      : '<button class="alt" ' + on('anadirHoy', e.name, n) + '>' + (o.pendHoy.length || est === 2 ? '➕ ' : 'o ') + esc(e.ejercicio.split(' (')[0]) +
        '<small>' + (e.anterior.length ? '✓ ya lo has hecho · ' + esc(e.lastWhen) : 'nuevo para ti') + '</small></button>';
  };
  h += '<div class="accion">';
  if (est === 3) h += '<div>Ya pasaste el tope esta semana: no le sumes más; dale descanso para que crezca.</div>';
  else {
    if (est === 2) h += '<div class="muted" style="margin-bottom:6px">Vas en meta. Si aun así quieres darle más:</div>';
    else h += '<div style="margin-bottom:6px">Te faltan <b>~' + Math.ceil(falta) + ' series</b> esta semana.</div>';
    if (rec.n >= 4) h += '<div class="aviso2">⏳ Ya le diste ' + fmtSer(rec.n) + ' series ' + rec.cuando + ': si la sientes cargada, mejor en tu próxima sesión (48 h de recuperación).</div>';
    if (o.pendHoy.length) h += '<div style="margin:2px 0 8px">Ya está en tu rutina de hoy: ' + o.pendHoy.slice(0, 2).map(e => '<button class="alt" ' + on('irAEjercicio', e.name) + '>' + esc(e.ejercicio.split(' (')[0]) + ' → Ir</button>').join(' ') + '</div>';
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
    $('sheet').innerHTML = '<div class="row between"><button class="volver" ' + on('elegirMusculo') + '>← Otro músculo</button><button class="btn ghost sm" ' + on('cerrarModal') + '>✕</button></div>' + panelZona(m, true);
    if (!$('modal').classList.contains('show')) abrirModal();
    $('sheet').scrollTop = 0;
    return;
  }
  let h = '<div class="row between"><div class="t2">¿Qué quieres trabajar?</div><button class="btn ghost sm" ' + on('cerrarModal') + '>✕</button></div>';
  if (atr.length) h += '<div class="muted" style="margin:4px 0 6px">Lo que más te falta esta semana:</div><div class="mchips" style="margin-top:0">' +
    atr.map(x => '<button ' + on('elegirMusculo', x.m) + '><i style="background:' + col[zonaZ(x.v, x.m)] + '"></i>' + esc(x.m) + ' <b class="num">' + fmtSer(x.v) + '/' + x.meta + '</b></button>').join('') + '</div>';
  h += '<div class="regiones">' + Object.keys(REGIONES).map(r => '<div><div class="muted">' + r + '</div><div class="mchips" style="margin-top:4px">' + REGIONES[r].map(x =>
    '<button class="' + (x === m ? 'on' : '') + '" ' + on('elegirMusculo', x) + '><i style="background:' + col[zonaZ(z[x] || 0, x)] + '"></i>' + esc(x) + '</button>').join('') + '</div></div>').join('') + '</div>';
  if (DATA.ia) h += '<button class="musbtn" ' + on('abrirMaquina') + '>📷 ¿Una máquina que no conoces? <span>Tómale foto y te digo qué trabaja</span></button>';
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
      (hechos === acep.length ? ' · ✓ cerraste lo que faltaba' : '') + '</div><button class="link" ' + on('quitarRuta') + '>Quitar</button></div>';
  }
  if (LS.get(k + '_no', false)) return '';
  const r = RUTA_TMP = calcularRuta(GRUPO);
  if (!r.total) return '<div class="ruta corta"><span class="i">✓</span><div style="flex:1">' + esc(GRUPO) + ' de la semana ya está en meta: si entrenas, no pases de 3 series por ejercicio.</div></div>';
  if (!r.items.length) return '';
  return '<div class="card ruta' + (ANIM_PLAN ? ' entra' : '') + '"><div class="row between"><div class="t1">🧭 Ruta de hoy</div><button class="link" ' + on('ocultarRuta', k) + '>Ocultar</button></div>' +
    '<div class="msg">' + esc(textoRuta(r)) + '</div><ol>' + r.items.map((x, i) => {
      const e = exDe(x.name), w = (e.zonas.find(y => y.z === x.zona) || { w: 1 }).w, t = metaZona(x.zona);
      return '<li><button ' + on('irAEjercicio', x.name) + '><span class="n num">' + (i + 1) + '</span><span style="flex:1;min-width:0"><b>' + esc(e.ejercicio) + '</b><small>' +
        x.n + ' series · ' + esc(zn(x.zona).toLowerCase()) + ' ' + fmtSer(x.antes) + ' → ' + fmtSer(x.antes + x.n * w) + ' de ' + t.meta + '</small></span>' + badgeMod(e) + '</button></li>';
    }).join('') + '</ol><button class="btn block" ' + on('seguirRuta') + '>Seguir esta ruta</button></div>';
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
    '<div class="acts"><button class="btn ghost" ' + on('noDescarga') + '>Ahora no</button>' +
    '<button class="btn" ' + on('empezarDescarga') + '>Hacer descarga esta semana</button></div></div>';
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
    ops.map(o => '<button class="' + (on(o[0]) ? 'on' : '') + '" ' + on('fijarAsignado', base, o[0]) + '>' + esc(o[1]) + '</button>').join('') +
    '</div><div class="acts"><button class="btn ghost" ' + on('cerrarModal') + '>Cancelar</button></div>';
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
  if (((DATA.resumen || {}).zonasDias || []).length) h += '<div class="semana"><span class="dia" id="semDia"></span><button class="btn ghost sm" id="semBtn" ' + on('verSemana') + '>▶ Tu semana</button></div>';
  const atr = zonasAtrasadas(3);
  if (atr.length && !MUS_SEL) h += '<div class="falta"><span class="muted">Lo que más te falta:</span> ' + atr.map(x => '<button class="link" ' + on('verMusculo', x.m) + '>' +
    esc(x.m) + ' ' + fmtSer(x.v) + '/' + x.meta + '</button>').join(' · ') + '</div>';
  if (MUS_SEL) h += panelZona(MUS_SEL, false);
  h += '<div class="mchips">' + ZONAS.slice().sort((a, b) => (z[a] || 0) / metaZona(a).meta - (z[b] || 0) / metaZona(b).meta).map(m => '<button class="' + (m === MUS_SEL ? 'on' : '') + '" ' + on('verMusculo', m) + '><i style="background:' + col[zonaZ(z[m] || 0, m)] + '"></i>' +
    esc(zn(m)) + ' <b class="num">' + fmtSer(z[m] || 0) + '/' + metaZona(m).meta + '</b></button>').join('') + '</div>';
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
    (QUE_TRABAJA[g] ? ' · ' + QUE_TRABAJA[g] : '') + ' · ' + fmtSer(total) + (Number(total) === 1 ? ' serie efectiva' : ' series efectivas') + '</div></div>' +
    '<span class="pill ' + (faltan.length ? 'acc' : 'ok') + '">' + (faltan.length ? faltan.length + ' por cubrir' : '✓ Todo cubierto') + '</span></div>' +
    '<div class="cuerpo">' + svgCuerpo(zh, false, (m, v) => 'mz' + zonaHoyZ(v, m), m => on('elegirMusculo', m)) +
    svgCuerpo(zh, true, (m, v) => 'mz' + zonaHoyZ(v, m), m => on('elegirMusculo', m)) + '</div>' +
    '<div class="leyenda">' + ['Sin trabajar', 'Empezado', 'Cubierto hoy', 'Mucho para un día'].map((t, i) => '<span><i style="background:' + col[i] + (i === 0 ? ';opacity:.4' : '') + '"></i>' + t + '</span>').join('') + '</div>' +
    '<div class="muted" style="font-size:12.5px;margin-top:8px">Solo cuenta lo de hoy. Toca una zona para ver opciones y añadirla a tu sesión.</div></div>';
  if (FECHA) return ($('vMusculos').innerHTML = h + '<div class="tip">Estás registrando otro día; este mapa es solo para la sesión de hoy.</div>');
  if (faltan.length) {
    h += '<h2>Te falta hoy · ' + esc(g) + '</h2><div class="card">' + faltan.map(m => {
      const ej = rutina.find(e => (e.zonas || []).some(x => x.z === m && x.w >= 1) && !(state[e.name] && state[e.name].done));
      return '<div class="zfila"><div class="zt"><div class="row between"><b>' + esc(znL(m)) + '</b><span class="num muted cnt">' + fmtSer(zh[m] || 0) + ' / ' + metaHoy(m) + ' series</span></div>' + barra(m) +
        '<div class="muted ej">' + (ej ? 'Con: ' + esc(ej.ejercicio.split(' (')[0]) : 'No está en tu rutina de hoy') + '</div></div>' +
        (ej ? '<button class="btn sm" ' + on('irAEjercicio', ej.name) + '>Ir →</button>'
            : '<button class="btn ghost sm" ' + on('elegirMusculo', m) + '>＋ Añadir</button>') + '</div>';
    }).join('') + '</div>';
  }
  if (listas.length) h += '<h2>Ya cubriste hoy</h2><div class="mchips">' + listas.map(m => '<button ' + on('elegirMusculo', m) + '><i style="background:' + col[zonaHoyZ(zh[m] || 0, m)] + '"></i>' +
    esc(zn(m)) + ' <b class="num">' + fmtSer(zh[m] || 0) + '</b></button>').join('') + '</div>';
  // Lo que va atrasado en la semana y no toca hoy: por si te sobra tiempo
  const atr = zonasAtrasadas(4).filter(x => !deHoy.includes(x.m));
  if (atr.length) h += '<h2>Si te sobra tiempo · atrasado en la semana</h2><div class="mchips">' + atr.map(x => '<button ' + on('elegirMusculo', x.m) + '><i style="background:var(--acc)"></i>' +
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
  if (fotos.length === 1 || fotos.length > 2) h += '<div class="fotos">' + fotos.slice().reverse().map(f => '<a ' + (urlSegura(f.url) ? 'href="' + esc(urlSegura(f.url)) + '" target="_blank" rel="noopener"' : '') + ' style="text-decoration:none">' + img(f) + '<div>' + ddmm(f.d) + (f.pend ? ' · sin subir' : '') + '</div></a>').join('') + '</div>';
  h += '<label class="btn ' + (toca ? '' : 'ghost ') + 'block" style="display:block;text-align:center;margin-top:10px">' + ICO.camara.replace('class="icon"', 'class="icon" style="vertical-align:-4px;margin-right:6px"') + 'Tomar foto' +
    '<input type="file" accept="image/*" capture="environment" style="display:none" ' + ev('change', 'procesarFoto', EL) + '></label>' +
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
