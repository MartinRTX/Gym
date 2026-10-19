/**
 * Gym v7 – ejercicios populares para el Catálogo.
 *
 * Pega este bloque AL FINAL de tu script (no borres nada de lo que ya tienes), guarda y corre una vez
 * agregarEjercicios() desde el editor. Los agrega a tu hoja y a la de cada persona que agregaste (Aaron).
 *
 * - No toca tus ejercicios: si un nombre ya existe en el Catálogo, lo salta. Puedes correrla de nuevo sin duplicar.
 * - Van sin bloque (columna I vacía): no cambian tu rotación A/B. Salen en "Más ejercicios", en el buscador,
 *   en el mapa de músculos ("Añadir a hoy") y en "Máquina ocupada → cambiar" (por su patrón de movimiento).
 * - Cada uno se inserta al final de su grupo (antes de "Otro ejercicio"), con el formato de la fila de arriba.
 * - No hace falta volver a implementar la app web: la app lee el Catálogo cada vez que se actualiza.
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

// Inserta en el Catálogo de una hoja los ejercicios que falten; devuelve un texto con lo que hizo
function agregarEjerciciosA_(ss) {
  const cat = ss.getSheetByName('Catálogo');
  if (!cat) return 'no tiene pestaña Catálogo';
  const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const ncols = Math.min(21, cat.getMaxColumns());
  const formulaG = cat.getRange(2, 7).getFormulaR1C1();          // "Nombre en la app (auto)": si es fórmula, se copia
  let nuevos = 0, saltados = 0;
  EJERCICIOS_V7.forEach(x => {
    const filas = cat.getRange(2, 1, Math.max(1, cat.getLastRow() - 1), 2).getValues();
    if (filas.some(r => r[0] === x[0] && norm(r[1]) === norm(x[1]))) { saltados++; return; }
    // Última fila de su grupo que no sea "Otro ejercicio…": ahí debajo va el nuevo
    let despues = 0;
    filas.forEach((r, i) => { if (r[0] === x[0] && !/^Otro ejercicio/.test(String(r[1]))) despues = i + 2; });
    if (!despues) despues = cat.getLastRow();
    cat.insertRowsAfter(despues, 1);                              // hereda el formato de la fila de arriba
    const fila = despues + 1;
    // A grupo, B ejercicio, C series, D mín, E máx, F cómo anotar, G nombre, H incremento, I bloque (vacío), J músculo,
    // K barra, L multiplicador, M secundario, N ajuste, O patrón, P paso, Q video, R técnica, S modalidad, T zonas, U asignado
    const v = [x[0], x[1], x[2], x[3], x[4], x[5], x[0] + ': ' + x[1], x[6], '', x[7], x[8], x[9], x[10], '', x[11], '', '', x[12], x[13], x[14], ''];
    cat.getRange(fila, 1, 1, ncols).setValues([v.slice(0, ncols)]);
    if (formulaG) cat.getRange(fila, 7).setFormulaR1C1(formulaG);
    nuevos++;
  });
  SpreadsheetApp.flush();
  return nuevos + ' nuevos' + (saltados ? ', ' + saltados + ' ya estaban' : '');
}
