// Pruebas de nutricion.js (macros, recetas, cenas, tupper, etiquetas y metas): node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const NUT = require('../nutricion.js');

const resolver = ref => NUT.BASE_POR_ID[ref] || null;
const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || '') + ' ' + a + ' ≈ ' + b);

test('Macros de una cantidad: 250 ml de leche 2 % y 30 g de proteína en polvo', () => {
  const leche = NUT.macros(NUT.BASE_POR_ID['b:leche2'], 250);
  assert.deepStrictEqual([leche.p, leche.c, leche.f, leche.k], [8.3, 12, 5, 125]);
  const whey = NUT.macros(NUT.BASE_POR_ID['b:whey'], 30);
  cerca(whey.p, 23.4, 0.05);
});

test('Licuado de siempre: todos los ingredientes existen y la proteína pasa de 40 g', () => {
  const lic = NUT.RECETAS.find(r => r.id === 'licuado');
  const r = NUT.receta(lic, resolver);
  assert.deepStrictEqual(r.faltan, []);
  assert.strictEqual(r.items.length, 7);
  assert.ok(r.tot.p > 40 && r.tot.p < 50, 'proteína ' + r.tot.p);
  cerca(r.tot.k, 4 * r.tot.p + 4 * r.tot.c + 9 * r.tot.f, 60, 'kcal cuadra con macros');
  assert.ok(r.items.find(i => i.ref === 'b:creatina').m.k === 0, 'la creatina no suma calorías');
});

test('Cambiar la leche y la proteína del licuado sin rearmar la receta', () => {
  const recs = JSON.parse(JSON.stringify(NUT.RECETAS));
  assert.strictEqual(NUT.cambiarRol(recs, 'leche', 'p:lala-light'), 1);
  assert.strictEqual(NUT.cambiarRol(recs, 'proteina', 'p:iso-100', 33), 1);
  const lic = recs.find(r => r.id === 'licuado');
  assert.strictEqual(lic.items.find(i => i.rol === 'leche').ref, 'p:lala-light');
  assert.strictEqual(lic.items.find(i => i.rol === 'leche').q, 250, 'la cantidad de leche se queda');
  assert.strictEqual(lic.items.find(i => i.rol === 'proteina').q, 33, '1 scoop de la nueva');
  assert.strictEqual(NUT.RECETAS.find(r => r.id === 'licuado').items[0].ref, 'b:leche2', 'no toca las recetas de fábrica');
});

test('Cena: maíz con soya contra harina, lado a lado (más proteína, menos grasa y calorías)', () => {
  const h = NUT.receta(NUT.RECETAS.find(r => r.id === 'cena-harina'), resolver).tot;
  const m = NUT.receta(NUT.RECETAS.find(r => r.id === 'cena-maiz'), resolver).tot;
  const d = NUT.diferencia(h, m);
  assert.ok(d.p > 0, 'más proteína con la soya: ' + d.p);
  assert.ok(d.f < 0, 'menos grasa: ' + d.f);
  assert.ok(d.k < 0, 'menos calorías: ' + d.k);
});

test('Tupper en 3 toques: pollo, arroz y frijoles, normal y grande', () => {
  const sel = { prot: 'pollo', lados: ['arroz', 'frijol'], tam: 'normal', tort: 0 };
  const items = NUT.tupper(sel);
  assert.deepStrictEqual(items.map(i => i.ref), ['b:pollo-muslo', 'b:arroz-rojo', 'b:frijol-olla', 'b:aceite']);
  const n = NUT.receta({ items: items }, resolver).tot;
  assert.ok(n.p > 35 && n.p < 50, 'proteína ' + n.p);
  const g = NUT.receta({ items: NUT.tupper(Object.assign({}, sel, { tam: 'grande' })) }, resolver).tot;
  cerca(g.p / n.p, 1.3, 0.03, 'grande = 1.3×');
  assert.strictEqual(NUT.nombreTupper(sel), 'Tupper: pollo, arroz y frijoles');
  assert.strictEqual(NUT.nombreTupper({ prot: 'sin', lados: ['verdura'], tam: 'chico', tort: 2 }), 'Tupper: sin carne y verduras + 2 tortillas (chico)');
  assert.strictEqual(NUT.claveTupper({ prot: 'pollo', lados: ['frijol', 'arroz'] }), NUT.claveTupper({ prot: 'pollo', lados: ['arroz', 'frijol'], tam: 'normal', tort: 0 }));
});

test('Etiqueta solo por porción (scoop de 33 g): se pasa a 100 g', () => {
  const r = NUT.normalizarEtiqueta({ nombre: 'Iso 100', u: 'g', porcion: { texto: '1 scoop', cant: 33, p: 25, c: 1, f: 0.5, k: 110 } });
  assert.ok(!r.error);
  cerca(r.al.p, 75.8, 0.1); cerca(r.al.k, 333.3, 0.1);
  assert.deepStrictEqual(r.al.por, [['1 scoop', 33]]);
  assert.deepStrictEqual(r.avisos, []);
});

test('Etiqueta con las dos columnas que no cuadran: avisa', () => {
  const r = NUT.normalizarEtiqueta({ nombre: 'Leche', u: 'ml', por100: { p: 8, c: 12, f: 5, k: 125 }, porcion: { texto: '1 vaso', cant: 250, p: 8, c: 12, f: 5, k: 125 } });
  assert.ok(r.avisos.some(a => /no cuadran/.test(a)), JSON.stringify(r.avisos));
  const bien = NUT.normalizarEtiqueta({ nombre: 'Leche', u: 'ml', por100: { p: 3.2, c: 4.8, f: 2, k: 50 }, porcion: { texto: '1 vaso', cant: 250, p: 8, c: 12, f: 5, k: 125 } });
  assert.deepStrictEqual(bien.avisos, []);
  assert.strictEqual(bien.al.u, 'ml');
});

test('Etiqueta con kcal que no cuadran con los macros: avisa', () => {
  const r = NUT.normalizarEtiqueta({ nombre: 'X', por100: { p: 10, c: 10, f: 10, k: 400 } });
  assert.ok(r.avisos.some(a => /calorías/.test(a)));
  assert.ok(NUT.normalizarEtiqueta({ nombre: 'Vacía' }).error);
});

test('Metas: 74 kg, 4 días de gym, 10 km de trote, proteína 130', () => {
  const m = NUT.metas({ peso: 74, metaProt: 130, diasGym: 4, kmSemana: 10 });
  assert.strictEqual(m.p, 130, 'la proteína es la tuya');
  assert.ok(m.k >= 1850 && m.k <= 2200, 'kcal ' + m.k);
  assert.strictEqual(m.f, 59);
  cerca(m.p * 4 + m.c * 4 + m.f * 9, m.k, 30, 'los macros suman las kcal');
  assert.strictEqual(m.k % 50, 0);
});

test('Metas se ajustan con el ritmo de peso', () => {
  const base = NUT.metas({ peso: 74, metaProt: 130, diasGym: 4, kmSemana: 10 });
  assert.ok(NUT.metas({ peso: 74, metaProt: 130, diasGym: 4, kmSemana: 10, ritmoPct: -1.3 }).k > base.k, 'muy rápido: come más');
  assert.ok(NUT.metas({ peso: 74, metaProt: 130, diasGym: 4, kmSemana: 10, ritmoPct: 0.3 }).k < base.k, 'subiendo: menos');
  assert.strictEqual(NUT.metas({ peso: 74, metaProt: 130, diasGym: 4, kmSemana: 10, ritmoPct: 0.3, bajaCintura: true }).k, base.k, 'sube pero baja cintura: igual');
});

test('Buscar: sin acentos, primero lo base, y el USDA con palabras en español', () => {
  const lista = NUT.BASE.concat([{ id: 'us:1', n: 'Cereals, oats, regular and quick, not fortified, dry', en: 'Cereals, oats, regular and quick, not fortified, dry' },
                                 { id: 'mx:9', n: 'Avena cruda', en: 'Oats, raw' }]);
  const r = NUT.buscar(lista, 'avena');
  assert.strictEqual(r[0].id, 'b:avena');
  assert.ok(r.some(a => a.id === 'mx:9') && r.some(a => a.id === 'us:1'), 'encuentra México y USDA');
  assert.strictEqual(NUT.buscar(lista, 'platano')[0].id, 'b:platano');
  assert.strictEqual(NUT.buscar(lista, 'TORTILLA maíz')[0].id, 'b:tort-maiz');
  assert.deepStrictEqual(NUT.buscar(lista, 'x'), []);
});

test('Todos los alimentos base tienen sus macros y porciones válidas', () => {
  NUT.BASE.forEach(a => {
    NUT.MAC.forEach(k => assert.ok(typeof a[k] === 'number' && a[k] >= 0, a.id + ' ' + k));
    a.por.forEach(p => assert.ok(p[0] && p[1] > 0, a.id));
    if (a.k > 0) cerca(a.k, 4 * a.p + 4 * a.c + 9 * a.f, Math.max(25, a.k * 0.2), a.id);
  });
});
