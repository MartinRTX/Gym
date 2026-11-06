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

test('Porción de varias piezas (2 mantecadas = 62 g): "1 mantecada" es media porción, no la porción entera', () => {
  // Así vienen muchos productos de marca en Open Food Facts: la porción del empaque es de 2 piezas
  const r = NUT.normalizarEtiqueta({ nombre: 'Mantecadas con nuez', marca: 'Bimbo', u: 'g', src: 'off', por100: { p: 6, c: 43.1, f: 29.3, k: 460 },
    porcion: { texto: '2 piezas (62 g)', cant: 62, p: 3.7, c: 26.7, f: 18.2, k: 285 } });
  assert.deepStrictEqual(r.al.por, [['2 piezas (62 g)', 62], ['1 pieza', 31]], 'la porción del empaque y una pieza');
  const q = t => (NUT.cantidadDeTexto(t, r.al) || {}).q;
  assert.strictEqual(q('1 mantecada'), 31);
  assert.strictEqual(q('una mantecada bimbo con nuez'), 31);
  assert.strictEqual(q('3 mantecadas'), 93);
  assert.strictEqual(q('2 piezas'), 62);
  cerca(NUT.macros(r.al, q('1 mantecada')).k, 143, 1);
  // La pieza toma el nombre del empaque y las abreviaturas se entienden
  const nombre = t => NUT.normalizarEtiqueta({ nombre: 'X', por100: { p: 6, c: 60, f: 20, k: 450 }, porcion: { texto: t, cant: 30, k: 135 } }).al.por[1][0];
  assert.strictEqual(nombre('3 galletas (30 g)'), '1 galleta');
  assert.strictEqual(nombre('2 pzas'), '1 pieza');
  assert.strictEqual(nombre('30 g (4 piezas)'), '1 pieza');
  // Si el empaque las llama "mantecadas", "1 mantecada" también es una pieza
  const m = NUT.normalizarEtiqueta({ nombre: 'Mantecadas', por100: { p: 6, c: 43.1, f: 29.3, k: 460 }, porcion: { texto: '2 mantecadas', cant: 62, k: 285 } }).al;
  assert.deepStrictEqual(m.por, [['2 mantecadas', 62], ['1 mantecada', 31]]);
  assert.strictEqual(NUT.cantidadDeTexto('1 mantecada', m).q, 31);
  assert.strictEqual(NUT.cantidadDeTexto('1 pan', m).q, 31, 'con un número y sin nombre conocido: una pieza, no la porción');
  // Una porción de 1 o medida en gramos/ml no se parte
  const por = t => NUT.normalizarEtiqueta({ nombre: 'X', por100: { p: 6, c: 60, f: 20, k: 450 }, porcion: { texto: t, cant: 30, k: 135 } }).al.por;
  assert.deepStrictEqual(por('1 pieza (30 g)'), [['1 pieza (30 g)', 30]]);
  assert.deepStrictEqual(por('30 g'), [['30 g', 30]]);
  assert.deepStrictEqual(por('1 porción'), [['1 porción', 30]]);
});

test('diceCuantas: "1 mantecada" sí (hay que saber cuánto pesa una); "62 g" o solo el nombre, no', () => {
  assert.ok(NUT.diceCuantas('1 mantecada'));
  assert.ok(NUT.diceCuantas('una mantecada bimbo con nuez'));
  assert.ok(!NUT.diceCuantas('mantecada 62 g'));
  assert.ok(!NUT.diceCuantas('mantecada bimbo'));
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

test('Buscar como escribes: plurales, "de", "con" y cantidades no estorban', () => {
  assert.strictEqual(NUT.buscar(NUT.BASE, 'frijoles de la olla')[0].id, 'b:frijol-olla');
  assert.ok(NUT.buscar(NUT.BASE, '2 tortillas de maíz').some(a => a.id === 'b:tort-maiz'));
  assert.ok(NUT.buscar(NUT.BASE, 'huevos').length > 0, 'huevos → huevo');
});

test('buscar es tolerante: porciones, sinónimos, errores de dedo y palabras que faltan', () => {
  const B = NUT.BASE, primero = q => (NUT.buscar(B, q)[0] || {}).id;
  assert.strictEqual(primero('rebanada de pizza'), 'b:pizza', 'las porciones no cuentan');
  assert.strictEqual(primero('un scoop de proteína'), 'b:whey');
  assert.strictEqual(primero('coca cola'), 'b:refresco', 'sinónimo');
  assert.strictEqual(primero('tacos de asada'), 'b:taco-asada', 'con dos palabras basta una si no hay más');
  assert.strictEqual(primero('chilaquiles verdes'), 'b:chilaquiles');
  assert.strictEqual(primero('dogo'), 'b:dogo');
  // Errores de dedo: se corrigen con el vocabulario de la lista (solo en listas grandes, como el catálogo)
  const grande = B.concat(Array.from({ length: 250 }, (_, i) => ({ id: 'mx:' + i, n: 'Relleno ' + i, p: 1, c: 1, f: 1, k: 10 })));
  assert.strictEqual((NUT.buscar(grande, 'torilla de harina')[0] || {}).id, 'b:tort-harina');
  assert.strictEqual((NUT.buscar(grande, 'pechga de pollo')[0] || {}).id, 'b:pollo');
  assert.deepStrictEqual(NUT.buscar(B, 'dos rebanadas'), [], 'solo porciones: nada que buscar');
});

test('cantidadDeTexto: lo que escribiste se vuelve gramos (4 rebanadas = 4 × rebanada, no la pizza entera)', () => {
  const b = id => NUT.BASE.find(a => a.id === 'b:' + id), q = (t, id) => (NUT.cantidadDeTexto(t, b(id)) || {}).q;
  assert.strictEqual(q('4 rebanadas de pizza', 'pizza'), 428);
  assert.strictEqual(q('una rebanada de pizza', 'pizza'), 107);
  assert.strictEqual(q('3 tacos de asada', 'taco-asada'), 240);
  assert.strictEqual(q('2 scoops de proteína', 'whey'), 60);
  assert.strictEqual(q('150 g de pollo', 'pollo'), 150, 'gramos tal cual');
  assert.strictEqual(q('media taza de avena', 'avena'), 40, 'media taza = la porción de 1/2 taza');
  assert.strictEqual(q('1,5 tazas de arroz', 'arroz'), 240);
  assert.strictEqual(q('dos tortillas de maíz', 'tort-maiz'), 60);
  assert.strictEqual(NUT.cantidadDeTexto('pizza', b('pizza')), null, 'sin cantidad: se queda la porción de siempre');
});

test('botanas por pieza: "6 doritos" son 6 piezas, no 6 bolsas', () => {
  const b = id => NUT.BASE.find(a => a.id === 'b:' + id);
  assert.strictEqual(NUT.buscar(NUT.BASE, '6 doritos nachos')[0].id, 'b:doritos');
  assert.strictEqual(NUT.cantidadDeTexto('6 doritos nachos', b('doritos')).q, 15);
  assert.strictEqual(NUT.cantidadDeTexto('10 sabritas', b('sabritas')).q, 18);
  assert.strictEqual(NUT.cantidadDeTexto('una bolsa de sabritas', b('sabritas')).q, 45);
  assert.strictEqual(NUT.cantidadDeTexto('2 cocas', { n: 'Coca', por: [['1 lata', 355]] }), null, 'un número solo no multiplica envases');
});

test('leerEtiqueta: la app hace las cuentas (NOM-051 por porción, piezas y envase)', () => {
  // Galletas: tabla solo por porción (30 g = 3 galletas), 6 porciones por envase, sin contenido neto
  const g = NUT.leerEtiqueta({ nombre: 'Marías', u: 'g', declarada: 'porcion', por100: null,
    porcion: { texto: '3 galletas', cant: 30, piezas: 3, p: 2.1, c: 22.5, f: 3, k: 125, fib: 0.6 }, porciones_envase: 6 });
  assert.strictEqual(g.al.p, 7, 'por 100 g = porción × 100 / 30');
  assert.strictEqual(g.info.pieza, 10);
  assert.strictEqual(g.info.envase, 180);
  assert.strictEqual(g.info.envaseDe, 'porciones');
  assert.deepStrictEqual(NUT.gramosDeConsumo({ tipo: 'piezas', valor: 6 }, g.info), { q: 60, modo: 'piezas', valor: 6 });
  assert.strictEqual(NUT.gramosDeConsumo({ tipo: 'fraccion', valor: 0.5 }, g.info).q, 90);
  assert.strictEqual(NUT.gramosDeConsumo({ tipo: 'todo' }, g.info).q, 180);
  assert.strictEqual(NUT.gramosDeConsumo(null, g.info).q, 30, 'sin decir cuánto: 1 porción');
  // Bebida con columnas 100 ml y "por envase" (sin cantidad): el envase sale por las kcal
  const b = NUT.leerEtiqueta({ nombre: 'Jugo', u: 'ml', declarada: 'ambas', por100: { p: 0, c: 11, f: 0, k: 44, fib: 0 },
    porcion: null, envase: { cant: null, p: 0, c: 46, f: 0, k: 185 } });
  assert.strictEqual(b.info.envase, 420);
  // Sin ningún dato del envase: "todo" pide el tamaño
  const s = NUT.leerEtiqueta({ nombre: 'Barra', u: 'g', por100: { p: 20, c: 40, f: 15, k: 375, fib: 5 } });
  const t = NUT.gramosDeConsumo({ tipo: 'todo' }, s.info);
  assert.strictEqual(t.falta, 'envase'); assert.strictEqual(t.q, null);
  assert.strictEqual(NUT.gramosDe('envase', 0.5, Object.assign({}, s.info, { envase: 50 })), 25);
});

test('mismoProducto: no duplica (mismo código o casi el mismo nombre)', () => {
  assert.ok(NUT.mismoProducto({ n: 'Galletas Marías', marca: 'Gamesa' }, { n: 'Marías Gamesa', marca: '' }));
  assert.ok(NUT.mismoProducto({ n: 'X', code: '750100' }, { n: 'Y', code: '750100' }));
  assert.ok(!NUT.mismoProducto({ n: 'Galletas Marías', marca: 'Gamesa' }, { n: 'Galletas Emperador', marca: 'Gamesa' }));
});

test('revisarMacros y marcarSeco: lo que no puede ser sale marcado', () => {
  assert.ok(NUT.revisarMacros({ p: 20, c: 0, f: 8, k: 72 }, 10).some(a => /pesan más/.test(a)), 'mantequilla 10 g con 20 g de proteína');
  assert.ok(NUT.revisarMacros({ p: 71.4, c: 57.6, f: 1.8, k: 533 }, 150).some(a => /mucho/.test(a)));
  assert.ok(NUT.revisarMacros({ p: 10, c: 10, f: 10, k: 500 }, 100).some(a => /no cuadran/.test(a)));
  assert.deepStrictEqual(NUT.revisarMacros({ p: 0.1, c: 0, f: 8.1, k: 72 }, 10), []);
  // v9.9: si el nombre dice que es polvo o seco, mucha proteína por gramo es lo normal (las otras revisiones siguen)
  assert.deepStrictEqual(NUT.revisarMacros({ p: 23.4, c: 1.9, f: 0.5, k: 106 }, 30, 'Proteína en polvo (whey, genérica)'), []);
  assert.deepStrictEqual(NUT.revisarMacros({ p: 13, c: 10.3, f: 0.7, k: 93 }, 30, 'Soya texturizada (seca)'), []);
  assert.ok(NUT.revisarMacros({ p: 23.4, c: 1.9, f: 0.5, k: 106 }, 30, 'Licuado').some(a => /mucho/.test(a)), 'sin decir polvo, sí avisa');
  assert.ok(NUT.revisarMacros({ p: 40, c: 0, f: 0, k: 160 }, 30, 'Proteína en polvo').some(a => /pesan más/.test(a)), 'aunque sea polvo, no puede pesar más');
  assert.ok(NUT.marcarSeco({ n: 'Soja (Soya) Frijol, Proteína', p: 47.6, c: 38.4, f: 1.2 }).seco);
  assert.ok(NUT.marcarSeco({ n: 'Leche De Vaca, Entera', p: 29.4, c: 38, f: 26 }).seco);
  assert.ok(!NUT.marcarSeco({ n: 'Leche De Vaca, En Polvo Entera', p: 24.9, c: 38, f: 27 }).seco, 'ya dice que es polvo');
  assert.ok(!NUT.marcarSeco({ n: 'Leche De Vaca, Entera Deslactosada', p: 2.9, c: 4.7, f: 3.2 }).seco);
  assert.strictEqual(NUT.buscar(NUT.BASE, 'frijoles con soya')[0].id, 'b:frijol-soya');
  assert.strictEqual(NUT.buscar(NUT.BASE, 'mantequilla')[0].id, 'b:mantequilla');
  assert.strictEqual(NUT.buscar(NUT.BASE, 'pan birote')[0].id, 'b:bolillo');
});

test('porciones de la IA: 1 → 3 galletas sube todo parejo; un ingrediente cambia el plato', () => {
  const galleta = { nombre: 'Galleta salada', gramos: 20, piezas: 1, g_pieza: 20, g: 2, c: 14, f: 2, k: 82, fib: 1 };
  NUT.escalarItem(galleta, 3);
  assert.deepStrictEqual([galleta.piezas, galleta.gramos, galleta.g, galleta.c, galleta.k], [3, 60, 6, 42, 246]);
  assert.deepStrictEqual(NUT.revisarMacros({ p: galleta.g, c: galleta.c, f: galleta.f, k: galleta.k }, galleta.gramos), [], 'sin avisos');
  const ens = { nombre: 'Ensalada', ingredientes: [{ nombre: 'Lechuga', gramos: 80, g: 1, c: 2.3, f: 0.1, k: 12, fib: 1 }, { nombre: 'Atún', gramos: 100, g: 19.4, c: 0, f: 1, k: 86, fib: 0 }] };
  NUT.sumarIngredientes(ens);
  assert.deepStrictEqual([ens.gramos, ens.g, ens.k], [180, 20, 98]);
  NUT.cantidadIngrediente(ens.ingredientes[1], 150); NUT.sumarIngredientes(ens);
  assert.deepStrictEqual([ens.ingredientes[1].g, ens.gramos, ens.g, ens.k], [29.1, 230, 30, 141]);
});
