import { Renderer } from './render.js';
import { World } from './world.js';
import { populate } from './animals.js';
import { animalFrames } from './sprites.js';
import { toScreen } from './iso.js';
import { makeRng } from './rng.js';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);

const els = {
  clock: document.getElementById('clock'),
  count: document.getElementById('count'),
  sel: document.getElementById('sel'),
  card: document.getElementById('card'),
  cardName: document.getElementById('cardName'),
  cardState: document.getElementById('cardState'),
  cardEnergy: document.getElementById('cardEnergy'),
  portrait: document.getElementById('portrait'),
};

const cam = { x: 0, y: 0, zoom: 1.2 };
const time = { t: 0, hour: 7, speed: 1, night: 0 };

let world;
let animals;
let selected = null;
let cursorTile = null;

function newForest(seed = (Math.random() * 65535) | 0) {
  world = new World(46, seed);
  animals = populate(world, makeRng(seed ^ 0xabcd));
  selected = null;
  const center = toScreen(world.size / 2, world.size / 2);
  cam.x = center.x;
  cam.y = center.y;
  els.count.textContent = String(animals.length);
  els.card.hidden = true;
  els.sel.textContent = '—';
}

/* ---------------------------------------------------------------- */
/* Entrada                                                           */
/* ---------------------------------------------------------------- */

const keys = new Set();
let dragging = false;
let dragMoved = 0;
let last = { x: 0, y: 0 };

canvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  dragMoved = 0;
  last = { x: e.clientX, y: e.clientY };
  canvas.classList.add('dragging');
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  cursorTile = renderer.screenToGrid(e.clientX, e.clientY, cam);
  if (!dragging) return;
  const dx = e.clientX - last.x;
  const dy = e.clientY - last.y;
  dragMoved += Math.abs(dx) + Math.abs(dy);
  cam.x -= dx / cam.zoom;
  cam.y -= dy / cam.zoom;
  last = { x: e.clientX, y: e.clientY };
});

canvas.addEventListener('pointerup', (e) => {
  dragging = false;
  canvas.classList.remove('dragging');
  if (dragMoved < 6) selectAt(e.clientX, e.clientY);
});

canvas.addEventListener('pointerleave', () => {
  dragging = false;
  cursorTile = null;
  canvas.classList.remove('dragging');
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12);
}, { passive: false });

window.addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key === 'r' || e.key === 'R') newForest();
  if (e.key === 't' || e.key === 'T') time.speed = time.speed >= 8 ? 1 : time.speed * 2;
  if (e.key === '+' || e.key === '=') zoomBy(1.15);
  if (e.key === '-' || e.key === '_') zoomBy(1 / 1.15);
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('resize', () => renderer.resize());

function zoomBy(factor) {
  cam.zoom = Math.max(0.45, Math.min(3, cam.zoom * factor));
}

function selectAt(sx, sy) {
  const g = renderer.screenToGrid(sx, sy, cam);
  let best = null;
  let bestDist = 1.6;
  for (const a of animals) {
    const d = Math.hypot(a.x - g.x, a.y - g.y);
    if (d < bestDist) {
      bestDist = d;
      best = a;
    }
  }
  selected = best;
  els.card.hidden = !best;
  els.sel.textContent = best ? best.def.name : '—';
  if (best) drawPortrait(best);
}

function drawPortrait(animal) {
  const g = els.portrait.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, 96, 96);
  const img = animalFrames(animal.species).right[0];
  const scale = Math.min(88 / img.width, 88 / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  g.drawImage(img, (96 - w) / 2, (96 - h) / 2, w, h);
}

/* ---------------------------------------------------------------- */
/* Laço principal                                                    */
/* ---------------------------------------------------------------- */

function panFromKeys(dt) {
  const v = 420 / cam.zoom * dt;
  let dx = 0;
  let dy = 0;
  if (keys.has('w') || keys.has('arrowup')) dy -= 1;
  if (keys.has('s') || keys.has('arrowdown')) dy += 1;
  if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
  if (keys.has('d') || keys.has('arrowright')) dx += 1;
  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    cam.x += (dx / len) * v;
    cam.y += (dy / len) * v;
  }
}

/** 0 = pleno dia, 1 = madrugada fechada. */
function nightFactor(hour) {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 7 && h < 17) return 0;
  if (h >= 17 && h < 20) return (h - 17) / 3;
  if (h >= 20 || h < 4) return 1;
  return 1 - (h - 4) / 3;
}

let prev = performance.now();

function frame(now) {
  const dt = Math.min((now - prev) / 1000, 0.05);
  prev = now;

  time.t += dt;
  time.hour = (time.hour + dt * 0.12 * time.speed) % 24;
  time.night = nightFactor(time.hour);

  panFromKeys(dt);

  const threat = cursorTile;
  for (const a of animals) a.update(dt * time.speed, world, time.night, threat);

  renderer.draw(world, animals, cam, time, selected);

  const hh = String(Math.floor(time.hour)).padStart(2, '0');
  const mm = String(Math.floor((time.hour % 1) * 60)).padStart(2, '0');
  els.clock.textContent = `${hh}:${mm}${time.speed > 1 ? ` ×${time.speed}` : ''}`;

  if (selected) {
    els.cardName.textContent = selected.def.name;
    els.cardState.textContent = `${selected.label().split('— ')[1]} · período: ${selected.def.active} · dieta: ${selected.def.diet}`;
    els.cardEnergy.style.width = `${Math.round(selected.energy * 100)}%`;
  }

  requestAnimationFrame(frame);
}

newForest();
requestAnimationFrame(frame);
