// Acciones de botones y arranque. Va al último: cuando corre arrancar() ya cargaron todos los archivos
// (Parte de la app: se carga después de ajustes.js; ver el orden en index.html)

/* ===================== Acciones de botones (antes eran código dentro del HTML) ===================== */
function entendidoErrores() { LS.del('gym_errores'); pintarEntrenar(); }
function corregirPesoHoy(p) { PESO_TMP = p; tecladoPeso(hoy()); }
function pesarseAhora() { PESO_TMP = ''; tecladoPeso(); }
function plegar(k, abierto) { PLEG[k] = abierto; }
function usarFechaOtra() { cambiarFecha($('fechaOtra').value); }
// Lo que vas escribiendo en una casilla se guarda en BORR para que no se borre al repintar
function borrador(k, v) { BORR[k] = v; }
function medirCinturaOtraVez() {
  cerrarModal(); delete BORR.cintura;
  setTimeout(() => { const c = $('cintura'); if (c) { c.value = ''; c.focus(); } }, 50);
}
function confirmarCintura(v) { cerrarModal(); guardarCintura(v); }
function quitarFotoMaq(name) { guardarFotoMaq(name, null); cerrarModal(); pintarEntrenar(); toast('Foto quitada'); }
// Cierra la ventana y luego hace la acción (solo acciones que la app ya usa en sus botones)
function cerrarY(accion) {
  cerrarModal();
  const f = ACCIONES_OK.has(accion) || ['verTab', 'agregarCalentamiento', 'fotoParaEjercicio', 'editarAjuste', 'quitarSuper', 'fijarPaso'].includes(accion) ? window[accion] : null;
  if (typeof f === 'function') f.apply(null, Array.prototype.slice.call(arguments, 1));
}
function guardarNotaDeHoy(k) { setNotas(k, $('notaTxt').value.trim()); cerrarModal(); pintarEntrenar(); }
function cambioQuien(q, name, todos) { CAMBIO.quien = q; elegirCambio(name, todos); }
function tourSiguiente() { TOUR_I++; pintarTour(); }
function troteTipo(t) { TROTE.tipo = t; pintarEntrenar(); }
function elegirComidaDe(c) { COMIDA_SEL = c; COMIDA_SEL_T = Date.now(); hap('tecla'); pintarComida(); }
function noRegistrarAyer(ayer) { LS.set('gym_ayer_no_' + ayer, true); pintarTab(); }
function alternarRing() { RING_FALTA = !RING_FALTA; hap('tecla'); pintarComida(); }
function alternarQuitarFav() { QUITAR_FAV = !QUITAR_FAV; pintarComida(); }
function cerrarTipico() { TIPICO_TMP = null; cerrarModal(); }
function vaciarTipico() { TIPICO_TMP = []; editarTipico(); }
function addProtHoy(k) { COMIDA_DIA = null; usarProt(hoy()); addProt(k); pintarTab(); }
function noFondo() { LS.set('gym_fondo_no', true); pintarTab(); }
function textoComidaIA(v) { (COMIDA_IA = COMIDA_IA || {}).texto = v; }
function buscarTextoIA() { abrirBuscador({ q: COMIDA_IA ? COMIDA_IA.texto : '' }); }
function alternarItemIA(i) { const x = COMIDA_IA && COMIDA_IA.items[i]; if (x) { x.on = !x.on; pintarComida(); } }
function descartarComidaIA() { COMIDA_IA = null; pintarComida(); }
function memAbierta(v) { MEM_ABIERTA = v; }
function alternarChatAnt() { CHAT_ANT = !CHAT_ANT; pintarCoach(); }
function verTodoChat() { CHAT_TODO = true; pintarCoach(); }
function verPTab(t) { PTAB = t; pintarProgreso(); window.scrollTo(0, 0); }
function verLogros() { cerrarModal(); verTab('Progreso'); PTAB = 'Logros'; pintarProgreso(); }
function elegirGrafica(v) { EJ_GRAF = v; pintarProgreso(); }
function verMusculo(m) { MUS_SEL = m; pintarProgreso(); }
function guardarFotoDeMaquina(name) { if (guardarFotoMaq(name, MAQ.chica)) { toast('Foto guardada en el ejercicio ✓'); pintarMaquina(); } }
function ocultarRuta(k) { if (/^gym_ruta_/.test(k)) { LS.set(k + '_no', true); pintarEntrenar(); } }
function noDescarga() { LS.set('gym_descarga_no_' + lunesDe(hoy()), true); pintarEntrenar(); }
function bvPeso(v) { BV.peso = v; bvMeta(); }
function bvDia(d) { BV.dias = bvToggle(BV.dias, d); abrirBienvenida(); }
function bvKm(v) { BV.km = v; abrirBienvenida(); }
function bvFecha(v) { BV.fecha = v; }
function bvSencillo(v) { BV.sencillo = v; abrirBienvenida(); }
function posponerBienvenida() { BV_POSPUESTA = true; cerrarModal(); }
function elegirDescanso(s) { setAjuste('descanso', s); abrirAjustes(); }
function borrarFallas() { LS.del('gym_jserr'); LS.del('gym_errores'); abrirAjustes(); toast('Lista borrada'); }
function leerSaludDiag() { leerSalud(true).then(abrirDiagnostico); }
function copiarDiagnostico() { copiarTexto(textoDiagnostico(), 'Diagnóstico copiado ✓'); }
function abrirHealthConnect() { hc('openHealthConnectSettings'); }
// Tocar el fondo oscuro (fuera de la hoja) cierra la ventana o el teclado
function fondoModal(e) { if (e && e.target === this) cerrarModal(); }
function fondoTeclado(e) { if (e && e.target === this) cerrarTeclado(); }

arrancar();
