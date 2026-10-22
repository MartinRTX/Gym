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

  // <progresion> Esta función se copia tal cual al script (AppGym.gs): el mismo cálculo en la app y en la hoja.
  /* Lo que te sugiere la app al EMPEZAR un ejercicio, con tu última sesión.
     p = { series: [{ w, r, rir }] de trabajo y en orden (rir: 0 fallo, 1.5, 3, o null si no lo marcaste),
           min, max, paso, unidad, mult, barra, inc (negativo = máquina asistida), modalidad, sinPeso, corpKg, nSeries }
     SUBIR si las 2 primeras series llegaron al tope, si te faltan 2 reps o menos en total sin ir al fallo,
       si te sobraron 3+ en todas dentro del rango, o si ya probaste el peso de arriba y te salió el mínimo.
       Si el salto del equipo es muy grande, primero solo la 1.ª serie con el peso nuevo.
     BAJAR si 2 o más series quedaron abajo del mínimo.
     Si no, MANTENER diciendo cuántas reps faltan. Todos los mensajes llevan números.
     Devuelve { accion, base (peso de la última vez), peso, reps, mensaje, objetivo: [{ w, r }] una por serie de trabajo }. */
  function progresionInicio(p) {
    const KG = 2.2046, min = Number(p.min), max = Number(p.max);
    const paso = Math.abs(Number(p.paso)) || 2.5, inv = Number(p.inc) < 0;
    const fija = x => Math.round(Math.round(x / paso) * paso * 100) / 100;
    const todas = (p.series || []).filter(s => s && Number(s.r) > 0);
    const n = Math.max(Number(p.nSeries) || 0, 1);
    if (!todas.length) return { accion: 'nuevo', peso: null, reps: Math.min(max, 12), objetivo: [],
      mensaje: 'Primera vez: elige un peso que te deje ' + min + '–' + max + ' reps con 1–2 en reserva.' };
    // Peso de trabajo: el que más repetiste (empate: el más pesado; en asistidas, la menor asistencia)
    const cuenta = {};
    todas.forEach(s => { const k = Number(s.w) || 0; cuenta[k] = (cuenta[k] || 0) + 1; });
    const w = Object.keys(cuenta).map(Number).sort((a, b) => cuenta[b] - cuenta[a] || (inv ? a - b : b - a))[0];
    const t = todas.filter(s => (Number(s.w) || 0) === w), reps = t.map(s => Number(s.r)), dos = reps.slice(0, 2);
    const u = ' ' + (p.unidad || 'lb'), nSer = Math.max(n, reps.length);
    const hiciste = 'Hiciste ' + reps.join(', ') + (w ? ' con ' + w : '');
    const iguales = (peso, r) => Array.from({ length: nSer }, () => ({ w: peso, r: r }));
    const masUna = () => Array.from({ length: nSer }, (_, i) => ({ w: w, r: Math.min(max, (reps[i] !== undefined ? reps[i] : reps[reps.length - 1]) + 1) }));
    const faltanEn = l => l.reduce((a, r) => a + Math.max(0, max - r), 0);
    // Sin carga (peso corporal o segundos): solo reps
    if (p.sinPeso || (!w && !inv && !(Number(p.barra) > 0))) {
      if (dos.every(r => r >= max)) return { accion: 'mas_reps', base: w, peso: w, reps: max + 2, objetivo: iguales(w, max + 2),
        mensaje: hiciste + ': ya llegas a ' + max + '. Busca ' + (max + 2) + ' o súbele dificultad (lastre o más lento).' };
      const f = faltanEn(dos);
      return { accion: 'mantener', base: w, peso: w, reps: Math.min(max, dos[0] + 1), objetivo: masUna(),
        mensaje: hiciste + ': 1 más por serie; te ' + (f === 1 ? 'falta 1' : 'faltan ' + f) + ' en las 2 primeras para llegar a ' + max + '.' };
    }
    const conv = p.unidad === 'kg' ? KG : 1, corp = (Number(p.corpKg) || 72) * KG;
    const carga = x => inv ? corp - x * conv : x * (Number(p.mult) || 1) * conv + (Number(p.barra) || 0);
    const rirObj = ['Barra', 'Barra fija', 'Discos'].indexOf(p.modalidad || '') > -1 ? 2 : 1.5;
    const L0 = carga(w);
    if (!(L0 > 0)) return { accion: 'mantener', base: w, peso: w, reps: max, objetivo: masUna(), mensaje: hiciste + ': busca ' + max + ' en las 2 primeras.' };
    // Fuerza estimada (Epley con la reserva que marcaste; sin dato se asume 1) y reps que te saldrían frescas con otro peso
    const rirDe = s => s.rir === null || s.rir === undefined || s.rir === '' ? 1 : Number(s.rir);
    const e1 = Math.max.apply(null, t.map(s => L0 * (1 + (Number(s.r) + rirDe(s)) / 30)));
    const pred = (x, fuerza) => { const L = carga(x); return L > 0 ? Math.max(0, Math.round(30 * ((fuerza || e1) / L - 1) - rirObj + 1e-9)) : 0; };
    const mover = k => fija(inv ? w - k * paso : w + k * paso);
    const valido = x => x >= 0 && carga(x) > 0;
    const verbo = x => (inv ? 'baja la asistencia a ' : 'sube a ') + x + u;
    const salto = x => Math.round(Math.abs(carga(x) / L0 - 1) * 100);
    const fallo = t.some(s => s.rir !== null && s.rir !== undefined && s.rir !== '' && Number(s.rir) === 0);
    const sobraban = t.every(s => s.rir !== null && s.rir !== undefined && s.rir !== '' && Number(s.rir) >= 3);
    const bajoMin = reps.filter(r => r < min).length;
    // Una serie con más peso (p. ej. la 1.ª) que sí llegó al mínimo: si con tu peso de trabajo ya llegaste al tope,
    // todas suben a ese peso; si no, se repite esa 1.ª serie pesada y las demás siguen con tu peso de trabajo.
    const probadas = todas.filter(s => (inv ? Number(s.w) < w : Number(s.w) > w) && Number(s.r) >= min);
    if (probadas.length) {
      const x = probadas.map(s => Number(s.w)).sort((a, b) => inv ? a - b : b - a)[0];
      const px = probadas.filter(s => Number(s.w) === x)[0], rx = Number(px.r), falloX = px.rir !== null && px.rir !== undefined && px.rir !== '' && Number(px.rir) === 0;
      if (dos.every(r => r >= max) && !falloX) return { accion: 'subir', base: w, peso: x, reps: min, objetivo: iguales(x, min),
        mensaje: 'Ya sacaste ' + rx + ' con ' + x + ' y llegaste a ' + max + ' con ' + w + ': ' + verbo(x) + ' en todas y busca ' + min + '.' };
      const f = faltanEn(dos), r1 = falloX ? rx : Math.min(max, rx + 1), resto = masUna();   // si fue al fallo, primero repetir
      return { accion: 'mantener', base: w, peso: w, reps: resto[0].r, objetivo: [{ w: x, r: r1 }].concat(resto.slice(0, nSer - 1)),
        mensaje: 'Hiciste ' + rx + ' con ' + x + (falloX ? ' (al fallo)' : '') + ' y ' + reps.join(', ') + ' con ' + w + ': repite la 1.ª con ' + x + ' y busca ' + r1 +
          '; con ' + w + ' te ' + (f === 1 ? 'falta 1 rep' : 'faltan ' + f + ' reps') + ' en las 2 primeras para pasar todas a ' + x + '.' };
    }
    // BAJAR: 2 o más series abajo del mínimo
    if (bajoMin >= 2) {
      let x = null;
      for (let k = 1; k <= 3; k++) {
        const c = mover(-k);
        if (!valido(c) || 1 - carga(c) / L0 > 0.3) break;
        x = c;
        if (pred(c) >= min) break;
      }
      if (x !== null) {
        const r = Math.min(max, Math.max(min, pred(x)));
        return { accion: 'bajar', base: w, peso: x, reps: r, objetivo: iguales(x, r),
          mensaje: hiciste + ' (mínimo ' + min + '): ' + (inv ? 'sube la asistencia a ' + x + u : 'baja a ' + x + u) + ' y busca ~' + r + '.' };
      }
    }
    const arriba = mover(1);
    const quiere = dos.every(r => r >= max) || (faltanEn(reps) <= 2 && !fallo) || (sobraban && reps.every(r => r >= min));
    if (quiere && valido(arriba)) {
      // El más pesado de 1 paso (2 si te sobraban 3+) que te deje cerca del mínimo
      let x = null;
      for (let k = 1; k <= (sobraban ? 2 : 1); k++) { const c = mover(k); if (valido(c) && pred(c) >= min - 2 + (k - 1)) x = c; }
      if (x !== null) {
        const r = Math.min(max, Math.max(min, pred(x)));
        return { accion: 'subir', base: w, peso: x, reps: r, objetivo: iguales(x, r),
          mensaje: hiciste + (dos.every(q => q >= max) ? ' (tope ' + max + ')' : '') + ': ' + verbo(x) + ' y busca ~' + r + '.' };
      }
      // El siguiente peso del equipo es un salto grande: primero solo en la 1.ª serie
      const obj = iguales(w, max); obj[0] = { w: arriba, r: min };
      return { accion: 'mas_reps', base: w, peso: w, reps: max, objetivo: obj,
        mensaje: hiciste + ': ' + arriba + ' es un salto grande (+' + salto(arriba) + '\u00a0%). Haz la 1.ª serie con ' + arriba + ' y las demás con ' + w + '; cuando salgan ' + min + ' con ' + arriba + ', sube todas.' };
    }
    // MANTENER: cuánto te falta (con números) y si el salto que sigue es grande
    const f = faltanEn(dos);
    let msg = hiciste + ': te ' + (f === 1 ? 'falta 1 rep' : 'faltan ' + f + ' reps') + ' en las 2 primeras para ' + (inv ? 'bajar la asistencia a ' : 'subir a ') + arriba + u + '.';
    if (valido(arriba) && pred(arriba, L0 * (1 + (max + 1) / 30)) < min - 2) msg += ' Es un salto de +' + salto(arriba) + '\u00a0%: al llegar a ' + max + ', pruébalo solo en la 1.ª serie.';
    else if (fallo) msg += ' Deja 1 en reserva en las primeras.';
    return { accion: 'mantener', base: w, peso: w, reps: Math.min(max, dos[0] + 1), objetivo: masUna(), mensaje: msg };
  }
  // </progresion>

  const MOTOR = { siguienteSerie: siguienteSerie, progresionInicio: progresionInicio, comoAnotar: comoAnotar, esBasico: esBasico, alPaso: alPaso, RIR: RIR, BASICOS: BASICOS };
  if (typeof module !== 'undefined' && module.exports) module.exports = MOTOR;
  else raiz.MOTOR = MOTOR;
})(this);
