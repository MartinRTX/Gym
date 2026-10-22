/**
 * Gym – Progresion.gs: la sugerencia al EMPEZAR cada ejercicio (subir, bajar o mantener, siempre con números).
 *
 * ARCHIVO GENERADO desde motor.js de la app (node herramientas/generar-progresion.js). No lo edites aquí:
 * así la app y la hoja usan el mismo motor. Va en tu proyecto de Apps Script como archivo aparte, junto a AppGym.gs.
 * La app compara firmaMotor_() con la suya; si no coinciden, te avisa y usa su propio cálculo.
 */
/* Lo que te sugiere la app al EMPEZAR un ejercicio, con tu última sesión.
   p = { series: [{ w, r, rir }] de trabajo y en orden (rir: 0 fallo, 1.5, 3, o null si no lo marcaste),
         min, max, paso, unidad, mult, barra, inc (negativo = máquina asistida), modalidad, sinPeso, corpKg, nSeries }
   SUBIR si las 2 primeras series llegaron al tope, si te faltan 2 reps o menos en total sin ir al fallo,
     si te sobraron 3+ en todas dentro del rango, o si ya probaste el peso de arriba y te salió el mínimo.
     Si el salto del equipo es muy grande, primero solo la 1.ª serie con el peso nuevo.
   BAJAR si 2 o más series quedaron abajo del mínimo.
   Si no, MANTENER diciendo cuántas reps faltan. Todos los mensajes llevan números.
   Devuelve { accion, base (peso de la última vez), peso, reps, mensaje, objetivo: [{ w, r }] una por serie de trabajo }. */
function progresionInicio_(p) {
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
  // Ya no hay a dónde subir en este equipo (asistida en 0, o no hay más peso): más reps o la versión sin máquina
  if (quiere) return { accion: 'mas_reps', base: w, peso: w, reps: max, objetivo: iguales(w, max),
    mensaje: hiciste + ': ' + (inv ? 'ya no hay menos asistencia en esta máquina; pasa a la versión sin asistencia o agrega una serie.'
      : 'no hay un peso más alto en este equipo; agrega una serie o baja más lento.') };
  // MANTENER: cuánto te falta (con números) y si el salto que sigue es grande
  const f = faltanEn(dos);
  let msg = !valido(arriba) ? hiciste + ': busca 1 rep más por serie, hasta ' + max + '.'
    : hiciste + ': te ' + (f === 1 ? 'falta 1 rep' : 'faltan ' + f + ' reps') + ' en las 2 primeras para ' + (inv ? 'bajar la asistencia a ' : 'subir a ') + arriba + u + '.';
  if (valido(arriba) && pred(arriba, L0 * (1 + (max + 1) / 30)) < min - 2) msg += ' Es un salto de +' + salto(arriba) + '\u00a0%: al llegar a ' + max + ', pruébalo solo en la 1.ª serie.';
  else if (fallo) msg += ' Deja 1 en reserva en las primeras.';
  return { accion: 'mantener', base: w, peso: w, reps: Math.min(max, dos[0] + 1), objetivo: masUna(), mensaje: msg };
}

// Huella del motor (la misma cuenta que MOTOR.firmaProgresion en motor.js)
function firmaMotor_() {
  const t = progresionInicio_.toString().replace(/progresionInicio_?\(/g, 'progresionInicio(').replace(/\s+/g, '');
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
