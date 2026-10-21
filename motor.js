/* ===================== Motor de la siguiente serie =====================
   Matemática pura (sin pantalla ni internet): la usa app.js y la prueban los tests (tests/motor.test.js).

   1. Fuerza estimada de la serie (Epley con las reps que te quedaban): e1 = carga × (1 + (reps + RIR) / 30)
   2. Para cada peso candidato (±1 a ±3 pasos del equipo) predice cuántas reps saldrían en la siguiente:
        reps = 30 × (e1 / carga − 1) − RIR objetivo − caída por cansancio
      RIR objetivo: mala recuperación 2.5 · básicos (barra, barra fija, discos) 2 · aislado o máquina en la
      última serie 0.5 · resto 1.5. Caída: lo que tú pierdes de una serie a otra (aprendido), o 2 tras un fallo y 1 si no.
   3. Decide: SUBIR al más pesado que predice ≥ mínimo (≥ mínimo+1 si son 2 pasos, +2 si son 3) ·
      BAJAR si con el mismo peso saldrían menos del mínimo o si fallaste en un básico ·
      MANTENER solo cuando subir daría menos del mínimo, diciendo cuántas reps te faltan para subir.
   En máquinas asistidas todo se invierte: más asistencia = más fácil. Todos los mensajes llevan números. */
(function (raiz) {
  const KG_A_LB = 2.2046;
  const RIR = { 'Al fallo': 0, 'Casi (1–2 más)': 1.5, 'Sobraban 3+': 3 };
  const BASICOS = ['Barra', 'Barra fija', 'Discos'];
  const r2 = x => Math.round(x * 100) / 100;
  const alPaso = (w, p, modo) => { const f = modo === 'abajo' ? Math.floor : modo === 'arriba' ? Math.ceil : Math.round; return r2(f(Number(w) / p + 1e-9) * p); };
  const esBasico = ej => BASICOS.indexOf(ej.modalidad || '') > -1;

  // ¿Qué se anota en el teclado? Barra fija y "Total…" = total; barra con discos o máquina de discos = por lado
  function comoAnotar(ej) {
    const como = String(ej.howTo || '');
    if (Number(ej.inc) < 0 || /asistencia/i.test(como)) return { corto: 'asistencia', texto: 'Anota: la asistencia' };
    if (ej.modalidad === 'Barra fija' || /^total/i.test(como)) return { corto: 'total', texto: 'Anota: total de la barra' };
    if (Number(ej.mult) === 2) return { corto: 'por lado', texto: 'Anota: por lado' + (Number(ej.barra) > 0 ? ', sin la barra' : '') };
    if (/una mancuerna/i.test(como)) return { corto: 'una mancuerna', texto: 'Anota: una mancuerna' };
    if (/placa/i.test(como)) return { corto: 'placa', texto: 'Anota: la placa de la máquina' };
    return { corto: '', texto: como ? 'Anota: ' + como.charAt(0).toLowerCase() + como.slice(1) : '' };
  }

  /* p = { peso, reps, rir (0 | 1.5 | 3 | null), min, max, paso, unidad, mult, barra, inc, modalidad, sinPeso,
           corpKg (tu peso, para asistidas), ultima (la siguiente es la última de trabajo), recMala, sinSubir, caida } */
  function siguienteSerie(p) {
    if (p.rir === null || p.rir === undefined) return { pideRir: true };
    const w = Number(p.peso) || 0, r = Number(p.reps) || 0, rir = Number(p.rir), min = p.min, max = p.max;
    const basico = esBasico(p);
    const c = p.caida || {};
    const caida = rir === 0 ? (c.nf >= 3 ? Math.max(1, c.fallo) : 2)
      : rir <= 1.5 ? (c.nn >= 3 ? Math.max(0.5, c.normal) : 1)
      : (c.nn >= 3 ? Math.max(0, c.normal - 0.5) : 0.5);
    const rirObj = p.recMala ? 2.5 : basico ? 2 : p.ultima ? 0.5 : 1.5;
    const ult = p.ultima && !basico && !p.recMala ? 'Es la última: llévala a 0–1 en reserva. ' : '';
    const fallo = rir === 0;
    const predMismo = Math.max(0, Math.round(r + rir - rirObj - caida + 1e-9));

    // Sin carga (peso corporal): solo reps
    if (p.sinPeso || (!w && !(Number(p.inc) < 0) && !(Number(p.barra) > 0))) {
      const ops = [{ id: 'A', accion: 'mantener', peso: w, reps: Math.max(1, predMismo) }];
      ops[0].mensaje = ult + (predMismo < min
        ? 'Descansa 2–3 min: la siguiente te saldría ~' + predMismo + ', abajo de ' + min + '. Haz las que salgan con buena técnica.'
        : predMismo > max ? 'Busca ~' + predMismo + ': ya pasas de ' + max + '; si te sobra, agrega lastre o baja más lento.'
        : 'Busca ~' + predMismo + ' en la siguiente (rango ' + min + '–' + max + ').');
      return { opciones: ops, eleccion: 'A', paso: p.paso, rirObj: rirObj, pred: predMismo };
    }

    const paso = Math.abs(Number(p.paso)) || 2.5, inv = Number(p.inc) < 0;
    const u = ' ' + (p.unidad || 'lb') + (Number(p.mult) === 2 && !inv ? ' por lado' : '');
    const conv = p.unidad === 'kg' ? KG_A_LB : 1;
    const corp = (Number(p.corpKg) || 72) * KG_A_LB;
    const carga = x => inv ? corp - x * conv : x * (Number(p.mult) || 1) * conv + (Number(p.barra) || 0);
    const L0 = carga(w);
    if (!(L0 > 0)) return null;
    const pred = x => { const L = carga(x); return L > 0 ? Math.max(0, Math.round((L0 / L) * (30 + r + rir) - 30 - rirObj - caida + 1e-9)) : 0; };
    // k pasos más pesado (k > 0) o más ligero (k < 0); en asistidas, más pesado = menos asistencia
    const mover = k => alPaso(inv ? w - k * paso : w + k * paso, paso);
    const valido = x => x >= 0 && carga(x) > 0 && (!inv || carga(x) >= corp * 0.1);
    const nombre = x => inv ? 'asistencia ' + x + u : x + u;

    // SUBIR: el más pesado que cumple (cada paso extra exige 1 rep más de margen)
    let sube = null;
    if (!p.sinSubir && !fallo) {
      for (let k = 1; k <= 3; k++) {
        const x = mover(k);
        if (!valido(x)) break;
        if (pred(x) >= min + (k - 1)) sube = { peso: x, reps: Math.min(pred(x), max), k: k };
      }
    }
    // BAJAR: el más pesado de abajo que te deja en el rango (hasta 30 % menos de carga)
    const bajarPorque = predMismo < min ? 'pred' : (fallo && basico) ? 'basico' : '';
    let baja = null;
    if (bajarPorque) {
      for (let k = 1; k <= 6; k++) {
        const x = mover(-k);
        if (!valido(x) || 1 - carga(x) / L0 > 0.3) break;
        baja = { peso: x, reps: Math.min(pred(x), max), k: k, pred: pred(x) };
        if (pred(x) >= min) break;
      }
    }
    const arriba1 = mover(1), predArriba = valido(arriba1) ? pred(arriba1) : null;
    // Reps que te faltan con este peso para que el de arriba te dé el mínimo
    let faltan = null;
    if (predArriba !== null && !sube) {
      const necesito = Math.ceil((min - 0.5 + 30 + rirObj + caida) * (carga(arriba1) / L0) - 30 - rir - 1e-9);
      if (necesito > r) faltan = { reps: necesito, faltan: necesito - r };
    }

    const ops = [];
    const A = { id: 'A', accion: 'mantener', peso: w, reps: Math.max(1, Math.min(predMismo, max)) };
    ops.push(A);
    if (baja) ops.push(Object.assign({ id: 'B', accion: 'bajar' }, { peso: baja.peso, reps: Math.max(1, baja.reps) }));
    if (sube) ops.push({ id: 'C', accion: 'subir', peso: sube.peso, reps: sube.reps });
    else if (predMismo > max) ops.push({ id: 'C', accion: 'mas_reps', peso: w, reps: predMismo });
    const B = ops.find(o => o.id === 'B'), C = ops.find(o => o.id === 'C');

    const conArriba = predArriba !== null ? 'Con ' + nombre(arriba1) + ' te saldrían ~' + predArriba + ', abajo de ' + min + '.' : '';
    // Si para subir necesitarías pasarte del rango, mejor subir solo la primera serie cuando llegues al tope
    const meta = !faltan ? '' : faltan.reps <= max + 2 ? ' Sube cuando saques ' + faltan.reps + ' con ' + w + ' (te faltan ' + faltan.faltan + ').'
      : ' Al llegar a ' + max + ' con ' + w + ', prueba ' + arriba1 + ' solo en la primera serie.';
    A.mensaje = ult + (p.sinSubir ? 'Semana de descarga: mantén ' + nombre(w) + ' y busca ~' + A.reps + ', sin llegar al fallo.'
      : predMismo < min ? 'Si te quedas en ' + nombre(w) + ' te saldrían ~' + predMismo + ', abajo de ' + min + '.'
      : 'Mantén ' + nombre(w) + ' y busca ~' + A.reps + '. ' + conArriba + meta);
    if (B) {
      const verbo = inv ? 'Sube la asistencia a ' + B.peso + u : 'Baja a ' + B.peso + u;
      B.mensaje = ult + verbo + ': ' + (bajarPorque === 'basico' ? 'fallaste en un básico; con ' + B.peso + ' sacas ~' + B.reps + ' con técnica limpia.'
        : 'con ' + w + ' te saldrían ~' + predMismo + ', abajo de ' + min + '. Con ' + B.peso + ' sacas ~' + B.reps + '.');
    }
    if (C) C.mensaje = ult + (C.accion === 'subir'
      ? (inv ? 'Baja la asistencia a ' + C.peso + u : 'Sube a ' + C.peso + u) + ': te saldrían ~' + C.reps + ' (rango ' + min + '–' + max + ').'
      : 'Quédate en ' + nombre(w) + ' y busca ~' + C.reps + ': ' + (predArriba !== null ? arriba1 + ' es mucho salto (te saldrían ~' + predArriba + ', abajo de ' + min + ').' : 'ya pasas de ' + max + '.'));

    let el = 'A';
    if (B && bajarPorque) el = 'B';
    else if (C) el = 'C';
    return { opciones: ops, eleccion: el, paso: paso, rirObj: rirObj, pred: predMismo, faltan: faltan };
  }

  const MOTOR = { siguienteSerie: siguienteSerie, comoAnotar: comoAnotar, esBasico: esBasico, alPaso: alPaso, RIR: RIR, BASICOS: BASICOS };
  if (typeof module !== 'undefined' && module.exports) module.exports = MOTOR;
  else raiz.MOTOR = MOTOR;
})(this);
