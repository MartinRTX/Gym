// Comida con macros: cuánto aporta cada alimento, recetas, el tupper de 3 toques, etiquetas leídas con la cámara y las metas del día.
// La proteína sigue siendo la protagonista: aquí solo se calcula; cómo se muestra lo decide app.js / comida.js.
// Lo cargan index.html (antes de app.js) y las pruebas (tests/nutricion.test.js).
const NUT = (() => {
  const r1 = x => Math.round((Number(x) || 0) * 10) / 10;
  const MAC = ['p', 'c', 'f', 'k', 'fib'];   // proteína, carbohidratos, grasa, kcal y fibra (g, salvo kcal)

  /* ----- Alimentos base: por 100 g (o 100 ml si u = 'ml'). Fuente: USDA FoodData Central, SR Legacy (dominio público), salvo
     src 'mx' = Tabla de composición de alimentos mexicanos (INCMNSZ, SiAgro de CONABIO) y src 'calc' = calculado con otros base.
     por: porciones comunes [texto, gramos o ml]. rol: lo que puede reemplazar a ese ingrediente en tus recetas ----- */
  const B = (id, n, p, c, f, k, fib, por, o) => Object.assign({ id: 'b:' + id, n: n, u: 'g', p: p, c: c, f: f, k: k, fib: fib, por: por || [], src: 'usda' }, o || {});
  const BASE = [
    // Licuado
    B('leche2', 'Leche semidescremada (2 %)', 3.3, 4.8, 2.0, 50, 0, [['1 vaso', 250], ['1 taza', 240]], { u: 'ml', rol: 'leche' }),
    B('leche-entera', 'Leche entera', 3.2, 4.8, 3.3, 61, 0, [['1 vaso', 250], ['1 taza', 240]], { u: 'ml', rol: 'leche' }),
    B('leche-light', 'Leche descremada (light)', 3.4, 5.0, 0.1, 34, 0, [['1 vaso', 250], ['1 taza', 240]], { u: 'ml', rol: 'leche' }),
    B('avena', 'Avena en hojuelas', 13.2, 67.7, 6.5, 379, 10.1, [['1/2 taza', 40], ['1 cucharada', 10]]),
    B('platano', 'Plátano', 1.1, 22.8, 0.3, 89, 2.6, [['1 mediano', 118], ['1 chico', 100]]),
    B('fresa-cong', 'Fresas congeladas', 0.4, 9.1, 0.1, 35, 2.1, [['1 taza', 150], ['1/2 taza', 75]]),
    B('whey', 'Proteína en polvo (whey, genérica)', 78.1, 6.3, 1.6, 352, 0, [['1 scoop', 30]], { rol: 'proteina' }),
    B('creatina', 'Creatina', 0, 0, 0, 0, 0, [['1 cucharadita', 5]]),
    B('linaza', 'Linaza molida', 18.3, 28.9, 42.2, 534, 27.3, [['1 cucharada', 7], ['2 cucharadas', 14]]),
    // Cena y tortillas
    B('tort-maiz', 'Tortilla de maíz', 5.8, 49.5, 1.1, 224, 0.9, [['1 tortilla', 30]], { rol: 'tortilla', src: 'mx' }),
    B('tort-harina', 'Tortilla de harina', 7.2, 47.7, 9.8, 295, 4.5, [['1 tortilla', 40]], { rol: 'tortilla', src: 'mx' }),
    B('queso-oaxaca', 'Queso Oaxaca', 22.8, 9.6, 18.5, 297, 0, [['1 puño', 30], ['para 2 quesadillas', 60]], { rol: 'queso', src: 'mx' }),
    B('queso-panela', 'Queso panela', 19.8, 6.2, 19.1, 276, 0, [['1 rebanada', 40]], { rol: 'queso', src: 'mx' }),
    B('queso-chihuahua', 'Queso Chihuahua', 21.6, 5.6, 29.7, 374, 0, [['1 rebanada', 30]], { rol: 'queso' }),
    B('queso-fresco', 'Queso fresco', 18.1, 3.0, 23.8, 299, 0, [['1 rebanada', 30]], { rol: 'queso' }),
    B('queso-cotija', 'Queso cotija', 20.0, 4.0, 30.0, 366, 0, [['1 cucharada', 10]], { rol: 'queso' }),
    B('frijol-refrito', 'Frijoles refritos', 6.1, 18.3, 3.9, 128, 2.3, [['2 cucharadas', 30], ['1/2 taza', 120]], { rol: 'frijol', src: 'mx' }),
    B('frijol-olla', 'Frijoles de olla (con caldo)', 5.8, 11.5, 0.3, 69, 5.5, [['1 cucharón', 120], ['1/2 taza', 86]], { rol: 'frijol', src: 'mx' }),
    B('frijol-negro', 'Frijoles negros cocidos', 8.9, 23.7, 0.5, 132, 8.7, [['1 cucharón', 120], ['1/2 taza', 86]], { rol: 'frijol' }),
    B('soya-text', 'Soya texturizada (seca)', 43.7, 34.2, 2.3, 310, 4.9, [['1 cucharada', 6], ['1/4 taza', 20]], { src: 'mx' }),
    // Tupper y del diario
    B('arroz', 'Arroz blanco cocido', 2.7, 28.2, 0.3, 130, 0.4, [['1 taza', 160], ['1/2 taza', 80]]),
    B('arroz-rojo', 'Arroz rojo guisado', 3.4, 25.6, 5.4, 176, 0, [['1 taza', 160], ['1/2 taza', 80]], { src: 'mx' }),
    B('picadillo', 'Picadillo de res (guisado)', 10.2, 8.2, 6.7, 160, 0.7, [['1 cucharón', 150], ['1 plato', 250]], { src: 'mx' }),
    B('pasta', 'Pasta o espagueti cocido', 5.8, 30.9, 0.9, 158, 1.8, [['1 taza', 140]]),
    B('sopa-fideo', 'Sopa de fideo', 1.6, 8.6, 1.6, 54, 0.5, [['1 plato', 250]], { src: 'calc', nota: '1/3 fideo cocido, caldo de jitomate y un poco de aceite' }),
    B('papa', 'Papa cocida', 1.7, 20.0, 0.1, 86, 1.8, [['1 mediana', 150]]),
    B('pollo', 'Pollo, pechuga cocida', 29.0, 0, 3.0, 151, 0, [['1 pieza', 120], ['tu palma', 100]]),
    B('pollo-muslo', 'Pollo, pierna o muslo cocido', 24.6, 0, 8.6, 176, 0, [['1 pieza', 100]]),
    B('res', 'Res guisada (pulpa o bistec)', 33.4, 0, 7.7, 212, 0, [['tu palma', 100]]),
    B('res-molida', 'Carne molida de res cocida', 27.0, 0, 17.4, 272, 0, [['1/2 taza', 80], ['tu palma', 100]]),
    B('cerdo', 'Cerdo guisado (pierna o espaldilla)', 26.8, 0, 8.9, 194, 0, [['tu palma', 100]]),
    B('huevo', 'Huevo', 12.6, 0.7, 9.5, 143, 0, [['1 huevo', 50], ['2 huevos', 100]]),
    B('huevo-revuelto', 'Huevo revuelto', 10.0, 1.6, 11.0, 149, 0, [['2 huevos', 110]]),
    B('atun', 'Atún en agua (escurrido)', 19.4, 0, 1.0, 86, 0, [['1 lata', 100]]),
    B('tilapia', 'Pescado (tilapia) cocido', 26.2, 0, 2.7, 128, 0, [['1 filete', 120]]),
    B('jamon', 'Jamón', 16.6, 3.6, 8.8, 164, 1.3, [['1 rebanada', 20]]),
    B('salchicha', 'Salchicha de pavo o pollo', 15.5, 2.7, 16.2, 223, 0, [['1 pieza', 45]]),
    B('chorizo', 'Chorizo', 13.6, 3.8, 25.1, 296, 0, [['2 cucharadas', 30]]),
    B('calabacita', 'Calabacitas cocidas', 0.9, 4.3, 0.3, 20, 1.4, [['1 taza', 180]]),
    B('nopales', 'Nopales cocidos', 1.4, 3.3, 0.1, 15, 2.0, [['1 taza', 150]]),
    B('zanahoria', 'Zanahoria cocida', 0.8, 8.2, 0.2, 35, 3.0, [['1/2 taza', 78]]),
    B('chayote', 'Chayote cocido', 0.6, 5.1, 0.5, 24, 2.8, [['1 taza', 160]]),
    B('jitomate', 'Jitomate', 0.9, 3.9, 0.2, 18, 1.2, [['1 mediano', 120]]),
    B('cebolla', 'Cebolla', 1.1, 9.3, 0.1, 40, 1.7, [['1/4 de cebolla', 30]]),
    B('aguacate', 'Aguacate', 2.0, 8.6, 15.4, 167, 6.8, [['1/2 aguacate', 70], ['1 rebanada', 30]]),
    B('aceite', 'Aceite vegetal', 0, 0, 100, 884, 0, [['1 cucharadita', 5], ['1 cucharada', 14]]),
    B('manteca', 'Manteca', 0, 0, 100, 902, 0, [['1 cucharadita', 5]]),
    B('crema', 'Crema', 2.4, 4.6, 19.4, 198, 0, [['1 cucharada', 15]]),
    B('salsa', 'Salsa roja o verde', 1.5, 6.6, 0.2, 29, 1.9, [['2 cucharadas', 30]]),
    B('yogurt-griego', 'Yogurt griego natural', 10.2, 3.6, 0.4, 59, 0, [['1 vaso', 170]]),
    B('requeson', 'Requesón o cottage', 10.5, 4.8, 2.3, 81, 0, [['1/2 taza', 113]]),
    B('pan-blanco', 'Pan de caja', 8.9, 49.4, 3.3, 266, 2.7, [['1 rebanada', 25]]),
    B('bolillo', 'Bolillo o telera', 9.8, 50.1, 3.9, 279, 1.8, [['1 pieza', 60]]),
    B('pan-dulce', 'Pan dulce', 6.2, 50.9, 16.4, 372, 2.4, [['1 pieza', 70]]),
    B('manzana', 'Manzana', 0.3, 13.8, 0.2, 52, 2.4, [['1 mediana', 180]]),
    B('naranja', 'Naranja', 0.9, 11.8, 0.1, 47, 2.4, [['1 mediana', 130]]),
    B('papaya', 'Papaya', 0.5, 10.8, 0.3, 43, 1.7, [['1 taza', 145]]),
    B('mango', 'Mango', 0.8, 15.0, 0.4, 60, 1.6, [['1 mediano', 200]]),
    B('crema-cacahuate', 'Crema de cacahuate', 22.2, 22.3, 51.4, 598, 5.0, [['1 cucharada', 16]]),
    B('almendras', 'Almendras', 21.2, 21.6, 49.9, 579, 12.5, [['1 puño', 28]]),
    B('cacahuates', 'Cacahuates tostados', 24.4, 21.3, 49.7, 587, 8.4, [['1 puño', 28]]),
    B('miel', 'Miel', 0.3, 82.4, 0, 304, 0.2, [['1 cucharada', 21]]),
    B('azucar', 'Azúcar', 0, 100, 0, 387, 0, [['1 cucharadita', 4]]),
    B('refresco', 'Refresco de cola', 0, 10.4, 0, 42, 0, [['1 lata', 355], ['600 ml', 600]], { u: 'ml' }),
    B('lentejas', 'Lentejas cocidas', 9.0, 20.1, 0.4, 116, 7.9, [['1 cucharón', 120]]),
    B('garbanzo', 'Garbanzos cocidos', 8.9, 27.4, 2.6, 164, 7.6, [['1/2 taza', 82]]),
    B('soya-cocida', 'Frijol de soya cocido', 18.2, 8.4, 9.0, 172, 6.0, [['1/2 taza', 86]]),
    B('tofu', 'Tofu firme', 9.0, 2.9, 4.2, 78, 0.9, [['1 porción', 100]]),
    B('elote', 'Elote cocido', 3.4, 21.0, 1.5, 96, 2.4, [['1 elote', 100]]),
    B('tamal', 'Tamal', 9.0, 18.0, 12.0, 216, 2.2, [['1 tamal', 150]]),
    B('taco', 'Taco de carne (tortilla suave)', 9.3, 20.2, 9.8, 206, 2.9, [['1 taco', 100]]),
    B('burrito', 'Burrito de carne y frijol', 11.5, 19.5, 7.5, 191, 3.0, [['1 burrito', 200]]),
    B('enchilada', 'Enchilada de queso', 11.2, 15.5, 18.5, 273, 1.9, [['1 enchilada', 100]]),
    B('hamburguesa', 'Hamburguesa sencilla', 15.7, 22.1, 11.6, 256, 1.1, [['1 hamburguesa', 220]]),
    B('pizza', 'Pizza de queso', 10.4, 29.0, 12.3, 268, 2.2, [['1 rebanada', 107]]),
    // Platillos que más se buscan y no estaban: estimados con los ingredientes base (tortilla, carne, queso…)
    B('chilaquiles', 'Chilaquiles (rojos o verdes, con queso y crema)', 5.5, 18.0, 9.0, 175, 2.2, [['1 plato', 300], ['1/2 plato', 150]], { src: 'calc' }),
    B('carne-asada', 'Carne asada (res, ya cocida)', 27.0, 0, 10.0, 198, 0, [['1 porción', 120], ['La de 1 taco', 40]], { src: 'calc' }),
    B('taco-asada', 'Taco de carne asada (tortilla de maíz)', 15.0, 17.5, 6.0, 185, 2.0, [['1 taco', 80], ['3 tacos', 240]], { src: 'calc' }),
    B('dogo', 'Dogo sonorense (salchicha con tocino)', 9.0, 18.0, 13.0, 225, 1.0, [['1 dogo', 200]], { src: 'calc' }),
    B('pollo-asado', 'Pollo asado (con piel)', 27.0, 0, 13.5, 230, 0, [['1/4 de pollo sin hueso', 200], ['1 pierna con muslo', 150]], { src: 'calc' }),
    B('quesadilla', 'Quesadilla de harina con queso', 13.9, 31.4, 14.6, 313, 1.2, [['1 quesadilla', 70], ['2 quesadillas', 140]], { src: 'calc' }),
    B('cereal', 'Cereal de caja (Cheerios, Corn Flakes…)', 8.0, 80.0, 3.5, 380, 7.0, [['1 taza', 30], ['1 plato hondo', 45]], { src: 'calc' }),
    // Botanas: se pueden contar por pieza ("6 doritos" = 6 × 2.5 g)
    B('doritos', 'Doritos Nacho (totopos de maíz)', 7.1, 64.0, 28.6, 540, 3.6, [['1 pieza', 2.5], ['Bolsa chica', 45], ['Bolsa mediana', 62]], { src: 'calc' }),
    B('sabritas', 'Sabritas (papas fritas de bolsa)', 6.5, 53.0, 35.0, 553, 4.4, [['1 papita', 1.8], ['Bolsa chica', 45], ['Bolsa mediana', 60]], { src: 'calc' })
  ];
  const BASE_POR_ID = {};
  BASE.forEach(a => { BASE_POR_ID[a.id] = a; });

  // Lo que aporta una cantidad (g o ml) de un alimento definido por 100
  function macros(al, cant) {
    const x = {}, q = Number(cant) || 0;
    MAC.forEach(k => { x[k] = al[k] === null || al[k] === undefined ? null : r1(al[k] * q / 100); });
    if (x.k === null && x.p !== null) x.k = Math.round(4 * (x.p || 0) + 4 * (x.c || 0) + 9 * (x.f || 0));
    return x;
  }
  function sumar(lista) {
    const t = { p: 0, c: 0, f: 0, k: 0, fib: 0 };
    (lista || []).forEach(m => { if (m) MAC.forEach(k => { t[k] += Number(m[k]) || 0; }); });
    MAC.forEach(k => { t[k] = k === 'k' ? Math.round(t[k]) : r1(t[k]); });
    return t;
  }

  /* ----- Recetas: ingredientes con cantidad. Un ingrediente con rol (leche, proteína…) se cambia en todas tus recetas
     cuando escaneas uno nuevo y lo eliges como "el de siempre" ----- */
  const RECETAS = [
    { id: 'licuado', n: 'Mi licuado', ico: '🥤', m: 'd', items: [
      { ref: 'b:leche2', q: 250, rol: 'leche' }, { ref: 'b:avena', q: 40 }, { ref: 'b:platano', q: 118 }, { ref: 'b:fresa-cong', q: 100 },
      { ref: 'b:whey', q: 30, rol: 'proteina' }, { ref: 'b:creatina', q: 5 }, { ref: 'b:linaza', q: 10 }] },
    { id: 'cena-harina', n: '2 quesadillas de harina', ico: '🌮', m: 'n', items: [
      { ref: 'b:tort-harina', q: 80 }, { ref: 'b:queso-oaxaca', q: 60 }, { ref: 'b:frijol-refrito', q: 60 }] },
    { id: 'cena-maiz', n: '2 quesadillas de maíz con soya', ico: '🌽', m: 'n', items: [
      { ref: 'b:tort-maiz', q: 60 }, { ref: 'b:queso-oaxaca', q: 60 }, { ref: 'b:frijol-refrito', q: 60 }, { ref: 'b:soya-text', q: 15 }] }
  ];
  // Totales de una receta; resolver(ref) da el alimento (base, productos tuyos o del catálogo)
  function receta(rec, resolver) {
    const items = (rec.items || []).map(it => {
      const al = resolver(it.ref);
      return Object.assign({}, it, { al: al, m: al ? macros(al, it.q) : null });
    });
    return { items: items, tot: sumar(items.map(x => x.m)), faltan: items.filter(x => !x.al).map(x => x.ref) };
  }
  // Diferencia lado a lado (b − a) de dos totales
  function diferencia(a, b) { const d = {}; MAC.forEach(k => { d[k] = k === 'k' ? Math.round(b[k] - a[k]) : r1(b[k] - a[k]); }); return d; }
  // Cambia el ingrediente de un rol en todas las recetas (la cantidad se queda, salvo que la porción nueva sea otra cosa: scoop de 33 g en vez de 30)
  function cambiarRol(recetas, rol, ref, cantPorcion) {
    let n = 0;
    (recetas || []).forEach(r => (r.items || []).forEach(it => {
      if (it.rol !== rol) return;
      it.ref = ref; n++;
      if (rol === 'proteina' && cantPorcion) it.q = cantPorcion;   // 1 scoop de la nueva
    }));
    return n;
  }

  /* ----- El tupper de mamá en 3 toques: qué proteína, con qué viene y qué tan lleno ----- */
  const TUPPER = {
    proteinas: [['pollo', 'Pollo', '🍗', 'b:pollo-muslo', 120], ['res', 'Res', '🥩', 'b:res', 110], ['cerdo', 'Cerdo', '🐖', 'b:cerdo', 110],
      ['molida', 'Picadillo', '🍖', 'b:picadillo', 220], ['huevo', 'Huevo', '🥚', 'b:huevo-revuelto', 110], ['atun', 'Atún', '🐟', 'b:atun', 100],
      ['pescado', 'Pescado', '🐠', 'b:tilapia', 120], ['sin', 'Sin carne', '🥗', null, 0]],
    lados: [['arroz', 'Arroz', '🍚', 'b:arroz-rojo', 150], ['frijol', 'Frijoles', '🫘', 'b:frijol-olla', 120], ['pasta', 'Pasta o sopa', '🍝', 'b:pasta', 140],
      ['papa', 'Papa', '🥔', 'b:papa', 150], ['verdura', 'Verduras', '🥕', 'b:calabacita', 120], ['nopal', 'Nopales', '🌵', 'b:nopales', 100]],
    tamanos: [['chico', 'Chico', 0.75], ['normal', 'Normal', 1], ['grande', 'Grande', 1.3]],
    aceite: 7   // g de aceite del guisado en un tupper normal (comida casera)
  };
  // sel = { prot: 'pollo', lados: ['arroz','frijol'], tam: 'normal', tort: 2 }
  function tupper(sel) {
    const f = (TUPPER.tamanos.find(t => t[0] === sel.tam) || TUPPER.tamanos[1])[2], items = [];
    const pr = TUPPER.proteinas.find(x => x[0] === sel.prot);
    if (pr && pr[3]) items.push({ ref: pr[3], q: Math.round(pr[4] * f) });
    (sel.lados || []).forEach(l => { const x = TUPPER.lados.find(y => y[0] === l); if (x) items.push({ ref: x[3], q: Math.round(x[4] * f) }); });
    if (items.length) items.push({ ref: 'b:aceite', q: Math.round(TUPPER.aceite * f) });
    if (sel.tort > 0) items.push({ ref: 'b:tort-maiz', q: 30 * sel.tort });
    return items;
  }
  function nombreTupper(sel) {
    const pr = TUPPER.proteinas.find(x => x[0] === sel.prot), ls = (sel.lados || []).map(l => (TUPPER.lados.find(y => y[0] === l) || [l, l])[1].toLowerCase());
    const partes = [pr && pr[0] !== 'sin' ? pr[1].toLowerCase() : 'sin carne'].concat(ls);
    const t = partes.length > 1 ? partes.slice(0, -1).join(', ') + ' y ' + partes[partes.length - 1] : partes[0];
    return 'Tupper: ' + t + (sel.tort ? ' + ' + sel.tort + ' tortilla' + (sel.tort > 1 ? 's' : '') : '') + (sel.tam && sel.tam !== 'normal' ? ' (' + sel.tam + ')' : '');
  }
  const claveTupper = sel => [sel.prot || 'sin', (sel.lados || []).slice().sort().join('+'), sel.tam || 'normal', sel.tort || 0].join('|');

  /* ----- Etiqueta nutricional (de una foto o de Open Food Facts): todo se pasa a "por 100 g o ml" ----- */
  // e = { nombre, marca, u: 'g'|'ml', por100: {p,c,f,k,fib} | null, porcion: { texto, cant, p,c,f,k,fib } | null }
  function normalizarEtiqueta(e) {
    const avisos = [], u = e.u === 'ml' ? 'ml' : 'g', por = e.porcion && Number(e.porcion.cant) > 0 ? e.porcion : null;
    let base = e.por100 && MAC.some(k => Number(e.por100[k]) > 0) ? e.por100 : null;
    const desdePorcion = por ? (() => { const x = {}; MAC.forEach(k => { x[k] = por[k] === null || por[k] === undefined || por[k] === '' ? null : r1(Number(por[k]) * 100 / Number(por.cant)); }); return x; })() : null;
    if (!base && desdePorcion) base = desdePorcion;
    else if (base && desdePorcion) {
      // Las dos columnas deben cuadrar: si no, la de la porción suele estar bien leída y la de 100 g confundida (o al revés)
      const mal = ['p', 'k'].some(k => base[k] > 0 && desdePorcion[k] > 0 && Math.abs(base[k] - desdePorcion[k]) / base[k] > 0.15);
      if (mal) avisos.push('Los valores por 100 ' + u + ' y por porción no cuadran: revisa la porción (' + por.cant + ' ' + u + ')');
    }
    if (!base) return { error: 'No encontré los valores nutricionales en la etiqueta' };
    const al = { n: String(e.nombre || 'Producto').slice(0, 60), marca: String(e.marca || '').slice(0, 40), u: u, src: e.src || 'etiqueta' };
    MAC.forEach(k => { al[k] = base[k] === null || base[k] === undefined || base[k] === '' ? (k === 'fib' ? 0 : null) : r1(base[k]); });
    if (al.k === null) al.k = Math.round(4 * (al.p || 0) + 4 * (al.c || 0) + 9 * (al.f || 0));
    // kcal ≈ 4·P + 4·C + 9·G (la fibra cuenta menos): si no cuadra, algo se leyó mal
    const calc = 4 * (al.p || 0) + 4 * (al.c || 0) + 9 * (al.f || 0);
    if (al.k > 20 && calc > 0 && Math.abs(calc - al.k) / al.k > 0.25) avisos.push('Las calorías (' + al.k + ') no cuadran con los macros (~' + Math.round(calc) + '): revisa los números');
    if ((al.p || 0) + (al.c || 0) + (al.f || 0) > 101) avisos.push('Proteína + carbohidratos + grasa pasan de 100 por 100 ' + u + ': seguro alguno es por porción');
    al.por = por ? [[String(por.texto || '1 porción').slice(0, 30), Number(por.cant)]] : [];
    return { al: al, avisos: avisos };
  }

  /* ----- Etiqueta completa (script 8.2): la IA solo copia la tabla y lo que dijiste; aquí se hacen TODAS las cuentas.
     Regresa el alimento por 100 g/ml (con porciones: 1 porción, 1 pieza, el envase) y lo que hace falta para la cantidad. ----- */
  function leerEtiqueta(r) {
    const e = normalizarEtiqueta(r);
    if (e.error) return e;
    const al = e.al, por = r.porcion && Number(r.porcion.cant) > 0 ? r.porcion : null;
    const porcionG = por ? Number(por.cant) : null, piezas = por && Number(por.piezas) > 0 ? Number(por.piezas) : null;
    const pieza = porcionG && piezas ? r1(porcionG / piezas) : null;
    // El envase: contenido neto → porciones por envase × porción → la columna "por envase" (su cantidad o, si no, por sus kcal)
    let envase = null, envaseDe = null;
    const env = r.envase || null;
    if (Number(r.contenido_neto) > 0) { envase = Number(r.contenido_neto); envaseDe = 'neto'; }
    else if (Number(r.porciones_envase) > 0 && porcionG) { envase = r1(Number(r.porciones_envase) * porcionG); envaseDe = 'porciones'; }
    else if (env && Number(env.cant) > 0) { envase = Number(env.cant); envaseDe = 'columna'; }
    else if (env && Number(env.k) > 0 && al.k > 0) { envase = Math.round(Number(env.k) / al.k * 100); envaseDe = 'kcal'; }
    const u = al.u;
    al.por = [];
    if (porcionG) al.por.push(['1 porción' + (por.texto && !/^1 porci/i.test(por.texto) ? ' (' + String(por.texto).slice(0, 20) + ')' : ''), porcionG]);
    // La pieza se llama como en la etiqueta ("3 galletas" → "1 galleta"), para que "4 galletas" se entienda al buscar
    const sust = por ? String(por.texto || '').replace(/^[\d.,½¼\s]+/, '').trim().split(/\s+/)[0] || '' : '';
    if (pieza) al.por.push(['1 ' + (sust && !/^porci/i.test(sust) ? raiz(sust.toLowerCase()) : 'pieza'), pieza]);
    if (envase) al.por.push(['Todo el envase', envase]);
    const declarada = r.declarada || (r.por100 && por ? 'ambas' : por ? 'porcion' : '100');
    return { al: al, avisos: e.avisos, info: { u: u, porcionG: porcionG, piezas: piezas, pieza: pieza, envase: envase, envaseDe: envaseDe, declarada: declarada,
             porcionTexto: por ? String(por.texto || '') : '' } };
  }
  // Lo que dijiste que comiste → gramos (o ml). falta: el dato que hay que pedirte (el tamaño del envase o el de una pieza)
  function gramosDeConsumo(consumo, info) {
    const c = consumo || {}, v = Number(c.valor), pg = info.porcionG;
    if (c.tipo === 'cantidad' && v > 0) return { q: r1(v), modo: 'g', valor: r1(v) };
    if (c.tipo === 'porciones' && v > 0 && pg) return { q: r1(v * pg), modo: 'porciones', valor: v };
    if (c.tipo === 'piezas' && v > 0) return info.pieza ? { q: r1(v * info.pieza), modo: 'piezas', valor: v } : { q: pg || 100, modo: 'g', valor: pg || 100, falta: 'pieza' };
    if (c.tipo === 'todo' || (c.tipo === 'fraccion' && v > 0)) {
      const f = c.tipo === 'todo' ? 1 : v;
      return info.envase ? { q: r1(f * info.envase), modo: 'envase', valor: f } : { q: null, modo: 'envase', valor: f, falta: 'envase' };
    }
    return pg ? { q: pg, modo: 'porciones', valor: 1 } : { q: 100, modo: 'g', valor: 100 };
  }
  // Gramos según cómo lo cuentas: g/ml, piezas, porciones o fracción del envase
  function gramosDe(modo, valor, info) {
    const v = Number(valor) || 0;
    if (modo === 'piezas') return info.pieza ? r1(v * info.pieza) : null;
    if (modo === 'porciones') return info.porcionG ? r1(v * info.porcionG) : null;
    if (modo === 'envase') return info.envase ? r1(v * info.envase) : null;
    return r1(v);
  }
  // ¿Es el mismo producto que ya tienes? (mismo código, o casi las mismas palabras en el nombre y la marca)
  function mismoProducto(a, b) {
    if (a.code && b.code && String(a.code) === String(b.code)) return true;
    const pal = x => new Set(sinAcentos((x.n || '') + ' ' + (x.marca || '')).split(/\s+/).filter(w => w.length > 2 && !VACIAS[w]).map(raiz));
    const pa = pal(a), pb = pal(b);
    if (!pa.size || !pb.size) return false;
    let comunes = 0; pa.forEach(w => { if (pb.has(w)) comunes++; });
    return comunes / Math.min(pa.size, pb.size) >= 0.75 && comunes >= Math.min(2, pa.size, pb.size);
  }

  /* ----- Metas del día. Proteína: la tuya (manda). Calorías: mantenimiento por peso y actividad, −15 % para bajar grasa sin perder músculo,
     y se ajustan con tu ritmo de peso real. Grasa 0.8 g/kg; fibra 14 g por cada 1000 kcal; carbohidratos, lo que queda ----- */
  function metas(o) {
    const kg = Number(o.peso) > 30 ? Number(o.peso) : 75, prot = Number(o.metaProt) || Math.round(kg * 1.8);
    const km = Number(o.kmSemana) || 0, dias = Math.min(7, Math.max(0, Number(o.diasGym) || 4));
    const mant = Math.round(kg * 28 + dias * kg * 0.6 + km * kg * 1.0 / 7);   // oficina + gym (~0.6 kcal/kg por sesión al día) + trote (~1 kcal/kg/km)
    const deficit = Math.round(mant * 0.15);
    let ajuste = 0, porque = '';
    const pct = o.ritmoPct;
    if (pct !== null && pct !== undefined) {
      if (pct < -1) { ajuste = 300; porque = 'bajas muy rápido (' + pct + ' %/sem)'; }
      else if (pct < -0.5) { ajuste = 175; porque = 'bajas un poco rápido (' + pct + ' %/sem)'; }
      else if (pct > 0.1 && !o.bajaCintura) { ajuste = -200; porque = 'estás subiendo (' + pct + ' %/sem)'; }
      else if (pct > -0.25 && !o.bajaCintura) { ajuste = -150; porque = 'vas lento (' + pct + ' %/sem)'; }
    }
    const k = Math.round((mant - deficit + ajuste) / 50) * 50;
    const f = Math.max(45, Math.round(kg * 0.8));
    const c = Math.max(100, Math.round((k - prot * 4 - f * 9) / 4 / 5) * 5);
    return { k: k, p: prot, c: c, f: f, fib: Math.round(k / 1000 * 14), mant: mant, deficit: deficit, ajuste: ajuste, porque: porque, kg: kg };
  }

  /* ----- Buscar en el catálogo: sin acentos, todas las palabras; primero lo base, luego tus productos, México y USDA.
     El USDA está en inglés: se busca también con la traducción de las palabras más comunes ----- */
  const ES_EN = { avena: 'oats', pollo: 'chicken', pechuga: 'breast', res: 'beef', carne: 'beef', cerdo: 'pork', puerco: 'pork', huevo: 'egg', leche: 'milk',
    queso: 'cheese', arroz: 'rice', frijol: 'beans', frijoles: 'beans', platano: 'banana', fresa: 'strawberries', fresas: 'strawberries', manzana: 'apple',
    naranja: 'orange', papa: 'potato', papas: 'potatoes', tortilla: 'tortilla', pan: 'bread', atun: 'tuna', pescado: 'fish', salmon: 'salmon',
    camaron: 'shrimp', yogurt: 'yogurt', mantequilla: 'butter', aceite: 'oil', azucar: 'sugar', miel: 'honey', nuez: 'walnuts', almendra: 'almonds',
    cacahuate: 'peanuts', cacahuates: 'peanuts', aguacate: 'avocado', jitomate: 'tomatoes', tomate: 'tomatoes', cebolla: 'onions', zanahoria: 'carrots',
    lechuga: 'lettuce', espinaca: 'spinach', brocoli: 'broccoli', calabaza: 'squash', elote: 'corn', maiz: 'corn', soya: 'soy', lenteja: 'lentils',
    lentejas: 'lentils', garbanzo: 'chickpeas', pavo: 'turkey', jamon: 'ham', tocino: 'bacon', salchicha: 'frankfurter', galleta: 'cookies',
    galletas: 'cookies', cereal: 'cereals', proteina: 'protein', linaza: 'flaxseed', chia: 'chia', mango: 'mangos', pina: 'pineapple', uva: 'grapes',
    sandia: 'watermelon', melon: 'melons', pera: 'pears', durazno: 'peaches', mayonesa: 'mayonnaise', crema: 'cream', helado: 'ice cream',
    chocolate: 'chocolate', refresco: 'carbonated', jugo: 'juice', cafe: 'coffee', cerveza: 'beer', vino: 'wine', pasta: 'pasta', espagueti: 'spaghetti',
    hamburguesa: 'hamburger', pizza: 'pizza', cocido: 'cooked', crudo: 'raw', frito: 'fried', asado: 'roasted', hervido: 'boiled' };
  const sinAcentos = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ');
  const ORDEN = { b: 0, p: 1, mx: 2, us: 3 };
  // lista: [{ id, n, en?, ... }]; regresa los mejores `max`.
  // Tolerante: no exige todas las palabras (con 2 basta una, con 3 o más puede faltar una), ignora las porciones
  // ("rebanada de pizza", "un scoop", "dos tacos"), entiende sinónimos ("coca" → refresco de cola) y corrige errores de dedo ("cherios").
  const VACIAS = { de: 1, del: 1, la: 1, el: 1, los: 1, las: 1, con: 1, en: 1, al: 1, un: 1, una: 1, unos: 1, unas: 1, mi: 1, me: 1, para: 1, y: 1, o: 1, a: 1,
    // Porciones y cantidades: dicen cuánto, no qué
    rebanada: 1, rebanadas: 1, pieza: 1, piezas: 1, pza: 1, pzas: 1, plato: 1, platos: 1, taza: 1, tazas: 1, vaso: 1, vasos: 1, cucharada: 1, cucharadas: 1,
    cucharadita: 1, cucharaditas: 1, porcion: 1, porciones: 1, orden: 1, ordenes: 1, medio: 1, media: 1, mitad: 1, grande: 1, grandes: 1, chico: 1, chica: 1,
    chicos: 1, chicas: 1, mediano: 1, mediana: 1, g: 1, gr: 1, grs: 1, gramos: 1, ml: 1, kg: 1, lata: 1, latas: 1, bolsa: 1, bolsita: 1, puno: 1, punado: 1,
    uno: 1, dos: 1, tres: 1, cuatro: 1, cinco: 1, seis: 1, siete: 1, ocho: 1, nueve: 1, diez: 1, docena: 1, comi: 1, tome: 1, desayune: 1, cene: 1, algo: 1, poco: 1 };
  // Cómo lo dices tú → cómo viene en el catálogo (sin acentos)
  const SINONIMOS = { scoop: ['proteina'], whey: ['proteina'], coca: ['cola', 'refresco'], cocacola: ['cola', 'refresco'], soda: ['refresco'], pepsi: ['cola', 'refresco'],
    dogo: ['dogo', 'salchicha'], hotdog: ['dogo', 'salchicha'], papitas: ['papa'], sabritas: ['papa'], bistec: ['res', 'bistec'], bisteck: ['res', 'bistec'],
    puerco: ['cerdo', 'porcinos'], cerdo: ['porcinos'], res: ['bovinos'], tomate: ['jitomate'], yogur: ['yogurt'], yoghurt: ['yogurt'], licuado: ['licuado', 'leche'],
    bimbo: ['pan'], hotcakes: ['hotcake', 'pancakes'], cheerios: ['cheerios', 'cereal'], corn: ['cereal'], flakes: ['cereal'], zucaritas: ['cereal'],
    asada: ['asada', 'asado', 'res'], tacos: ['taco'], quesadillas: ['quesadilla'], tortillas: ['tortilla'], frijol: ['frijol', 'frijoles'] };
  const raiz = w => w.length > 5 && /es$/.test(w) ? w.slice(0, -2) : w.length > 3 && /s$/.test(w) ? w.slice(0, -1) : w;
  // Cada alimento se normaliza una sola vez; el vocabulario (para corregir errores de dedo) se arma una vez por lista
  const NORM = new WeakMap();
  const norm = a => { let x = NORM.get(a); if (!x) { x = { es: ' ' + sinAcentos(a.n) + ' ', en: a.en ? ' ' + sinAcentos(a.en) + ' ' : '' }; NORM.set(a, x); } return x; };
  let VOC = null, VOC_DE = '';
  function vocabulario(lista) {
    const llave = lista.length + ':' + (lista[0] && lista[0].id) + ':' + (lista[lista.length - 1] && lista[lista.length - 1].id);
    if (VOC && VOC_DE === llave) return VOC;
    const v = new Map();
    lista.forEach(a => { const x = norm(a); (x.es + x.en).split(' ').forEach(t => { if (t.length > 3) v.set(t, (v.get(t) || 0) + 1); }); });
    VOC = v; VOC_DE = llave;
    return v;
  }
  // Distancia de edición con tope (más rápido: se corta en cuanto se pasa)
  function distancia(a, b, tope) {
    if (Math.abs(a.length - b.length) > tope) return tope + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i]; let min = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < min) min = cur[j];
      }
      if (min > tope) return tope + 1;
      prev = cur;
    }
    return prev[b.length];
  }
  // La palabra más parecida del catálogo cuando la tuya no aparece en ningún lado ("cherios" → "cheerios")
  function corregir(w, voc) {
    if (w.length < 4) return [];
    for (const t of voc.keys()) if (t.indexOf(w) === 0) return [];
    const tope = w.length >= 7 ? 2 : 1, cand = [];
    voc.forEach((n, t) => {
      const d = Math.min(distancia(w, t, tope), t.length > w.length ? distancia(w, t.slice(0, w.length), tope) + 0.5 : tope + 1);
      if (d <= tope) cand.push({ t: t, d: d, n: n });
    });
    return cand.sort((x, y) => x.d - y.d || y.n - x.n).slice(0, 2).map(x => x.t);
  }
  // Palabras de la búsqueda, cada una con sus formas aceptadas (y cuánto vale encontrar cada forma)
  function palabras(q, voc) {
    const vistas = {};
    return sinAcentos(q).split(/\s+/).filter(w => w.length > 1 && !VACIAS[w] && !/^\d+$/.test(w) && !vistas[w] && (vistas[w] = true)).map(w => {
      const f = [[w, 1]], mas = (t, v) => { if (t && !f.some(x => x[0] === t)) f.push([t, v]); };
      mas(raiz(w), 1);
      (SINONIMOS[w] || SINONIMOS[raiz(w)] || []).forEach(t => mas(t, 0.9));
      if (voc && !f.some(x => x[0] !== w && x[1] === 1 && voc.has(x[0]))) corregir(w, voc).forEach(t => mas(t, 0.8));
      return f;
    }).filter(f => f.length);
  }
  function buscar(lista, q, max) {
    const pal = palabras(q, lista.length > 200 ? vocabulario(lista) : null);
    if (!pal.length) return [];
    const n = pal.length, minimo = n <= 2 ? 1 : n - 1, out = [];
    lista.forEach(a => {
      const x = norm(a), es = x.es, en = x.en;
      let pts = 0, hay = 0;
      for (const formas of pal) {
        let mejor = 0;
        for (const [w, v] of formas) {
          const t = ES_EN[w];
          const p = es.indexOf(' ' + w + ' ') > -1 ? 3 : es.indexOf(' ' + w) > -1 ? 2 : en && (en.indexOf(' ' + w) > -1 || (t && en.indexOf(' ' + t) > -1)) ? 1 : 0;
          if (p * v > mejor) mejor = p * v;
        }
        if (mejor) { hay++; pts += mejor; }
      }
      if (hay < minimo) return;
      pts += hay === n ? 4 : -3 * (n - hay);
      if (pal[0].some(f => f[1] === 1 && es.trim().indexOf(f[0]) === 0)) pts += 3;
      pts -= (ORDEN[String(a.id).split(':')[0]] || 0) * 1.2 + Math.min(3, a.n.length / 40);
      out.push({ a: a, pts: pts });
    });
    return out.sort((x, y) => y.pts - x.pts).slice(0, max || 30).map(x => x.a);
  }
  // Cuánto dijiste que comiste: "4 rebanadas de pizza" → 4 × la rebanada del alimento (no 100 g ni la pizza entera).
  // Regresa { q, texto } o null si el texto no dice cantidad. Si dice gramos ("150 g") se usan tal cual.
  const NUMEROS = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, docena: 12, media: 0.5, medio: 0.5 };
  function cantidadDeTexto(texto, al) {
    const crudo = String(texto || '').toLowerCase(), t = sinAcentos(crudo);
    const g = /(\d+(?:[.,]\d+)?)\s*(g|gr|grs|gramos|ml)\b/.exec(crudo);
    if (g) { const v = Number(g[1].replace(',', '.')); return v > 0 && v <= 3000 ? { q: v, texto: v + ' ' + (g[2] === 'ml' ? 'ml' : 'g') } : null; }
    const pal = t.split(/\s+/).filter(Boolean), num = /(\d+(?:[.,]\d+)?)/.exec(crudo);
    let n = num ? Number(num[1].replace(',', '.')) : null;
    if (n === null) for (const w of pal) if (NUMEROS[w] !== undefined) { n = NUMEROS[w]; break; }
    const por = (al && al.por) || [];
    // La porción que nombraste ("rebanada", "taza", "scoop", "taco"…): se compara por raíz para que "rebanadas" sea "rebanada"
    const nombrada = por.find(x => sinAcentos(x[0].replace(/\(.*\)/, '')).split(/\s+/).some(pw => pw.length > 2 && !NUMEROS[pw] && !/^\d/.test(pw) && pal.some(w => w.length > 2 && raiz(w) === raiz(pw))));
    // Sin porción nombrada ("6 doritos"): la de una pieza; si no hay, la primera, pero nunca un envase (6 bolsas no)
    const pieza = por.find(x => /\b(pieza|papita|unidad|totopo|galleta)\b/i.test(x[0])), envase = x => /\b(bolsa|paquete|lata|botella|caja|frasco|sobre|envase)\b/i.test(sinAcentos(x[0]));
    const base = nombrada || (n !== null ? pieza || (por[0] && !envase(por[0]) ? por[0] : null) : null);
    if (!base || !(base[1] > 0)) return null;
    // "media taza" con una porción de "1/2 taza" es esa porción una vez, no la mitad
    let veces = n === null ? 1 : n;
    if (veces === 0.5 && /^1\/2\b/.test(base[0])) veces = 1;
    if (!(veces > 0 && veces <= 50)) return null;
    return { q: Math.round(veces * base[1] * 10) / 10, texto: (veces === 0.5 ? '½' : veces) + ' × ' + base[0].replace(/^1\s+/, '') };
  }
  // Catálogo grande (datos/alimentos.json): filas compactas → alimentos
  function desempacar(json) {
    return (json.a || []).map(r => ({ id: r[0], n: r[1], en: r[2] || '', g: r[3] || '', p: r[4], c: r[5], f: r[6], k: r[7], fib: r[8], u: r[9] || 'g',
                                      por: r[10] || [], src: String(r[0]).split(':')[0], crudo: !!r[11] }));
  }

  /* ----- Lo de antes: los botones fijos solo tenían proteína. Para los días viejos y los botones de siempre, sus macros estimados
     (mismo cálculo con los alimentos base; la proteína se queda como estaba) ----- */
  const LEGADO = {
    'Licuado': { p: 32, c: 14, f: 5.5, k: 231, fib: 0 }, 'Scoop': { p: 22, c: 2, f: 0.5, k: 100, fib: 0 },
    'Tupper carne': { p: 28, c: 45, f: 14, k: 430, fib: 6 }, 'Tupper pasta': { p: 12, c: 60, f: 10, k: 370, fib: 4 },
    'Cena huevos': { p: 30, c: 49, f: 20, k: 490, fib: 8 }, 'Cena pollo': { p: 40, c: 41, f: 22, k: 540, fib: 2 },
    'Quesadillas': { p: 16, c: 40, f: 15, k: 358, fib: 2 }, 'Huevos': { p: 12, c: 0.7, f: 9.5, k: 143, fib: 0 },
    'Atún': { p: 20, c: 0, f: 1, k: 86, fib: 0 }, 'Carne': { p: 25, c: 0, f: 6.5, k: 180, fib: 0 },
    'Leche': { p: 8, c: 12, f: 5, k: 125, fib: 0 }, 'Yogurt': { p: 15, c: 5.4, f: 0.6, k: 89, fib: 0 }, 'Calle': { p: 25, c: 60, f: 25, k: 560, fib: 4 }
  };

  return { MAC, BASE, BASE_POR_ID, RECETAS, TUPPER, LEGADO, ES_EN, r1, macros, sumar, receta, diferencia, cambiarRol, tupper, nombreTupper, claveTupper,
           normalizarEtiqueta, leerEtiqueta, gramosDeConsumo, gramosDe, mismoProducto, metas, buscar, cantidadDeTexto, desempacar, sinAcentos };
})();
if (typeof module !== 'undefined') module.exports = NUT;
