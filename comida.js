/* ===================== COMIDA CON MACROS (1 de 3: lo de cada día, recetas, tupper y metas) =====================
   La proteína sigue mandando (el anillo, la meta, el aviso de las 6 pm y el widget no cambian). Aquí vive lo nuevo:
   - Cada cosa que comes se guarda como un registro con su cantidad y sus macros (proteína, carbohidratos, grasa, kcal, fibra),
     tal como eran ese día: si después cambias una receta o un producto, tu historial no se mueve.
   - Recetas (tu licuado y las dos cenas), el tupper de mamá en 3 toques y tus metas.
   - El buscador (catálogo de México + USDA y Open Food Facts) y la cantidad: comida-buscar.js.
   - La cámara (etiqueta nutricional, foto del tupper y código de barras) y el producto nuevo: comida-foto.js.
   Se cargan en ese orden (index.html). Los cálculos están en nutricion.js (con pruebas); aquí solo la pantalla y el guardado. */

/* ----- Registros del día: la lista del día (prot) guarda claves; '#id' es un registro con todos sus macros ----- */
let REG_M = null;
function regMapa() { return REG_M || (REG_M = LS.get('gym_reg', {})); }
function regGuardar() {
  // Se limpian los registros de hace más de 120 días (lo de hace tanto ya está en tu hoja; las listas del día se borran antes, a los 21 días si falta espacio)
  const m = regMapa(), viejo = Date.now() - 120 * 864e5;
  Object.keys(m).forEach(id => { if (m[id].ts < viejo) delete m[id]; });
  LS.set('gym_reg', m);
}
function nuevoRegistro(o) {
  const id = uid(), m = regMapa();
  m[id] = { ts: Date.now(), n: String(o.n || 'Comida').slice(0, 60), q: o.q || null, u: o.u || '', src: o.src || '', ref: o.ref || '',
            p: NUT.r1(o.p), c: o.c === null || o.c === undefined ? null : NUT.r1(o.c), f: o.f === null || o.f === undefined ? null : NUT.r1(o.f),
            k: o.k === null || o.k === undefined ? null : Math.round(o.k), fib: o.fib === null || o.fib === undefined ? null : NUT.r1(o.fib) };
  if (o.partes && o.partes.length) m[id].partes = o.partes;
  regGuardar();
  return '#' + id;
}
// Los ingredientes de una receta o un tupper (para la hoja: un renglón por ingrediente)
function partesDe(t) {
  const n = v => v === null || v === undefined ? null : NUT.r1(v);
  return (t.items || []).filter(x => x.al && x.m && x.q > 0).map(x => ({ n: String(x.al.n).slice(0, 60), q: NUT.r1(x.q), u: x.al.u || 'g',
    p: NUT.r1(x.m.p), c: n(x.m.c), f: n(x.m.f), k: x.m.k === null || x.m.k === undefined ? null : Math.round(x.m.k), fib: n(x.m.fib) }));
}
/* ----- v9.4: corregir lo que ya anotaste, lo de siempre a esta hora, repetir una comida de otro día y recetas desde la IA ----- */
// Tocar algo de "Hoy comiste": ver sus números, corregirlos (gramos, ×porción o cada macro) o quitarlo
let ITEM_ED = null;
function abrirItemDia(i) {
  asegurarProt();
  const k = prot[i]; if (k === undefined) return;
  const r = regDe(k), m = macrosDe(k);
  ITEM_ED = { i: i, k: k, n: tDe(k), q: r ? r.q : null, u: r ? r.u || 'g' : 'g', p: m.p || 0, c: m.c, f: m.f, k2: m.k, fib: m.fib, partes: r && r.partes ? JSON.parse(JSON.stringify(r.partes)) : null,
    src: r ? r.src : esRec(k) ? 'receta' : '' };
  pintarItemDia(); abrirModal();
}
// ¿Qué no cuadra de algo que ya anotaste? Si trae ingredientes (receta, tupper, platillo de la IA) se revisa cada uno con sus
// gramos: el total no trae gramos, y "más de 60 g de proteína" sin peso parecía polvo aunque fuera un licuado de 700 g.
// Tus recetas y el tupper son cantidades tuyas: no se marcan por grandes (un licuado de 900 kcal puede estar bien).
function avisosItem(m, q, src, partes, nombre) {
  const av = partes && partes.length ? [].concat.apply([], partes.map(x => NUT.revisarMacros(x, x.q, x.n).map(a => x.n + ': ' + a))) : NUT.revisarMacros(m, q, nombre);
  if (NUT.esGrande(m) && src !== 'receta' && src !== 'tupper') av.push(Math.round(m.k).toLocaleString('es-MX') + ' kcal en una sola cosa: si fue menos (2 rebanadas y no la pizza entera), corrígelo');
  return av;
}
function pintarItemDia() {
  const E = ITEM_ED, av = avisosItem({ p: E.p, c: E.c, f: E.f, k: E.k2 }, E.q, E.src, E.partes, E.n);
  const campo = (k, nom, v) => html`<label class="pc"><span>${nom}</span><input class="num" inputmode="decimal" value="${v === null || v === undefined ? '' : NUT.r1(v)}" ${ev('change', 'itemDiaCampo', k, VALOR)}></label>`;
  $('sheet').innerHTML = html`<div class="row between"><div class="t2" style="padding-right:8px">${E.n}</div><button class="cerrar" ${on('cerrarModal')} aria-label="Cerrar">✕</button></div>` +
    avisosHtml(av) +
    html`<div class="tpaso">¿Fue otra cantidad?</div><div class="tchips">${[['½', 0.5], ['×1½', 1.5], ['×2', 2]].map(x => html`<button class="tch" ${on('itemDiaVeces', x[1])}>${x[0]}</button>`)}</div>` +
    html`<div class="pcs">${E.q ? campo('q', 'Cantidad (' + E.u + ')', E.q) : ''}${campo('p', 'Proteína', E.p)}${campo('c', 'Carbos', E.c)}${campo('f', 'Grasa', E.f)}${campo('k2', 'kcal', E.k2)}</div>` +
    html`<div class="muted" style="font-size:12.5px;margin-top:6px">Cambiar la cantidad ajusta todo en proporción; si cambias un macro, las kcal se recalculan.</div>` +
    html`<div class="acts"><button class="btn ghost" ${on('itemDiaQuitar')}>Quitar</button><button class="btn" ${on('itemDiaGuardar')}>Guardar</button></div>`;
}
function escalarItem(f) {
  const E = ITEM_ED;
  ['p', 'c', 'f', 'fib'].forEach(m => { if (E[m] !== null && E[m] !== undefined) E[m] = NUT.r1(E[m] * f); });
  if (E.k2 !== null && E.k2 !== undefined) E.k2 = Math.round(E.k2 * f);
  if (E.q) E.q = NUT.r1(E.q * f);
  if (E.partes) E.partes.forEach(x => { ['q', 'p', 'c', 'f', 'fib'].forEach(m => { if (x[m] !== null && x[m] !== undefined) x[m] = NUT.r1(x[m] * f); }); if (x.k) x.k = Math.round(x.k * f); });
}
function itemDiaVeces(f) { escalarItem(f); hap('tecla'); pintarItemDia(); }
function itemDiaCampo(k, v) {
  const E = ITEM_ED, n = numeroEscrito(v);
  if (!(n >= 0)) return;
  if (k === 'q') { if (E.q > 0) escalarItem(n / E.q); E.q = n; }
  else if (k === 'k2') E.k2 = Math.round(n);
  else { E[k] = NUT.r1(n); E.k2 = Math.round(4 * (E.p || 0) + 4 * (E.c || 0) + 9 * (E.f || 0)); E.partes = null; }
  pintarItemDia();
}
function itemDiaGuardar() {
  const E = ITEM_ED; asegurarProt();
  if (prot[E.i] !== E.k) { cerrarModal(); return toast('La lista cambió: vuelve a abrirlo'); }
  // Lo que no era registro (botón de siempre, receta) se vuelve registro con los números corregidos
  const nombre = E.q && !/·/.test(E.n) ? E.n : E.n.replace(/ · [\d.,]+ (g|ml)$/, '') + (E.q ? ' · ' + NUT.r1(E.q) + ' ' + E.u : '');
  const r = regDe(E.k), base = r ? { src: r.src, ref: r.ref } : { src: 'editado', ref: E.k };
  const nuevo = nuevoRegistro(Object.assign(base, { n: nombre, q: E.q, u: E.q ? E.u : '', p: E.p, c: E.c, f: E.f, k: E.k2, fib: E.fib, partes: E.partes }));
  if (r) { const m = regMapa(); m[E.k.slice(1)] = Object.assign(m[nuevo.slice(1)], { ts: r.ts }); delete m[nuevo.slice(1)]; regGuardar(); }
  else prot[E.i] = nuevo;
  ITEM_ED = null; cerrarModal(); hap('ok'); cambiarProt(); toast('Corregido ✓');
}
function itemDiaQuitar() { const i = ITEM_ED.i; ITEM_ED = null; cerrarModal(); quitarProt(i); }

// Lo que sueles comer a esta hora (de tus últimas 3 semanas) y que hoy no has anotado en esta comida
function claveHabito(k) { const r = regDe(k); return r ? (r.src === 'receta' || r.src === 'tupper' ? r.src + ':' + r.ref : 'n:' + String(r.n).replace(/ · [\d.,]+ (g|ml)$/, '').toLowerCase()) : 'k:' + k; }
function sugerenciasHora() {
  const m = comidaActual(), cuenta = {}, ejemplo = {};
  for (let d = 1; d <= 21; d++) {
    const dia = sumarDias(hoy(), -d), l = LS.get('gym_prot_' + dia, null);
    if (!l || !l.length) continue;
    const t = etiquetas(dia, l.length), vistas = {};
    l.forEach((k, i) => { if (t[i] !== m) return; const c = claveHabito(k); if (vistas[c]) return; vistas[c] = 1; cuenta[c] = (cuenta[c] || 0) + 1; if (!ejemplo[c]) ejemplo[c] = { dia: dia, i: i, k: k }; });
  }
  const tHoy = etiquetas(diaComida(), prot.length), ya = {};
  prot.forEach((k, i) => { if (tHoy[i] === m) ya[claveHabito(k)] = 1; });
  return Object.keys(cuenta).filter(c => cuenta[c] >= 2 && !ya[c]).sort((a, b) => cuenta[b] - cuenta[a]).slice(0, 3).map(c => ejemplo[c]);
}
function filaHabitos() {
  if (COMIDA_DIA) return '';
  const s = sugerenciasHora();
  if (!s.length) return '';
  return html`<div class="habitos"><span class="muted">Sueles comer en ${nombreDeComida(comidaActual()).toLowerCase()}:</span>${s.map(x => {
    const m = macrosDe(x.k);
    return html`<button class="tch" ${on('agregarHabito', x.dia, x.i)}>＋ ${tDe(x.k).replace(/ · [\d.,]+ (g|ml)$/, '')} <small>${Math.round(m.p || 0)} g</small></button>`;
  })}</div>`;
}
// Copiar algo de otro día: una receta se calcula con tu receta de hoy; lo demás, tal como fue
function copiaDe(k) {
  const r = regDe(k);
  if (r && r.src === 'receta' && recetaDe(r.ref)) return expandirClave('@' + r.ref);
  return r ? nuevoRegistro(r) : k;
}
function agregarHabito(dia, i) {
  const l = LS.get('gym_prot_' + dia, []) || [], k = l[i];
  if (k === undefined) return;
  agregarAProt([copiaDe(k)], [comidaActual()]); hap('ok'); cambiarProt(); toast('Agregado ✓');
}
// Repetir una comida de otro día (no solo ayer completo)
function abrirRepetir() {
  let h = html`<div class="row between"><div class="t2">Repetir una comida</div><button class="cerrar" ${on('cerrarModal')} aria-label="Cerrar">✕</button></div>` +
    html`<div class="muted" style="margin:2px 0 8px">Se agrega a ${nombreDeComida(comidaActual()).toLowerCase()} de hoy.</div>`;
  let hay = 0;
  for (let d = 1; d <= 7; d++) {
    const dia = sumarDias(hoy(), -d), l = LS.get('gym_prot_' + dia, null);
    if (!l || !l.length) continue;
    const t = etiquetas(dia, l.length);
    const grupos = COMIDAS.map(c => [c, l.map((k, i) => i).filter(i => t[i] === c[0])]).filter(g => g[1].length);
    if (!grupos.length) continue;
    h += html`<div class="tpaso">${diaCorto(dia)}</div>${grupos.map(([c, idx]) => {
      const tot = idx.reduce((a, i) => { const m = macrosDe(l[i]); return { p: a.p + (m.p || 0), k: a.k + (m.k || 0) }; }, { p: 0, k: 0 });
      hay++;
      return html`<button class="repcom" ${on('repetirComida', dia, c[0])}><b>${c[2]} ${c[1]}</b> <small>${Math.round(tot.p)} g · ${Math.round(tot.k)} kcal</small>` +
        html`<span>${idx.map(i => tDe(l[i]).replace(/ · [\d.,]+ (g|ml)$/, '')).join(', ')}</span></button>`;
    }).map(crudo)}`;
  }
  if (!hay) h += html`<div class="muted">Aún no hay comidas de los últimos 7 días en este celular.</div>`;
  $('sheet').innerHTML = h; abrirModal();
}
function repetirComida(dia, m) {
  const l = LS.get('gym_prot_' + dia, []) || [], t = etiquetas(dia, l.length);
  const claves = l.filter((k, i) => t[i] === m).map(copiaDe);
  if (!claves.length) return;
  cerrarModal(); agregarAProt(claves, claves.map(() => comidaActual())); hap('ok'); cambiarProt(); toast('Repetido: ' + claves.length + ' cosa' + (claves.length > 1 ? 's' : '') + ' ✓');
}
// Guardar lo que contestó la IA como receta (molletes, tu tupper de los martes…): cada cosa queda como producto tuyo
function guardarRecetaIA() {
  const c = COMIDA_IA; if (!c || !c.items) return;
  const items = c.items.filter(x => x.on && x.gramos > 0);
  if (!items.length) return toast('Necesito los gramos de cada cosa: tócala y ponlos');
  $('sheet').innerHTML = html`<div class="row between"><div class="t2">Guardar como receta</div><button class="cerrar" ${on('cerrarModal')} aria-label="Cerrar">✕</button></div>` +
    html`<input id="recNom" class="campo" placeholder="Nombre (ej. Molletes con frijoles con soya)" value="${String(c.texto || '').slice(0, 40)}">` +
    html`<div class="muted" style="margin:4px 0 8px">${items.map(x => x.nombre + ' ' + Math.round(x.gramos) + ' g').join(' · ')}</div>` +
    html`<div class="acts"><button class="btn" ${on('confirmarRecetaIA')}>Guardar</button></div>`;
  abrirModal();
}
function confirmarRecetaIA() {
  const c = COMIDA_IA, cfg = nutCfg(), nombre = (($('recNom') || {}).value || '').trim().slice(0, 50);
  if (!nombre) return toast('Ponle nombre');
  if (cfg.recetas.length >= NUT.MAX_RECETAS) return toast('Ya tienes ' + NUT.MAX_RECETAS + ' recetas: borra una para guardar otra');
  const items = c.items.filter(x => x.on && x.gramos > 0).map(x => {
    const f = 100 / x.gramos, id = 'p:' + uid();
    cfg.productos.push({ id: id, n: String(x.nombre).slice(0, 60), marca: '', u: 'g', p: NUT.r1(x.g * f), c: NUT.r1((x.c || 0) * f), f: NUT.r1((x.f || 0) * f), k: Math.round((x.k || 0) * f), fib: NUT.r1((x.fib || 0) * f), por: [], src: 'ia', code: '', ts: Date.now() });
    return { ref: id, q: NUT.r1(x.gramos) };
  });
  cfg.recetas.push({ id: 'r-' + uid(), n: nombre, ico: '🍽️', m: comidaActual(), items: items });
  cfg.productos = NUT.recortarProductos(cfg);
  guardarNut(cfg); cerrarModal(); hap('ok'); toast('Receta guardada: la encuentras en Mis comidas ✓'); pintarComida();
}

// Recetas registradas antes de la v9.0 (sin ingredientes guardados): si la receta no ha cambiado, se sacan de ahí
function partesSiNoCambio(r) {
  const rec = r.src === 'receta' && recetaDe(r.ref);
  if (!rec) return null;
  const t = NUT.receta(rec, resolver);
  return Math.abs(t.tot.k - (r.k || 0)) <= 2 && Math.abs(t.tot.p - (r.p || 0)) <= 0.5 ? partesDe(t) : null;
}
const esReg = k => typeof k === 'string' && k[0] === '#';
const esRec = k => typeof k === 'string' && k[0] === '@';
function regDe(k) { return esReg(k) ? regMapa()[k.slice(1)] || null : null; }
// Proteína y nombre de cualquier clave (registro, receta, botón de siempre o "Algo (27 g)")
function gDeNut(k) {
  if (esReg(k)) { const r = regDe(k); return r ? r.p || 0 : 0; }
  if (esRec(k)) { const r = totReceta(k.slice(1)); return r ? Math.round(r.p) : 0; }
  return null;
}
function tDeNut(k) {
  if (esReg(k)) { const r = regDe(k); return r ? r.n : 'Comida'; }
  if (esRec(k)) { const r = recetaDe(k.slice(1)); return r ? r.n : k; }
  return null;
}
// Macros de una clave: los registros traen todo; los botones de siempre, lo estimado; lo viejo "(27 g)" solo proteína
function macrosDe(k) {
  const r = regDe(k);
  if (r) return { p: r.p || 0, c: r.c, f: r.f, k: r.k, fib: r.fib };
  if (esRec(k)) return totReceta(k.slice(1));
  if (NUT.LEGADO[k]) return NUT.LEGADO[k];
  const fav = (DATA.comidas || []).find(c => clavePropia(c.t, c.g) === k);
  if (fav && fav.k !== undefined) return { p: fav.g, c: fav.c, f: fav.f, k: fav.k, fib: fav.fib };
  return { p: gDe(k), c: null, f: null, k: null, fib: null };
}
function totalMacros(lista) {
  const t = { p: 0, c: 0, f: 0, k: 0, fib: 0, sinDatos: 0 };
  (lista || prot).forEach(k => {
    const m = macrosDe(k);
    t.p += m.p || 0;
    if (m.k === null || m.k === undefined) { t.sinDatos++; return; }
    t.c += m.c || 0; t.f += m.f || 0; t.k += m.k || 0; t.fib += m.fib || 0;
  });
  ['p', 'c', 'f', 'fib'].forEach(x => { t[x] = Math.round(t[x]); }); t.k = Math.round(t.k);
  return t;
}
// Una plantilla (receta, botón de siempre, comida guardada) se vuelve registro al agregarla: queda con sus macros de hoy
function expandirClave(k) {
  if (esReg(k)) return k;
  if (esRec(k)) {
    const rec = recetaDe(k.slice(1));
    if (!rec) return k;
    const t = NUT.receta(rec, resolver);
    return nuevoRegistro(Object.assign({ n: rec.n, src: 'receta', ref: rec.id, partes: partesDe(t) }, t.tot));
  }
  const f = FOODS.find(x => x.k === k);
  if (f) return nuevoRegistro(Object.assign({ n: f.t, src: 'boton', ref: k }, NUT.LEGADO[k] || { p: f.g }));
  const fav = (DATA.comidas || []).find(c => clavePropia(c.t, c.g) === k);
  if (fav) return nuevoRegistro({ n: fav.t, src: 'fav', ref: k, p: fav.g, c: fav.c, f: fav.f, k: fav.k, fib: fav.fib });
  return k;
}
// Lo que va a la hoja: la proteína y el detalle de siempre (Peso diario) y, con el script 7.7, cada cosa con sus macros (pestaña Comidas)
function detalleTexto(lista) { return lista.map(k => esReg(k) ? clavePropia(tDe(k), gDe(k)) : k).join(', '); }
const scriptPartes = () => !!(DATA && DATA.scriptVersion && versionNum(DATA.scriptVersion) >= versionNum('8.0'));
const scriptNut = () => !!(DATA && DATA.scriptVersion && versionNum(DATA.scriptVersion) >= versionNum('7.7'));
function sincronizarDia(dia, lista) {
  encolar('saveProteina', [protTotal(lista), detalleTexto(lista), dia], 'prot-' + dia);
  if (!scriptNut()) return;
  const t = etiquetas(dia, lista.length), porParte = scriptPartes(), items = [];
  lista.forEach((k, i) => {
    const r = regDe(k), m = macrosDe(k);
    const base = { id: esReg(k) ? k.slice(1) : '', h: r ? horaHHMM(r.ts) : '', m: t[i] || '', src: r ? r.src : 'boton', ref: r ? r.ref : k };
    // Script 8.0: una receta o un tupper va ingrediente por ingrediente, con "Parte de" = su nombre (la hoja los vuelve a juntar)
    const partes = r && (r.partes || partesSiNoCambio(r));
    if (porParte && partes && partes.length && base.id)
      partes.forEach((x, j) => items.push(Object.assign({}, base, { id: base.id + '.' + j, n: x.n, q: x.q, u: x.u, p: x.p || 0, c: x.c, f: x.f, k: x.k, fib: x.fib, de: r.n })));
    else items.push(Object.assign(base, { n: tDe(k), q: r ? r.q : null, u: r ? r.u : '', p: m.p || 0, c: m.c, f: m.f, k: m.k, fib: m.fib }));
  });
  encolar('saveComidas', [dia, items], 'cmd-' + dia);
}
// La primera vez que la app ve el script 7.7: sube lo de hoy y ayer (así aparece la pestaña Comidas sin esperar a que anotes algo)
// y respalda tus recetas
function primerSyncNut() {
  if (!scriptNut() || LS.get('gym_nut_sync77', false)) return;
  LS.set('gym_nut_sync77', true);
  [sumarDias(hoy(), -1), hoy()].forEach(dia => { const l = LS.get('gym_prot_' + dia, null); if (l && l.length) sincronizarDia(dia, l); });
  guardarNut(nutCfg());
}
const horaHHMM = ts => { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
// Lo que llegó de la hoja (otro celular): se arma la lista con registros
function listaDesdeHoja(dia) {
  const d = (DATA.comidasDias || {})[dia];
  if (!d || !d.length) return null;
  const m = regMapa(), lista = [], t = [];
  d.forEach(x => {
    const id = x.id || uid();
    if (!m[id]) m[id] = { ts: Date.now(), n: x.n, q: x.q, u: x.u, src: x.src, ref: x.ref, p: x.p, c: x.c, f: x.f, k: x.k, fib: x.fib };
    if (Array.isArray(x.partes) && x.partes.length && !m[id].partes) m[id].partes = x.partes;
    lista.push('#' + id); t.push(x.m || null);
  });
  regGuardar(); LS.set('gym_protmeal_' + dia, t);
  return lista;
}

/* ----- Tu configuración de comida: recetas, productos escaneados, tuppers que aprendió y metas a mano.
   Vive en el celular y se respalda en tu configuración de la hoja (script 7.7) ----- */
// Siempre con la forma correcta (aunque lo guardado venga incompleto de otra versión o de la hoja) y leída una sola vez
let NUT_C = null, NUT_C_DE = undefined;
function normalNut(c) {
  c = c && typeof c === 'object' ? c : {};
  const r = { ts: Number(c.ts) || 0, metas: c.metas && c.metas.k ? c.metas : null,
    productos: Array.isArray(c.productos) ? c.productos.filter(p => p && p.id) : [],
    tuppers: c.tuppers && typeof c.tuppers === 'object' && !Array.isArray(c.tuppers) ? c.tuppers : {},
    recetas: (Array.isArray(c.recetas) ? c.recetas : []).filter(x => x && x.id).map(x => Object.assign({}, x, { items: Array.isArray(x.items) ? x.items.filter(i => i && i.ref) : [] })) };
  // Las de fábrica que falten (o que llegaron vacías) se reponen
  NUT.RECETAS.forEach(f => {
    const i = r.recetas.findIndex(x => x.id === f.id);
    if (i < 0) r.recetas.push(JSON.parse(JSON.stringify(f)));
    else if (!r.recetas[i].items.length) r.recetas[i] = Object.assign(JSON.parse(JSON.stringify(f)), { n: r.recetas[i].n || f.n });
  });
  return r;
}
function nutCfg() {
  const deHoja = DATA ? DATA.nutricion : null;
  if (NUT_C && NUT_C_DE === deHoja) return NUT_C;
  let c = normalNut(LS.get('gym_nut', null));
  // Lo de la hoja gana si es más nuevo (lo cambiaste en otro celular)
  if (deHoja && Number(deHoja.ts) > c.ts) { c = normalNut(deHoja); LS.set('gym_nut', c); }
  NUT_C = c; NUT_C_DE = deHoja;
  return c;
}
function guardarNut(c) {
  c.ts = Date.now();
  LS.set('gym_nut', c); NUT_C = c;
  if (scriptNut()) encolar('saveConfig', [{ nutricion: c }], 'cfg-nut');
}
const recetaDe = id => nutCfg().recetas.find(r => r.id === id) || null;
function totReceta(id) { const r = recetaDe(id); return r ? NUT.receta(r, resolver).tot : null; }
// De dónde sale cada alimento: base, tus productos o el catálogo grande (lo que ya usaste se guarda para tenerlo sin señal)
function resolver(ref) {
  if (!ref) return null;
  if (NUT.BASE_POR_ID[ref]) return NUT.BASE_POR_ID[ref];
  if (ref.indexOf('p:') === 0) return nutCfg().productos.find(p => p.id === ref) || null;
  const usados = LS.get('gym_alim_usados', {});
  if (usados[ref]) return usados[ref];
  return CATALOGO ? CATALOGO.find(a => a.id === ref) || null : null;
}
function recordarAlimento(al) {
  if (!al || /^(b|p):/.test(al.id)) return;
  const u = LS.get('gym_alim_usados', {});
  u[al.id] = { id: al.id, n: al.n, en: al.en || '', u: al.u || 'g', p: al.p, c: al.c, f: al.f, k: al.k, fib: al.fib, por: al.por || [], src: al.src, crudo: !!al.crudo, marca: al.marca || '' };
  const ks = Object.keys(u); if (ks.length > 300) delete u[ks[0]];
  LS.set('gym_alim_usados', u);
}

// Lo nuevo de Comida nunca debe dejar la pantalla en blanco: si algo falla, se omite esa parte y queda anotado
function seguroNut(fn, donde) {
  try { return fn(); } catch (e) { try { registrarError('Comida (' + donde + '): ' + e.message, donde, e.stack); } catch (x) {} return ''; }
}

/* ----- Metas del día ----- */
function metasHoy() {
  const m = nutCfg().metas;
  const kmSem = DATA.trotes && DATA.trotes.semanas && DATA.trotes.semanas.length ? DATA.trotes.semanas[DATA.trotes.semanas.length - 1].km : (DATA.trotes && DATA.trotes.km7) || 0;
  const rp = typeof ritmoPeso === 'function' ? ritmoPeso() : null;
  const cs = ((DATA.cuerpo && DATA.cuerpo.serie) || []).filter(x => x.cint !== null && x.cint !== undefined);
  const auto = NUT.metas({ peso: DATA.ultimoPeso, metaProt: metaProt(), diasGym: (DATA.dias || [1, 2, 3, 4]).length, kmSemana: kmSem,
                           ritmoPct: rp ? rp.pct : null, bajaCintura: cs.length >= 2 && cs[cs.length - 1].cint < cs[cs.length - 2].cint });
  if (!m) return Object.assign(auto, { auto: true });
  return Object.assign({}, auto, { k: Number(m.k) || auto.k, c: Number(m.c) || auto.c, f: Number(m.f) || auto.f, fib: Number(m.fib) || auto.fib, p: metaProt(), auto: false });
}

/* ----- Pantalla: la línea de macros bajo el anillo de proteína ----- */
function tarjetaMacros() {
  const t = totalMacros(), mt = metasHoy();
  const barra = (nom, v, meta, u, cls) => {
    const pct = Math.min(100, Math.round(v / Math.max(1, meta) * 100));
    return html`<div class="mm ${cls}${v > meta * 1.05 ? ' pasa' : ''}"><span class="et">${nom}</span><b class="num">${v.toLocaleString('es-MX')}` +
      html`<small>/${meta.toLocaleString('es-MX')}${u ? ' ' + u : ''}</small></b><i style="--p:${pct}%"></i></div>`;
  };
  return html`<button class="macros" ${on('abrirMetas')} aria-label="Ver metas de calorías y macros">` +
    barra('Calorías', t.k, mt.k, '', 'kc') + barra('Carbohidratos', t.c, mt.c, 'g', 'ca') + barra('Grasa', t.f, mt.f, 'g', 'gr') + '</button>' +
    (t.sinDatos ? html`<div class="muted sindatos">${t.sinDatos} cosa${t.sinDatos > 1 ? 's' : ''} de hoy solo tiene${t.sinDatos > 1 ? 'n' : ''} proteína (de antes)</div>` : '');
}

/* ----- Tus de siempre: el licuado, el tupper de mamá y la cena ----- */
function filaSiempre() {
  const lic = totReceta('licuado'), h = totReceta('cena-harina'), m = totReceta('cena-maiz');
  const usosTup = Object.values(nutCfg().tuppers || {}).sort((a, b) => b.n - a.n)[0];
  const b = (ico, nom, sub, accion, extra) => html`<button class="siempre" ${accion}><span class="ic">${ico}</span><span class="tx"><b>${nom}</b><small>${sub}</small></span>${extra || ''}</button>`;
  return html`<div class="siempre3">` +
    b('🥤', 'Mi licuado', lic ? html`<b class="num">${Math.round(lic.p)} g</b> · ${lic.k} kcal` : '', on('abrirReceta', 'licuado')) +
    b('🍱', 'Tupper', usosTup ? html`<b class="num">${usosTup.p} g</b> · ${usosTup.nombre.replace(/^Tupper: /, '').split(/[ ,]/)[0]}` : 'En 3 toques', on('abrirTupper')) +
    b('🌮', 'Cena', h && m ? 'Harina o maíz: ' + Math.round(h.p) + ' / ' + Math.round(m.p) + ' g' : '', on('abrirCenas')) +
    html`</div><div class="herr">` +
    html`<button ${on('abrirBuscador')}><span>🔍</span>Buscar alimento</button>` +
    html`<button ${on('abrirCamaraSola')}><span>📷</span>Foto o código</button></div>`;
}

/* ----- Editor de receta (cantidades editables; tu licuado viene con cantidades estándar hasta que las midas) ----- */
let REC_ED = null;
function abrirReceta(id, deCena) {
  const c = nutCfg(), rec = c.recetas.find(r => r.id === id);
  if (!rec) return;
  if (!REC_ED || REC_ED.id !== id) REC_ED = { id: id, items: JSON.parse(JSON.stringify(rec.items)), n: rec.n, deCena: !!deCena, cambio: false };
  pintarReceta();
  if (!$('modal').classList.contains('show')) abrirModal();
}
function pintarReceta() {
  const e = REC_ED, t = NUT.receta({ items: e.items }, resolver);
  const rolTxt = { leche: 'tu leche', proteina: 'tu proteína' };
  $('sheet').innerHTML = html`<div class="row between"><div class="t2">${e.n}</div><button class="cerrar" ${on('cerrarReceta')} aria-label="Cerrar">✕</button></div>` +
    html`<div class="muted" style="margin:2px 0 10px">Toca una cantidad para cambiarla. ${e.id === 'licuado' ? 'Vienen cantidades estándar: cuando midas las tuyas, ponlas aquí.' : ''} Lo «genérico» es de tablas; con ⇄ eliges tu producto (o le tomas foto a la etiqueta).</div>` +
    html`<div class="rec">${t.items.map((it, i) => {
      const al = it.al, m = it.m || {}, u = al ? al.u : 'g';
      // De dónde salen sus macros: "Básico"/"USDA" es genérico; "Tuyo"/"Tu etiqueta"/"Open Food Facts" es tu producto (⇄ lo cambia)
      const generico = al && !/^p:/.test(String(al.id || it.ref)) && al.k > 0;
      return crudo(html`<div class="ri"><div class="nm"><b>${al ? al.n : 'Alimento que ya no está'}${al && al.marca ? ' · ' + al.marca : ''}${it.rol ? html` <span class="rol">${rolTxt[it.rol]}</span>` : ''}</b>` +
        (al ? html`<small>${fuenteTxt(al)} · por 100 ${u}: ${NUT.r1(al.p)} g prot · ${Math.round(al.k || 0)} kcal${generico ? ' · genérico' : ''}</small>` : '') + html`</div>` +
        html`<div class="mac2">${al ? html`<b>${NUT.r1(m.p)} g</b> prot · ${Math.round(m.k || 0)} kcal` : ''}</div><div class="ctl">` +
        html`<button class="mini" ${on('recCant', i, -1)} aria-label="Menos">−</button>` +
        html`<input class="cant num" inputmode="decimal" value="${it.q}" ${ev('change', 'recSet', i, VALOR)} aria-label="Cantidad"><span class="u">${u}</span>` +
        html`<button class="mini" ${on('recCant', i, 1)} aria-label="Más">+</button>` +
        html`<button class="mini" ${on('recCambiar', i)} aria-label="Cambiar ingrediente">⇄</button>` +
        html`<button class="mini" ${on('recQuitar', i)} aria-label="Quitar">✕</button></div></div>`);
    })}</div>` +
    html`<button class="link" ${on('recAgregar')}>＋ Agregar ingrediente</button>` +
    html`<div class="rectot"><b class="num">${Math.round(t.tot.p)} g</b> proteína<span>${fmtM(t.tot, true)}</span></div>` +
    html`<div class="acts">${e.cambio ? html`<button class="btn ghost" ${on('guardarReceta')}>Guardar cambios</button>` : ''}` +
    html`<button class="btn" ${on('agregarRecetaHoy')}>Agregar a ${nombreDeComida(comidaActual()).toLowerCase()}</button></div>`;
}
// "12 g carbs · 5 g grasa · 230 kcal" (con proteína si se pide)
function fmtM(m, sinP) {
  if (!m || m.k === null || m.k === undefined) return m && m.p ? Math.round(m.p) + ' g proteína' : '';
  return html`${sinP ? '' : html`<b>${NUT.r1(m.p)} g</b> prot · `}${Math.round(m.c)} g carbs · ${Math.round(m.f)} g grasa · ${Math.round(m.k)} kcal`;
}
function pasoCant(it) { const al = resolver(it.ref); const p = al && al.por && al.por[0] ? al.por[0][1] : 10; return p >= 100 ? 25 : p >= 30 ? 10 : 5; }
function recCant(i, d) { const it = REC_ED.items[i]; it.q = Math.max(0, Math.round((Number(it.q) + d * pasoCant(it)) * 10) / 10); REC_ED.cambio = true; hap('tecla'); pintarReceta(); }
function recSet(i, v) { const n = Number(String(v).replace(',', '.')); if (n >= 0) { REC_ED.items[i].q = n; REC_ED.cambio = true; } pintarReceta(); }
function recQuitar(i) { REC_ED.items.splice(i, 1); REC_ED.cambio = true; pintarReceta(); }
// Cambiar o agregar ingrediente: el buscador regresa a la receta (al cambiar, la cantidad se queda)
function recCambiar(i) { abrirBuscador({ volver: () => abrirReceta(REC_ED.id), elegir: al => { REC_ED.items[i].ref = al.id; recordarAlimento(al); REC_ED.cambio = true; abrirReceta(REC_ED.id); } }); }
function recAgregar() { abrirBuscador({ volver: () => abrirReceta(REC_ED.id), elegir: (al, q) => { REC_ED.items.push({ ref: al.id, q: q || (al.por[0] ? al.por[0][1] : 100) }); recordarAlimento(al); REC_ED.cambio = true; abrirReceta(REC_ED.id); } }); }
function guardarReceta() {
  const c = nutCfg(), r = c.recetas.find(x => x.id === REC_ED.id);
  r.items = REC_ED.items; guardarNut(c); REC_ED.cambio = false; hap('ok'); toast('Receta guardada');
  pintarReceta(); pintarComida(); actualizarWidgets();
}
function cerrarReceta() { const v = REC_ED && REC_ED.deCena; REC_ED = null; if (v) abrirCenas(); else cerrarModal(); }
function agregarRecetaHoy() {
  const e = REC_ED, t = NUT.receta({ items: e.items }, resolver);
  if (e.cambio) { const c = nutCfg(); c.recetas.find(x => x.id === e.id).items = e.items; guardarNut(c); }
  const k = nuevoRegistro(Object.assign({ n: e.n, src: 'receta', ref: e.id, partes: partesDe(t) }, t.tot));
  contarUso('@' + e.id);
  REC_ED = null; cerrarModal();
  const rec = recetaDe(e.id), aMano = COMIDA_SEL && Date.now() - COMIDA_SEL_T < 2 * 3600e3;
  agregarAProt([k], [aMano ? COMIDA_SEL : (rec && rec.m) || comidaActual()]); hap('ok'); cambiarProt(); toast('+' + Math.round(t.tot.p) + ' g · ' + t.tot.k + ' kcal ✓');
}
function contarUso(k) { const c = LS.get('gym_food_counts', {}); c[k] = (c[k] || 0) + 1; LS.set('gym_food_counts', c); }

/* ----- La cena lado a lado: harina con queso y frijol contra maíz con frijol y soya ----- */
function abrirCenas() {
  const a = recetaDe('cena-harina'), b = recetaDe('cena-maiz');
  const ta = NUT.receta(a, resolver).tot, tb = NUT.receta(b, resolver).tot, d = NUT.diferencia(ta, tb);
  const fila = (nom, k, u, mejorSiBaja) => {
    const dif = d[k], mejor = mejorSiBaja ? dif < 0 : dif > 0;
    return html`<div class="cf"><span>${nom}</span><b class="num">${NUT.r1(ta[k])}</b><b class="num">${NUT.r1(tb[k])}</b>` +
      html`<em class="${Math.abs(dif) < 0.5 ? '' : mejor ? 'bien' : 'mal'}">${dif > 0 ? '+' : ''}${k === 'k' ? Math.round(dif) : NUT.r1(dif)}${u ? ' ' + u : ''}</em></div>`;
  };
  $('sheet').innerHTML = html`<div class="row between"><div class="t2">Tu cena</div><button class="cerrar" ${on('cerrarModal')} aria-label="Cerrar">✕</button></div>` +
    html`<div class="muted" style="margin:2px 0 12px">Lo que cambia si pasas de harina a maíz con soya en el frijol.</div>` +
    html`<div class="cenas"><div class="cf cab"><span></span><b>🌮 Harina</b><b>🌽 Maíz + soya</b><em>Cambio</em></div>` +
    fila('Proteína', 'p', 'g', false) + fila('Calorías', 'k', '', true) + fila('Carbohidratos', 'c', 'g', true) + fila('Grasa', 'f', 'g', true) + fila('Fibra', 'fib', 'g', false) + '</div>' +
    html`<div class="tip" style="margin:12px 0 0">${resumenCena(d)}</div>` +
    html`<div class="acts"><button class="btn ghost" ${on('editarCena', 'cena-harina')}>Editar harina</button><button class="btn ghost" ${on('editarCena', 'cena-maiz')}>Editar maíz</button></div>` +
    html`<div class="acts" style="margin-top:8px"><button class="btn ghost" ${on('cenaHoy', 'cena-harina')}>Cené harina</button><button class="btn" ${on('cenaHoy', 'cena-maiz')}>Cené maíz</button></div>`;
  if (!$('modal').classList.contains('show')) abrirModal();
}
function resumenCena(d) {
  const p = [];
  if (d.p >= 1) p.push(NUT.r1(d.p) + ' g más de proteína');
  if (d.k <= -10) p.push(Math.abs(d.k) + ' kcal menos');
  if (d.f <= -1) p.push(Math.abs(NUT.r1(d.f)) + ' g menos de grasa');
  return p.length ? 'Con maíz y soya: ' + p.join(', ') + '. Al mes son ~' + Math.abs(Math.round(d.k * 30)).toLocaleString('es-MX') + ' kcal ' + (d.k < 0 ? 'menos' : 'más') + '.'
    : 'Casi lo mismo: ajusta las cantidades para ver la diferencia.';
}
function cenaHoy(id) {
  const rec = recetaDe(id), todo = NUT.receta(rec, resolver), t = todo.tot;
  agregarAProt([nuevoRegistro(Object.assign({ n: rec.n, src: 'receta', ref: id, partes: partesDe(todo) }, t))], ['n']);
  contarUso('@' + id); cerrarModal(); hap('ok'); cambiarProt(); toast('Cena: +' + Math.round(t.p) + ' g · ' + t.k + ' kcal ✓');
}

/* ----- El tupper de mamá: proteína, con qué viene y qué tan lleno. Aprende tus combinaciones ----- */
let TUP = null;
function abrirTupper() {
  TUP = TUP || { prot: 'pollo', lados: ['arroz', 'frijol'], tam: 'normal', tort: 0 };
  pintarTupper();
  if (!$('modal').classList.contains('show')) abrirModal();
}
function pintarTupper() {
  const T = NUT.TUPPER, t = NUT.receta({ items: NUT.tupper(TUP) }, resolver).tot;
  const mios = Object.values(nutCfg().tuppers || {}).sort((a, b) => b.n - a.n || b.ts - a.ts).slice(0, 4);
  const chip = (activo, txt, accion) => html`<button class="tch${activo ? ' on' : ''}" ${accion}>${txt}</button>`;
  $('sheet').innerHTML = html`<div class="row between"><div class="t2">Tupper de mamá</div><button class="cerrar" ${on('cerrarModal')} aria-label="Cerrar">✕</button></div>` +
    (mios.length ? html`<div class="tmios">${mios.map(x => html`<button ${on('tupperDeSiempre', x.clave)}><b>${x.nombre.replace(/^Tupper: /, '')}</b><small>${x.p} g · ${x.k} kcal · ${x.n}×</small></button>`)}</div>` : '') +
    html`<div class="tpaso">1. ¿Qué trae?</div><div class="tchips">${T.proteinas.map(p => chip(TUP.prot === p[0], p[2] + ' ' + p[1], on('tupProt', p[0])))}</div>` +
    html`<div class="tpaso">2. ¿Con qué viene?</div><div class="tchips">${T.lados.map(l => chip(TUP.lados.includes(l[0]), l[2] + ' ' + l[1], on('tupLado', l[0])))}` +
      html`<span class="ttort">🫓 Tortillas <button class="mini" ${on('tupTortillas', -1)} aria-label="Menos">−</button><b class="num">${TUP.tort}</b><button class="mini" ${on('tupTortillas', 1)} aria-label="Más">+</button></span></div>` +
    html`<div class="tpaso">3. ¿Qué tan lleno?</div><div class="tchips">${T.tamanos.map(x => chip(TUP.tam === x[0], x[1], on('tupTam', x[0])))}</div>` +
    html`<div class="rectot"><b class="num">${Math.round(t.p)} g</b> proteína<span>${fmtM(t, true)}</span></div>` +
    html`<div class="muted" style="font-size:12.5px">Incluye el aceite del guisado (~1½ cucharaditas). Valores: tabla mexicana (INCMNSZ) y USDA.</div>` +
    html`<div class="acts"><button class="btn ghost" ${on('abrirCamara', 'tupper')}>📷 Mejor foto</button><button class="btn" ${on('agregarTupper')}>Agregar a comida</button></div>`;
}
function tupLado(l) { const i = TUP.lados.indexOf(l); if (i > -1) TUP.lados.splice(i, 1); else TUP.lados.push(l); hap('tecla'); pintarTupper(); }
function tupperDeSiempre(clave) { const x = (nutCfg().tuppers || {})[clave]; if (!x) return; TUP = JSON.parse(JSON.stringify(x.sel)); agregarTupper(); }
function agregarTupper() {
  const todo = NUT.receta({ items: NUT.tupper(TUP) }, resolver), t = todo.tot, nombre = NUT.nombreTupper(TUP), clave = NUT.claveTupper(TUP);
  const c = nutCfg(); c.tuppers = c.tuppers || {};
  const prev = c.tuppers[clave];
  c.tuppers[clave] = { clave: clave, sel: JSON.parse(JSON.stringify(TUP)), nombre: nombre, n: (prev ? prev.n : 0) + 1, ts: Date.now(), p: Math.round(t.p), k: t.k };
  // Solo las 12 combinaciones más usadas
  const ks = Object.keys(c.tuppers).sort((a, b) => c.tuppers[b].n - c.tuppers[a].n || c.tuppers[b].ts - c.tuppers[a].ts);
  ks.slice(12).forEach(k => delete c.tuppers[k]);
  guardarNut(c);
  agregarAProt([nuevoRegistro(Object.assign({ n: nombre, src: 'tupper', ref: clave, partes: partesDe(todo) }, t))], ['c']);
  cerrarModal(); hap('ok'); cambiarProt(); toast('+' + Math.round(t.p) + ' g · ' + t.k + ' kcal ✓');
}

/* ----- Metas: cómo se calcularon y, si quieres, las tuyas ----- */
function abrirMetas() {
  const m = metasHoy(), t = totalMacros();
  const fila = (nom, v, meta, u) => html`<div class="mt"><span>${nom}</span><b class="num">${v.toLocaleString('es-MX')}</b><span class="muted">de ${meta.toLocaleString('es-MX')} ${u}</span></div>`;
  $('sheet').innerHTML = html`<div class="row between"><div class="t2">Tus metas de hoy</div><button class="cerrar" ${on('cerrarModal')} aria-label="Cerrar">✕</button></div>` +
    html`<div class="metas">${fila('Proteína', t.p, m.p, 'g')}${fila('Calorías', t.k, m.k, 'kcal')}${fila('Carbohidratos', t.c, m.c, 'g')}${fila('Grasa', t.f, m.f, 'g')}${fila('Fibra', t.fib, m.fib, 'g')}</div>` +
    (m.auto ? html`<div class="tip" style="margin:12px 0 0">Calculadas con tus datos: ${m.kg} kg, ${(DATA.dias || []).length} días de gym y tus km de trote. Mantenimiento ~${m.mant.toLocaleString('es-MX')}` +
      html` kcal; −${m.deficit} kcal para bajar grasa sin perder músculo${m.ajuste ? ' y ' + (m.ajuste > 0 ? '+' : '') + m.ajuste + ' porque ' + m.porque : ''}` +
      html`. Proteína: tu meta. Grasa: 0.8 g por kg. Carbohidratos: lo que queda. Se recalculan solas con tu peso y tu ritmo. Panel muestra estas mismas.</div>`
      : html`<div class="tip" style="margin:12px 0 0">Son las que pusiste tú. La proteína sigue siendo tu meta de siempre.</div>`) +
    tipMantReal(m) +
    html`<div class="tpaso">¿Quieres poner las tuyas?</div><div class="pcs">` +
      html`${['k', 'c', 'f'].map(k => html`<label class="pc"><span>${{ k: 'kcal', c: 'Carbos', f: 'Grasa' }[k]}</span><input id="mt_${k}" class="num" inputmode="numeric" value="${m[k]}"></label>`)}</div>` +
    html`<div class="acts">${m.auto ? '' : html`<button class="btn ghost" ${on('metasAuto')}>Volver a las calculadas</button>`}<button class="btn" ${on('guardarMetas')}>Usar estas</button></div>`;
  abrirModal();
}
// Panel muestra las metas de Gym (opción A: Gym las calcula con tu peso y tu ritmo). Se mandan solo cuando cambian
// (o una vez al día, para que Panel sepa que siguen vigentes)
function mandarMetasGym() {
  if (!DATA || !DATA.scriptVersion || versionNum(DATA.scriptVersion) < versionNum('8.1')) return;
  const m = metasHoy(), mr = mantReal(), env = { k: m.k, p: m.p, c: m.c, f: m.f, fib: m.fib, auto: !!m.auto, mant: m.mant || null, porque: m.auto ? m.porque || '' : 'las pusiste en Gym',
    mantReal: mr && mr.confiable ? mr.mant : null };
  const ya = LS.get('gym_metas_env', null), firma = [env.k, env.p, env.c, env.f, env.fib, env.auto, env.mantReal].join('|');
  if (ya && ya.firma === firma && ya.dia === hoy()) return;
  encolar('saveConfig', [{ metasGym: env }], 'metas-gym');
  LS.set('gym_metas_env', { firma: firma, dia: hoy() });
}
// Lo que de verdad pasa: tu promedio de calorías registradas contra cómo se movió tu peso
function mantReal() { const m7 = DATA && DATA.macros7, r = DATA && DATA.resumen; return m7 ? NUT.mantenimientoReal(m7.kcal, r ? r.cambioSemana : null, m7.dias) : null; }
function tipMantReal(m) {
  const mr = mantReal();
  if (!mr) return '';
  const bajo = m.mant && mr.mant < m.mant - 300;
  return crudo(html`<div class="tip" style="margin:10px 0 0">📊 Con tus datos reales (${DATA.macros7.dias} días completos): comes ~${mr.kcal.toLocaleString('es-MX')} kcal y tu peso cambió ` +
    html`${mr.cambio > 0 ? '+' : ''}${NUT.r1(mr.cambio)} kg/sem → tu mantenimiento real anda en ~${mr.mant.toLocaleString('es-MX')} kcal${m.mant ? ' (la fórmula dice ' + m.mant.toLocaleString('es-MX') + ')' : ''}. ` +
    html`${bajo ? 'Es bastante menos que la fórmula: lo más probable es que algo no se esté anotando (aceite, bebidas, botanas, probadas). ' : ''}` +
    html`${!mr.confiable ? 'Con pocos días todavía es una idea, no un dato.' : ''}</div>`);
}
function guardarMetas() {
  const v = k => Math.round(Number(($('mt_' + k) || {}).value) || 0), c = nutCfg();
  if (v('k') < 1000 || v('k') > 5000) return toast('Revisa las calorías');
  c.metas = { k: v('k'), c: v('c'), f: v('f') }; guardarNut(c); cerrarModal(); hap('ok'); pintarComida(); mandarMetasGym();
}
function metasAuto() { const c = nutCfg(); c.metas = null; guardarNut(c); cerrarModal(); pintarComida(); mandarMetasGym(); }

/* ----- Acciones de botones de Comida (antes eran código dentro del HTML) ----- */
function editarCena(id) { REC_ED = null; abrirReceta(id, true); }
function tupProt(p) { TUP.prot = p; pintarTupper(); }
function tupTam(t) { TUP.tam = t; pintarTupper(); }
function tupTortillas(d) { TUP.tort = Math.max(0, Math.min(8, TUP.tort + d)); pintarTupper(); }
const numeroEscrito = v => Number(String(v).replace(',', '.'));
