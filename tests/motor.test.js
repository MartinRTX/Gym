// Pruebas del motor de la siguiente serie: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const { siguienteSerie } = require('../motor.js');

const RIR12 = 1.5, RIR3 = 3, FALLO = 0;
// Ejercicios tal como vienen del Catálogo (rango, paso, modalidad, multiplicador, barra)
const PRESS_MILITAR = { min: 8, max: 12, paso: 10, mult: 1, barra: 0, inc: 5, modalidad: 'Mancuerna' };
const REMO_MAQUINA = { min: 10, max: 12, paso: 2.5, mult: 2, barra: 0, inc: 5, modalidad: 'Discos' };
const CURL_MARTILLO = { min: 8, max: 12, paso: 5, mult: 1, barra: 0, inc: 5, modalidad: 'Mancuerna' };
const BANCA = { min: 8, max: 12, paso: 2.5, mult: 2, barra: 45, inc: 2.5, modalidad: 'Barra' };
const PULLOVER = { min: 12, max: 15, paso: 2.5, mult: 1, barra: 0, inc: 2.5, modalidad: 'Polea' };
const LATERALES = { min: 12, max: 20, paso: 5, mult: 1, barra: 0, inc: 2.5, modalidad: 'Mancuerna' };
const DOMINADAS_ASIST = { min: 8, max: 12, paso: 5, mult: 1, barra: 0, inc: -5, modalidad: 'Placas', corpKg: 74.2 };

const serie = (ej, peso, reps, rir, unidad) => siguienteSerie(Object.assign({ unidad: unidad || 'lb', ultima: false, recMala: false }, ej, { peso: peso, reps: reps, rir: rir }));
const elegida = m => m.opciones.find(o => o.id === m.eleccion);
const tieneNumero = t => /\d/.test(t);

test('Press militar 80×11 RIR 1–2: mantener y decir que con 90 saldrían ~5', () => {
  const m = serie(PRESS_MILITAR, 80, 11, RIR12), o = elegida(m);
  assert.strictEqual(o.accion, 'mantener');
  assert.strictEqual(o.peso, 80);
  assert.match(o.mensaje, /con 90 lb te saldrían ~5/i);
  assert.match(o.mensaje, /te faltan \d/);
});

test('Press militar 80×14 RIR 1–2: subir a 90, ~8 reps', () => {
  const o = elegida(serie(PRESS_MILITAR, 80, 14, RIR12));
  assert.strictEqual(o.accion, 'subir');
  assert.strictEqual(o.peso, 90);
  assert.strictEqual(o.reps, 8);
});

test('Remo 80×12 RIR 3+ (paso 2.5): subir a 82.5, ~11', () => {
  const o = elegida(serie(REMO_MAQUINA, 80, 12, RIR3));
  assert.strictEqual(o.accion, 'subir');
  assert.strictEqual(o.peso, 82.5);
  assert.strictEqual(o.reps, 11);
});

test('Curl martillo 20×10 al fallo (paso 5): bajar a 15×12', () => {
  const o = elegida(serie(CURL_MARTILLO, 20, 10, FALLO));
  assert.strictEqual(o.accion, 'bajar');
  assert.strictEqual(o.peso, 15);
  assert.strictEqual(o.reps, 12);
});

test('Banca 25×8 al fallo (8–12): bajar a 20×8', () => {
  const o = elegida(serie(BANCA, 25, 8, FALLO));
  assert.strictEqual(o.accion, 'bajar');
  assert.strictEqual(o.peso, 20);
  assert.strictEqual(o.reps, 8);
});

test('Pullover 80×15 al fallo: mantener 80×12', () => {
  const o = elegida(serie(PULLOVER, 80, 15, FALLO));
  assert.strictEqual(o.accion, 'mantener');
  assert.strictEqual(o.peso, 80);
  assert.strictEqual(o.reps, 12);
});

test('Elevaciones laterales 15×20 RIR 3+: más reps, "20 es mucho salto"', () => {
  const o = elegida(serie(LATERALES, 15, 20, RIR3));
  assert.strictEqual(o.accion, 'mas_reps');
  assert.strictEqual(o.peso, 15);
  assert.ok(o.reps > 20);
  assert.match(o.mensaje, /20 es mucho salto/);
});

test('Dominadas asistidas 45×7 al fallo: subir asistencia a 50 ×11', () => {
  const o = elegida(serie(DOMINADAS_ASIST, 45, 7, FALLO, 'kg'));
  assert.strictEqual(o.accion, 'bajar');          // bajar la dificultad = más asistencia
  assert.strictEqual(o.peso, 50);
  assert.strictEqual(o.reps, 11);
  assert.match(o.mensaje, /Sube la asistencia a 50/);
});

test('Sin RIR marcado: lo pide antes de sugerir', () => {
  assert.deepStrictEqual(serie(PRESS_MILITAR, 80, 11, null), { pideRir: true });
});

test('Ningún mensaje sin números ("mantén el peso" o "busca más reps" solos están prohibidos)', () => {
  const casos = [[PRESS_MILITAR, 80, 11, RIR12], [PRESS_MILITAR, 80, 14, RIR12], [REMO_MAQUINA, 80, 12, RIR3], [CURL_MARTILLO, 20, 10, FALLO],
    [BANCA, 25, 8, FALLO], [PULLOVER, 80, 15, FALLO], [LATERALES, 15, 20, RIR3], [DOMINADAS_ASIST, 45, 7, FALLO, 'kg'],
    [Object.assign({}, PRESS_MILITAR, { sinPeso: true }), 0, 12, RIR12], [PRESS_MILITAR, 80, 10, RIR12]];
  casos.forEach(c => serie.apply(null, c).opciones.forEach(o => assert.ok(tieneNumero(o.mensaje), o.mensaje)));
});

test('Última serie de un aislado: pide llevarla a 0–1 en reserva', () => {
  const m = siguienteSerie(Object.assign({ unidad: 'lb', ultima: true }, LATERALES, { peso: 15, reps: 14, rir: RIR12 }));
  assert.match(elegida(m).mensaje, /^Es la última: llévala a 0–1 en reserva/);
});

test('Barra fija (total): sin barra ni multiplicador, paso de 10', () => {
  const RUMANO_FIJA = { min: 8, max: 12, paso: 10, mult: 1, barra: 0, inc: 10, modalidad: 'Barra fija' };
  const o = elegida(serie(RUMANO_FIJA, 90, 12, RIR3));
  assert.strictEqual(o.accion, 'subir');
  assert.strictEqual(o.peso, 100);
});
