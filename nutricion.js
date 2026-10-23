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
    B('pizza', 'Pizza de queso', 10.4, 29.0, 12.3, 268, 2.2, [['1 rebanada', 107]])
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
  // lista: [{ id, n, en?, ... }]; regresa los mejores `max`
  function buscar(lista, q, max) {
    const pal = sinAcentos(q).split(/\s+/).filter(w => w.length > 1);
    if (!pal.length) return [];
    const out = [];
    lista.forEach(a => {
      const es = ' ' + sinAcentos(a.n) + ' ', en = a.en ? ' ' + sinAcentos(a.en) + ' ' : '';
      let pts = 0;
      for (const w of pal) {
        const t = ES_EN[w], enEs = es.indexOf(' ' + w) > -1, enEn = en && (en.indexOf(' ' + w) > -1 || (t && en.indexOf(' ' + t) > -1));
        if (!enEs && !enEn) return;
        pts += enEs ? (es.indexOf(' ' + w + ' ') > -1 ? 3 : 2) : 1;
      }
      if (es.trim().indexOf(pal[0]) === 0) pts += 3;
      pts -= (ORDEN[String(a.id).split(':')[0]] || 0) * 1.2 + Math.min(3, a.n.length / 40);
      out.push({ a: a, pts: pts });
    });
    return out.sort((x, y) => y.pts - x.pts).slice(0, max || 30).map(x => x.a);
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
           normalizarEtiqueta, metas, buscar, desempacar, sinAcentos };
})();
if (typeof module !== 'undefined') module.exports = NUT;
