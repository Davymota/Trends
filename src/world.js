import { makeRng, makeNoise, fbm } from './rng.js';
import { C } from './theme.js';
import { toScreen, TILE_W, TILE_H } from './iso.js';
import { regionOutlines } from './contour.js';

export const TERRAIN = {
  VOID: 0, // fora da ilha: não é desenhado, o fundo claro aparece
  WATER: 1,
  SAND: 2,
  GRASS: 3,
  MOSS: 4,
  DIRT: 5,
  ROCK: 6,
};

// [topo claro, topo escuro] — a variação por tile escolhe entre os dois.
export const TERRAIN_COLORS = {
  [TERRAIN.WATER]: C.water,
  [TERRAIN.SAND]: C.sand,
  [TERRAIN.GRASS]: C.grass,
  [TERRAIN.MOSS]: C.moss,
  [TERRAIN.DIRT]: C.dirt,
  [TERRAIN.ROCK]: C.rock,
};

export const LEVEL_HEIGHT = 9; // px por degrau de elevação
export const BASE_DEPTH = 14; // espessura do "bolo" de terra da ilha

export class World {
  constructor(size = 44, seed = Date.now() & 0xffff) {
    this.size = size;
    this.seed = seed;
    this.tiles = new Uint8Array(size * size);
    this.elev = new Uint8Array(size * size);
    this.props = [];
    this.decals = []; // pontes, barcos: desenhados junto com os props
    this.generate();
  }

  idx(x, y) {
    return y * this.size + x;
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }

  terrainAt(x, y) {
    if (!this.inBounds(x, y)) return TERRAIN.VOID;
    return this.tiles[this.idx(x, y)];
  }

  elevAt(x, y) {
    if (!this.inBounds(x, y)) return 0;
    return this.elev[this.idx(x, y)];
  }

  isLand(x, y) {
    const t = this.terrainAt(x, y);
    return t !== TERRAIN.VOID && t !== TERRAIN.WATER;
  }

  /** Animais ficam em terra firme e não atravessam troncos nem pedras. */
  isWalkable(x, y) {
    const gx = Math.round(x);
    const gy = Math.round(y);
    if (!this.isLand(gx, gy)) return false;
    return !this.blocked.has(`${gx},${gy}`);
  }

  generate() {
    const { size } = this;
    const rng = makeRng(this.seed);
    const land = makeNoise(this.seed);
    const wet = makeNoise(this.seed ^ 0x9e37);
    const grove = makeNoise(this.seed ^ 0x51ed);

    const rocky = makeNoise(this.seed ^ 0x2f1b);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = this.idx(x, y);
        // A costa é recortada por ruído: a ilha fica com forma orgânica.
        const dx = (x / (size - 1)) * 2 - 1;
        const dy = (y / (size - 1)) * 2 - 1;
        const falloff = 1 - Math.min(1, Math.hypot(dx, dy) / 0.92) ** 0.75;
        const h = fbm(land, x * 0.075, y * 0.075, 4) * 0.62 + falloff * 0.78;

        let t;
        if (h < 0.46) t = TERRAIN.VOID;
        else if (fbm(rocky, x * 0.2 + 90, y * 0.2 + 90, 2) > 0.70) t = TERRAIN.ROCK;
        else t = fbm(wet, x * 0.12 + 40, y * 0.12 + 40, 3) > 0.56 ? TERRAIN.MOSS : TERRAIN.GRASS;

        this.tiles[i] = t;
        this.elev[i] = h < 0.52 ? 0 : h < 0.63 ? 1 : h < 0.74 ? 2 : 3;
      }
    }

    this.carveRiver(rng);
    this.addBeaches();
    this.carveTrail(rng);
    this.plant(rng, grove);
    this.pruneIslets();
    this.placeLandmarks(rng);
    this.buildOutlines();
    this.measureBounds();
  }

  /** Remove lascas de terreno soltas, deixando só a ilha principal. */
  pruneIslets() {
    const { size } = this;
    const seen = new Uint8Array(size * size);
    const components = [];

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const start = this.idx(x, y);
        if (seen[start] || this.tiles[start] === TERRAIN.VOID) continue;
        const stack = [start];
        const cells = [];
        seen[start] = 1;
        while (stack.length) {
          const i = stack.pop();
          cells.push(i);
          const cx = i % size;
          const cy = (i / size) | 0;
          for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + ox;
            const ny = cy + oy;
            if (!this.inBounds(nx, ny)) continue;
            const ni = this.idx(nx, ny);
            if (seen[ni] || this.tiles[ni] === TERRAIN.VOID) continue;
            seen[ni] = 1;
            stack.push(ni);
          }
        }
        components.push(cells);
      }
    }

    if (!components.length) return;
    const main = components.reduce((a, b) => (b.length > a.length ? b : a));
    for (const cells of components) {
      if (cells === main || cells.length > 24) continue;
      for (const i of cells) this.tiles[i] = TERRAIN.VOID;
    }
    this.props = this.props.filter((pr) => this.terrainAt(Math.round(pr.x), Math.round(pr.y)) !== TERRAIN.VOID);
  }

  /**
   * Converte a grade em silhuetas curvas, calculadas uma única vez:
   * um degrau por nível de elevação e uma mancha por tipo de terreno.
   */
  buildOutlines() {
    const { size } = this;
    const at = (x, y) => (this.inBounds(x, y) ? this.tiles[this.idx(x, y)] : TERRAIN.VOID);
    const elevAt = (x, y) => (this.inBounds(x, y) ? this.elev[this.idx(x, y)] : 0);

    this.maxElev = 0;
    for (let i = 0; i < this.elev.length; i++) {
      if (this.tiles[i] !== TERRAIN.VOID && this.elev[i] > this.maxElev) this.maxElev = this.elev[i];
    }

    // Degraus: cada nível é uma laje empilhada sobre a anterior.
    this.steps = [];
    for (let level = 0; level <= this.maxElev; level++) {
      const loops = regionOutlines(size, (x, y) => at(x, y) !== TERRAIN.VOID && elevAt(x, y) >= level);
      if (loops.length) this.steps.push({ level, loops });
    }

    // Manchas de terreno, separadas por nível para assentarem no degrau certo.
    this.patches = [];
    for (const terrain of [TERRAIN.WATER, TERRAIN.SAND, TERRAIN.DIRT, TERRAIN.MOSS, TERRAIN.ROCK]) {
      for (let level = 0; level <= this.maxElev; level++) {
        const loops = regionOutlines(size, (x, y) => at(x, y) === terrain && elevAt(x, y) === level);
        if (loops.length) this.patches.push({ terrain, level, loops });
      }
    }
  }

  /** Extensão da ilha em pixels de tela, para enquadrar a câmera. */
  measureBounds() {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.tiles[this.idx(x, y)] === TERRAIN.VOID) continue;
        const p = toScreen(x, y);
        const lift = this.elev[this.idx(x, y)] * LEVEL_HEIGHT;
        if (p.x - TILE_W / 2 < minX) minX = p.x - TILE_W / 2;
        if (p.x + TILE_W / 2 > maxX) maxX = p.x + TILE_W / 2;
        if (p.y - lift - TILE_H / 2 < minY) minY = p.y - lift - TILE_H / 2;
        if (p.y + TILE_H / 2 + BASE_DEPTH > maxY) maxY = p.y + TILE_H / 2 + BASE_DEPTH;
      }
    }
    this.bounds = { minX, minY, maxX, maxY };
  }

  /** Um rio atravessando a ilha, alargando em um lago no meio. */
  carveRiver(rng) {
    const { size } = this;
    let x = Math.floor(size * (0.3 + rng() * 0.25));
    let y = 0;
    this.river = [];
    while (y < size) {
      const wide = 1 + (Math.abs(y - size / 2) < size * 0.12 ? 2 : 0);
      for (let ox = -wide; ox <= wide; ox++) {
        for (let oy = 0; oy <= 1; oy++) {
          const nx = x + ox;
          const ny = y + oy;
          if (!this.inBounds(nx, ny)) continue;
          const i = this.idx(nx, ny);
          if (this.tiles[i] === TERRAIN.VOID) continue;
          this.tiles[i] = TERRAIN.WATER;
          this.elev[i] = 0;
        }
      }
      this.river.push({ x, y });
      y += 1;
      x += rng() < 0.35 ? (rng() < 0.5 ? -1 : 1) : 0;
      x = Math.max(2, Math.min(size - 3, x));
    }
  }

  /** Uma faixa de areia onde a terra encosta na água ou na borda da ilha. */
  addBeaches() {
    const { size } = this;
    const beach = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!this.isLand(x, y) || this.elev[this.idx(x, y)] > 1) continue;
        const touchesEdge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oy]) => {
          const t = this.terrainAt(x + ox, y + oy);
          return t === TERRAIN.VOID || t === TERRAIN.WATER;
        });
        if (touchesEdge) beach.push(this.idx(x, y));
      }
    }
    for (const i of beach) {
      this.tiles[i] = TERRAIN.SAND;
      this.elev[i] = 0;
    }
  }

  /** Trilha de terra que cruza a ilha; onde cruza a água, vira ponte. */
  carveTrail(rng) {
    const { size } = this;
    let y = Math.floor(size * (0.35 + rng() * 0.3));
    this.crossings = [];
    for (let x = 0; x < size; x++) {
      for (let oy = 0; oy <= 1; oy++) {
        const ny = y + oy;
        if (!this.inBounds(x, ny)) continue;
        const i = this.idx(x, ny);
        const t = this.tiles[i];
        if (t === TERRAIN.VOID) continue;
        if (t === TERRAIN.WATER) {
          if (oy === 0) this.crossings.push({ x, y: ny });
          continue;
        }
        this.tiles[i] = TERRAIN.DIRT;
      }
      if (rng() < 0.4) y += rng() < 0.5 ? -1 : 1;
      y = Math.max(2, Math.min(size - 4, y));
    }
  }

  /** Distribui árvores, arbustos e detalhes conforme a densidade da mata. */
  plant(rng, grove) {
    this.props = [];
    this.blocked = new Set();
    const { size } = this;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const t = this.tiles[this.idx(x, y)];
        if (t === TERRAIN.VOID || t === TERRAIN.WATER || t === TERRAIN.SAND || t === TERRAIN.DIRT) {
          continue;
        }

        const density = fbm(grove, x * 0.07, y * 0.07, 3);
        const roll = rng();

        let kind = null;
        if (t === TERRAIN.ROCK) {
          if (roll < 0.26) kind = 'rock';
          else if (roll < 0.34) kind = 'pine';
        } else if (roll < density * 0.5) {
          kind = rng() < 0.6 ? 'pine' : 'oak';
        } else if (roll < density * 0.5 + 0.07) {
          kind = 'bush';
        } else if (roll < density * 0.5 + 0.10) {
          kind = t === TERRAIN.MOSS ? 'fern' : 'flower';
        } else if (roll < density * 0.5 + 0.115) {
          kind = 'mushroom';
        }

        if (!kind) continue;
        this.props.push({ kind, x: x + (rng() - 0.5) * 0.3, y: y + (rng() - 0.5) * 0.3 });
        if (kind === 'pine' || kind === 'oak' || kind === 'rock') this.blocked.add(`${x},${y}`);
      }
    }
  }

  /** Pontes sobre o rio, a placa central, o acampamento e o barco. */
  placeLandmarks(rng) {
    this.decals = [];

    // No máximo três pontes, bem espaçadas ao longo do rio.
    let lastY = -99;
    for (const cross of this.crossings) {
      if (cross.y - lastY < 6) continue;
      lastY = cross.y;
      this.decals.push({ kind: 'bridge', x: cross.x, y: cross.y });
      if (this.decals.length >= 3) break;
    }

    // Placa: na trilha, em terra, perto do centro da ilha.
    const mid = this.size / 2;
    let bestSign = null;
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.tiles[this.idx(x, y)] !== TERRAIN.DIRT) continue;
        const d = Math.hypot(x - mid, y - mid);
        if (!bestSign || d < bestSign.d) bestSign = { x, y, d };
      }
    }
    if (bestSign) {
      this.props.push({ kind: 'signpost', x: bestSign.x, y: bestSign.y });
      this.blocked.add(`${bestSign.x},${bestSign.y}`);
    }

    // Acampamento: uma clareira de grama longe do rio.
    for (let i = 0; i < 300; i++) {
      const x = Math.floor(rng() * this.size);
      const y = Math.floor(rng() * this.size);
      if (this.tiles[this.idx(x, y)] !== TERRAIN.GRASS) continue;
      if (this.blocked.has(`${x},${y}`)) continue;
      this.props.push({ kind: 'tent', x, y });
      this.blocked.add(`${x},${y}`);
      break;
    }

    // Barco: em água aberta, com espaço ao redor.
    for (let i = 0; i < 400; i++) {
      const x = Math.floor(rng() * this.size);
      const y = Math.floor(rng() * this.size);
      if (this.terrainAt(x, y) !== TERRAIN.WATER) continue;
      if (this.terrainAt(x + 1, y) !== TERRAIN.WATER) continue;
      if (this.terrainAt(x, y + 1) !== TERRAIN.WATER) continue;
      this.decals.push({ kind: 'boat', x, y, bob: rng() * Math.PI * 2 });
      break;
    }
  }

  /** Um tile aleatório onde um animal pode nascer. */
  randomWalkable(rng) {
    for (let i = 0; i < 4000; i++) {
      const x = Math.floor(rng() * this.size);
      const y = Math.floor(rng() * this.size);
      if (this.isWalkable(x, y)) return { x, y };
    }
    return { x: this.size >> 1, y: this.size >> 1 };
  }
}
