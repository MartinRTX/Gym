/* ===================== COMIDA (3 de 3): cámara, etiqueta y producto nuevo =====================
   Etiqueta nutricional (Gemini lee la tabla; aquí se hacen las cuentas), foto de la comida o el tupper (Gemini estima),
   código de barras, escribir la etiqueta a mano y "Revisa el producto". Va después de comida-buscar.js (index.html). */

/* ----- Cámara: etiqueta nutricional (Gemini lee la tabla), foto de la comida o el tupper (Gemini estima) y código de barras ----- */
let FOTO = null, FOTO_GALERIA = false;
function abrirCamara(tipo) {
  FOTO = { tipo: tipo || null };
  if (tipo) return pedirFoto(tipo);
  $('sheet').innerHTML = html`<div class="row between"><div class="t2">Foto o código</div><button class="cerrar" ${on('cerrarModal')} aria-label="Cerrar">✕</button></div>` +
    html`<div class="camopts">` +
    html`<button ${on('pedirFoto', 'etiqueta')}><span>🏷️</span><b>Tabla nutricional</b><small>Leche, proteína o cualquier empaque: lee los macros solo</small></button>` +
    html`<button ${on('pedirFoto', 'tupper')}><span>🍱</span><b>Mi comida o el tupper</b><small>Cuando no sabes qué guisado es ni cuánto pesa</small></button>` +
    html`<button ${on('pedirFoto', 'codigo')}><span>🔢</span><b>Código de barras</b><small>Lo busca en Open Food Facts</small></button>` +
    html`<button ${on('etiquetaAMano')}><span>✍️</span><b>Escribir los datos</b><small>Cuando la foto no se lee: los números de la etiqueta a mano</small></button></div>` +
    html`<label class="galeria"><input type="checkbox" id="deGaleria"${FOTO_GALERIA ? ' checked' : ''} ${ev('change', 'fotoDeGaleria', MARCADO)}> Elegir una foto que ya tomé (galería)</label>` +
    html`<div class="row" style="gap:8px;margin-top:10px"><input id="codManual" class="campo" style="margin:0;flex:1" inputmode="numeric" placeholder="O escribe el número del código">` +
    html`<button class="btn" ${on('codigoManual')}>Buscar</button></div>`;
  if (!$('modal').classList.contains('show')) abrirModal();
}
function pedirFoto(tipo) {
  FOTO = { tipo: tipo };
  if ((tipo === 'nota' || tipo === 'otraEtiqueta') && !scriptEtiqueta()) { cerrarModal(); return toast('Actualiza tu script a la 8.2 para mandar foto con nota'); }
  if ((tipo === 'etiqueta' || tipo === 'tupper' || tipo === 'nota' || tipo === 'otraEtiqueta') && !scriptNut()) { cerrarModal(); return toast('Actualiza tu script a la 7.7 para leer fotos con la IA'); }
  if ((tipo === 'etiqueta' || tipo === 'tupper' || tipo === 'nota' || tipo === 'otraEtiqueta') && !DATA.ia) { cerrarModal(); return toast('La IA no está activada en tu hoja'); }
  let inp = $('fotoNut');
  if (!inp) {
    inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.id = 'fotoNut'; inp.style.display = 'none';
    inp.addEventListener('change', () => { const fs = Array.from(inp.files || []).slice(0, 3); inp.value = ''; if (fs.length) procesarFotoNut(fs); });
    document.body.appendChild(inp);
  }
  // Con "capture" el celular abre la cámara directo; sin él, deja elegir de la galería
  // Con nota (desde el Registro inteligente) deja escoger: cámara o una foto/captura que ya tienes
  if (FOTO_GALERIA || tipo === 'nota') inp.removeAttribute('capture'); else inp.setAttribute('capture', 'environment');
  // Con nota se pueden escoger hasta 3 fotos del mismo empaque (un galón por varios lados)
  inp.multiple = tipo === 'nota';
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
  $('sheet').innerHTML = html`<div class="t2">${txt}</div><div class="esq" style="position:relative;height:120px;margin-top:12px;border-radius:16px"><div class="brillo"></div><span>Un momento…</span></div>`;
  if (!$('modal').classList.contains('show')) abrirModal();
}
async function procesarFotoNut(files) {
  const tipo = FOTO.tipo, file = Array.isArray(files) ? files[0] : files, todas = Array.isArray(files) ? files : [files];
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
    cargandoFoto(tipo === 'etiqueta' || tipo === 'otraEtiqueta' ? 'Leyendo la etiqueta…' : tipo === 'nota' ? 'Leyendo tu foto…' : 'Viendo tu comida…');
    const f = await achicarFoto(file, 1280);
    if (tipo === 'nota' || tipo === 'otraEtiqueta') {
      const fotos = [f.b64];
      for (const x of todas.slice(1)) fotos.push((await achicarFoto(x, 1280)).b64);
      // Otra foto de la misma etiqueta: se manda junto con las anteriores
      const antes = tipo === 'otraEtiqueta' && FOTO.antes ? FOTO.antes : [];
      const lote = antes.concat(fotos).slice(-3);
      const r = await conLimite(apiPost(tipo === 'otraEtiqueta' ? 'etiquetaIA' : 'fotoIA', [lote.length > 1 ? lote : lote[0], 'image/jpeg', { nota: FOTO.nota || '', contexto: { meta: metaProt(), llevas: protTotal() } }]), 70000);
      if (r.tipo === 'etiqueta' || (tipo === 'otraEtiqueta' && r.es_etiqueta)) return abrirEtiqueta(r, FOTO.desdeIA !== false, lote, FOTO.nota || '');
      if (tipo === 'otraEtiqueta') { cerrarModal(); return toast('No vi la tabla en esas fotos: intenta de frente y con luz'); }
      COMIDA_IA = { texto: FOTO.nota || '', items: (r.items || []).map(x => Object.assign(x, { on: true })), consejo: r.consejo, deFoto: true };
      cerrarModal(); verTab('Comida');
      setTimeout(() => { const c = document.querySelector('.iacard'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 80);
      return;
    }
    if (tipo === 'etiqueta' && scriptEtiqueta()) {
      const r = await conLimite(apiPost('etiquetaIA', [f.b64, 'image/jpeg', {}]), 60000);
      if (r.es_etiqueta === false) { cerrarModal(); return toast('No vi una tabla nutrimental en la foto: tómala de frente y con buena luz'); }
      return abrirEtiqueta(r, false, [f.b64], '');
    }
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

/* ----- Etiqueta + lo que dijiste (script 8.2). La IA solo copió la tabla y tu nota; aquí se hacen las cuentas.
   Revisas, cambias la cantidad (g/ml, piezas, porciones o parte del envase) y los macros se recalculan al instante.
   Si ya tienes ese producto, se actualiza en vez de duplicarse. ----- */
let ETQ = null;
const scriptEtiqueta = () => !!(DATA && DATA.scriptVersion && versionNum(DATA.scriptVersion) >= versionNum('8.2'));
function abrirEtiqueta(r, desdeIA, fotos, nota) {
  const e = NUT.leerEtiqueta(Object.assign({}, r, { src: 'etiqueta' }));
  if (e.error) { cerrarModal(); return toast(e.error + '. Tómala de frente y con buena luz'); }
  if (r.code) e.al.code = String(r.code);
  const c = NUT.gramosDeConsumo(r.consumo, e.info);
  const prev = nutCfg().productos.find(x => NUT.mismoProducto(e.al, x));
  // Solo leche o proteína EN POLVO se proponen para el licuado (una barra o un yogurt "con proteína" no)
  if (!e.al.rol) e.al.rol = /^leche|\bmilk\b/i.test(e.al.n) ? 'leche' : /whey|isolat|en polvo|\bpolvo\b/i.test(e.al.n) || e.al.p > 60 ? 'proteina' : '';
  ETQ = { al: e.al, info: e.info, avisos: e.avisos.concat(r.avisos || []), modo: c.modo, valor: c.valor, falta: c.falta || null,
          prev: prev ? prev.id : null, actualizar: !!prev, desdeIA: !!desdeIA, fotos: fotos || [], nota: nota || '' };
  pintarEtiqueta();
  if (!$('modal').classList.contains('show')) abrirModal();
}
const etqGramos = () => NUT.gramosDe(ETQ.modo, ETQ.valor, ETQ.info);
const ETQ_UNIDAD = { piezas: 'piezas', porciones: 'porciones', envase: 'del envase' };
const ETQ_PASO = { g: 5, piezas: 1, porciones: 0.5, envase: 0.25 };
function etqTotalHtml() {
  const g = etqGramos(), u = ETQ.info.u;
  if (g === null || !(g > 0)) return html`<span class="muted">${g === null ? 'Falta saber cuánto trae el envase (arriba)' : 'Pon cuánto comiste'}</span>`;
  const m = NUT.macros(ETQ.al, g);
  return html`<b class="num">${NUT.r1(m.p)} g</b> proteína<span>${NUT.r1(g)} ${u} · ${fmtM(m, true)}</span>`;
}
function pintarEtiqueta() {
  const E = ETQ, a = E.al, i = E.info, u = i.u, prev = E.prev && nutCfg().productos.find(x => x.id === E.prev);
  const decl = (i.declarada === 'porcion' ? 'La tabla venía por porción' + (i.porcionG ? ' (' + i.porcionG + ' ' + u + ')' : '') + ': ya la pasé a 100 ' + u + '.'
    : i.declarada === 'ambas' ? 'La tabla traía por 100 ' + u + ' y por porción' + (i.porcionG ? ' (' + i.porcionG + ' ' + u + ')' : '') + '.' : 'La tabla venía por 100 ' + u + '.') +
    (i.pieza ? ' 1 porción = ' + i.piezas + ' piezas, así que 1 pieza = ' + i.pieza + ' ' + u + '.' : '') +
    (i.envase ? ' Envase: ' + i.envase + ' ' + u + ({ neto: ' (contenido neto)', porciones: ' (porciones por envase × porción)', columna: ' (columna "por envase")', kcal: ' (sacado de la columna "por envase")', mano: ' (lo pusiste tú)' }[i.envaseDe] || '') + '.' : '');
  const modos = [['g', u], ['piezas', 'Piezas'], ['porciones', 'Porciones'], ['envase', 'Del envase']].filter(m => m[0] !== 'piezas' || i.pieza).filter(m => m[0] !== 'porciones' || i.porcionG);
  const campo = (k, nom) => html`<label class="pc"><span>${nom}</span><input class="num" inputmode="decimal" value="${a[k] === null || a[k] === undefined ? '' : a[k]}" ${ev('change', 'etqNumero', k, VALOR)}></label>`;
  const g = etqGramos();
  $('sheet').innerHTML = html`<div class="row between"><div class="t2">Revisa antes de agregar</div><button class="cerrar" ${on('cerrarModal')} aria-label="Cerrar">✕</button></div>` +
    (E.avisos.length ? html`<div class="tip acc" style="margin:8px 0">⚠️ ${E.avisos.map((x, k) => html`${k ? html`<br>⚠️ ` : ''}${x}`)}</div>` : '') +
    (E.falta === 'pieza' ? html`<div class="tip acc" style="margin:8px 0">La tabla no dice cuántas piezas son una porción: pon los gramos o las porciones.</div>` : '') +
    html`<input class="campo" value="${a.n}" ${ev('change', 'etqTexto', 'n', VALOR)} aria-label="Nombre">` +
    html`<input class="campo" value="${a.marca || ''}" placeholder="Marca" ${ev('change', 'etqTexto', 'marca', VALOR)} aria-label="Marca">` +
    html`<div class="muted etqdecl">${decl}</div>` +
    (E.fotos.length && E.fotos.length < 3 ? html`<button class="link" style="margin:0 2px 6px" ${on('otraFotoEtiqueta')}>📷 Agregar otra foto de la misma etiqueta (${E.fotos.length} de 3)</button>` : '') +
    (prev ? html`<div class="tpaso">Ya tienes «${prev.n}» en tus productos</div><div class="tchips">` +
      html`<button class="tch${E.actualizar ? ' on' : ''}" ${on('etqActualizar', true)}>Actualizar el que tengo</button>` +
      html`<button class="tch${!E.actualizar ? ' on' : ''}" ${on('etqActualizar', false)}>Guardar como otro</button></div>` : '') +
    html`<div class="tpaso">¿Cuánto comiste?</div><div class="seg etqmodos">${modos.map(m => html`<button class="${E.modo === m[0] ? 'on' : ''}" ${on('etqModo', m[0])}>${m[1]}</button>`)}</div>` +
    (E.modo === 'envase' ? html`<div class="tchips" style="margin-top:8px">${[['Todo', 1], ['La mitad', 0.5], ['Un tercio', 0.333], ['Un cuarto', 0.25]]
      .map(x => html`<button class="tch${Math.abs(E.valor - Number(x[1])) < 0.01 ? ' on' : ''}" ${on('etqFraccion', x[1])}>${x[0]}</button>`)}</div>` +
      (!i.envase ? html`<div class="tip acc" style="margin:8px 0 4px">La tabla no dice cuánto trae el envase. Escríbelo (viene al frente: "Contenido neto"):</div>` +
        html`<div class="row etqenv"><input id="etqEnvG" class="cant num" inputmode="decimal" placeholder="—" ${ev('change', 'etqEnvase', 'g', VALOR)}><span class="muted">${u}</span>${
        i.porcionG ? html`<span class="muted">o</span><input id="etqEnvP" class="cant num" inputmode="decimal" placeholder="—" ${ev('change', 'etqEnvase', 'porciones', VALOR)}><span class="muted">porciones</span>` : ''}</div>` : '') : '') +
    html`<div class="cantfila"><button class="mini" ${on('etqPaso', -1)} aria-label="Menos">−</button>` +
    html`<input id="etqValor" class="cant num" inputmode="decimal" value="${NUT.r1(E.valor)}" ${ev('input', 'etqValor', VALOR)} aria-label="Cantidad">` +
    html`<span class="u">${ETQ_UNIDAD[E.modo] || u}</span><button class="mini" ${on('etqPaso', 1)} aria-label="Más">+</button></div>` +
    html`<div class="rectot" id="etqTot">${etqTotalHtml()}</div>` +
    html`<details class="etqdet"><summary>Valores por 100 ${u} (corrige si algo se leyó mal)</summary><div class="pcs">` +
      html`${campo('p', 'Proteína')}${campo('c', 'Carbos')}${campo('f', 'Grasa')}${campo('k', 'kcal')}${campo('fib', 'Fibra')}</div></details>` +
    html`<div class="tpaso">¿Es de tu licuado?</div><div class="tchips">` +
      html`${[['leche', '🥛 Mi leche de siempre'], ['proteina', '💪 Mi proteína de siempre'], ['', 'No']].map(r => html`<button class="tch${a.rol === r[0] ? ' on' : ''}" ${on('etqRol', r[0])}>${r[1]}</button>`)}</div>` +
    (paraReceta() ? html`<div class="acts"><button class="btn" ${on('etqGuardar', false)}>Guardar y usar en la receta</button></div>`
      : html`<div class="acts"><button class="btn ghost" ${on('etqGuardar', false)}>Solo guardar</button><button class="btn" id="etqAgregar"${g > 0 ? '' : ' disabled'} ${on('etqGuardar', true)}>Agregar</button></div>`);
}
// Escribir la cantidad recalcula al instante sin repintar (no se cierra el teclado)
function etqValor(v) {
  ETQ.valor = numeroEscrito(v) || 0;
  $('etqTot').innerHTML = etqTotalHtml();
  const g = etqGramos(), b = $('etqAgregar'); if (b) b.disabled = !(g > 0);
}
function etqPaso(d) { const p = ETQ_PASO[ETQ.modo] || 1; ETQ.valor = Math.max(0, Math.round((ETQ.valor + d * p) * 1000) / 1000); hap('tecla'); pintarEtiqueta(); }
// Cambiar de forma de contar conserva lo que ya llevabas (60 g → 6 piezas)
function etqModo(m) {
  const g = etqGramos(), i = ETQ.info;
  const por = { g: 1, piezas: i.pieza, porciones: i.porcionG, envase: i.envase }[m];
  ETQ.modo = m;
  ETQ.valor = g > 0 && por ? Math.round(g / por * (m === 'envase' ? 100 : 10)) / (m === 'envase' ? 100 : 10) : m === 'g' ? (i.porcionG || 100) : 1;
  pintarEtiqueta();
}
function etqFraccion(v) { ETQ.modo = 'envase'; ETQ.valor = v; pintarEtiqueta(); }
function etqEnvase(tipo, v) {
  const n = numeroEscrito(v), i = ETQ.info;
  if (!(n > 0)) return;
  i.envase = NUT.r1(tipo === 'porciones' ? n * i.porcionG : n); i.envaseDe = 'mano';
  ETQ.al.por = ETQ.al.por.filter(x => x[0] !== 'Todo el envase').concat([['Todo el envase', i.envase]]);
  pintarEtiqueta();
}
function etqNumero(k, v) { if (['p', 'c', 'f', 'k', 'fib'].includes(k)) { ETQ.al[k] = numeroEscrito(v) || 0; pintarEtiqueta(); } }
function etqTexto(k, v) { if (k === 'n') ETQ.al.n = String(v).slice(0, 60); else if (k === 'marca') ETQ.al.marca = String(v).slice(0, 40); }
function etqActualizar(b) { ETQ.actualizar = !!b; pintarEtiqueta(); }
function etqRol(r) { ETQ.al.rol = r; pintarEtiqueta(); }
function etqGuardar(agregar) {
  const E = ETQ, a = E.al, c = nutCfg(), g = etqGramos();
  if (!(a.p >= 0) || !(a.k >= 0)) return toast('Revisa la proteína y las calorías');
  if (agregar && !(g > 0)) return toast(g === null ? 'Escribe cuánto trae el envase' : 'Pon cuánto comiste');
  const id = E.actualizar && E.prev ? E.prev : 'p:' + uid();
  const prod = { id: id, n: a.n, marca: a.marca || '', u: a.u || 'g', p: NUT.r1(a.p), c: NUT.r1(a.c), f: NUT.r1(a.f), k: Math.round(a.k), fib: NUT.r1(a.fib || 0),
                 por: a.por || [], src: 'etiqueta', code: a.code || '', ts: Date.now() };
  c.productos = c.productos.filter(x => x.id !== id).concat([prod]); c.productos = NUT.recortarProductos(c);
  if (a.rol === 'leche' || a.rol === 'proteina') NUT.cambiarRol(c.recetas, a.rol, id, a.rol === 'proteina' && prod.por[0] ? prod.por[0][1] : null);
  guardarNut(c);
  ETQ = null;
  if (usarEnReceta(prod)) { hap('ok'); pintarComida(); actualizarWidgets(); return; }
  if (agregar) {
    const m = NUT.macros(prod, g), n = prod.n + ' · ' + NUT.r1(g) + ' ' + prod.u;
    agregarAProt([nuevoRegistro(Object.assign({ n: n.slice(0, 60), q: g, u: prod.u, src: 'etiqueta', ref: id }, m))], [comidaActual()]);
    contarUso(id);
    if (E.desdeIA) { COMIDA_IA = null; COMIDA_SEQ++; }
    cerrarModal(); hap('ok'); cambiarProt(); toast('+' + NUT.r1(m.p) + ' g · ' + Math.round(m.k) + ' kcal ✓' + (E.actualizar && E.prev ? ' · producto actualizado' : ''));
  } else { cerrarModal(); hap('ok'); toast(E.actualizar && E.prev ? 'Producto actualizado ✓' : 'Guardado en tus productos ✓'); }
  pintarComida(); actualizarWidgets();
}
// La etiqueta no se leyó completa (un galón curvo, la tabla de lado): otra foto y se leen todas juntas
function otraFotoEtiqueta() {
  const E = ETQ;
  pedirFoto('otraEtiqueta'); FOTO.antes = E.fotos.slice(); FOTO.nota = E.nota; FOTO.desdeIA = E.desdeIA;
}
// Escribir los datos de la etiqueta a mano (cuando la foto no sirve): lo de 1 porción y se calcula igual que con la foto
let ETQ_MANO = null;
function etiquetaAMano() {
  ETQ_MANO = ETQ_MANO || { nombre: '', u: 'g', cant: '', piezas: '', porciones: '', p: '', c: '', f: '', k: '' };
  const M = ETQ_MANO, campo = (k, nom, ph) => html`<label class="pc"><span>${nom}</span><input class="num" inputmode="decimal" placeholder="${ph || ''}" value="${M[k]}" ${ev('change', 'manoCampo', k, VALOR)}></label>`;
  $('sheet').innerHTML = html`<div class="row between"><div class="t2">Datos de la etiqueta</div><button class="cerrar" ${on('cerrarModal')} aria-label="Cerrar">✕</button></div>` +
    html`<input class="campo" placeholder="Nombre (ej. Leche Lala entera)" value="${M.nombre}" ${ev('change', 'manoCampo', 'nombre', VALOR)}>` +
    html`<div class="tchips">${[['g', 'Sólido (g)'], ['ml', 'Líquido (ml)']].map(x => html`<button class="tch${M.u === x[0] ? ' on' : ''}" ${on('manoCampo', 'u', x[0])}>${x[1]}</button>`)}</div>` +
    html`<div class="tpaso">1 porción</div><div class="pcs">${campo('cant', 'Porción (' + M.u + ')', '250')}${campo('piezas', 'Piezas', '—')}${campo('porciones', 'Porciones por envase', '—')}</div>` +
    html`<div class="tpaso">En esa porción</div><div class="pcs">${campo('p', 'Proteína')}${campo('c', 'Carbos')}${campo('f', 'Grasa')}${campo('k', 'kcal')}</div>` +
    html`<div class="muted" style="font-size:12.5px;margin-top:6px">Si la etiqueta da "por 100 ${M.u}", pon 100 en la porción. Un galón son 3,785 ml.</div>` +
    html`<div class="acts"><button class="btn" ${on('manoListo')}>Continuar</button></div>`;
  if (!$('modal').classList.contains('show')) abrirModal();
}
function manoCampo(k, v) { if (k === 'nombre' || k === 'u') ETQ_MANO[k] = String(v).slice(0, 60); else ETQ_MANO[k] = v; if (k === 'u') etiquetaAMano(); }
function manoListo() {
  const M = ETQ_MANO, n = k => { const x = numeroEscrito(M[k]); return x > 0 ? x : null; };
  if (!n('cant')) return toast('Pon de cuánto es la porción');
  if (n('p') === null && n('k') === null) return toast('Pon al menos la proteína o las kcal');
  ETQ_MANO = null;
  abrirEtiqueta({ es_etiqueta: true, nombre: M.nombre || 'Producto', u: M.u, declarada: 'porcion', por100: null,
    porcion: { texto: n('piezas') ? n('piezas') + ' piezas' : '1 porción', cant: n('cant'), piezas: n('piezas'), p: n('p') || 0, c: n('c') || 0, f: n('f') || 0, k: n('k'), fib: 0 },
    porciones_envase: n('porciones'), consumo: null }, false);
}
// ¿Lo que escribiste es el texto de una tabla nutrimental? (varias palabras de tabla y números)
function pareceEtiqueta(t) {
  const pal = new Set((String(t).toLowerCase().match(/kcal|kj|energ[ií]a|contenido energ|prote[ií]nas?|grasas? (?:totales|saturadas)|carbohidratos|hidratos de carbono|porci[oó]n|sodio|az[uú]cares/g) || []).map(x => x.slice(0, 5)));
  return pal.size >= 3 && (String(t).match(/\d+(?:[.,]\d+)?/g) || []).length >= 4;
}
// 📷 en el Registro inteligente: la foto (etiqueta o comida) va junto con lo que escribiste
function fotoConNota() {
  const t = ($('iaComida') || {}).value || (COMIDA_IA && COMIDA_IA.texto) || '';
  (COMIDA_IA = COMIDA_IA || /** @type {any} */ ({})).texto = t;
  pedirFoto('nota'); FOTO.nota = t;
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
  const a = PROD.al, u = a.u || 'g', por = a.por && a.por[0], pieza = a.por && a.por[1] && /^1 /.test(a.por[1][0]) ? a.por[1] : null;
  const campo = (k, nom) => html`<label class="pc"><span>${nom}</span><input class="num" inputmode="decimal" value="${a[k] === null || a[k] === undefined ? '' : a[k]}" ${ev('change', 'prodNumero', k, VALOR)}></label>`;
  const pm = por ? NUT.macros(a, por[1]) : null;
  $('sheet').innerHTML = html`<div class="row between"><div class="t2">Revisa el producto</div><button class="cerrar" ${on('cerrarModal')} aria-label="Cerrar">✕</button></div>` +
    (PROD.avisos.length ? html`<div class="tip acc" style="margin:8px 0">⚠️ ${PROD.avisos.map((x, k) => html`${k ? html`<br>⚠️ ` : ''}${x}`)}</div>` : '') +
    html`<input class="campo" value="${a.n}" ${ev('change', 'prodTexto', 'n', VALOR)} aria-label="Nombre">` +
    html`<input class="campo" value="${a.marca || ''}" placeholder="Marca" ${ev('change', 'prodTexto', 'marca', VALOR)} aria-label="Marca">` +
    html`<div class="muted" style="margin:2px 0 6px">Por 100 ${u} (si la etiqueta solo traía la porción, ya se convirtió):</div>` +
    html`<div class="pcs">${campo('p', 'Proteína')}${campo('c', 'Carbos')}${campo('f', 'Grasa')}${campo('k', 'kcal')}${campo('fib', 'Fibra')}</div>` +
    html`<div class="row" style="gap:8px;align-items:center;margin:10px 0"><span class="muted">1 porción =</span><input class="cant num" style="width:80px" inputmode="decimal" value="${por ? por[1] : ''}" placeholder="—" ` +
      html`${ev('change', 'prodPorcion', VALOR)}><span class="muted">${u}${pm ? html` → <b style="color:var(--text)">${NUT.r1(pm.p)} g prot</b> · ${Math.round(pm.k)} kcal` : ''}</span></div>` +
    (pieza ? html`<div class="tip" style="margin:0 0 10px"><span>La porción de la etiqueta es <b>${por[0]}</b>: <b>${pieza[0]} = ${pieza[1]} ${u}</b> → ${Math.round(NUT.macros(a, pieza[1]).k)} kcal.</span></div>` : '') +
    html`<div class="tpaso">¿Es de tu licuado?</div><div class="tchips">` +
      html`${[['leche', '🥛 Mi leche de siempre'], ['proteina', '💪 Mi proteína de siempre'], ['', 'No']].map(r => html`<button class="tch${a.rol === r[0] ? ' on' : ''}" ${on('prodRol', r[0])}>${r[1]}</button>`)}</div>` +
    (a.rol === 'proteina' && !por ? html`<div class="muted" style="font-size:12.5px">Pon cuánto pesa 1 scoop para que tu licuado use uno.</div>` : '') +
    (paraReceta() ? html`<div class="acts"><button class="btn" ${on('guardarProducto', false)}>Guardar y usar en la receta</button></div>`
      : html`<div class="acts"><button class="btn ghost" ${on('guardarProducto', false)}>Guardar</button><button class="btn" ${on('guardarProducto', true)}>Guardar y agregar${pieza ? ' ' + pieza[0] : por ? ' 1 porción' : ''}</button></div>`);
}
function guardarProducto(agregar) {
  const a = PROD.al, c = nutCfg();
  if (!(a.p >= 0) || !(a.k >= 0)) return toast('Revisa la proteína y las calorías');
  const prev = c.productos.find(p => (a.code && p.code === a.code) || p.n.toLowerCase() === a.n.toLowerCase());
  const id = prev ? prev.id : 'p:' + uid();
  const prod = { id: id, n: a.n, marca: a.marca || '', u: a.u || 'g', p: NUT.r1(a.p), c: NUT.r1(a.c), f: NUT.r1(a.f), k: Math.round(a.k), fib: NUT.r1(a.fib || 0),
                 por: a.por || [], src: a.src || 'etiqueta', code: a.code || '', ts: Date.now() };
  c.productos = c.productos.filter(p => p.id !== id).concat([prod]); c.productos = NUT.recortarProductos(c);
  let msg = 'Guardado en tus productos';
  if (a.rol === 'leche' || a.rol === 'proteina') {
    const n = NUT.cambiarRol(c.recetas, a.rol, id, a.rol === 'proteina' && prod.por[0] ? prod.por[0][1] : null);
    if (n) msg = (a.rol === 'leche' ? 'Tu licuado ya usa esta leche' : 'Tu licuado ya usa esta proteína') + ' ✓';
  }
  guardarNut(c);
  PROD = null; hap('ok');
  if (usarEnReceta(prod)) { pintarComida(); actualizarWidgets(); return; }
  cerrarModal();
  // Si la porción es de varias piezas, se agrega UNA (en la siguiente pantalla se cambia si comiste más)
  if (agregar) { const q = prod.por[1] && /^1 /.test(prod.por[1][0]) ? prod.por[1][1] : prod.por[0] ? prod.por[0][1] : 100; BUS = null; pedirCantidadDirecta(prod, q); }
  toast(msg); pintarComida(); actualizarWidgets();
}
function pedirCantidadDirecta(al, q) { CANT = { al: al, q: q, elegir: null, bus: null }; pintarCantidad(); abrirModal(); }

// Botones de la cámara y del producto
function fotoDeGaleria(v) { FOTO_GALERIA = !!v; }
function prodNumero(k, v) { if (['p', 'c', 'f', 'k', 'fib'].includes(k)) { PROD.al[k] = numeroEscrito(v) || 0; pintarProducto(); } }
function prodTexto(k, v) { if (k === 'n') PROD.al.n = String(v).slice(0, 60); else if (k === 'marca') PROD.al.marca = String(v).slice(0, 40); }
function prodPorcion(v) {
  const n = numeroEscrito(v), txt = PROD.porcionTxt || (PROD.al.por && PROD.al.por[0] ? PROD.al.por[0][0] : '') || '1 porción', pz = NUT.piezasDePorcion(txt);
  PROD.al.por = n > 0 ? [[txt, n]].concat(pz ? [['1 ' + pz.nombre, NUT.r1(n / pz.n)]] : []) : [];
  pintarProducto();
}
function prodRol(r) { PROD.al.rol = r; pintarProducto(); }
