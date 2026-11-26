/* ===================== COMIDA (2 de 3): buscar un alimento y decir cuánto comiste =====================
   Catálogo (México + USDA, se baja la primera vez que buscas), tus productos y Open Food Facts; el producto nuevo que va
   directo a la receta que estabas editando; y la hoja de "¿Cuánto comiste?". Va después de comida.js (index.html). */

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
  if (!BUS.elegir) PARA_RECETA = null;     // una búsqueda normal: nada va a la receta
  pintarBuscador();
  if (!$('modal').classList.contains('show')) abrirModal();
  setTimeout(() => { const i = $('busNut'); if (i) i.focus(); }, 60);
  cargarCatalogo().then(() => refrescarResultados()).catch(() => {});
}
// La hoja del buscador se pinta UNA vez; al escribir solo cambia la lista (#busRes). Antes cada tecla volvía a pintar
// toda la hoja, la caja de texto incluida: en Android se cortaba lo que el teclado estaba escribiendo y borrar se sentía raro.
function pintarBuscador() {
  const b = BUS;
  $('sheet').innerHTML = html`<div class="row between"><div class="t2">${b.elegir ? 'Elige el ingrediente' : 'Buscar alimento'}</div><button class="cerrar" ${on('cerrarBuscador')} aria-label="Cerrar">✕</button></div>` +
    html`<input id="busNut" class="buscar" type="search" autocomplete="off" placeholder="Ej. tortilla de maíz, queso panela, avena…" value="${b.q}" ${ev('input', 'buscarNut', VALOR)}>` +
    html`<div class="bfuentes" id="busFuentes">${textoFuentes()}</div>` +
    html`<div class="blista" id="busRes">${resultadosBuscador()}</div>` +
    (b.elegir ? html`<button class="btn ghost" style="width:100%;margin-top:10px" ${on('camaraParaReceta')}>📷 Foto de la etiqueta o código de tu producto</button>` : '');
}
function textoFuentes() { return CATALOGO ? (CATALOGO.length + NUT.BASE.length).toLocaleString('es-MX') + ' alimentos: tabla mexicana (INCMNSZ), USDA y los tuyos' : 'Cargando el catálogo…'; }
// La lista de alimentos se arma una vez por búsqueda abierta (no en cada tecla); se rehace al llegar el catálogo
function listaDelBuscador() {
  if (!BUS.lista || BUS.listaCat !== CATALOGO) { BUS.lista = listaBusqueda(); BUS.listaCat = CATALOGO; }
  return BUS.lista;
}
function resultadosBuscador() {
  const b = BUS, res = b.q.trim() ? NUT.buscar(listaDelBuscador(), b.q, 40) : nutCfg().productos.concat(Object.values(LS.get('gym_alim_usados', {}))).slice(-12).reverse();
  const fila = a => html`<button class="bres" ${on('elegirNut', a.id)}><span class="nm">${a.n}${a.marca ? ' · ' + a.marca : ''}` +
    html`<small>${fuenteTxt(a)} · por 100 ${a.u || 'g'}: <b>${NUT.r1(a.p)} g prot</b> · ${Math.round(a.k)} kcal${a.crudo ? ' · crudo' : ''}${a.seco ? html` · <span class="seco">⚠️ seco o en polvo</span>` : ''}</small></span></button>`;
  const offRes = b.off ? (b.off.length ? b.off.map(a => crudo(html`<button class="bres" ${on('elegirOFF', a.code)}><span class="nm">${a.n}${a.marca ? ' · ' + a.marca : ''}` +
    html`<small>Open Food Facts · por 100 ${a.u}: <b>${NUT.r1(a.p)} g prot</b> · ${Math.round(a.k || 0)} kcal</small></span></button>`)) : html`<div class="muted" style="margin:8px 2px">No encontré productos con ese nombre.</div>`) : '';
  return html`${res.length ? res.map(a => crudo(fila(a))) : b.q.trim() ? html`<div class="muted" style="margin:8px 2px">Nada en el catálogo con «${b.q}».</div>` : html`<div class="muted" style="margin:8px 2px">Escribe qué comiste. Lo que uses queda aquí para la próxima.</div>`}${
    b.q.trim() ? html`<button class="link" style="margin:8px 2px" ${on('buscarOFF')}>${b.cargando ? 'Buscando en Open Food Facts…' : '🛒 Buscar productos de marca (Open Food Facts)'}</button>${offRes}` : ''}`;
}
// Solo la lista (y el texto del catálogo): la caja de texto no se toca. Si la hoja ya es otra (la cantidad, un producto), nada
function refrescarResultados() {
  if (!BUS) return;
  const r = $('busRes'), f = $('busFuentes');
  if (!r || !$('busNut')) return;
  r.innerHTML = String(resultadosBuscador());
  if (f) f.textContent = textoFuentes();
}
/* ----- Un producto nuevo (foto, código u Open Food Facts) que va directo a la receta que estabas editando ----- */
let PARA_RECETA = null;     // { elegir, volver, ts }
function paraReceta() { return PARA_RECETA && Date.now() - PARA_RECETA.ts < 15 * 60e3 ? PARA_RECETA : null; }
function camaraParaReceta() { const b = BUS; BUS = null; abrirCamara(); PARA_RECETA = { elegir: b.elegir, volver: b.volver, ts: Date.now() }; }
function abrirCamaraSola() { PARA_RECETA = null; abrirCamara(); }
// Se guardó el producto: a la receta (con su porción como cantidad si es ingrediente nuevo)
function usarEnReceta(prod) {
  const p = paraReceta();
  PARA_RECETA = null;
  if (!p) return false;
  recordarAlimento(prod); p.elegir(prod, prod.por && prod.por[0] ? prod.por[0][1] : null);
  toast('Listo: ' + prod.n + ' ya está en la receta ✓');
  return true;
}
function fuenteTxt(a) { const s = a.src || String(a.id).split(':')[0]; return { b: 'Básico', usda: 'USDA', mx: 'Tabla mexicana', us: 'USDA', p: 'Tuyo', etiqueta: 'Tu etiqueta', off: 'Open Food Facts', calc: 'Calculado' }[s] || 'Catálogo'; }
let BUS_T = null;
function buscarNut(q) {
  if (!BUS) return;
  BUS.q = String(q || ''); BUS.off = null;
  clearTimeout(BUS_T);
  BUS_T = setTimeout(refrescarResultados, 70);   // cerraste el buscador antes: refrescarResultados no hace nada
}
function cerrarBuscador() { const o = BUS; BUS = null; if (o && o.volver) o.volver(); else cerrarModal(); }
function elegirNut(id) {
  const al = listaBusqueda().find(a => a.id === id);
  if (!al) return;
  // Desde la tarjeta de la IA no hay hoja abierta: se abre (antes se pintaba escondida y parecía que no hacía nada)
  const desdeIA = !$('modal').classList.contains('show');
  if (desdeIA) BUS = null;
  // La cantidad sale de lo que escribiste: en el buscador, la búsqueda; en la tarjeta de la IA, la parte del texto de ese alimento
  const seg = desdeIA && COMIDA_IA && COMIDA_IA.locales && COMIDA_IA.locales.seg ? COMIDA_IA.locales.seg[id] : null;
  pedirCantidad(al, desdeIA ? seg : BUS && BUS.q);
  if (desdeIA) { CANT.deIA = true; abrirModal(); }
}

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
  BUS.cargando = true; refrescarResultados();
  const campos = 'code,product_name,product_name_es,brands,nutriments,serving_size,serving_quantity,quantity,product_quantity_unit';
  const url = q => OFF + '/cgi/search.pl?search_simple=1&json=1&page_size=20&fields=' + campos + '&search_terms=' + encodeURIComponent(q);
  try {
    let j = await conLimite(fetch(url(BUS.q) + '&tagtype_0=countries&tag_contains_0=contains&tag_0=mexico').then(r => r.json()), 15000);
    if (!(j.products || []).length) j = await conLimite(fetch(url(BUS.q)).then(r => r.json()), 15000);
    BUS.off = (j.products || []).map(deOFF).filter(Boolean);
    BUS.off.forEach(a => { OFF_CACHE[a.code] = a; });
  } catch (e) { BUS.off = []; toast('Open Food Facts no respondió: ' + (e.message === 'tiempo' ? 'tardó demasiado' : 'sin conexión')); }
  if (BUS) { BUS.cargando = false; refrescarResultados(); }
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
function elegirOFF(code) {
  const a = OFF_CACHE[code];
  if (!a) return;
  PARA_RECETA = BUS && BUS.elegir ? { elegir: BUS.elegir, volver: BUS.volver, ts: Date.now() } : null;   // desde la receta: regresa a ella
  confirmarProducto(a, a.avisos || []);
}

/* ----- ¿Cuánto comiste? (porciones del alimento o gramos) ----- */
let CANT = null;
// texto: lo que escribiste ("4 rebanadas de pizza"): si dice cuánto, la cantidad ya sale calculada
function pedirCantidad(al, texto) {
  const elegir = BUS && BUS.elegir, dijo = texto ? NUT.cantidadDeTexto(texto, al) : null;
  CANT = { al: al, q: dijo ? dijo.q : al.por && al.por[0] ? al.por[0][1] : 100, elegir: elegir, bus: BUS, dijo: dijo,
           // "1 mantecada" en un producto que no dice cuánto pesa una pieza: se queda en 100 g y hay que avisarlo
           sinPeso: !dijo && !(al.por && al.por.length) && NUT.diceCuantas(texto) ? String(texto).trim().slice(0, 40) : '' };
  pintarCantidad();
}
function pintarCantidad() {
  const c = CANT, al = c.al, m = NUT.macros(al, c.q);
  $('sheet').innerHTML = html`<div class="row between"><div class="t2" style="padding-right:8px">${al.n}</div><button class="cerrar" ${on('cerrarCantidad')} aria-label="Volver">✕</button></div>` +
    html`<div class="muted" style="margin:2px 0 10px">${fuenteTxt(al)}${al.crudo ? ' · valores del alimento crudo: pésalo antes de cocinar' : ''}${al.nota ? ' · ' + al.nota : ''}</div>` +
    (al.seco ? html`<div class="tip acc" style="margin:0 0 10px">⚠️ Esta ficha es de alimento seco o en polvo (${NUT.r1(al.p)} g de proteína por 100 g). Si lo comiste preparado (frijoles de la olla, leche líquida…), busca el preparado.</div>` : '') +
    html`<div id="cantAvisos">${avisosHtml(NUT.revisarMacros(m, c.q, al.n))}</div>` +
    (c.dijo && c.q === c.dijo.q ? html`<div class="tip" style="margin:0 0 10px">Escribiste ${c.dijo.texto} = <b class="num">${NUT.r1(c.q)} ${al.u || 'g'}</b>. Si fue otra cantidad, cámbiala.</div>` : '') +
    (c.sinPeso && c.q === 100 ? html`<div class="tip acc" style="margin:0 0 10px"><span>⚠️ Escribiste «${c.sinPeso}», pero este producto no dice cuánto pesa una pieza: aquí van <b>100 ${al.u || 'g'}</b>. Pon los gramos de la etiqueta (la porción entre las piezas que trae).</span></div>` : '') +
    (al.por && al.por.length ? html`<div class="tchips">${al.por.concat(al.por.filter(p => p[0] === 'Todo el envase').map(p => ['La mitad del envase', NUT.r1(p[1] / 2)])).map(p => html`<button class="tch${c.q === p[1] ? ' on' : ''}" ${on('cantFija', p[1])}>${p[0]} · ${p[1]} ${al.u || 'g'}</button>`)}</div>` : '') +
    html`<div class="cantfila"><button class="mini" ${on('cantPaso', -1)} aria-label="Menos">−</button>` +
    html`<input class="cant num" inputmode="decimal" value="${c.q}" ${ev('change', 'cantEscrita', VALOR)} aria-label="Cantidad"><span class="u">${al.u || 'g'}</span>` +
    html`<button class="mini" ${on('cantPaso', 1)} aria-label="Más">+</button></div>` +
    html`<div class="rectot"><b class="num">${NUT.r1(m.p)} g</b> proteína<span>${fmtM(m, true)}</span></div>` +
    html`<div class="acts"><button class="btn" ${on('usarCantidad')}>${c.elegir ? 'Usar en la receta' : 'Agregar a ' + nombreDeComida(comidaActual()).toLowerCase()}</button></div>`;
}
const avisosHtml = av => av.length ? html`<div class="tip acc" style="margin:0 0 10px">⚠️ ${av.map((a, i) => html`${i ? html`<br>⚠️ ` : ''}${a}`)}</div>` : '';
function cerrarCantidad() { const b = CANT && CANT.bus; CANT = null; if (b) { BUS = b; pintarBuscador(); } else cerrarModal(); }
function usarCantidad() {
  const c = CANT; CANT = null;
  if (c.elegir) { BUS = null; return c.elegir(c.al, c.q); }
  recordarAlimento(c.al);
  const m = NUT.macros(c.al, c.q), n = c.al.n + ' · ' + NUT.r1(c.q) + ' ' + (c.al.u || 'g');
  agregarAProt([nuevoRegistro(Object.assign({ n: n.slice(0, 60), q: c.q, u: c.al.u || 'g', src: c.al.src || String(c.al.id).split(':')[0], ref: c.al.id }, m))], [comidaActual()]);
  // Si lo elegiste mientras la IA pensaba: ya no hace falta su respuesta
  if (c.deIA) { COMIDA_IA = null; COMIDA_SEQ++; }
  contarUso(c.al.id); BUS = null; cerrarModal(); hap('ok'); cambiarProt(); toast('+' + NUT.r1(m.p) + ' g · ' + Math.round(m.k) + ' kcal ✓');
}

// Botones de la cantidad
function cantFija(q) { CANT.q = q; pintarCantidad(); }
function cantPaso(d) { CANT.q = d < 0 ? Math.max(0, CANT.q - (CANT.q > 100 ? 25 : 10)) : CANT.q + (CANT.q >= 100 ? 25 : 10); pintarCantidad(); }
function cantEscrita(v) { CANT.q = Math.max(0, numeroEscrito(v) || 0); pintarCantidad(); }
