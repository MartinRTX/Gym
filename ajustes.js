// Bienvenida, Ajustes y diagnóstico del APK
// (Parte de la app: se carga después de progreso.js; ver el orden en index.html)

/* ===================== BIENVENIDA (una sola vez, para quien no es el dueño) ===================== */
let BV = null;
function abrirBienvenida() {
  if (BV_POSPUESTA || sesionActiva() || $('modal').classList.contains('show')) return;
  if (!BV) BV = { peso: '', dias: (DATA.dias || [1, 2, 3, 4, 5]).slice(), km: 0, fecha: '' };
  const meta = BV.peso ? Math.round(Number(BV.peso) * 1.6 / 5) * 5 : null;
  $('sheet').innerHTML = html`<div class="bv"><div class="t2">¡Bienvenido, ${DATA.nombre || ''}!</div>` +
    html`<div class="muted" style="margin-top:4px">3 datos y listo: con esto ajusto tu meta de proteína y tus avisos.</div>` +
    html`<label>1. Tu peso (kg)</label><input type="number" inputmode="decimal" step="0.1" id="bvPeso" placeholder="Ej. 72" value="${BV.peso}" ${ev('input', 'bvPeso', VALOR)}>` +
    html`<div class="muted" id="bvMeta" style="margin-top:6px">${textoMetaBV(meta)}</div>` +
    html`<label>2. ¿Qué días entrenas?</label><div class="muted">Esos días te llega el aviso a las 5:00 am.</div><div class="dias">${
      [1, 2, 3, 4, 5, 6, 0].map(d => html`<button class="${BV.dias.includes(d) ? 'on' : ''}" ${on('bvDia', d)}>${DIAS_CORTOS[d]}</button>`)}</div>` +
    html`<label>3. ¿Tienes alguna carrera?</label><div class="pills" style="display:grid;grid-template-columns:repeat(4,1fr);margin:0">${
      [[0, 'No'], [5, '5 km'], [10, '10 km'], [21, '21 km']].map(x => html`<button class="${BV.km === x[0] ? 'on' : ''}" ${on('bvKm', x[0])}>${x[1]}</button>`)}</div>` +
    (BV.km ? html`<input type="date" id="bvFecha" min="${hoy()}" value="${BV.fecha}" ${ev('change', 'bvFecha', VALOR)}>` : '') +
    html`<label>4. ¿Ya sabes usar las máquinas del gym?</label><div class="pills" style="display:grid;grid-template-columns:1fr 1fr;margin:0">${
      [[false, 'Sí, ya sé'], [true, 'Soy nuevo']].map(x => html`<button class="${!!BV.sencillo === x[0] ? 'on' : ''}" ${on('bvSencillo', x[0])}>${x[1]}</button>`)}</div>` +
    (BV.sencillo ? html`<div class="muted" style="margin-top:6px">Te pongo el modo sencillo: te digo qué hacer paso a paso. Lo quitas en Ajustes.</div>` : '') +
    html`<div class="acts"><button class="btn ghost" ${on('posponerBienvenida')}>Ahora no</button><button class="btn" ${on('guardarBienvenida')}>Listo</button></div></div>`;
  abrirModal();
}
function bvToggle(lista, d) { return lista.includes(d) ? lista.filter(x => x !== d) : lista.concat([d]).sort(); }
// La meta de proteína que sale de tu peso (o la invitación a ponerlo)
const textoMetaBV = m => m ? html`Tu meta de proteína: <b style="color:var(--text)">${m} g al día</b>` : 'Con tu peso calculo tu meta de proteína.';
function bvMeta() {
  const m = Number(BV.peso) >= 30 ? Math.round(Number(BV.peso) * 1.6 / 5) * 5 : null;
  $('bvMeta').innerHTML = html`${textoMetaBV(m)}`;
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
// Ícono de Ajustes: HTML de la app (crudo), así entra tal cual en la plantilla
const svgA = d => crudo('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>');
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
  const tog = (k, d, txt, sub, ic, color) => html`<div class="opt tarj"><span class="aic" style="--c:var(--${color})">${ic}</span><div class="txt"><div class="t1" style="font-size:15px">${txt}</div><div class="muted">${sub}</div></div>` +
    html`<button class="tog${ajuste(k, d) ? ' on' : ''}" ${on('toggleAjuste', String(k), d)} aria-label="${txt}"></button></div>`;
  const def = ajuste('descanso', 90), c = DATA.carrera;
  const sec = (ic, color, txt) => html`<div class="t1 asec"><span style="color:var(--${color})">${ic}</span>${txt}</div>`;
  // Tarjeta con ícono, título y explicación (avisos y opciones sin interruptor); "fin" va a la derecha (un botón)
  const tarjeta = (clase, ic, color, txt, sub, fin) => html`<div class="${clase}"><span class="aic" style="--c:var(--${color})">${ic}</span><div class="txt"><div class="t1" style="font-size:15px">${txt}</div><div class="muted">${sub}</div></div>${fin || ''}</div>`;
  const fallas = LS.get('gym_jserr', []).length + LS.get('gym_errores', []).length;
  $('sheet').innerHTML = html`<div class="row between ajhead"><div class="t2">Ajustes</div><button class="cerrar" ${on('cerrarModal')} aria-label="Cerrar">✕</button></div>` +
    tog('animaciones', true, 'Animación de cada ejercicio', 'Una figura hace el movimiento con su equipo y su tempo; el músculo que trabaja en naranja', AIC.flechas, 'pri') +
    tog('sencillo', false, 'Modo sencillo', 'Para quien empieza: «Hoy te toca» en 3 pasos, una instrucción por serie y menos pestañas (sin Músculos ni Coach)', AIC.chispa, 'ok') +
    tarjeta('opt tarj', AIC.flechas, 'pri', 'Tour de la app', '4 pasos: dónde pesarte, elegir el día, anotar series y la comida', html`<button class="btn ghost sm" ${on('iniciarTour')}>Ver</button>`) +
    tog('pantalla', true, 'Pantalla encendida en la sesión', 'Para que el descanso suene y no tengas que desbloquear', AIC.cel, 'cyan') +
    tog('reloj', NATIVO, 'Avisar al terminar el descanso', NATIVO ? 'Notificación con vibración aunque la pantalla esté bloqueada; llega a tu reloj' : 'Notificación al terminar (solo si la app está abierta; en el APK llega aunque bloquees)', AIC.campana, 'acc') +
    tog('autoDescanso', false, 'Iniciar el descanso solo', 'Si está apagado, solo te sugiere tiempos al marcar una serie', AIC.reloj, 'ok') +
    tog('iaPlan', true, 'Plan del día con IA', 'Al abrir Entrenar: un foco para la sesión y una meta por ejercicio', AIC.chispa, 'pri') +
    tog('ia', true, 'La IA afina el consejo entre series', 'El motor te dice al instante qué hacer en la siguiente serie (sin señal); con señal, Gemini elige entre sus opciones y te explica por qué', AIC.cerebro, 'pri') +
    (!scriptAlDia() ? tarjeta('opt tarj aviso-script', AIC.tabla, 'acc', 'Actualiza tu script a la ' + SCRIPT_ESPERADO,
        'Tu hoja tiene la ' + (DATA.scriptVersion || 'anterior a la 7.4') + '. La app funciona, pero sin las mejoras nuevas del script (te lo manda tu coach).')
      : !motorAlDia() ? tarjeta('opt tarj aviso-script', AIC.tabla, 'acc', 'Actualiza Progresion.gs en tu script',
        (DATA.motorFirma ? 'El motor de progresión de tu hoja es de otra versión' : 'A tu proyecto de Apps Script le falta el archivo Progresion.gs') +
        '. Mientras, la app calcula la sugerencia de cada ejercicio con su propio motor.') : '') +
    (NATIVO && APK_OK === false ? tarjeta('opt tarj aviso-script', AIC.cel, 'acc', 'Instala el APK nuevo',
      'Tu APK es anterior a la 7.5: descarga Gym.apk de nuevo (Releases del repo) e instálalo encima, sin desinstalar. Trae el aviso de pasos, el diagnóstico y los trotes con distancia.') : '') +
    (NATIVO ? tog('salud', false, 'Health Connect (solo lectura)', 'Lee tus pasos, sueño y carreras de los últimos 7 días y los pasa a tu hoja. Nunca escribe nada', AIC.corre, 'ok') +
      (ajuste('salud', false) ? tog('avisoPasos', true, 'Aviso de pasos a las 5 pm', 'De lunes a viernes, si vas atrasado: "Son las 5 pm y llevas 3,200 pasos: camina 15 minutos"', AIC.corre, 'cyan') +
        (ajuste('avisoPasos', true) ? tarjeta('opt', AIC.corre, 'cyan', 'Meta de pasos', 'Al día; el aviso compara con lo que llevarías a esa hora',
          html`<div class="unit paso c-cyan"><button ${on('cambiarMetaPasos', -500)}>−</button><button class="on num" style="pointer-events:none">${META_PASOS().toLocaleString('es-MX')}</button><button ${on('cambiarMetaPasos', 500)}>+</button></div>`) : '') : '') +
      tarjeta('opt tarj', AIC.cel, 'cyan', 'Widgets y accesos directos', 'Widgets: mantén presionada la pantalla de inicio → Widgets → Gym. Accesos: mantén presionado el ícono de la app') +
      tarjeta('opt tarj', AIC.cerebro, 'pri', 'Diagnóstico', '¿Health Connect o un widget no responden? Revisa permisos, de qué apps llegan tus datos y qué widgets tienes',
        html`<button class="btn ghost sm" ${on('abrirDiagnostico')}>Revisar</button>`) : '') +
    tog('ruta', true, 'Ruta de hoy', 'Te dice qué zona te falta en la semana y cuáles 2–4 ejercicios la cierran', AIC.flechas, 'ok') +
    (NATIVO ? tog('avisoPeso', true, 'Aviso para pesarte a las 7 am', 'Solo si ese día aún no te pesas; al tocarlo abre el teclado con tu último peso', AIC.campana, 'cyan') : '') +
    tog('avisoProt', true, 'Aviso de proteína a las 6 pm', 'Cuánto llevas y qué de lo que comes la completa (sábado y domingo aunque no abras la app)', AIC.cubiertos, 'acc') +
    tog('avisoKcal', true, 'Aviso de calorías a las 9 pm', 'Solo si te faltan o te pasaste más de 350 kcal de tu meta', AIC.cubiertos, 'acc') +
    tog('calentamiento', true, 'Calentamiento automático', 'En los básicos, al abrirlos: barra sola × 10, 50 % × 8 y 75 % × 3, marcadas C (no cuentan para tu volumen)', AIC.flama, 'red') +
    html`<div class="opt" style="display:block">${sec(AIC.reloj, 'cyan', 'Descanso predeterminado')}<div class="pills c-cyan" style="margin:0;display:grid;grid-template-columns:repeat(4,1fr)">${
      DESCANSOS.map(s => html`<button class="${s === def ? 'on' : ''}" ${on('elegirDescanso', s)}>${mmss(s)}</button>`)}</div></div>` +
    html`<div class="opt" style="display:block">${sec(AIC.flechas, 'pri', 'Objetivo de músculo')}<div class="muted">${FOCOS[focoMus()][1]}. Cambia las metas del mapa de músculos.</div>` +
    html`<div class="pills c-pri" style="margin:8px 0 0;display:grid;grid-template-columns:repeat(3,1fr)">${Object.keys(FOCOS).map(f => html`<button class="${f === focoMus() ? 'on' : ''}" ${on('setFoco', String(f))}>${FOCOS[f][0]}</button>`)}</div></div>` +
    tarjeta('opt', AIC.cubiertos, 'ok', 'Meta de proteína', 'Unos 1.6–2 g por kilo de tu peso',
      html`<div class="unit paso c-ok"><button ${on('cambiarMeta', -5)}>−5</button><button class="on num" style="pointer-events:none">${metaProt()} g</button><button ${on('cambiarMeta', 5)}>+5</button></div>`) +
    html`<div class="opt" style="display:block">${sec(AIC.cal, 'acc', 'Días de aviso')}<div class="muted">Esos días te llega a las 5:00 am lo que te toca</div><div class="dias">${
      [1, 2, 3, 4, 5, 6, 0].map(d => html`<button class="${(DATA.dias || []).includes(d) ? 'on' : ''}" ${on('cambiarDias', d)}>${DIAS_CORTOS[d]}</button>`)}</div></div>` +
    tarjeta('opt', AIC.regla, 'cyan', 'Meta de cintura', DATA.cuerpo && DATA.cuerpo.actual ? 'Hoy: ' + DATA.cuerpo.actual + ' cm' : 'A la altura del ombligo',
      DATA.cuerpo && DATA.cuerpo.meta
        ? html`<div class="unit paso c-cyan"><button ${on('cambiarMetaCintura', -0.5)}>−</button><button class="on num" style="pointer-events:none">${DATA.cuerpo.meta} cm</button><button ${on('cambiarMetaCintura', 0.5)}>+</button></div>`
        : html`<button class="btn ghost sm" ${on('cambiarMetaCintura', 0)}>Poner meta</button>`) +
    html`<div class="opt" style="display:block">${sec(AIC.corre, 'red', 'Carrera')}<div class="muted">Con una carrera de 5 km activa tu plan de 6 semanas en la pestaña Trote</div>` +
    html`<input type="date" id="carFecha" min="${hoy()}" value="${c ? c.fecha : ''}">` +
    html`<div class="pills c-red" style="display:grid;grid-template-columns:repeat(4,1fr);margin:0">${[5, 10, 21].map(k => html`<button class="${c && c.km === k ? 'on' : ''}" ${on('guardarCarrera', k)}>${k} km</button>`)}` +
    html`<button ${on('guardarCarrera', 0)}>Ninguna</button></div></div>` +
    tarjeta('opt tarj', AIC.nube, 'ok', 'Respaldo', 'Descarga lo que tiene la app en este celular', html`<button class="btn sm verde" ${on('descargarRespaldo')}>⬇ Descargar</button>`) +
    tarjeta('opt tarj', AIC.cerebro, 'acc', 'Lo que falló',
      fallas ? fallas + ' aviso' + (fallas === 1 ? '' : 's') + ' guardado' + (fallas === 1 ? '' : 's') + ' en este celular' : 'Nada falló últimamente',
      fallas ? html`<button class="btn ghost sm" ${on('abrirFallas')}>Ver</button>` : '') +
    html`<a class="btn ghost block hoja" href="${urlSegura(DATA.resumen.sheetUrl)}" target="_blank" rel="noopener">${AIC.tabla} Abrir mi hoja de Google</a>` +
    (NATIVO ? '' : html`<div class="opt"><div class="txt"><div class="t1" style="font-size:15px">Pasar a la app nativa (APK)</div><div class="muted">Copia tu link y pégalo en la app la primera vez</div></div>` +
      html`<button class="btn ghost sm" ${on('copiarLinkConfig')}>Copiar</button></div>`) +
    html`<div class="muted" style="text-align:center;margin-top:14px;font-size:12px">Gym ${VERSION_APP}${NATIVO ? ' (app)' : ''} · ${DATA.nombre || ''}</div>`;
  abrirModal('completa');
}
// Lo que falló: errores de la app y datos que la hoja no aceptó (los de la app también se mandan solos a tu hoja, pestaña Errores)
function abrirFallas(borrar) {
  const js = LS.get('gym_jserr', []).slice().reverse().map(x => ({ cuando: x.ts || x.dia, msg: x.msg, donde: x.donde }));
  const hoja = LS.get('gym_errores', []).slice().reverse().map(x => ({ cuando: x.cuando, msg: (x.que ? x.que + ': ' : '') + x.msg, donde: 'La hoja no lo aceptó' }));
  const l = hoja.concat(js).slice(0, 25), fecha = c => { const d = new Date(c); return isNaN(d) ? String(c || '') : ddmm(claveDia(d)) + (String(c).length > 10 ? ' ' + horaTexto(d) : ''); };
  $('sheet').innerHTML = html`<div class="row between"><div class="t2">Lo que falló</div><button class="btn ghost sm" ${on('abrirAjustes')}>←</button></div>
    <div class="muted" style="margin:4px 0 10px">Lo más reciente arriba. Los errores de la app también llegan a tu hoja (pestaña Errores); si algo se repite, mándale captura a tu coach.</div>
    ${l.length ? l.map(x => html`<div class="falla"><b>${fecha(x.cuando)}</b> ${x.msg}${x.donde ? html`<small>${x.donde}</small>` : ''}</div>`) : html`<div class="muted">Nada por aquí.</div>`}
    ${!l.length ? '' : borrar
      ? html`<div class="muted" style="margin-top:10px">¿Borrar la lista de este celular? (lo de tu hoja se queda)</div><div class="acts"><button class="btn ghost" ${on('abrirFallas')}>No</button><button class="btn" ${on('borrarFallas')}>Sí, borrar</button></div>`
      : html`<div class="acts"><button class="btn ghost" ${on('abrirFallas', true)}>Borrar la lista</button></div>`}`;
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
  if ((k === 'avisoProt' || k === 'avisoKcal' || k === 'avisoPasos' || k === 'avisoPeso') && nuevo && NATIVO) await nativo('LocalNotifications', 'requestPermissions');
  if (k === 'salud' && nuevo && !(await conectarSalud())) return abrirAjustes();
  setAjuste(k, nuevo);
  if (k === 'avisoProt' || k === 'avisoKcal' || k === 'avisoPeso') programarAvisoProt();
  if (k === 'sencillo' || k === 'animaciones') { aplicarSencillo(); pintarTab(); }
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
const encabezadoDiag = () => html`<div class="row between ajhead"><div class="t2">Diagnóstico</div><button class="cerrar" ${on('abrirAjustes')} aria-label="Volver">✕</button></div>`;
async function abrirDiagnostico() {
  $('sheet').innerHTML = html`${encabezadoDiag()}<div class="muted" style="margin:14px 0">Revisando el APK, Health Connect y los widgets…</div>`;
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
  $('sheet').innerHTML = html`${encabezadoDiag()}<div class="diag">${lineasDiagnostico().map(l => l[0] === 'h' ? html`<div class="t1 dh">${l[1]}</div>`
      : html`<div class="dl"><b style="color:var(--${ic[l[0]][1]})">${ic[l[0]][0]}</b><span>${l[1]}</span></div>`)}</div>` +
    html`<div class="diag-bt"><button class="btn sm" ${on('leerSaludDiag')}>Leer ahora</button>` +
    html`<button class="btn ghost sm" ${on('permisosDiagnostico')}>Dar permisos</button>` +
    html`<button class="btn ghost sm" ${on('abrirHealthConnect')}>Abrir Health Connect</button>` +
    html`<button class="btn ghost sm" ${on('widgetsYa')}>Actualizar widgets</button>` +
    html`<button class="btn ghost sm" ${on('copiarDiagnostico')}>Copiar</button></div>` +
    html`<div class="protocolo"><b>¿Sin pasos o sin carreras?</b> Health Connect solo guarda lo que otra app le manda. Abre la app que cuenta tus pasos o registra tus trotes ` +
    html`(Fitbit, Samsung Health, Google Fit, Strava…) y activa compartir con Health Connect. En el Pixel: Ajustes → Seguridad y privacidad → Privacidad → Health Connect → Permisos de apps.</div>`;
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
