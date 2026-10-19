/**
 * Gym v7 – ejercicios populares para el Catálogo (versión 2: repara la columna G y es rápida).
 *
 * Si ya pegaste la versión anterior: bórrala completa (desde "Gym v7 – ejercicios populares" hasta el final)
 * y pega esta en su lugar. Guarda y corre agregarEjercicios() desde el editor (tarda unos segundos).
 *
 * - Repara la columna G ("Nombre en la app (auto)"): deja solo la fórmula de G2, que llena la columna sola.
 *   (La versión anterior escribía en G y eso rompía esa fórmula: G2 salía #REF!.)
 * - Quita filas vacías que hayan quedado entre ejercicios.
 * - No toca tus ejercicios ni repite los que ya estén: puedes correrla otra vez sin duplicar.
 * - Van sin bloque (columna I vacía): no cambian tu rotación A/B. Salen en "Más ejercicios", en el buscador,
 *   en "Músculos" ("Añadir a hoy") y en "Máquina ocupada → cambiar" (por su patrón de movimiento).
 * - Se insertan al final de su grupo (antes de "Otro ejercicio"), todos los del grupo de una vez.
 * - Lo hace en tu hoja y en la de cada persona que agregaste (Aaron). No hace falta volver a implementar la app web.
 */
// [grupo, ejercicio, series, reps mín, reps máx, cómo anotar, al subir (+/−), músculo, barra lb, multiplicador,
//  músculo secundario, patrón, técnica, modalidad, zonas]
const EJERCICIOS_V7 = [
  ['Push', 'Press militar con barra, de pie', 4, 6, 10, 'Por lado, sin la barra', '+2.5', 'Hombro', 45, 2, 'Tríceps', 'Press de hombro',
    'Glúteos y abdomen firmes, sin arquear la espalda baja · la barra sale de la clavícula y sube vertical pasando la cara · arriba mete la cabeza bajo la barra', 'Barra',
    'Deltoide frontal:1, Deltoide lateral:0.5, Tríceps:0.5'],
  ['Push', 'Press de hombro en máquina', 4, 8, 12, 'Placa de la máquina', '+5.0', 'Hombro', 0, 1, 'Tríceps', 'Press de hombro',
    'Asiento: agarres a la altura de los hombros · empuja sin despegar la espalda · baja lento hasta la barbilla', 'Placas',
    'Deltoide frontal:1, Deltoide lateral:0.5, Tríceps:0.5'],
  ['Push', 'Press inclinado en máquina', 4, 8, 12, 'Placa o por lado', '+5.0', 'Pecho', 0, 1, 'Hombro', 'Press de pecho',
    'Agarres a la altura del pecho alto, escápulas atrás · empuja sin despegar la espalda · regresa lento hasta sentir estiramiento', 'Placas',
    'Pecho superior:1, Deltoide frontal:0.5, Tríceps:0.5'],
  ['Push', 'Press inclinado en Smith', 4, 8, 12, 'Por lado (sin contar la barra)', '+2.5', 'Pecho', 0, 2, 'Hombro', 'Press de pecho',
    'Banco a 30° bajo la barra · baja a la parte alta del pecho con codos a ~45° · empuja sin despegar glúteos', 'Discos',
    'Pecho superior:1, Deltoide frontal:0.5, Tríceps:0.5'],
  ['Push', 'Aperturas con mancuernas', 4, 10, 15, 'Una mancuerna', '+2.5', 'Pecho', 0, 1, '', 'Aperturas',
    'Codos semi-flexionados y fijos · abre en arco hasta sentir estiramiento en el pecho · cierra sin chocar las mancuernas', 'Mancuerna',
    'Pecho medio:1'],
  ['Push', 'Cruces en polea de abajo hacia arriba', 4, 12, 15, 'Placa de cada lado', '+2.5', 'Pecho', 0, 1, '', 'Aperturas',
    'Poleas abajo, un paso al frente · sube en arco hasta la altura de la barbilla · aprieta el pecho alto 1 s', 'Polea',
    'Pecho superior:1'],
  ['Push', 'Elevaciones laterales en máquina', 4, 12, 20, 'Placa de la máquina', '+5.0', 'Hombro', 0, 1, '', 'Elevación lateral',
    'Hombro alineado con el eje de la máquina · sube con los codos hasta la altura del hombro · baja lento sin soltar la tensión', 'Placas',
    'Deltoide lateral:1'],
  ['Push', 'Fondos en máquina', 4, 8, 12, 'Placa de la máquina', '+5.0', 'Tríceps', 0, 1, 'Pecho', 'Tríceps',
    'Espalda pegada al respaldo · empuja hasta extender los codos sin bloquear de golpe · regresa lento hasta 90°', 'Placas',
    'Tríceps:1, Pecho medio:0.5'],

  ['Pull', 'Dominadas supinas', 4, 5, 10, 'Peso 0 o lastre que cargues', '+5.0', 'Espalda', 0, 1, 'Bíceps', 'Jalón vertical',
    'Palmas hacia ti al ancho de hombros · sube llevando el pecho a la barra · baja hasta estirar completo', 'Corporal',
    'Dorsal:1, Bíceps:1'],
  ['Pull', 'Jalón al pecho, agarre supino', 4, 8, 12, 'Placa de la máquina', '+5.0', 'Espalda', 0, 1, 'Bíceps', 'Jalón vertical',
    'Palmas hacia ti al ancho de hombros · baja la barra al pecho con los codos pegados · sube lento hasta estirar', 'Polea',
    'Dorsal:1, Bíceps:0.5'],
  ['Pull', 'Jalón a una mano', 4, 10, 12, 'Placa; reps por lado', '+2.5', 'Espalda', 0, 1, '', 'Jalón vertical',
    'Sentado de lado o arrodillado · baja el codo hacia la cadera · arriba estira completo el dorsal', 'Polea',
    'Dorsal:1'],
  ['Pull', 'Remo en polea a una mano', 4, 10, 12, 'Placa; reps por lado', '+2.5', 'Espalda', 0, 1, 'Bíceps', 'Remo',
    'Torso firme sin girar · jala el codo hacia la cadera · regresa estirando el dorsal', 'Polea',
    'Dorsal:1, Espalda media:0.5, Bíceps:0.5'],
  ['Pull', 'Remo con barra, agarre supino', 4, 8, 12, 'Por lado, sin la barra', '+2.5', 'Espalda', 45, 2, 'Bíceps', 'Remo',
    'Bisagra de cadera, torso a ~45°, espalda plana · palmas arriba · jala hacia el ombligo con los codos pegados', 'Barra',
    'Dorsal:1, Espalda media:0.5, Bíceps:0.5, Lumbar:0.5'],
  ['Pull', 'Remo invertido', 4, 8, 15, 'Peso 0', '0', 'Espalda', 0, 1, 'Bíceps', 'Remo',
    'Cuerpo recto bajo la barra (Smith o rack) · jala el pecho hacia la barra juntando escápulas · baja controlado', 'Corporal',
    'Espalda media:1, Dorsal:0.5, Bíceps:0.5, Deltoide posterior:0.5'],
  ['Pull', 'Pullover con mancuerna', 4, 10, 15, 'Una mancuerna', '+5.0', 'Espalda', 0, 1, 'Pecho', 'Jalón vertical',
    'Espalda alta en el banco, codos semi-flexionados · baja la mancuerna detrás de la cabeza hasta estirar · sube hasta encima del pecho', 'Mancuerna',
    'Dorsal:1, Pecho medio:0.5'],
  ['Pull', 'Curl bayesiano en polea', 4, 10, 15, 'Placa; reps por brazo', '+2.5', 'Bíceps', 0, 1, '', 'Bíceps',
    'De espaldas a la polea, brazo detrás del torso · sube sin adelantar el codo · baja hasta estirar completo', 'Polea',
    'Bíceps:1'],
  ['Pull', 'Curl araña', 4, 10, 15, 'Una mancuerna', '+2.5', 'Bíceps', 0, 1, '', 'Bíceps',
    'Pecho apoyado en banco inclinado, brazos colgando · sube sin mover los codos · aprieta 1 s arriba', 'Mancuerna',
    'Bíceps:1'],
  ['Pull', 'Curl invertido con barra', 4, 10, 15, 'Total de la barra', '+5.0', 'Bíceps', 0, 1, '', 'Antebrazo',
    'Palmas hacia abajo, codos fijos al costado · sube sin balancear · baja lento', 'Barra',
    'Antebrazo:1, Bíceps:0.5'],
  ['Pull', 'Curl de muñeca', 4, 12, 20, 'Una mancuerna', '+2.5', 'Bíceps', 0, 1, '', 'Antebrazo',
    'Antebrazos apoyados en el banco o en los muslos · flexiona solo la muñeca · baja lento hasta estirar', 'Mancuerna',
    'Antebrazo:1'],
  ['Pull', 'Paseo del granjero', 4, 30, 60, 'Una mancuerna; en reps anota segundos', '+5.0', 'Espalda', 0, 1, 'Core', 'Cargadas',
    'Mancuernas pesadas a los lados, hombros atrás · camina con pasos cortos y el abdomen firme · no dejes que el torso se incline', 'Mancuerna',
    'Antebrazo:1, Trapecio:0.5, Oblicuos:0.5'],

  ['Legs', 'Sentadilla en Smith', 4, 8, 12, 'Por lado (sin contar la barra)', '+5.0', 'Cuádriceps', 0, 2, 'Femoral y glúteo', 'Sentadilla',
    'Pies un poco al frente de la barra · baja con la espalda recta al menos a paralelo · empuja con todo el pie', 'Discos',
    'Cuádriceps:1, Glúteo:0.5, Aductores:0.5'],
  ['Legs', 'Peso muerto rumano con mancuernas', 4, 8, 12, 'Una mancuerna', '+5.0', 'Femoral y glúteo', 0, 1, 'Espalda', 'Bisagra de cadera',
    'Rodillas un poco flexionadas, espalda plana · lleva la cadera atrás con las mancuernas pegadas a las piernas · sube apretando glúteos', 'Mancuerna',
    'Isquiosurales:1, Glúteo:1, Lumbar:0.5'],
  ['Legs', 'Peso muerto sumo', 4, 6, 10, 'Por lado, sin la barra', '+5.0', 'Femoral y glúteo', 45, 2, 'Cuádriceps', 'Bisagra de cadera',
    'Pies anchos con puntas afuera, manos por dentro de las rodillas · pecho arriba, empuja el piso abriendo las rodillas · barra pegada al cuerpo', 'Barra',
    'Glúteo:1, Aductores:1, Cuádriceps:0.5, Isquiosurales:0.5, Lumbar:0.5'],
  ['Legs', 'Hip thrust en máquina', 4, 8, 12, 'Placa o por lado', '+10.0', 'Femoral y glúteo', 0, 1, '', 'Glúteo',
    'Espalda alta en el respaldo · sube hasta alinear torso y muslos · aprieta 1 s y baja controlado', 'Placas',
    'Glúteo:1, Isquiosurales:0.5'],
  ['Legs', 'Puente de glúteo', 4, 10, 20, 'Peso 0 o disco que cargues', '+5.0', 'Femoral y glúteo', 0, 1, '', 'Glúteo',
    'Espalda en el piso, talones cerca de la cadera · sube apretando glúteos sin arquear la espalda baja · aguanta 1 s arriba', 'Corporal',
    'Glúteo:1, Isquiosurales:0.5'],
  ['Legs', 'Curl nórdico', 4, 4, 10, 'Peso 0', '0', 'Femoral y glúteo', 0, 1, '', 'Curl femoral',
    'Rodillas en un cojín y tobillos sujetos · baja el torso recto lo más lento posible · ayúdate con las manos para subir', 'Corporal',
    'Isquiosurales:1'],
  ['Legs', 'Zancada inversa', 4, 8, 12, 'Una mancuerna; reps por pierna', '+5.0', 'Cuádriceps', 0, 1, 'Femoral y glúteo', 'Unilateral de pierna',
    'Paso largo hacia atrás · baja hasta que la rodilla de atrás casi toque el piso · empuja con el talón de adelante', 'Mancuerna',
    'Cuádriceps:1, Glúteo:1, Glúteo medio:0.5'],
  ['Legs', 'Elevación de pantorrilla a una pierna', 4, 10, 15, 'Una mancuerna; reps por pierna', '+5.0', 'Pantorrilla', 0, 1, '', 'Pantorrilla',
    'Punta en un escalón, apóyate con una mano · baja el talón hasta estirar · sube lo más alto posible y aguanta 1 s', 'Mancuerna',
    'Pantorrilla:1'],

  ['Core', 'Crunch abdominal', 4, 12, 20, 'Peso 0 o disco que cargues', '0', 'Core', 0, 1, '', 'Core flexión',
    'Espalda baja pegada al piso · enrolla el torso llevando las costillas hacia la cadera · baja lento', 'Corporal',
    'Abdomen:1'],
  ['Core', 'Crunch inverso', 4, 10, 15, 'Peso 0', '0', 'Core', 0, 1, '', 'Core flexión',
    'Acostado, rodillas a 90° · sube la cadera enrollando la pelvis hacia el pecho · baja lento, sin impulso', 'Corporal',
    'Abdomen:1'],
  ['Core', 'Elevaciones de rodillas en silla romana', 4, 10, 15, 'Peso 0', '0', 'Core', 0, 1, '', 'Core flexión',
    'Espalda pegada al respaldo, antebrazos apoyados · sube las rodillas al pecho enrollando la pelvis · baja lento', 'Corporal',
    'Abdomen:1'],
  ['Core', 'Leñador en polea', 4, 10, 12, 'Placa; reps por lado', '+2.5', 'Core', 0, 1, '', 'Core rotación',
    'De lado a la polea, brazos casi rectos · gira el torso en diagonal de arriba hacia abajo · cadera firme, regresa lento', 'Polea',
    'Oblicuos:1, Abdomen:0.5'],
  ['Core', 'Giros rusos', 4, 10, 20, 'Peso 0 o disco; reps por lado', '+2.5', 'Core', 0, 1, '', 'Core rotación',
    'Sentado, torso inclinado atrás y espalda recta · gira tocando el piso a cada lado · pies en el piso si estás empezando', 'Corporal',
    'Oblicuos:1'],
  ['Core', 'Hollow hold', 4, 20, 45, 'Peso 0; en reps anota segundos', '0', 'Core', 0, 1, '', 'Core estático',
    'Espalda baja pegada al piso · brazos y piernas estirados y despegados · si se arquea la espalda, dobla las rodillas', 'Corporal',
    'Abdomen:1']
];

function agregarEjercicios() {
  const resumen = [];
  paraTodos_(u => { resumen.push(u.nombre + ': ' + agregarEjerciciosA_(SpreadsheetApp.openById(u.ss))); });
  Logger.log('Listo.\n' + resumen.join('\n'));
}

// Repara la columna G y quita filas vacías intermedias; sirve sola si solo quieres arreglar la hoja
function repararCatalogo() {
  const resumen = [];
  paraTodos_(u => { resumen.push(u.nombre + ': ' + repararCatalogoA_(SpreadsheetApp.openById(u.ss).getSheetByName('Catálogo'))); });
  Logger.log(resumen.join('\n'));
}

function repararCatalogoA_(cat) {
  if (!cat) return 'no tiene pestaña Catálogo';
  const hechos = [];
  // 1) Columna G: si G2 es una fórmula de arreglo, todo lo de abajo debe estar vacío para que se expanda
  if (/ARRAYFORMULA/i.test(cat.getRange(2, 7).getFormula()) && cat.getMaxRows() > 2) {
    const g = cat.getRange(3, 7, cat.getMaxRows() - 2, 1);
    // Rota si G2 muestra #REF! (algo escrito abajo le estorba) o si hay fórmulas copiadas debajo
    if (/^#REF!/.test(cat.getRange(2, 7).getDisplayValue()) || g.getFormulas().some(r => r[0])) { g.clearContent(); hechos.push('columna G reparada'); }
  }
  // 2) Filas vacías entre ejercicios (sin grupo ni nombre) antes del último ejercicio
  const n = cat.getLastRow();
  if (n > 2) {
    const ab = cat.getRange(2, 1, n - 1, 2).getValues();
    let ultima = 0;
    ab.forEach((r, i) => { if (r[0] && r[1]) ultima = i; });
    let quitadas = 0;
    for (let i = ultima; i >= 0; i--) if (!ab[i][0] && !ab[i][1]) { cat.deleteRow(i + 2); quitadas++; }
    if (quitadas) hechos.push(quitadas + ' fila' + (quitadas === 1 ? '' : 's') + ' vacía' + (quitadas === 1 ? '' : 's') + ' quitada' + (quitadas === 1 ? '' : 's'));
  }
  return hechos.length ? hechos.join(', ') : 'sin cambios';
}

// Inserta en el Catálogo los ejercicios que falten, un bloque por grupo; devuelve un texto con lo que hizo
function agregarEjerciciosA_(ss) {
  const cat = ss.getSheetByName('Catálogo');
  if (!cat) return 'no tiene pestaña Catálogo';
  const reparado = repararCatalogoA_(cat);
  const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const ncols = Math.min(21, cat.getMaxColumns());
  const filas = cat.getRange(2, 1, Math.max(1, cat.getLastRow() - 1), 2).getValues();
  const existe = {};
  filas.forEach(r => { if (r[0] && r[1]) existe[r[0] + '|' + norm(r[1])] = true; });
  const faltan = EJERCICIOS_V7.filter(x => !existe[x[0] + '|' + norm(x[1])]);
  // De abajo hacia arriba, para que insertar un grupo no mueva las filas de los grupos que siguen
  const grupos = ['Core', 'Legs', 'Pull', 'Push'];
  grupos.forEach(g => {
    const nuevos = faltan.filter(x => x[0] === g);
    if (!nuevos.length) return;
    let despues = 0;
    filas.forEach((r, i) => { if (r[0] === g && !/^Otro ejercicio/.test(String(r[1]))) despues = i + 2; });
    if (!despues) despues = cat.getLastRow();
    cat.insertRowsAfter(despues, nuevos.length);                  // heredan el formato de la fila de arriba
    // A grupo, B ejercicio, C series, D mín, E máx, F cómo anotar · G NO se toca (la llena la fórmula de G2)
    cat.getRange(despues + 1, 1, nuevos.length, 6).setValues(nuevos.map(x => [x[0], x[1], x[2], x[3], x[4], x[5]]));
    // H incremento, I bloque (vacío), J músculo, K barra, L multiplicador, M secundario, N ajuste, O patrón,
    // P paso, Q video, R técnica, S modalidad, T zonas, U asignado
    const resto = nuevos.map(x => [x[6], '', x[7], x[8], x[9], x[10], '', x[11], '', '', x[12], x[13], x[14], ''].slice(0, ncols - 7));
    cat.getRange(despues + 1, 8, nuevos.length, ncols - 7).setValues(resto);
  });
  SpreadsheetApp.flush();
  return faltan.length + ' nuevos' + (EJERCICIOS_V7.length - faltan.length ? ', ' + (EJERCICIOS_V7.length - faltan.length) + ' ya estaban' : '') +
    (reparado !== 'sin cambios' ? ' · ' + reparado : '');
}
