// Pixel art desenhada por código: cada sprite é um mapa de caracteres.
// Nada de modelos 3D — tudo vira um canvas offscreen com pixels quadrados.

const cache = new Map();

/** Converte um mapa de caracteres + paleta em um canvas ampliado. */
export function pix(rows, palette, scale = 3) {
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const c = document.createElement('canvas');
  c.width = w * scale;
  c.height = h * scale;
  const g = c.getContext('2d');
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]];
      if (!color) continue;
      g.fillStyle = color;
      g.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  c.anchorX = c.width / 2;
  c.anchorY = c.height;
  return c;
}

/** Espelha um canvas horizontalmente (animal virado para o outro lado). */
export function flip(src) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d');
  g.translate(c.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  c.anchorX = src.anchorX;
  c.anchorY = src.anchorY;
  return c;
}

function build(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

/* ------------------------------------------------------------------ */
/* Paletas                                                             */
/* ------------------------------------------------------------------ */

const P = {
  // vegetação
  t: '#3b2a1c', T: '#553d28', // tronco
  l: '#2f7a3d', L: '#43a353', m: '#1f5730', // folhagem
  p: '#5aa83f', P: '#7cc355', // arbusto
  f: '#e8d05a', F: '#e07fa8', // flores
  r: '#6b6f73', R: '#8b9196', // pedra
  k: '#d0744f', K: '#f0e6d2', // cogumelo
  // fauna
  w: '#f2ece0', W: '#ffffff', // branco
  b: '#d8d2c6', B: '#a89f8e', // bege
  o: '#d4762f', O: '#f09a4a', // laranja
  n: '#8a5a33', N: '#a9743f', // marrom
  g: '#4a4238', G: '#2b2620', // grafite
  e: '#151312', // olho / contorno
  s: '#e2a0a0', // rosa
  y: '#e8c34a', // amarelo
};

/* ------------------------------------------------------------------ */
/* Cenário                                                             */
/* ------------------------------------------------------------------ */

export const props = {
  pine: () => build('pine', () => pix([
    '......ll......',
    '.....llll.....',
    '.....lLLl.....',
    '....llLLll....',
    '...lLLLLLLl...',
    '...lmLLLLml...',
    '..llLLLLLLll..',
    '.llLLLLLLLLll.',
    '..mmLLLLLLmm..',
    '.llLLLLLLLLll.',
    'llLLLLLLLLLLll',
    '.mmLLLLLLLLmm.',
    '...llLLLLll...',
    '......TT......',
    '......Tt......',
    '.....tTTt.....',
  ], P, 3)),

  oak: () => build('oak', () => pix([
    '...LLLLLL...',
    '..LLLLLLLL..',
    '.LLlLLLLlLL.',
    'LLLLLLLLLLLL',
    'LLlLLLLLLlLL',
    'LmLLLLLLLLmL',
    '.LLLLLLLLLL.',
    '..mLLLLLLm..',
    '...LLLLLL...',
    '.....TT.....',
    '.....Tt.....',
    '....tTTt....',
    '...ttTTtt...',
  ], P, 3)),

  bush: () => build('bush', () => pix([
    '..pppp..',
    '.pPPPPp.',
    'pPPPPPPp',
    'pPPpPPPp',
    '.ppPPpp.',
    '..pppp..',
  ], P, 3)),

  rock: () => build('rock', () => pix([
    '..RRR...',
    '.RRRRR..',
    'RRRRRRR.',
    'rRRRRRRr',
    'rrrrrrrr',
  ], P, 3)),

  mushroom: () => build('mushroom', () => pix([
    '.kkk.',
    'kkKkk',
    '.KKK.',
    '..K..',
    '..K..',
  ], P, 3)),

  flower: () => build('flower', () => pix([
    '.f.f.',
    'ffFff',
    '..p..',
    '.p.p.',
  ], P, 3)),

  fern: () => build('fern', () => pix([
    '.p.p.p.',
    'pPpPpPp',
    '.pPPPp.',
    '..ppp..',
  ], P, 3)),
};

/* ------------------------------------------------------------------ */
/* Animais — dois quadros de caminhada, virados para a direita         */
/* ------------------------------------------------------------------ */

const animalArt = {
  coelho: [[
    '..b.....b...',
    '..bb...bb...',
    '..bsb.bsb...',
    '..bbb.bbb...',
    '...bbbbb....',
    '..bbbebb....',
    '.bbbbbbbb...',
    'bBbbbbbbbb..',
    'wbbbbbbbbb..',
    '.bBbbbbbbb..',
    '..bb...bb...',
    '..BB...BB...',
  ], [
    '..b.....b...',
    '..bb...bb...',
    '..bsb.bsb...',
    '..bbb.bbb...',
    '...bbbbb....',
    '..bbbebb....',
    '.bbbbbbbb...',
    'bBbbbbbbbb..',
    'wbbbbbbbbb..',
    '.bBbbbbbbb..',
    '.bb.....bb..',
    '.BB.......BB',
  ]],

  raposa: [[
    '...........o.o.....',
    '..........ooooo....',
    '.........oOOOOo....',
    '....oooo.oOeOOo....',
    '..ooOOOOooOOOwo....',
    '.oOOOOOOOOOOww.....',
    'woOOOOOOOOOOo......',
    '.wwoOOOOOOOOo......',
    '...oo.oo.oo.o......',
    '...gg.gg.gg.g......',
  ], [
    '...........o.o.....',
    '..........ooooo....',
    '.........oOOOOo....',
    '....oooo.oOeOOo....',
    '..ooOOOOooOOOwo....',
    '.oOOOOOOOOOOww.....',
    'woOOOOOOOOOOo......',
    '.wwoOOOOOOOOo......',
    '..o..oo..oo..o.....',
    '..g..gg..gg..g.....',
  ]],

  veado: [[
    '.......n...n.......',
    '......n.n.n.n......',
    '.......nnnnn.......',
    '........nnn........',
    '.......nnnnn.......',
    '.......nenn........',
    '........nnn........',
    '........nn.........',
    '..nnnnnnnn.........',
    '.nNNNNNNNn.........',
    'nNNNwwNNNNn........',
    '.nNNNNNNNn.........',
    '..n.nn.n.n.........',
    '..N.NN.N.N.........',
  ], [
    '.......n...n.......',
    '......n.n.n.n......',
    '.......nnnnn.......',
    '........nnn........',
    '.......nnnnn.......',
    '.......nenn........',
    '........nnn........',
    '........nn.........',
    '..nnnnnnnn.........',
    '.nNNNNNNNn.........',
    'nNNNwwNNNNn........',
    '.nNNNNNNNn.........',
    '.n..nn..n.n........',
    '.N..NN..N..N.......',
  ]],

  javali: [[
    '..............g....',
    '...ggggggg...gg....',
    '..gGGGGGGGgggGg....',
    '.gGGGGGGGGGGGeGw...',
    'GgGGGGGGGGGGGGGw...',
    '.gGGGGGGGGGGGg.....',
    '..gg.gg.gg.gg......',
    '..GG.GG.GG.GG......',
  ], [
    '..............g....',
    '...ggggggg...gg....',
    '..gGGGGGGGgggGg....',
    '.gGGGGGGGGGGGeGw...',
    'GgGGGGGGGGGGGGGw...',
    '.gGGGGGGGGGGGg.....',
    '.gg...gg.gg...gg...',
    '.GG...GG.GG...GG...',
  ]],

  coruja: [[
    '...nnnnn...',
    '..nNNNNNn..',
    '.nNyeyeyNn.',
    '.nNNNyNNNn.',
    '.nNNwwwNNn.',
    '.nNwwwwwNn.',
    '..nNwwwNn..',
    '...nnnnn...',
    '....y.y....',
  ], [
    '...........',
    '...nnnnn...',
    '..nNNNNNn..',
    '.nNyeyeyNn.',
    '.nNNNyNNNn.',
    'nNNwwwNNn..',
    'nNwwwwwNn..',
    '.nNwwwNn...',
    '..y...y....',
  ]],
};

/** Retorna { right: [f0, f1], left: [f0, f1] } para uma espécie. */
export function animalFrames(species) {
  return build(`animal:${species}`, () => {
    const right = animalArt[species].map((rows) => pix(rows, P, 3));
    return { right, left: right.map(flip) };
  });
}

/** Sombra elíptica reaproveitada por todas as entidades. */
export const shadow = () => build('shadow', () => {
  const c = document.createElement('canvas');
  c.width = 40;
  c.height = 20;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(8, 20, 12, 0.32)';
  g.beginPath();
  g.ellipse(20, 10, 18, 8, 0, 0, Math.PI * 2);
  g.fill();
  return c;
});
