import { makeRng, makeNoise, fbm } from './rng.js';

export const TERRAIN = {
  WATER: 0,
  SAND: 1,
  GRASS: 2,
  MOSS: 3,
  DIRT: 4,
  ROCK: 5,
};

// Topo do losango e as duas faces laterais (mais escuras) de cada terreno.
export const TERRAIN_COLORS = {
  [TERRAIN.WATER]: ['#2b6a86', '#1d4d63', '#173f52'],
  [TERRAIN.SAND]: ['#cbb98a', '#a99a70', '#8e8a5f'],
  [TERRAIN.GRASS]: ['#4c9448', '#3a7538', '#2f602e'],
  [TERRAIN.MOSS]: ['#3a7a3f', '#2d6032', '#254e2a'],
  [TERRAIN.DIRT]: ['#8a6c45', '#6e5537', '#5a462e'],
  [TERRAIN.ROCK]: ['#767b7f', '#5d6367', '#4c5155'],
};

export const LEVEL_HEIGHT = 10; // px de altura por degrau de elevação

export class World {
  constructor(size = 46, seed = Date.now() & 0xffff) {
    this.size = size;
    this.seed = seed;
    this.tiles = new Uint8Array(size * size);
    this.elev = new Uint8Array(size * size);
    this.tint = new Float32Array(size * size);
    this.props = [];
    this.generate();
  }

  idx(x, y) {
    return y * this.size + x;
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }

  terrainAt(x, y) {
    if (!this.inBounds(x, y)) return TERRAIN.WATER;
    return this.tiles[this.idx(x, y)];
  }

  elevAt(x, y) {
    if (!this.inBounds(x, y)) return 0;
    return this.elev[this.idx(x, y)];
  }

  /** Animais não entram na água nem atravessam troncos e pedras. */
  isWalkable(x, y) {
    const t = this.terrainAt(Math.round(x), Math.round(y));
    if (t === TERRAIN.WATER) return false;
    return !this.blocked.has(`${Math.round(x)},${Math.round(y)}`);
  }

  generate() {
    const { size } = this;
    const rng = makeRng(this.seed);
    const land = makeNoise(this.seed);
    const wet = makeNoise(this.seed ^ 0x9e37);
    const grove = makeNoise(this.seed ^ 0x51ed);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = this.idx(x, y);
        // Bordas caem para a água, então a ilha fica contida na tela.
        const dx = (x / size) * 2 - 1;
        const dy = (y / size) * 2 - 1;
        const edge = 1 - Math.min(1, Math.hypot(dx, dy) / 0.98);

        const h = fbm(land, x * 0.09, y * 0.09, 4) * 0.75 + edge * 0.55;
        const w = fbm(wet, x * 0.13 + 50, y * 0.13 + 50, 3);

        let t;
        if (h < 0.42) t = TERRAIN.WATER;
        else if (h < 0.47) t = TERRAIN.SAND;
        else if (h > 0.82) t = TERRAIN.ROCK;
        else if (w > 0.58) t = TERRAIN.MOSS;
        else t = TERRAIN.GRASS;

        this.tiles[i] = t;
        this.elev[i] = h < 0.47 ? 0 : h < 0.62 ? 1 : h < 0.78 ? 2 : 3;
        this.tint[i] = fbm(grove, x * 0.4, y * 0.4, 2) * 0.12 - 0.06;
      }
    }

    this.carveTrail(rng);
    this.plant(rng, grove);
  }

  /** Uma trilha de terra serpenteando pela floresta. */
  carveTrail(rng) {
    const { size } = this;
    let x = Math.floor(size * 0.2);
    let y = Math.floor(size * 0.5);
    for (let step = 0; step < size * 2; step++) {
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (Math.abs(ox) + Math.abs(oy) > 1) continue;
          const nx = x + ox;
          const ny = y + oy;
          if (!this.inBounds(nx, ny)) continue;
          const i = this.idx(nx, ny);
          if (this.tiles[i] !== TERRAIN.WATER) this.tiles[i] = TERRAIN.DIRT;
        }
      }
      x += rng() < 0.75 ? 1 : 0;
      y += rng() < 0.5 ? (rng() < 0.5 ? -1 : 1) : 0;
      if (!this.inBounds(x, y)) break;
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
        if (t === TERRAIN.WATER || t === TERRAIN.SAND || t === TERRAIN.DIRT) continue;

        const density = fbm(grove, x * 0.07, y * 0.07, 3);
        const roll = rng();

        let kind = null;
        if (t === TERRAIN.ROCK) {
          if (roll < 0.22) kind = 'rock';
          else if (roll < 0.28) kind = 'pine';
        } else if (roll < density * 0.52) {
          kind = rng() < 0.62 ? 'pine' : 'oak';
        } else if (roll < density * 0.52 + 0.07) {
          kind = 'bush';
        } else if (roll < density * 0.52 + 0.10) {
          kind = t === TERRAIN.MOSS ? 'fern' : 'flower';
        } else if (roll < density * 0.52 + 0.115) {
          kind = 'mushroom';
        }

        if (!kind) continue;
        this.props.push({
          kind,
          x: x + (rng() - 0.5) * 0.35,
          y: y + (rng() - 0.5) * 0.35,
        });
        if (kind === 'pine' || kind === 'oak' || kind === 'rock') {
          this.blocked.add(`${x},${y}`);
        }
      }
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
