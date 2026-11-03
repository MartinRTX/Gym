// Coach: chat con la IA y lo que ve de la app
// (Parte de la app: se carga después de comida-dia.js; ver el orden en index.html)

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
  b.setAttribute('data-click', 'verTab'); b.setAttribute('data-click-a', '["Coach"]'); ACCIONES_OK.add('verTab');
  b.innerHTML = '<span class="bola"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/></svg></span>Coach';
  // Con Coach la barra queda simétrica: Comida · Progreso · ENTRENAR · Músculos · Coach
  $('nMusculos').after(b);
}
// Texto del coach: **negritas**, viñetas y saltos de línea; todo lo demás escapado
function formatoChat(t) {
  return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^\s*[-*•]\s+/gm, '• ').replace(/\n/g, '<br>');
}
// Una conversación por día: al día siguiente la de ayer pasa al archivo y empiezas en limpio
function rotarChat() {
  const l = chatLista(), u = l[l.length - 1];
  if (!CHAT_CARGANDO && u && u.ts && claveDia(new Date(u.ts)) !== hoy()) { LS.set('gym_chat_ant', l); LS.set('gym_chat', []); CHAT_TODO = false; }
}
let CHAT_TODO = false, CHAT_ANT = false;
const CHAT_VISIBLES = 6;   // mensajes a la vista; los anteriores se abren con un botón
function burbuja(m) {
  return '<div class="msg ' + (m.rol === 'yo' ? 'yo' : 'coach') + (m.err ? ' err' : '') + '">' +
    (m.rol === 'yo' ? esc(m.texto).replace(/\n/g, '<br>') : formatoChat(m.texto)) +
    (m.aprendio && m.aprendio.length ? '<span class="aprendio">🧠 Lo anoté: ' + esc(m.aprendio.join(' · ')) + '</span>' : '') +
    (m.err ? '<br><button class="link" ' + on('reintentarChat') + '>Reintentar</button>' : '') + '</div>';
}
function pintarCoach() {
  rotarChat();
  const lista = chatLista(), ant = LS.get('gym_chat_ant', []);
  let h = '<div class="row between" style="margin:4px 0 6px"><div class="t1">Pregúntale a tu coach</div>' +
    (lista.length ? '<button class="link" ' + on('nuevaCharla') + '>Nueva conversación</button>' : '') + '</div>';
  const mem = DATA.memoria || [];
  h += '<details class="mem"' + (MEM_ABIERTA ? ' open' : '') + ' ' + ev('toggle', 'memAbierta', ABIERTO) + '><summary>🧠 Lo que tu coach ha aprendido de ti · ' + mem.length + '</summary>' +
    (mem.length ? '<ul>' + mem.map((m, i) => '<li><span>' + esc(m) + '</span><button ' + on('borrarMemoria', i) + ' aria-label="Olvidar esto">✕</button></li>').join('') + '</ul>'
      : '<div class="muted" style="font-size:13.5px;margin-top:6px">Todavía nada. Aprende al terminar cada sesión y cuando le cuentas algo duradero (una molestia, un cambio de horario).</div>') +
    '<div class="muted" style="font-size:12px;margin-top:4px">Lo usa en cada consejo entre series, en el plan del día y en el chat. Toca ✕ para que lo olvide.</div></details>';
  if (!lista.length) h += '<div class="muted" style="margin-bottom:10px">Conoce tus pesos, tu proteína, tu cintura, tus trotes y tu plan. Pregúntale lo que quieras.</div>' +
    '<div class="sugs">' + SUGS_CHAT.map(q => '<button ' + on('preguntar', q) + '>' + esc(q) + '</button>').join('') + '</div>';
  // La conversación anterior (de otro día) se puede abrir, pero no estorba
  if (ant.length) h += '<button class="chatmas" ' + on('alternarChatAnt') + '>' + (CHAT_ANT ? 'Ocultar' : 'Ver') + ' la conversación anterior · ' +
    diaCorto(claveDia(new Date(ant[ant.length - 1].ts || Date.now()))) + '</button>' +
    (CHAT_ANT ? '<div class="chat anterior">' + ant.map(burbuja).join('') + '</div>' : '');
  const ocultos = CHAT_TODO ? 0 : Math.max(0, lista.length - CHAT_VISIBLES);
  if (ocultos) h += '<button class="chatmas" ' + on('verTodoChat') + '>Ver ' + ocultos + ' mensaje' + (ocultos === 1 ? '' : 's') + ' anterior' + (ocultos === 1 ? '' : 'es') + ' de hoy</button>';
  h += '<div class="chat">' + lista.slice(ocultos).map(burbuja).join('') +
    (CHAT_CARGANDO ? '<div class="msg coach pensando" aria-label="Pensando"><span></span><span></span><span></span></div>' : '') + '</div>';
  h += '<div class="chatin">' + botonMic('chatTxt', 'preguntar') + '<textarea id="chatTxt" rows="1" maxlength="1500" placeholder="Escribe tu pregunta…" ' + ev('input', 'borrador', 'chatTxt', VALOR) + '>' + esc(BORR.chatTxt || '') + '</textarea>' +
    '<button class="btn"' + (CHAT_CARGANDO ? ' disabled' : '') + ' ' + on('preguntar') + '>Enviar</button></div>' +
    '<p class="muted" style="font-size:12px;margin-top:8px">Respuestas de IA (Gemini): pueden equivocarse. Si tienes dolor o una lesión, consulta a un médico.</p>';
  $('vCoach').innerHTML = h;
  if (lista.length || CHAT_CARGANDO) setTimeout(() => window.scrollTo({ top: document.body.scrollHeight }), 30);
}
function nuevaCharla() {
  if (CHAT_CARGANDO) return;
  const l = chatLista();
  if (l.length) LS.set('gym_chat_ant', l);
  LS.set('gym_chat', []); CHAT_TODO = false; CHAT_ANT = false; pintarCoach();
}
function preguntar(q) {
  if (CHAT_CARGANDO) return;
  const txt = (q || ($('chatTxt') || {}).value || '').trim();
  if (!txt) return;
  if (!navigator.onLine) return toast('Necesitas señal para hablar con el coach');
  rotarChat();
  const lista = chatLista().filter(m => !m.err);
  delete BORR.chatTxt;
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
    macros: (() => { const t = totalMacros(protHoyLista), m = metasHoy(); return { hoy: { kcal: t.k, carbs_g: t.c, grasa_g: t.f, fibra_g: t.fib }, metas: { kcal: m.k, carbs_g: m.c, grasa_g: m.f, fibra_g: m.fib },
      promedio_7_dias: DATA.macros7 || null }; })(),
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
function quitarProt(i) {
  asegurarProt();
  const dia = diaComida(), t = etiquetas(dia, prot.length);
  prot.splice(i, 1); t.splice(i, 1); LS.set('gym_protmeal_' + dia, t);
  cambiarProt();
}
