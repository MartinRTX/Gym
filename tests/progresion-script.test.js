// Un solo motor: script/Progresion.gs (lo que corre en la hoja) debe dar exactamente lo mismo que motor.js (la app).
// node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const MOTOR = require('../motor.js');
const { generar, DESTINO } = require('../herramientas/generar-progresion.js');

const codigo = fs.readFileSync(DESTINO, 'utf8');
const hoja = vm.runInNewContext(codigo + '\n;({ progresionInicio_: progresionInicio_, firmaMotor_: firmaMotor_ });', {});
// Los objetos del script nacen en otro contexto: se comparan como JSON
const igual = (a, b, msg) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), msg);

const EJ = {
  banca: { min: 8, max: 12, paso: 2.5, mult: 2, barra: 45, inc: 2.5, modalidad: 'Barra', unidad: 'lb' },
  militar: { min: 8, max: 12, paso: 10, mult: 1, barra: 0, inc: 5, modalidad: 'Mancuerna', unidad: 'lb' },
  remo: { min: 10, max: 12, paso: 2.5, mult: 2, barra: 0, inc: 5, modalidad: 'Discos', unidad: 'lb' },
  laterales: { min: 12, max: 20, paso: 5, mult: 1, barra: 0, inc: 2.5, modalidad: 'Mancuerna', unidad: 'lb' },
  asistidas: { min: 8, max: 12, paso: 5, mult: 1, barra: 0, inc: -5, modalidad: 'Placas', unidad: 'lb', corpKg: 74.2 },
  sentadillaKg: { min: 6, max: 10, paso: 2.5, mult: 2, barra: 20, inc: 2.5, modalidad: 'Barra', unidad: 'kg' },
  dominadas: { min: 5, max: 10, paso: 5, mult: 1, barra: 0, inc: 5, modalidad: 'Barra fija', unidad: 'lb', sinPeso: true }
};
const s = (ws, rs, rirs) => rs.map((r, i) => ({ w: Array.isArray(ws) ? ws[i] : ws, r: r, rir: rirs === undefined ? null : Array.isArray(rirs) ? rirs[i] : rirs }));
const CASOS = [
  ['tope en las 2 primeras', EJ.banca, s(135, [12, 12, 10, 9], 1.5)],
  ['faltan 2 sin fallo', EJ.banca, s(135, [12, 11, 11, 12], 1.5)],
  ['sobraban 3+', EJ.remo, s(90, [11, 11, 10, 10], 3)],
  ['dos abajo del mínimo', EJ.militar, s(50, [7, 6, 6, 5], 0)],
  ['mantener con números', EJ.militar, s(40, [10, 9, 8, 8], 1.5)],
  ['salto grande en mancuerna', EJ.militar, s(40, [12, 12, 11, 10], 1.5)],
  ['probó el peso de arriba', EJ.remo, s([95, 90, 90, 90], [10, 12, 12, 11], [1.5, 1.5, 1.5, 0])],
  ['fallo en la primera', EJ.banca, s(135, [9, 8, 8, 7], [0, 0, 1.5, 0])],
  ['asistida al tope', EJ.asistidas, s(40, [12, 12, 11, 10], 1.5)],
  ['asistida abajo', EJ.asistidas, s(40, [6, 6, 5], 0)],
  ['kg', EJ.sentadillaKg, s(40, [10, 10, 9], 1.5)],
  ['sin esfuerzo marcado', EJ.laterales, s(15, [20, 18, 16])],
  ['peso corporal', EJ.dominadas, s(0, [10, 10, 9], 1.5)],
  ['pesos mezclados', EJ.banca, s([135, 145, 135, 125], [12, 8, 10, 12], 1.5)],
  ['primera vez', EJ.banca, []]
];

test('script/Progresion.gs está generado con el motor.js actual', () => {
  assert.strictEqual(codigo, generar(), 'Corre node herramientas/generar-progresion.js');
});

test('La huella del motor es la misma en la app y en la hoja', () => {
  assert.strictEqual(hoja.firmaMotor_(), MOTOR.firmaProgresion());
});

for (const [nombre, ej, series] of CASOS) {
  test('Mismo resultado app y hoja: ' + nombre, () => {
    const p = Object.assign({ nSeries: 4 }, ej, { series: series });
    igual(hoja.progresionInicio_(p), MOTOR.progresionInicio(p), nombre);
  });
}

test('Mismo resultado en 500 sesiones al azar (siempre las mismas)', () => {
  let x = 12345;
  const azar = n => { x = (x * 1103515245 + 12345) % 2147483648; return x % n; };
  const lista = Object.values(EJ);
  for (let i = 0; i < 500; i++) {
    const ej = lista[azar(lista.length)], n = 1 + azar(5), base = ej.sinPeso ? 0 : (2 + azar(30)) * ej.paso;
    const series = Array.from({ length: n }, () => ({ w: azar(4) === 0 ? base + ej.paso : base, r: Math.max(1, ej.min - 3 + azar(ej.max - ej.min + 6)), rir: [null, 0, 1.5, 3][azar(4)] }));
    const p = Object.assign({ nSeries: 1 + azar(5) }, ej, { series: series });
    igual(hoja.progresionInicio_(p), MOTOR.progresionInicio(p), JSON.stringify(p));
  }
});
