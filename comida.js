/* ===================== COMIDA CON MACROS =====================
   La proteína sigue mandando (el anillo, la meta, el aviso de las 6 pm y el widget no cambian). Aquí vive lo nuevo:
   - Cada cosa que comes se guarda como un registro con su cantidad y sus macros (proteína, carbohidratos, grasa, kcal, fibra),
     tal como eran ese día: si después cambias una receta o un producto, tu historial no se mueve.
   - Recetas (tu licuado y las dos cenas), el tupper de mamá en 3 toques, el buscador (catálogo de México + USDA y
     Open Food Facts) y la cámara (etiqueta nutricional, foto del tupper y código de barras).
   Los cálculos están en nutricion.js (con pruebas); aquí solo la pantalla y el guardado. */

/* ----- Registros del día: la lista del día (prot) guarda claves; '#id' es un registro con todos sus macros ----- */
let REG_M = null;
function regMapa() { return REG_M || (REG_M = LS.get('gym_reg', {})); }
function regGuardar() {
  // Se limpian los registros de hace más de 120 días que ya no están en ninguna lista
  const m = regMapa(), viejo = Date.now() - 120 * 864e5;
  Object.keys(m).forEach(id => { if (m[id].ts < viejo) delete m[id]; });
  LS.set('gym_reg', m);
}
function nuevoRegistro(o) {
  const id = uid(), m = regMapa();
  m[id] = { ts: Date.now(), n: String(o.n || 'Comida').slice(0, 60), q: o.q || null, u: o.u || '', src: o.src || '', ref: o.ref || '',
            p: NUT.r1(o.p), c: o.c === null || o.c === undefined ? null : NUT.r1(o.c), f: o.f === null || o.f === undefined ? null : NUT.r1(o.f),
            k: o.k === null || o.k === undefined ? null : Math.round(o.k), fib: o.fib === null || o.fib === undefined ? null : NUT.r1(o.fib) };
  regGuardar();
  return '#' + id;
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
    return nuevoRegistro(Object.assign({ n: rec.n, src: 'receta', ref: rec.id }, t.tot));
  }
  const f = FOODS.find(x => x.k === k);
  if (f) return nuevoRegistro(Object.assign({ n: f.t, src: 'boton', ref: k }, NUT.LEGADO[k] || { p: f.g }));
  const fav = (DATA.comidas || []).find(c => clavePropia(c.t, c.g) === k);
  if (fav) return nuevoRegistro({ n: fav.t, src: 'fav', ref: k, p: fav.g, c: fav.c, f: fav.f, k: fav.k, fib: fav.fib });
  return k;
}
// Lo que va a la hoja: la proteína y el detalle de siempre (Peso diario) y, con el script 7.7, cada cosa con sus macros (pestaña Comidas)
function detalleTexto(lista) { return lista.map(k => esReg(k) ? clavePropia(tDe(k), gDe(k)) : k).join(', '); }
const scriptNut = () => !!(DATA && DATA.scriptVersion && versionNum(DATA.scriptVersion) >= versionNum('7.7'));
function sincronizarDia(dia, lista) {
  encolar('saveProteina', [protTotal(lista), detalleTexto(lista), dia], 'prot-' + dia);
  if (!scriptNut()) return;
  const t = etiquetas(dia, lista.length);
  const items = lista.map((k, i) => {
    const r = regDe(k), m = macrosDe(k);
    return { id: esReg(k) ? k.slice(1) : '', h: r ? horaHHMM(r.ts) : '', m: t[i] || '', n: tDe(k), q: r ? r.q : null, u: r ? r.u : '',
             p: m.p || 0, c: m.c, f: m.f, k: m.k, fib: m.fib, src: r ? r.src : 'boton', ref: r ? r.ref : k };
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
    return '<div class="mm ' + cls + (v > meta * 1.05 ? ' pasa' : '') + '"><span class="et">' + nom + '</span><b class="num">' + v.toLocaleString('es-MX') +
      '<small>/' + meta.toLocaleString('es-MX') + (u ? ' ' + u : '') + '</small></b><i style="--p:' + pct + '%"></i></div>';
  };
  return '<button class="macros" ' + on('abrirMetas') + ' aria-label="Ver metas de calorías y macros">' +
    barra('Calorías', t.k, mt.k, '', 'kc') + barra('Carbohidratos', t.c, mt.c, 'g', 'ca') + barra('Grasa', t.f, mt.f, 'g', 'gr') + '</button>' +
    (t.sinDatos ? '<div class="muted sindatos">' + t.sinDatos + ' cosa' + (t.sinDatos > 1 ? 's' : '') + ' de hoy solo tiene' + (t.sinDatos > 1 ? 'n' : '') + ' proteína (de antes)</div>' : '');
}

/* ----- Tus de siempre: el licuado, el tupper de mamá y la cena ----- */
function filaSiempre() {
  const lic = totReceta('licuado'), h = totReceta('cena-harina'), m = totReceta('cena-maiz');
  const usosTup = Object.values(nutCfg().tuppers || {}).sort((a, b) => b.n - a.n)[0];
  const b = (ico, nom, sub, accion, extra) => '<button class="siempre" ' + accion + '><span class="ic">' + ico + '</span><span class="tx"><b>' + nom + '</b><small>' + sub + '</small></span>' + (extra || '') + '</button>';
  return '<div class="siempre3">' +
    b('🥤', 'Mi licuado', lic ? '<b class="num">' + Math.round(lic.p) + ' g</b> · ' + lic.k + ' kcal' : '', on('abrirReceta', 'licuado')) +
    b('🍱', 'Tupper', usosTup ? '<b class="num">' + usosTup.p + ' g</b> · ' + esc(usosTup.nombre.replace(/^Tupper: /, '').split(/[ ,]/)[0]) : 'En 3 toques', on('abrirTupper')) +
    b('🌮', 'Cena', h && m ? 'Harina o maíz: ' + Math.round(h.p) + ' / ' + Math.round(m.p) + ' g' : '', on('abrirCenas')) +
    '</div><div class="herr">' +
    '<button ' + on('abrirBuscador') + '><span>🔍</span>Buscar alimento</button>' +
    '<button ' + on('abrirCamara') + '><span>📷</span>Foto o código</button></div>';
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
  $('sheet').innerHTML = '<div class="row between"><div class="t2">' + esc(e.n) + '</div><button class="cerrar" ' + on('cerrarReceta') + ' aria-label="Cerrar">✕</button></div>' +
    '<div class="muted" style="margin:2px 0 10px">Toca una cantidad para cambiarla. ' + (e.id === 'licuado' ? 'Vienen cantidades estándar: cuando midas las tuyas, ponlas aquí.' : '') + '</div>' +
    '<div class="rec">' + t.items.map((it, i) => {
      const al = it.al, m = it.m || {}, u = al ? al.u : 'g';
      return '<div class="ri"><div class="nm"><b>' + esc(al ? al.n : 'Alimento que ya no está') + (it.rol ? ' <span class="rol">' + rolTxt[it.rol] + '</span>' : '') + '</b></div>' +
        '<div class="mac2">' + (al ? '<b>' + NUT.r1(m.p) + ' g</b> prot · ' + Math.round(m.k || 0) + ' kcal' : '') + '</div><div class="ctl">' +
        '<button class="mini" ' + on('recCant', i, -1) + ' aria-label="Menos">−</button>' +
        '<input class="cant num" inputmode="decimal" value="' + it.q + '" ' + ev('change', 'recSet', i, VALOR) + ' aria-label="Cantidad"><span class="u">' + u + '</span>' +
        '<button class="mini" ' + on('recCant', i, 1) + ' aria-label="Más">+</button>' +
        '<button class="mini" ' + on('recCambiar', i) + ' aria-label="Cambiar ingrediente">⇄</button>' +
        '<button class="mini" ' + on('recQuitar', i) + ' aria-label="Quitar">✕</button></div></div>';
    }).join('') + '</div>' +
    '<button class="link" ' + on('recAgregar') + '>＋ Agregar ingrediente</button>' +
    '<div class="rectot"><b class="num">' + Math.round(t.tot.p) + ' g</b> proteína<span>' + fmtM(t.tot, true) + '</span></div>' +
    '<div class="acts">' + (e.cambio ? '<button class="btn ghost" ' + on('guardarReceta') + '>Guardar cambios</button>' : '') +
    '<button class="btn" ' + on('agregarRecetaHoy') + '>Agregar a ' + esc(nombreDeComida(comidaActual()).toLowerCase()) + '</button></div>';
}
// "12 g carbs · 5 g grasa · 230 kcal" (con proteína si se pide)
function fmtM(m, sinP) {
  if (!m || m.k === null || m.k === undefined) return m && m.p ? Math.round(m.p) + ' g proteína' : '';
  return (sinP ? '' : '<b>' + NUT.r1(m.p) + ' g</b> prot · ') + Math.round(m.c) + ' g carbs · ' + Math.round(m.f) + ' g grasa · ' + Math.round(m.k) + ' kcal';
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
  const k = nuevoRegistro(Object.assign({ n: e.n, src: 'receta', ref: e.id }, t.tot));
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
    return '<div class="cf"><span>' + nom + '</span><b class="num">' + NUT.r1(ta[k]) + '</b><b class="num">' + NUT.r1(tb[k]) + '</b>' +
      '<em class="' + (Math.abs(dif) < 0.5 ? '' : mejor ? 'bien' : 'mal') + '">' + (dif > 0 ? '+' : '') + (k === 'k' ? Math.round(dif) : NUT.r1(dif)) + (u ? ' ' + u : '') + '</em></div>';
  };
  $('sheet').innerHTML = '<div class="row between"><div class="t2">Tu cena</div><button class="cerrar" ' + on('cerrarModal') + ' aria-label="Cerrar">✕</button></div>' +
    '<div class="muted" style="margin:2px 0 12px">Lo que cambia si pasas de harina a maíz con soya en el frijol.</div>' +
    '<div class="cenas"><div class="cf cab"><span></span><b>🌮 Harina</b><b>🌽 Maíz + soya</b><em>Cambio</em></div>' +
    fila('Proteína', 'p', 'g', false) + fila('Calorías', 'k', '', true) + fila('Carbohidratos', 'c', 'g', true) + fila('Grasa', 'f', 'g', true) + fila('Fibra', 'fib', 'g', false) + '</div>' +
    '<div class="tip" style="margin:12px 0 0">' + esc(resumenCena(d)) + '</div>' +
    '<div class="acts"><button class="btn ghost" ' + on('editarCena', 'cena-harina') + '>Editar harina</button><button class="btn ghost" ' + on('editarCena', 'cena-maiz') + '>Editar maíz</button></div>' +
    '<div class="acts" style="margin-top:8px"><button class="btn ghost" ' + on('cenaHoy', 'cena-harina') + '>Cené harina</button><button class="btn" ' + on('cenaHoy', 'cena-maiz') + '>Cené maíz</button></div>';
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
  const rec = recetaDe(id), t = NUT.receta(rec, resolver).tot;
  agregarAProt([nuevoRegistro(Object.assign({ n: rec.n, src: 'receta', ref: id }, t))], ['n']);
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
  const chip = (activo, txt, accion) => '<button class="tch' + (activo ? ' on' : '') + '" ' + accion + '>' + txt + '</button>';
  $('sheet').innerHTML = '<div class="row between"><div class="t2">Tupper de mamá</div><button class="cerrar" ' + on('cerrarModal') + ' aria-label="Cerrar">✕</button></div>' +
    (mios.length ? '<div class="tmios">' + mios.map(x => '<button ' + on('tupperDeSiempre', x.clave) + '><b>' + esc(x.nombre.replace(/^Tupper: /, '')) + '</b><small>' + x.p + ' g · ' + x.k + ' kcal · ' + x.n + '×</small></button>').join('') + '</div>' : '') +
    '<div class="tpaso">1. ¿Qué trae?</div><div class="tchips">' + T.proteinas.map(p => chip(TUP.prot === p[0], p[2] + ' ' + p[1], on('tupProt', p[0]))).join('') + '</div>' +
    '<div class="tpaso">2. ¿Con qué viene?</div><div class="tchips">' + T.lados.map(l => chip(TUP.lados.includes(l[0]), l[2] + ' ' + l[1], on('tupLado', l[0]))).join('') +
      '<span class="ttort">🫓 Tortillas <button class="mini" ' + on('tupTortillas', -1) + ' aria-label="Menos">−</button><b class="num">' + TUP.tort + '</b><button class="mini" ' + on('tupTortillas', 1) + ' aria-label="Más">+</button></span></div>' +
    '<div class="tpaso">3. ¿Qué tan lleno?</div><div class="tchips">' + T.tamanos.map(x => chip(TUP.tam === x[0], x[1], on('tupTam', x[0]))).join('') + '</div>' +
    '<div class="rectot"><b class="num">' + Math.round(t.p) + ' g</b> proteína<span>' + fmtM(t, true) + '</span></div>' +
    '<div class="muted" style="font-size:12.5px">Incluye el aceite del guisado (~1½ cucharaditas). Valores: tabla mexicana (INCMNSZ) y USDA.</div>' +
    '<div class="acts"><button class="btn ghost" ' + on('abrirCamara', 'tupper') + '>📷 Mejor foto</button><button class="btn" ' + on('agregarTupper') + '>Agregar a comida</button></div>';
}
function tupLado(l) { const i = TUP.lados.indexOf(l); if (i > -1) TUP.lados.splice(i, 1); else TUP.lados.push(l); hap('tecla'); pintarTupper(); }
function tupperDeSiempre(clave) { const x = (nutCfg().tuppers || {})[clave]; if (!x) return; TUP = JSON.parse(JSON.stringify(x.sel)); agregarTupper(); }
function agregarTupper() {
  const t = NUT.receta({ items: NUT.tupper(TUP) }, resolver).tot, nombre = NUT.nombreTupper(TUP), clave = NUT.claveTupper(TUP);
  const c = nutCfg(); c.tuppers = c.tuppers || {};
  const prev = c.tuppers[clave];
  c.tuppers[clave] = { clave: clave, sel: JSON.parse(JSON.stringify(TUP)), nombre: nombre, n: (prev ? prev.n : 0) + 1, ts: Date.now(), p: Math.round(t.p), k: t.k };
  // Solo las 12 combinaciones más usadas
  const ks = Object.keys(c.tuppers).sort((a, b) => c.tuppers[b].n - c.tuppers[a].n || c.tuppers[b].ts - c.tuppers[a].ts);
  ks.slice(12).forEach(k => delete c.tuppers[k]);
  guardarNut(c);
  agregarAProt([nuevoRegistro(Object.assign({ n: nombre, src: 'tupper', ref: clave }, t))], ['c']);
  cerrarModal(); hap('ok'); cambiarProt(); toast('+' + Math.round(t.p) + ' g · ' + t.k + ' kcal ✓');
}

/* ----- Buscador: catálogo (México + USDA, se baja la primera vez que buscas), tus productos y Open Food Facts ----- */
let CATALOGO = null, CAT_CARGANDO = null, BUS = null;
const CATALOGO_V = 1;
function cargarCatalogo() {
  if (CATALOGO) return Promise.resolve(CATALOGO);
  if (!CAT_CARGANDO) CAT_CARGANDO = fetch('datos/alimentos.json?v=' + CATALOGO_V).then(r => r.json()).then(j => (CATALOGO = NUT.desempacar(j)))
    .catch(e => { CAT_CARGANDO = null; throw e; });
  return CAT_CARGANDO;
}
function listaBusqueda() {
  const usados = Object.values(LS.get('gym_alim_usados', {}));
  const vistos = {};
  return NUT.BASE.concat(nutCfg().productos, usados, CATALOGO || []).filter(a => !vistos[a.id] && (vistos[a.id] = true));
}
function abrirBuscador(o) {
  BUS = Object.assign({ q: '', res: null, off: null, cargando: false }, o || {});
  pintarBuscador();
  if (!$('modal').classList.contains('show')) abrirModal();
  setTimeout(() => { const i = $('busNut'); if (i) i.focus(); }, 60);
  cargarCatalogo().then(() => { if (BUS && BUS.q) buscarNut(BUS.q); }).catch(() => {});
}
function pintarBuscador() {
  const b = BUS, res = b.q ? NUT.buscar(listaBusqueda(), b.q, 40) : nutCfg().productos.concat(Object.values(LS.get('gym_alim_usados', {}))).slice(-12).reverse();
  const fila = a => '<button class="bres" ' + on('elegirNut', a.id) + '><span class="nm">' + esc(a.n) + (a.marca ? ' · ' + esc(a.marca) : '') +
    '<small>' + fuenteTxt(a) + ' · por 100 ' + (a.u || 'g') + ': <b>' + NUT.r1(a.p) + ' g prot</b> · ' + Math.round(a.k) + ' kcal' + (a.crudo ? ' · crudo' : '') + '</small></span></button>';
  const offRes = b.off ? (b.off.length ? b.off.map(a => '<button class="bres" ' + on('elegirOFF', a.code) + '><span class="nm">' + esc(a.n) + (a.marca ? ' · ' + esc(a.marca) : '') +
    '<small>Open Food Facts · por 100 ' + a.u + ': <b>' + NUT.r1(a.p) + ' g prot</b> · ' + Math.round(a.k || 0) + ' kcal</small></span></button>').join('') : '<div class="muted" style="margin:8px 2px">No encontré productos con ese nombre.</div>') : '';
  $('sheet').innerHTML = '<div class="row between"><div class="t2">' + (b.elegir ? 'Elige el ingrediente' : 'Buscar alimento') + '</div><button class="cerrar" ' + on('cerrarBuscador') + ' aria-label="Cerrar">✕</button></div>' +
    '<input id="busNut" class="buscar" type="search" placeholder="Ej. tortilla de maíz, queso panela, avena…" value="' + esc(b.q) + '" ' + ev('input', 'buscarNut', VALOR) + '>' +
    '<div class="bfuentes">' + (CATALOGO ? (CATALOGO.length + NUT.BASE.length).toLocaleString('es-MX') + ' alimentos: tabla mexicana (INCMNSZ), USDA y los tuyos' : 'Cargando el catálogo…') + '</div>' +
    '<div class="blista" id="busRes">' + (res.length ? res.map(fila).join('') : b.q ? '<div class="muted" style="margin:8px 2px">Nada en el catálogo con «' + esc(b.q) + '».</div>' : '<div class="muted" style="margin:8px 2px">Escribe qué comiste. Lo que uses queda aquí para la próxima.</div>') +
      (b.q ? '<button class="link" style="margin:8px 2px" ' + on('buscarOFF') + '>' + (b.cargando ? 'Buscando en Open Food Facts…' : '🛒 Buscar productos de marca (Open Food Facts)') + '</button>' + offRes : '') + '</div>';
}
function fuenteTxt(a) { const s = a.src || String(a.id).split(':')[0]; return { b: 'Básico', usda: 'USDA', mx: 'Tabla mexicana', us: 'USDA', p: 'Tuyo', etiqueta: 'Tu etiqueta', off: 'Open Food Facts', calc: 'Calculado' }[s] || 'Catálogo'; }
let BUS_T = null;
function buscarNut(q) {
  BUS.q = q; BUS.off = null;
  clearTimeout(BUS_T);
  BUS_T = setTimeout(() => {
    const i = $('busNut'), pos = i ? i.selectionStart : null;
    pintarBuscador();
    const j = $('busNut'); if (j) { j.focus(); if (pos !== null) j.setSelectionRange(pos, pos); }
  }, 120);
}
function cerrarBuscador() { const o = BUS; BUS = null; if (o && o.volver) o.volver(); else cerrarModal(); }
function elegirNut(id) { const al = listaBusqueda().find(a => a.id === id); if (al) pedirCantidad(al); }

/* ----- Open Food Facts: búsqueda por nombre y por código de barras (productos de marca) ----- */
const OFF = 'https://world.openfoodfacts.org';
function deOFF(p) {
  const n = p.nutriments || {}, u = /ml|l\b/i.test(String(p.product_quantity_unit || p.quantity || '')) ? 'ml' : 'g';
  const num = x => x === undefined || x === null || x === '' ? null : Number(x);
  const e = NUT.normalizarEtiqueta({ nombre: p.product_name || p.product_name_es || 'Producto', marca: (p.brands || '').split(',')[0], u: u, src: 'off',
    por100: { p: num(n.proteins_100g), c: num(n.carbohydrates_100g), f: num(n.fat_100g), k: num(n['energy-kcal_100g']), fib: num(n.fiber_100g) },
    porcion: p.serving_quantity ? { texto: p.serving_size || '1 porción', cant: Number(p.serving_quantity), p: num(n.proteins_serving), c: num(n.carbohydrates_serving),
      f: num(n.fat_serving), k: num(n['energy-kcal_serving']), fib: num(n.fiber_serving) } : null });
  if (e.error) return null;
  return Object.assign(e.al, { code: p.code, avisos: e.avisos });
}
let OFF_CACHE = {};
async function buscarOFF() {
  if (!navigator.onLine) return toast('Necesitas señal para buscar productos de marca');
  BUS.cargando = true; pintarBuscador();
  const campos = 'code,product_name,product_name_es,brands,nutriments,serving_size,serving_quantity,quantity,product_quantity_unit';
  const url = q => OFF + '/cgi/search.pl?search_simple=1&json=1&page_size=20&fields=' + campos + '&search_terms=' + encodeURIComponent(q);
  try {
    let j = await conLimite(fetch(url(BUS.q) + '&tagtype_0=countries&tag_contains_0=contains&tag_0=mexico').then(r => r.json()), 15000);
    if (!(j.products || []).length) j = await conLimite(fetch(url(BUS.q)).then(r => r.json()), 15000);
    BUS.off = (j.products || []).map(deOFF).filter(Boolean);
    BUS.off.forEach(a => { OFF_CACHE[a.code] = a; });
  } catch (e) { BUS.off = []; toast('Open Food Facts no respondió: ' + (e.message === 'tiempo' ? 'tardó demasiado' : 'sin conexión')); }
  if (BUS) { BUS.cargando = false; pintarBuscador(); }
}
async function productoPorCodigo(code) {
  code = String(code || '').replace(/\D/g, '');
  if (code.length < 8) { toast('Ese código no parece completo'); return null; }
  if (OFF_CACHE[code]) return OFF_CACHE[code];
  if (!navigator.onLine) { toast('Necesitas señal para buscar el código'); return null; }
  try {
    const j = await conLimite(fetch(OFF + '/api/v2/product/' + code + '.json?fields=code,product_name,product_name_es,brands,nutriments,serving_size,serving_quantity,quantity,product_quantity_unit').then(r => r.json()), 15000);
    if (j.status !== 1 || !j.product) { toast('Ese código no está en Open Food Facts: tómale foto a la tabla nutricional'); return null; }
    const a = deOFF(j.product);
    if (!a) { toast('El producto no trae su tabla nutricional: tómale foto a la etiqueta'); return null; }
    return (OFF_CACHE[code] = a);
  } catch (e) { toast('Open Food Facts no respondió'); return null; }
}
function elegirOFF(code) { const a = OFF_CACHE[code]; if (a) confirmarProducto(a, a.avisos || []); }

/* ----- ¿Cuánto comiste? (porciones del alimento o gramos) ----- */
let CANT = null;
function pedirCantidad(al) {
  const elegir = BUS && BUS.elegir;
  CANT = { al: al, q: al.por && al.por[0] ? al.por[0][1] : 100, elegir: elegir, bus: BUS };
  pintarCantidad();
}
function pintarCantidad() {
  const c = CANT, al = c.al, m = NUT.macros(al, c.q);
  $('sheet').innerHTML = '<div class="row between"><div class="t2" style="padding-right:8px">' + esc(al.n) + '</div><button class="cerrar" ' + on('cerrarCantidad') + ' aria-label="Volver">✕</button></div>' +
    '<div class="muted" style="margin:2px 0 10px">' + fuenteTxt(al) + (al.crudo ? ' · valores del alimento crudo: pésalo antes de cocinar' : '') + (al.nota ? ' · ' + esc(al.nota) : '') + '</div>' +
    (al.por && al.por.length ? '<div class="tchips">' + al.por.map(p => '<button class="tch' + (c.q === p[1] ? ' on' : '') + '" ' + on('cantFija', p[1]) + '>' + esc(p[0]) + ' · ' + p[1] + ' ' + (al.u || 'g') + '</button>').join('') + '</div>' : '') +
    '<div class="cantfila"><button class="mini" ' + on('cantPaso', -1) + ' aria-label="Menos">−</button>' +
    '<input class="cant num" inputmode="decimal" value="' + c.q + '" ' + ev('change', 'cantEscrita', VALOR) + ' aria-label="Cantidad"><span class="u">' + (al.u || 'g') + '</span>' +
    '<button class="mini" ' + on('cantPaso', 1) + ' aria-label="Más">+</button></div>' +
    '<div class="rectot"><b class="num">' + NUT.r1(m.p) + ' g</b> proteína<span>' + fmtM(m, true) + '</span></div>' +
    '<div class="acts"><button class="btn" ' + on('usarCantidad') + '>' + (c.elegir ? 'Usar en la receta' : 'Agregar a ' + esc(nombreDeComida(comidaActual()).toLowerCase())) + '</button></div>';
}
function cerrarCantidad() { const b = CANT && CANT.bus; CANT = null; if (b) { BUS = b; pintarBuscador(); } else cerrarModal(); }
function usarCantidad() {
  const c = CANT; CANT = null;
  if (c.elegir) { BUS = null; return c.elegir(c.al, c.q); }
  recordarAlimento(c.al);
  const m = NUT.macros(c.al, c.q), n = c.al.n + ' · ' + NUT.r1(c.q) + ' ' + (c.al.u || 'g');
  agregarAProt([nuevoRegistro(Object.assign({ n: n.slice(0, 60), q: c.q, u: c.al.u || 'g', src: c.al.src || String(c.al.id).split(':')[0], ref: c.al.id }, m))], [comidaActual()]);
  contarUso(c.al.id); BUS = null; cerrarModal(); hap('ok'); cambiarProt(); toast('+' + NUT.r1(m.p) + ' g · ' + Math.round(m.k) + ' kcal ✓');
}

/* ----- Cámara: etiqueta nutricional (Gemini lee la tabla), foto de la comida o el tupper (Gemini estima) y código de barras ----- */
let FOTO = null, FOTO_GALERIA = false;
function abrirCamara(tipo) {
  FOTO = { tipo: tipo || null };
  if (tipo) return pedirFoto(tipo);
  $('sheet').innerHTML = '<div class="row between"><div class="t2">Foto o código</div><button class="cerrar" ' + on('cerrarModal') + ' aria-label="Cerrar">✕</button></div>' +
    '<div class="camopts">' +
    '<button ' + on('pedirFoto', 'etiqueta') + '><span>🏷️</span><b>Tabla nutricional</b><small>Leche, proteína o cualquier empaque: lee los macros solo</small></button>' +
    '<button ' + on('pedirFoto', 'tupper') + '><span>🍱</span><b>Mi comida o el tupper</b><small>Cuando no sabes qué guisado es ni cuánto pesa</small></button>' +
    '<button ' + on('pedirFoto', 'codigo') + '><span>🔢</span><b>Código de barras</b><small>Lo busca en Open Food Facts</small></button></div>' +
    '<label class="galeria"><input type="checkbox" id="deGaleria"' + (FOTO_GALERIA ? ' checked' : '') + ' ' + ev('change', 'fotoDeGaleria', MARCADO) + '> Elegir una foto que ya tomé (galería)</label>' +
    '<div class="row" style="gap:8px;margin-top:10px"><input id="codManual" class="campo" style="margin:0;flex:1" inputmode="numeric" placeholder="O escribe el número del código">' +
    '<button class="btn" ' + on('codigoManual') + '>Buscar</button></div>';
  if (!$('modal').classList.contains('show')) abrirModal();
}
function pedirFoto(tipo) {
  FOTO = { tipo: tipo };
  if ((tipo === 'etiqueta' || tipo === 'tupper') && !scriptNut()) { cerrarModal(); return toast('Actualiza tu script a la 7.7 para leer fotos con la IA'); }
  if ((tipo === 'etiqueta' || tipo === 'tupper') && !DATA.ia) { cerrarModal(); return toast('La IA no está activada en tu hoja'); }
  let inp = $('fotoNut');
  if (!inp) {
    inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.id = 'fotoNut'; inp.style.display = 'none';
    inp.addEventListener('change', () => { const f = inp.files && inp.files[0]; inp.value = ''; if (f) procesarFotoNut(f); });
    document.body.appendChild(inp);
  }
  // Con "capture" el celular abre la cámara directo; sin él, deja elegir de la galería
  if (FOTO_GALERIA) inp.removeAttribute('capture'); else inp.setAttribute('capture', 'environment');
  inp.click();
}
// La foto se achica (1280 px, JPEG) antes de mandarla: sube rápido aun con poca señal
function achicarFoto(file, max) {
  return new Promise((ok, no) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, (max || 1280) / Math.max(img.width, img.height)), cv = document.createElement('canvas');
      cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      ok({ b64: cv.toDataURL('image/jpeg', 0.82).split(',')[1], cv: cv });
    };
    img.onerror = () => { URL.revokeObjectURL(url); no(new Error('No pude abrir la foto')); };
    img.src = url;
  });
}
function cargandoFoto(txt) {
  $('sheet').innerHTML = '<div class="t2">' + esc(txt) + '</div><div class="esq" style="position:relative;height:120px;margin-top:12px;border-radius:16px"><div class="brillo"></div><span>Un momento…</span></div>';
  if (!$('modal').classList.contains('show')) abrirModal();
}
async function procesarFotoNut(file) {
  const tipo = FOTO.tipo;
  try {
    if (tipo === 'codigo') {
      cargandoFoto('Leyendo el código…');
      const f = await achicarFoto(file, 1600);
      let code = null;
      if ('BarcodeDetector' in window) {
        try { const d = await new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] }).detect(f.cv); code = d[0] && d[0].rawValue; } catch (e) {}
      }
      if (!code) { abrirCamara(); toast('No pude leer el código en la foto: escribe el número'); return; }
      const a = await productoPorCodigo(code);
      if (a) confirmarProducto(a, a.avisos || []); else abrirCamara();
      return;
    }
    if (!navigator.onLine) { cerrarModal(); return toast('Necesitas señal para leer la foto con la IA'); }
    cargandoFoto(tipo === 'etiqueta' ? 'Leyendo la etiqueta…' : 'Viendo tu comida…');
    const f = await achicarFoto(file, 1280);
    if (tipo === 'etiqueta') {
      const r = await conLimite(apiPost('etiquetaIA', [f.b64, 'image/jpeg']), 45000);
      const e = NUT.normalizarEtiqueta(Object.assign({}, r, { src: 'etiqueta' }));
      if (e.error) { cerrarModal(); return toast(e.error + '. Tómala de frente y con buena luz'); }
      if (r.code) e.al.code = String(r.code);
      return confirmarProducto(e.al, e.avisos.concat(r.avisos || []), r);
    }
    const r = await conLimite(apiPost('fotoComidaIA', [f.b64, 'image/jpeg', { meta: metaProt(), llevas: protTotal() }]), 45000);
    COMIDA_IA = { texto: '', items: (r.items || []).map(x => Object.assign(x, { on: true })), consejo: r.consejo, deFoto: true };
    cerrarModal(); verTab('Comida');
    setTimeout(() => { const c = document.querySelector('.iacard'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 80);
  } catch (e) {
    cerrarModal(); toast('No se pudo leer la foto: ' + (e.message === 'tiempo' ? 'tardó demasiado, intenta otra vez' : e.message));
  }
}
async function codigoManual() {
  const v = ($('codManual') || {}).value;
  cargandoFoto('Buscando el código…');
  const a = await productoPorCodigo(v);
  if (a) confirmarProducto(a, a.avisos || []); else abrirCamara();
}

/* ----- Producto nuevo (de la etiqueta o de Open Food Facts): revisas, lo guardas y puede ser tu leche o tu proteína de siempre ----- */
let PROD = null;
function confirmarProducto(al, avisos, crudo) {
  PROD = { al: Object.assign({}, al), avisos: avisos || [], porcionTxt: crudo && crudo.porcion ? crudo.porcion.texto : '' };
  if (!PROD.al.rol) PROD.al.rol = /leche|milk/i.test(al.n) ? 'leche' : /prote|whey|iso/i.test(al.n) || al.p > 50 ? 'proteina' : '';
  pintarProducto();
  if (!$('modal').classList.contains('show')) abrirModal();
}
function pintarProducto() {
  const a = PROD.al, u = a.u || 'g', por = a.por && a.por[0];
  const campo = (k, nom) => '<label class="pc"><span>' + nom + '</span><input class="num" inputmode="decimal" value="' + (a[k] === null || a[k] === undefined ? '' : a[k]) + '" ' + ev('change', 'prodNumero', k, VALOR) + '></label>';
  const pm = por ? NUT.macros(a, por[1]) : null;
  $('sheet').innerHTML = '<div class="row between"><div class="t2">Revisa el producto</div><button class="cerrar" ' + on('cerrarModal') + ' aria-label="Cerrar">✕</button></div>' +
    (PROD.avisos.length ? '<div class="tip acc" style="margin:8px 0">⚠️ ' + PROD.avisos.map(esc).join('<br>⚠️ ') + '</div>' : '') +
    '<input class="campo" value="' + esc(a.n) + '" ' + ev('change', 'prodTexto', 'n', VALOR) + ' aria-label="Nombre">' +
    '<input class="campo" value="' + esc(a.marca || '') + '" placeholder="Marca" ' + ev('change', 'prodTexto', 'marca', VALOR) + ' aria-label="Marca">' +
    '<div class="muted" style="margin:2px 0 6px">Por 100 ' + u + ' (si la etiqueta solo traía la porción, ya se convirtió):</div>' +
    '<div class="pcs">' + campo('p', 'Proteína') + campo('c', 'Carbos') + campo('f', 'Grasa') + campo('k', 'kcal') + campo('fib', 'Fibra') + '</div>' +
    '<div class="row" style="gap:8px;align-items:center;margin:10px 0"><span class="muted">1 porción =</span><input class="cant num" style="width:80px" inputmode="decimal" value="' + (por ? por[1] : '') + '" placeholder="—" ' +
      ev('change', 'prodPorcion', VALOR) + '><span class="muted">' + u + (pm ? ' → <b style="color:var(--text)">' + NUT.r1(pm.p) + ' g prot</b> · ' + Math.round(pm.k) + ' kcal' : '') + '</span></div>' +
    '<div class="tpaso">¿Es de tu licuado?</div><div class="tchips">' +
      [['leche', '🥛 Mi leche de siempre'], ['proteina', '💪 Mi proteína de siempre'], ['', 'No']].map(r => '<button class="tch' + (a.rol === r[0] ? ' on' : '') + '" ' + on('prodRol', r[0]) + '>' + r[1] + '</button>').join('') + '</div>' +
    (a.rol === 'proteina' && !por ? '<div class="muted" style="font-size:12.5px">Pon cuánto pesa 1 scoop para que tu licuado use uno.</div>' : '') +
    '<div class="acts"><button class="btn ghost" ' + on('guardarProducto', false) + '>Guardar</button><button class="btn" ' + on('guardarProducto', true) + '>Guardar y agregar' + (por ? ' 1 porción' : '') + '</button></div>';
}
function guardarProducto(agregar) {
  const a = PROD.al, c = nutCfg();
  if (!(a.p >= 0) || !(a.k >= 0)) return toast('Revisa la proteína y las calorías');
  const prev = c.productos.find(p => (a.code && p.code === a.code) || p.n.toLowerCase() === a.n.toLowerCase());
  const id = prev ? prev.id : 'p:' + uid();
  const prod = { id: id, n: a.n, marca: a.marca || '', u: a.u || 'g', p: NUT.r1(a.p), c: NUT.r1(a.c), f: NUT.r1(a.f), k: Math.round(a.k), fib: NUT.r1(a.fib || 0),
                 por: a.por || [], src: a.src || 'etiqueta', code: a.code || '', ts: Date.now() };
  c.productos = c.productos.filter(p => p.id !== id).concat([prod]).slice(-40);
  let msg = 'Guardado en tus productos';
  if (a.rol === 'leche' || a.rol === 'proteina') {
    const n = NUT.cambiarRol(c.recetas, a.rol, id, a.rol === 'proteina' && prod.por[0] ? prod.por[0][1] : null);
    if (n) msg = (a.rol === 'leche' ? 'Tu licuado ya usa esta leche' : 'Tu licuado ya usa esta proteína') + ' ✓';
  }
  guardarNut(c);
  PROD = null; cerrarModal(); hap('ok');
  if (agregar) { const q = prod.por[0] ? prod.por[0][1] : 100; BUS = null; pedirCantidadDirecta(prod, q); }
  toast(msg); pintarComida(); actualizarWidgets();
}
function pedirCantidadDirecta(al, q) { CANT = { al: al, q: q, elegir: null, bus: null }; pintarCantidad(); abrirModal(); }

/* ----- Metas: cómo se calcularon y, si quieres, las tuyas ----- */
function abrirMetas() {
  const m = metasHoy(), t = totalMacros();
  const fila = (nom, v, meta, u) => '<div class="mt"><span>' + nom + '</span><b class="num">' + v.toLocaleString('es-MX') + '</b><span class="muted">de ' + meta.toLocaleString('es-MX') + ' ' + u + '</span></div>';
  $('sheet').innerHTML = '<div class="row between"><div class="t2">Tus metas de hoy</div><button class="cerrar" ' + on('cerrarModal') + ' aria-label="Cerrar">✕</button></div>' +
    '<div class="metas">' + fila('Proteína', t.p, m.p, 'g') + fila('Calorías', t.k, m.k, 'kcal') + fila('Carbohidratos', t.c, m.c, 'g') + fila('Grasa', t.f, m.f, 'g') + fila('Fibra', t.fib, m.fib, 'g') + '</div>' +
    (m.auto ? '<div class="tip" style="margin:12px 0 0">Calculadas con tus datos: ' + m.kg + ' kg, ' + (DATA.dias || []).length + ' días de gym y tus km de trote. Mantenimiento ~' + m.mant.toLocaleString('es-MX') +
      ' kcal; −' + m.deficit + ' kcal para bajar grasa sin perder músculo' + (m.ajuste ? ' y ' + (m.ajuste > 0 ? '+' : '') + m.ajuste + ' porque ' + esc(m.porque) : '') +
      '. Proteína: tu meta. Grasa: 0.8 g por kg. Carbohidratos: lo que queda. Se recalculan solas con tu peso y tu ritmo.</div>'
      : '<div class="tip" style="margin:12px 0 0">Son las que pusiste tú. La proteína sigue siendo tu meta de siempre.</div>') +
    '<div class="tpaso">¿Quieres poner las tuyas?</div><div class="pcs">' +
      ['k', 'c', 'f'].map(k => '<label class="pc"><span>' + { k: 'kcal', c: 'Carbos', f: 'Grasa' }[k] + '</span><input id="mt_' + k + '" class="num" inputmode="numeric" value="' + m[k] + '"></label>').join('') + '</div>' +
    '<div class="acts">' + (m.auto ? '' : '<button class="btn ghost" ' + on('metasAuto') + '>Volver a las calculadas</button>') + '<button class="btn" ' + on('guardarMetas') + '>Usar estas</button></div>';
  abrirModal();
}
function guardarMetas() {
  const v = k => Math.round(Number(($('mt_' + k) || {}).value) || 0), c = nutCfg();
  if (v('k') < 1000 || v('k') > 5000) return toast('Revisa las calorías');
  c.metas = { k: v('k'), c: v('c'), f: v('f') }; guardarNut(c); cerrarModal(); hap('ok'); pintarComida();
}
function metasAuto() { const c = nutCfg(); c.metas = null; guardarNut(c); cerrarModal(); pintarComida(); }

/* ----- Estilos ----- */
document.head.insertAdjacentHTML('beforeend', `<style>
  .macros { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; width: 100%; margin: 12px 0 2px; padding: 0; border: 0; background: none; color: inherit; text-align: left; }
  .mm { position: relative; padding-bottom: 8px; min-width: 0; }
  .mm .et { display: block; font-size: 12px; font-weight: 600; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mm b { font-size: 17px; font-weight: 750; font-stretch: 80%; }
  .mm b small { font-size: 12px; font-weight: 600; color: var(--muted); }
  .mm i { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; border-radius: 2px; background: var(--card2); }
  .mm i::after { content: ''; display: block; height: 100%; width: var(--p); border-radius: inherit; background: var(--muted); }
  .mm.pasa i::after { background: var(--acc); }
  .sindatos { font-size: 12px; margin-top: 6px; }
  .siempre3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 14px 0 8px; }
  .siempre { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; text-align: left; border: 0; border-radius: 16px; background: var(--card); color: var(--text); padding: 12px; min-width: 0; }
  .siempre .ic { font-size: 26px; line-height: 1; }
  .siempre .tx { display: flex; flex-direction: column; min-width: 0; width: 100%; }
  .siempre b { font-size: 15px; font-weight: 700; line-height: 1.2; }
  .siempre small { color: var(--muted); font-size: 12.5px; line-height: 1.3; margin-top: 2px; }
  .siempre small b { font-size: 15px; color: var(--ok); font-stretch: 80%; }
  .herr { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 0 0 14px; }
  .herr button { display: flex; align-items: center; justify-content: center; gap: 8px; border: 1px solid var(--line); border-radius: 14px; background: transparent; color: var(--text); padding: 11px 8px; font-weight: 650; font-size: 14.5px; }
  .rec button.mini, .ttort button.mini, .cantfila button.mini { border: 1px solid var(--line); background: var(--card2); color: var(--text); border-radius: 10px;
    width: 36px; height: 36px; font-weight: 800; font-size: 17px; display: inline-grid; place-items: center; padding: 0; flex: none; }
  .rec { display: flex; flex-direction: column; margin-bottom: 6px; max-height: 52vh; overflow-y: auto; }
  .ri { display: grid; grid-template-columns: 1fr auto; grid-template-areas: 'nm nm' 'm ctl'; align-items: center; gap: 6px 8px; padding: 10px 0; border-bottom: 1px solid var(--line); }
  .ri .nm { grid-area: nm; min-width: 0; display: flex; flex-direction: column; }
  .ri .ctl { grid-area: ctl; display: flex; align-items: center; gap: 6px; }
  .ri .mac2 { grid-area: m; color: var(--muted); font-size: 12.5px; }
  .ri .mac2 b { color: var(--text); }
  .ri .nm b { font-size: 14.5px; font-weight: 650; }
  .ri .nm small { color: var(--muted); font-size: 12px; }
  .ri .rol { display: inline-block; vertical-align: 2px; font-size: 11px; font-weight: 700; color: var(--pri); background: var(--pri-weak); border-radius: 999px; padding: 1px 7px; }
  .cant { width: 64px; text-align: center; border: 1px solid var(--line); border-radius: 10px; background: var(--card2); color: var(--text); padding: 7px 4px; font-size: 16px; font-weight: 700; }
  .u { color: var(--muted); font-size: 13px; min-width: 18px; }
  .rectot { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; margin: 12px 0 6px; font-weight: 650; }
  .rectot b { font-size: 24px; font-weight: 800; font-stretch: 80%; color: var(--ok); }
  .rectot span { flex-basis: 100%; color: var(--muted); font-weight: 500; font-size: 13.5px; }
  .cenas { display: flex; flex-direction: column; border-radius: 14px; background: var(--card2); padding: 4px 12px; }
  .cf { display: grid; grid-template-columns: 1.35fr .85fr 1.15fr .9fr; align-items: baseline; gap: 6px; padding: 9px 0; border-bottom: 1px solid var(--line); }
  .cf:last-child { border-bottom: 0; }
  .cf > span { font-size: 14.5px; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .cf.cab b, .cf.cab em { font-size: 12.5px; color: var(--muted); font-weight: 650; font-style: normal; }
  .cf b { font-size: 16px; font-weight: 750; font-stretch: 85%; }
  .cf em { font-style: normal; font-weight: 750; font-size: 14px; text-align: right; color: var(--muted); }
  .cf em.bien { color: var(--ok); } .cf em.mal { color: var(--acc); }
  .tpaso { font-size: 14px; font-weight: 700; margin: 14px 0 8px; }
  .tchips { display: flex; flex-wrap: wrap; gap: 8px; }
  .tch { border: 1px solid var(--line); border-radius: 999px; background: transparent; color: var(--text); padding: 8px 13px; font-size: 14.5px; font-weight: 600; }
  .tch.on { background: var(--ok); border-color: var(--ok); color: #0E0C14; }
  .ttort { display: inline-flex; align-items: center; gap: 6px; font-size: 14.5px; font-weight: 600; margin-left: 4px; }
  .tmios { display: flex; gap: 8px; overflow-x: auto; margin: 8px -18px 4px; padding: 0 18px 2px; scrollbar-width: none; }
  .tmios button { flex: none; display: flex; flex-direction: column; align-items: flex-start; border: 0; border-radius: 14px; background: var(--card2); color: var(--text); padding: 10px 12px; max-width: 220px; text-align: left; }
  .tmios b { font-size: 14px; } .tmios small { color: var(--muted); font-size: 12px; }
  .bfuentes { font-size: 12px; color: var(--muted); margin: -4px 2px 8px; }
  .blista { max-height: 56vh; overflow-y: auto; }
  .bres { display: block; width: 100%; text-align: left; border: 0; border-bottom: 1px solid var(--line); background: transparent; color: var(--text); padding: 10px 2px; }
  .bres .nm { display: flex; flex-direction: column; font-size: 15px; font-weight: 600; }
  .bres small { color: var(--muted); font-size: 12.5px; font-weight: 500; margin-top: 2px; }
  .bres small b { color: var(--ok); }
  .cantfila { display: flex; align-items: center; gap: 8px; margin: 12px 0 4px; }
  .cantfila .cant { width: 90px; font-size: 20px; }
  .camopts { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
  .camopts button { display: grid; grid-template-columns: 40px 1fr; grid-template-rows: auto auto; column-gap: 8px; text-align: left; border: 0; border-radius: 16px; background: var(--card2); color: var(--text); padding: 12px; }
  .camopts span { grid-row: span 2; font-size: 26px; align-self: center; }
  .camopts b { font-size: 15.5px; } .camopts small { color: var(--muted); font-size: 13px; }
  .galeria { display: flex; align-items: center; gap: 8px; margin: 12px 2px 0; font-size: 14px; color: var(--muted); }
  .galeria input { width: 18px; height: 18px; accent-color: var(--ok); }
  .pcs { display: grid; grid-template-columns: repeat(auto-fit, minmax(70px, 1fr)); gap: 8px; }
  .pc { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--muted); font-weight: 600; }
  .pc input { width: 100%; text-align: center; border: 1px solid var(--line); border-radius: 10px; background: var(--card2); color: var(--text); padding: 8px 4px; font-size: 16px; font-weight: 700; }
  .metas { display: flex; flex-direction: column; margin-top: 6px; }
  .mt { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; align-items: baseline; padding: 9px 0; border-bottom: 1px solid var(--line); }
  .mt b { font-size: 18px; font-weight: 750; font-stretch: 80%; }
  .campo { width: 100%; border: 1px solid var(--line); border-radius: 12px; background: var(--card2); color: var(--text); padding: 11px 12px; font-size: 16px; margin-bottom: 8px; }
  .eaten .mac { display: block; font-size: 11.5px; color: var(--muted); font-weight: 500; }
</style>`);

/* ----- Acciones de botones de Comida (antes eran código dentro del HTML) ----- */
function editarCena(id) { REC_ED = null; abrirReceta(id, true); }
function tupProt(p) { TUP.prot = p; pintarTupper(); }
function tupTam(t) { TUP.tam = t; pintarTupper(); }
function tupTortillas(d) { TUP.tort = Math.max(0, Math.min(8, TUP.tort + d)); pintarTupper(); }
function cantFija(q) { CANT.q = q; pintarCantidad(); }
function cantPaso(d) { CANT.q = d < 0 ? Math.max(0, CANT.q - (CANT.q > 100 ? 25 : 10)) : CANT.q + (CANT.q >= 100 ? 25 : 10); pintarCantidad(); }
const numeroEscrito = v => Number(String(v).replace(',', '.'));
function cantEscrita(v) { CANT.q = Math.max(0, numeroEscrito(v) || 0); pintarCantidad(); }
function fotoDeGaleria(v) { FOTO_GALERIA = !!v; }
function prodNumero(k, v) { if (['p', 'c', 'f', 'k', 'fib'].includes(k)) { PROD.al[k] = numeroEscrito(v) || 0; pintarProducto(); } }
function prodTexto(k, v) { if (k === 'n') PROD.al.n = String(v).slice(0, 60); else if (k === 'marca') PROD.al.marca = String(v).slice(0, 40); }
function prodPorcion(v) { const n = numeroEscrito(v); PROD.al.por = n > 0 ? [[PROD.porcionTxt || '1 porción', n]] : []; pintarProducto(); }
function prodRol(r) { PROD.al.rol = r; pintarProducto(); }
