/* Gym v5.4 – app instalable (sirve para varias personas: cada quien con su clave y su propia hoja).
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
/* ----- App nativa (APK con Capacitor): mismos archivos; si corre dentro del APK usa el motor háptico y alarmas reales ----- */
const NATIVO = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
function nativo(plugin, metodo, opts) {
  try { return window.Capacitor.nativePromise(plugin, metodo, opts || {}).catch(() => null); } catch (e) { return Promise.resolve(null); }
}
// Vibración con intención: ligera al teclear, golpe fuerte al marcar serie, patrón de éxito en récord
const HAPTICOS = {
  tecla: [['impact', { style: 'LIGHT' }], 6],
  ok:    [['impact', { style: 'MEDIUM' }], 15],
  serie: [['impact', { style: 'HEAVY' }], 35],
  pr:    [['notification', { type: 'SUCCESS' }], [40, 60, 40, 60, 120]],
  fin:   [['vibrate', { duration: 600 }], [300, 150, 300]],
  error: [['notification', { type: 'ERROR' }], [60, 40, 60]],
  atencion: [['notification', { type: 'WARNING' }], [80, 80, 80]],
};
function hap(tipo) {
  const h = HAPTICOS[tipo] || HAPTICOS.ok;
  if (NATIVO) { nativo('Haptics', h[0][0], h[0][1]); if (tipo === 'pr') setTimeout(() => nativo('Haptics', 'impact', { style: 'HEAVY' }), 220); }
  else vibrar(h[1]);
}
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
const GRUPOS3 = ['Push', 'Pull', 'Legs'];
const DIAS_CORTOS = ['D', 'L', 'M', 'Mi', 'J', 'V', 'S'];   // 0 = domingo … 6 = sábado
// Estilos de la v5.3 y v5.4 (metas, logros, bienvenida, notas); van aquí para no tener que cambiar index.html
const CSS_V53 = `
  .seg.s4 { grid-template-columns: repeat(4, 1fr); }
  .seg.s4 button { font-size: 13px; }
  .metabar { height: 12px; background: var(--card2); border-radius: 99px; overflow: hidden; margin: 10px 0 6px; }
  .metabar div { height: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--pri), var(--ok)); }
  .pts { display: flex; align-items: baseline; gap: 6px; }
  .pts b { font-size: 40px; font-weight: 800; letter-spacing: -.03em; line-height: 1; color: var(--pri); }
  .desglose { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; margin-top: 12px; }
  .desglose .l { font-size: 12.5px; color: var(--muted); display: flex; justify-content: space-between; }
  .desglose .b { height: 6px; background: var(--card2); border-radius: 99px; overflow: hidden; margin-top: 3px; }
  .desglose .b div { height: 100%; background: var(--pri); border-radius: 99px; }
  .meds { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .med { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 12px 6px; text-align: center; }
  .med .i { font-size: 30px; line-height: 1.1; }
  .meds.mini { grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .meds.mini .med { padding: 8px 4px; border-radius: 12px; }
  .meds.mini .i { font-size: 22px; }
  .meds.mini .n { font-size: 11px; font-weight: 600; }
  .med .n { font-size: 12.5px; font-weight: 700; margin-top: 4px; line-height: 1.2; }
  .med .p { font-size: 11px; color: var(--muted); margin-top: 3px; }
  .med.no { background: var(--card2); }
  .med.no .i { filter: grayscale(1); opacity: .4; }
  .med .mb { height: 4px; background: var(--line); border-radius: 99px; overflow: hidden; margin: 6px 8px 0; }
  .med .mb div { height: 100%; background: var(--pri); }
  .dias { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin: 8px 0 4px; }
  .dias button { border: 1.5px solid var(--line); background: var(--card); border-radius: 10px; padding: 9px 0; font-weight: 700; font-size: 13px; color: var(--muted); }
  .dias button.on { background: var(--pri); border-color: var(--pri); color: var(--on-pri); }
  .bv label { display: block; font-weight: 700; margin: 14px 0 4px; }
  .bv input[type=number] { width: 100%; padding: 12px; border: 1.5px solid var(--line); border-radius: 12px; background: var(--card2); color: var(--text); font-size: 18px; font-weight: 700; }
  .pesobtn.vacio { color: var(--pri); font-size: 15px; font-weight: 700; }
  .nota { display: block; width: 100%; text-align: left; border: 0; background: var(--card2); color: var(--text); border-radius: 12px; padding: 9px 12px; font-size: 13.5px; margin: 0 0 10px; }
  .nota .ed { float: right; color: var(--pri); font-weight: 700; font-size: 12.5px; margin-left: 8px; }
  .ajuste-ed { display: flex; gap: 8px; margin: 0 0 10px; }
  .ajuste-ed input { flex: 1; min-width: 0; padding: 10px 12px; border: 1.5px solid var(--pri); border-radius: 12px; background: var(--card2); color: var(--text); font-size: 15px; }
  .swapbtn { flex: none; border: 1.5px solid var(--line); background: var(--card2); color: var(--pri); border-radius: 99px; padding: 6px 10px; font-size: 12.5px; font-weight: 700; }
  .links { display: flex; flex-wrap: wrap; gap: 6px 16px; align-items: center; margin-top: 10px; }
  .esf { margin-top: 10px; }
  .esf .pills { margin-top: 4px; }
  .celebra { text-align: center; padding: 6px 0 2px; }
  .celebra .i { font-size: 64px; line-height: 1.1; animation: pop .5s ease; }
  /* v5.5: volumen en vivo, esfuerzo al terminar, completados y coach IA */
  .vol { display: flex; flex-wrap: wrap; gap: 6px; margin: -4px 0 12px; }
  .vol span { background: var(--card2); border: 1px solid var(--line); border-radius: 99px; padding: 5px 10px; font-size: 12.5px; color: var(--muted); }
  .vol b { color: var(--text); font-weight: 700; margin-right: 3px; }
  .esf.pide { background: var(--acc-weak); border-radius: 14px; padding: 10px 12px; }
  .esf.pide > .muted { color: var(--text); font-weight: 700; }
  details.hechos > summary { color: var(--ok); }
  .ia { display: flex; gap: 8px; align-items: flex-start; background: var(--card2); border-left: 3px solid var(--pri); border-radius: 10px; padding: 9px 12px; margin: 0 0 10px; font-size: 14px; }
  .ia .btn { flex: none; margin-left: auto; }
  .ia.cargando { color: var(--muted); }
  .pasoq { background: var(--card2); border-radius: 12px; padding: 9px 12px; margin: -4px 0 10px; font-size: 13px; color: var(--muted); }
  .pasoq div { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 6px; }
  .pasoq button { border: 1.5px solid var(--line); background: var(--card); color: var(--text); border-radius: 10px; padding: 8px 0; font-weight: 700; }
  .pasoq button.on { border-color: var(--pri); color: var(--pri); }
  /* v5.6: esfuerzo por serie, comida con IA, chat con el coach */
  .set .e { font-size: 10px; font-weight: 800; color: inherit; opacity: .85; display: block; line-height: 1; margin-top: 2px; }
  .iacard textarea, .chatin textarea { width: 100%; min-height: 64px; padding: 10px 12px; border: 1.5px solid var(--line); border-radius: 12px;
    background: var(--card2); color: var(--text); font: inherit; font-size: 15px; resize: vertical; }
  .iacard textarea:focus, .chatin textarea:focus { outline: none; border-color: var(--pri); }
  .iitem { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--line); }
  .iitem:last-of-type { border-bottom: 0; }
  .iitem .nm { flex: 1; min-width: 0; }
  .iitem .nm small { display: block; color: var(--muted); font-size: 12px; }
  .iitem .g { font-weight: 800; color: var(--pri); min-width: 46px; text-align: center; }
  .iitem button.mini { border: 1.5px solid var(--line); background: var(--card); border-radius: 10px; width: 32px; height: 32px; font-weight: 800; }
  .iitem button.mini.on { background: var(--pri); border-color: var(--pri); color: var(--on-pri); }
  .iitem.off .nm, .iitem.off .g { opacity: .4; text-decoration: line-through; }
  .food.fav b::after { content: ' ⭐'; font-size: 11px; }
  .food.quitar { border-color: var(--acc); }
  .chat { display: flex; flex-direction: column; gap: 10px; margin: 6px 0 12px; }
  .msg { max-width: 88%; padding: 10px 13px; border-radius: 16px; font-size: 15px; line-height: 1.45; white-space: normal; word-wrap: break-word; }
  .msg.yo { align-self: flex-end; background: var(--pri); color: var(--on-pri); border-bottom-right-radius: 5px; }
  .msg.coach { align-self: flex-start; background: var(--card); border: 1px solid var(--line); border-bottom-left-radius: 5px; }
  .msg.err { border-color: var(--acc); color: var(--muted); }
  .msg.pensando span { display: inline-block; width: 7px; height: 7px; margin: 0 2px; border-radius: 50%; background: var(--muted); animation: bote 1.2s infinite; }
  .msg.pensando span:nth-child(2) { animation-delay: .15s; } .msg.pensando span:nth-child(3) { animation-delay: .3s; }
  @keyframes bote { 0%, 60%, 100% { opacity: .3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-4px); } }
  .sugs { display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 0 14px; }
  .sugs button { border: 1.5px solid var(--line); background: var(--card); border-radius: 99px; padding: 8px 12px; font-size: 13.5px; text-align: left; }
  .chatin { display: flex; gap: 8px; align-items: flex-end; }
  .chatin textarea { min-height: 46px; }
  @media (prefers-reduced-motion: no-preference) { ::view-transition-group(*) { animation-duration: .28s; } }
  /* v5.7: RIR en línea, pareja, técnica y video */
  .rirx { margin: -2px 0 10px; padding: 8px 10px; border-radius: 12px; background: var(--card2); }
  .rirx .q { font-size: 12.5px; color: var(--muted); margin-bottom: 6px; }
  .rirx .pills { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 0; }
  .rirx .pills button { padding: 9px 4px; font-size: 13px; }
  .rirx.pide { background: var(--acc-weak); }
  .rirx.pide .q { color: var(--text); font-weight: 700; }
  .vidbtn { border: 0; background: transparent; color: var(--muted); padding: 0 0 0 6px; vertical-align: -3px; }
  .vidbtn svg { width: 18px; height: 18px; }
  .vidbtn.tiene { color: var(--pri); }
  .media { position: relative; width: 100%; aspect-ratio: 16 / 9; border-radius: 14px; overflow: hidden; background: #000; margin: 10px 0 12px; }
  .media.vert { aspect-ratio: 9 / 16; height: 48vh; width: auto; margin-left: auto; margin-right: auto; }
  .media iframe, .media video { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
  .media.img { aspect-ratio: auto; background: transparent; }
  .media.img img { width: 100%; display: block; border-radius: 14px; }
  .tecnica { margin: 8px 0 12px; padding-left: 22px; font-size: 17px; line-height: 1.45; }
  .tecnica li { margin-bottom: 6px; }
  .medialink { display: flex; gap: 8px; margin-top: 14px; }
  .medialink input { flex: 1; min-width: 0; padding: 10px 12px; border: 1.5px solid var(--line); border-radius: 12px; background: var(--card2); color: var(--text); font-size: 14px; }
  .parbtn { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 10px; border: 1.5px solid var(--line); background: var(--card);
    color: var(--text); border-radius: 14px; padding: 11px 14px; margin: 0 0 10px; font-weight: 700; font-size: 14.5px; text-align: left; }
  .parbtn .sw { flex: none; width: 40px; height: 24px; border-radius: 99px; background: var(--line); position: relative; transition: background .2s; }
  .parbtn .sw::after { content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform .2s; }
  .parbtn.on { border-color: var(--pri); }
  .parbtn.on .sw { background: var(--pri); }
  .parbtn.on .sw::after { transform: translateX(16px); }
  .quien { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; background: var(--card2); padding: 4px; border-radius: 12px; margin-bottom: 12px; }
  .quien button { border: 0; background: transparent; border-radius: 9px; padding: 9px 6px; font-weight: 700; font-size: 14px; color: var(--muted); }
  .quien button.on { background: var(--pri); color: var(--on-pri); }
  /* v5.8: modalidad, menú ⋮, modo enfoque, video con respaldo, IA en contexto, animaciones */
  .mod { display: inline-block; font-size: 10.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--muted);
    border: 1px solid var(--line); border-radius: 6px; padding: 1px 6px; margin-right: 6px; vertical-align: 1px; }
  .menubtn { flex: none; width: 36px; height: 36px; border-radius: 50%; border: 0; background: transparent; color: var(--muted); font-size: 22px; line-height: 1; font-weight: 800; }
  .menubtn:active { background: var(--card2); }
  .menu { display: flex; flex-direction: column; margin-top: 10px; }
  .menu button { display: flex; gap: 14px; align-items: center; text-align: left; border: 0; background: transparent; color: var(--text); padding: 12px 4px; border-bottom: 1px solid var(--line); }
  .menu button:last-child { border-bottom: 0; }
  .menu .i { width: 28px; text-align: center; font-size: 19px; flex: none; }
  .menu small { display: block; color: var(--muted); font-size: 12.5px; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 70vw; }
  .set.hecho .chk { animation: none; }
  .set.recien .chk { animation: pop .28s ease; }
  .set { transition: opacity .3s ease, background-color .3s ease, box-shadow .3s ease; border-radius: 14px; }
  body.descansando .ex.open .set.hecho { opacity: .42; }
  body.descansando .ex.open .set:not(.hecho):not(.sig) { opacity: .6; }
  body.descansando .ex.open .set.sig { background: var(--pri-weak); box-shadow: 0 0 0 1.5px var(--pri); }
  body.descansando .ex.open .set.sig .tipo { color: var(--pri); }
  .ex-body.entra, .ia.entra, .foco.entra { animation: entra .24s ease-out; }
  @keyframes entra { from { opacity: 0; transform: translateY(-6px); } }
  .foco { display: flex; gap: 10px; align-items: flex-start; background: linear-gradient(135deg, var(--pri-weak), transparent); border: 1px solid var(--line);
    border-radius: 16px; padding: 12px 14px; margin: 0 0 12px; font-size: 14.5px; line-height: 1.4; }
  .foco .i { font-size: 18px; flex: none; }
  .tip.plan { background: var(--pri-weak); color: var(--text); }
  .brillo { background: linear-gradient(90deg, var(--card2) 0%, var(--line) 50%, var(--card2) 100%); background-size: 200% 100%; animation: brillo 1.3s linear infinite; border-radius: 8px; }
  @keyframes brillo { from { background-position: 200% 0; } to { background-position: -200% 0; } }
  .linea-esq { height: 12px; margin: 6px 0; }
  .media .thumb { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .media .play { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 64px; height: 64px; border-radius: 50%; border: 0;
    background: rgba(0, 0, 0, .55); color: #fff; display: grid; place-items: center; z-index: 2; }
  .media .play svg { width: 30px; height: 30px; margin-left: 3px; }
  .media .esq { position: absolute; inset: 0; display: grid; place-items: center; z-index: 1; }
  .media .esq .brillo { position: absolute; inset: 0; border-radius: 0; opacity: .9; }
  .media .esq span { position: relative; color: var(--muted); font-size: 13.5px; font-weight: 700; background: var(--card); padding: 6px 12px; border-radius: 99px; opacity: 0; transition: opacity .2s; }
  .media.lento .esq span, .media.falla .esq span { opacity: 1; }
  .media.falla .esq .brillo { animation: none; }
  .media.falla .play, .media.falla .thumb { display: none; }
  .media.ok .esq { display: none; }
  .media.img { min-height: 180px; position: relative; }
  .media.img.ok { min-height: 0; }
  .media.jugando .thumb, .media.jugando .play { display: none; }
  .mem { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 10px 14px; margin: 4px 0 12px; }
  .mem summary { font-weight: 700; list-style: none; }
  .mem ul { list-style: none; padding: 0; margin: 8px 0 4px; }
  .mem li { display: flex; gap: 8px; align-items: flex-start; padding: 7px 0; border-top: 1px solid var(--line); font-size: 14px; }
  .mem li span { flex: 1; }
  .mem li button { border: 0; background: transparent; color: var(--muted); font-size: 16px; padding: 0 4px; }
  .msg .aprendio { display: block; margin-top: 6px; font-size: 12.5px; color: var(--muted); }
  .debrief .sec2 { margin: 12px 0 0; }
  .debrief .sec2 b { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin-bottom: 3px; }
  .discos { margin: -4px 2px 10px; font-size: 13px; color: var(--muted); }
  .saltar { text-align: right; margin: -6px 2px 8px; font-size: 13px; }
  .saltar .link { color: var(--muted); }
  .mapa { display: flex; justify-content: space-between; gap: 10px; align-items: center; background: var(--card2); border-radius: 12px; padding: 9px 12px; margin: -4px 0 12px; font-size: 13.5px; }
  .cquien { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; background: var(--card2); padding: 4px; border-radius: 12px; margin: 8px 0 10px; }
  .cquien button { border: 0; background: transparent; border-radius: 9px; padding: 9px 4px; font-weight: 700; font-size: 13.5px; color: var(--muted); }
  .cquien button.on { background: var(--pri); color: var(--on-pri); }
  /* v5.9: trote, check-in, mapa muscular y dictado */
  .polar { height: 14px; border-radius: 99px; background: var(--card2); overflow: hidden; display: flex; position: relative; margin: 10px 0 6px; }
  .polar .f { background: var(--ok); } .polar .i { background: var(--acc); }
  .polar .meta { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--text); opacity: .7; left: 80%; }
  .leyenda { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12.5px; color: var(--muted); }
  .leyenda i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }
  .cap { display: flex; gap: 10px; align-items: center; justify-content: center; width: 100%; border: 1.5px dashed var(--pri); background: var(--pri-weak); color: var(--text);
    border-radius: 14px; padding: 12px; font-weight: 700; margin-bottom: 12px; }
  .datos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 10px 0; }
  .datos div { background: var(--card2); border-radius: 12px; padding: 8px; text-align: center; }
  .datos b { display: block; font-size: 18px; } .datos span { font-size: 11.5px; color: var(--muted); }
  .zonas { display: flex; height: 10px; border-radius: 99px; overflow: hidden; margin: 6px 0 2px; }
  .zonas div:nth-child(1) { background: #60A5FA; } .zonas div:nth-child(2) { background: #34D399; } .zonas div:nth-child(3) { background: #FBBF24; }
  .zonas div:nth-child(4) { background: #FB923C; } .zonas div:nth-child(5) { background: #EF4444; }
  .ready .fila { margin-top: 10px; } .ready .fila .muted { font-size: 13px; margin-bottom: 4px; }
  .ready .pills { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 0; }
  .ready .pills button { padding: 10px 4px; }
  .cuerpo { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin: 6px 0 2px; }
  .cuerpo svg { width: 100%; max-height: 380px; }
  .cuerpo { --sil: #ECE8F4; --silb: #CFC8DC; --nzc: #DDD7E8; --z0: #C4BCD4; }
  @media (prefers-color-scheme: dark) { .cuerpo { --sil: #262230; --silb: #3A3546; --nzc: #322D3D; --z0: #4A4458; } }
  .cuerpo .sil { fill: var(--sil); } .cuerpo .sil.borde { stroke: var(--silb); stroke-width: 2; }
  .cuerpo .nz { fill: var(--nzc); stroke: var(--card); stroke-width: 1.1; }
  .cuerpo [data-m] { stroke: var(--card); stroke-width: 1.1; stroke-linejoin: round; cursor: pointer; transition: fill .45s ease, fill-opacity .45s ease; }
  .cuerpo [data-m]:active { opacity: .75; }
  .cuerpo .fib { fill: none; stroke: var(--card); stroke-width: .7; opacity: .55; pointer-events: none; }
  .mz0 { fill: var(--z0); } .mz1 { fill: var(--acc); fill-opacity: .9; } .mz2 { fill: var(--ok); fill-opacity: .9; } .mz3 { fill: var(--bad); }
  .cuerpo .sel { stroke: var(--text) !important; stroke-width: 2 !important; }
  .cuerpo text { fill: var(--muted); font-size: 10px; text-anchor: middle; font-weight: 700; letter-spacing: .06em; }
  .semana { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 6px; }
  .semana .dia { font-weight: 700; font-size: 14px; min-height: 18px; }
  .semana .btn { white-space: nowrap; flex-shrink: 0; }
  .msel { background: var(--card2); border-radius: 12px; padding: 10px 12px; margin-top: 8px; font-size: 14px; }
  .mchips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .mchips button { border: 1px solid var(--line); background: var(--card); color: var(--text); border-radius: 99px; padding: 5px 10px; font-size: 12.5px; }
  .mchips button i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
  .mic { flex: none; width: 52px; height: 52px; border-radius: 50%; border: 0; background: var(--pri-weak); color: var(--pri); display: grid; place-items: center; }
  .mic svg { width: 24px; height: 24px; }
  .mic.oye { background: var(--bad); color: #fff; animation: oye 1.1s ease-in-out infinite; }
  @keyframes oye { 0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, .45); } 50% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } }
  .fila-ia { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
  .fila-ia .btn { flex: 1; }
  @media (prefers-reduced-motion: reduce) { .entra, .set.recien .chk, .brillo, .mic.oye { animation: none !important; } .set { transition: none; } }
`;

/* ===================== Configuración y datos ===================== */
let API = LS.get('gym_api', ''), KEY = LS.get('gym_key', '');
let DATA = null, GRUPO = null, TAB = 'Entrenar', OPEN = null, BUSCA = '', PTAB = 'Semana';
let FECHA = null;              // null = hoy; 'aaaa-mm-dd' = registrando otro día
let GRUPO_MANUAL = false, GRUPO_DIA = null;
// Animaciones de una sola vez: se marcan antes de pintar y se limpian al terminar (así no se repiten en cada toque)
let ANIM_ABRE = null, ANIM_SET = null, ANIM_IA = null, ANIM_PLAN = false;   // el grupo sigue al de hoy salvo que tú elijas otro ese día
let state = {};
let prot = [];
let COMIDA_DIA = null;         // null = hoy; 'aaaa-mm-dd' = registrando la comida de ayer
const diaComida = () => COMIDA_DIA || hoy();
let BV_POSPUESTA = false;      // "Ahora no" en la bienvenida: vuelve a salir la próxima vez que abras la app
let flushing = false, flushTimer = null;
const PLEG = {};               // secciones abiertas a mano

const FOODS = [
  { k: 'Licuado', t: 'Licuado (scoop + leche)', g: 32 },
  { k: 'Scoop', t: 'Scoop con agua', g: 22 },
  { k: 'Tupper carne', t: 'Tupper con carne o pollo', g: 28 },
  { k: 'Tupper pasta', t: 'Tupper de pasta o papa', g: 12 },
  { k: 'Cena huevos', t: 'Cena: 3 de maíz con queso y frijol + 2 huevos', g: 30 },
  { k: 'Cena pollo', t: 'Cena: quesadillas de harina + pollo', g: 40 },
  { k: 'Quesadillas', t: '2 quesadillas solas', g: 16 },
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
// Nombres para avisar qué dato rechazó la hoja
const NOMBRE_OP = { saveExercise: 'Ejercicio', savePeso: 'Peso', saveProteina: 'Proteína', saveCintura: 'Cintura', saveTrote: 'Trote', saveMedia: 'Video', saveAjuste: 'Ajuste de máquina',
                    saveFoto: 'Foto', saveConfig: 'Ajuste', undoById: 'Borrado', undoTrote: 'Borrado de trote', borrarFoto: 'Borrado de foto' };

/* ===================== API ===================== */
async function apiGet(action, clave) {
  const r = await fetch(API + '?action=' + action + '&k=' + encodeURIComponent(clave || KEY), { redirect: 'follow' });
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
function encolar(action, args, tag, clave) {
  let q = cola();
  if (tag) q = q.filter(op => op.tag !== tag);
  q.push({ id: uid(), action: action, args: args, tag: tag || null, k: clave || KEY });
  guardarCola(q);
  clearTimeout(flushTimer); flushTimer = setTimeout(enviar, 1200);
}
async function enviar() {
  const q = cola();
  if (flushing || !q.length || !API) return;
  flushing = true; pintarSync();
  const errores = [];
  try {
    // Cada cambio se manda con la clave con la que se hizo (por si alguien cambió de cuenta en este celular)
    const claves = [...new Set(q.map(op => op.k || KEY))];
    const listos = new Set();
    for (const c of claves) {
      const ops = q.filter(op => (op.k || KEY) === c).map(op => ({ id: op.id, action: op.action, args: op.args }));
      const res = await apiPost('batch', [ops], c);
      res.forEach(r => {
        listos.add(r.id);
        if (!r.ok) {
          const op = q.find(o => o.id === r.id);
          errores.push({ que: NOMBRE_OP[op && op.action] || 'Dato', msg: String(r.error || 'Error'), cuando: hoy() });
        }
      });
    }
    guardarCola(cola().filter(op => !listos.has(op.id)));
  } catch (e) {
    if (/Clave/.test(e.message)) toast('La clave no coincide; revisa la configuración');
    clearTimeout(flushTimer); flushTimer = setTimeout(enviar, 20000);
  } finally { flushing = false; pintarSync(); }
  if (errores.length) {
    // El aviso se queda arriba en Entrenar hasta que tocas "Entendido"
    LS.set('gym_errores', LS.get('gym_errores', []).concat(errores).slice(-10));
    toast('La hoja no aceptó ' + (errores.length === 1 ? 'un dato' : errores.length + ' datos') + '; revisa el aviso');
    if (DATA && TAB === 'Entrenar') pintarEntrenar();
  }
}
function pintarSync() {
  const n = cola().length, el = $('sync');
  if (!el) return;
  if (flushing) { el.className = 'sync'; el.textContent = 'Subiendo…'; }
  else if (n) { el.className = 'sync pend'; el.textContent = n + ' sin subir' + (navigator.onLine ? '' : ' · sin señal'); }
  else { el.className = 'sync ok'; el.textContent = '✓ Al día'; }
}
function avisoErrores() {
  const e = LS.get('gym_errores', []);
  if (!e.length) return '';
  return '<div class="card" style="background:var(--acc-weak);border-color:transparent">' +
    '<div class="t1" style="color:var(--acc)">La hoja no aceptó ' + (e.length === 1 ? 'un dato' : e.length + ' datos') + '</div>' +
    '<div class="muted" style="margin:4px 0 10px">' + e.slice(-3).map(x => esc(x.que + ' (' + ddmm(x.cuando) + '): ' + x.msg)).join('<br>') +
    '<br>Quedó en tu celular, pero no en la hoja. Si no sabes por qué, mándale captura a tu coach.</div>' +
    '<button class="btn ghost sm" onclick="LS.del(\'gym_errores\');pintarEntrenar()">Entendido</button></div>';
}

/* ===================== Arranque ===================== */
function arrancar() {
  const st = document.createElement('style'); st.textContent = CSS_V53; document.head.appendChild(st);
  const p = new URLSearchParams(location.search);
  if (p.get('api') && p.get('k')) {
    const nuevaClave = p.get('k').trim();
    if (KEY && nuevaClave !== KEY) {
      // Otra persona en este celular: borra lo guardado de la cuenta anterior (los pendientes se suben con su clave)
      Object.keys(localStorage).filter(k => /^gym_(data|ses_|wip_|prot_|peso_|cint_|super_|fotos|tipcount|errores|medallas|ayer_no_|food_counts)/.test(k)).forEach(k => LS.del(k));
    }
    API = p.get('api').trim(); KEY = nuevaClave;
    LS.set('gym_api', API); LS.set('gym_key', KEY);
    toast('App configurada ✓');
  }
  const g = p.get('g');
  if (g) { GRUPO = g; OPEN = null; GRUPO_MANUAL = true; GRUPO_DIA = hoy(); }
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
const VERSION_APP = 'v6.1';
// Tu link de configuración (lleva tu clave): para configurar el APK sin escribir nada
function copiarLinkConfig() {
  const link = location.origin + location.pathname + '?api=' + encodeURIComponent(API) + '&key=' + encodeURIComponent(KEY);
  (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(() => toast('Link copiado: pégalo en la app (no lo compartas)'),
    () => toast('No pude copiar; tu link: ' + link.slice(0, 60) + '…'));
}
function guardarConfig() {
  // Si pegas el link completo (…?api=…&key=…) en la casilla de la URL, se toman los dos datos de ahí
  const pegado = $('cfgApi').value.trim();
  if (/[?&]api=/.test(pegado)) {
    try { const u = new URL(pegado); $('cfgApi').value = u.searchParams.get('api') || ''; $('cfgKey').value = u.searchParams.get('key') || $('cfgKey').value; } catch (e) {}
  }
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
    precargarMedia();
    if (DATA.perfil === false && !LS.get('gym_bienvenida', false)) abrirBienvenida();
    else revisarMedallas();
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
function exDe(name) { return esPar(name) ? (PAR && PAR.exs ? PAR.exs[name] : undefined) : DATA.exercises.find(e => e.name === name); }
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
  PAR.exs = {};
  PAR.data.exercises.forEach(e => { PAR.exs['P|' + e.name] = Object.assign({}, e, { name: 'P|' + e.name }); });
  construirEstadosPar(state);
}
async function cargarPareja() {
  const cfg = parejaHoy(), p = parejaDisponible();
  if (!cfg || !p) { PAR = null; return; }
  if (!PAR || PAR.key !== p.key) {
    PAR = { nombre: p.nombre, key: p.key, data: LS.get('gym_par_' + p.key, null), exs: null };
    if (PAR.data) prepararPar();
  }
  if (PAR.cargando) return;
  PAR.cargando = true;
  try {
    const d = await apiGet('data', p.key);
    if (!PAR || PAR.key !== p.key) return;
    PAR.data = d; LS.set('gym_par_' + p.key, d); prepararPar();
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
    LS.set('gym_pareja', { key: p.key, dia: hoy() });
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
function saltado(base, lado) { return !!(saltosPar()[base] || {})[lado]; }
function saltarLado(base, lado) {
  const m = saltosPar(); m[base] = Object.assign({}, m[base]); m[base][lado] = !m[base][lado]; LS.set('gym_parskip_' + hoy(), m);
  hap('tecla');
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
function nuevoEstado(ex, done, id) {
  return { unit: ex.unit, sets: ex.sets.map(s => ({ w: s.w, r: s.r, t: s.t || 'T', ok: false })), rir: '', notas: '',
           uid: id, done: done, edited: false };
}
function superserie() { const s = LS.get('gym_super_' + diaReg(), null); return s && s.length === 2 ? s : null; }
function companero(name) { const s = superserie(); return s && s.includes(name) ? s.find(x => x !== name) : null; }

function pintarTodo() {
  const pend = cola(), w = wip(), viejo = state, dia = diaReg();
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
  prot = cargarProt(diaComida());
  asegurarTabCoach();
  $('brand').innerHTML = 'Gym <span>' + esc(DATA.nombre || '') + '</span>';
  document.title = 'Gym' + (DATA.nombre ? ' ' + DATA.nombre : '');
  pintarFecha();
  $('loading').classList.add('hide'); $('app').classList.remove('hide'); $('nav').classList.remove('hide');
  pintarTab(); pintarSync();
}
// Lo que te toca hoy: lo que ya empezaste hoy; si los datos son de otro día, el siguiente de la rotación
function grupoDeHoy() {
  const yaHoy = sesion().log.map(l => l.name.split(':')[0]).filter(g => GRUPOS3.includes(g)).pop();
  if (yaHoy) return yaHoy;
  if (DATA.todayKey === hoy() || !GRUPOS3.includes(DATA.ultimoGrupo)) return DATA.sugGrupo;
  return DATA.ultimoGrupoFecha === hoy() ? DATA.ultimoGrupo : GRUPOS3[(GRUPOS3.indexOf(DATA.ultimoGrupo) + 1) % 3];
}
// Lo que comiste un día: primero lo guardado en el celular, luego lo que tiene la hoja
function cargarProt(dia) {
  const local = LS.get('gym_prot_' + dia, null);
  if (local) return local;
  const desdeHoja = dia === hoy() ? (fresco() ? DATA.protHoy : null) : (DATA.protAyer && DATA.protAyer.k === dia ? DATA.protAyer : null);
  return desdeHoja && desdeHoja.detalle ? desdeHoja.detalle.split(', ').filter(k => FOODS.some(f => f.k === k) || RE_PROPIO.test(k)) : [];
}
// Lo que registras puede ser un botón fijo (FOODS) o algo propio guardado como "Tacos de asada (27 g)"
const RE_PROPIO = /^(.+) \((\d+(?:\.\d+)?) g\)$/;
function gDe(k) { const f = FOODS.find(x => x.k === k); if (f) return f.g; const m = RE_PROPIO.exec(k); return m ? Number(m[2]) : 0; }
function tDe(k) { const f = FOODS.find(x => x.k === k); if (f) return f.t; const m = RE_PROPIO.exec(k); return m ? m[1] + ' · ' + m[2] + ' g' : k; }
const clavePropia = (t, g) => String(t).replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) + ' (' + Math.round(g) + ' g)';
// Mis comidas: las que guardaste con ⭐ (se guardan en tu configuración, no en el código)
function misComidas() { return (DATA.comidas || []).map(c => ({ k: clavePropia(c.t, c.g), t: c.t, g: c.g, fav: true })); }
function pesoDe(dia) {
  const local = LS.get('gym_peso_' + dia, null);
  return local !== null ? local : (dia === hoy() && fresco() ? DATA.pesoHoy : null);
}
function pintarFecha() {
  const p = pesoDe(hoy());
  $('fecha').innerHTML = esc(fresco() ? DATA.today : 'Sin conexión') + ' · ' + ((DATA.dias || [1, 2, 3, 4, 5]).includes(new Date().getDay()) ? 'hoy toca ' : 'próximo: ') + esc(DATA.sugGrupo) +
    ' (' + DATA.bloquePara[DATA.sugGrupo] + ')' + (p !== null ? ' · <button class="link" style="font-size:inherit;font-weight:600" onclick="PESO_TMP=' + p + ';tecladoPeso()" aria-label="Corregir peso de hoy">' + p + ' kg ✓</button>' : '');
}

function verTab(t) {
  if (t !== 'Comida' && COMIDA_DIA) { COMIDA_DIA = null; prot = cargarProt(hoy()); }
  TAB = t;
  ['Entrenar', 'Comida', 'Progreso', 'Coach'].forEach(x => {
    if (!$('v' + x)) return;
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
  else if (TAB === 'Coach') { if ($('vCoach')) pintarCoach(); else verTab('Entrenar'); }
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
    h += chipsVolumen();
  }
  if (FECHA) h += '<div class="otro">' + ICO.cal + '<span>Registrando para el ' + diaCorto(FECHA) + '</span><button class="btn" onclick="cambiarFecha(null)">Volver a hoy</button></div>';
  h += avisoErrores();
  if (!FECHA && DATA.descargaCarrera) h += '<div class="aviso">' + ICO.flame + '<span>Semana de carrera: descarga. Mitad de series con el mismo peso (ya viene así). Legs a más tardar el lunes; el viernes descansas.</span></div>';
  const diasSin = DATA.ultimoGrupoFecha ? difDias(DATA.ultimoGrupoFecha, hoy()) - 1 : 0;
  if (!FECHA && !activa && diasSin >= 3 && !sesion().log.length)
    h += '<div class="aviso">' + ICO.flame + '<span>Llevas ' + diasSin + ' días sin ir. Hoy toca ' + esc(DATA.sugGrupo) + ': aunque sean 30 minutos, cuenta.</span></div>';
  if (FECHA ? pesoDe(FECHA) === null : (pesoDe(hoy()) === null && !activa)) h += tarjetaPeso();
  else if (!FECHA && new Date().getDay() === 0 && !activa) h += tarjetaCintura();
  if (!FECHA && !activa) h += tarjetaAyer();               // después del peso: en la mañana lo primero es pesarte
  h += '<input class="buscar" id="buscar" type="search" placeholder="Buscar ejercicio…" value="' + esc(BUSCA) + '" oninput="buscar(this.value)">';
  if (BUSCA) {
    const q = BUSCA.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const res = DATA.exercises.filter(ex => (ex.ejercicio + ' ' + ex.musculo).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q));
    h += '<h2>' + res.length + ' resultado' + (res.length === 1 ? '' : 's') + '</h2>' + res.map(tarjetaEjercicio).join('');
    $('vEntrenar').innerHTML = h;
    return;
  }
  const comp = parejaDisponible();
  if (comp && !FECHA) h += '<button class="parbtn' + (parejaHoy() ? ' on' : '') + '" onclick="alternarPareja()"><span>👥 ' +
    (parejaHoy() ? 'Entrenando con ' + esc(comp.nombre) + (PAR && !PAR.exs ? ' · cargando…' : '') : '¿Entrenas con ' + esc(comp.nombre) + ' hoy?') + '</span><span class="sw"></span></button>';
  h += '<div class="chips">' + DATA.chips.concat(['Trote']).map(g => '<button class="chip' + (g === GRUPO ? ' on' : '') + '" onclick="elegirGrupo(\'' + g + '\')">' +
    g + (g === DATA.sugGrupo ? '<span class="dot"></span>' : '') + '</button>').join('') + '</div>';
  if (GRUPO === 'Trote') { $('vEntrenar').innerHTML = h + vistaTrote() + pieFecha(); return; }
  h += tarjetaFoco();
  const hechos = ordenGrupo(GRUPO).flat().filter(e => cardDone(e.name));
  if (hechos.length) h += '<details class="sec hechos"' + (PLEG['hechos' + GRUPO] || hechos.some(e => e.name === OPEN) ? ' open' : '') +
    ' ontoggle="PLEG[\'hechos' + GRUPO + '\']=this.open"><summary>✓ Completados · ' + hechos.length + '</summary>' + hechos.map(tarjetaEjercicio).join('') + '</details>';
  const secs = ordenGrupo(GRUPO).map(items => items.filter(e => !cardDone(e.name)));
  if (hechos.length && !secs.some(x => x.length)) h += '<div class="tip">' + ICO.check + ' Terminaste todo ' + esc(GRUPO) + '. Toca «Terminar» arriba para ver tu resumen.</div>';
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
  ANIM_ABRE = ANIM_SET = ANIM_IA = null; ANIM_PLAN = false;
  if (!planHoy() && !PLAN_CARGANDO) setTimeout(pedirPlan, 0);
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
// La casilla empieza vacía: así nunca se guarda por error el peso de ayer
function tarjetaPeso() {
  const dia = diaReg();
  if (PESO_TMP === null) PESO_TMP = '';
  return '<div class="card"><div class="peso"><div class="lbl"><div class="t1">' + (FECHA ? 'Peso del ' + diaCorto(dia) : 'Peso de hoy') + '</div>' +
    '<div class="muted">' + (DATA.ultimoPeso !== null ? 'Último: <b class="num">' + DATA.ultimoPeso + '</b> kg · en ayunas' : 'En ayunas, después del baño') + '</div></div>' +
    '<button class="pesobtn num' + (PESO_TMP === '' ? ' vacio' : '') + '" onclick="tecladoPeso()">' + (PESO_TMP === '' ? 'Pesar' : PESO_TMP) + '</button>' +
    '<button class="okmark" onclick="' + (PESO_TMP === '' ? 'tecladoPeso()' : 'guardarPeso()') + '" aria-label="Guardar peso">' + ICO.check + '</button></div></div>';
}
function tarjetaCintura() {
  if (LS.get('gym_cint_' + hoy(), null) !== null) return '';
  const ult = DATA.cuerpo && DATA.cuerpo.serie && DATA.cuerpo.serie[DATA.cuerpo.serie.length - 1];
  if (ult && ult.cint !== null && ult.d === ddmm(hoy())) return '';      // ya está en la hoja (desde otro celular o desde el chat)
  return '<div class="card"><div class="peso"><div class="lbl"><div class="t1">Cintura</div><div class="muted">Domingo: a la altura del ombligo</div></div>' +
    '<input id="cintura" class="in num" type="number" inputmode="decimal" step="0.5" placeholder="cm">' +
    '<button class="okmark" onclick="guardarCintura()" aria-label="Guardar cintura">' + ICO.check + '</button></div></div>';
}
function guardarPeso() {
  const v = Number(PESO_TMP);
  if (!v) return toast('Pon tu peso');
  if (v < 30 || v > 250) return toast('Revisa el peso: ' + v + ' kg no parece correcto');
  PESO_TMP = null;
  const dia = diaReg();
  LS.set('gym_peso_' + dia, v);
  encolar('savePeso', [v, dia], 'peso-' + dia);
  hap('ok'); toast('Peso guardado ✓'); pintarFecha(); pintarEntrenar();
}
function guardarCintura() {
  const v = $('cintura').value;
  if (!v) return toast('Escribe tu cintura');
  LS.set('gym_cint_' + hoy(), Number(v));
  encolar('saveCintura', [Number(v), hoy()], 'cintura-' + hoy());
  hap('ok'); toast('Cintura guardada ✓'); pintarEntrenar();
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
  let ico;
  if (st.done) ico = ICO.check;
  else if (enCurso || abierto) ico = anillo(hechas, trabajo.length, false) + '<span class="rt num">' + hechas + '/' + trabajo.length + '</span>';
  else ico = '<span class="num">' + trabajo.length + '</span>';
  const n = jsq(ex.name);
  let h = '<div class="ex' + (abierto ? ' open' : '') + (st.done ? ' done' : '') + (enCurso ? ' prog' : '') + '" id="ex-' + esc(ex.name) + '" style="view-transition-name:ex' + DATA.exercises.indexOf(ex) + '">' +
    '<div class="ex-head" onclick="abrir(\'' + n + '\')"><div class="ex-ico">' + ico + '</div>' +
    '<div style="flex:1;min-width:0"><div class="ex-name">' + esc(ex.ejercicio) + botonTecnica(ex) + (par && !st.done ? '<span class="sstag">Superserie</span>' : '') + '</div><div class="ex-meta">' + badgeMod(ex) + meta + '</div></div>' +
    (ex.up && !st.done ? '<span class="pill acc">' + ICO.up + 'Sube</span>' : '') +
    (abierto ? '<button class="swapbtn" onclick="event.stopPropagation();elegirCambio(\'' + n + '\')" aria-label="Máquina ocupada: cambiar ejercicio">⇄</button>' +
      '<button class="menubtn" onclick="event.stopPropagation();menuEjercicio(\'' + n + '\')" aria-label="Más opciones">⋮</button>' : '') + '</div>';
  if (st.done && OPEN === ex.name) {
    h += '<div class="ex-body"><div class="acts">' + (st.uid ? '<button class="btn ghost sm" onclick="deshacer(\'' + n + '\')">Borrar</button>' : '') +
      '<button class="btn ghost sm" onclick="corregir(\'' + n + '\')">' + (st.uid ? 'Corregir' : 'Registrar otra vez') + '</button></div></div>';
  } else if (abierto) h += '<div class="ex-body' + (ANIM_ABRE === ex.name ? ' entra' : '') + '">' + cuerpoEjercicio(ex, st) + '</div>';
  return h + '</div>';
}

/* ----- Técnica y video del ejercicio (Catálogo: Q = link, R = técnica) ----- */
function badgeMod(ex) { return ex && ex.modalidad ? '<span class="mod">' + esc(ex.modalidad) + '</span>' : ''; }
function botonTecnica(ex) {
  return '<button class="vidbtn' + (ex.media ? ' tiene' : '') + '" onclick="event.stopPropagation();verTecnica(\'' + jsq(ex.name) + '\')" aria-label="Ver técnica y video">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M10 8.5v7l5.5-3.5z" fill="currentColor"/></svg></button>';
}
// YouTube (normal, Shorts o youtu.be) se incrusta; MP4/WebM se reproduce en bucle; GIF o imagen se muestra; lo demás, botón para abrir
function reproductor(url) {
  if (!url) return '';
  const esq = '<div class="esq"><div class="brillo"></div><span>Cargando…</span></div>';
  const yt = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) {
    // Primero la miniatura (queda guardada en el celular); el video solo se carga si tocas ▶
    return '<div class="media' + (/shorts\//.test(url) ? ' vert' : '') + '" data-yt="' + yt[1] + '">' +
      '<img class="thumb" src="https://i.ytimg.com/vi/' + yt[1] + '/hqdefault.jpg" alt="" onload="mediaOk(this)" onerror="mediaFalla(this)">' +
      '<button class="play" onclick="reproducirYT(this.parentNode)" aria-label="Reproducir video"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>' + esq + '</div>';
  }
  if (/\.(mp4|webm|mov)(\?|#|$)/i.test(url)) return '<div class="media"><video src="' + esc(url) + '" autoplay muted loop playsinline controls oncanplay="mediaOk(this)" onerror="mediaFalla(this)"></video>' + esq + '</div>';
  if (/\.(gif|png|jpe?g|webp)(\?|#|$)/i.test(url) || /giphy\.com\/media|tenor\.com\/.*\.gif/i.test(url))
    return '<div class="media img"><img src="' + esc(url) + '" alt="Demostración del ejercicio" onload="mediaOk(this)" onerror="mediaFalla(this)">' + esq + '</div>';
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
    'title="Video del ejercicio" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen onload="mediaOk(this)"></iframe>');
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
  $('sheet').innerHTML = '<div class="row between"><div class="t2" style="padding-right:8px">' + esc(ex.ejercicio) + '</div><button class="btn ghost sm" onclick="cerrarModal()">✕</button></div>' +
    reproductor(ex.media) +
    (puntos.length ? '<ol class="tecnica">' + puntos.map(p => '<li>' + esc(p.charAt(0).toUpperCase() + p.slice(1)) + '</li>').join('') + '</ol>' : '<div class="muted" style="margin:10px 0">Sin técnica escrita: agrégala en la columna R del Catálogo.</div>') +
    '<div class="muted" style="font-size:13.5px;margin:4px 0 2px"><b style="color:var(--text)">Cómo anotar el peso:</b> ' + esc(ex.howTo || '—') + ' · ' + ex.min + '–' + ex.max + ' reps</div>' +
    (ex.ajuste ? '<div class="muted" style="font-size:13.5px">⚙️ ' + esc(ex.ajuste) + '</div>' : '') +
    '<div class="medialink"><input id="mediaUrl" type="url" inputmode="url" placeholder="Pega un link de YouTube, GIF o MP4" value="' + esc(ex.media || '') + '">' +
    '<button class="btn sm" onclick="guardarMedia(\'' + n + '\')">Guardar</button></div>' +
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
    '<div class="acts"><button class="btn ghost" onclick="cerrarModal()">Cerrar</button></div></div>';
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
      '<div class="acts">' + ($('nCoach') ? '<button class="btn ghost" onclick="cerrarModal();verTab(\'Coach\')">Ver en Coach</button>' : '') + '<button class="btn" onclick="cerrarModal()">Listo</button></div></div>';
    hap('ok');
  } else toast('Tu coach dejó el resumen de la sesión', '', { txt: 'Ver', fn: () => verTab('Coach') });
}

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
  const exs = (ordenGrupo(GRUPO).find(x => x.length) || []).filter(e => !state[e.name] || !state[e.name].done);
  if (!exs.length) return;
  const g = GRUPO, k = clavePlan();
  PLAN_CARGANDO = true;
  if (TAB === 'Entrenar') pintarEntrenar();
  try {
    const r = await conLimite(apiPost('plan', [{ grupo: g, descarga: !!DATA.descargaCarrera, recuperacion: recuperacion(), ejercicios: exs.map(e => ({
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
  return '<div class="card ready entra"><div class="row between"><div class="t1">¿Cómo vienes hoy?</div><button class="link" onclick="guardarReady(true)">Saltar</button></div>' +
    '<div class="muted" style="font-size:13px">3 toques: tu coach ajusta el plan y el esfuerzo de hoy</div>' +
    Object.keys(READY).map(k => '<div class="fila"><div class="muted">' + READY_TIT[k] + '</div><div class="pills">' +
      READY[k].map(v => '<button class="' + (READY_TMP[k] === v ? 'on' : '') + '" onclick="elegirReady(\'' + k + '\',\'' + v + '\')">' + v + '</button>').join('') + '</div></div>').join('') + '</div>';
}
function elegirReady(k, v) {
  READY_TMP[k] = v; hap('tecla');
  if (Object.keys(READY).every(x => READY_TMP[x])) guardarReady(false); else pintarEntrenar();
}
function guardarReady(saltar) {
  LS.set('gym_ready_' + hoy(), saltar ? { saltado: true } : Object.assign({}, READY_TMP));
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
  if (p && p.foco) return '<div class="foco' + (ANIM_PLAN ? ' entra' : '') + '"><span class="i">✨</span><div><b>Foco de hoy:</b> ' + esc(p.foco) + '</div></div>';
  if (PLAN_CARGANDO) return '<div class="foco"><span class="i">✨</span><div style="flex:1"><div class="muted" style="font-size:13px">Tu coach está preparando el plan de hoy…</div>' +
    '<div class="brillo linea-esq" style="width:90%"></div><div class="brillo linea-esq" style="width:60%"></div></div></div>';
  return '';
}

/* ----- Menú ⋮ del ejercicio: lo secundario, fuera de la vista mientras entrenas ----- */
function menuEjercicio(k) {
  const ex = exDe(k), st = state[k], n = jsq(k), base = baseVista(k), par = esPar(k) ? null : companero(k);
  const item = (ico, txt, sub, fn) => '<button onclick="' + fn + '"><span class="i">' + ico + '</span><span><b>' + txt + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span></button>';
  let h = '<div class="row between"><div class="t2">' + esc(ex.ejercicio) + (esPar(k) ? ' · ' + esc(PAR.nombre) : '') + '</div><button class="btn ghost sm" onclick="cerrarModal()">✕</button></div><div class="menu">';
  h += item('▶', 'Técnica y video', ex.tecnica ? 'Cómo se hace, punto por punto' : 'Agrega un video o GIF', "verTecnica('" + n + "')");
  if (!st.sets.some(s => s.t === 'C') && esBasico(ex)) h += item('🔥', 'Agregar calentamiento', 'Series ligeras antes del peso de trabajo', "cerrarModal();agregarCalentamiento('" + n + "')");
  h += item('⚙️', ex.ajuste ? 'Editar ajuste de máquina' : 'Ajuste de máquina', ex.ajuste || 'Asiento, banco o agarre: te aparece siempre', "cerrarModal();editarAjuste('" + n + "')");
  h += item('⚖️', 'Paso del equipo: ' + pasoEj(ex, st) + ' ' + st.unit + (ex.pasoFijo ? '' : ' (supuesto)'), 'El cambio de peso más chico que permite; toca para cambiarlo', "menuPaso('" + n + "')");
  h += item('📝', st.notas ? 'Editar nota de hoy' : 'Nota de hoy', st.notas || 'Solo de esta sesión: «hombro cargado», «dormí mal»', "notaDeHoy('" + n + "')");
  if (!esPar(k)) h += par ? item('⇆', 'Quitar superserie', 'Con ' + exDe(par).ejercicio, "cerrarModal();quitarSuper()")
                          : item('⇆', 'Superserie', 'Alterna con otro ejercicio y descansa al final del par', "elegirSuper('" + n + "')");
  h += item('⇄', 'Cambiar ejercicio', 'Máquina ocupada o molestia' + (parOn() ? ' (para los dos o solo uno)' : ''), "elegirCambio('" + jsq(base) + "')");
  $('sheet').innerHTML = h + '</div>';
  abrirModal();
}
function menuPaso(k) {
  const ex = exDe(k), st = state[k], p = pasoEj(ex, st);
  $('sheet').innerHTML = '<div class="t2">¿De cuánto en cuánto sube?</div><div class="muted" style="margin:4px 0 10px">' + esc(ex.ejercicio) + ' · ' + esc(ex.howTo) +
    '. Con esto ningún consejo te pedirá un peso que no existe en ese equipo.</div><div class="pills" style="display:grid;grid-template-columns:repeat(4,1fr)">' +
    (st.unit === 'kg' ? [1, 1.25, 2.5, 5, 10, 2, 4, 20] : [1, 2.5, 5, 10, 15, 20, 7.5, 12.5]).map(v => '<button class="' + (v === p ? 'on' : '') + '" onclick="cerrarModal();fijarPaso(\'' + jsq(k) + '\',' + v + ')">' + v + ' ' + st.unit + '</button>').join('') +
    '</div><div class="acts"><button class="btn ghost" onclick="cerrarModal()">Cancelar</button></div>';
  abrirModal();
}
function notaDeHoy(k) {
  $('sheet').innerHTML = '<div class="t2">Nota de hoy</div><div class="muted" style="margin:4px 0 8px">' + esc(exDe(k).ejercicio) + ' · solo de esta sesión; la próxima vez te aparece como «La última vez anotaste»</div>' +
    '<textarea id="notaTxt" rows="3" maxlength="200" style="width:100%;padding:10px 12px;border:1.5px solid var(--line);border-radius:12px;background:var(--card2);color:var(--text);font:inherit">' + esc(state[k].notas || '') + '</textarea>' +
    '<div class="acts"><button class="btn ghost" onclick="cerrarModal()">Cancelar</button><button class="btn" onclick="setNotas(\'' + jsq(k) + '\', $(\'notaTxt\').value.trim());cerrarModal();pintarEntrenar()">Guardar</button></div>';
  abrirModal();
  setTimeout(() => { const t = $('notaTxt'); if (t) t.focus(); }, 60);
}

// Vista en pareja: el encabezado resume a los dos; el cuerpo es el de la pestaña elegida
function tarjetaPareja(ex) {
  const base = ex.name, pk = parKey(base), yo = state[base], pa = state[pk], mapeado = pk !== 'P|' + base;
  const lado = ladoVisible(base) === 'par' ? 'par' : 'yo', k = lado === 'par' ? pk : base, st = state[k], exV = exDe(k);
  const hecho = cardDone(base), abierto = OPEN === base || (companero(base) && OPEN === companero(base));
  const cuenta = x => { const t = x.sets.filter(s => s.t !== 'C'); return { h: t.filter(s => s.ok).length, t: t.length }; };
  const cy = cuenta(yo), cp = cuenta(pa);
  const prog = (x, c, l) => x.done ? '✓' : saltado(base, l) ? 'no hoy' : c.h + '/' + c.t;
  const meta = badgeMod(ex) + 'Tú ' + prog(yo, cy, 'yo') + ' · ' + esc(PAR.nombre) + (mapeado && exDe(pk) ? ' (' + esc(exDe(pk).ejercicio.split(' (')[0]) + ')' : '') + ' ' + prog(pa, cp, 'par');
  const enCurso = !hecho && (cy.h + cp.h > 0 || yo.done || pa.done);
  const ico = hecho ? ICO.check : anillo(cy.h + cp.h + (yo.done ? cy.t - cy.h : 0) + (pa.done ? cp.t - cp.h : 0), cy.t + cp.t, false);
  const n = jsq(base);
  let h = '<div class="ex' + (abierto ? ' open' : '') + (hecho ? ' done' : '') + (enCurso ? ' prog' : '') + '" id="ex-' + esc(base) + '" style="view-transition-name:ex' + DATA.exercises.indexOf(ex) + '">' +
    '<div class="ex-head" onclick="abrir(\'' + n + '\')"><div class="ex-ico">' + ico + '</div>' +
    '<div style="flex:1;min-width:0"><div class="ex-name">' + esc(ex.ejercicio) + botonTecnica(ex) + '</div><div class="ex-meta">' + meta + '</div></div>' +
    (abierto && !hecho ? '<button class="swapbtn" onclick="event.stopPropagation();elegirCambio(\'' + n + '\')" aria-label="Máquina ocupada: cambiar ejercicio">⇄</button>' : '') +
    (abierto && exV && !st.done ? '<button class="menubtn" onclick="event.stopPropagation();menuEjercicio(\'' + jsq(k) + '\')" aria-label="Más opciones">⋮</button>' : '') + '</div>';
  if (!abierto) return h + '</div>';
  h += '<div class="ex-body' + (ANIM_ABRE === base ? ' entra' : '') + '"><div class="quien">' +
    '<button class="' + (lado === 'yo' ? 'on' : '') + '" onclick="verLado(\'' + n + '\',\'yo\')">Tú · ' + prog(yo, cy, 'yo') + '</button>' +
    '<button class="' + (lado === 'par' ? 'on' : '') + '" onclick="verLado(\'' + n + '\',\'par\')">' + esc(PAR.nombre) + ' · ' + prog(pa, cp, 'par') + '</button></div>';
  // Cada quien puede no hacer este ejercicio: así no se registra nada a su nombre y la tarjeta se puede completar
  const quienTxt = lado === 'par' ? esc(PAR.nombre) : 'Yo';
  if (saltado(base, lado)) return h + '<div class="mapa"><span>' + quienTxt + ' no lo hace hoy</span><button class="link" onclick="saltarLado(\'' + n + '\',\'' + lado + '\')">Sí lo hace</button></div></div></div>';
  if (st && !st.done && !st.sets.some(x => x.ok)) h += '<div class="saltar"><button class="link" onclick="saltarLado(\'' + n + '\',\'' + lado + '\')">' + quienTxt + ' no lo hace hoy</button></div>';
  if (lado === 'par' && mapeado && exV) h += '<div class="mapa"><span>' + esc(PAR.nombre) + ' hace <b>' + esc(exV.ejercicio) + '</b></span>' +
    '<button class="link" onclick="quitarMapa(\'' + n + '\')">Que haga ' + esc(ex.ejercicio.split(' (')[0]) + '</button></div>';
  if (!exV) h += '<div class="tip">Este ejercicio no está en el catálogo de ' + esc(PAR.nombre) + '.</div>';
  else if (st.done) h += '<div class="acts">' + (st.uid ? '<button class="btn ghost sm" onclick="deshacer(\'' + jsq(k) + '\')">Borrar</button>' : '') +
    '<button class="btn ghost sm" onclick="corregir(\'' + jsq(k) + '\')">' + (st.uid ? 'Corregir' : 'Registrar otra vez') + '</button></div>';
  else h += cuerpoEjercicio(exV, st);
  return h + '</div></div>';
}
function cuerpoEjercicio(ex, st) {
  const n = jsq(ex.name);
  let h = '<div class="row between" style="margin-bottom:10px"><div class="muted">' + ex.min + '–' + ex.max + ' reps · ' + esc(ex.howTo) + '</div>' +
    '<div class="unit">' + ['lb', 'kg'].map(u => '<button class="' + (st.unit === u ? 'on' : '') + '" onclick="setUnit(\'' + n + '\',\'' + u + '\')">' + u + '</button>').join('') + '</div></div>';
  const trabAnt = ex.anterior.filter(a => a.t !== 'C');
  const pesoAnt = trabAnt.length ? Math.max.apply(null, trabAnt.map(a => Number(a.w) || 0)) : null;
  const meta = !esPar(ex.name) && planHoy() ? (planHoy().ej || {})[ex.name] : null;
  if (meta) h += '<div class="tip plan">🎯 ' + esc(meta) + '</div>';
  else if (ex.up) h += '<div class="tip acc">' + ICO.up + esc(ex.hint) + '</div>';
  else if (ex.hint && /al fallo/.test(ex.hint)) h += '<div class="tip">' + esc(ex.hint) + '</div>';
  else if (ex.sugerido && (pesoAnt === null || ex.sugerido.w > pesoAnt)) h += '<div class="sug">Sugerido hoy: ' + ex.sugerido.w + ' ' + ex.unit + ' × ' + ex.sugerido.r + ' (RPE 8)' +
    '<button class="btn" onclick="usarSugerido(\'' + n + '\')">Usar</button></div>';
  else if (!trabAnt.length) h += '<div class="tip">Elige un peso que te deje ' + ex.min + '–' + ex.max + ' reps con 1–2 de reserva</div>';
  else if (!/Semana de carrera/.test(ex.hint || '')) h += '<div class="tip">Meta de hoy: mismo peso y 1 rep más en alguna serie (la última vez: ' + trabAnt.map(a => a.r).join(', ') + ')</div>';
  else h += '<div class="tip">' + esc(ex.hint) + '</div>';
  if (st.editAjuste) h += '<div class="ajuste-ed"><input id="aj-' + esc(ex.name) + '" maxlength="120" placeholder="Ej. banco a 30°, asiento en 4, agarre neutro" value="' + esc(ex.ajuste || '') + '">' +
    '<button class="btn sm" onclick="guardarAjuste(\'' + n + '\')">Guardar</button></div>';
  else if (ex.ajuste) h += '<button class="nota" onclick="editarAjuste(\'' + n + '\')">⚙️ ' + esc(ex.ajuste) + '<span class="ed">Editar</span></button>';
  if (ex.notaUlt) h += '<div class="muted" style="margin:-4px 2px 10px;font-size:13px">La última vez anotaste: «' + esc(ex.notaUlt) + '»</div>';
  h += '<div class="sets-h"><span>#</span><span>Anterior</span><span>' + st.unit + '</span><span>Reps</span><span></span></div>';
  const kUlt = ultimaMarcada(st), kSig = st.sets.findIndex(x => !x.ok);
  let num = 0, nc = 0;
  const antC = ex.anterior.filter(a => a.t === 'C'), antT = ex.anterior.filter(a => a.t !== 'C');
  st.sets.forEach((s, i) => {
    if (s.t !== 'C') num++; else nc++;
    const a = s.t === 'C' ? antC[nc - 1] : antT[num - 1];
    const etiqueta = s.t === 'C' ? 'C' : s.t === 'D' ? 'D' : num;
    h += '<div class="set' + (s.ok ? ' hecho' : '') + (i === kSig ? ' sig' : '') + (ANIM_SET === ex.name + '#' + i ? ' recien' : '') + '">' +
      '<button class="tipo ' + (s.t === 'T' ? '' : s.t) + '" onclick="cambiarTipo(\'' + n + '\',' + i + ')" aria-label="Tipo de serie">' + etiqueta + '</button>' +
      '<button class="ant num" onclick="copiarAnterior(\'' + n + '\',' + i + ')">' + (a ? a.w + '×' + a.r : '—') + '</button>' +
      '<button class="val num' + (vacio(s.w) ? ' vacio' : '') + '" onclick="teclado(\'' + n + '\',' + i + ',\'w\')">' + (vacio(s.w) ? 'peso' : s.w) + '</button>' +
      '<button class="val num' + (vacio(s.r) ? ' vacio' : '') + '" onclick="teclado(\'' + n + '\',' + i + ',\'r\')">' + (vacio(s.r) ? 'reps' : s.r) + '</button>' +
      '<button class="chk" onclick="marcar(\'' + n + '\',' + i + ')" aria-label="Serie hecha">' + ICO.check + (s.ok && s.e ? '<span class="e">' + ETQ_E[s.e] + '</span>' : '') + '</button></div>';
    if (i === kUlt) h += filaEsfuerzo(n, st, s) + tipIA(n, st);
  });
  const vistas = LS.get('gym_tipcount', 0);
  if (vistas < 3) h += '<div class="muted" style="margin:-2px 0 8px;font-size:12px">Toca el # para cambiarla a calentamiento (C) o drop (D) · "Anterior" la copia · ⋮ arriba: calentamiento, ajuste, nota y superserie</div>';
  // Si toca subir, "Igual que antes" te regresaría al peso viejo: no se muestra
  const igual = ex.anterior.length && !ex.up;
  h += '<div class="setacts" style="grid-template-columns:' + (igual ? '1.6fr 1fr 1fr' : '1fr 1fr') + '">' +
    (igual ? '<button class="btn ghost sm" onclick="igualQueAntes(\'' + n + '\')">Igual que antes</button>' : '') +
    '<button class="btn ghost sm" onclick="addSet(\'' + n + '\')"' + (st.sets.length >= 10 ? ' disabled' : '') + '>+ Serie</button>' +
    '<button class="btn ghost sm" onclick="delSet(\'' + n + '\')"' + (st.sets.length <= 1 ? ' disabled' : '') + '>− Serie</button></div>';
  // Lo secundario (calentamiento, ajuste, superserie, nota) vive en el menú ⋮; aquí solo se muestra si ya existe
  const par = esPar(ex.name) ? null : companero(ex.name);
  if (par) h += '<div class="muted" style="font-size:13px;margin-top:8px">' + ICO.swap + ' Superserie con <b>' + esc(exDe(par).ejercicio) + '</b></div>';
  if (st.notas) h += '<button class="nota" style="margin-top:8px" onclick="notaDeHoy(\'' + n + '\')">📝 ' + esc(st.notas) + '<span class="ed">Editar</span></button>';

  const hechas = st.sets.filter(s => s.ok).length;
  h += '<div class="acts"><button class="btn" onclick="guardar(\'' + n + '\')">' +
    (hechas && hechas < st.sets.length ? 'Guardar ' + hechas + ' series' : 'Guardar ejercicio') + '</button></div>';
  return h;
}

// Esfuerzo de la serie que acabas de marcar, justo debajo de ella (sin bajar al fondo de la tarjeta)
const CORTO_E = { 'Al fallo': 'Al fallo', 'Casi (1–2 más)': 'Quedaban 1–2', 'Sobraban 3+': 'Sobraban 3+' };
function filaEsfuerzo(n, st, s) {
  const final = st.sets.every(x => x.ok);
  return '<div class="rirx' + (final && !s.e ? ' pide' : '') + '"><div class="q">' + (final ? (s.e ? 'Última serie: ' : '¿Cómo terminó? Toca uno y se guarda') : '¿Cómo terminó esta serie?') + '</div><div class="pills">' +
    Object.keys(RPE).map(v => '<button class="' + (s.e === v ? 'on' : '') + '" onclick="setRir(\'' + n + '\',\'' + v + '\')">' + CORTO_E[v] + '</button>').join('') + '</div></div>';
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
  if (!st.ia || !st.ia.mensaje) return '';
  const p = st.ia.motor ? st.ia.motor.paso : null;
  const sAct = st.sets[st.ia.i], disc = sAct ? cambioDiscos(exDe(n), sAct.w, st.ia.peso, st.unit) : '';
  return '<div class="ia' + (ANIM_IA === n ? ' entra' : '') + '"><span>' + (st.ia.fuente === 'ia' ? '✨ ' : '💡 ') + esc(st.ia.mensaje) +
    (st.ia.afinando ? ' <i class="muted" style="font-size:12px">· tu coach lo revisa…</i>' : '') + '</span>' +
    (st.ia.usar ? '<button class="btn sm" onclick="usarIA(\'' + n + '\')">Usar</button>' : '') + '</div>' +
    (disc ? '<div class="discos">🏋️ ' + esc(disc) + '</div>' : '') +
    (st.ia.pasoDudoso && p ? '<div class="pasoq"><span>¿De cuánto en cuánto sube este equipo? (' + esc(st.unit) + ')</span><div>' +
      (st.unit === 'kg' ? [1.25, 2.5, 5, 10] : [2.5, 5, 10, 15]).map(v => '<button class="' + (v === p ? 'on' : '') + '" onclick="fijarPaso(\'' + n + '\',' + v + ')">' + v + '</button>').join('') + '</div></div>' : '');
}

// El siguiente ejercicio pendiente: primero en la sección del que acabas de hacer, luego en las demás
function siguiente(g, actual) {
  if (!DATA.exercises.some(e => e.group === g)) return '';
  const secs = ordenGrupo(g).filter(x => x.length);
  const dentro = secs.find(x => x.some(e => e.name === actual));
  const orden = dentro ? [dentro].concat(secs.filter(x => x !== dentro)) : secs;
  for (const sec of orden) { const e = sec.find(e => !state[e.name].done && !cardDone(e.name) && e.name !== actual); if (e) return e.name; }
  return '';
}
function elegirGrupo(g) {
  if (!FECHA) { GRUPO_MANUAL = g !== grupoDeHoy(); GRUPO_DIA = hoy(); }
  guardarPendientes();
  GRUPO = g; BUSCA = ''; OPEN = siguiente(g, ''); pintarEntrenar();
}
function abrir(name) {
  guardarPendientes(name);
  const p = companero(name);
  OPEN = (OPEN === name || (p && OPEN === p)) ? '' : name;
  ANIM_ABRE = OPEN;
  if (OPEN && ajuste('calentamiento', false) && esBasico(exDe(OPEN)) && !state[OPEN].edited && !state[OPEN].sets.some(s => s.t === 'C')) agregarCalentamiento(OPEN, true);
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
  if (s.e && st.sets.every(x => x.ok) && !st.done) { cambio(name, false); return setTimeout(() => guardar(name, true), 250); }
  cambio(name);
  if (s.e && s.t !== 'C') { clearTimeout(IA_TIMER[name]); consejoIA(name, k); }
  // En pareja ya no se cambia de pestaña solo: el otro puede estar en otro ejercicio o no hacer este
}
// Ejercicios con todas las series marcadas pero sin guardar: se guardan al irte a otro o al terminar la sesión
function guardarPendientes(excepto) {
  Object.keys(state).forEach(k => {
    const st = state[k];
    if (baseDe(k) !== excepto && baseVista(k) !== excepto && !st.done && st.sets.length && st.sets.every(x => x.ok)) guardar(k, false, true);
  });
}
function setNotas(name, v) { state[name].notas = v; cambio(name, false); }
function setUnit(name, u) { state[name].unit = u; cambio(name); }
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
  const s = state[name].sets[i];
  s.w = a.w; s.r = a.r; s.t = a.t || s.t; hap('tecla');
  cambio(name);
}
function igualQueAntes(name) {
  const ex = exDe(name), st = state[name];
  st.sets = ex.anterior.map((a, i) => ({ w: a.w, r: a.r, t: a.t || 'T', ok: st.sets[i] ? st.sets[i].ok : false }));
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
  exDe(name).ajuste = v; state[name].editAjuste = false;
  LS.set('gym_data', DATA);
  encolar('saveAjuste', [baseDe(name), v], 'aj-' + name, claveDe(name));
  toast(v ? 'Ajuste guardado: te aparece cada vez ✓' : 'Ajuste borrado');
  pintarEntrenar();
}
// Básicos con barra o por lado: ahí sí vale la pena calentar con series de aproximación
function esBasico(ex) { return ex.barra > 0 || ex.mult === 2; }
function agregarCalentamiento(name, silencioso) {
  const ex = exDe(name), st = state[name];
  const t = st.sets.find(s => s.t === 'T' && !vacio(s.w) && Number(s.w) > 0);
  if (!t) { if (!silencioso) toast('Pon primero tu peso de trabajo'); return false; }
  const barra = st.unit === 'kg' ? ex.barra / KG_A_LB : ex.barra, paso = ex.step || 2.5;
  const carga = Number(t.w) * ex.mult + barra;
  // Con barra y carga de 50 kg (110 lb) o más, primero la barra sola
  const pasos = (barra > 0 && carga >= (st.unit === 'kg' ? 50 : 110) ? [[0, 10]] : []).concat([[0.5, 8], [0.7, 4]]);
  const cal = pasos.map(x => {
    const w = x[0] ? Math.max(0, Math.floor(((carga * x[0] - barra) / ex.mult) / paso) * paso) : 0;
    return { w: Math.round(w * 100) / 100, r: x[1], t: 'C', ok: false };
  });
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
  const fila = e => '<button onclick="usarCambio(\'' + jsq(e.name) + '\')"><b style="flex:1">' + esc(e.ejercicio) + '</b><span class="muted">' +
    (e.anterior.length ? resumenSets(e.anterior) : 'nuevo') + '</span></button>';
  const top = (mismo.length ? mismo : musc).slice(0, 3), resto = mismo.concat(musc).filter(e => !top.includes(e));
  const q = parOn() ? '<div class="cquien">' + [['ambos', 'Los dos'], ['yo', 'Solo yo'], ['par', 'Solo ' + PAR.nombre]].map(o =>
    '<button class="' + (CAMBIO.quien === o[0] ? 'on' : '') + '" onclick="CAMBIO.quien=\'' + o[0] + '\';elegirCambio(\'' + jsq(name) + '\',' + !!todos + ')">' + esc(o[1]) + '</button>').join('') + '</div>' : '';
  $('sheet').innerHTML = '<div class="t2">Cambiar ' + esc(ex.ejercicio) + '</div>' + q + '<div class="muted" style="margin:4px 0 8px">' +
    (mismo.length ? 'Mismo movimiento (' + esc(ex.patron.toLowerCase()) + '). ' : 'Mismo músculo (' + esc(ex.musculo) + '). ') + 'Te carga tu peso de la última vez.</div>' +
    '<div class="lista">' + (top.length ? top.map(fila).join('') : '<div class="muted" style="padding:12px 0">No hay otro ejercicio equivalente en tu catálogo.</div>') +
    (todos && resto.length ? '<div class="muted" style="padding:10px 2px 2px">Otros de ' + esc(ex.musculo) + '</div>' + resto.map(fila).join('') : '') + '</div>' +
    '<div class="acts">' + (!todos && resto.length ? '<button class="btn ghost" onclick="elegirCambio(\'' + jsq(name) + '\', true)">Ver ' + resto.length + ' más</button>' : '') +
    '<button class="btn ghost" onclick="cerrarModal()">Cancelar</button></div>';
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
function tecladoPeso() {
  KP = { peso: true, val: PESO_TMP === '' ? '' : String(PESO_TMP), nuevo: true, f: 'w' };
  $('kpSheet').innerHTML = '<div class="row between"><div class="t1">Peso en ayunas (kg)</div><button class="btn ghost sm" onclick="cerrarTeclado()">✕</button></div>' +
    (DATA.ultimoPeso !== null ? '<div class="muted" style="text-align:center;margin-top:6px">Último: ' + DATA.ultimoPeso + ' kg · los ± parten de ahí</div>' : '') +
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
  s.ok = !s.ok;
  if (s.ok) { hap('serie'); iniciarSesion(); ANIM_SET = name + '#' + i; ULT_SERIE = name; }
  cambio(name);
  if (!s.ok) return;
  // Última serie: la tarjeta se queda abierta para que marques cómo terminó; al tocar el esfuerzo se guarda
  if (st.sets.every(x => x.ok)) {
    setTimeout(() => { const el = document.querySelector('[id="ex-' + baseVista(name) + '"] .rirx'); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60);
    return;
  }
  // Coach IA: espera unos segundos por si marcas el esfuerzo de esta serie; si lo marcas, pregunta al momento
  if (s.t !== 'C') { decidirSerie(name, i); clearTimeout(IA_TIMER[name]); IA_TIMER[name] = setTimeout(() => consejoIA(name, i), 4000); pintarEntrenar(); }
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
/* ----- Coach IA: después de cada serie de trabajo te dice qué hacer en la siguiente ----- */
const RIR_DE = { 'Al fallo': 0, 'Casi (1–2 más)': 1.5, 'Sobraban 3+': 3 };
const ETQ_E = { 'Al fallo': 'FALLO', 'Casi (1–2 más)': 'RIR 1–2', 'Sobraban 3+': 'RIR 3+' };
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
    ejercicio_terminado: st.sets.every(x => x.ok)
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
// Opciones para la serie que sigue. Modelo: Epley (1 rep ≈ 3.3 % de carga) + cuántas reps pierdes TÚ de serie a serie
// (aprendido de tu historial: ex.caida; mientras haya pocos datos: 2 después de un fallo, 1 con 1–2 en reserva).
function motorSerie(name, i) {
  const ex = exDe(name), st = state[name], s = st && st.sets[i];
  if (!ex || !s || s.t === 'C' || vacio(s.r) || st.sets.every(x => x.ok)) return null;
  const r = Number(s.r), w = Number(s.w) || 0, min = ex.min, max = ex.max;
  const rir = s.e ? RIR_DE[s.e] : null, rirE = rir === null ? 2 : rir;
  const c = ex.caida || {};
  const caida = rirE === 0 ? (c.nf >= 3 ? Math.max(1, c.fallo) : 2) : rirE <= 1.5 ? (c.nn >= 3 ? Math.max(0.5, c.normal) : 1) : (c.nn >= 3 ? Math.max(0, c.normal - 0.5) : 0.5);
  const pred = Math.max(1, Math.round(r + rirE - 1.5 - caida));         // reps con el mismo peso dejando 1–2 en reserva
  const r2 = x => Math.max(1, Math.min(max + 2, Math.round(x)));
  const bajos = recuperacion() ? ['Mal', 'Baja', 'Adolorido'].filter(v => Object.values(recuperacion()).includes(v)).length : 0;
  const ops = [];
  if (ex.sinPeso || (!w && ex.inc === 0)) {
    // Sin carga: solo reps y descanso
    ops.push({ id: 'A', accion: 'mantener', peso: w, reps: r2(Math.max(min, pred)), mensaje: pred < min
      ? 'Descansa 2–3 min: con ' + r + ' al fallo la siguiente te saldría ~' + pred + '. Haz las que salgan con buena técnica.'
      : 'Busca ~' + pred + ' en la siguiente; deja 1 en reserva.' });
    return { opciones: ops, eleccion: 'A' };
  }
  const p = pasoEj(ex, st), inv = ex.inc < 0;                            // inv: máquina asistida (más número = más fácil)
  const conv = st.unit === 'kg' ? KG_A_LB : 1;
  const corp = (Number(DATA.ultimoPeso) || 72) * KG_A_LB;
  const carga = inv ? Math.max(20, corp - w * conv) : Math.max(5, cargaReal(ex, w, st.unit));
  const repsPaso = Math.max(0.7, 30 * p * (inv ? 1 : ex.mult) * conv / carga);   // reps que ganas por cada paso que bajas
  const mover = k => alPaso(inv ? w + k * p : w - k * p, p);
  ops.push({ id: 'A', accion: 'mantener', peso: w, reps: r2(Math.min(pred, max)) });
  if (pred < min || rir === 0) {
    const k = Math.max(1, Math.ceil((min + 1 - pred) / repsPaso));
    const wB = mover(k), caidaPct = 1 - (inv ? (corp - wB * conv) : cargaReal(ex, wB, st.unit)) / carga;
    if (wB >= 0 && caidaPct <= 0.3) ops.push({ id: 'B', accion: 'bajar', peso: wB, reps: r2(Math.min(max, pred + k * repsPaso)), k: k });
  }
  if (rirE >= 3 && r >= min && !bajos && !DATA.descargaCarrera) {
    const wC = mover(-1), rC = Math.round(pred - repsPaso);
    if (rC >= min) ops.push({ id: 'C', accion: 'subir', peso: wC, reps: r2(rC) });
    else ops.push({ id: 'C', accion: 'mas_reps', peso: w, reps: r2(Math.min(max + 2, r + 2)) });
  }
  const B = ops.find(o => o.id === 'B'), C = ops.find(o => o.id === 'C'), A = ops[0];
  const basico = ex.modalidad === 'Barra' || ex.modalidad === 'Discos';
  let el = 'A';
  if (B && (pred < min || (rir === 0 && basico) || (rir === 0 && bajos >= 2))) el = 'B';
  else if (C) el = 'C';
  const u = ' ' + st.unit;
  A.mensaje = rir === 0 ? 'Mantén ' + w + ': con ' + r + ' al fallo, la siguiente te sale ~' + A.reps + ' (sigues en ' + min + '–' + max + '). Descansa 2–3 min y deja 1 en reserva.'
    : pred < min ? 'Mantén ' + w + ' si quieres, pero la siguiente te saldría ~' + A.reps + ', abajo de ' + min + '.'
    : 'Mantén ' + w + u + ' y busca ' + A.reps + (A.reps < r ? ' (es normal perder ' + (r - A.reps) + ')' : '') + '.';
  if (B) B.mensaje = 'Baja a ' + B.peso + u + (pred < min ? ': con ' + w + ' la siguiente te saldría ~' + Math.max(1, pred) + ', abajo de ' + min + '. Así sacas ~' + B.reps + '.'
    : ': fuiste al fallo' + (basico ? ' en un básico; por técnica y seguridad' : '') + ', así sacas ~' + B.reps + ' de calidad.');
  if (C) C.mensaje = C.accion === 'subir' ? 'Sube a ' + C.peso + u + ': te sobraron 3+ con ' + r + '. Busca ' + C.reps + '.'
    : 'Te sobraron 3+, pero el siguiente peso es mucho salto: mantén ' + w + ' y busca ' + C.reps + '.';
  return { opciones: ops, eleccion: el, paso: p, pasoDudoso: !ex.pasoFijo && (el === 'B' || (el === 'C' && C.accion === 'subir')) };
}
// Lo que se ve debajo de la serie: el motor responde al instante; si hay IA y señal, la IA elige y explica
function decidirSerie(name, i) {
  const st = state[name], m = motorSerie(name, i);
  if (!m) { if (st) st.ia = null; return; }
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
  if (!st || st.done || FECHA || st.sets.every(x => x.ok)) return;
  decidirSerie(name, i);
  if (TAB === 'Entrenar' && OPEN === baseVista(name)) pintarEntrenar();
  if (!st.ia || !ajuste('ia', true) || !navigator.onLine || !DATA.ia) return;
  const seq = ++IA_SEQ, m = st.ia.motor;
  st.ia.afinando = true;
  try {
    const pl = Object.assign(payloadIA(name, i), { opciones: m.opciones.map(o => ({ id: o.id, accion: o.accion, peso: o.peso, reps: o.reps, mensaje: o.mensaje })),
      eleccion_reglas: m.eleccion, caida_reps: exDe(name).caida || null, paso: m.paso || pasoEj(exDe(name), st) });
    const r = await conLimite(apiPost('ia', [pl], claveDe(name)), 12000);
    if (seq !== IA_SEQ || !state[name] || state[name].done || !state[name].ia) return;
    const op = m.opciones.find(o => o.id === r.opcion) || m.opciones.find(o => o.id === m.eleccion);   // la IA solo elige; los números son del motor
    Object.assign(state[name].ia, { mensaje: r.mensaje || op.mensaje, peso: op.peso, reps: op.reps, fuente: r.ia === false ? 'reglas' : 'ia', afinando: false,
      pasoDudoso: m.pasoDudoso && op.accion !== 'mantener', usar: usarAplica(state[name], op) });
    ANIM_IA = jsq(name);
  } catch (e) {
    if (state[name] && state[name].ia) state[name].ia.afinando = false;   // se queda el consejo del motor
    if (e.message !== 'tiempo' && !/Failed to fetch|NetworkError|Load failed/i.test(e.message) && !IA_AVISADO) { IA_AVISADO = true; toast('Coach IA: ' + e.message.slice(0, 120)); }
  }
  if (TAB === 'Entrenar' && OPEN === baseVista(name)) pintarEntrenar();
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
                   vol: sets.filter(s => s.t !== 'C').reduce((a, s) => a + cargaReal(ex, s.w, st.unit) * s.r, 0) });
    guardarSesion(ses);
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
  else if (st.uid) encolar('undoById', [st.uid], null, claveDe(name));
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
  if (sets) st.sets = sets.map(s => ({ w: s.w, r: s.r, t: s.t, ok: true }));
  else st.sets.forEach(s => { s.ok = false; });
  cambio(name);
  irA(baseVista(name));
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
  return '<div class="vol">' + v.map(x => '<span><b>' + esc(x.musculo) + '</b>' + medio(x.series) + (x.series <= 1 ? ' serie' : ' series') +
    (x.ej ? ' · ' + x.ej + ' ej.' : ' (apoyo)') + '</span>').join('') + '</div>';
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
  guardarPendientes();
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
function abrirModal() {
  $('toast').className = 'toast'; $('modal').classList.add('show');
  if (!(history.state && history.state.modal)) history.pushState({ modal: 1 }, '');
}
let IGNORAR_POP = false;
function cerrarModal() {
  $('modal').classList.remove('show');
  if (history.state && history.state.modal) { IGNORAR_POP = true; history.back(); }
}
// El gesto o botón "atrás" de Android cierra la ventana abierta en vez de salir de la app
window.addEventListener('popstate', () => {
  if (IGNORAR_POP) { IGNORAR_POP = false; return; }
  if ($('modal') && $('modal').classList.contains('show')) $('modal').classList.remove('show');
});
function cerrarSesion() {
  guardarPendientes();
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
    body: proxSerieTexto() || 'Terminó tu descanso de ' + mmss(dur), tag: 'descanso', renotify: true,
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
// El grupo de tu siguiente día de gym: si ya entrenaste hoy, el que sigue; si no, el que te toca
function proximoGrupo() {
  const hoyYa = DATA.ultimoGrupoFecha === DATA.todayKey || sesion().log.some(l => GRUPOS3.includes(l.name.split(':')[0]));
  if (!hoyYa) return DATA.sugGrupo;
  const ult = sesion().log.map(l => l.name.split(':')[0]).filter(g => GRUPOS3.includes(g)).pop() || DATA.ultimoGrupo;
  return GRUPOS3[(GRUPOS3.indexOf(ult) + 1) % 3];
}
let TROTE = { km: '', min: '', fc: '', cad: '', tipo: null, ia: null, leyendo: false };
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
  return '<div class="card"><div class="row between"><div class="t1">Fácil vs. intenso · 7 días</div><span class="num muted">' + (Math.round(p.total * 10) / 10) + ' km</span></div>' +
    '<div class="polar"><div class="f" style="width:' + (p.facil / p.total * 100) + '%"></div><div class="i" style="width:' + (p.intenso / p.total * 100) + '%"></div><div class="meta"></div></div>' +
    '<div class="leyenda"><span><i style="background:var(--ok)"></i>Fácil ' + p.pct + ' %</span><span><i style="background:var(--acc)"></i>Intenso ' + (100 - p.pct) + ' %</span><span>| meta: 80 / 20</span></div>' +
    '<div class="' + cls + '" style="margin:10px 0 0">' + esc(msg) + '</div></div>';
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
  if (TROTE.leyendo) return '<div class="foco"><span class="i">✨</span><div style="flex:1"><div class="muted" style="font-size:13px">Leyendo tu captura…</div><div class="brillo linea-esq" style="width:85%"></div><div class="brillo linea-esq" style="width:55%"></div></div></div>';
  const r = TROTE.ia;
  if (!r) return '';
  const z = r.zonas || {}, zs = ['z1', 'z2', 'z3', 'z4', 'z5'].map(k => Number(z[k]) || 0), zt = zs.reduce((a, b) => a + b, 0);
  return '<div class="foco entra" style="display:block"><b>✨ Leído de tu captura</b>' +
    '<div class="datos">' + [[r.km, 'km'], [r.min ? mmss(r.min * 60) : null, 'tiempo'], [r.fc, 'ppm prom.'], [r.cad, 'cadencia'], [r.desnivel !== null && r.desnivel !== undefined ? r.desnivel + ' m' : null, 'desnivel'], [r.temp !== null && r.temp !== undefined ? r.temp + ' °C' : null, 'clima']]
      .filter(x => x[0] !== null && x[0] !== undefined).map(x => '<div><b class="num">' + esc(String(x[0])) + '</b><span>' + x[1] + '</span></div>').join('') + '</div>' +
    (zt ? '<div class="muted" style="font-size:12px">Tiempo por zona (Z1 → Z5)</div><div class="zonas">' + zs.map(v => '<div style="width:' + (v / zt * 100) + '%"></div>').join('') + '</div>' : '') +
    (r.vueltas && r.vueltas.length ? '<div class="muted" style="font-size:12.5px;margin-top:6px">Vueltas: ' + r.vueltas.map(v => esc(v.ritmo)).join(' → ') + '/km</div>' : '') +
    (r.analisis ? '<div style="margin-top:8px;font-size:14px">' + esc(r.analisis) + '</div>' : '') +
    '<div class="muted" style="font-size:12px;margin-top:6px">Ya llené el registro de abajo: revisa y toca Guardar.</div></div>';
}
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
  const lista = pend.map(t => ({ d: ddmm(claveDia(new Date(t.ts))), km: t.km, min: t.min, fc: t.fc, uid: t.uid, tipo: t.tipo, pend: true })).concat(DATA.trotes.ultimos);
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
  const hid = LS.get('gym_hidrata_' + hoy(), null);
  if (hid && !FECHA) h += '<div class="tip" style="margin:0 0 12px">💧 ' + esc(hid) + '</div>';
  h += '<h2>Registrar trote' + (FECHA ? ' · ' + diaCorto(FECHA) : '') + '</h2>' +
    (DATA.ia ? '<button class="cap" onclick="elegirCapturas()"' + (TROTE.leyendo ? ' disabled' : '') + '>📷 Leer captura de Samsung Health</button>' : '') + tarjetaLectura() +
    '<div class="card"><div class="row" style="gap:10px">' +
    '<div style="flex:1"><div class="muted">Kilómetros</div><button class="val num' + (TROTE.km === '' ? ' vacio' : '') + '" style="margin-top:4px" onclick="tecladoTrote(\'km\')">' + (TROTE.km === '' ? 'km' : TROTE.km) + '</button></div>' +
    '<div style="flex:1"><div class="muted">Minutos</div><button class="val num' + (TROTE.min === '' ? ' vacio' : '') + '" style="margin-top:4px" onclick="tecladoTrote(\'min\')">' + (TROTE.min === '' ? 'min' : Number(TROTE.min) % 1 ? mmss(TROTE.min * 60) : TROTE.min) + '</button></div>' +
    '<div style="flex:1"><div class="muted">FC prom.</div><button class="val num' + (TROTE.fc === '' ? ' vacio' : '') + '" style="margin-top:4px" onclick="tecladoTrote(\'fc\')">' + (TROTE.fc === '' ? 'ppm' : TROTE.fc) + '</button></div></div>' +
    '<div class="muted" style="margin:10px 0 4px">Ritmo: <b class="num" style="color:var(--text)">' + ritmo + '</b>' +
    (TROTE.fc !== '' ? ' · ' + (Number(TROTE.fc) <= FC_FACIL ? '<b style="color:var(--ok)">zona fácil</b>' : '<b style="color:var(--acc)">intenso</b>') : '') + '</div>' +
    '<div class="pills">' + TIPOS_TROTE.map(t => '<button class="' + (TROTE.tipo === t ? 'on' : '') + '" onclick="TROTE.tipo=\'' + t + '\';pintarEntrenar()">' + t + '</button>').join('') + '</div>' +
    ((TROTE.tipo === 'Larga' || TROTE.tipo === 'Calidad') && proximoGrupo() === 'Legs' && !FECHA
      ? '<div class="tip acc" style="margin:4px 0 8px">⚠️ Tu siguiente día de gym es Legs. Si es mañana, hoy mejor una salida fácil: la larga o la de calidad te dejan las piernas cansadas para Legs.</div>' : '') +
    '<input class="buscar" id="troteNotas" placeholder="Notas (opcional)" style="margin:4px 0 10px">' +
    '<button class="btn block" onclick="guardarTrote()">Guardar trote</button></div>';
  h += tarjetaPolar();
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
    (t.min ? ' · ' + mmss(t.min * 60) + ' · ' + mmss(t.min * 60 / t.km) + '/km' : '') + '</div><div class="muted">' + t.d + (t.tipo ? ' · ' + esc(t.tipo) : '') +
    (t.fc ? ' · ' + t.fc + ' ppm' + (intensidad(t) === 'facil' ? ' (fácil)' : ' (intenso)') : '') + (t.pend ? ' · sin subir' : '') + '</div></div>' +
    (t.uid ? '<button class="btn ghost sm" onclick="borrarTrote(\'' + jsq(t.uid) + '\')">Borrar</button>' : '') + '</div>').join('') + '</div>';
  return h;
}
function tecladoTrote(f) {
  KP = { trote: f, val: TROTE[f] === '' ? '' : String(TROTE[f]), nuevo: true, f: f === 'km' ? 'w' : 'r' };
  const quick = f === 'km' ? [-1, -0.5, 0.5, 1] : f === 'fc' ? [-10, -1, 1, 10] : [-5, -1, 1, 5];
  $('kpSheet').innerHTML = '<div class="row between"><div class="t1">Trote · ' + (f === 'km' ? 'kilómetros' : f === 'fc' ? 'pulso promedio (ppm)' : 'minutos') + '</div><button class="btn ghost sm" onclick="cerrarTeclado()">✕</button></div>' +
    '<div class="disp num" id="kpDisp"></div><div class="quick" style="grid-template-columns:repeat(4,1fr)">' +
    quick.map(v => '<button onclick="kpSumar(' + v + ')">' + (v > 0 ? '+' : '−') + Math.abs(v) + '</button>').join('') + '</div>' + teclas() +
    '<div class="acts"><button class="btn" onclick="kpTrote()">Listo</button></div>';
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
  TROTE = { km: '', min: '', fc: '', cad: '', tipo: null, ia: null, leyendo: false };
  hap('ok'); toast('Trote guardado ✓'); pintarEntrenar();
  // Consejo de hidratación con el clima real del momento (solo para salidas de hoy)
  if (!FECHA) climaHermosillo().then(c => { const m = consejoHidratacion(t, c); LS.set('gym_hidrata_' + hoy(), m); toast('💧 ' + m.slice(0, 110) + '…'); if (TAB === 'Entrenar' && GRUPO === 'Trote') pintarEntrenar(); });
}
function borrarTrote(id) {
  const q = cola(), pend = q.find(op => op.action === 'saveTrote' && op.args[0].uid === id);
  if (pend) guardarCola(q.filter(op => op !== pend));
  else { encolar('undoTrote', [id]); DATA.trotes.ultimos = DATA.trotes.ultimos.filter(t => t.uid !== id); }
  toast('Trote borrado'); pintarEntrenar();
}

/* ===================== COMIDA ===================== */
function protTotal(lista) { return Math.round((lista || prot).reduce((s, k) => s + gDe(k), 0)); }

// "¿Ayer comiste tu día típico?": si ayer quedó sin proteína, se registra con un toque
function ayerPendiente() {
  const ayer = sumarDias(hoy(), -1);
  return fresco() && DATA.protAyer && DATA.protAyer.k === ayer && !(DATA.protAyer.g > 0) &&
    LS.get('gym_prot_' + ayer, null) === null && !LS.get('gym_ayer_no_' + ayer, false) ? ayer : null;
}
function tarjetaAyer() {
  const ayer = ayerPendiente();
  if (!ayer) return '';
  const tipico = diaTipicoLista(), g = protTotal(tipico);
  return '<div class="card"><div class="row between"><div class="t1">¿Qué comiste ayer?</div>' +
    '<button class="btn ghost sm" onclick="LS.set(\'gym_ayer_no_' + ayer + '\', true);pintarTab()" aria-label="No registrar">✕</button></div>' +
    '<div class="muted" style="margin:2px 0 10px">Se quedó sin registrar la proteína del ' + diaCorto(ayer) + '.</div><div class="acts" style="margin-top:0">' +
    (tipico.length ? '<button class="btn" style="white-space:nowrap" onclick="ayerTipico()">Día típico · ' + g + ' g</button>' : '') +
    '<button class="btn ghost" onclick="comidaDe(\'' + ayer + '\')">' + (tipico.length ? 'Fue diferente' : 'Registrar ayer') + '</button></div></div>';
}
function ayerTipico() {
  const ayer = sumarDias(hoy(), -1), lista = diaTipicoLista();
  LS.set('gym_prot_' + ayer, lista);
  encolar('saveProteina', [protTotal(lista), lista.join(', '), ayer], 'prot-' + ayer);
  hap('ok'); toast('Ayer: ' + protTotal(lista) + ' g ✓'); pintarTab();
}
function comidaDe(dia) {
  COMIDA_DIA = dia && dia !== hoy() ? dia : null;
  prot = cargarProt(diaComida());
  verTab('Comida');
}
function diaTipicoLista() {
  // Martin: licuado + tupper con carne + cena nueva + 2.º scoop
  if (DATA.dueno) return ['Licuado', 'Tupper carne', 'Cena huevos', 'Scoop'];
  const cuenta = LS.get('gym_food_counts', {});
  return FOODS.slice().sort((a, b) => (cuenta[b.k] || 0) - (cuenta[a.k] || 0)).filter(f => cuenta[f.k]).slice(0, 3).map(f => f.k);
}
function pintarComida() {
  const meta = metaProt(), tot = protTotal(), pct = Math.min(1, tot / meta), falta = meta - tot;
  const R = 74, C = 2 * Math.PI * R;
  const cuenta = LS.get('gym_food_counts', {});
  const todas = FOODS.concat(misComidas());
  const top = todas.slice().sort((a, b) => (cuenta[b.k] || 0) - (cuenta[a.k] || 0)).slice(0, 3).filter(f => cuenta[f.k]);
  const tipico = diaTipicoLista();
  let h = '';
  if (COMIDA_DIA) h += '<div class="otro">' + ICO.cal + '<span>Comida del ' + diaCorto(COMIDA_DIA) + '</span><button class="btn" onclick="comidaDe(null)">Volver a hoy</button></div>';
  else h += tarjetaAyer();
  h += '<div class="card" style="text-align:center"><div class="ring"><svg viewBox="0 0 170 170">' +
    '<circle cx="85" cy="85" r="' + R + '" fill="none" stroke="var(--card2)" stroke-width="14"/>' +
    '<circle cx="85" cy="85" r="' + R + '" fill="none" stroke="' + (tot >= meta ? 'var(--ok)' : 'var(--pri)') + '" stroke-width="14" stroke-linecap="round" ' +
    'stroke-dasharray="' + C + '" stroke-dashoffset="' + (C * (1 - pct)) + '" style="transition:stroke-dashoffset .4s"/></svg>' +
    '<div><div class="v num">' + tot + ' g</div><div class="muted">de ' + meta + ' g</div></div></div>' +
    '<div class="t1" style="margin-top:4px">' + (falta > 0 ? 'Te faltan ~' + falta + ' g' : '¡Meta cumplida!') + '</div>' +
    '<div class="muted">' + (falta > 0 ? (prot.includes('Scoop') ? 'Fácil: 2 huevos (12 g), yogurt (15 g) o atún (20 g)' : 'Lo más barato: un scoop con agua (22 g)') : 'Bien hecho hoy') + '</div></div>';
  h += tarjetaComidaIA();
  if (!prot.length && tipico.length) h += '<button class="btn block" style="margin-bottom:6px" onclick="diaTipico()">Mi día típico · +' +
    protTotal(tipico) + ' g</button>' +
    '<div class="muted" style="text-align:center;margin-bottom:12px">Tócalo en la noche y luego cambia lo que fue diferente</div>';
  if (top.length) h += '<h2>Lo que más comes</h2><div class="foods">' + top.map(f => botonComida(f, true)).join('') + '</div>';
  const favs = misComidas().filter(f => !top.some(t => t.k === f.k));
  if (favs.length || QUITAR_FAV) h += '<div class="row between"><h2>Mis comidas</h2><button class="link" onclick="QUITAR_FAV=!QUITAR_FAV;pintarComida()">' + (QUITAR_FAV ? 'Listo' : 'Editar') + '</button></div>' +
    (QUITAR_FAV ? '<div class="muted" style="margin:-4px 0 8px;font-size:13px">Toca una para quitarla de tus comidas</div>' : '') +
    '<div class="foods">' + (QUITAR_FAV ? misComidas() : favs).map(f => botonComida(f, false)).join('') + '</div>';
  h += '<h2>Agregar</h2><div class="foods">' + FOODS.filter(f => !top.includes(f)).map(f => botonComida(f, false)).join('') + '</div>';
  if (prot.length) h += '<h2>Hoy comiste · toca para quitar</h2><div class="eaten">' +
    prot.map((k, i) => '<button onclick="quitarProt(' + i + ')">' + esc(tDe(k)) + ' ✕</button>').join('') + '</div>';
  h += '<p class="muted" style="margin-top:14px">Cantidades aproximadas. Lo que cuenta es acercarte a la meta casi todos los días.</p>';
  $('vComida').innerHTML = h;
}
function botonComida(f, esTop) {
  const c = prot.filter(k => k === f.k).length;
  const quitar = QUITAR_FAV && f.fav;
  return '<button class="food' + (esTop ? ' top' : '') + (f.fav ? ' fav' : '') + (quitar ? ' quitar' : '') + '" onclick="' +
    (quitar ? 'quitarFav(\'' + jsq(f.t) + '\')' : 'addProt(\'' + jsq(f.k) + '\')') + '">' + (c && !quitar ? '<span class="c">×' + c + '</span>' : '') +
    '<b>+' + f.g + ' g</b>' + esc(f.t) + '</button>';
}
function cambiarProt() {
  const dia = diaComida();
  LS.set('gym_prot_' + dia, prot);
  encolar('saveProteina', [protTotal(), prot.join(', '), dia], 'prot-' + dia);
  pintarComida();
}
function addProt(k) {
  prot.push(k); hap('tecla');
  const c = LS.get('gym_food_counts', {}); c[k] = (c[k] || 0) + 1; LS.set('gym_food_counts', c);
  cambiarProt();
}
function diaTipico() { prot = prot.concat(diaTipicoLista()); cambiarProt(); }

/* ----- Comida con IA: escribes lo que comiste y calcula la proteína ----- */
let COMIDA_IA = null, QUITAR_FAV = false;
function tarjetaComidaIA() {
  if (!DATA.ia) return '';
  const c = COMIDA_IA || {};
  let h = '<div class="card iacard"><div class="t1" style="margin-bottom:6px">✨ Dime qué comiste</div>' +
    '<textarea id="iaComida" maxlength="600" placeholder="Ej. 3 tacos de asada y una coca · o: la etiqueta dice 24 g por porción y me comí 2" oninput="(COMIDA_IA=COMIDA_IA||{}).texto=this.value">' + esc(c.texto || '') + '</textarea>' +
    '<div class="fila-ia">' + botonMic('iaComida', 'calcularComida') + '<button class="btn"' + (c.cargando ? ' disabled' : '') + ' onclick="calcularComida()">' + (c.cargando ? 'Calculando…' : 'Calcular proteína') + '</button></div>';
  if (c.error) h += '<div class="muted" style="margin-top:8px;color:var(--acc)">' + esc(c.error) + '</div>';
  if (c.items && c.items.length) {
    const tot = c.items.filter(x => x.on).reduce((a, x) => a + x.g, 0);
    h += '<div style="margin-top:10px">' + c.items.map((x, i) => '<div class="iitem' + (x.on ? '' : ' off') + '">' +
      '<button class="mini' + (x.on ? ' on' : '') + '" onclick="COMIDA_IA.items[' + i + '].on=!COMIDA_IA.items[' + i + '].on;pintarComida()" aria-label="Incluir">✓</button>' +
      '<div class="nm">' + esc(x.nombre) + (x.nota ? '<small>' + esc(x.nota) + '</small>' : '') + '</div>' +
      '<button class="mini" onclick="ajustarItem(' + i + ',-2)" aria-label="Menos">−</button><span class="g num">' + x.g + ' g</span>' +
      '<button class="mini" onclick="ajustarItem(' + i + ',2)" aria-label="Más">+</button>' +
      '<button class="mini' + (x.fav ? ' on' : '') + '" onclick="guardarFav(' + i + ')" aria-label="Guardar en mis comidas">⭐</button></div>').join('') + '</div>';
    if (c.consejo) h += '<div class="muted" style="margin:8px 0 0;font-size:13.5px">💡 ' + esc(c.consejo) + '</div>';
    h += '<div class="acts"><button class="btn ghost" onclick="COMIDA_IA=null;pintarComida()">Descartar</button>' +
      '<button class="btn"' + (tot ? '' : ' disabled') + ' onclick="agregarComidaIA()">Agregar +' + tot + ' g</button></div>';
  }
  return h + '</div>';
}
async function calcularComida() {
  const c = COMIDA_IA = COMIDA_IA || {};
  c.texto = ($('iaComida') || {}).value || c.texto || '';
  if (!c.texto.trim()) return toast('Escribe qué comiste');
  if (!navigator.onLine) return toast('Necesitas señal para calcular con la IA');
  c.cargando = true; c.error = ''; c.items = null; pintarComida();
  try {
    const r = await conLimite(apiPost('comidaIA', [c.texto, { meta: metaProt(), llevas: protTotal(), comido: prot.map(tDe) }]), 30000);
    c.items = r.items.map(x => Object.assign(x, { on: true })); c.consejo = r.consejo;
  } catch (e) { c.error = 'No se pudo calcular: ' + (e.message === 'tiempo' ? 'tardó demasiado, intenta otra vez' : e.message); }
  c.cargando = false;
  if (TAB === 'Comida') pintarComida();
}
function ajustarItem(i, d) { const x = COMIDA_IA.items[i]; x.g = Math.max(0, x.g + d); pintarComida(); }
function agregarComidaIA() {
  const items = COMIDA_IA.items.filter(x => x.on && x.g > 0);
  const cuenta = LS.get('gym_food_counts', {});
  items.forEach(x => { const k = clavePropia(x.nombre, x.g); prot.push(k); cuenta[k] = (cuenta[k] || 0) + 1; });
  LS.set('gym_food_counts', cuenta);
  const tot = items.reduce((a, x) => a + x.g, 0);
  COMIDA_IA = null; hap('ok'); cambiarProt(); toast('+' + tot + ' g ✓');
}
function guardarFav(i) {
  const x = COMIDA_IA.items[i];
  DATA.comidas = (DATA.comidas || []).filter(c => c.t !== x.nombre);
  if (!x.fav) DATA.comidas.unshift({ t: x.nombre, g: x.g });
  x.fav = !x.fav;
  encolar('saveConfig', [{ comidas: DATA.comidas.slice(0, 30) }], 'cfg-comidas');
  toast(x.fav ? 'Guardada en Mis comidas ⭐' : 'Quitada de Mis comidas'); pintarComida();
}
function quitarFav(t) {
  DATA.comidas = (DATA.comidas || []).filter(c => c.t !== t);
  encolar('saveConfig', [{ comidas: DATA.comidas }], 'cfg-comidas');
  if (!DATA.comidas.length) QUITAR_FAV = false;
  pintarComida();
}
// Promesa con tiempo máximo
function conLimite(pr, ms) { return Promise.race([pr, new Promise((_, no) => setTimeout(() => no(new Error('tiempo')), ms))]); }

/* ----- Dictado por voz: en el APK usa el reconocedor de Android; en Chrome, el del navegador ----- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const ICO_MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/></svg>';
let VOZ = null;   // { id, rec } mientras escucha
function botonMic(idTexto, alTerminar) {
  if (!NATIVO && !SR) return '';
  return '<button class="mic' + (VOZ && VOZ.id === idTexto ? ' oye' : '') + '" id="mic-' + idTexto + '" onclick="dictar(\'' + idTexto + '\',\'' + alTerminar + '\')" aria-label="Dictar por voz">' + ICO_MIC + '</button>';
}
function marcarMic(id, on) { const b = $('mic-' + id); if (b) b.classList.toggle('oye', on); }
async function dictar(id, alTerminar) {
  const ta = $(id);
  if (!ta) return;
  if (VOZ) { const v = VOZ; VOZ = null; marcarMic(v.id, false); try { v.rec ? v.rec.stop() : nativo('SpeechRecognition', 'stop'); } catch (e) {} return; }
  const base = ta.value.trim();
  const terminar = texto => {
    VOZ = null; marcarMic(id, false);
    if (!texto) return toast('No te escuché; intenta otra vez');
    const el = $(id); if (!el) return;
    el.value = (base ? base + ' ' : '') + texto; el.dispatchEvent(new Event('input'));
    hap('ok');
    if (alTerminar && typeof window[alTerminar] === 'function') setTimeout(() => window[alTerminar](), 250);
  };
  if (NATIVO) {
    VOZ = { id: id }; marcarMic(id, true); hap('tecla');
    try {
      await window.Capacitor.nativePromise('SpeechRecognition', 'requestPermissions', {});
      const r = await window.Capacitor.nativePromise('SpeechRecognition', 'start', { language: 'es-MX', maxResults: 1, partialResults: false, popup: false });
      if (VOZ && VOZ.id === id) terminar(r && r.matches && r.matches[0]);
    } catch (e) {
      VOZ = null; marcarMic(id, false);
      toast(/not implemented|no implementado/i.test(String(e && e.message)) ? 'Actualiza el APK para dictar; mientras, usa el micrófono de tu teclado' : 'No pude escucharte: ' + String(e && e.message || e).slice(0, 60));
    }
    return;
  }
  const rec = new SR();
  rec.lang = 'es-MX'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
  let final = '';
  rec.onresult = ev => {
    let parcial = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) { const t = ev.results[i][0].transcript; if (ev.results[i].isFinal) final += t; else parcial += t; }
    const el = $(id); if (el) el.value = (base ? base + ' ' : '') + (final + parcial).trim();   // se ve en vivo
  };
  rec.onerror = ev => { if (ev.error === 'not-allowed') toast('Da permiso de micrófono para dictar'); };
  rec.onend = () => { if (VOZ && VOZ.id === id) terminar(final.trim()); };
  VOZ = { id: id, rec: rec }; marcarMic(id, true); hap('tecla');
  try { rec.start(); } catch (e) { VOZ = null; marcarMic(id, false); toast('No pude usar el micrófono'); }
}

/* ===================== COACH (chat con la IA y el contexto de la app) ===================== */
let CHAT_CARGANDO = false, MEM_ABIERTA = false;
async function borrarMemoria(i) {
  if (!navigator.onLine) return toast('Necesitas señal');
  const antes = DATA.memoria.slice(); DATA.memoria.splice(i, 1); pintarCoach();
  try { DATA.memoria = await apiPost('memoria', [{ borrar: i }]); LS.set('gym_data', DATA); toast('Listo, lo olvidó'); }
  catch (e) { DATA.memoria = antes; toast('No se pudo: ' + e.message.slice(0, 60)); }
  pintarCoach();
}
const SUGS_CHAT = ['¿Cómo voy esta semana?', '¿Qué hago hoy en el gym?', '¿Qué ceno para llegar a mi proteína?', '¿Voy bien para mi carrera?', '¿Qué músculo estoy dejando atrás?'];
function chatLista() { return LS.get('gym_chat', []); }
function asegurarTabCoach() {
  if (!DATA.ia || $('vCoach')) return;
  const v = document.createElement('div'); v.id = 'vCoach'; v.className = 'hide';
  $('vProgreso').after(v);
  const b = document.createElement('button'); b.id = 'nCoach';
  b.setAttribute('onclick', "verTab('Coach')");
  b.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/></svg>Coach';
  $('nProgreso').after(b);
}
// Texto del coach: **negritas**, viñetas y saltos de línea; todo lo demás escapado
function formatoChat(t) {
  return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^\s*[-*•]\s+/gm, '• ').replace(/\n/g, '<br>');
}
function pintarCoach() {
  const lista = chatLista();
  let h = '<div class="row between" style="margin:4px 0 6px"><div class="t1">Pregúntale a tu coach</div>' +
    (lista.length ? '<button class="link" onclick="nuevaCharla()">Nueva conversación</button>' : '') + '</div>';
  const mem = DATA.memoria || [];
  h += '<details class="mem"' + (MEM_ABIERTA ? ' open' : '') + ' ontoggle="MEM_ABIERTA=this.open"><summary>🧠 Lo que tu coach ha aprendido de ti · ' + mem.length + '</summary>' +
    (mem.length ? '<ul>' + mem.map((m, i) => '<li><span>' + esc(m) + '</span><button onclick="borrarMemoria(' + i + ')" aria-label="Olvidar esto">✕</button></li>').join('') + '</ul>'
      : '<div class="muted" style="font-size:13.5px;margin-top:6px">Todavía nada. Aprende al terminar cada sesión y cuando le cuentas algo duradero (una molestia, un cambio de horario).</div>') +
    '<div class="muted" style="font-size:12px;margin-top:4px">Lo usa en cada consejo entre series, en el plan del día y en el chat. Toca ✕ para que lo olvide.</div></details>';
  if (!lista.length) h += '<div class="muted" style="margin-bottom:10px">Conoce tus pesos, tu proteína, tu cintura, tus trotes y tu plan. Pregúntale lo que quieras.</div>' +
    '<div class="sugs">' + SUGS_CHAT.map(q => '<button onclick="preguntar(\'' + jsq(q) + '\')">' + esc(q) + '</button>').join('') + '</div>';
  h += '<div class="chat">' + lista.map(m => '<div class="msg ' + (m.rol === 'yo' ? 'yo' : 'coach') + (m.err ? ' err' : '') + '">' +
    (m.rol === 'yo' ? esc(m.texto).replace(/\n/g, '<br>') : formatoChat(m.texto)) +
    (m.aprendio && m.aprendio.length ? '<span class="aprendio">🧠 Lo anoté: ' + esc(m.aprendio.join(' · ')) + '</span>' : '') +
    (m.err ? '<br><button class="link" onclick="reintentarChat()">Reintentar</button>' : '') + '</div>').join('') +
    (CHAT_CARGANDO ? '<div class="msg coach pensando" aria-label="Pensando"><span></span><span></span><span></span></div>' : '') + '</div>';
  h += '<div class="chatin">' + botonMic('chatTxt', 'preguntar') + '<textarea id="chatTxt" rows="1" maxlength="1500" placeholder="Escribe o dicta tu pregunta…"></textarea>' +
    '<button class="btn"' + (CHAT_CARGANDO ? ' disabled' : '') + ' onclick="preguntar()">Enviar</button></div>' +
    '<p class="muted" style="font-size:12px;margin-top:8px">Respuestas de IA (Gemini): pueden equivocarse. Si tienes dolor o una lesión, consulta a un médico.</p>';
  $('vCoach').innerHTML = h;
  if (lista.length || CHAT_CARGANDO) setTimeout(() => window.scrollTo({ top: document.body.scrollHeight }), 30);
}
function nuevaCharla() { if (CHAT_CARGANDO) return; LS.set('gym_chat', []); pintarCoach(); }
function preguntar(q) {
  if (CHAT_CARGANDO) return;
  const txt = (q || ($('chatTxt') || {}).value || '').trim();
  if (!txt) return;
  if (!navigator.onLine) return toast('Necesitas señal para hablar con el coach');
  const lista = chatLista().filter(m => !m.err);
  lista.push({ rol: 'yo', texto: txt, ts: Date.now() });
  LS.set('gym_chat', lista.slice(-40));
  pedirRespuesta();
}
function reintentarChat() { LS.set('gym_chat', chatLista().filter(m => !m.err)); pedirRespuesta(); }
async function pedirRespuesta() {
  CHAT_CARGANDO = true; pintarCoach();
  const hist = chatLista().slice(-10).map(m => ({ rol: m.rol, texto: m.texto }));
  let msg;
  try {
    const r = await conLimite(apiPost('chat', [hist, contextoIA()]), 90000);
    msg = { rol: 'coach', texto: r.texto, ts: Date.now(), aprendio: r.aprendio || [] };
    if (r.memoria) { DATA.memoria = r.memoria; LS.set('gym_data', DATA); }
  } catch (e) {
    msg = { rol: 'coach', err: true, texto: 'No pude responder: ' + (e.message === 'tiempo' ? 'tardé demasiado.' : e.message), ts: Date.now() };
  }
  const lista = chatLista(); lista.push(msg); LS.set('gym_chat', lista.slice(-40));
  CHAT_CARGANDO = false;
  if (TAB === 'Coach') pintarCoach(); else if (!msg.err) toast('El coach te respondió', '', { txt: 'Ver', fn: () => verTab('Coach') });
}
// Lo que el coach ve de la app en cada pregunta (compacto: solo lo que ayuda a decidir)
function contextoIA() {
  const R = DATA.resumen || {}, Cu = DATA.cuerpo || {}, T = DATA.trotes || {};
  const protHoyLista = cargarProt(hoy());
  return {
    fecha: DATA.today, dias_de_gym: DATA.dias, grupo_de_hoy: grupoDeHoy(), bloque: DATA.bloquePara, semana_de_carrera: !!DATA.descargaCarrera,
    peso: { hoy: pesoDe(hoy()), promedio_7_dias: R.promedio7, cambio_vs_semana_pasada: R.cambioSemana,
            ultimos_30_dias: (R.serie30 || []).map(x => x.d + ' ' + x.v).join(', ') },
    cintura: { base: Cu.base, actual: Cu.actual, meta: Cu.meta, por_semana: (Cu.serie || []).map(x => x.d + ': ' + (x.cint || '—') + ' cm, ' + (x.peso || '—') + ' kg').join(' | ') },
    proteina: { meta: metaProt(), hoy_g: protTotal(protHoyLista), comido_hoy: protHoyLista.map(tDe), promedio_7_dias: R.protProm7 },
    gym: { dias_ultimos_7: R.gymDias7, dias_esta_semana: R.diasSemana, racha_semanas: R.racha,
           series_por_musculo_7_dias: (R.musculos || []).map(m => m.m + ' ' + m.series7).join(', '),
           records_recientes: (R.records || []).slice(0, 5) },
    sesion_de_hoy: sesion().log.map(l => l.ej + ': ' + resumenSets(l.sets) + ' ' + l.unit),
    ejercicios: DATA.exercises.filter(e => e.anterior && e.anterior.length).map(e => e.group + ' · ' + e.ejercicio + ' (' + e.min + '–' + e.max + ' reps) · ' +
      'última vez ' + e.lastWhen + ' → ' + resumenSets(e.anterior) + ' ' + e.unit + (e.hint ? ' · siguiente: ' + e.hint : '')),
    trote: { km_7_dias: T.km7, ultimos: (T.ultimos || []).map(t => t.d + ' ' + t.km + ' km en ' + t.min + ' min' + (t.tipo ? ' (' + t.tipo + ')' : '')),
             carrera: DATA.carrera, plan_semana: DATA.plan ? (DATA.plan.sesiones || []).map(x => x.tipo + ' ' + x.txt + (x.hecho ? ' ✓' : '')) : null },
    puntos_semana: DATA.logros ? DATA.logros.semana : null
  };
}
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
  let h = '<div class="seg s4">' + ['Semana', 'Fuerza', 'Cuerpo', 'Logros'].map(t => '<button class="' + (PTAB === t ? 'on' : '') + '" onclick="PTAB=\'' + t + '\';pintarProgreso();window.scrollTo(0,0)">' + t + '</button>').join('') + '</div>';
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
    (DATA.logros ? '<button class="link" style="margin-top:10px" onclick="PTAB=\'Logros\';pintarProgreso();window.scrollTo(0,0)">' +
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
    kpi(r.protProm7 !== null ? r.protProm7 + ' g' : '—', 'Proteína promedio', 'Meta: ' + metaProt() + ' g', r.protProm7 !== null && r.protProm7 >= metaProt()) + '</div>';
  h += '<a class="btn ghost block" style="display:block;text-align:center;text-decoration:none;margin-top:6px" href="' + r.sheetUrl + '" target="_blank" rel="noopener">Abrir dashboard completo</a>';
  return h;
}
function progresoCuerpo() {
  const r = DATA.resumen;
  let h = '<div class="kpis">' +
    kpi(fmt(r.promedio7), 'Peso promedio 7 días (kg)', r.cambioSemana !== null ? fmt(r.cambioSemana, true) + ' vs semana anterior' : '', r.cambioSemana !== null && r.cambioSemana <= 0) +
    kpi(fmt(r.cintura), 'Cintura (cm)', r.cambioCintura !== null ? fmt(r.cambioCintura, true) + ' desde el inicio' : '', r.cambioCintura !== null && r.cambioCintura < 0) + '</div>';
  h += tarjetaMetaCintura();
  const serie = (DATA.cuerpo && DATA.cuerpo.serie) || [];
  const cs = serie.filter(x => x.cint !== null).map(x => ({ d: x.d, v: x.cint }));
  const ps = serie.filter(x => x.peso !== null).map(x => ({ d: x.d, v: x.peso }));
  h += '<div class="card chart"><div class="t1">Cintura desde el inicio</div>' + (cs.length >= 2 ? linea(cs, false)
    : '<div class="muted" style="margin-top:6px">La gráfica aparece con 2 domingos medidos. Tu cintura es el mejor indicador de la grasa de la panza.</div>') + '</div>';
  h += '<div class="card chart"><div class="t1">Peso promedio por semana</div>' + (ps.length >= 2 ? linea(ps, false)
    : '<div class="muted" style="margin-top:6px">Aparece con 2 semanas de pesajes. El promedio semanal no se mueve con el agua de un día.</div>') + '</div>';
  h += '<div class="card chart"><div class="t1">Peso, últimos 30 días</div>' + graficaPeso(r.serie30) + '</div>';
  if (DATA.fotos && DATA.fotos.activas) h += tarjetaFotos();
  return h;
}
function tarjetaMetaCintura() {
  const c = DATA.cuerpo;
  if (!c) return '';
  if (!c.meta) return '<div class="card"><div class="t1">Tu meta de cintura</div><div class="muted" style="margin:4px 0 10px">Ponle número a la panza: con una meta ves cuánto llevas.</div>' +
    '<button class="btn ghost sm" onclick="abrirAjustes()">Ponerla en Ajustes</button></div>';
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
    '<div class="acts"><button class="btn ghost" onclick="cerrarModal()">Seguir</button><button class="btn" onclick="cerrarModal();verTab(\'Progreso\');PTAB=\'Logros\';pintarProgreso()">Ver mis logros</button></div>';
  abrirModal();
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
/* ----- Mapa muscular por zonas específicas (Catálogo T): cada ejercicio suma a sus zonas (principal 1, apoyo ½) ----- */
// Por zona: 0–3 gris (falta) · 4–7 ámbar (poco) · 8–20 verde (bien) · más de 20 rojo (alto: vigila la recuperación).
// Es más bajo que el 10–20 por músculo completo porque cada zona es una parte del músculo.
const zonaZ = n => n > 20 ? 3 : n >= 8 ? 2 : n >= 4 ? 1 : 0;
const ZONA_TXT = ['Falta trabajo', 'Poco: súmale series', 'Bien trabajada', 'Alto: vigila la recuperación'];
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
function svgCuerpo(z, espalda) {
  const lado = espalda ? 'espalda' : 'frente';
  const pieza = (m, d) => m ? '<path class="mz' + zonaZ(z[m] || 0) + (MUS_SEL === m ? ' sel' : '') + '" data-m="' + m + '" d="' + d + '" onclick="MUS_SEL=\'' + m + '\';pintarProgreso()"><title>' + m + '</title></path>'
    : '<path class="nz" d="' + d + '"/>';
  const mitad = ANAT[lado].map(x => pieza(x[0], x[1])).join('') + ANAT.fibras[lado].map(d => '<path class="fib" d="' + d + '"/>').join('');
  const espejo = c => '<g' + (c ? ' transform="matrix(-1 0 0 1 200 0)"' : '') + '>';
  // La silueta va dos veces: con borde abajo y sin borde encima, para que no se vea la costura del centro
  const sil = cls => espejo(false) + '<path class="' + cls + '" d="' + ANAT.sil + '"/></g>' + espejo(true) + '<path class="' + cls + '" d="' + ANAT.sil + '"/></g>';
  return '<svg viewBox="18 4 164 448" role="img" aria-label="' + (espalda ? 'Espalda' : 'Frente') + '">' + sil('sil borde') + sil('sil') +
    espejo(false) + mitad + '</g>' + espejo(true) + mitad + '</g><text x="100" y="449">' + (espalda ? 'ESPALDA' : 'FRENTE') + '</text></svg>';
}
const ZONAS = ['Pecho superior', 'Pecho medio', 'Deltoide frontal', 'Deltoide lateral', 'Deltoide posterior', 'Trapecio', 'Dorsal', 'Espalda media', 'Lumbar',
  'Bíceps', 'Tríceps', 'Antebrazo', 'Abdomen', 'Oblicuos', 'Cuádriceps', 'Isquiosurales', 'Glúteo', 'Glúteo medio', 'Aductores', 'Pantorrilla'];
// "▶ Tu semana": el mapa empieza en gris y se pinta día por día con lo que entrenaste
let SEM_T = [];
function verSemana() {
  const dias = ((DATA.resumen || {}).zonasDias || []), piezas = [...document.querySelectorAll('.cuerpo [data-m]')], lbl = $('semDia'), btn = $('semBtn');
  if (!dias.length || !piezas.length) return;
  SEM_T.forEach(clearTimeout); SEM_T = [];
  const pintar = acc => piezas.forEach(el => el.setAttribute('class', 'mz' + zonaZ(acc[el.dataset.m] || 0)));
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
    pintar((DATA.resumen || {}).zonas7 || acc);
    piezas.forEach(el => { if (el.dataset.m === MUS_SEL) el.classList.add('sel'); });
    if (lbl) lbl.textContent = 'Así quedó tu semana'; if (btn) btn.disabled = false;
  }, 700 + dias.length * 1100 + 600));
}
function tarjetaMusculos(ms) {
  const z = (DATA.resumen && DATA.resumen.zonas7) || {};
  const col = ['var(--muted)', 'var(--acc)', 'var(--ok)', 'var(--bad)'];
  const n = m => String(Math.round((z[m] || 0) * 2) / 2).replace('.5', '½');
  let h = '<h2>Tus músculos</h2><div class="card"><div class="muted" style="margin-bottom:2px">Series efectivas de 7 días por zona (el ejercicio principal cuenta 1; el de apoyo, ½). Toca una zona.</div>' +
    '<div class="cuerpo">' + svgCuerpo(z, false) + svgCuerpo(z, true) + '</div>' +
    '<div class="leyenda">' + ['0–3', '4–7', '8–20', '+20'].map((t, i) => '<span><i style="background:' + col[i] + (i === 0 ? ';opacity:.4' : '') + '"></i>' + t + '</span>').join('') + '</div>';
  if (((DATA.resumen || {}).zonasDias || []).length) h += '<div class="semana"><span class="dia" id="semDia"></span><button class="btn ghost sm" id="semBtn" onclick="verSemana()">▶ Tu semana</button></div>';
  if (MUS_SEL) {
    const v = z[MUS_SEL] || 0, falta = Math.max(0, 8 - v);
    const quien = DATA.exercises.filter(e => (e.zonas || []).some(x => x.z === MUS_SEL && x.w >= 1)).map(e => e.ejercicio.split(' (')[0]).filter((x, i, a) => a.indexOf(x) === i);
    h += '<div class="msel entra"><b>' + esc(MUS_SEL) + '</b> · <span class="num">' + n(MUS_SEL) + ' series</span> · ' + ZONA_TXT[zonaZ(v)] +
      (falta ? '<div class="muted" style="font-size:13px;margin-top:3px">Te faltan ~' + Math.ceil(falta) + ' series esta semana para llegar a 8.</div>' : '') +
      (quien.length ? '<div class="muted" style="font-size:13px;margin-top:3px">La trabajan de forma directa: ' + esc(quien.slice(0, 5).join(', ')) + '.</div>' : '') + '</div>';
  }
  h += '<div class="mchips">' + ZONAS.slice().sort((a, b) => (z[a] || 0) - (z[b] || 0)).map(m => '<button onclick="MUS_SEL=\'' + jsq(m) + '\';pintarProgreso()"><i style="background:' + col[zonaZ(z[m] || 0)] + '"></i>' +
    esc(m) + ' <b class="num">' + n(m) + '</b></button>').join('') + '</div>';
  // Resumen por músculo completo (el que usa el correo semanal), en una línea
  const g = (ms || []).filter(x => x.series7 > 0).sort((a, b) => b.series7 - a.series7);
  if (g.length) h += '<div class="muted" style="font-size:12.5px;margin-top:10px">Por músculo completo: ' + g.map(x => esc(x.m) + ' ' + String(x.series7).replace('.5', '½')).join(' · ') + '</div>';
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
    hap('ok'); toast('Foto guardada ✓'); pintarProgreso();
  };
  img.onerror = () => toast('No pude leer la foto');
  img.src = url;
}

/* ===================== BIENVENIDA (una sola vez, para quien no es el dueño) ===================== */
let BV = null;
function abrirBienvenida() {
  if (BV_POSPUESTA || sesionActiva() || $('modal').classList.contains('show')) return;
  if (!BV) BV = { peso: '', dias: (DATA.dias || [1, 2, 3, 4, 5]).slice(), km: 0, fecha: '' };
  const meta = BV.peso ? Math.round(Number(BV.peso) * 1.6 / 5) * 5 : null;
  $('sheet').innerHTML = '<div class="bv"><div class="t2">¡Bienvenido, ' + esc(DATA.nombre || '') + '!</div>' +
    '<div class="muted" style="margin-top:4px">3 datos y listo: con esto ajusto tu meta de proteína y tus avisos.</div>' +
    '<label>1. Tu peso (kg)</label><input type="number" inputmode="decimal" step="0.1" id="bvPeso" placeholder="Ej. 72" value="' + esc(BV.peso) + '" oninput="BV.peso=this.value;bvMeta()">' +
    '<div class="muted" id="bvMeta" style="margin-top:6px">' + (meta ? 'Tu meta de proteína: <b style="color:var(--text)">' + meta + ' g al día</b>' : 'Con tu peso calculo tu meta de proteína.') + '</div>' +
    '<label>2. ¿Qué días entrenas?</label><div class="muted">Esos días te llega el aviso a las 5:00 am.</div><div class="dias">' +
    [1, 2, 3, 4, 5, 6, 0].map(d => '<button class="' + (BV.dias.includes(d) ? 'on' : '') + '" onclick="BV.dias=bvToggle(BV.dias,' + d + ');abrirBienvenida()">' + DIAS_CORTOS[d] + '</button>').join('') + '</div>' +
    '<label>3. ¿Tienes alguna carrera?</label><div class="pills" style="display:grid;grid-template-columns:repeat(4,1fr);margin:0">' +
    [[0, 'No'], [5, '5 km'], [10, '10 km'], [21, '21 km']].map(x => '<button class="' + (BV.km === x[0] ? 'on' : '') + '" onclick="BV.km=' + x[0] + ';abrirBienvenida()">' + x[1] + '</button>').join('') + '</div>' +
    (BV.km ? '<input type="date" id="bvFecha" min="' + hoy() + '" value="' + esc(BV.fecha) + '" onchange="BV.fecha=this.value">' : '') +
    '<div class="acts"><button class="btn ghost" onclick="BV_POSPUESTA=true;cerrarModal()">Ahora no</button><button class="btn" onclick="guardarBienvenida()">Listo</button></div></div>';
  abrirModal();
}
function bvToggle(lista, d) { return lista.includes(d) ? lista.filter(x => x !== d) : lista.concat([d]).sort(); }
function bvMeta() {
  const m = Number(BV.peso) >= 30 ? Math.round(Number(BV.peso) * 1.6 / 5) * 5 : null;
  $('bvMeta').innerHTML = m ? 'Tu meta de proteína: <b style="color:var(--text)">' + m + ' g al día</b>' : 'Con tu peso calculo tu meta de proteína.';
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
  encolar('saveConfig', [cfg], 'cfg-bienvenida');
  cerrarModal(); hap('ok');
  toast('¡Listo! Meta de proteína: ' + cfg.metaProteina + ' g');
  pintarTab();
  setTimeout(() => enviar().then(actualizar), 1500);
}

/* ===================== AJUSTES ===================== */
function abrirAjustes() {
  if (!DATA) return;
  const tog = (k, d, txt, sub) => '<div class="opt"><div class="txt"><div class="t1" style="font-size:15px">' + txt + '</div><div class="muted">' + sub + '</div></div>' +
    '<button class="tog' + (ajuste(k, d) ? ' on' : '') + '" onclick="toggleAjuste(\'' + k + '\',' + d + ')" aria-label="' + esc(txt) + '"></button></div>';
  const def = ajuste('descanso', 90), c = DATA.carrera;
  $('sheet').innerHTML = '<div class="row between"><div class="t2">Ajustes</div><button class="btn ghost sm" onclick="cerrarModal()">✕</button></div>' +
    tog('pantalla', true, 'Pantalla encendida en la sesión', 'Para que el descanso suene y no tengas que desbloquear') +
    tog('reloj', NATIVO, 'Avisar al terminar el descanso', NATIVO ? 'Notificación con vibración aunque la pantalla esté bloqueada; llega a tu reloj' : 'Notificación al terminar (solo si la app está abierta; en el APK llega aunque bloquees)') +
    tog('autoDescanso', false, 'Iniciar el descanso solo', 'Si está apagado, solo te sugiere tiempos al marcar una serie') +
    tog('iaPlan', true, 'Plan del día con IA', 'Al abrir Entrenar: un foco para la sesión y una meta por ejercicio') +
    tog('ia', true, 'La IA afina el consejo entre series', 'El motor te dice al instante qué hacer en la siguiente serie (sin señal); con señal, Gemini elige entre sus opciones y te explica por qué') +
    tog('calentamiento', false, 'Calentamiento automático', 'En los básicos con barra agrega 2 series ligeras (50 % y 70 %) al abrirlos') +
    '<div class="opt" style="display:block"><div class="t1" style="font-size:15px;margin-bottom:8px">Descanso predeterminado</div><div class="pills" style="margin:0;display:grid;grid-template-columns:repeat(4,1fr)">' +
    DESCANSOS.map(s => '<button class="' + (s === def ? 'on' : '') + '" onclick="setAjuste(\'descanso\',' + s + ');abrirAjustes()">' + mmss(s) + '</button>').join('') + '</div></div>' +
    '<div class="opt"><div class="txt"><div class="t1" style="font-size:15px">Meta de proteína</div><div class="muted">Unos 1.6–2 g por kilo de tu peso</div></div>' +
    '<div class="unit"><button onclick="cambiarMeta(-5)">−5</button><button class="on num" style="pointer-events:none">' + metaProt() + ' g</button><button onclick="cambiarMeta(5)">+5</button></div></div>' +
    '<div class="opt" style="display:block"><div class="t1" style="font-size:15px">Días de aviso</div><div class="muted">Esos días te llega a las 5:00 am lo que te toca</div><div class="dias">' +
    [1, 2, 3, 4, 5, 6, 0].map(d => '<button class="' + ((DATA.dias || []).includes(d) ? 'on' : '') + '" onclick="cambiarDias(' + d + ')">' + DIAS_CORTOS[d] + '</button>').join('') + '</div></div>' +
    '<div class="opt"><div class="txt"><div class="t1" style="font-size:15px">Meta de cintura</div><div class="muted">' +
    (DATA.cuerpo && DATA.cuerpo.actual ? 'Hoy: ' + DATA.cuerpo.actual + ' cm' : 'A la altura del ombligo') + '</div></div>' +
    (DATA.cuerpo && DATA.cuerpo.meta
      ? '<div class="unit"><button onclick="cambiarMetaCintura(-0.5)">−</button><button class="on num" style="pointer-events:none">' + DATA.cuerpo.meta + ' cm</button><button onclick="cambiarMetaCintura(0.5)">+</button></div>'
      : '<button class="btn ghost sm" onclick="cambiarMetaCintura(0)">Poner meta</button>') + '</div>' +
    '<div class="opt" style="display:block"><div class="t1" style="font-size:15px">Carrera</div><div class="muted">Con una carrera de 5 km activa tu plan de 6 semanas en la pestaña Trote</div>' +
    '<input type="date" id="carFecha" min="' + hoy() + '" value="' + (c ? c.fecha : '') + '">' +
    '<div class="pills" style="display:grid;grid-template-columns:repeat(4,1fr);margin:0">' + [5, 10, 21].map(k => '<button class="' + (c && c.km === k ? 'on' : '') + '" onclick="guardarCarrera(' + k + ')">' + k + ' km</button>').join('') +
    '<button onclick="guardarCarrera(0)">Ninguna</button></div></div>' +
    '<div class="opt"><div class="txt"><div class="t1" style="font-size:15px">Respaldo</div><div class="muted">Descarga lo que tiene la app en este celular</div></div>' +
    '<button class="btn ghost sm" onclick="descargarRespaldo()">Descargar</button></div>' +
    '<a class="btn ghost block" style="display:block;text-align:center;text-decoration:none;margin-top:8px" href="' + DATA.resumen.sheetUrl + '" target="_blank" rel="noopener">Abrir mi hoja de Google</a>' +
    (NATIVO ? '' : '<div class="opt"><div class="txt"><div class="t1" style="font-size:15px">Pasar a la app nativa (APK)</div><div class="muted">Copia tu link y pégalo en la app la primera vez</div></div>' +
      '<button class="btn ghost sm" onclick="copiarLinkConfig()">Copiar</button></div>') +
    '<div class="muted" style="text-align:center;margin-top:10px;font-size:12px">Gym ' + VERSION_APP + (NATIVO ? ' (app)' : '') + ' · ' + esc(DATA.nombre || '') + '</div>';
  abrirModal();
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
