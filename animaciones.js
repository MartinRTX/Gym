/* Animaciones de cada ejercicio: una figura que hace el movimiento sobre su equipo, sin video ni internet.
   - Una animación por familia de movimiento (remo, jalón, sentadilla…); el equipo se dibuja según la modalidad del Catálogo.
   - De lado (perfil) casi todas; de frente las que se entienden mejor así (elevaciones laterales, aperturas, giros, aductores).
   - Tempo de hipertrofia (sube rápido, aprieta, baja lento) o el que pongas en el Catálogo (columna W, ej. "3-1-1-0").
   - Se crea una vez y en cada cuadro solo cambian atributos; solo se mueven las que están en pantalla.
   En el navegador queda en window.ANIM; en Node (pruebas) se exportan las funciones puras. */
(function (raiz) {
  'use strict';
  const PISO = 245;
  const L = { torso: 64, cuello: 9, cabeza: 10, brazo: 30, antebrazo: 28, muslo: 42, pierna: 40 };

  /* =============== Geometría =============== */
  const rad = a => a * Math.PI / 180;
  const P = (x, y) => ({ x: x, y: y });
  const mas = (p, l, a) => P(p.x + l * Math.cos(rad(a)), p.y + l * Math.sin(rad(a)));
  const resta = (a, b) => P(a.x - b.x, a.y - b.y);
  const suma = (a, b) => P(a.x + b.x, a.y + b.y);
  const largo = v => Math.hypot(v.x, v.y);
  const mezcla = (a, b, t) => a + (b - a) * t;
  const mezclaP = (a, b, t) => P(mezcla(a.x, b.x, t), mezcla(a.y, b.y, t));
  const angulo = v => Math.atan2(v.y, v.x) * 180 / Math.PI;
  // Lado "frente" de un segmento a→b (figura de lado mirando a la derecha). En el torso (cadera→hombro) cae en la espalda.
  const frente = (a, b) => { const d = resta(b, a), n = largo(d) || 1; return P(d.y / n, -d.x / n); };
  const ESPALDA = 1, PECHO = -1;

  // Cinemática inversa de 2 huesos: el codo (o la rodilla) para que la mano (o el pie) llegue al objetivo.
  // doblar: 'abajo' | 'arriba' | 'atras' | 'adelante' (hacia dónde se dobla la articulación)
  function ik(origen, objetivo, a, b, doblar) {
    const d = resta(objetivo, origen), dist = Math.max(Math.abs(a - b) + 0.01, Math.min(largo(d), a + b - 0.01)), base = Math.atan2(d.y, d.x);
    const c = Math.acos(Math.max(-1, Math.min(1, (a * a + dist * dist - b * b) / (2 * a * dist))));
    const e1 = P(origen.x + a * Math.cos(base + c), origen.y + a * Math.sin(base + c));
    const e2 = P(origen.x + a * Math.cos(base - c), origen.y + a * Math.sin(base - c));
    const elige = { abajo: e1.y > e2.y, arriba: e1.y < e2.y, atras: e1.x < e2.x, adelante: e1.x > e2.x }[doblar || 'abajo'];
    const medio = elige ? e1 : e2;
    return { medio: medio, fin: mas(medio, b, angulo(resta(objetivo, medio))) };
  }

  // De pie: el tobillo fijo en el piso y la cadena se calcula hacia arriba (los pies nunca flotan)
  function dePie(tobillo, q) {
    const rodilla = mas(tobillo, L.pierna, q.pierna), cadera = mas(rodilla, L.muslo, q.muslo);
    let torso = q.torso;
    // Con barra en la espalda: el torso se inclina lo justo para que la barra quede sobre medio pie
    if (q.barraSobre !== undefined) torso = -Math.acos(Math.max(-1, Math.min(1, (q.barraSobre - cadera.x) / L.torso))) * 180 / Math.PI;
    return { tobillo: tobillo, rodilla: rodilla, cadera: cadera, torso: torso };
  }
  // Desde la cadera (sentado, acostado o colgado): la cadera está fija y las piernas salen de ahí
  function desdeCadera(cadera, q) {
    const rodilla = mas(cadera, L.muslo, q.muslo), tobillo = mas(rodilla, L.pierna, q.pierna);
    return { tobillo: tobillo, rodilla: rodilla, cadera: cadera, torso: q.torso };
  }
  // Brazos: con ángulos {brazo, antebrazo} o con la mano en un punto {mano, doblar}
  function completar(j, brazo) {
    j.hombro = j.hombro || mas(j.cadera, L.torso, j.torso);
    j.cuello = mas(j.hombro, L.cuello, j.torso);
    j.cabeza = mas(j.cuello, L.cabeza, j.torso);
    const pie = j.pie === undefined ? 0 : j.pie;
    j.talon = mas(j.tobillo, 6, pie + 160); j.punta = mas(j.tobillo, 17, pie + 8);
    if (brazo && brazo.mano) { const r = ik(j.hombro, brazo.mano, L.brazo, L.antebrazo, brazo.doblar); j.codo = r.medio; j.mano = r.fin; }
    else if (brazo) { j.codo = mas(j.hombro, L.brazo, brazo.brazo); j.mano = mas(j.codo, L.antebrazo, brazo.antebrazo); }
    return j;
  }

  /* =============== Siluetas con volumen =============== */
  const f1 = v => v.x.toFixed(1) + ' ' + v.y.toFixed(1);
  // Miembro con forma: ancho al inicio, en el vientre del músculo (tm) y al final, con puntas redondas
  function miembro(a, b, w0, wm, w1, tm) {
    const n = frente(a, b), m = mezclaP(a, b, tm === undefined ? 0.4 : tm);
    const lado = (p, w, s) => P(p.x + n.x * w / 2 * s, p.y + n.y * w / 2 * s);
    if (largo(resta(b, a)) < 0.5) return 'M' + f1(P(a.x - w0 / 2, a.y)) + ' a' + (w0 / 2).toFixed(1) + ' ' + (w0 / 2).toFixed(1) + ' 0 1 0 ' + w0.toFixed(1) + ' 0 a' + (w0 / 2).toFixed(1) + ' ' + (w0 / 2).toFixed(1) + ' 0 1 0 ' + (-w0).toFixed(1) + ' 0';
    const a1 = lado(a, w0, 1), m1 = lado(m, wm, 1), b1 = lado(b, w1, 1), b2 = lado(b, w1, -1), m2 = lado(m, wm, -1), a2 = lado(a, w0, -1);
    return 'M' + f1(a1) + ' Q' + f1(m1) + ' ' + f1(b1) + ' A' + (w1 / 2).toFixed(1) + ' ' + (w1 / 2).toFixed(1) + ' 0 0 1 ' + f1(b2) +
      ' Q' + f1(m2) + ' ' + f1(a2) + ' A' + (w0 / 2).toFixed(1) + ' ' + (w0 / 2).toFixed(1) + ' 0 0 1 ' + f1(a1) + 'Z';
  }
  // Músculo pegado a un lado del hueso (s = 1 lado "frente", -1 el otro), de 'de' a 'hasta' a lo largo del segmento
  function musculo(a, b, s, ancho, de, hasta, abulta) {
    const n = frente(a, b), x = mezclaP(a, b, de), y = mezclaP(a, b, hasta), off = ancho * 0.32 * s;
    return miembro(P(x.x + n.x * off, x.y + n.y * off), P(y.x + n.x * off, y.y + n.y * off), ancho * 0.35, ancho * 0.62 * (abulta || 1), ancho * 0.3, 0.5);
  }
  const centro = (a, b, s, ancho, de, hasta) => { const n = frente(a, b), m = mezclaP(a, b, (de + hasta) / 2), off = ancho * 0.32 * s; return P(m.x + n.x * off, m.y + n.y * off); };
  const circulo = (c, r) => 'M' + (c.x - r).toFixed(1) + ' ' + c.y.toFixed(1) + ' a' + r + ' ' + r + ' 0 1 0 ' + (2 * r) + ' 0 a' + r + ' ' + r + ' 0 1 0 ' + (-2 * r) + ' 0';
  function gluteo(j) {
    const atras = frente(j.cadera, j.hombro), u = resta(j.hombro, j.cadera), n = largo(u), up = P(u.x / n, u.y / n);
    const a = P(j.cadera.x + atras.x * 6 + up.x * 6, j.cadera.y + atras.y * 6 + up.y * 6), b = P(j.cadera.x + atras.x * 7 - up.x * 8, j.cadera.y + atras.y * 7 - up.y * 8);
    return { d: miembro(a, b, 10, 15, 10, 0.5), c: mezclaP(a, b, 0.5) };
  }
  // Músculos de lado listos para usar
  const M = {
    cuadriceps: (j, t) => ({ d: musculo(j.cadera, j.rodilla, 1, 16, 0.12, 0.92, 1 + 0.12 * t), c: centro(j.cadera, j.rodilla, 1, 16, 0.12, 0.92) }),
    isquios: (j, t) => ({ d: musculo(j.cadera, j.rodilla, -1, 16, 0.15, 0.92, 1 + 0.1 * t), c: centro(j.cadera, j.rodilla, -1, 16, 0.15, 0.92) }),
    gluteo: j => gluteo(j),
    pantorrilla: (j, t) => ({ d: musculo(j.rodilla, j.tobillo, -1, 12, 0.08, 0.6, 1 + 0.25 * t), c: centro(j.rodilla, j.tobillo, -1, 12, 0.08, 0.6) }),
    dorsal: (j, t) => ({ d: musculo(j.cadera, j.hombro, ESPALDA, 24, 0.42, 0.95, 1 + 0.12 * t), c: centro(j.cadera, j.hombro, ESPALDA, 24, 0.42, 0.95) }),
    lumbar: j => ({ d: musculo(j.cadera, j.hombro, ESPALDA, 22, 0.05, 0.4, 1), c: centro(j.cadera, j.hombro, ESPALDA, 22, 0.05, 0.4) }),
    pecho: (j, t) => ({ d: musculo(j.cadera, j.hombro, PECHO, 24, 0.6, 0.97, 1 + 0.12 * t), c: centro(j.cadera, j.hombro, PECHO, 24, 0.6, 0.97) }),
    abdomen: (j, t) => ({ d: musculo(j.cadera, j.hombro, PECHO, 22, 0.08, 0.6, 1 + 0.15 * t), c: centro(j.cadera, j.hombro, PECHO, 22, 0.08, 0.6) }),
    biceps: (j, t) => ({ d: musculo(j.hombro, j.codo, 1, 11, 0.2, 0.9, 1 + 0.45 * t), c: centro(j.hombro, j.codo, 1, 11, 0.2, 0.9), brazo: true }),
    triceps: (j, t) => ({ d: musculo(j.hombro, j.codo, -1, 11, 0.15, 0.9, 1 + 0.25 * t), c: centro(j.hombro, j.codo, -1, 11, 0.15, 0.9), brazo: true }),
    antebrazo: (j, t) => ({ d: musculo(j.codo, j.mano, 1, 9, 0.1, 0.7, 1 + 0.2 * t), c: centro(j.codo, j.mano, 1, 9, 0.1, 0.7), brazo: true }),
    deltoides: j => { const n = frente(j.cadera, j.hombro), c = P(j.hombro.x - n.x * 2, j.hombro.y - n.y * 2); return { d: circulo(c, 8), c: c, brazo: true }; },
    trapecio: j => ({ d: miembro(j.hombro, j.cuello, 10, 9, 6, 0.4), c: mezclaP(j.hombro, j.cuello, 0.5) })
  };

  /* =============== Tempo =============== */
  // Por defecto (hipertrofia): sube rápido 0.8 s, aprieta 0.35 s, baja lento 1.5 s, estira 0.35 s
  const TEMPO_BASE = { concentrica: 800, pico: 350, excentrica: 1500, base: 350 };
  // Del Catálogo: "3-1-1-0" = baja 3 s, pausa abajo 1 s, sube 1 s, pausa arriba 0 s (la notación de siempre)
  function tempoDe(txt) {
    const m = /^\s*(\d+(?:[.,]\d+)?)\s*[-–/ ]\s*(\d+(?:[.,]\d+)?)\s*[-–/ ]\s*(\d+(?:[.,]\d+)?|x)\s*[-–/ ]\s*(\d+(?:[.,]\d+)?)\s*$/i.exec(String(txt || ''));
    if (!m) return Object.assign({}, TEMPO_BASE);
    const s = v => /x/i.test(v) ? 0.8 : Number(String(v).replace(',', '.'));
    const ms = v => Math.round(Math.max(0, Math.min(6, v)) * 1000);
    return { concentrica: Math.max(400, ms(s(m[3]))), pico: Math.max(150, ms(s(m[4]))), excentrica: Math.max(500, ms(s(m[1]))), base: Math.max(150, ms(s(m[2]))) };
  }
  const salida = u => 1 - Math.pow(1 - u, 3);
  const suave = u => u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
  const ORDEN = ['concentrica', 'pico', 'excentrica', 'base'];
  function fase(ms, tempo) {
    tempo = tempo || TEMPO_BASE;
    const ciclo = ORDEN.reduce((a, k) => a + tempo[k], 0);
    let u = ((ms % ciclo) + ciclo) % ciclo;
    const rep = Math.floor(ms / ciclo);
    for (const nombre of ORDEN) {
      const dur = tempo[nombre];
      if (u < dur) {
        const r = u / dur;
        const t = nombre === 'concentrica' ? salida(r) : nombre === 'pico' ? 1 : nombre === 'excentrica' ? 1 - suave(r) : 0;
        return { t: t, nombre: nombre, r: r, rep: rep, ciclo: ciclo };
      }
      u -= dur;
    }
    return { t: 0, nombre: 'base', r: 0, rep: rep, ciclo: ciclo };
  }
  const OPACIDAD = { concentrica: 1, pico: 1, excentrica: 0.72, base: 0.55 };

  /* =============== Equipo (dibujo) =============== */
  // g.add(tag, attrs) crea un elemento SVG. Las partes vivas se guardan en g.v y se mueven en cada cuadro.
  const EQ = {
    banco(g, x1, y1, x2, y2) {   // banco recto o inclinado (del punto 1 al 2) con su pata
      g.add('path', { d: miembro(P(x1, y1), P(x2, y2), 10, 10, 10, 0.5), fill: 'var(--maq)' });
      const m = mezclaP(P(x1, y1), P(x2, y2), 0.5);
      g.add('rect', { x: m.x - 4, y: Math.max(y1, y2), width: 8, height: PISO - Math.max(y1, y2), rx: 2, fill: 'var(--maq)' });
    },
    asiento(g, x, y, ancho) { g.add('rect', { x: x - ancho / 2, y: y, width: ancho, height: 9, rx: 4, fill: 'var(--maq)' }); g.add('rect', { x: x - 4, y: y + 9, width: 8, height: PISO - y - 9, rx: 2, fill: 'var(--maq)' }); },
    respaldo(g, x, y1, y2) { g.add('rect', { x: x - 5, y: y1, width: 10, height: y2 - y1, rx: 4, fill: 'var(--maq)' }); },
    poste(g, x, y) { g.add('rect', { x: x - 3, y: y, width: 6, height: PISO - y, rx: 2, fill: 'var(--maq)' }); },
    rack(g, x) { g.add('rect', { x: x, y: 70, width: 7, height: PISO - 70, rx: 2, fill: 'var(--maq)' }); g.add('rect', { x: x - 10, y: 108, width: 22, height: 6, rx: 2, fill: 'var(--maq2)' }); },
    rieles(g, x) { g.add('rect', { x: x - 2, y: 40, width: 4, height: PISO - 40, rx: 2, fill: 'var(--maq2)' }); },
    pila(g, x) {   // pila de placas: las de abajo quietas, las de arriba suben (g.v.placas)
      g.add('rect', { x: x - 4, y: 40, width: 4, height: PISO - 40, rx: 1, fill: 'var(--maq2)' }); g.add('rect', { x: x + 28, y: 40, width: 4, height: PISO - 40, rx: 1, fill: 'var(--maq2)' });
      for (let i = 0; i < 3; i++) g.add('rect', { x: x + 2, y: PISO - 9 - i * 9, width: 22, height: 7, rx: 2, fill: 'var(--maq)' });
      g.v.placas = []; for (let i = 3; i < 6; i++) g.v.placas.push(g.add('rect', { x: x + 2, y: PISO - 9 - i * 9, width: 22, height: 7, rx: 2, fill: 'var(--peso)' }));
      g.v.pilaY = g.v.placas.map(p => Number(p.getAttribute('y'))); g.v.pilaX = x;
    },
    moverPila(g, sube) { if (g.v.placas) g.v.placas.forEach((p, i) => p.setAttribute('y', (g.v.pilaY[i] - sube).toFixed(1))); },
    // Implementos vivos
    disco(g) { g.v.disco = g.add('circle', { r: 16, fill: 'var(--peso)' }); g.v.eje = g.add('circle', { r: 5, fill: 'var(--maq2)' }); },
    moverDisco(g, p) { [g.v.disco, g.v.eje].forEach(e => { e.setAttribute('cx', p.x.toFixed(1)); e.setAttribute('cy', p.y.toFixed(1)); }); },
    mancuerna(g) { g.v.mBarra = g.add('path', { fill: 'var(--maq)' }); g.v.m1 = g.add('path', { fill: 'var(--peso)' }); g.v.m2 = g.add('path', { fill: 'var(--peso)' }); },
    moverMancuerna(g, mano, ang) {   // la mancuerna cruza la mano, perpendicular al antebrazo
      const a = mas(mano, 10, ang + 90), b = mas(mano, 10, ang - 90);
      g.v.mBarra.setAttribute('d', miembro(a, b, 3.5, 3.5, 3.5, 0.5));
      g.v.m1.setAttribute('d', miembro(mas(a, 3, ang - 90), mas(a, 4, ang + 90), 15, 15, 15, 0.5));
      g.v.m2.setAttribute('d', miembro(mas(b, 3, ang + 90), mas(b, 4, ang - 90), 15, 15, 15, 0.5));
    },
    agarre(g) { g.v.agarre = g.add('path', { fill: 'var(--maq)' }); },
    moverAgarre(g, p) { g.v.agarre.setAttribute('d', miembro(P(p.x, p.y - 7), P(p.x, p.y + 7), 9, 9, 9, 0.5)); },
    cable(g) { g.v.cable = g.add('path', { fill: 'none', stroke: 'var(--maq)', 'stroke-width': 2 }); },
    moverCable(g, puntos) { g.v.cable.setAttribute('d', 'M' + puntos.map(f1).join(' L')); },
    palanca(g) { g.v.palanca = g.add('path', { fill: 'none', stroke: 'var(--maq2)', 'stroke-width': 5, 'stroke-linecap': 'round' }); },
    moverPalanca(g, a, b) { g.v.palanca.setAttribute('d', 'M' + f1(a) + ' L' + f1(b)); },
    rodillo(g) { g.v.rodillo = g.add('circle', { r: 7, fill: 'var(--maq2)' }); },
    moverRodillo(g, p) { g.v.rodillo.setAttribute('cx', p.x.toFixed(1)); g.v.rodillo.setAttribute('cy', p.y.toFixed(1)); }
  };
  // Lo que va en la mano según la modalidad del Catálogo
  function implemento(modalidad) {
    const m = String(modalidad || '').toLowerCase();
    if (/mancuerna/.test(m)) return 'mancuerna';
    if (/polea|cable/.test(m)) return 'polea';
    if (/placa|m[aá]quina/.test(m)) return 'placas';
    if (/disco|smith/.test(m)) return 'discos';
    if (/corporal/.test(m)) return 'corporal';
    if (/barra fija/.test(m)) return 'barra';
    return /barra/.test(m) ? 'barra' : '';
  }
  // Equipo genérico en las manos: barra (disco visto de lado), mancuerna, agarre con palanca y pila, o cable a una polea
  function equipoEnMano(cfg) {
    // Sin polea o sin palanca definidas para esa familia, el equipo se reduce a lo que se puede dibujar en la mano
    const real = imp => imp === 'polea' && !cfg.polea ? 'agarre' : imp === 'placas' && !cfg.pivote ? 'agarre' : imp === 'discos' && cfg.discosEnPalanca ? 'palancaDiscos' : imp;
    return {
      vivo(g, imp) {
        imp = real(imp);
        if (imp === 'agarre') EQ.agarre(g);
        if (imp === 'palancaDiscos') { EQ.palanca(g); EQ.agarre(g); g.v.disco2 = g.add('circle', { r: 13, fill: 'var(--peso)' }); }
        if (imp === 'barra' || imp === 'discos') EQ.disco(g);
        else if (imp === 'mancuerna') EQ.mancuerna(g);
        else if (imp === 'polea') { EQ.cable(g); EQ.agarre(g); }
        else if (imp === 'placas') { EQ.palanca(g); EQ.agarre(g); }
      },
      estatico(g, imp) {
        imp = real(imp);
        if (imp === 'palancaDiscos') g.add('circle', { cx: cfg.pivote.x, cy: cfg.pivote.y, r: 5, fill: 'var(--maq2)' });
        if (imp === 'polea' && cfg.polea) { EQ.poste(g, cfg.polea.x + (cfg.polea.x > 160 ? 6 : -6), Math.min(cfg.polea.y, 40)); g.add('circle', { cx: cfg.polea.x, cy: cfg.polea.y, r: 5, fill: 'var(--maq2)' }); }
        if ((imp === 'polea' || imp === 'placas') && cfg.pila) EQ.pila(g, cfg.pila);
        if (imp === 'placas' && cfg.pivote) g.add('circle', { cx: cfg.pivote.x, cy: cfg.pivote.y, r: 5, fill: 'var(--maq2)' });
        if (imp === 'discos' && cfg.rieles) cfg.rieles.forEach(x => EQ.rieles(g, x));
      },
      mover(g, j, t, imp) {
        imp = real(imp);
        const mano = cfg.donde ? cfg.donde(j) : j.mano;
        if (imp === 'agarre') EQ.moverAgarre(g, mano);
        if (imp === 'palancaDiscos') { EQ.moverPalanca(g, cfg.pivote, mano); EQ.moverAgarre(g, mano); const d = mezclaP(cfg.pivote, mano, 0.35); g.v.disco2.setAttribute('cx', d.x.toFixed(1)); g.v.disco2.setAttribute('cy', d.y.toFixed(1)); }
        if (imp === 'barra' || imp === 'discos') EQ.moverDisco(g, mano);
        else if (imp === 'mancuerna') EQ.moverMancuerna(g, mano, angulo(resta(j.mano, j.codo)));
        else if (imp === 'polea') { EQ.moverCable(g, [cfg.polea, mano]); EQ.moverAgarre(g, mano); }
        else if (imp === 'placas') { if (cfg.pivote) EQ.moverPalanca(g, cfg.pivote, mano); EQ.moverAgarre(g, mano); }
        EQ.moverPila(g, (cfg.sube || 40) * t);
      }
    };
  }

  /* =============== Familias de movimiento (de lado) =============== */
  const TOB = P(152, PISO - 4);
  const F = {};
  F.sentadilla = { nombre: 'Sentadilla', textos: { concentrica: 'Empuja el piso y sube', excentrica: 'Baja lento, rodillas hacia afuera' },
    pose(t) {
      const j = dePie(TOB, { pierna: mezcla(-55, -90, t), muslo: mezcla(-172, -91, t), barraSobre: TOB.x + 8 });
      completar(j, null);
      j.barra = P(j.hombro.x - 3, j.hombro.y + 4);
      const r = ik(j.hombro, P(j.barra.x + 7, j.barra.y + 1), L.brazo, L.antebrazo, 'abajo'); j.codo = r.medio; j.mano = r.fin;
      return j;
    },
    musculos: (j, t) => [Object.assign(M.cuadriceps(j, t), { principal: true }), M.gluteo(j)],
    estatico(g, imp) { if (imp === 'discos') { EQ.rieles(g, 136); EQ.rieles(g, 176); } else EQ.rack(g, 262); },
    vivo(g) { EQ.disco(g); }, mover(g, j) { EQ.moverDisco(g, j.barra); },
    guia: (a, b) => 'M' + f1(P(a.barra.x, a.barra.y + 18)) + ' L' + f1(P(b.barra.x, b.barra.y - 18)) };

  F.rumano = { nombre: 'Peso muerto rumano', textos: { concentrica: 'Empuja la cadera al frente', excentrica: 'Cadera atrás, barra pegada a las piernas' },
    pose(t) { const j = dePie(TOB, { pierna: mezcla(-78, -88, t), muslo: mezcla(-102, -91, t), torso: mezcla(-18, -88, t) }); return completar(j, { brazo: 90, antebrazo: 90 }); },
    musculos: (j, t) => [Object.assign(M.isquios(j, t), { principal: true }), M.gluteo(j), M.lumbar(j)],
    equipo: equipoEnMano({}), guia: (a, b) => 'M' + f1(a.mano) + ' L' + f1(b.mano) };

  F.pesoMuerto = { nombre: 'Peso muerto', textos: { concentrica: 'Empuja el piso, la barra sube pegada', excentrica: 'Baja controlado, espalda recta' },
    pose(t) { const j = dePie(TOB, { pierna: mezcla(-62, -90, t), muslo: mezcla(-158, -91, t), torso: mezcla(-28, -88, t) }); return completar(j, { brazo: 90, antebrazo: 90 }); },
    musculos: (j, t) => [Object.assign(M.gluteo(j), { principal: true }), M.isquios(j, t), M.cuadriceps(j, t), M.lumbar(j)],
    equipo: equipoEnMano({}), guia: (a, b) => 'M' + f1(a.mano) + ' L' + f1(b.mano) };

  F.hipThrust = { nombre: 'Hip thrust', textos: { concentrica: 'Sube la cadera y aprieta el glúteo', excentrica: 'Baja sin tocar el piso' },
    pose(t, ex) {
      const piso = /puente/i.test(ex && ex.ejercicio || ''), S = piso ? P(92, PISO - 8) : P(98, 199);
      const cad = mas(S, L.torso, piso ? mezcla(8, -12, t) : mezcla(35, 0, t));
      const pie = piso ? P(178, PISO - 4) : P(204, PISO - 4), r = ik(cad, pie, L.muslo, L.pierna, 'arriba');
      const j = { cadera: cad, rodilla: r.medio, tobillo: r.fin, hombro: S, torso: angulo(resta(S, cad)) };
      completar(j, { brazo: piso ? 120 : 100, antebrazo: piso ? 150 : 70 });
      j.barra = P(cad.x + 2, cad.y - 12);
      return j;
    },
    musculos: (j, t) => [Object.assign({ d: circulo(P(j.cadera.x - 2, j.cadera.y + 6), 9 + 2 * t), c: P(j.cadera.x - 2, j.cadera.y + 6) }, { principal: true }), M.isquios(j, t)],
    estatico(g, imp, ex) { if (!/puente/i.test(ex && ex.ejercicio || '')) EQ.banco(g, 40, 204, 104, 204); if (imp === 'placas') EQ.pila(g, 250); },
    vivo(g, imp) { if (imp === 'barra' || imp === 'discos') EQ.disco(g); if (imp === 'placas') { EQ.palanca(g); EQ.agarre(g); } if (imp === 'mancuerna') EQ.mancuerna(g); },
    mover(g, j, t, imp) {
      if (g.v.disco) EQ.moverDisco(g, j.barra);
      if (g.v.palanca) { EQ.moverPalanca(g, P(250, 120), j.barra); EQ.moverAgarre(g, j.barra); EQ.moverPila(g, 34 * t); }
      if (g.v.mBarra) EQ.moverMancuerna(g, j.barra, 0);
    },
    guia: (a, b) => 'M' + f1(P(a.cadera.x, a.cadera.y)) + ' L' + f1(P(b.cadera.x, b.cadera.y - 4)) };

  F.curlFemoral = { nombre: 'Curl femoral', textos: { concentrica: 'Lleva los talones al glúteo', excentrica: 'Baja lento hasta estirar' },
    pose(t) {
      const j = desdeCadera(P(150, 186), { muslo: 2, pierna: mezcla(2, -118, t), torso: 180 });
      j.pie = mezcla(0, -110, t);
      return completar(j, { brazo: 150, antebrazo: 100 });
    },
    musculos: (j, t) => [Object.assign(M.isquios(j, t), { principal: true }), M.pantorrilla(j, t)],
    estatico(g, imp) { g.add('path', { d: miembro(P(60, 200), P(205, 200), 12, 12, 12, 0.5), fill: 'var(--maq)' }); EQ.poste(g, 90, 206); EQ.poste(g, 180, 206); if (imp !== 'corporal') EQ.pila(g, 262); },
    vivo(g, imp) { if (imp !== 'corporal') { EQ.palanca(g); EQ.rodillo(g); } },
    mover(g, j, t, imp) { if (g.v.rodillo) { const r = mas(j.tobillo, 6, angulo(resta(j.tobillo, j.rodilla)) + 90); EQ.moverPalanca(g, P(j.rodilla.x, j.rodilla.y + 10), r); EQ.moverRodillo(g, r); EQ.moverPila(g, 38 * t); } },
    guia(a, b, pose) { let d = ''; for (let i = 0; i <= 10; i++) { const p = pose(i / 10).tobillo; d += (i ? ' L' : 'M') + f1(p); } return d; } };

  F.extensionPierna = { nombre: 'Extensión de cuádriceps', textos: { concentrica: 'Estira la pierna completa', excentrica: 'Baja lento' },
    pose(t) { const j = desdeCadera(P(130, 196), { muslo: 0, pierna: mezcla(98, 2, t), torso: -96 }); j.pie = mezcla(0, -80, t); return completar(j, { brazo: 100, antebrazo: 40 }); },
    musculos: (j, t) => [Object.assign(M.cuadriceps(j, t), { principal: true })],
    estatico(g) { EQ.asiento(g, 140, 198, 76); EQ.respaldo(g, 100, 118, 205); EQ.pila(g, 262); },
    vivo(g) { EQ.palanca(g); EQ.rodillo(g); },
    mover(g, j, t) { const r = mas(j.tobillo, 7, angulo(resta(j.tobillo, j.rodilla)) - 90); EQ.moverPalanca(g, j.rodilla, r); EQ.moverRodillo(g, r); EQ.moverPila(g, 38 * t); },
    guia(a, b, pose) { let d = ''; for (let i = 0; i <= 10; i++) { const p = pose(i / 10).tobillo; d += (i ? ' L' : 'M') + f1(p); } return d; } };

  F.prensa = { nombre: 'Prensa', textos: { concentrica: 'Empuja con todo el pie', excentrica: 'Baja lento sin despegar la espalda' },
    pose(t) {
      const cad = P(108, 206), pie = mas(cad, mezcla(52, 80, t), -42), r = ik(cad, pie, L.muslo, L.pierna, 'arriba');
      const j = { cadera: cad, rodilla: r.medio, tobillo: r.fin, torso: -150 }; j.pie = -132;
      return completar(j, { brazo: 70, antebrazo: 20 });
    },
    musculos: (j, t) => [Object.assign(M.cuadriceps(j, t), { principal: true }), M.gluteo(j)],
    estatico(g) { g.add('path', { d: miembro(P(60, 172), P(112, 214), 12, 12, 12, 0.5), fill: 'var(--maq)' }); EQ.poste(g, 90, 214); g.add('path', { d: miembro(P(150, 205), P(286, 82), 6, 6, 6, 0.5), fill: 'var(--maq2)' }); },
    vivo(g) { g.v.plataforma = g.add('path', { fill: 'var(--maq)' }); g.v.disco2 = g.add('circle', { r: 14, fill: 'var(--peso)' }); },
    mover(g, j) { const a = mas(j.tobillo, 14, -132 - 90), b = mas(j.tobillo, 14, -132 + 90); g.v.plataforma.setAttribute('d', miembro(a, b, 7, 7, 7, 0.5)); const d = mas(j.tobillo, 30, -42); g.v.disco2.setAttribute('cx', d.x.toFixed(1)); g.v.disco2.setAttribute('cy', d.y.toFixed(1)); },
    guia: (a, b) => 'M' + f1(a.tobillo) + ' L' + f1(b.tobillo) };

  F.zancada = { nombre: 'Zancada', textos: { concentrica: 'Empuja con el pie de adelante', excentrica: 'Baja recto, rodilla de atrás al piso' },
    pose(t) {
      const cad = P(140, mezcla(204, 160, t)), adelante = P(182, PISO - 4), atras = P(96, PISO - 6);
      const r1 = ik(cad, adelante, L.muslo, L.pierna, 'adelante'), r2 = ik(cad, atras, L.muslo, L.pierna, 'abajo');
      const j = { cadera: cad, rodilla: r1.medio, tobillo: r1.fin, torso: -88, rodilla2: r2.medio, tobillo2: r2.fin };
      return completar(j, { brazo: 92, antebrazo: 92 });
    },
    piernaAtras: true,
    musculos: (j, t) => [Object.assign(M.cuadriceps(j, t), { principal: true }), M.gluteo(j)],
    equipo: equipoEnMano({}), guia: (a, b) => 'M' + f1(a.cadera) + ' L' + f1(b.cadera) };

  F.pantorrilla = { nombre: 'Pantorrilla', textos: { concentrica: 'Sube lo más alto que puedas', excentrica: 'Baja el talón hasta estirar' },
    pose(t) {
      const bola = P(166, PISO - 14), pieAng = mezcla(22, -32, t), tob = mas(bola, 15, 180 + pieAng);
      const j = dePie(tob, { pierna: -90, muslo: -90, torso: -90 }); j.pie = pieAng;
      completar(j, { brazo: 92, antebrazo: 92 });
      j.punta = mas(j.tobillo, 17, pieAng); j.talon = mas(j.tobillo, 6, pieAng + 180);
      return j;
    },
    musculos: (j, t) => [Object.assign(M.pantorrilla(j, t), { principal: true })],
    estatico(g, imp) { g.add('rect', { x: 158, y: PISO - 12, width: 40, height: 12, rx: 3, fill: 'var(--maq)' }); if (imp === 'placas') { EQ.poste(g, 196, 40); EQ.pila(g, 250); } },
    vivo(g, imp) { if (imp === 'placas') g.v.hombrera = g.add('path', { fill: 'var(--maq)' }); else if (imp === 'mancuerna') EQ.mancuerna(g); else if (imp === 'barra' || imp === 'discos') EQ.disco(g); },
    mover(g, j, t) {
      if (g.v.hombrera) { g.v.hombrera.setAttribute('d', miembro(P(j.hombro.x - 4, j.hombro.y - 4), P(198, j.hombro.y - 4), 9, 9, 9, 0.5)); EQ.moverPila(g, 20 * t); }
      if (g.v.mBarra) EQ.moverMancuerna(g, j.mano, 90);
      if (g.v.disco) EQ.moverDisco(g, P(j.hombro.x - 3, j.hombro.y + 4));
    },
    guia: (a, b) => 'M' + f1(a.tobillo) + ' L' + f1(b.tobillo) };

  F.remoSentado = { nombre: 'Remo sentado', textos: { concentrica: 'Jala con los codos, pecho arriba', excentrica: 'Estira los brazos sin encorvarte' },
    pose(t) {
      const j = desdeCadera(P(112, 204), { muslo: -14, pierna: 38, torso: mezcla(-72, -98, t) });
      j.hombro = mas(j.cadera, L.torso, j.torso);
      return completar(j, { mano: P(mezcla(j.hombro.x + 56, j.hombro.x + 14, t), j.hombro.y + 22), doblar: 'atras' });
    },
    musculos: (j, t) => [Object.assign(M.dorsal(j, t), { principal: true }), M.biceps(j, t)],
    estatico(g, imp) { g.add('path', { d: miembro(P(80, 210), P(140, 210), 10, 10, 10, 0.5), fill: 'var(--maq)' }); EQ.poste(g, 110, 214); g.add('rect', { x: 186, y: 196, width: 8, height: 46, rx: 3, fill: 'var(--maq2)' }); },
    equipo: equipoEnMano({ polea: P(262, 160), pila: 268, pivote: P(250, 230), discosEnPalanca: true, sube: 40 }),
    guia: (a, b) => 'M' + f1(a.mano) + ' L' + f1(b.mano) };
  // Remo inclinado (barra o mancuerna, de pie) y con pecho apoyado
  F.remoInclinado = { nombre: 'Remo inclinado', textos: { concentrica: 'Jala hacia el ombligo, codos pegados', excentrica: 'Baja lento, espalda plana' },
    pose(t, ex) {
      const apoyado = /apoyad|banco/i.test(ex && ex.ejercicio || '');
      let j;
      if (apoyado) {   // banco de (96,212) a (200,154): el torso va sobre él y los pies atrás, en el piso
        const a = P(96, 212), b = P(200, 154), n = frente(a, b), cad = P(mezcla(a.x, b.x, 0.12) + n.x * 13, mezcla(a.y, b.y, 0.12) + n.y * 13);
        const r = ik(cad, P(70, PISO - 4), L.muslo, L.pierna, 'adelante');
        j = { cadera: cad, rodilla: r.medio, tobillo: r.fin, torso: angulo(resta(b, a)) };
      } else j = dePie(TOB, { pierna: -78, muslo: -112, torso: -24 });
      j.hombro = mas(j.cadera, L.torso, j.torso);
      return completar(j, { mano: P(mezcla(j.hombro.x + 4, j.cadera.x + 22, t), mezcla(j.hombro.y + 56, j.hombro.y + 20, t)), doblar: 'atras' });
    },
    musculos: (j, t) => [Object.assign(M.dorsal(j, t), { principal: true }), M.biceps(j, t)],
    estatico(g, imp, ex) { if (/apoyad|banco/i.test(ex && ex.ejercicio || '')) EQ.banco(g, 96, 212, 200, 154); },
    equipo: equipoEnMano({}), guia: (a, b) => 'M' + f1(a.mano) + ' L' + f1(b.mano) };
  F.remoInvertido = { nombre: 'Remo invertido', textos: { concentrica: 'Lleva el pecho a la barra', excentrica: 'Baja con el cuerpo recto' },
    pose(t) {
      const tob = P(236, PISO - 4), a = mezcla(-164, -146, t), rod = mas(tob, L.pierna, a), cad = mas(rod, L.muslo, a);
      const j = { tobillo: tob, rodilla: rod, cadera: cad, torso: a }; j.pie = a + 90;
      return completar(j, { mano: P(118, 128), doblar: 'abajo' });
    },
    musculos: (j, t) => [Object.assign(M.dorsal(j, t), { principal: true }), M.biceps(j, t)],
    estatico(g) { EQ.rack(g, 108); g.add('circle', { cx: 118, cy: 128, r: 5, fill: 'var(--maq)' }); },
    guia: (a, b) => 'M' + f1(a.hombro) + ' L' + f1(b.hombro) };

  F.jalon = { nombre: 'Jalón al pecho', textos: { concentrica: 'Jala la barra al pecho, codos abajo', excentrica: 'Sube lento hasta estirar' },
    pose(t) {
      const j = desdeCadera(P(118, 200), { muslo: 0, pierna: 90, torso: mezcla(-95, -106, t) });
      j.hombro = mas(j.cadera, L.torso, j.torso);
      return completar(j, { mano: P(127, mezcla(82, j.hombro.y - 3, t)), doblar: 'abajo' });
    },
    musculos: (j, t) => [Object.assign(M.dorsal(j, t), { principal: true }), M.biceps(j, t)],
    estatico(g) {
      EQ.asiento(g, 113, 200, 70); g.add('rect', { x: 150, y: 166, width: 34, height: 9, rx: 4, fill: 'var(--maq2)' }); EQ.poste(g, 189, 30);
      g.add('rect', { x: 100, y: 18, width: 150, height: 7, rx: 3, fill: 'var(--maq)' }); g.add('circle', { cx: 127, cy: 26, r: 5, fill: 'var(--maq2)' }); g.add('circle', { cx: 238, cy: 26, r: 5, fill: 'var(--maq2)' });
      EQ.pila(g, 226);
    },
    vivo(g) { EQ.cable(g); g.v.cable2 = g.add('path', { fill: 'none', stroke: 'var(--maq)', 'stroke-width': 2 }); g.v.barraJ = g.add('rect', { width: 44, height: 6, rx: 3, fill: 'var(--maq)' }); },
    mover(g, j, t) {
      EQ.moverCable(g, [P(127, 30), P(127, j.mano.y - 3)]);
      g.v.barraJ.setAttribute('x', (j.mano.x - 22).toFixed(1)); g.v.barraJ.setAttribute('y', (j.mano.y - 6).toFixed(1));
      g.v.cable2.setAttribute('d', 'M127 21 L238 21 M243 26 L243 ' + (196 - 42 * t).toFixed(1)); EQ.moverPila(g, 42 * t);
    },
    guia: (a, b) => 'M127 ' + (a.mano.y - 6).toFixed(1) + ' L127 ' + (b.mano.y + 4).toFixed(1) };

  F.dominada = { nombre: 'Dominada', textos: { concentrica: 'Sube el pecho a la barra', excentrica: 'Baja lento hasta estirar' },
    pose(t) {
      const barra = P(150, 40), hombro = P(144, mezcla(100, 64, t));
      const j = { hombro: hombro, torso: -94 };
      j.cadera = mas(hombro, L.torso, 86); const r = desdeCadera(j.cadera, { muslo: 100, pierna: 150, torso: -94 });
      Object.assign(j, { rodilla: r.rodilla, tobillo: r.tobillo }); j.pie = 60;
      completar(j, { mano: barra, doblar: 'abajo' });
      return j;
    },
    musculos: (j, t) => [Object.assign(M.dorsal(j, t), { principal: true }), M.biceps(j, t)],
    estatico(g, imp) { EQ.poste(g, 96, 30); EQ.poste(g, 204, 30); g.add('rect', { x: 92, y: 36, width: 116, height: 7, rx: 3, fill: 'var(--maq)' }); if (imp === 'placas') EQ.pila(g, 250); },
    vivo(g, imp) { if (imp === 'placas') g.v.cojin = g.add('path', { fill: 'var(--maq2)' }); },
    mover(g, j, t) { if (g.v.cojin) { g.v.cojin.setAttribute('d', miembro(P(j.rodilla.x - 14, j.rodilla.y + 8), P(j.rodilla.x + 14, j.rodilla.y + 8), 8, 8, 8, 0.5)); EQ.moverPila(g, 36 * (1 - t)); } },
    guia: (a, b) => 'M' + f1(a.hombro) + ' L' + f1(b.hombro) };

  F.pullover = { nombre: 'Pullover', textos: { concentrica: 'Brazos rectos hacia los muslos', excentrica: 'Sube lento hasta estirar la espalda' },
    pose(t, ex) {
      if (/mancuerna/i.test(ex && ex.modalidad || '')) {   // acostado en banco
        const j = desdeCadera(P(176, 186), { muslo: 30, pierna: 90, torso: 182 });
        j.hombro = mas(j.cadera, L.torso, j.torso);
        const a = mezcla(165, 262, t); return completar(j, { brazo: a, antebrazo: a + 8 });
      }
      const j = dePie(TOB, { pierna: -84, muslo: -100, torso: -68 }); const a = mezcla(-58, 70, t);
      return completar(j, { brazo: a, antebrazo: a - 4 });
    },
    musculos: (j, t) => [Object.assign(M.dorsal(j, t), { principal: true })],
    estatico(g, imp) { if (imp === 'mancuerna') EQ.banco(g, 100, 194, 196, 194); },
    equipo: equipoEnMano({ polea: P(276, 34), pila: 280 }),
    guia(a, b, pose) { let d = ''; for (let i = 0; i <= 12; i++) { const p = pose(i / 12).mano; d += (i ? ' L' : 'M') + f1(p); } return d; } };

  F.pressPlano = { nombre: 'Press de pecho', textos: { concentrica: 'Empuja la barra hacia arriba', excentrica: 'Baja lento al pecho, codos a 45°' },
    pose(t, ex) {
      const inclinado = this === F.pressInclinado || /inclin/i.test(ex && (ex.ejercicio + ' ' + ex.variante) || '');
      const j = desdeCadera(P(178, 186), { muslo: 40, pierna: 95, torso: inclinado ? 212 : 182 });
      j.hombro = mas(j.cadera, L.torso, j.torso);
      const x = j.hombro.x + (inclinado ? 2 : 8);
      return completar(j, { mano: P(x, mezcla(j.hombro.y - 10, j.hombro.y - 56, t)), doblar: 'abajo' });
    },
    musculos: (j, t) => [Object.assign(M.pecho(j, t), { principal: true }), M.triceps(j, t), M.deltoides(j)],
    estatico(g, imp, ex) {
      const inc = /inclin/i.test(ex && (ex.ejercicio + ' ' + ex.variante) || '');
      if (inc) EQ.banco(g, 128, 150, 196, 196); else EQ.banco(g, 88, 194, 200, 194);
      if (imp === 'discos') { EQ.rieles(g, inc ? 124 : 116); }
      if (imp === 'placas' || imp === 'barra') { EQ.poste(g, inc ? 100 : 92, 90); }
    },
    equipo: equipoEnMano({ pivote: P(78, 62), pila: 268, sube: 36 }),
    guia: (a, b) => 'M' + f1(P(a.mano.x, a.mano.y + 8)) + ' L' + f1(P(b.mano.x, b.mano.y - 10)) };
  F.pressInclinado = Object.assign({}, F.pressPlano, { nombre: 'Press inclinado' });

  F.pressHombro = { nombre: 'Press de hombro', textos: { concentrica: 'Empuja arriba sin despegar la espalda', excentrica: 'Baja lento a la barbilla' },
    pose(t, ex) {
      const dePieB = /de pie|militar con barra/i.test(ex && ex.ejercicio || '');
      const j = dePieB ? dePie(TOB, { pierna: -90, muslo: -90, torso: -90 }) : desdeCadera(P(132, 200), { muslo: 0, pierna: 90, torso: -90 });
      j.hombro = mas(j.cadera, L.torso, j.torso);
      return completar(j, { mano: P(j.hombro.x + 10, mezcla(j.hombro.y - 4, j.hombro.y - 55, t)), doblar: 'abajo' });
    },
    musculos: (j, t) => [Object.assign(M.deltoides(j), { principal: true }), M.triceps(j, t)],
    estatico(g, imp, ex) { if (!/de pie|militar con barra/i.test(ex && ex.ejercicio || '')) { EQ.respaldo(g, 115, 118, 202); EQ.asiento(g, 133, 200, 70); } },
    equipo: equipoEnMano({ pivote: P(203, 40), pila: 222, sube: 40 }),
    guia: (a, b) => 'M' + f1(P(a.mano.x, a.mano.y + 6)) + ' L' + f1(P(b.mano.x, b.mano.y - 8)) };

  F.fondos = { nombre: 'Fondos', textos: { concentrica: 'Empuja hasta estirar los brazos', excentrica: 'Baja lento hasta 90°' },
    pose(t) {
      const mano = P(156, 150), hombro = P(mezcla(146, 151, t), mezcla(140, 100, t));
      const j = { hombro: hombro, torso: -80 };
      j.cadera = mas(hombro, L.torso, 100); const r = desdeCadera(j.cadera, { muslo: 96, pierna: 160, torso: -80 });
      Object.assign(j, { rodilla: r.rodilla, tobillo: r.tobillo }); j.pie = 60;
      return completar(j, { mano: mano, doblar: 'atras' });
    },
    musculos: (j, t) => [Object.assign(M.triceps(j, t), { principal: true }), M.pecho(j, t)],
    estatico(g, imp) { g.add('rect', { x: 140, y: 147, width: 40, height: 7, rx: 3, fill: 'var(--maq)' }); EQ.poste(g, 176, 150); if (imp === 'placas') EQ.pila(g, 250); },
    vivo(g, imp) { if (imp === 'placas') g.v.cojin = g.add('path', { fill: 'var(--maq2)' }); },
    mover(g, j, t) { if (g.v.cojin) { g.v.cojin.setAttribute('d', miembro(P(j.rodilla.x - 14, j.rodilla.y + 8), P(j.rodilla.x + 14, j.rodilla.y + 8), 8, 8, 8, 0.5)); EQ.moverPila(g, 34 * t); } },
    guia: (a, b) => 'M' + f1(a.hombro) + ' L' + f1(b.hombro) };

  F.tricepsPolea = { nombre: 'Extensión de tríceps', textos: { concentrica: 'Estira el codo, brazo pegado', excentrica: 'Sube lento sin mover el codo' },
    pose(t) { const j = dePie(TOB, { pierna: -88, muslo: -94, torso: -82 }); return completar(j, { brazo: 88, antebrazo: mezcla(-40, 86, t) }); },
    musculos: (j, t) => [Object.assign(M.triceps(j, t), { principal: true })],
    equipo: equipoEnMano({ polea: P(186, 30), pila: 230 }),
    guia(a, b, pose) { let d = ''; for (let i = 0; i <= 10; i++) { const p = pose(i / 10).mano; d += (i ? ' L' : 'M') + f1(p); } return d; } };

  F.curl = { nombre: 'Curl de bíceps', textos: { concentrica: 'Sube sin mover el codo', excentrica: 'Baja lento hasta estirar' },
    pose(t) { const j = dePie(TOB, { pierna: -90, muslo: -90, torso: -90 }); return completar(j, { brazo: mezcla(92, 82, t), antebrazo: mezcla(94, -62, t) }); },
    musculos: (j, t) => [Object.assign(M.biceps(j, t), { principal: true }), M.antebrazo(j, t)],
    equipo: equipoEnMano({ polea: P(214, PISO - 8), pila: 236 }),
    guia(a, b, pose) { let d = ''; for (let i = 0; i <= 12; i++) { const p = pose(i / 12).mano; d += (i ? ' L' : 'M') + f1(p); } return d; } };

  F.antebrazo = { nombre: 'Curl de muñeca', textos: { concentrica: 'Sube solo con la muñeca', excentrica: 'Baja lento hasta estirar' },
    pose(t) {
      const j = desdeCadera(P(120, 200), { muslo: 0, pierna: 90, torso: -70 });
      j.hombro = mas(j.cadera, L.torso, j.torso);
      completar(j, { mano: P(160, 192), doblar: 'abajo' });
      j.puno = mas(j.mano, 10, mezcla(40, -45, t));
      return j;
    },
    musculos: (j, t) => [Object.assign(M.antebrazo(j, t), { principal: true })],
    estatico(g) { EQ.asiento(g, 128, 202, 76); },
    vivo(g) { EQ.mancuerna(g); g.v.puno = g.add('path', { fill: 'var(--persona)' }); },
    mover(g, j) { g.v.puno.setAttribute('d', miembro(j.mano, j.puno, 6, 6, 5, 0.5)); EQ.moverMancuerna(g, j.puno, angulo(resta(j.puno, j.mano))); },
    guia: (a, b) => 'M' + f1(a.puno) + ' L' + f1(b.puno) };

  F.granjero = { nombre: 'Paseo del granjero', textos: { concentrica: 'Camina firme, hombros atrás', excentrica: 'Pasos cortos, abdomen apretado' },
    pose(t) {
      const s = Math.sin(t * Math.PI * 2), j = desdeCadera(P(150, 160), { muslo: 90 + 14 * s, pierna: 92 + 10 * Math.max(0, s), torso: -90 });
      j.muslo2 = 90 - 14 * s; return completar(j, { brazo: 90, antebrazo: 90 });
    },
    caminando: true,
    musculos: j => [Object.assign(M.antebrazo(j, 1), { principal: true }), M.trapecio(j)],
    equipo: equipoEnMano({}), guia: () => '' };

  F.crunch = { nombre: 'Crunch', textos: { concentrica: 'Enrolla el torso, exhala', excentrica: 'Baja lento sin soltar el abdomen' },
    pose(t, ex) {
      const inverso = /invers/i.test(ex && ex.ejercicio || '');
      const j = desdeCadera(P(170, 232), { muslo: inverso ? mezcla(-48, -100, t) : -48, pierna: inverso ? mezcla(40, -20, t) : 50, torso: inverso ? 178 : mezcla(180, 208, t) });
      j.hombro = mas(j.cadera, L.torso, j.torso);
      return completar(j, { brazo: j.torso - 150, antebrazo: j.torso + 20 });
    },
    musculos: (j, t) => [Object.assign(M.abdomen(j, t), { principal: true })],
    estatico(g) { g.add('rect', { x: 60, y: PISO - 6, width: 200, height: 6, rx: 3, fill: 'var(--maq2)' }); },
    guia: (a, b) => 'M' + f1(a.hombro) + ' L' + f1(b.hombro) };

  F.elevPiernas = { nombre: 'Elevación de piernas', textos: { concentrica: 'Sube las rodillas al pecho', excentrica: 'Baja lento sin columpiarte' },
    pose(t) { const j = desdeCadera(P(150, 150), { muslo: mezcla(92, -14, t), pierna: mezcla(94, 84, t), torso: -88 }); j.pie = 40; return completar(j, { brazo: 92, antebrazo: 0 }); },
    musculos: (j, t) => [Object.assign(M.abdomen(j, t), { principal: true })],
    estatico(g) { EQ.respaldo(g, 134, 70, 162); EQ.poste(g, 128, 160); g.add('rect', { x: 134, y: 112, width: 40, height: 7, rx: 3, fill: 'var(--maq)' }); },
    guia(a, b, pose) { let d = ''; for (let i = 0; i <= 10; i++) { const p = pose(i / 10).rodilla; d += (i ? ' L' : 'M') + f1(p); } return d; } };

  F.plancha = { nombre: 'Plancha', estatico_: true, textos: { concentrica: 'Aguanta: cuerpo recto', pico: 'Aprieta abdomen y glúteo', excentrica: 'Respira sin soltar', base: 'Aguanta' },
    pose(t, ex) {
      if (/hollow/i.test(ex && ex.ejercicio || '')) {
        const j = desdeCadera(P(160, 232), { muslo: -14 - 2 * t, pierna: -10 - 2 * t, torso: 196 + 2 * t }); j.hombro = mas(j.cadera, L.torso, j.torso); j.pie = -12;
        return completar(j, { brazo: 192, antebrazo: 190 });
      }
      const tob = P(240, PISO - 4), a = -172 - 1.2 * t, rod = mas(tob, L.pierna, a), cad = mas(rod, L.muslo, a - 0.5);
      const j = { tobillo: tob, rodilla: rod, cadera: cad, torso: a - 1 }; j.pie = 82;
      j.hombro = mas(cad, L.torso, j.torso);
      return completar(j, { mano: P(j.hombro.x + 22, PISO - 4), doblar: 'atras' });
    },
    musculos: j => [Object.assign(M.abdomen(j, 1), { principal: true }), M.gluteo(j)],
    estatico(g) { g.add('rect', { x: 50, y: PISO - 5, width: 220, height: 5, rx: 2, fill: 'var(--maq2)' }); },
    guia: () => '' };

  /* =============== Vista de frente =============== */
  // La figura mira al frente: dos brazos y dos piernas, en espejo. prof (0–1) acorta el brazo cuando va hacia ti.
  const CX = 160;
  function frentePose(q) {
    const pelvis = q.pelvis || 172, w = q.lado === undefined ? 1 : q.lado;
    const j = { frente: true, cad: [P(CX - 12, pelvis), P(CX + 12, pelvis)], hom: [P(CX - 25 + (q.giro || 0), pelvis - 62), P(CX + 25 + (q.giro || 0), pelvis - 62)] };
    j.cuello = P(CX + (q.giro || 0) * 0.6, pelvis - 70); j.cabeza = P(CX + (q.giro || 0) * 0.6, pelvis - 82);
    // brazos: ángulo del brazo derecho (el de tu derecha en la pantalla); el izquierdo es su espejo
    const ladoA = (h, s, ab, aa, pb, pa) => { const codo = mas(h, L.brazo * pb, s > 0 ? ab : 180 - ab), mano = mas(codo, L.antebrazo * pa, s > 0 ? aa : 180 - aa); return { codo, mano }; };
    const brD = ladoA(j.hom[1], 1, q.brazo, q.antebrazo, q.prof || 1, q.profA || q.prof || 1), brI = q.brazoI !== undefined
      ? ladoA(j.hom[0], 1, q.brazoI, q.antebrazoI, q.prof || 1, q.profA || q.prof || 1) : ladoA(j.hom[0], -1, q.brazo, q.antebrazo, q.prof || 1, q.profA || q.prof || 1);
    j.codo = [brI.codo, brD.codo]; j.mano = [brI.mano, brD.mano];
    const pierna = (c, s) => { const rod = mas(c, L.muslo * (q.profM || 1), s > 0 ? q.muslo : 180 - q.muslo), tob = mas(rod, L.pierna, s > 0 ? q.pierna : 180 - q.pierna); return { rod, tob }; };
    const pI = pierna(j.cad[0], -1), pD = pierna(j.cad[1], 1);
    j.rod = [pI.rod, pD.rod]; j.tob = [pI.tob, pD.tob]; j.w = w;
    return j;
  }
  const FR = {};
  FR.laterales = { nombre: 'Elevaciones laterales', vista: 'frente', textos: { concentrica: 'Sube a la altura del hombro', excentrica: 'Baja lento, sin columpiar' },
    pose(t) { return frentePose({ pelvis: 160, brazo: mezcla(80, -2, t), antebrazo: mezcla(84, 6, t), muslo: 88, pierna: 90 }); },
    musculos: (j, t) => [0, 1].map(i => ({ d: circulo(P(j.hom[i].x + (i ? 5 : -5), j.hom[i].y + 2), 7 + 1.5 * t), c: j.hom[i], principal: i === 1 })),
    vivo(g, imp) { if (imp === 'polea') { g.v.c1 = g.add('path', { fill: 'none', stroke: 'var(--maq)', 'stroke-width': 2 }); g.v.c2 = g.add('path', { fill: 'none', stroke: 'var(--maq)', 'stroke-width': 2 }); } else if (imp === 'placas') { g.v.p1 = g.add('path', { fill: 'var(--maq)' }); g.v.p2 = g.add('path', { fill: 'var(--maq)' }); } else { g.v.d1 = g.add('path', { fill: 'var(--peso)' }); g.v.d2 = g.add('path', { fill: 'var(--peso)' }); } },
    estatico(g, imp) { if (imp === 'polea') { EQ.poste(g, 70, 200); EQ.poste(g, 250, 200); } if (imp === 'placas') EQ.asiento(g, CX, 165, 60); },
    mover(g, j) {
      if (g.v.c1) { g.v.c1.setAttribute('d', 'M' + f1(j.mano[0]) + ' L250 ' + (PISO - 40)); g.v.c2.setAttribute('d', 'M' + f1(j.mano[1]) + ' L70 ' + (PISO - 40)); }
      if (g.v.p1) { g.v.p1.setAttribute('d', miembro(j.codo[0], mas(j.codo[0], 4, angulo(resta(j.codo[0], j.hom[0]))), 12, 12, 12, 0.5)); g.v.p2.setAttribute('d', miembro(j.codo[1], mas(j.codo[1], 4, angulo(resta(j.codo[1], j.hom[1]))), 12, 12, 12, 0.5)); }
      if (g.v.d1) { g.v.d1.setAttribute('d', miembro(P(j.mano[0].x, j.mano[0].y - 9), P(j.mano[0].x, j.mano[0].y + 9), 9, 7, 9, 0.5)); g.v.d2.setAttribute('d', miembro(P(j.mano[1].x, j.mano[1].y - 9), P(j.mano[1].x, j.mano[1].y + 9), 9, 7, 9, 0.5)); }
    },
    guia(a, b, pose) { let d = ''; for (let i = 0; i <= 10; i++) { const p = pose(i / 10).mano[1]; d += (i ? ' L' : 'M') + f1(p); } return d; } };

  FR.aperturas = { nombre: 'Aperturas', vista: 'frente', textos: { concentrica: 'Junta los brazos al frente y aprieta', excentrica: 'Abre lento hasta sentir el pecho' },
    pose(t, ex) {
      const cruce = /polea|cruce/i.test(ex && (ex.ejercicio + ' ' + ex.modalidad) || '') && !/m[aá]quina/i.test(ex && ex.ejercicio || '');
      if (cruce && /abajo hacia arriba|de abajo/i.test(ex.ejercicio)) return frentePose({ pelvis: 160, brazo: mezcla(40, -40, t), antebrazo: mezcla(44, -120, t), prof: mezcla(1, 0.75, t), muslo: 86, pierna: 90 });
      if (cruce) return frentePose({ pelvis: 160, brazo: mezcla(-10, 70, t), antebrazo: mezcla(-4, 120, t), prof: mezcla(1, 0.75, t), muslo: 86, pierna: 90 });
      const p = Math.cos(rad(mezcla(0, 72, t)));   // el brazo va hacia ti: se ve más corto
      return frentePose({ pelvis: 172, brazo: 2, antebrazo: -88, prof: Math.max(0.3, p), profA: 1, muslo: 98, pierna: 92, profM: 0.45 });
    },
    musculos: (j, t) => [{ d: miembro(P(CX - 18, j.hom[0].y + 12), P(CX - 4, j.hom[0].y + 14), 10, 14 + 3 * t, 10, 0.5), c: P(CX - 11, j.hom[0].y + 13), principal: true },
                         { d: miembro(P(CX + 4, j.hom[1].y + 14), P(CX + 18, j.hom[1].y + 12), 10, 14 + 3 * t, 10, 0.5), c: P(CX + 11, j.hom[1].y + 13) }],
    estatico(g, imp, ex) { if (!/polea|cruce/i.test(ex && (ex.ejercicio + ' ' + ex.modalidad) || '') || /m[aá]quina/i.test(ex && ex.ejercicio || '')) { EQ.asiento(g, CX, 172, 60); g.add('rect', { x: CX - 8, y: 90, width: 16, height: 84, rx: 6, fill: 'var(--maq2)' }); } else { EQ.poste(g, 52, 40); EQ.poste(g, 268, 40); } },
    vivo(g, imp, ex) { g.v.h1 = g.add('path', { fill: 'var(--maq)' }); g.v.h2 = g.add('path', { fill: 'var(--maq)' }); if (/polea|cruce/i.test(ex && (ex.ejercicio + ' ' + ex.modalidad) || '') && !/m[aá]quina/i.test(ex && ex.ejercicio || '')) { g.v.c1 = g.add('path', { fill: 'none', stroke: 'var(--maq)', 'stroke-width': 2 }); g.v.c2 = g.add('path', { fill: 'none', stroke: 'var(--maq)', 'stroke-width': 2 }); g.v.bajo = /abajo hacia arriba|de abajo/i.test(ex.ejercicio); } },
    mover(g, j) {
      [0, 1].forEach(i => g.v['h' + (i + 1)].setAttribute('d', miembro(P(j.mano[i].x, j.mano[i].y - 8), P(j.mano[i].x, j.mano[i].y + 8), 8, 8, 8, 0.5)));
      const y = g.v.bajo ? PISO - 12 : 44;
      if (g.v.c1) { g.v.c1.setAttribute('d', 'M' + f1(j.mano[0]) + ' L55 ' + y); g.v.c2.setAttribute('d', 'M' + f1(j.mano[1]) + ' L265 ' + y); }
    },
    guia(a, b, pose) { let d = ''; for (let i = 0; i <= 10; i++) { const p = pose(i / 10).mano[1]; d += (i ? ' L' : 'M') + f1(p); } return d; } };

  FR.giros = { nombre: 'Rotación de core', vista: 'frente', textos: { concentrica: 'Gira desde el abdomen', excentrica: 'Regresa controlado' },
    pose(t, ex, rep) {
      const lado = rep % 2 ? -1 : 1, s = lado * t;
      if (/le[nñ]ador|polea/i.test(ex && (ex.ejercicio + ' ' + ex.modalidad) || '')) {   // de pie, en diagonal de arriba a abajo
        const m = P(mezcla(CX + 60, CX - 34, t), mezcla(70, 168, t));
        const j = frentePose({ pelvis: 160, brazo: 0, antebrazo: 0, muslo: 84, pierna: 90, giro: mezcla(8, -8, t) });
        j.mano = [P(m.x - 4, m.y), P(m.x + 4, m.y)]; j.codo = [mezclaP(j.hom[0], m, 0.5), mezclaP(j.hom[1], m, 0.5)];
        return j;
      }
      const m = P(CX + 46 * s, 176);   // sentado, las manos van de un lado al otro
      const j = frentePose({ pelvis: 196, brazo: 0, antebrazo: 0, muslo: 34, pierna: 96, profM: 0.55, giro: 10 * s });
      j.mano = [P(m.x - 4, m.y), P(m.x + 4, m.y)]; j.codo = [mezclaP(j.hom[0], m, 0.55), mezclaP(j.hom[1], m, 0.55)];
      return j;
    },
    musculos: (j, t) => [{ d: miembro(P(CX - 17, j.cad[0].y - 34), P(CX - 13, j.cad[0].y - 6), 8, 10 + 2 * t, 7, 0.5), c: P(CX - 15, j.cad[0].y - 20), principal: true },
                         { d: miembro(P(CX + 17, j.cad[1].y - 34), P(CX + 13, j.cad[1].y - 6), 8, 10 + 2 * t, 7, 0.5), c: P(CX + 15, j.cad[1].y - 20) }],
    estatico(g, imp, ex) { if (/le[nñ]ador|polea/i.test(ex && (ex.ejercicio + ' ' + ex.modalidad) || '')) EQ.poste(g, 256, 40); else g.add('rect', { x: 90, y: PISO - 6, width: 140, height: 6, rx: 3, fill: 'var(--maq2)' }); },
    vivo(g, imp, ex) { g.v.peso = g.add('circle', { r: 10, fill: 'var(--peso)' }); if (/le[nñ]ador|polea/i.test(ex && (ex.ejercicio + ' ' + ex.modalidad) || '')) g.v.c1 = g.add('path', { fill: 'none', stroke: 'var(--maq)', 'stroke-width': 2 }); },
    mover(g, j) { const m = mezclaP(j.mano[0], j.mano[1], 0.5); g.v.peso.setAttribute('cx', m.x.toFixed(1)); g.v.peso.setAttribute('cy', m.y.toFixed(1)); if (g.v.c1) g.v.c1.setAttribute('d', 'M' + f1(m) + ' L254 44'); },
    guia: () => '' };

  FR.aductores = { nombre: 'Aductores', vista: 'frente', textos: { concentrica: 'Junta las rodillas y aprieta', excentrica: 'Abre lento' },
    pose(t, ex) { const abd = /abduc/i.test(ex && ex.ejercicio || ''), a = abd ? mezcla(80, 22, t) : mezcla(22, 82, t); return frentePose({ pelvis: 176, brazo: 96, antebrazo: 60, muslo: a, pierna: 92, profM: 0.65 }); },
    musculos: (j, t, ex) => [0, 1].map(i => ({ d: musculo(j.cad[i], j.rod[i], i ? 1 : -1, 12, 0.15, 0.85, 1 + 0.15 * t), c: mezclaP(j.cad[i], j.rod[i], 0.5), principal: i === 1 })),
    estatico(g) { EQ.asiento(g, CX, 178, 70); g.add('rect', { x: CX - 9, y: 90, width: 18, height: 88, rx: 6, fill: 'var(--maq2)' }); },
    vivo(g) { g.v.c1 = g.add('path', { fill: 'var(--maq)' }); g.v.c2 = g.add('path', { fill: 'var(--maq)' }); },
    mover(g, j) { [0, 1].forEach(i => { const r = j.rod[i], s = i ? -1 : 1; g.v['c' + (i + 1)].setAttribute('d', miembro(P(r.x + s * 8, r.y - 10), P(r.x + s * 8, r.y + 10), 7, 7, 7, 0.5)); }); },
    guia: () => '' };

  Object.assign(F, FR);

  /* =============== ¿Qué animación le toca a cada ejercicio? =============== */
  const sinAcento = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const REGLAS = [
    [/lateral/, 'laterales'], [/apertura|cruce|pec ?deck|peck|fly/, 'aperturas'], [/giro|rotacion|lenador|russian|pallof/, 'giros'], [/aductor|abductor/, 'aductores'],
    [/hip thrust|puente de gluteo|puente/, 'hipThrust'], [/curl femoral|nordico|femoral/, 'curlFemoral'], [/extension de cuadriceps|extension de pierna/, 'extensionPierna'],
    [/prensa|hack/, 'prensa'], [/zancada|desplante|bulgar|unilateral de pierna|lunge|step/, 'zancada'], [/pantorrilla|gemelo|calf/, 'pantorrilla'],
    [/rumano|buenos dias|piernas rigidas/, 'rumano'], [/peso muerto|deadlift/, 'pesoMuerto'], [/sentadilla|squat/, 'sentadilla'],
    [/remo invertido|australian/, 'remoInvertido'], [/remo con barra|remo con mancuerna|remo inclinado|pecho apoyado|remo .*banco|remo t/, 'remoInclinado'], [/remo/, 'remoSentado'],
    [/dominad|pull ?up|chin/, 'dominada'], [/jalon|pulldown/, 'jalon'], [/pullover/, 'pullover'],
    [/fondo|dip/, 'fondos'], [/extension de triceps|triceps|press frances|patada/, 'tricepsPolea'],
    [/muneca|antebrazo/, 'antebrazo'], [/curl|martillo|bicep/, 'curl'], [/granjero|farmer|cargada/, 'granjero'],
    [/press inclinado|inclinado/, 'pressInclinado'], [/press de banca|press plano|press de pecho|pecho plano|banca/, 'pressPlano'],
    [/press militar|press de hombro|hombro|arnold/, 'pressHombro'],
    [/crunch|abdominal|encogimiento abdominal/, 'crunch'], [/elevacion de piernas|elevaciones de rodillas|elevacion de rodillas|silla romana/, 'elevPiernas'],
    [/plancha|hollow|plank/, 'plancha']
  ];
  const POR_MUSCULO = { pecho: 'pressPlano', espalda: 'remoSentado', hombro: 'pressHombro', biceps: 'curl', triceps: 'tricepsPolea', cuadriceps: 'sentadilla',
    'femoral y gluteo': 'rumano', pantorrilla: 'pantorrilla', core: 'crunch' };
  // Primero el nombre del ejercicio, luego su familia (Catálogo V) y su patrón; si nada coincide, por su músculo
  function familiaDe(ex) {
    if (!ex) return 'curl';
    for (const texto of [ex.ejercicio, ex.variante, ex.patron]) {
      const s = sinAcento(texto);
      if (!s) continue;
      for (const [re, fam] of REGLAS) if (re.test(s)) return fam;
    }
    return POR_MUSCULO[sinAcento(ex.musculo)] || ({ Push: 'pressPlano', Pull: 'remoSentado', Legs: 'sentadilla', Core: 'crunch' })[ex.group] || 'curl';
  }

  /* =============== Dibujo en pantalla =============== */
  const NS = 'http://www.w3.org/2000/svg';
  function grupo(padre, attrs) {
    const g = document.createElementNS(NS, 'g'); for (const k in (attrs || {})) g.setAttribute(k, attrs[k]); padre.appendChild(g);
    g.v = {};
    g.add = (tag, a) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); g.appendChild(e); return e; };
    return g;
  }
  const TEXTO_FASE = { concentrica: 'Sube con fuerza', pico: 'Aprieta', excentrica: 'Baja lento', base: 'Estira' };

  class Animacion {
    constructor(cont, ex, o) {
      o = o || {};
      this.ex = ex; this.fam = F[familiaDe(ex)]; this.imp = implemento(ex.modalidad); this.tempo = tempoDe(ex.tempo); this.reps = Number(o.reps) || 0;
      this.cont = cont; this.visible = false; this.desfase = o.desfase || 0;
      cont.innerHTML = '';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 320 260'); svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', 'Animación de ' + (ex.ejercicio || 'el ejercicio') + ': ' + this.fam.nombre);
      cont.appendChild(svg); this.svg = svg;
      const fam = this.fam, pose = (t, r) => fam.pose(t, ex, r || 0);
      this.pose = pose;
      grupo(svg).add('line', { x1: 10, y1: PISO + 2, x2: 310, y2: PISO + 2, stroke: 'var(--piso)', 'stroke-width': 4, 'stroke-linecap': 'round' });
      const guia = fam.guia ? fam.guia(pose(0), pose(1), t => pose(t)) : '';
      if (guia) grupo(svg).add('path', { d: guia, fill: 'none', stroke: 'var(--guia)', 'stroke-width': 1.6, 'stroke-dasharray': '4 4', opacity: 0.85 });
      const frenteV = fam.vista === 'frente';
      // Lado de atrás: brazo y pierna del otro lado, tenues y desplazados (solo de lado)
      if (!frenteV) {
        const a = grupo(svg, { opacity: 0.4, transform: 'translate(5 -3)' }); this.atras = a;
        ['brazo', 'antebrazo', 'muslo', 'pierna'].forEach(k => { a[k] = a.add('path', { fill: 'var(--persona2)' }); });
      }
      this.eq = grupo(svg);
      const eq = fam.equipo || fam;
      if (eq.estatico) eq.estatico(this.eq, this.imp, ex);
      if (fam.equipo && fam.estatico) fam.estatico(this.eq, this.imp, ex);
      if (eq.vivo) eq.vivo(this.eq, this.imp, ex);
      const c = grupo(svg); this.c = c;
      if (frenteV) {
        ['muslo0', 'pierna0', 'muslo1', 'pierna1', 'torso', 'cuello', 'brazo0', 'antebrazo0', 'brazo1', 'antebrazo1'].forEach(k => { c[k] = c.add('path', { fill: 'var(--persona)' }); });
        c.cabeza = c.add('circle', { r: L.cabeza, fill: 'var(--persona)' });
      } else {
        if (fam.piernaAtras || fam.caminando) { c.muslo2 = c.add('path', { fill: 'var(--persona2)' }); c.pierna2 = c.add('path', { fill: 'var(--persona2)' }); }
        ['muslo', 'pierna', 'pie', 'torso', 'cuello'].forEach(k => { c[k] = c.add('path', { fill: 'var(--persona)' }); });
        c.cabeza = c.add('circle', { r: L.cabeza, fill: 'var(--persona)' });
      }
      this.mus = grupo(svg);
      if (!frenteV) {
        // El brazo de este lado va encima del torso, con contorno del color de la tarjeta para que se distinga
        const b = grupo(svg); this.b = b;
        b.borde = b.add('path', { fill: 'none', stroke: 'var(--card)', 'stroke-width': 3 }); b.brazo = b.add('path', { fill: 'var(--persona)' });
        b.antebrazo = b.add('path', { fill: 'var(--persona)' }); b.mano = b.add('circle', { r: 4.5, fill: 'var(--persona)' });
      }
      this.musArriba = grupo(svg);
      this.pico = grupo(svg).add('circle', { r: 10, fill: 'none', stroke: 'var(--musculo)', 'stroke-width': 2, opacity: 0 });
      this.cuenta = grupo(svg).add('text', { x: 308, y: 22, 'text-anchor': 'end', 'font-size': 15, 'font-weight': 700, fill: 'var(--muted)' });
      this.textoFase = o.textoFase || null; this.ultimo = '';
    }
    cuadro(ms) {
      const f = this.fam.estatico_ ? { t: 0.5 + 0.5 * Math.sin(ms / 900), nombre: ['concentrica', 'pico', 'excentrica', 'base'][Math.floor(ms / 1600) % 4], r: 0, rep: Math.floor(ms / 6400) } : fase(ms + this.desfase, this.tempo);
      const j = this.pose(f.t, f.rep), c = this.c, fam = this.fam;
      if (j.frente) {
        [0, 1].forEach(i => {
          c['muslo' + i].setAttribute('d', miembro(j.cad[i], j.rod[i], 17, 15, 11, 0.35));
          c['pierna' + i].setAttribute('d', miembro(j.rod[i], j.tob[i], 11, 12, 7, 0.3));
          c['brazo' + i].setAttribute('d', miembro(j.hom[i], j.codo[i], 11, 11, 8.5, 0.4));
          c['antebrazo' + i].setAttribute('d', miembro(j.codo[i], j.mano[i], 8.5, 9, 6, 0.3));
        });
        const cm = mezclaP(j.cad[0], j.cad[1], 0.5), hm = mezclaP(j.hom[0], j.hom[1], 0.5);
        c.torso.setAttribute('d', 'M' + f1(P(j.cad[0].x - 4, j.cad[0].y + 4)) + ' L' + f1(P(j.hom[0].x - 3, j.hom[0].y)) + ' Q' + f1(P(hm.x, hm.y - 8)) + ' ' + f1(P(j.hom[1].x + 3, j.hom[1].y)) +
          ' L' + f1(P(j.cad[1].x + 4, j.cad[1].y + 4)) + ' Q' + f1(P(cm.x, cm.y + 8)) + ' ' + f1(P(j.cad[0].x - 4, j.cad[0].y + 4)) + 'Z');
        c.cuello.setAttribute('d', miembro(P(j.cuello.x, j.cuello.y + 8), j.cuello, 10, 9, 9, 0.5));
        c.cabeza.setAttribute('cx', j.cabeza.x.toFixed(1)); c.cabeza.setAttribute('cy', j.cabeza.y.toFixed(1));
      } else {
        c.muslo.setAttribute('d', miembro(j.cadera, j.rodilla, 17, 15, 11, 0.35));
        c.pierna.setAttribute('d', miembro(j.rodilla, j.tobillo, 11, 12.5, 7, 0.3));
        c.pie.setAttribute('d', miembro(j.talon, j.punta, 7, 6, 5, 0.5));
        c.torso.setAttribute('d', miembro(j.cadera, j.hombro, 21, 25, 24, 0.7));
        c.cuello.setAttribute('d', miembro(j.hombro, j.cuello, 9, 8, 8, 0.5));
        c.cabeza.setAttribute('cx', j.cabeza.x.toFixed(1)); c.cabeza.setAttribute('cy', j.cabeza.y.toFixed(1));
        if (c.muslo2) {
          const r2 = j.rodilla2 || mas(j.cadera, L.muslo, j.muslo2), t2 = j.tobillo2 || mas(r2, L.pierna, 92);
          c.muslo2.setAttribute('d', miembro(j.cadera, r2, 17, 15, 11, 0.35)); c.pierna2.setAttribute('d', miembro(r2, t2, 11, 12.5, 7, 0.3));
        }
        const brazo = miembro(j.hombro, j.codo, 11, 11.5, 8.5, 0.4), antebrazo = miembro(j.codo, j.mano, 8.5, 9, 6, 0.3);
        this.b.brazo.setAttribute('d', brazo); this.b.borde.setAttribute('d', brazo); this.b.antebrazo.setAttribute('d', antebrazo);
        this.b.mano.setAttribute('cx', j.mano.x.toFixed(1)); this.b.mano.setAttribute('cy', j.mano.y.toFixed(1));
        const a = this.atras;
        a.brazo.setAttribute('d', brazo); a.antebrazo.setAttribute('d', antebrazo);
        if (!c.muslo2) { a.muslo.setAttribute('d', miembro(j.cadera, j.rodilla, 17, 15, 11, 0.35)); a.pierna.setAttribute('d', miembro(j.rodilla, j.tobillo, 11, 12.5, 7, 0.3)); }
      }
      const eq = fam.equipo || fam;
      if (eq.mover) eq.mover(this.eq, j, f.t, this.imp);
      if (fam.equipo && fam.mover) fam.mover(this.eq, j, f.t, this.imp);
      // Músculos: 100 % al subir y al apretar; más tenue al bajar
      const lista = fam.musculos(j, f.t, this.ex), op = OPACIDAD[f.nombre];
      const capa = (g, ls) => {
        while (g.childNodes.length < ls.length) g.add('path', { fill: 'var(--musculo)' });
        for (let i = 0; i < g.childNodes.length; i++) { const n = g.childNodes[i], m = ls[i]; if (m) { n.setAttribute('d', m.d); n.setAttribute('opacity', op); } else n.setAttribute('opacity', 0); }
      };
      capa(this.mus, lista.filter(m => !m.brazo)); capa(this.musArriba, lista.filter(m => m.brazo));
      // Contracción máxima: un aro que se abre y se desvanece mientras aprietas
      const pr = lista.find(m => m.principal);
      if (f.nombre === 'pico' && pr && !fam.estatico_) {
        this.pico.setAttribute('cx', pr.c.x.toFixed(1)); this.pico.setAttribute('cy', pr.c.y.toFixed(1));
        this.pico.setAttribute('r', (9 + f.r * 12).toFixed(1)); this.pico.setAttribute('opacity', (0.85 * (1 - f.r)).toFixed(2));
      } else this.pico.setAttribute('opacity', 0);
      // Contador de repeticiones (la de la serie que sigue): 1 de 12, 2 de 12…
      if (this.reps > 0 && !fam.estatico_) { const n = (f.rep % this.reps) + 1, txt = n + '/' + this.reps; if (this.cuenta.textContent !== txt) this.cuenta.textContent = txt; }
      if (this.textoFase) { const txt = (fam.textos && fam.textos[f.nombre]) || TEXTO_FASE[f.nombre]; if (txt !== this.ultimo) { this.textoFase.textContent = txt; this.ultimo = txt; } }
      return f;
    }
  }

  /* =============== Bucle: solo lo visible; nada con la pantalla apagada =============== */
  const vivas = new Set();
  let corriendo = false, io = null;
  const quieto = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function bucle(ms) {
    let alguna = false;
    vivas.forEach(a => {
      if (!a.cont.isConnected) { vivas.delete(a); if (io) io.unobserve(a.cont); return; }
      // Visible para el observador y con caja real (una ventana cerrada queda en el documento, pero sin dibujarse)
      if (a.visible && a.cont.getClientRects().length) { a.cuadro(ms); alguna = true; }
    });
    corriendo = alguna && !document.hidden && !quieto();
    if (corriendo) requestAnimationFrame(bucle);
  }
  function arrancar() { if (!corriendo && !document.hidden && !quieto()) { corriendo = true; requestAnimationFrame(bucle); } }
  // cont: el elemento donde va la animación; ex: el ejercicio del Catálogo; o: { reps, textoFase }
  function montar(cont, ex, o) {
    const a = new Animacion(cont, ex, o);
    cont.__anim = a; vivas.add(a);
    a.cuadro(quieto() ? a.tempo.concentrica + 50 : 0);   // primer cuadro ya dibujado (con movimiento reducido: quieta en contracción)
    if (typeof IntersectionObserver === 'function') {
      io = io || new IntersectionObserver(ents => { ents.forEach(en => { if (en.target.__anim) en.target.__anim.visible = en.isIntersecting; }); arrancar(); }, { threshold: 0.1 });
      io.observe(cont);
    } else { a.visible = true; arrancar(); }
    return a;
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', arrancar);
  // Texto corto del tempo para la ficha: "Sube 0.8 s · aprieta 0.35 s · baja 1.5 s"
  function tempoTexto(txt) {
    const t = tempoDe(txt), s = ms => (ms / 1000).toLocaleString('es-MX', { maximumFractionDigits: 2 }) + ' s';
    return 'Sube ' + s(t.concentrica) + ' · aprieta ' + s(t.pico) + ' · baja ' + s(t.excentrica);
  }

  const ANIM = { familiaDe: familiaDe, tempoDe: tempoDe, tempoTexto: tempoTexto, fase: fase, ik: ik, implemento: implemento, montar: montar, FAMILIAS: F, TEMPO_BASE: TEMPO_BASE,
    // Para pruebas: la pose de una familia en t (sin dibujar)
    pose: (ex, t, rep) => F[familiaDe(ex)].pose(t, ex, rep || 0) };
  raiz.ANIM = ANIM;
  if (typeof module !== 'undefined' && module.exports) module.exports = ANIM;
})(typeof window !== 'undefined' ? window : globalThis);
