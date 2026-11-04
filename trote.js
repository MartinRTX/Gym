// Trote: registro, plan para la carrera y lo que sigue después de la carrera
// (Parte de la app: se carga después de sesion.js; ver el orden en index.html)

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
  return crudo(html`<div class="card"><div class="row between"><div class="t1">Fácil vs. intenso · 7 días</div><span class="num muted">${Math.round(p.total * 10) / 10} km</span></div>` +
    html`<div class="polar"><div class="f" style="width:${p.facil / p.total * 100}%"></div><div class="i" style="width:${p.intenso / p.total * 100}%"></div><div class="meta"></div></div>` +
    html`<div class="leyenda"><span><i style="background:var(--cyan)"></i>Fácil ${p.pct} %</span><span><i style="background:var(--acc)"></i>Intenso ${100 - p.pct} %</span><span>| meta: 80 / 20</span></div>` +
    html`<div class="${cls}" style="margin:10px 0 0">${msg}</div></div>`);
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
  if (TROTE.leyendo) return html`<div class="foco"><span class="i">✨</span><div style="flex:1"><div class="muted" style="font-size:13px">Leyendo tu captura…</div><div class="brillo linea-esq" style="width:85%"></div><div class="brillo linea-esq" style="width:55%"></div></div></div>`;
  const r = TROTE.ia;
  if (!r) return '';
  const z = r.zonas || {}, zs = ['z1', 'z2', 'z3', 'z4', 'z5'].map(k => Number(z[k]) || 0), zt = zs.reduce((a, b) => a + b, 0);
  const datos = [[r.km, 'km'], [r.min ? mmss(r.min * 60) : null, 'tiempo'], [r.fc, 'ppm prom.'], [r.cad, 'cadencia'], [r.desnivel !== null && r.desnivel !== undefined ? r.desnivel + ' m' : null, 'desnivel'], [r.temp !== null && r.temp !== undefined ? r.temp + ' °C' : null, 'clima']]
    .filter(x => x[0] !== null && x[0] !== undefined);
  return crudo(html`<div class="foco entra" style="display:block"><b>✨ Leído de tu captura</b>` +
    html`<div class="datos">${datos.map(x => html`<div><b class="num">${String(x[0])}</b><span>${x[1]}</span></div>`)}</div>` +
    (zt ? html`<div class="muted" style="font-size:12px">Tiempo por zona (Z1 → Z5)</div><div class="zonas">${zs.map(v => html`<div style="width:${v / zt * 100}%"></div>`)}</div>` : '') +
    (r.vueltas && r.vueltas.length ? html`<div class="muted" style="font-size:12.5px;margin-top:6px">Vueltas: ${r.vueltas.map(v => v.ritmo).join(' → ')}/km</div>` : '') +
    (r.analisis ? html`<div style="margin-top:8px;font-size:14px">${r.analisis}</div>` : '') +
    html`<div class="muted" style="font-size:12px;margin-top:6px">Ya llené el registro de abajo: revisa y toca Guardar.</div></div>`);
}
function trotesPendientes() { return cola().filter(op => op.action === 'saveTrote').map(op => op.args[0]); }
/* ----- Después de la carrera: al día siguiente la app sale sola del modo carrera y pregunta qué sigue ----- */
function carreraTerminada() { const c = DATA.carrera; return !!(c && c.fecha && c.fecha < hoy()); }
const nombreCarrera = c => c.nombre || c.km + 'K';
function tarjetaPostCarrera() {
  if (!carreraTerminada()) return '';
  return crudo(html`<div class="card postcarrera"><div class="t1">🏅 Ya pasó tu ${nombreCarrera(DATA.carrera)} del ${diaCorto(DATA.carrera.fecha)}. ¿Qué sigue?</div>` +
    html`<div class="muted" style="margin:4px 0 12px">El plan de carrera terminó. Elige tu siguiente objetivo:</div>` +
    html`<button class="btn block" ${on('elegirMantenimiento')}>💪 Músculo + trote de mantenimiento</button>` +
    html`<button class="btn ghost block" style="margin-top:8px" ${on('otraCarrera')}>🏃 Otra carrera</button>` +
    html`<div class="muted" style="font-size:12.5px;margin-top:10px">Mantenimiento: 2 trotes fáciles de 25–30 min por semana para no perder la condición, y la prioridad pasa al gym.</div></div>`);
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
  return crudo(html`<div class="card"><div class="row between"><div class="t1">Trote de mantenimiento</div><span class="pill ${n >= 2 ? 'ok' : 'pri'} num">${Math.min(n, 2)} de 2</span></div>` +
    html`<div class="muted" style="margin-top:4px">2 salidas fáciles de 25–30 min por semana, a ritmo en el que puedas platicar. Mantienen tu condición sin quitarle piernas al gym.${
      n >= 2 ? ' Esta semana ya cumpliste ✓' : ''}</div></div>`);
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
    h += html`<div class="card plan5k"><div class="row between" style="align-items:flex-start"><div><div class="count num">${p.faltan}<span> día${p.faltan === 1 ? '' : 's'} para tu ${p.carrera.nombre}</span></div>` +
      html`<div class="muted">Fecha objetivo: <b style="color:var(--red)">${diaCorto(p.carrera.fecha)}</b></div></div>` +
      (ses ? html`<span class="pill pri">Semana ${p.semana} de ${p.total}</span>` : '') + '</div>';
    if (ses) {
      const minHechos = ses.filter(s => s.hecho).reduce((a, s) => a + (s.real || s.min), 0);
      const paloma = crudo(ICO.check.replace('class="icon"', 'class="icon" style="width:16px;height:16px"'));
      h += html`<div class="pseslist">${ses.map((s, i) => crudo(html`<div class="pses${s.hecho ? ' ok' : ''}"><div class="ck">${s.hecho ? paloma : i + 1}</div>` +
        html`<div style="flex:1"><div class="t1" style="font-size:15px">${s.tipo}${s.ritmo ? html` <span class="num ritmo">· ${s.ritmo}/km</span>` : ''}</div><div class="muted">${s.txt}</div></div>` +
        html`<span class="estado">${s.hecho ? 'Listo' : 'Pendiente'}</span></div>`))}</div>` +
        html`<div class="muted" style="margin-top:12px">Esta semana: <b class="num" style="color:var(--text)">${Math.round(minHechos)} de ~${p.minMeta} min</b>${
          p.ritmos ? (p.ritmos.fijos ? ' · ritmos de tu plan; meta de carrera ' + p.ritmos.carrera + '/km' : ' · ritmos según tu mejor salida reciente (' + p.ritmos.ref + '/km)')
                  : ' · aún sin salidas de 4 km o más para calcular tus ritmos'}</div>` +
        html`<div class="minbar"><div style="width:${Math.min(100, minHechos / p.minMeta * 100)}%"></div></div>`;
    } else if (p.empieza) h += html`<div class="muted" style="margin-top:8px">Tu plan de 6 semanas empieza el ${diaCorto(p.empieza)}. Mientras, trota como siempre.</div>`;
    h += '</div>';
  }
  const ritmo = TROTE.km && TROTE.min ? mmss(TROTE.min * 60 / TROTE.km) + ' min/km' : '—';
  const hid = LS.get('gym_hidrata_' + hoy(), null);
  if (hid && !FECHA) h += html`<div class="tip" style="margin:0 0 12px">💧 ${hid}</div>`;
  // Un dato del registro (km, minutos, pulso): el botón abre el teclado; vacío enseña la unidad en gris
  const dato = (campo, nombre, vacio, valor) => html`<div style="flex:1"><div class="muted">${nombre}</div><button class="val num${TROTE[campo] === '' ? ' vacio' : ''}" style="margin-top:4px" ${on('tecladoTrote', campo)}>${TROTE[campo] === '' ? vacio : valor}</button></div>`;
  h += html`<div class="card trote"><div class="row between" style="margin-bottom:12px"><div class="cap-t">Registrar trote${FECHA ? ' · ' + diaCorto(FECHA) : ''}</div>${
    DATA.ia ? html`<span class="sincro">⚡ Sync auto</span>` : ''}</div>${
    DATA.ia ? html`<button class="cap" ${on('elegirCapturas')}${TROTE.leyendo ? ' disabled' : ''}>${crudo(ICO_CAM)} Leer captura de Samsung Health</button>` : ''}${tarjetaLectura()}` +
    html`<div class="row datos3" style="gap:10px">${dato('km', 'Kilómetros', 'km', TROTE.km)}${dato('min', 'Minutos', 'min', Number(TROTE.min) % 1 ? mmss(TROTE.min * 60) : TROTE.min)}${dato('fc', 'FC prom.', 'ppm', TROTE.fc)}</div>` +
    html`<div class="muted" style="margin:10px 0 4px">Ritmo: <b class="num" style="color:var(--text)">${ritmo}</b>${
      TROTE.fc !== '' ? html` · ${Number(TROTE.fc) <= FC_FACIL ? html`<b style="color:var(--ok)">zona fácil</b>` : html`<b style="color:var(--acc)">intenso</b>`}` : ''}</div>` +
    html`<div class="pills">${TIPOS_TROTE.map(t => html`<button class="${TROTE.tipo === t ? 'on' : ''}" ${on('troteTipo', t)}>${t}</button>`)}</div>` +
    ((TROTE.tipo === 'Larga' || TROTE.tipo === 'Calidad') && proximoGrupo() === 'Legs' && !FECHA
      ? html`<div class="tip acc" style="margin:4px 0 8px">⚠️ Tu siguiente día de gym es Legs. Si es mañana, hoy mejor una salida fácil: la larga o la de calidad te dejan las piernas cansadas para Legs.</div>` : '') +
    html`<input class="buscar" id="troteNotas" placeholder="Notas (opcional)" style="margin:4px 0 10px" value="${BORR.troteNotas || ''}" ${ev('input', 'borrador', 'troteNotas', VALOR)}>` +
    html`<button class="btn block" ${on('guardarTrote')}>Guardar trote</button></div>`;
  h += tarjetaPolar();
  // Récords de trote (incluye lo que no se ha subido)
  let mejor = DATA.trotes.mejorRitmo ? Object.assign({}, DATA.trotes.mejorRitmo) : null, larga = DATA.trotes.masLarga ? Object.assign({}, DATA.trotes.masLarga) : null;
  pend.forEach(t => {
    const d = ddmm(claveDia(new Date(t.ts)));
    if (t.min && t.km >= 3 && (!mejor || t.min / t.km < mejor.ritmo)) mejor = { ritmo: t.min / t.km, km: t.km, d: d };
    if (!larga || t.km > larga.km) larga = { km: t.km, d: d };
  });
  h += html`<div class="minis"><div class="kpi"><div class="v num">${mejor ? mmss(mejor.ritmo * 60) : '—'}</div><div class="l">Mejor ritmo (3 km o más)</div>${mejor ? html`<div class="d">${mejor.km} km · ${mejor.d}</div>` : ''}</div>` +
    html`<div class="kpi"><div class="v num">${larga ? larga.km + ' km' : '—'}</div><div class="l">Salida más larga</div>${larga ? html`<div class="d">${larga.d}</div>` : ''}</div></div>`;
  if (DATA.trotes.semanas && DATA.trotes.semanas.some(s => s.km)) h += html`<div class="card chart"><div class="row between"><div class="t1">Km por semana</div><span class="muted">Últimos 7 días: <b class="num" style="color:var(--text)">${Math.round(km7 * 10) / 10}</b></span></div>${crudo(barras(DATA.trotes.semanas))}</div>`;
  if (lista.length) h += html`<h2>Últimas salidas</h2><div class="card">${lista.slice(0, 6).map(t => {
    const int = intensidad(t) === 'intenso';
    return html`<div class="rec"><div class="medal ${int ? 'int' : 'fac'}">${crudo(ICO.pausa)}</div><div style="flex:1"><div class="t1 num" style="font-size:15px">${t.km} km${
      t.min ? html` · ${mmss(t.min * 60)} · <span class="${int ? 'rojo' : 'cian'}">${mmss(t.min * 60 / t.km)}/km</span>` : ''}</div><div class="muted">${t.d}${t.tipo ? ' · ' + t.tipo : ''}${
      t.fc ? ' · ' + t.fc + ' ppm' + (intensidad(t) === 'facil' ? ' (fácil)' : ' (intenso)') : ''}${t.pend ? ' · sin subir' : ''}</div></div>${
      t.uid ? html`<button class="btn ghost sm" ${on('borrarTrote', t.uid)}>Borrar</button>` : ''}</div>`;
  })}</div>`;
  return h;
}
function tecladoTrote(f) {
  KP = { trote: f, val: TROTE[f] === '' ? '' : String(TROTE[f]), nuevo: true, f: f === 'km' ? 'w' : 'r' };
  const quick = f === 'km' ? [-1, -0.5, 0.5, 1] : f === 'fc' ? [-10, -1, 1, 10] : [-5, -1, 1, 5];
  $('kpSheet').innerHTML = html`<div class="row between"><div class="t1">Trote · ${f === 'km' ? 'kilómetros' : f === 'fc' ? 'pulso promedio (ppm)' : 'minutos'}</div><button class="btn ghost sm" ${on('cerrarTeclado')}>✕</button></div>` +
    html`<div class="disp num" id="kpDisp"></div><div class="quick" style="grid-template-columns:repeat(4,1fr)">${quick.map(v => html`<button ${on('kpSumar', v)}>${v > 0 ? '+' : '−'}${Math.abs(v)}</button>`)}</div>${crudo(teclas())}` +
    html`<div class="acts"><button class="btn" ${on('kpTrote')}>Listo</button></div>`;
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
