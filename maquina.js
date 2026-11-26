// Foto de una máquina (2 de 3 de lo que antes era progreso.js): la IA dice qué ejercicio es y, si no está en tu Catálogo,
// lo agrega (script con Maquina.gs). Va después de progreso.js (index.html).

/* ----- Foto de una máquina: la IA dice qué ejercicio es; si no está en tu Catálogo, lo agrega (script con Maquina.gs) ----- */
let MAQ = null;
function abrirMaquina() {
  if (!DATA.ia) return toast('La IA no está activada en tu hoja');
  MAQ = null;
  $('sheet').innerHTML = html`<div class="row between"><div class="t2">¿Qué máquina es?</div><button class="btn ghost sm" ${on('cerrarModal')}>✕</button></div>` +
    html`<div class="muted" style="margin:6px 0 12px">Tómale foto a la máquina (o a alguien usándola) y te digo qué ejercicio es, qué trabaja y si ya lo tienes.</div>` +
    html`<div class="camopts"><button ${on('fotoMaquina', false)}><span>📷</span><b>Tomar foto</b><small>Que se vea completa, con el asiento y los agarres</small></button>` +
    html`<button ${on('fotoMaquina', true)}><span>🖼️</span><b>Elegir de la galería</b><small>Una foto que ya tomaste</small></button></div>`;
  if (!$('modal').classList.contains('show')) abrirModal();
}
function fotoMaquina(galeria) {
  let inp = $('fotoMaq');
  if (!inp) {
    inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.id = 'fotoMaq'; inp.style.display = 'none';
    inp.addEventListener('change', () => { const f = inp.files && inp.files[0]; inp.value = ''; if (f) procesarMaquina(f); });
    document.body.appendChild(inp);
  }
  if (galeria) inp.removeAttribute('capture'); else inp.setAttribute('capture', 'environment');
  inp.click();
}
async function procesarMaquina(file) {
  if (!navigator.onLine) return toast('Necesitas señal para que la IA vea la foto');
  cargandoFoto('Viendo la máquina…');
  try {
    const f = await achicarFoto(file, 1280);
    const cat = DATA.exercises.filter(e => !/^Otro ejercicio/.test(e.ejercicio)).map(e => ({ n: e.ejercicio, g: e.group }));
    const r = await conLimite(apiPost('maquinaIA', [f.b64, 'image/jpeg', { catalogo: cat, zonas: ZONAS }]), 45000);
    MAQ = Object.assign(r, { foto: f.cv.toDataURL('image/jpeg', 0.6), chica: fotoChica(f.cv) });
    pintarMaquina();
  } catch (e) {
    cerrarModal();
    toast(/desconocida/i.test(e.message) ? 'Tu script todavía no reconoce máquinas: agrégale Maquina.gs' : 'No pude ver la foto: ' + (e.message === 'tiempo' ? 'tardó demasiado' : e.message));
  }
}
function pintarMaquina() {
  const r = MAQ, ex = r.enCatalogo && DATA.exercises.find(e => e.ejercicio === r.enCatalogo);
  let h = html`<div class="row between"><div class="t2">${r.maquina || r.ejercicio || 'Máquina'}</div><button class="btn ghost sm" ${on('cerrarModal')}>✕</button></div>` +
    html`<img class="maqfoto" src="${/^data:image\//.test(r.foto) ? r.foto : ''}" alt="">`;
  if (r.confianza === 'baja') h += html`<div class="aviso2">🤔 No estoy seguro. ${r.como || 'Tómale otra foto donde se vea completa.'}</div>`;
  if (ex) {
    h += html`<div class="maqok">✓ Ya está en tu catálogo: <b>${ex.ejercicio}</b> · ${ex.group}<small>${ex.anterior.length
      ? 'Ya lo has hecho: la última vez (' + ex.lastWhen + ') ' + resumenSets(ex.anterior) + ' ' + ex.unit : 'Todavía no lo has hecho'}</small></div>` +
      html`<div class="acts"><button class="btn ghost" ${on('irAEjercicio', ex.name)}>Ver cómo se hace</button>${esExtra(ex.name) ? ''
        : html`<button class="btn" ${on('anadirHoy', ex.name, seriesDe(ex))}>Añadir a hoy</button>`}</div>` +
      (fotoMaqDe(ex.name) === MAQ.chica ? html`<div class="muted" style="margin-top:8px">📌 Foto guardada en el ejercicio</div>`
        : html`<button class="btn ghost block" style="margin-top:8px" ${on('guardarFotoDeMaquina', ex.name)}>📌 Guardar esta foto en el ejercicio</button>`);
  } else if (r.confianza !== 'baja') {
    h += html`<div class="maqnuevo"><div class="muted" style="margin-bottom:6px">No está en tu catálogo. Esto es lo que te propongo:</div>` +
      html`<b>${r.ejercicio}</b> · ${r.grupo}<br>${r.musculo}${r.secundario ? ' (y ' + r.secundario + ')' : ''}` +
      html`<br><span class="muted">${r.series} series de ${r.min}–${r.max} · anota: ${r.anotar}</span>` +
      (r.como ? html`<div class="muted" style="margin-top:6px;font-size:13.5px">💡 ${r.como}</div>` : '') + '</div>' +
      html`<button class="btn block" style="margin-top:12px" ${on('agregarMaquina')}>${r.guardando ? 'Agregando…' : '➕ Agregarlo a mi catálogo'}</button>` +
      html`<div class="muted" style="font-size:12.5px;margin-top:6px">Se agrega al final de ${r.grupo} en tu hoja; no cambia tu rutina A/B ni borra nada.</div>`;
  }
  if (r.otros && r.otros.length) h += html`<div class="muted" style="font-size:13px;margin-top:10px">En esa máquina también se hace: ${r.otros.join(', ')}</div>`;
  h += html`<button class="link" style="margin-top:10px" ${on('abrirMaquina')}>📷 Otra foto</button>`;
  $('sheet').innerHTML = h;
}
async function agregarMaquina() {
  if (!MAQ || MAQ.guardando) return;
  if (!navigator.onLine) return toast('Necesitas señal para agregarlo a tu hoja');
  MAQ.guardando = true; pintarMaquina();
  try {
    const r = await conLimite(apiPost('nuevoEjercicio', [Object.assign({}, MAQ, { foto: undefined, chica: undefined, guardando: undefined })]), 30000);
    cerrarModal(); hap('ok');
    toast(r.ya ? 'Ya lo tenías: ' + r.ejercicio : 'Agregado a ' + r.grupo + ': ' + r.ejercicio);
    guardarFotoMaq(r.grupo + ': ' + r.ejercicio, MAQ.chica);   // la foto que tomaste queda en su tarjeta
    await actualizar();
  } catch (e) {
    MAQ.guardando = false; pintarMaquina();
    toast(/desconocida/i.test(e.message) ? 'Tu script todavía no puede agregar ejercicios: agrégale Maquina.gs' : 'No se pudo agregar: ' + e.message);
  }
}
// Qué hacer para una zona: lo que ya tienes hoy y los mejores ejercicios para añadir
function opcionesZona(m) {
  const z = zonasVivas(), hoyEx = (GRUPO && GRUPO !== 'Trote' ? recomendadosHoy(GRUPO) : []).map(e => e.name);
  const peso = e => ((e.zonas || []).find(x => x.z === m) || {}).w || 0;
  let cands = DATA.exercises.filter(e => peso(e) > 0 && !/^Otro ejercicio/.test(e.ejercicio));
  const directos = cands.filter(e => peso(e) >= 1);
  if (directos.length) cands = directos;
  const hechoHoy = cands.filter(e => state[e.name] && state[e.name].done);
  const pendHoy = cands.filter(e => hoyEx.includes(e.name) && state[e.name] && !state[e.name].done);
  const rojo = e => (e.zonas || []).some(x => x.z !== m && x.w >= 0.5 && zonaZ(z[x.z] || 0, x.z) === 3);
  const score = e => (e.anterior.length ? 3 : 0) + (e.group === GRUPO ? 2 : 0) + ((e.zonas || []).length <= 2 ? 1 : 0) +
    (e.bloque && e.bloque === DATA.bloquePara[e.group] ? 0.5 : 0) - (rojo(e) ? 2 : 0) - (esDeOtro(e) ? 3 : 0);
  const resto = cands.filter(e => !hoyEx.includes(e.name) && !(state[e.name] && state[e.name].done)).sort((a, b) => score(b) - score(a));
  const semana = cands.filter(e => !hechoHoy.includes(e) && e.anterior.length && (diasDesdeDM(e.lastWhen) ?? 99) <= 6);
  return { pendHoy: pendHoy, hechoHoy: hechoHoy, semana: semana, top: resto.slice(0, 3), peso: peso, rojo: rojo };
}
// Por qué te recomienda ese ejercicio, en pocas palabras
function porQue(e, m, o) {
  const p = [];
  if (e.anterior.length) p.push('la última vez (' + e.lastWhen + '): ' + resumenSets(e.anterior) + ' ' + e.unit);
  else p.push('nuevo para ti: empieza ligero, que te queden 1 o 2 por hacer');
  if ((e.zonas || []).length <= 2) p.push('trabaja directo ' + m.toLowerCase());
  if (o.rojo(e)) p.push('ojo: también carga una zona que ya va alta');
  return p.join(' · ');
}
// Series de trabajo que trae el ejercicio hoy (el script no manda el número del Catálogo)
function seriesDe(e) { return ((e && e.sets) || []).filter(x => x.t !== 'C').length || 4; }
// Panel de una zona (en Progreso y en "🎯 Trabajar un músculo")
function panelZona(m, modal) {
  const z = zonasVivas(), v = z[m] || 0, t = metaZona(m), est = zonaZ(v, m), falta = Math.max(0, t.meta - v);
  const sel = x => modal ? on('elegirMusculo', x) : on('verMusculo', x);
  const col = ['var(--muted)', 'var(--acc)', 'var(--ok)', 'var(--bad)'];
  const barra = (x, w) => html`<span class="zbar${w ? ' w' : ''}"><i style="width:${Math.min(100, Math.round((z[x] || 0) / metaZona(x).meta * 100))}%;background:${col[zonaZ(z[x] || 0, x)]}"></i></span>`;
  let h = html`<div class="msel entra"><div class="row between" style="align-items:baseline"><b>${znL(m)}</b><span class="num">${fmtSer(v)} / ${t.meta} series</span></div>` +
    html`${barra(m, true)}<div class="muted" style="font-size:13px;margin-top:4px">${ZONA_TXT[est]}${focoMus() !== 'balanceado' ? ' · meta con tu objetivo «' + FOCOS[focoMus()][0] + '»' : ''}</div>`;
  const r = regionDe(m);
  if (r) h += html`<div class="region"><div class="muted">${r}</div>${REGIONES[r].map(x => html`<button class="${x === m ? 'on' : ''}" ${sel(x)}>` +
    html`<span>${x}</span>${barra(x)}<span class="num">${fmtSer(z[x] || 0)}/${metaZona(x).meta}</span></button>`).map(crudo)}</div>`;
  const o = opcionesZona(m), rec = zonaReciente(m);
  const boton = (e, grande) => {
    const n = Math.min(seriesDe(e), Math.max(2, Math.ceil(falta / o.peso(e)) || 3));
    if (esExtra(e.name)) return html`<button class="${grande ? 'btn block' : 'alt'}" ${on('irAEjercicio', e.name)}>✓ Ya está en tu sesión: ${e.ejercicio.split(' (')[0]} → Ir</button>`;
    return grande ? crudo(html`<button class="btn block" ${on('anadirHoy', e.name, n)}>➕ Añadir ${e.ejercicio.split(' (')[0]} a hoy · ${n} series</button>` +
      html`<div class="muted porque">${porQue(e, m, o)}</div>`)
      : crudo(html`<button class="alt" ${on('anadirHoy', e.name, n)}>${o.pendHoy.length || est === 2 ? '➕ ' : 'o '}${e.ejercicio.split(' (')[0]}` +
        html`<small>${e.anterior.length ? '✓ ya lo has hecho · ' + e.lastWhen : 'nuevo para ti'}</small></button>`);
  };
  h += '<div class="accion">';
  if (est === 3) h += html`<div>Ya pasaste el tope esta semana: no le sumes más; dale descanso para que crezca.</div>`;
  else {
    if (est === 2) h += html`<div class="muted" style="margin-bottom:6px">Vas en meta. Si aun así quieres darle más:</div>`;
    else h += html`<div style="margin-bottom:6px">Te faltan <b>~${Math.ceil(falta)} series</b> esta semana.</div>`;
    if (rec.n >= 4) h += html`<div class="aviso2">⏳ Ya le diste ${fmtSer(rec.n)} series ${rec.cuando}: si la sientes cargada, mejor en tu próxima sesión (48 h de recuperación).</div>`;
    if (o.pendHoy.length) h += html`<div style="margin:2px 0 8px">Ya está en tu rutina de hoy: ${o.pendHoy.slice(0, 2).map((e, i) => html`${i ? ' ' : ''}<button class="alt" ${on('irAEjercicio', e.name)}>${e.ejercicio.split(' (')[0]} → Ir</button>`)}</div>`;
    // Si el grupo que la trabaja es tu próximo día, se cubre ahí (no hace falta adelantarlo)
    const rot = ['Push', 'Pull', 'Legs'], gHoy = rot.includes(GRUPO) ? GRUPO : DATA.sugGrupo, prox = rot[(rot.indexOf(gHoy) + 1) % 3];
    if (est < 2 && o.top.length && o.top[0].group === prox && prox !== GRUPO) h += html`<div class="muted" style="font-size:13px;margin-bottom:6px">Tu próximo día es ${prox}: ahí la cubres. Si quieres adelantarla o no vas a ir:</div>`;
    if (o.top.length) {
      const n0 = Math.min(seriesDe(o.top[0]), Math.max(2, Math.ceil(falta / o.peso(o.top[0])) || 3));
      // Si ya tienes uno pendiente hoy, lo demás va como alternativa chica (primero haz lo que ya está)
      h += o.pendHoy.length || est === 2 ? html`<div class="alts">${o.pendHoy.length ? html`<span class="muted" style="font-size:13px;align-self:center">¿Quieres otro?</span>` : ''}${o.top.map(e => boton(e, false))}</div>`
        : boton(o.top[0], true) + (o.top.length > 1 ? html`<div class="alts">${o.top.slice(1).map(e => boton(e, false))}</div>` : '');
      if (est < 2 && !o.pendHoy.length && falta > n0 + 0.5) h += html`<div class="muted" style="font-size:12.5px;margin-top:6px">Las otras ~${Math.ceil(falta - n0)} series, en tu próxima sesión: más de 4–5 series de una zona en un día rinden menos.</div>`;
    }
    else if (!o.pendHoy.length) h += html`<div class="muted">No hay otro ejercicio en tu catálogo que la trabaje directo.</div>`;
  }
  // Lo que ya hiciste para esta zona (hoy y en la semana), para no repetir sin querer
  const hechos = o.hechoHoy.map(e => [e, 'hoy']).concat(o.semana.map(e => [e, DSEM[new Date(sumarDias(hoy(), -diasDesdeDM(e.lastWhen)) + 'T12:00:00').getDay()]]));
  if (hechos.length) h += html`<div class="muted" style="font-size:12.5px;margin-top:10px">Esta semana ya hiciste:</div><div class="hechos">${
    hechos.map(x => html`<span>✓ ${x[0].ejercicio.split(' (')[0]} · ${x[1]}</span>`)}</div>`;
  return crudo(h + '</div></div>');
}
// Las zonas más atrasadas contra su meta (para "Lo que más te falta")
function zonasAtrasadas(n) {
  // Primero lo que más series te falta, y las zonas grandes pesan más que las chicas (antebrazo, lumbar…)
  const z = zonasVivas(), peso = x => (x.meta - x.v) * (x.meta >= 8 ? 1.5 : 1);
  return ZONAS.map(m => ({ m: m, v: z[m] || 0, meta: metaZona(m).meta })).filter(x => x.v < x.meta)
    .sort((a, b) => peso(b) - peso(a)).slice(0, n || 3);
}
// "🎯 Trabajar un músculo" desde Entrenar: eliges zona y te dice qué hacer hoy
function elegirMusculo(m) {
  const z = zonasVivas(), col = ['var(--muted)', 'var(--acc)', 'var(--ok)', 'var(--bad)'];
  const atr = zonasAtrasadas(3);
  if (m) {
    $('sheet').innerHTML = html`<div class="row between"><button class="volver" ${on('elegirMusculo')}>← Otro músculo</button><button class="btn ghost sm" ${on('cerrarModal')}>✕</button></div>${panelZona(m, true)}`;
    if (!$('modal').classList.contains('show')) abrirModal();
    $('sheet').scrollTop = 0;
    return;
  }
  let h = html`<div class="row between"><div class="t2">¿Qué quieres trabajar?</div><button class="btn ghost sm" ${on('cerrarModal')}>✕</button></div>`;
  if (atr.length) h += html`<div class="muted" style="margin:4px 0 6px">Lo que más te falta esta semana:</div><div class="mchips" style="margin-top:0">${
    atr.map(x => html`<button ${on('elegirMusculo', x.m)}><i style="background:${col[zonaZ(x.v, x.m)]}"></i>${x.m} <b class="num">${fmtSer(x.v)}/${x.meta}</b></button>`)}</div>`;
  h += html`<div class="regiones">${Object.keys(REGIONES).map(r => html`<div><div class="muted">${r}</div><div class="mchips" style="margin-top:4px">${REGIONES[r].map(x =>
    html`<button class="${x === m ? 'on' : ''}" ${on('elegirMusculo', x)}><i style="background:${col[zonaZ(z[x] || 0, x)]}"></i>${x}</button>`)}</div></div>`)}</div>`;
  if (DATA.ia) h += html`<button class="musbtn" ${on('abrirMaquina')}>📷 ¿Una máquina que no conoces? <span>Tómale foto y te digo qué trabaja</span></button>`;
  $('sheet').innerHTML = h;
  if (!$('modal').classList.contains('show')) abrirModal();
  $('sheet').scrollTop = 0;
}
