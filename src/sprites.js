// Sprites vetoriais: cada elemento é desenhado com paths em um canvas
// offscreen supersampleado e depois blitado — visual flat e limpo,
// sem pixels visíveis e sem custo de redesenhar paths a cada quadro.
import { C } from './theme.js';

const SS = 3; // supersampling: mantém as bordas suaves até zoom 3x
const cache = new Map();

/**
 * Cria um sprite. `draw(g)` desenha em coordenadas lógicas (w x h),
 * com a origem no canto superior esquerdo; a âncora fica no pé central.
 */
export function sprite(key, w, h, draw) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * SS);
  c.height = Math.ceil(h * SS);
  const g = c.getContext('2d');
  g.scale(SS, SS);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  draw(g);
  c.logicalW = w;
  c.logicalH = h;
  cache.set(key, c);
  return c;
}

/* ---------------------------------------------------------------- */
/* Helpers de desenho                                                */
/* ---------------------------------------------------------------- */

function poly(g, pts, fill) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
}

function circle(g, x, y, r, fill) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
}

function oval(g, x, y, rx, ry, fill, rot = 0) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
}

function rr(g, x, y, w, h, r, fill) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fillStyle = fill;
  g.fill();
}

/** Base elíptica que assenta o objeto no losango do tile. */
function base(g, cx, y, rx, fill) {
  oval(g, cx, y, rx, rx * 0.5, fill);
}

/* ---------------------------------------------------------------- */
/* Vegetação e cenário                                               */
/* ---------------------------------------------------------------- */

export const props = {
  /** Pinheiro: cone em três camadas, com a face direita mais escura. */
  pine: () => sprite('pine', 34, 74, (g) => {
    rr(g, 15.5, 54, 3, 12, 1.5, C.trunk);
    const tiers = [
      { y: 66, w: 15, h: 22 },
      { y: 50, w: 12.5, h: 20 },
      { y: 34, w: 9.5, h: 19 },
    ];
    for (const t of tiers) {
      poly(g, [[17, t.y - t.h], [17 + t.w, t.y], [17 - t.w, t.y]], C.pine[0]);
      poly(g, [[17, t.y - t.h], [17 + t.w, t.y], [17, t.y]], C.pine[1]);
    }
  }),

  /** Árvore redonda: aglomerado de círculos com um lado iluminado. */
  oak: () => sprite('oak', 46, 56, (g) => {
    rr(g, 21, 38, 4, 14, 2, C.trunk);
    circle(g, 17, 26, 12, C.leaf[1]);
    circle(g, 30, 28, 11, C.leaf[1]);
    circle(g, 23, 18, 13, C.leaf[0]);
    circle(g, 18, 15, 7.5, C.leaf[2]);
  }),

  bush: () => sprite('bush', 30, 22, (g) => {
    circle(g, 11, 14, 7, C.bush[1]);
    circle(g, 20, 15, 6, C.bush[1]);
    circle(g, 15, 10, 8, C.bush[0]);
  }),

  rock: () => sprite('rock', 34, 26, (g) => {
    poly(g, [[6, 20], [11, 7], [20, 4], [28, 12], [26, 20]], C.rock[0]);
    poly(g, [[20, 4], [28, 12], [26, 20], [19, 20]], C.rock[1]);
    base(g, 17, 20, 11, C.rock[1]);
  }),

  mushroom: () => sprite('mushroom', 14, 16, (g) => {
    rr(g, 6, 8, 2.4, 6, 1.2, C.mushroom[1]);
    oval(g, 7, 8, 5.5, 3.6, C.mushroom[0]);
  }),

  flower: () => sprite('flower', 14, 14, (g) => {
    g.strokeStyle = C.fern;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(7, 12);
    g.lineTo(7, 6);
    g.stroke();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      circle(g, 7 + Math.cos(a) * 2.4, 5 + Math.sin(a) * 2.4, 1.7, C.flower);
    }
  }),

  fern: () => sprite('fern', 22, 18, (g) => {
    g.strokeStyle = C.fern;
    g.lineWidth = 1.6;
    for (const a of [-0.85, -0.35, 0, 0.35, 0.85]) {
      g.beginPath();
      g.moveTo(11, 16);
      g.quadraticCurveTo(11 + Math.sin(a) * 6, 8, 11 + Math.sin(a) * 10, 3);
      g.stroke();
    }
  }),

  /** Barraca de acampamento com fogueira ao lado. */
  tent: () => sprite('tent', 48, 40, (g) => {
    poly(g, [[16, 8], [30, 32], [2, 32]], C.canvasTent[0]);
    poly(g, [[16, 8], [30, 32], [16, 32]], C.canvasTent[1]);
    poly(g, [[16, 14], [22, 32], [10, 32]], 'rgba(60,66,70,0.30)');
    circle(g, 39, 30, 4.5, 'rgba(120,128,132,0.35)');
    poly(g, [[39, 22], [42, 30], [36, 30]], C.fire);
  }),

  /** Placa de trilha com três indicações. */
  signpost: () => sprite('signpost', 76, 72, (g) => {
    rr(g, 36, 16, 4, 50, 2, C.woodDark);
    const signs = ['Explorar', 'Trilha', 'Lago'];
    g.font = '600 8px ui-sans-serif, system-ui, sans-serif';
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    signs.forEach((text, i) => {
      const y = 18 + i * 14;
      const x = i % 2 === 0 ? 6 : 32;
      rr(g, x, y, 38, 11, 5.5, C.label);
      g.fillStyle = C.labelText;
      g.fillText(text, x + 19, y + 6);
    });
  }),
};

/** Ponte de tábuas atravessando a água (desenhada sobre o tile). */
export const bridge = () => sprite('bridge', 74, 34, (g) => {
  g.strokeStyle = C.wood[1];
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(6, 24);
  g.quadraticCurveTo(37, 4, 68, 24);
  g.stroke();
  g.strokeStyle = C.wood[0];
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(6, 22);
  g.quadraticCurveTo(37, 2, 68, 22);
  g.stroke();
  g.strokeStyle = 'rgba(90,84,76,0.45)';
  g.lineWidth = 0.9;
  // Tábuas transversais, posicionadas sobre a mesma curva de Bézier.
  const at = (t, a, b, c) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
  for (let i = 1; i < 9; i++) {
    const t = i / 9;
    const x = at(t, 6, 37, 68);
    const y = at(t, 22, 2, 22);
    g.beginPath();
    g.moveTo(x, y - 2.5);
    g.lineTo(x, y + 2.5);
    g.stroke();
  }
});

/** Pequeno veleiro para o lago. */
export const boat = () => sprite('boat', 34, 40, (g) => {
  poly(g, [[16, 10], [16, 32], [4, 32]], C.sail);
  g.strokeStyle = C.woodDark;
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(17, 8);
  g.lineTo(17, 33);
  g.stroke();
  poly(g, [[3, 33], [31, 33], [26, 38], [8, 38]], C.wood[1]);
});

/* ---------------------------------------------------------------- */
/* Fauna — silhuetas vetoriais em tons de cinza                      */
/* ---------------------------------------------------------------- */

/** Patas: dois pares balançando conforme a fase da caminhada. */
function legs(g, xs, y, h, phase, color, w = 3) {
  xs.forEach((x, i) => {
    const swing = Math.sin(phase + i * Math.PI * 0.9) * 2.2;
    rr(g, x + swing, y, w, h, w / 2, color);
  });
}

function eye(g, x, y, r = 1.3) {
  circle(g, x, y, r, C.ink);
}

const fauna = {
  coelho: { w: 40, h: 34, draw(g, p, f) {
    legs(g, [12, 22], 24, 8, p, f[1], 3.4);
    oval(g, 19, 20, 11, 8, f[0]);
    circle(g, 29, 13, 6.5, f[0]);
    oval(g, 28, 4, 2.2, 6.5, f[0], 0.12);
    oval(g, 32, 5, 2.2, 6, f[0], 0.25);
    circle(g, 9, 19, 4, C.white);
    eye(g, 31, 12);
  } },

  raposa: { w: 54, h: 32, draw(g, p, f) {
    // Cauda: dois volumes encadeados terminando na ponta branca.
    oval(g, 19, 17.5, 10, 6.5, f[1], -0.2);
    oval(g, 11, 14.5, 7, 5, f[1], -0.35);
    circle(g, 5.5, 12.5, 4.5, C.white);
    legs(g, [16, 24, 30, 36], 22, 8, p, f[1]);
    oval(g, 28, 18, 14, 7, f[0]);
    circle(g, 41, 12, 6, f[0]);
    poly(g, [[41, 6], [45, 3], [44, 10]], f[1]);
    poly(g, [[37, 7], [40, 2], [42, 8]], f[1]);
    poly(g, [[45, 11], [52, 14], [45, 15]], f[0]);
    eye(g, 44, 11);
  } },

  veado: { w: 52, h: 46, draw(g, p, f) {
    g.strokeStyle = f[1];
    g.lineWidth = 1.6;
    for (const dx of [-3, 3]) {
      g.beginPath();
      g.moveTo(36 + dx, 14);
      g.lineTo(37 + dx * 2, 4);
      g.moveTo(37 + dx * 1.5, 8);
      g.lineTo(41 + dx * 2.2, 6);
      g.stroke();
    }
    legs(g, [14, 21, 30, 36], 30, 13, p, f[1]);
    oval(g, 25, 25, 14, 8, f[0]);
    rr(g, 32, 12, 5, 14, 2.5, f[0]);
    oval(g, 38, 12, 7, 4.5, f[0], -0.25);
    oval(g, 33, 9, 3.5, 2, f[1], -0.7);
    eye(g, 38, 11);
  } },

  javali: { w: 50, h: 28, draw(g, p, f) {
    legs(g, [14, 21, 29, 35], 19, 8, p, f[1]);
    oval(g, 24, 14, 15, 8, f[0]);
    oval(g, 37, 14, 8, 6.5, f[0]);
    poly(g, [[37, 10], [41, 5], [42, 12]], f[1]);
    oval(g, 45, 15, 3.5, 3, f[1]);
    poly(g, [[44, 13], [48, 9], [45, 14]], C.white);
    eye(g, 40, 12, 1.1);
  } },

  coruja: { w: 34, h: 34, draw(g, p, f) {
    const flap = Math.sin(p) * 3;
    oval(g, 7, 18 + flap, 6, 3.5, f[1], -0.5);
    oval(g, 27, 18 - flap, 6, 3.5, f[1], 0.5);
    oval(g, 17, 20, 9.5, 11, f[0]);
    oval(g, 17, 22, 6, 7.5, C.white);
    circle(g, 17, 12, 8.5, f[0]);
    poly(g, [[9, 8], [12, 2], [14, 8]], f[1]);
    poly(g, [[25, 8], [22, 2], [20, 8]], f[1]);
    circle(g, 13.5, 12, 3.6, C.white);
    circle(g, 20.5, 12, 3.6, C.white);
    eye(g, 13.5, 12, 1.8);
    eye(g, 20.5, 12, 1.8);
    poly(g, [[17, 13], [19, 16], [15, 16]], '#d8ae5e');
  } },
};

const FRAMES = 4;

/** Espelha um sprite (animal virado para a esquerda). */
function mirror(src) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d');
  g.translate(c.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  c.logicalW = src.logicalW;
  c.logicalH = src.logicalH;
  return c;
}

/** { right: [...4 quadros], left: [...] } para uma espécie. */
export function animalFrames(species) {
  const key = `fauna:${species}`;
  if (cache.has(key)) return cache.get(key);
  const spec = fauna[species];
  const fur = C.fur[species];
  const right = [];
  for (let i = 0; i < FRAMES; i++) {
    right.push(sprite(`${key}:${i}`, spec.w, spec.h, (g) => {
      spec.draw(g, (i / FRAMES) * Math.PI * 2, fur);
    }));
  }
  const set = { right, left: right.map(mirror) };
  cache.set(key, set);
  return set;
}

/** Sombra suave compartilhada por tudo que fica em pé no chão. */
export const shadow = () => sprite('shadow', 48, 24, (g) => {
  oval(g, 24, 12, 22, 10, C.shadow);
});

/** Nuvem chapada para o fundo. */
export const cloud = () => sprite('cloud', 90, 40, (g) => {
  circle(g, 28, 24, 14, C.cloud);
  circle(g, 48, 20, 17, C.cloud);
  circle(g, 66, 26, 12, C.cloud);
  rr(g, 22, 24, 50, 12, 6, C.cloud);
});
