import { animalFrames } from './sprites.js';
import { TERRAIN } from './world.js';

export const SPECIES = {
  coelho: { name: 'Coelho', speed: 2.4, shy: 6.0, herd: 3, count: 10, active: 'dia', diet: 'ervas' },
  raposa: { name: 'Raposa', speed: 2.0, shy: 3.5, herd: 1, count: 4, active: 'crepúsculo', diet: 'caça' },
  veado: { name: 'Veado', speed: 1.7, shy: 7.5, herd: 4, count: 6, active: 'dia', diet: 'folhas' },
  javali: { name: 'Javali', speed: 1.4, shy: 2.5, herd: 2, count: 5, active: 'noite', diet: 'raízes' },
  coruja: { name: 'Coruja', speed: 2.8, shy: 5.0, herd: 1, count: 3, active: 'noite', diet: 'insetos' },
};

const STATE_LABEL = {
  wander: 'perambulando',
  rest: 'descansando',
  drink: 'bebendo água',
  forage: 'procurando comida',
  flee: 'fugindo!',
};

export class Animal {
  constructor(species, x, y, rng) {
    this.species = species;
    this.def = SPECIES[species];
    this.rng = rng;
    this.x = x;
    this.y = y;
    this.tx = x;
    this.ty = y;
    this.dir = 1; // 1 = direita, -1 = esquerda
    this.state = 'wander';
    this.timer = rng() * 3;
    this.frame = 0;
    this.frameTime = 0;
    this.bob = rng() * Math.PI * 2;
    this.energy = 0.5 + rng() * 0.5;
    this.frames = animalFrames(species);
  }

  get awake() {
    return this.state !== 'rest';
  }

  sprite() {
    const set = this.dir > 0 ? this.frames.right : this.frames.left;
    return set[this.frame % set.length];
  }

  /** Altura extra de voo — só a coruja plana acima do chão. */
  get hover() {
    if (this.species !== 'coruja') return 0;
    return 18 + Math.sin(this.bob) * 3;
  }

  pickTarget(world) {
    for (let i = 0; i < 24; i++) {
      const r = 3 + this.rng() * 7;
      const a = this.rng() * Math.PI * 2;
      const nx = this.x + Math.cos(a) * r;
      const ny = this.y + Math.sin(a) * r;
      if (world.isWalkable(nx, ny)) {
        this.tx = nx;
        this.ty = ny;
        return;
      }
    }
    this.tx = this.x;
    this.ty = this.y;
  }

  /** Procura uma margem de água por perto para beber. */
  seekWater(world) {
    for (let i = 0; i < 40; i++) {
      const a = this.rng() * Math.PI * 2;
      const r = 2 + this.rng() * 9;
      const nx = Math.round(this.x + Math.cos(a) * r);
      const ny = Math.round(this.y + Math.sin(a) * r);
      if (!world.isWalkable(nx, ny)) continue;
      const nearWater =
        world.terrainAt(nx + 1, ny) === TERRAIN.WATER ||
        world.terrainAt(nx - 1, ny) === TERRAIN.WATER ||
        world.terrainAt(nx, ny + 1) === TERRAIN.WATER ||
        world.terrainAt(nx, ny - 1) === TERRAIN.WATER;
      if (nearWater) {
        this.tx = nx;
        this.ty = ny;
        return true;
      }
    }
    return false;
  }

  /** `night` vai de 0 (meio-dia) a 1 (madrugada); `threat` é o cursor. */
  update(dt, world, night, threat) {
    this.bob += dt * 4;

    // Espécies noturnas dormem de dia e vice-versa.
    const nocturnal = this.def.active === 'noite';
    const wantsSleep = nocturnal ? night < 0.25 : night > 0.75;

    const dist = threat ? Math.hypot(threat.x - this.x, threat.y - this.y) : Infinity;
    if (dist < this.def.shy) {
      this.state = 'flee';
      const a = Math.atan2(this.y - threat.y, this.x - threat.x);
      const fx = this.x + Math.cos(a) * 4;
      const fy = this.y + Math.sin(a) * 4;
      if (world.isWalkable(fx, fy)) {
        this.tx = fx;
        this.ty = fy;
      }
      this.timer = 1.2;
    } else {
      this.timer -= dt;
      if (this.timer <= 0) {
        if (wantsSleep) {
          this.state = 'rest';
          this.timer = 3 + this.rng() * 4;
        } else if (this.energy < 0.35) {
          this.state = this.rng() < 0.5 && this.seekWater(world) ? 'drink' : 'forage';
          if (this.state === 'forage') this.pickTarget(world);
          this.timer = 3 + this.rng() * 3;
        } else {
          const roll = this.rng();
          this.state = roll < 0.18 ? 'rest' : roll < 0.32 ? 'forage' : 'wander';
          if (this.state !== 'rest') this.pickTarget(world);
          this.timer = 2 + this.rng() * 4;
        }
      }
    }

    if (this.state === 'rest') {
      this.energy = Math.min(1, this.energy + dt * 0.12);
      this.frame = 0;
      return;
    }
    if (this.state === 'drink' || this.state === 'forage') {
      this.energy = Math.min(1, this.energy + dt * 0.08);
    } else {
      this.energy = Math.max(0, this.energy - dt * 0.02);
    }

    const speed = this.def.speed * (this.state === 'flee' ? 2.1 : 1);
    let dx = this.tx - this.x;
    let dy = this.ty - this.y;
    const len = Math.hypot(dx, dy);

    if (len < 0.15) {
      this.frame = 0;
      return;
    }

    dx /= len;
    dy /= len;
    const nx = this.x + dx * speed * dt;
    const ny = this.y + dy * speed * dt;

    if (world.isWalkable(nx, ny)) {
      this.x = nx;
      this.y = ny;
    } else if (world.isWalkable(nx, this.y)) {
      this.x = nx;
    } else if (world.isWalkable(this.x, ny)) {
      this.y = ny;
    } else {
      this.pickTarget(world);
    }

    // Em projeção isométrica, "direita na tela" é x - y crescendo.
    const screenDx = dx - dy;
    if (Math.abs(screenDx) > 0.05) this.dir = screenDx > 0 ? 1 : -1;

    this.frameTime += dt * speed * 2.6;
    this.frame = Math.floor(this.frameTime) % 2;
  }

  label() {
    return `${this.def.name} — ${STATE_LABEL[this.state]}`;
  }
}

export function populate(world, rng) {
  const animals = [];
  for (const [species, def] of Object.entries(SPECIES)) {
    let placed = 0;
    let attempts = 0;
    while (placed < def.count && attempts < 500) {
      attempts++;
      const spot = world.randomWalkable(rng);
      // Alguns animais andam em grupo: nascem próximos uns dos outros.
      const groupSize = Math.min(def.herd, def.count - placed);
      for (let i = 0; i < groupSize; i++) {
        const x = spot.x + (rng() - 0.5) * 3;
        const y = spot.y + (rng() - 0.5) * 3;
        if (!world.isWalkable(x, y)) continue;
        animals.push(new Animal(species, x, y, rng));
        placed++;
      }
      if (groupSize === 0) break;
    }
  }
  return animals;
}
