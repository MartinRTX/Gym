// Pruebas de animaciones.js (familias, tempo, cinemática y poses): node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const A = require('../animaciones.js');
const DATOS = require('./e2e/datos-prueba.json');

test('Cada ejercicio de tus datos tiene su animación (por nombre, familia o músculo)', () => {
  DATOS.exercises.forEach(e => assert.ok(A.FAMILIAS[A.familiaDe(e)], e.ejercicio));
});

test('Familias esperadas para nombres típicos', () => {
  const casos = {
    'Press de banca plano con barra': 'pressPlano', 'Press inclinado en Smith': 'pressInclinado', 'Press militar con barra, de pie': 'pressHombro',
    'Elevaciones laterales en polea': 'laterales', 'Cruces en polea de abajo hacia arriba': 'aperturas', 'Aperturas en máquina o poleas': 'aperturas',
    'Fondos asistidos': 'fondos', 'Extensión de tríceps en polea': 'tricepsPolea', 'Jalón al pecho, agarre neutro': 'jalon', 'Dominadas supinas': 'dominada',
    'Remo en máquina': 'remoSentado', 'Remo con pecho apoyado en banco inclinado': 'remoInclinado', 'Remo invertido': 'remoInvertido', 'Pullover en polea': 'pullover',
    'Curl martillo': 'curl', 'Curl de muñeca': 'antebrazo', 'Paseo del granjero': 'granjero', 'Prensa': 'prensa', 'Sentadilla en Smith': 'sentadilla',
    'Peso muerto rumano con barra fija': 'rumano', 'Peso muerto sumo': 'pesoMuerto', 'Hip thrust en máquina': 'hipThrust', 'Puente de glúteo': 'hipThrust',
    'Curl femoral acostado': 'curlFemoral', 'Extensión de cuádriceps': 'extensionPierna', 'Zancada inversa': 'zancada', 'Elevación de pantorrilla de pie': 'pantorrilla',
    'Aductores en máquina': 'aductores', 'Crunch inverso': 'crunch', 'Elevaciones de rodillas en silla romana': 'elevPiernas', 'Leñador en polea': 'giros',
    'Giros rusos': 'giros', 'Plancha': 'plancha', 'Hollow hold': 'plancha'
  };
  Object.keys(casos).forEach(n => assert.strictEqual(A.familiaDe({ ejercicio: n }), casos[n], n));
  // Sin coincidencia por nombre: por su familia del Catálogo y, al final, por su músculo
  assert.strictEqual(A.familiaDe({ ejercicio: 'Máquina rara', variante: 'Remo' }), 'remoSentado');
  assert.strictEqual(A.familiaDe({ ejercicio: 'Máquina rara', musculo: 'Pantorrilla' }), 'pantorrilla');
});

test('Vista de frente para laterales, aperturas, giros y aductores', () => {
  ['laterales', 'aperturas', 'giros', 'aductores'].forEach(f => assert.strictEqual(A.FAMILIAS[f].vista, 'frente', f));
  assert.ok(A.pose({ ejercicio: 'Elevaciones laterales' }, 1).frente);
});

test('Ninguna familia da posiciones inválidas en todo su recorrido', () => {
  Object.keys(A.FAMILIAS).forEach(f => {
    const ex = { ejercicio: A.FAMILIAS[f].nombre, modalidad: 'Mancuerna' };
    for (let i = 0; i <= 20; i++) {
      const p = A.FAMILIAS[f].pose(i / 20, ex, i);
      assert.ok(!/null|NaN|Infinity/.test(JSON.stringify(p)), f + ' en t=' + i / 20);
    }
  });
});

test('Tempo del Catálogo: "3-1-1-0" = baja 3 s, pausa abajo 1 s, sube 1 s, pausa arriba 0 s', () => {
  assert.deepStrictEqual(A.tempoDe('3-1-1-0'), { concentrica: 1000, pico: 150, excentrica: 3000, base: 1000 });
  assert.deepStrictEqual(A.tempoDe('2-0-x-1'), { concentrica: 800, pico: 1000, excentrica: 2000, base: 150 });
  assert.deepStrictEqual(A.tempoDe(''), A.TEMPO_BASE, 'sin tempo: el de hipertrofia');
  assert.deepStrictEqual(A.tempoDe('rápido'), A.TEMPO_BASE);
  assert.strictEqual(A.tempoTexto(''), 'Sube 0.8 s · aprieta 0.35 s · baja 1.5 s');
});

test('Fases: sube rápido, aprieta en t=1, baja lento, estira en t=0, y cuenta repeticiones', () => {
  const T = A.TEMPO_BASE, c = T.concentrica + T.pico + T.excentrica + T.base;
  assert.strictEqual(A.fase(0).nombre, 'concentrica');
  assert.ok(A.fase(T.concentrica * 0.5).t > 0.8, 'la mitad del tiempo ya lleva más del 80 % del recorrido');
  assert.deepStrictEqual([A.fase(T.concentrica + 10).nombre, A.fase(T.concentrica + 10).t], ['pico', 1]);
  assert.strictEqual(A.fase(T.concentrica + T.pico + 10).nombre, 'excentrica');
  assert.deepStrictEqual([A.fase(c - 10).nombre, A.fase(c - 10).t], ['base', 0]);
  assert.strictEqual(A.fase(c * 3 + 5).rep, 3);
});

test('Cinemática inversa: la mano llega a donde debe y el codo se dobla hacia abajo', () => {
  const h = { x: 100, y: 100 }, r = A.ik(h, { x: 130, y: 70 }, 30, 28, 'abajo');
  assert.ok(Math.hypot(r.fin.x - 130, r.fin.y - 70) < 0.5, 'la mano llega');
  assert.ok(Math.abs(Math.hypot(r.medio.x - 100, r.medio.y - 100) - 30) < 0.01, 'el brazo mide lo mismo');
  assert.ok(r.medio.y > A.ik(h, { x: 130, y: 70 }, 30, 28, 'arriba').medio.y, 'abajo de verdad');
});

test('De pie: los pies no se mueven del piso en toda la sentadilla', () => {
  const ex = { ejercicio: 'Sentadilla con barra' };
  const ys = [0, 0.25, 0.5, 0.75, 1].map(t => A.pose(ex, t).tobillo.y);
  assert.ok(ys.every(y => y === ys[0]), JSON.stringify(ys));
  // y la barra baja casi recta sobre medio pie
  const xs = [0, 0.5, 1].map(t => A.pose(ex, t).barra.x);
  assert.ok(Math.max(...xs) - Math.min(...xs) < 2, JSON.stringify(xs));
});

test('Jalón: la mano baja en línea recta', () => {
  const ex = { ejercicio: 'Jalón al pecho' };
  const xs = [0, 0.3, 0.6, 1].map(t => A.pose(ex, t).mano.x);
  assert.ok(Math.max(...xs) - Math.min(...xs) < 1, JSON.stringify(xs));
});
