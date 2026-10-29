// Datos de prueba: la forma exacta de getData() del script, con números ficticios (sin datos de nadie).
// "Hoy" es el día en que corre la prueba. MOCK_VIEJO=1: como un script anterior a la 7.4 (sin progresión).
const d = JSON.parse(require('fs').readFileSync(__dirname + '/datos-prueba.json', 'utf8'));
const k = new Date(), dia = k.getFullYear() + '-' + String(k.getMonth() + 1).padStart(2, '0') + '-' + String(k.getDate()).padStart(2, '0');
d.todayKey = dia; d.ia = false;
if (process.env.MOCK_VIEJO) {
  delete d.scriptVersion;
  d.exercises.forEach(e => { delete e.prog; e.up = false; e.hint = 'Intenta 1 rep más en alguna serie'; e.anterior.forEach(a => delete a.rpe);
    e.sets = e.anterior.length ? e.anterior.map(a => ({ w: a.w, r: a.r, t: a.t })) : e.sets; });
}
module.exports = d;
