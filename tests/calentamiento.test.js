// Pruebas del calentamiento automático de los básicos: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const { calentamiento } = require('../motor.js');

test('Banca con barra de 45 lb y 135 por lado: barra × 10, 50 % × 8, 75 % × 3', () => {
  // Carga 135×2 + 45 = 315 lb → 50 % = 157.5 → (157.5−45)/2 = 56.25 → 55 por lado; 75 % = 236.25 → 95.6 → 95
  assert.deepStrictEqual(calentamiento({ carga: 315, barra: 45, mult: 2, paso: 2.5 }), [{ w: 0, r: 10 }, { w: 55, r: 8 }, { w: 95, r: 3 }]);
});

test('Sentadilla en kg (barra 20, 30 por lado): los pesos van en kg y hacia abajo', () => {
  // Carga 80 → 50 % = 40 → 10 por lado; 75 % = 60 → 20 por lado
  assert.deepStrictEqual(calentamiento({ carga: 80, barra: 20, mult: 2, paso: 2.5 }), [{ w: 0, r: 10 }, { w: 10, r: 8 }, { w: 20, r: 3 }]);
});

test('Peso ligero: si el 50 % no pasa de la barra, solo queda la barra y lo que sí pasa', () => {
  // Carga 30 kg (5 por lado + barra 20): 50 % = 15 < barra; 75 % = 22.5 → 1.25 por lado → 0 con paso 2.5
  assert.deepStrictEqual(calentamiento({ carga: 30, barra: 20, mult: 2, paso: 2.5 }), [{ w: 0, r: 10 }]);
});

test('Máquina de discos sin barra (anotas por lado): sin serie de barra sola', () => {
  // 90 por lado → carga 180 → 50 % = 45 por lado; 75 % = 67.5
  assert.deepStrictEqual(calentamiento({ carga: 180, barra: 0, mult: 2, paso: 2.5 }), [{ w: 45, r: 8 }, { w: 67.5, r: 3 }]);
});

test('Todas las series de calentamiento llevan reps 10, 8 y 3 y pesan menos que el trabajo', () => {
  const c = calentamiento({ carga: 225, barra: 45, mult: 2, paso: 5 });
  assert.deepStrictEqual(c.map(s => s.r), [10, 8, 3]);
  c.forEach(s => assert.ok(s.w * 2 + 45 < 225));
});
