// Galería de animaciones: una imagen con cada ejercicio en 4 momentos (abajo, subiendo, arriba, bajando) para revisarlas de un vistazo.
//   NODE_PATH=/opt/node-tools/node_modules node herramientas/galeria-animaciones.js [salida.png] [filtro]
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const RAIZ = path.join(__dirname, '..');
const SALIDA = process.argv[2] || path.join(RAIZ, 'galeria-animaciones.png'), FILTRO = (process.argv[3] || '').toLowerCase();
// Un ejercicio por familia y por variante que cambia el dibujo (modalidad o nombre)
const CASOS = [
  ['Sentadilla con barra', 'Barra'], ['Sentadilla goblet', 'Mancuerna'], ['Peso muerto rumano', 'Barra'], ['Peso muerto', 'Barra'], ['Hip thrust', 'Barra'], ['Puente de glúteo', 'Peso corporal'],
  ['Curl femoral acostado', 'Placas'], ['Curl femoral sentado', 'Placas'], ['Extensión de cuádriceps', 'Placas'], ['Prensa', 'Placas'], ['Zancada', 'Mancuerna'], ['Sentadilla búlgara', 'Mancuerna'],
  ['Elevación de pantorrilla de pie', 'Placas'], ['Remo sentado en polea', 'Polea'], ['Remo en máquina', 'Placas'], ['Remo con barra', 'Barra'], ['Remo con pecho apoyado', 'Mancuerna'],
  ['Remo en T', 'Barra'], ['Remo invertido', 'Peso corporal'], ['Jalón al pecho', 'Polea'], ['Dominadas', 'Peso corporal'], ['Dominadas asistidas', 'Placas'], ['Pullover en polea', 'Polea'],
  ['Pullover con mancuerna', 'Mancuerna'], ['Press de banca', 'Barra'], ['Press inclinado con mancuernas', 'Mancuerna'], ['Press militar de pie', 'Barra'], ['Press de hombro sentado', 'Mancuerna'],
  ['Press de pecho en máquina', 'Placas'], ['Fondos en máquina', 'Placas'], ['Fondos', 'Peso corporal'], ['Fondos asistidos', 'Placas'], ['Extensión de tríceps en polea', 'Polea'],
  ['Curl de bíceps', 'Mancuerna'], ['Curl en polea', 'Polea'], ['Curl de muñeca', 'Mancuerna'], ['Paseo del granjero', 'Mancuerna'], ['Crunch', 'Peso corporal'], ['Crunch en máquina', 'Placas'],
  ['Crunch inverso', 'Peso corporal'], ['Elevación de piernas en silla romana', 'Peso corporal'], ['Plancha', 'Peso corporal'], ['Hollow hold', 'Peso corporal'],
  ['Elevaciones laterales', 'Mancuerna'], ['Elevaciones laterales en polea', 'Polea'], ['Aperturas en máquina', 'Placas'], ['Cruces en polea', 'Polea'], ['Cruces en polea de abajo hacia arriba', 'Polea'],
  ['Giros rusos', 'Disco'], ['Leñador en polea', 'Polea'], ['Aductores en máquina', 'Placas'], ['Abductores en máquina', 'Placas']
].filter(c => !FILTRO || c[0].toLowerCase().includes(FILTRO));

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1000, height: 400 }, deviceScaleFactor: 1 });
  const css = ':root{--pri:#2f6fed;--pri-2:#8fb0f5;--acc:#f0533a;--muted:#7b8494;--card:#fff;--text:#1d2330;--line:#d5d9e0}' +
    'body{margin:0;font:12px system-ui;background:#eef0f4}.fila{display:flex;align-items:center;gap:4px;padding:4px 6px;border-bottom:1px solid #ccd}' +
    '.n{width:150px;font-weight:600}.c{width:200px;height:162px;background:#fff;border-radius:8px}.anim-ej{--persona:var(--pri);--persona2:var(--pri-2);--musculo:var(--acc);' +
    '--maq:color-mix(in srgb,var(--muted) 70%,var(--card));--maq2:color-mix(in srgb,var(--muted) 32%,var(--card));--peso:color-mix(in srgb,var(--text) 62%,var(--card));--piso:var(--line);--guia:var(--muted)}' +
    '.anim-ej svg{width:100%;height:100%}';
  await p.setContent('<style>' + css + '</style><div id="g"></div>');
  // Sin bucle ni observador: cada cuadro se queda en el momento pedido
  await p.evaluate(() => { window.requestAnimationFrame = () => 0; window.IntersectionObserver = function () { return { observe() {}, unobserve() {} }; }; });
  await p.addScriptTag({ content: fs.readFileSync(path.join(RAIZ, 'animaciones.js'), 'utf8') });
  await p.evaluate(casos => {
    const g = document.getElementById('g');
    casos.forEach(([ej, mod]) => {
      const fila = document.createElement('div'); fila.className = 'fila';
      const n = document.createElement('div'); n.className = 'n'; n.textContent = ej + ' · ' + mod; fila.appendChild(n);
      const ex = { ejercicio: ej, modalidad: mod };
      const T = ANIM.tempoDe('');
      // abajo, a medio subir, arriba (apretando), a medio bajar
      [T.concentrica + T.pico + T.excentrica + 50, T.concentrica * 0.18, T.concentrica + 20, T.concentrica + T.pico + T.excentrica * 0.5].forEach(ms => {
        const c = document.createElement('div'); c.className = 'c anim-ej'; fila.appendChild(c);
        ANIM.montar(c, ex, { reps: 10 }).cuadro(ms);
      });
      g.appendChild(fila);
    });
  }, CASOS);
  await p.screenshot({ path: SALIDA, fullPage: true });
  await b.close();
  console.log('Galería: ' + SALIDA + ' (' + CASOS.length + ' ejercicios)');
})();
