// Comida (pantalla del día): proteína por comida, aviso de las 6 pm, pasos, comida con IA y dictado por voz
// (Parte de la app: se carga después de trote.js; ver el orden en index.html)

/* ===================== COMIDA ===================== */
function protTotal(lista) { return Math.round((lista || prot).reduce((s, k) => s + gDe(k), 0)); }
/* ----- Proteína por comida: ~30 g en desayuno, comida y cena. Cada cosa que anotas lleva su comida (solo en este celular) ----- */
const COMIDAS = [['d', 'Desayuno', '🌅'], ['c', 'Comida', '☀️'], ['n', 'Cena', '🌙']], META_COMIDA = 30;
let COMIDA_SEL = null, COMIDA_SEL_T = 0;   // la que elegiste a mano vale 2 horas; si no, según la hora
const comidaPorHora = h => h < 12 ? 'd' : h < 18 ? 'c' : 'n';
const nombreDeComida = m => (COMIDAS.find(c => c[0] === m) || [m, m])[1];
function comidaActual() { return COMIDA_SEL && Date.now() - COMIDA_SEL_T < 2 * 3600e3 ? COMIDA_SEL : comidaPorHora(new Date().getHours()); }
// Una etiqueta por cosa anotada, en el mismo orden que la lista del día (las que vienen de la hoja no tienen)
function etiquetas(dia, n) { const t = LS.get('gym_protmeal_' + dia, []); return Array.from({ length: n }, (_, i) => t[i] || null); }
// Para el día típico: la comida en que sueles anotar eso (la que más veces le has puesto)
function comidaHabitual(k, porDefecto) {
  const c = LS.get('gym_food_meal', {})[k];
  const m = c ? Object.keys(c).sort((a, b) => c[b] - c[a])[0] : null;
  return m || (/^cena/i.test(k) ? 'n' : porDefecto);
}
function agregarAProt(claves, comidas) {
  asegurarProt();
  const dia = diaComida(), t = etiquetas(dia, prot.length), usos = LS.get('gym_food_meal', {});
  // En qué comida sueles anotar cada cosa se cuenta por plantilla (botón, receta), no por registro
  claves.forEach((k, i) => { const r = regDe(k), pk = !r ? k : r.src === 'receta' ? '@' + r.ref : r.src === 'boton' || r.src === 'fav' ? r.ref : null;
    if (pk) (usos[pk] = usos[pk] || {})[comidas[i]] = (usos[pk][comidas[i]] || 0) + 1; });
  claves = claves.map(expandirClave);
  claves.forEach((k, i) => { prot.push(k); t.push(comidas[i]); });
  LS.set('gym_protmeal_' + dia, t); LS.set('gym_food_meal', usos);
}
function gramosPorComida(lista, t) {
  const g = { d: 0, c: 0, n: 0, sin: 0 };
  lista.forEach((k, i) => { g[t[i] || 'sin'] += gDe(k); });
  return g;
}
// La comida que más falla en las últimas 2 semanas (entre semana o en fin de semana), si ya hay datos
function comidaQueFalla() {
  const acc = {};
  for (let i = 1; i <= 14; i++) {
    const dia = sumarDias(hoy(), -i), lista = LS.get('gym_prot_' + dia, null);
    if (!lista || !lista.length) continue;
    const t = etiquetas(dia, lista.length);
    if (t.some(x => !x)) continue;   // algo de ese día no tiene comida marcada (vino de la hoja): no se sabe de cuál fue
    const fin = [0, 6].includes(new Date(dia + 'T12:00:00').getDay()), g = gramosPorComida(lista, t);
    COMIDAS.forEach(c => { const k = c[0] + (fin ? 'F' : 'S'); (acc[k] = acc[k] || []).push(g[c[0]]); });
  }
  let peor = null;
  Object.keys(acc).forEach(k => {
    const l = acc[k], p = l.reduce((a, b) => a + b, 0) / l.length;
    if (l.length >= 2 && p < META_COMIDA - 5 && (!peor || p < peor.g)) peor = { m: k[0], fin: k[1] === 'F', g: Math.round(p), dias: l.length };
  });
  return peor;
}
const textoFalla = f => 'tu ' + nombreDeComida(f.m).toLowerCase() + (f.fin ? ' del fin de semana' : ' entre semana') + ' promedia ' + f.g + ' g';
function tarjetaPorComida() {
  const dia = diaComida(), g = gramosPorComida(prot, etiquetas(dia, prot.length)), sel = comidaActual(), falla = COMIDA_DIA ? null : comidaQueFalla();
  const ayuda = falla ? completarProt(META_COMIDA - falla.g) : [];
  return crudo(html`<div class="card porcomida"><div class="row between"><div class="t1">Por comida</div><span class="muted" style="font-size:12px">~${META_COMIDA} g en cada una</span></div>` +
    html`<div class="comidas3">${COMIDAS.map(c => {
      const v = Math.round(g[c[0]]);
      return html`<button class="${c[0] === sel ? 'on' : ''}${v >= META_COMIDA ? ' ok' : v > 0 ? ' baja' : ''}" ${on('elegirComidaDe', c[0])}>` +
        html`<span>${c[2]} ${c[1]}</span><b class="num">${v} g</b><small>${v >= META_COMIDA ? '✓ listo' : v > 0 ? 'faltan ' + (META_COMIDA - v) : 'sin anotar'}</small></button>`;
    }).map(crudo)}</div>` +
    html`<div class="muted" style="font-size:12.5px;margin-top:8px">Lo que agregues va a <b style="color:var(--text)">${nombreDeComida(sel)}</b>${sel === COMIDA_SEL && Date.now() - COMIDA_SEL_T < 2 * 3600e3 ? '' : ' (por la hora)'} · toca otra para cambiar${
      g.sin ? ' · ' + Math.round(g.sin) + ' g sin comida marcada' : ''}</div>` +
    (falla ? html`<div class="tip acc" style="margin:10px 0 0">⚠️ En 2 semanas, ${textoFalla(falla)}: ahí se te escapa la proteína.${
      ayuda.length ? ' Con ' + ayuda.map(nombreComida).join(' + ') + ' llegas a ' + META_COMIDA + ' g.' : ''}</div>` : '') + '</div>');
}

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
  return crudo(html`<div class="card"><div class="row between"><div class="t1">¿Qué comiste ayer?</div>` +
    html`<button class="btn ghost sm" ${on('noRegistrarAyer', ayer)} aria-label="No registrar">✕</button></div>` +
    html`<div class="muted" style="margin:2px 0 10px">Se quedó sin registrar la proteína del ${diaCorto(ayer)}.</div><div class="acts" style="margin-top:0">` +
    (tipico.length ? html`<button class="btn" style="white-space:nowrap" ${on('ayerTipico')}>Día típico · ${g} g</button>` : '') +
    html`<button class="btn ghost" ${on('comidaDe', String(ayer))}>${tipico.length ? 'Fue diferente' : 'Registrar ayer'}</button></div></div>`);
}
function ayerTipico() {
  const ayer = sumarDias(hoy(), -1), plantilla = diaTipicoLista(), lista = plantilla.map(expandirClave);
  LS.set('gym_prot_' + ayer, lista); LS.set('gym_protmeal_' + ayer, plantilla.map(k => comidaHabitual(k, null)));
  sincronizarDia(ayer, lista);
  hap('ok'); toast('Ayer: ' + protTotal(lista) + ' g ✓'); pintarTab();
}
function comidaDe(dia) {
  COMIDA_DIA = dia && dia !== hoy() ? dia : null;
  usarProt(diaComida());
  verTab('Comida');
}
function diaTipicoLista() {
  // El que armaste tú (se guarda en el celular y en tu configuración de la hoja)
  const propio = ajuste('diaTipico', null) || DATA.diaTipico;
  if (Array.isArray(propio)) return propio.map(k => k === 'Licuado' ? '@licuado' : k).filter(k => gDe(k) > 0);
  // Si nunca lo has editado: el de antes (Martin) o lo que más registras
  if (DATA.dueno) return ['@licuado', 'Tupper carne', 'Cena huevos', 'Scoop'];
  const cuenta = LS.get('gym_food_counts', {});
  return FOODS.slice().sort((a, b) => (cuenta[b.k] || 0) - (cuenta[a.k] || 0)).filter(f => cuenta[f.k]).slice(0, 3).map(f => f.k);
}
function pintarComida() {
  asegurarProt();
  const meta = metaProt(), tot = protTotal(), pct = Math.min(1, tot / meta), falta = meta - tot;
  const R = 74, C = 2 * Math.PI * R;
  const cuenta = LS.get('gym_food_counts', {});
  // Tus recetas propias (guardadas desde la IA) van junto a tus comidas
  const propias = recetasComoBotones().filter(r => /^@r-/.test(r.k)).map(r => Object.assign(r, { fav: true }));
  const todas = FOODS.concat(misComidas(), propias);
  const top = todas.slice().sort((a, b) => (cuenta[b.k] || 0) - (cuenta[a.k] || 0)).slice(0, 3).filter(f => cuenta[f.k]);
  const tipico = diaTipicoLista();
  let h = '';
  if (COMIDA_DIA) h += html`<div class="otro">${crudo(ICO.cal)}<span>Comida del ${diaCorto(COMIDA_DIA)}</span><button class="btn" ${on('comidaDe', null)}>Volver a hoy</button></div>`;
  else h += tarjetaAyer();
  // Anillo: al tocarlo alterna entre lo registrado y lo que te falta
  const verFalta = RING_FALTA && falta > 0;
  h += html`<div class="card protcard"><div class="row between"><div class="t2">Proteína de ${COMIDA_DIA ? 'ese día' : 'hoy'}</div>` +
    html`<span class="muted">Meta ${meta} g</span></div>` +
    html`<button class="ring" ${on('alternarRing')} aria-label="Cambiar entre registrado y lo que falta"><svg viewBox="0 0 170 170">` +
    html`<circle cx="85" cy="85" r="${R}" fill="none" stroke="var(--card2)" stroke-width="13"/>` +
    html`<circle cx="85" cy="85" r="${R - 14}" fill="none" stroke="var(--line)" stroke-width="1" stroke-dasharray="2 5"/>` +
    html`<circle cx="85" cy="85" r="${R}" fill="none" stroke="var(--ok)" stroke-width="13" stroke-linecap="round" ` +
    html`stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}" style="transition:stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)"/></svg>` +
    html`<div><div class="lbl">${verFalta ? 'Te faltan' : 'Registrado'}</div><div class="v num">${verFalta ? falta : tot}${
      verFalta ? '' : html`<small>/${meta}</small>`}</div><div class="muted">gramos</div></div></button>` +
    html`<div class="row between falta"><div class="t1">${falta > 0 ? 'Te faltan ~' + falta + ' g' : '¡Meta cumplida!'}</div>` +
    (falta <= 0 ? html`<span class="pill ok">✓ Listo</span>` : '') + '</div>' +
    html`<div class="consejo">💡 ${falta > 0 ? textoCompletar(falta) : 'Bien hecho hoy'}</div>${crudo(seguroNut(tarjetaMacros, 'macros'))}</div>`;
  h += seguroNut(filaSiempre, 'de siempre');
  h += seguroNut(filaHabitos, 'hábitos');
  h += botonRepetirAyer();
  if (!COMIDA_DIA) h += html`<button class="link" style="margin:0 2px 10px" ${on('abrirRepetir')}>📅 Repetir una comida de otro día</button>`;
  if (!prot.length && tipico.length) h += html`<button class="tipico" ${on('diaTipico')}><span class="ic">🍽️</span><span style="flex:1"><b>Mi día típico</b> <span class="pill ok">+${
    protTotal(tipico)} g</span><small>${tipico.map(k => FOODS.some(f => f.k === k) ? k : tDe(k).split(' · ')[0]).join(' · ')}</small></span><span class="mas">＋</span></button>`;
  if (top.length) h += html`<div class="row between"><h2>Lo que más comes</h2><span class="muted" style="font-size:12px">Frecuentes</span></div><div class="foods tops">${top.map(f => botonComida(f, true))}</div>`;
  const favs = misComidas().concat(propias).filter(f => !top.some(t => t.k === f.k));
  if (favs.length || QUITAR_FAV) h += html`<div class="row between"><h2>Mis comidas</h2><button class="link" ${on('alternarQuitarFav')}>${QUITAR_FAV ? 'Listo' : 'Editar'}</button></div>` +
    (QUITAR_FAV ? html`<div class="muted" style="margin:-4px 0 8px;font-size:13px">Toca una para quitarla de tus comidas</div>` : '') +
    html`<div class="foods">${(QUITAR_FAV ? misComidas().concat(propias) : favs).map(f => botonComida(f, false))}</div>`;
  h += html`<div class="row between"><h2>Agregar</h2><span class="rapido">Toque rápido</span></div><div class="foods">${FOODS.filter(f => !top.includes(f) && f.k !== 'Licuado').map(f => botonComida(f, false))}</div>`;
  // Primero los botones para agregar (lo que más usas); después en qué comida va y tu día típico
  h += tarjetaPorComida() + tarjetaComidaIA();
  if (!COMIDA_DIA) h += html`<button class="link tipico-ed" ${on('editarTipico', true)}>✏️ ${tipico.length ? 'Editar mi día típico' : 'Arma tu día típico: lo agregas con un toque'}</button>`;
  if (prot.length) {
    const t = etiquetas(diaComida(), prot.length);
    h += html`<h2>${COMIDA_DIA ? 'Ese día comiste' : 'Hoy comiste'} · toca para corregir o quitar</h2>${COMIDAS.concat([[null, 'Sin comida marcada', '•']]).map(c => {
      const idx = prot.map((k, i) => i).filter(i => (t[i] || null) === c[0]);
      return idx.length ? html`<div class="muted comida-l">${c[2]} ${c[1]}</div><div class="eaten">${idx.map(i => { const m = macrosDe(prot[i]), r = regDe(prot[i]);
        const ojo = avisosItem(m, r && r.q, r ? r.src : esRec(prot[i]) ? 'receta' : '', r && (r.partes || partesSiNoCambio(r)), tDe(prot[i])).length;
        return html`<button${ojo ? html` class="grande"` : ''} ${on('abrirItemDia', i)}>${ojo ? '⚠️ ' : ''}${tDe(prot[i])} ✏️` +
        html`<span class="mac">${Math.round(m.p || 0)} g prot${m.k !== null && m.k !== undefined ? ' · ' + Math.round(m.k) + ' kcal' : ''}</span></button>`; }).map(crudo)}</div>` : '';
    })}`;
  }
  h += '<p class="muted" style="margin-top:14px">Cantidades aproximadas. Lo que cuenta es acercarte a la meta casi todos los días.</p>';
  $('vComida').innerHTML = h;
}
function botonComida(f, esTop) {
  const c = prot.filter(k => k === f.k).length;
  const quitar = QUITAR_FAV && f.fav;
  return crudo(html`<button class="food${esTop ? ' top' : ''}${f.fav ? ' fav' : ''}${quitar ? ' quitar' : ''}" ` +
    html`${quitar ? (f.rec ? on('quitarReceta', f.k.slice(1)) : on('quitarFav', f.t)) : on('addProt', f.k)}>` +
    html`<span class="ic">${iconoComida(f)}</span><b>+${f.g} g</b><span class="nom">${f.t}</span>` +
    html`${c && !quitar ? html`<span class="c">×${c}</span>` : ''}${esTop ? html`<span class="mas">＋</span>` : ''}</button>`);
}
// Ícono de cada acceso rápido (los que agregas tú usan uno genérico)
const ICONO_COMIDA = { 'Licuado': '🥤', 'Scoop': '🥛', 'Tupper carne': '🍗', 'Tupper pasta': '🍝', 'Cena huevos': '🍳', 'Cena pollo': '🌮', 'Quesadillas': '🫓',
  'Huevos': '🥚', 'Atún': '🐟', 'Carne': '🥩', 'Leche': '🥛', 'Yogurt': '🍶', 'Calle': '🌯' };
function iconoComida(f) {
  if (esRec(f.k)) { const r = recetaDe(f.k.slice(1)); return r && r.ico || '🍽️'; }
  return ICONO_COMIDA[f.k] || '🍽️';
}
function cambiarProt() {
  const dia = diaComida();
  LS.set('gym_prot_' + dia, prot);
  sincronizarDia(dia, prot);
  if (dia === hoy()) { programarAvisoProt(); actualizarWidgets(); }
  pintarComida();
}
function addProt(k) {
  agregarAProt([k], [comidaActual()]); hap('tecla');
  const c = LS.get('gym_food_counts', {}); c[k] = (c[k] || 0) + 1; LS.set('gym_food_counts', c);
  cambiarProt();
}
// "Repetir lo de ayer": todo lo que anotaste ayer, en la misma comida (desayuno, comida, cena), con un toque
function botonRepetirAyer() {
  if (COMIDA_DIA || LS.get('gym_repetido_' + hoy(), false)) return '';
  const l = cargarProt(sumarDias(hoy(), -1)) || [];
  if (!l.length) return '';
  return html`<button class="tipico" ${on('repetirAyer')}><span class="ic">↺</span><span style="flex:1"><b>Repetir lo de ayer</b> <span class="pill ok">+${protTotal(l)} g</span><small>${
    l.slice(0, 5).map(k => tDe(k).split(' · ')[0]).join(' · ') + (l.length > 5 ? ' y ' + (l.length - 5) + ' más' : '')}</small></span><span class="mas">＋</span></button>`;
}
function repetirAyer() {
  const ayer = sumarDias(hoy(), -1), l = cargarProt(ayer) || [], t = etiquetas(ayer, l.length);
  // Los registros con macros se copian (cada día tiene los suyos)
  const claves = l.map(k => esReg(k) && regDe(k) ? nuevoRegistro(regDe(k)) : k);
  agregarAProt(claves, t.map(x => x || comidaActual()));
  LS.set('gym_repetido_' + hoy(), true);
  hap('ok'); cambiarProt(); toast('+' + protTotal(l) + ' g: lo mismo que ayer ✓');
}
function diaTipico() { const l = diaTipicoLista(); agregarAProt(l, l.map(k => comidaHabitual(k, comidaActual()))); cambiarProt(); }
// Editor del día típico: cuántas veces va cada comida (la misma puede ir 2 veces)
let TIPICO_TMP = null;
function editarTipico(nuevo) {
  if (nuevo || !TIPICO_TMP) TIPICO_TMP = diaTipicoLista().slice();
  const vistas = {}, todas = recetasComoBotones().concat(misComidas(), FOODS.filter(f => f.k !== 'Licuado')).filter(f => !vistas[f.k] && (vistas[f.k] = true));
  const cuantas = k => TIPICO_TMP.filter(x => x === k).length, tot = protTotal(TIPICO_TMP);
  $('sheet').innerHTML = html`<div class="row between"><div class="t2">Mi día típico</div><button class="btn ghost sm" ${on('cerrarTipico')}>✕</button></div>` +
    html`<div class="muted" style="margin:4px 0 10px">Lo que comes casi todos los días. Con un toque en Comida se agrega todo junto. Total: <b class="num" style="color:${
      tot >= metaProt() ? 'var(--ok)' : 'var(--text)'}">${tot} g</b> de ${metaProt()} g.</div><div class="tipico-lista">${
    todas.map(f => { const n = cuantas(f.k); return crudo(html`<div class="tl${n ? ' on' : ''}"><span class="ic">${iconoComida(f)}</span><span class="nm">${f.t}<small>${f.g} g</small></span>` +
      html`<button class="mini" ${on('tipicoMas', f.k, -1)}${n ? '' : ' disabled'} aria-label="Menos">−</button><b class="num">${n}</b>` +
      html`<button class="mini" ${on('tipicoMas', f.k, 1)} aria-label="Más">+</button></div>`); })}</div>` +
    html`<div class="acts"><button class="btn ghost" ${on('vaciarTipico')}>Vaciar</button><button class="btn" ${on('guardarTipico')}>Guardar</button></div>`;
  if (!$('modal').classList.contains('show')) abrirModal();
}
function tipicoMas(k, d) {
  if (d > 0) TIPICO_TMP.push(k);
  else { const i = TIPICO_TMP.lastIndexOf(k); if (i > -1) TIPICO_TMP.splice(i, 1); }
  hap('tecla'); editarTipico();
}
function guardarTipico() {
  const l = TIPICO_TMP || [];
  setAjuste('diaTipico', l); DATA.diaTipico = l; LS.set('gym_data', DATA);
  encolar('saveConfig', [{ diaTipico: l }], 'cfg-tipico');
  TIPICO_TMP = null; cerrarModal(); hap('ok');
  toast(l.length ? 'Día típico guardado: ' + protTotal(l) + ' g' : 'Día típico vacío');
  pintarComida(); actualizarWidgets();
}

/* ----- Proteína a las 6 pm: cuánto llevas, cuánto falta y qué de lo que sí comes la completa ----- */
const AVISO_PROT = 80;   // un aviso por día de la semana: ids 80 (dom) a 86 (sáb)
function completarProt(falta) {
  if (falta <= 0) return [];
  const cuenta = LS.get('gym_food_counts', {}), vistas = {};
  const lista = recetasComoBotones().concat(misComidas(), FOODS.filter(f => f.k !== 'Licuado')).filter(f => f.g > 0 && !vistas[f.k] && (vistas[f.k] = true))
    .sort((a, b) => ((cuenta[b.k] || 0) + (b.fav || b.rec ? 2 : 0)) - ((cuenta[a.k] || 0) + (a.fav || a.rec ? 2 : 0))).slice(0, 6);
  // Una sola que alcance (la más chica), o la pareja que alcanza con menos de sobra
  const una = lista.filter(f => f.g >= falta).sort((a, b) => a.g - b.g)[0];
  let par = null;
  lista.forEach((a, i) => lista.slice(i + 1).forEach(b => { const t = a.g + b.g; if (t >= falta && (!par || t < par.t)) par = { t: t, l: [a, b] }; }));
  if (una && (!par || una.g <= par.t)) return [una];
  return par ? par.l : lista.sort((a, b) => b.g - a.g).slice(0, 2);
}
const nombreComida = f => (f.fav || f.rec ? f.t.toLowerCase() : f.k.toLowerCase()) + ' (' + f.g + ' g)';
function textoCompletar(falta) {
  const c = completarProt(falta), suma = c.reduce((a, f) => a + f.g, 0);
  return c.length ? 'Con ' + c.map(nombreComida).join(' + ') + (suma >= falta ? ' la cierras' : ' te acercas') : 'Te faltan ' + falta + ' g';
}
function tarjetaProt6() {
  if (new Date().getHours() < 18 || !ajuste('avisoProt', true)) return '';
  const tot = protTotal(cargarProt(hoy())), falta = metaProt() - tot;
  if (falta <= 0) return '';
  const c = completarProt(falta);
  return crudo(html`<div class="card prot6"><div class="t1">🥩 Llevas ${tot} g, te faltan ${falta}</div><div class="muted" style="margin:4px 0 10px">${textoCompletar(falta)} · meta ${metaProt()} g</div>` +
    html`<div class="botones">${c.map(f => html`<button class="btn sm" ${on('addProtHoy', f.k)}>+${f.g} g ${f.fav ? f.t : f.k}</button>`)}` +
    html`<button class="btn ghost sm" ${on('verTab', 'Comida')}>Otra…</button></div></div>`);
}
/* ----- Pasos contra el trabajo de escritorio (Health Connect, lunes a viernes desde las 5 pm) ----- */
// Lo esperado a esta hora si repartes la meta de 7 am a 10 pm (el aviso nativo usa la misma cuenta)
function pasosEsperados(meta, d) { const h = d.getHours() + d.getMinutes() / 60; return Math.max(0, Math.min(meta, meta * (h - 7) / 15)); }
const horaTexto = d => (d.getHours() % 12 || 12) + (d.getMinutes() ? ':' + String(d.getMinutes()).padStart(2, '0') : '') + (d.getHours() < 12 ? ' am' : ' pm');
// ~100 pasos por minuto caminando; de 10 a 30 minutos, en múltiplos de 5
// Quien ya tenía Health Connect con el APK anterior no ha visto el permiso "en segundo plano": se le pide una vez
function tarjetaPermisoFondo() {
  const e = ESTADO_N;
  if (!NATIVO || !e || !ajuste('salud', false) || !ajuste('avisoPasos', true) || e.fondo || !e.fondoDisponible || LS.get('gym_fondo_no', false)) return '';
  return crudo(html`<div class="card pasos5"><div class="t1">🚶 Un permiso más para el aviso de pasos</div>` +
    html`<div class="muted" style="margin:4px 0 10px">Para que a las 5 pm te avise aunque la app esté cerrada, Health Connect necesita "Acceder a datos en segundo plano". Solo lectura, como lo demás.</div>` +
    html`<div class="acts" style="margin-top:0"><button class="btn ghost" ${on('noFondo')}>Ahora no</button>` +
    html`<button class="btn" ${on('permisoFondo')}>Permitir</button></div></div>`);
}
async function permisoFondo() { if (await conectarSalud()) configurarPasos(); pintarTab(); }
const minutosCaminar = faltan => Math.max(10, Math.min(30, Math.round(faltan / 100 / 5) * 5));
function tarjetaPasos() {
  if (!NATIVO || !ajuste('salud', false) || !ajuste('avisoPasos', true)) return '';
  const ahora = new Date(), dow = ahora.getDay(), s = LS.get('gym_salud', null);
  if (ahora.getHours() < HORA_PASOS || dow === 0 || dow === 6 || !s || Date.now() - s.ts > 3 * 3600e3) return '';
  const x = (s.pasos || []).find(p => p.k === hoy());
  if (!x) return '';   // hoy ninguna app ha mandado pasos: no se puede saber
  const meta = META_PASOS(), esperado = pasosEsperados(meta, ahora);
  if (x.v >= esperado) return '';
  const min = minutosCaminar(esperado - x.v);
  return crudo(html`<div class="card pasos5"><div class="t1">🚶 Son las ${horaTexto(ahora)} y llevas ${x.v.toLocaleString('es-MX')} pasos: camina ${min} minutos</div>` +
    html`<div class="muted" style="margin-top:4px">Meta ${meta.toLocaleString('es-MX')} al día; a esta hora irías en ~${(Math.round(esperado / 100) * 100).toLocaleString('es-MX')}` +
    html`. Después de horas sentado, una vuelta de ${min} min te pone al día.</div></div>`);
}
// APK: hoy a las 6 pm con tus números; sábado y domingo que vienen, un recordatorio aunque no abras la app
function programarAvisoProt() {
  if (!NATIVO || !DATA) return;
  nativo('LocalNotifications', 'cancel', { notifications: [0, 1, 2, 3, 4, 5, 6].map(d => ({ id: AVISO_PROT + d })).concat([0, 1, 2, 3, 4, 5, 6].map(d => ({ id: AVISO_PESO + d })), [{ id: AVISO_CINTURA }, { id: AVISO_KCAL }]) }).then(() => {
    const ahora = new Date(), lista = [];
    // 7 am: ¿ya te pesaste? (al tocarla abre el teclado con tu último peso); hoy solo si aún no te pesas
    if (ajuste('avisoPeso', true)) for (let d = 0; d < 7; d++) {
      const f = new Date(); f.setDate(f.getDate() + d); f.setHours(7, 0, 0, 0);
      if (f <= ahora || (d === 0 && pesoDe(hoy()) !== null)) continue;
      lista.push({ id: AVISO_PESO + f.getDay(), channelId: 'peso', schedule: { at: f, allowWhileIdle: true }, title: '⚖️ ¿Ya te pesaste?',
                   body: 'En ayunas, después del baño. Toca aquí: ya trae tu último peso' + (DATA.ultimoPeso ? ' (' + DATA.ultimoPeso + ' kg)' : '') + ' y solo le subes o bajas.', extra: { accion: 'peso' } });
    }
    // Domingo 8 am: medir la cintura con el protocolo (si ese domingo aún no la guardas)
    const dom = new Date(); dom.setDate(dom.getDate() + (7 - dom.getDay()) % 7); dom.setHours(8, 0, 0, 0);
    if (dom <= ahora || LS.get('gym_cint_' + claveDia(dom), null) !== null) dom.setDate(dom.getDate() + 7);
    lista.push({ id: AVISO_CINTURA, channelId: 'proteina', schedule: { at: dom, allowWhileIdle: true }, title: '📏 Hoy toca medir tu cintura',
                 body: 'A la altura del ombligo, en ayunas, al soltar el aire y sin apretar la cinta.' });
    // 9 pm: si te faltan o te pasaste más de 350 kcal de tu meta del día
    const nueve = new Date(); nueve.setHours(21, 0, 0, 0);
    if (ajuste('avisoKcal', true) && nueve > ahora && scriptNut()) seguroNut(() => {
      const t = totalMacros(cargarProt(hoy())), mt = metasHoy(), dif = mt.k - t.k;
      if (t.k > 0 && Math.abs(dif) > 350) lista.push({ id: AVISO_KCAL, channelId: 'proteina', schedule: { at: nueve, allowWhileIdle: true },
        title: dif > 0 ? 'Llevas ' + t.k.toLocaleString('es-MX') + ' kcal: te faltan ~' + Math.round(dif / 50) * 50 : 'Te pasaste ~' + Math.round(-dif / 50) * 50 + ' kcal hoy',
        body: dif > 0 ? 'Meta ' + mt.k.toLocaleString('es-MX') + '. Si ya no vas a comer, ¿anotaste todo? (aceite, bebidas, botanas)' : 'Meta ' + mt.k.toLocaleString('es-MX') + '. No pasa nada: mañana vuelve a tu plan normal, sin compensar de golpe.' });
    }, 'aviso kcal');
    if (!ajuste('avisoProt', true)) return canalProt().then(() => nativo('LocalNotifications', 'schedule', { notifications: lista }));
    for (let d = 0; d < 7; d++) {
      const f = new Date(); f.setDate(f.getDate() + d); f.setHours(18, 0, 0, 0);
      if (f <= ahora) continue;
      const dow = f.getDay(), base = { id: AVISO_PROT + dow, channelId: 'proteina', schedule: { at: f, allowWhileIdle: true } };
      if (d === 0) {
        const tot = protTotal(cargarProt(hoy())), falta = metaProt() - tot;
        if (falta > 0) lista.push(Object.assign(base, { title: 'Llevas ' + tot + ' g, te faltan ' + falta, body: textoCompletar(falta) + ' · meta ' + metaProt() + ' g' }));
      } else if (dow === 0 || dow === 6) {
        lista.push(Object.assign(base, { title: '¿Cómo vas de proteína?', body: 'Meta ' + metaProt() + ' g. Anota lo que llevas: el fin de semana es cuando más se escapa.' }));
      }
    }
    return canalProt().then(() => nativo('LocalNotifications', 'schedule', { notifications: lista }));
  });
}
const AVISO_CINTURA = 90, AVISO_PESO = 70, AVISO_KCAL = 96;   // peso: ids 70 (dom) a 76 (sáb)
const canalPeso = () => nativo('LocalNotifications', 'createChannel', { id: 'peso', name: 'Pesarte en la mañana', description: 'A las 7 am, si ese día aún no te pesas', importance: 3, visibility: 1 });
const canalProt = () => canalPeso().then(() => nativo('LocalNotifications', 'createChannel', { id: 'proteina', name: 'Proteína y cintura', description: 'A las 6 pm: cuánto llevas de proteína. Domingo: medir la cintura', importance: 3, visibility: 1 }));

/* ----- Comida con IA: escribes lo que comiste y calcula la proteína ----- */
let COMIDA_IA = null, QUITAR_FAV = false, RING_FALTA = false;
function tarjetaComidaIA() {
  if (!DATA.ia) return '';
  const c = COMIDA_IA || {};
  let h = html`<div class="card iacard"><div class="row between" style="margin-bottom:8px"><div class="t1">✨ Registro Inteligente</div><span class="pill pri">IA asistida</span></div>` +
    html`<textarea id="iaComida" maxlength="600" placeholder="Ej. 3 tacos de asada y una coca · o toca 📷, toma la tabla nutrimental y escribe: me comí la mitad" ${ev('input', 'textoComidaIA', VALOR)}>${c.texto || ''}</textarea>` +
    html`<div class="fila-ia">${crudo(botonMic('iaComida', 'calcularComida'))}${scriptEtiqueta() ? html`<button class="mic" ${on('fotoConNota')} aria-label="Foto de la etiqueta o de tu comida con lo que escribiste">${crudo(ICO_CAM)}</button>` : ''}` +
    html`<button class="btn" ${on('calcularComida')}>${c.cargando ? 'Preguntar de nuevo' : 'Calcular'}</button></div>`;
  // Mientras piensa puedes corregir el texto y volver a preguntar: la respuesta vieja se ignora
  if (c.cargando) h += html`<div class="muted" style="margin-top:8px">⏳ Calculando… <span id="iaSeg" class="num">${Math.round((Date.now() - (c.desde || Date.now())) / 1000)} s</span> · ¿te equivocaste? Corrige y toca «Preguntar de nuevo».</div>`;
  if (c.error) h += html`<div class="muted" style="margin-top:8px;color:var(--acc)">${c.error}</div>`;
  if (c.locales) h += html`<div style="margin-top:8px">${c.locales.length ? html`<div class="muted" style="font-size:13.5px;margin-bottom:4px">${c.cargando ? 'Mientras: ¿es alguno de estos? Tócalo y no esperas a la IA' : '¿Es alguno de estos? (catálogo, funciona sin internet)'}</div>${
      c.locales.map(a => html`<button class="bres" ${on('elegirNut', a.id)}><span class="nm">${a.n}<small>por 100 ${a.u}: <b>${Math.round(a.p * 10) / 10} g prot</b> · ${Math.round(a.k)} kcal</small></span></button>`)}` : ''}` +
      html`<button class="link" style="margin:6px 2px" ${on('buscarTextoIA')}>🔎 Buscar en el catálogo</button></div>`;
  if (c.items && c.items.length) {
    const tot = c.items.filter(x => x.on).reduce((a, x) => a + x.g, 0), kcal = c.items.filter(x => x.on).reduce((a, x) => a + (x.k || 0), 0);
    h += html`<div style="margin-top:10px">${c.items.map((x, i) => crudo(html`<div class="iitem${x.on ? '' : ' off'}">` +
      html`<button class="mini${x.on ? ' on' : ''}" ${on('alternarItemIA', i)} aria-label="Incluir">✓</button>` +
      // Toca el nombre para corregir gramos y macros; lo que no cuadra sale marcado
      html`<button class="nm" ${on('editarItemIA', i)}>${x.nombre}${x.fijo && x.fijo.length ? ' 🔒' : ''} ✏️${x.nota ? html`<small>${x.nota}</small>` : ''}` +
        html`<span class="mac"><b>${x.g} g prot</b> · ${x.gramos && x.piezas ? Math.round(x.gramos) + ' g · ' : ''}C ${Math.round(x.c || 0)} · G ${Math.round(x.f || 0)} · ${Math.round(x.k || 0)} kcal</span>` +
        html`${NUT.revisarMacros({ p: x.g, c: x.c, f: x.f, k: x.k }, x.gramos, x.nombre).concat(NUT.esGrande(x) ? [Math.round(x.k).toLocaleString('es-MX') + ' kcal en una sola cosa: ¿fue todo? Tócala para corregir'] : []).map(a => html`<span class="av">⚠️ ${a}</span>`)}</button>` +
      // − / + cambian la PORCIÓN (piezas o gramos) y todo sube parejo; la proteína se ve abajo del nombre
      html`<button class="mini" ${on('porcionItemIA', i, -1)} aria-label="Menos">−</button><span class="g num">${cantidadItemIA(x)}</span>` +
      html`<button class="mini" ${on('porcionItemIA', i, 1)} aria-label="Más">+</button>` +
      html`<button class="mini${x.fav ? ' on' : ''}" ${on('guardarFav', i)} aria-label="Guardar en mis comidas">⭐</button></div>` +
      ingredientesItemIA(x, i)))}</div>`;
    if (c.consejo) h += html`<div class="muted" style="margin:8px 0 0;font-size:13.5px">💡 ${c.consejo}</div>`;
    if (c.items.length > 1) h += html`<button class="link" style="margin:8px 2px 0" ${on('guardarRecetaIA')}>💾 Guardar como receta</button>`;
    h += html`<div class="acts"><button class="btn ghost" ${on('descartarComidaIA')}>Descartar</button>` +
      html`<button class="btn"${tot || kcal ? '' : ' disabled'} ${on('agregarComidaIA')}>Agregar +${tot} g${kcal ? ' · ' + kcal + ' kcal' : ''}</button></div>`;
  }
  return crudo(h + '</div>');
}
async function calcularComida() {
  const c = COMIDA_IA = COMIDA_IA || {};
  c.texto = ($('iaComida') || {}).value || c.texto || '';
  if (!c.texto.trim()) return toast('Escribe qué comiste');
  const id = ++COMIDA_SEQ, texto = c.texto, vigente = () => id === COMIDA_SEQ && COMIDA_IA === c;
  c.error = ''; c.items = null; c.locales = null;
  if (!navigator.onLine) { c.error = 'Sin señal no puedo preguntarle a la IA.'; c.locales = await sugerenciasCatalogo(texto); return repintarComidaIA(); }
  // Texto copiado de una tabla nutrimental: la IA solo lo lee y la app hace las cuentas (vista previa)
  if (scriptEtiqueta() && pareceEtiqueta(texto)) {
    c.cargando = true; c.desde = Date.now(); repintarComidaIA(); relojIA(c);
    try {
      const e = await conLimite(apiPost('etiquetaIA', ['', '', { texto: texto, nota: texto }]), 60000);
      if (!vigente()) return;
      c.cargando = false;
      if (e && e.es_etiqueta) { repintarComidaIA(); return abrirEtiqueta(e, true); }
    } catch (err) { if (!vigente()) return; }
    c.cargando = false;
  }
  c.cargando = true; c.desde = Date.now(); repintarComidaIA(); relojIA(c);
  // Mientras la IA piensa: lo más parecido del catálogo, para que no tengas que esperarla
  sugerenciasCatalogo(texto).then(l => { if (vigente() && c.cargando && l.length) { c.locales = l; repintarComidaIA(); } }).catch(() => {});
  const pr = apiPost('comidaIA', [texto, { meta: metaProt(), llevas: protTotal(), comido: prot.map(tDe) }]);
  let r = null, err = null;
  try { r = await conLimite(pr, LIMITE_IA_COMIDA); } catch (e) { err = e; }
  if (!vigente()) return;   // ya preguntaste otra cosa o la descartaste
  c.cargando = false;
  if (r && r.items && r.items.length) ponerRespuestaIA(c, r);
  else {
    const msg = !err ? 'La IA no reconoció la comida' : err.message === 'tiempo' ? 'La IA tardó demasiado' : err.message;
    c.error = err && err.message === 'tiempo' ? 'La IA está tardando. Elige del catálogo o espera aquí: si contesta, aparece sola.'
      : 'No se pudo calcular: ' + msg + '. Prueba con otras palabras o elige del catálogo.';
    registrarError('IA comida: ' + msg + ' · «' + texto.slice(0, 80) + '»', 'calcularComida');
    // Si contesta tarde (hasta un minuto más) y no has preguntado otra cosa, se muestra
    if (err && err.message === 'tiempo') conLimite(pr, 60000).then(r2 => {
      if (!vigente() || c.items || !r2 || !r2.items || !r2.items.length) return;
      ponerRespuestaIA(c, r2); c.error = ''; repintarComidaIA(); hap('ok'); toast('Ya llegó la respuesta de la IA');
    }).catch(() => {});
    if (!c.locales) c.locales = await sugerenciasCatalogo(texto);
    if (!vigente()) return;
  }
  repintarComidaIA();
}
function ponerRespuestaIA(c, r) {
  c.items = r.items.map(x => Object.assign(x, { on: true })); c.consejo = r.consejo; c.locales = null;
  // Para saber si sigue lenta: se anota cuando tarda más de 15 s (con el modelo que contestó)
  const s = Math.round((Date.now() - (c.desde || Date.now())) / 1000);
  if (s > 15) registrarError('Aviso: la IA de comida tardó ' + s + ' s (' + (r.modelo || '?') + ')', 'calcularComida');
}
// Segundos que lleva pensando (solo cambia ese texto, no repinta la pantalla)
function relojIA(c) {
  const t = setInterval(() => {
    const el = $('iaSeg');
    if (COMIDA_IA !== c || !c.cargando) return clearInterval(t);
    if (el) el.textContent = Math.round((Date.now() - c.desde) / 1000) + ' s';
  }, 1000);
}
let COMIDA_SEQ = 0, LIMITE_IA_COMIDA = 30000;
// Repinta sin quitarte el teclado si sigues escribiendo
function repintarComidaIA() {
  if (TAB !== 'Comida') return;
  const a = document.activeElement, enTexto = a && a.id === 'iaComida', pos = enTexto ? a.selectionStart : null;
  pintarComida();
  const t = enTexto && $('iaComida');
  if (t) { t.focus(); t.setSelectionRange(pos, pos); }
}
// Si la IA no encuentra la comida: lo más parecido del catálogo, por cada cosa que escribiste ("tacos de asada, coca")
async function sugerenciasCatalogo(texto) {
  if (typeof listaBusqueda !== 'function') return [];
  try { await conLimite(cargarCatalogo(), 8000); } catch (e) { /* sin catálogo grande: busca en lo básico y lo tuyo */ }
  const lista = listaBusqueda(), out = [];
  out.seg = {};   // de qué parte del texto salió cada uno ("3 tacos de asada"): para calcular la cantidad al tocarlo
  texto.toLowerCase().split(/[,.;+\n]|\by\b/).map(x => x.trim()).filter(x => x.length > 2).slice(0, 4)
    .forEach(q => {
      // Si con todas las palabras no hay nada (un error de dedo), palabra por palabra
      let r = NUT.buscar(lista, q, 2);
      if (!r.length) r = q.split(/\s+/).filter(w => w.length > 3).sort((a, b) => b.length - a.length).slice(0, 2).map(w => NUT.buscar(lista, w, 1)[0]).filter(Boolean);
      r.forEach(a => { if (!out.some(x => x.id === a.id)) { out.push(a); out.seg[a.id] = q; } });
    });
  const seis = out.slice(0, 6); seis.seg = out.seg;
  return seis;
}
// Corregir lo que dijo la IA: gramos (escala todo), proteína, carbos, grasa y kcal (se recalculan de los macros si no las tocas)
function editarItemIA(i) {
  const x = COMIDA_IA && COMIDA_IA.items[i]; if (!x) return;
  const campo = (k, nom, v) => html`<label class="pc"><span>${nom}</span><input class="num" inputmode="decimal" value="${v === null || v === undefined ? '' : NUT.r1(v)}" ${ev('change', 'cambiarItemIA', i, k, VALOR)}></label>`;
  $('sheet').innerHTML = html`<div class="row between"><div class="t2">${x.nombre}</div><button class="cerrar" ${on('cerrarModal')} aria-label="Cerrar">✕</button></div>` +
    html`<div class="muted" style="margin:2px 0 6px">Cambiar los gramos ajusta todo en proporción. Si cambias proteína, carbos o grasa, las kcal se recalculan.</div>` +
    html`<div class="iedit"><div class="pcs">${campo('gramos', 'Gramos', x.gramos)}${campo('g', 'Proteína', x.g)}${campo('c', 'Carbos', x.c)}${campo('f', 'Grasa', x.f)}${campo('k', 'kcal', x.k)}</div></div>` +
    html`<div id="iaEdAv">${crudo(avisosHtml(NUT.revisarMacros({ p: x.g, c: x.c, f: x.f, k: x.k }, x.gramos, x.nombre)))}</div>` +
    html`<div class="acts"><button class="btn" ${on('cerrarYPintarIA')}>Listo</button></div>`;
  abrirModal();
}
function cambiarItemIA(i, k, v) {
  const x = COMIDA_IA && COMIDA_IA.items[i], n = numeroEscrito(v);
  if (!x || !(n >= 0)) return;
  if (k === 'gramos') {
    // Con gramos de antes, todo sube parejo (también piezas e ingredientes); sin ellos, solo se anotan los gramos
    if (x.gramos > 0 && n > 0) NUT.escalarItem(x, n / x.gramos); else x.gramos = n;
  } else if (k === 'k') x.k = Math.round(n);
  else { x[k] = k === 'g' ? Math.round(n) : NUT.r1(n); x.k = Math.round(4 * (x.g || 0) + 4 * (x.c || 0) + 9 * (x.f || 0)); }
  editarItemIA(i);
}
function cerrarYPintarIA() { cerrarModal(); pintarComida(); }
// La porción que se ve entre − y +: piezas si se cuentan así (3 galletas), si no, gramos
const cantidadItemIA = x => x.piezas ? NUT.r1(x.piezas) + (x.piezas === 1 ? ' pza' : ' pzas') : x.gramos ? Math.round(x.gramos) + ' g' : '×1';
function porcionItemIA(i, d) {
  const x = COMIDA_IA && COMIDA_IA.items[i]; if (!x) return;
  let f;
  if (x.piezas) { const n = Math.max(x.piezas < 1 ? 0.5 : 1, (x.piezas >= 1 ? Math.round(x.piezas) : x.piezas) + d * (x.piezas <= 1 && d < 0 ? 0.5 : 1)); f = n / x.piezas; }
  else if (x.gramos) { const paso = x.gramos >= 200 ? 25 : x.gramos >= 60 ? 10 : 5, n = Math.max(paso, Math.round(x.gramos / paso) * paso + d * paso); f = n / x.gramos; }
  else f = d > 0 ? 1.25 : 0.8;
  NUT.escalarItem(x, f); hap('tecla'); pintarComida();
}
// Un platillo (ensalada, pizza, torta…): sus ingredientes con su porción; cambias uno y cambia el plato
function ingredientesItemIA(x, i) {
  const l = x.ingredientes || [];
  if (!l.length) return '';
  if (!x.verIng) return html`<button class="link ingtog" ${on('verIngIA', i)}>🥗 Ingredientes (${l.length}) · cámbialos ▾</button>`;
  return html`<div class="ings"><button class="link ingtog" ${on('verIngIA', i)}>🥗 Ingredientes (${l.length}) ▴</button>${l.map((g, k) =>
    crudo(html`<div class="ing"><span class="nm">${g.nombre}<small>${NUT.r1(g.g)} g prot · ${Math.round(g.k || 0)} kcal</small></span>` +
    html`<input class="num" inputmode="decimal" value="${NUT.r1(g.gramos)}" ${ev('change', 'cambiarIngIA', i, k, VALOR)} aria-label="Gramos de ${g.nombre}"><span class="u">g</span>` +
    html`<button class="mini" ${on('quitarIngIA', i, k)} aria-label="Quitar">✕</button></div>`))}` +
    html`<div class="ing nuevo"><input id="ingNom${i}" class="campo" placeholder="Otro ingrediente (ej. crutones)"><input id="ingG${i}" class="num" inputmode="decimal" placeholder="g">` +
    html`<button class="mini" ${on('agregarIngIA', i)} aria-label="Agregar ingrediente">＋</button></div></div>`;
}
function verIngIA(i) { const x = COMIDA_IA && COMIDA_IA.items[i]; if (x) { x.verIng = !x.verIng; pintarComida(); } }
function cambiarIngIA(i, k, v) {
  const x = COMIDA_IA && COMIDA_IA.items[i], n = numeroEscrito(v); if (!x || !(n >= 0) || !x.ingredientes[k]) return;
  NUT.cantidadIngrediente(x.ingredientes[k], n); NUT.sumarIngredientes(x); pintarComida();
}
function quitarIngIA(i, k) { const x = COMIDA_IA && COMIDA_IA.items[i]; if (!x) return; x.ingredientes.splice(k, 1); NUT.sumarIngredientes(x); pintarComida(); }
// Agregar un ingrediente que no vio: sus macros salen del catálogo (sin gastar IA)
async function agregarIngIA(i) {
  const x = COMIDA_IA && COMIDA_IA.items[i], nom = (($('ingNom' + i) || {}).value || '').trim(), g = numeroEscrito(($('ingG' + i) || {}).value);
  if (!x || !nom) return toast('Escribe el ingrediente');
  if (!(g > 0)) return toast('Pon los gramos');
  try { await conLimite(cargarCatalogo(), 8000); } catch (e) { /* con lo básico */ }
  const al = NUT.buscar(listaBusqueda(), nom, 1)[0];
  if (!al) return toast('No lo encontré en el catálogo: escríbelo arriba y toca Calcular');
  const m = NUT.macros(al, g);
  x.ingredientes.push({ nombre: al.n.slice(0, 30), gramos: g, g: NUT.r1(m.p), c: m.c, f: m.f, k: m.k, fib: m.fib });
  NUT.sumarIngredientes(x); pintarComida();
}
function ajustarItem(i, d) { const x = COMIDA_IA.items[i]; x.g = Math.max(0, x.g + d); pintarComida(); }
function agregarComidaIA() {
  // También lo que casi no trae proteína (refresco, fruta, pan): suma calorías y carbohidratos
  const items = COMIDA_IA.items.filter(x => x.on && (x.g > 0 || x.k > 0));
  const cuenta = LS.get('gym_food_counts', {});
  const claves = items.map(x => x.k !== undefined && x.k !== null
    ? nuevoRegistro({ n: x.nombre + (x.piezas ? ' · ' + NUT.r1(x.piezas) + (x.piezas === 1 ? ' pza' : ' pzas') : ''), q: x.gramos || null, u: x.gramos ? 'g' : '', src: COMIDA_IA.deFoto ? 'foto' : 'ia', p: x.g, c: x.c, f: x.f, k: x.k, fib: x.fib,
        partes: (x.ingredientes || []).length ? x.ingredientes.map(i => ({ n: i.nombre, q: i.gramos, u: 'g', p: i.g, c: i.c, f: i.f, k: i.k, fib: i.fib })) : null })
    : clavePropia(x.nombre, x.g));
  items.forEach(x => { const k = clavePropia(x.nombre, x.g); cuenta[k] = (cuenta[k] || 0) + 1; });
  agregarAProt(claves, claves.map(() => comidaActual()));
  LS.set('gym_food_counts', cuenta);
  const tot = items.reduce((a, x) => a + x.g, 0);
  const kcal = items.reduce((a, x) => a + (x.k || 0), 0);
  COMIDA_IA = null; hap('ok'); cambiarProt(); toast('+' + tot + ' g' + (kcal ? ' · ' + kcal + ' kcal' : '') + ' ✓');
}
function guardarFav(i) {
  const x = COMIDA_IA.items[i];
  DATA.comidas = (DATA.comidas || []).filter(c => c.t !== x.nombre);
  if (!x.fav) DATA.comidas.unshift(x.k !== undefined && x.k !== null ? { t: x.nombre, g: x.g, c: x.c, f: x.f, k: x.k, fib: x.fib } : { t: x.nombre, g: x.g });
  x.fav = !x.fav;
  encolar('saveConfig', [{ comidas: DATA.comidas.slice(0, 30) }], 'cfg-comidas');
  toast(x.fav ? 'Guardada en Mis comidas ⭐' : 'Quitada de Mis comidas'); pintarComida();
}
function quitarReceta(id) {
  if (!/^r-/.test(id)) return;
  const c = nutCfg(); c.recetas = c.recetas.filter(r => r.id !== id); guardarNut(c); hap('ok'); pintarComida();
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
const ICO_CAM = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/></svg>';
const ICO_MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/></svg>';
let VOZ = null;   // { id, rec } mientras escucha
function botonMic(idTexto, alTerminar) {
  if (!NATIVO && !SR) return '';
  return html`<button class="mic${VOZ && VOZ.id === idTexto ? ' oye' : ''}" id="mic-${idTexto}" ${on('dictar', String(idTexto), String(alTerminar))} aria-label="Dictar por voz">${crudo(ICO_MIC)}</button>`;
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
