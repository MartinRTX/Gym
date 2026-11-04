// Sesión: resumen, tour de la primera vez, botón atrás de Android y descanso
// (Parte de la app: se carga después de series.js; ver el orden en index.html)

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
  return html`<div class="vol">${v.map(x => html`<span><b>${x.musculo}</b>${medio(x.series)}${x.series <= 1 ? ' serie' : ' series'}${x.ej ? ' · ' + x.ej + ' ej.' : ' (apoyo)'}</span>`)}</div>`;
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
  let h = html`<div class="t2">${r.s.log.length ? '¡Buena sesión!' : 'Sesión sin ejercicios'}</div><div class="muted">${DATA.today}</div>` +
    html`<div class="stats"><div><b class="num">${r.min}</b><span class="muted">minuto${r.min === 1 ? '' : 's'}</span></div>` +
    html`<div><b class="num">${r.s.log.length}</b><span class="muted">ejercicios</span></div>` +
    html`<div><b class="num">${r.series}</b><span class="muted">series</span></div></div>`;
  if (r.vol) h += html`<div class="muted" style="margin-bottom:10px">Volumen: <b class="num" style="color:var(--text)">${r.vol.toLocaleString('es-MX')} lb</b> (carga real × reps, sin calentamientos)</div>`;
  if (r.prs.length) h += html`<div class="card" style="background:var(--acc-weak);border-color:transparent">${r.prs.map(l =>
    html`<div class="row" style="color:var(--acc);font-weight:700;margin:4px 0">${crudo(ICO.trophy)}<span>Récord de ${l.prs.join(' y ')} en ${l.ej}</span></div>`)}</div>`;
  if (r.s.log.length) h += html`<button class="btn ghost block" style="margin-top:4px" ${on('compartirSesion')}>${crudo(ICO.share.replace('class="icon"', 'class="icon" style="vertical-align:-4px;margin-right:6px"'))}Compartir resumen</button>`;
  h += html`<div class="acts"><button class="btn ghost" ${on('cerrarModal')}>Seguir entrenando</button><button class="btn" ${on('cerrarSesion')}>Terminar</button></div>`;
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
  t.innerHTML = html`<div class="tour-tapa"></div><div class="tour-luz" style="left:${r.left - 6}px;top:${r.top - 6}px;width:${r.width + 12}px;height:${r.height + 12}px"></div>` +
    html`<div class="tour-burbuja" style="${abajo ? 'top:' + Math.min(innerHeight - 220, r.bottom + 16) : 'bottom:' + Math.min(innerHeight - 220, innerHeight - r.top + 16)}px">` +
    html`<div class="muted" style="font-size:13px">Paso ${TOUR_I + 1} de ${TOUR.length}</div><div class="t2" style="margin:2px 0 4px">${paso.t}</div><div>${paso.d}</div>` +
    html`<div class="row between" style="margin-top:12px"><button class="link" ${on('terminarTour')}>Saltar</button><button class="btn" ${on('tourSiguiente')}>${ultimo ? '¡Listo!' : 'Siguiente'}</button></div></div>`;
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
  el.innerHTML = html`<div class="rrow">${crudo(ICO.timer)}${DESCANSOS.map(s => html`<button class="rbtn${s === def ? ' def' : ''}" ${on('iniciarRest', s)}>${mmss(s)}</button>`)}` +
    html`<button class="rbtn x" ${on('ocultarRest')} aria-label="Cerrar">✕</button></div>`;
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
    el.innerHTML = html`<div class="rrow"><div style="flex:1"><div class="big">¡Siguiente serie!</div></div><button class="rbtn" style="flex:none;padding:10px 16px" ${on('detenerRest')}>OK</button></div>`;
    if (left < -20) detenerRest();
    return;
  }
  el.className = 'rest show';
  el.innerHTML = html`<div class="rrow">${crudo(ICO.timer)}<div class="big num" style="min-width:64px">${mmss(left)}</div>` +
    html`<div style="flex:1"></div><button class="rbtn" style="flex:none;padding:10px 12px" ${on('sumarRest', 30)}>+30 s</button>` +
    html`<button class="rbtn" style="flex:none;padding:10px 12px" ${on('detenerRest')}>Omitir</button></div>` +
    html`<div class="rbar"><div style="width:${Math.max(0, Math.min(100, 100 - left / r.dur * 100))}%"></div></div>`;
}
