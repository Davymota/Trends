import { TILE_W, TILE_H, toScreen, toGrid } from './iso.js';
import { TERRAIN, TERRAIN_COLORS, LEVEL_HEIGHT, BASE_DEPTH } from './world.js';
import { props as propArt, bridge, boat, shadow, cloud } from './sprites.js';
import { C } from './theme.js';

const ANIMAL_SCALE = 1.3; // animais são os personagens: ficam acima da escala do cenário

/** Lê '#rrggbb' ou 'rgb(r,g,b)' como [r, g, b]. */
function rgb(color) {
  if (color[0] === '#') {
    const n = parseInt(color.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  return color.match(/\d+/g).map(Number);
}

/** Mistura duas cores — usada na variação de tom de cada tile e parede. */
function mix(a, b, t) {
  const pa = rgb(a);
  const pb = rgb(b);
  const ch = (i) => Math.round(pa[i] * (1 - t) + pb[i] * t);
  return `rgb(${ch(0)},${ch(1)},${ch(2)})`;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    this.clouds = Array.from({ length: 7 }, (_, i) => ({
      x: (i * 271) % 1600,
      y: 60 + ((i * 137) % 380),
      s: 0.7 + ((i * 53) % 60) / 100,
      v: 4 + (i % 3) * 2,
    }));
    this.resize();
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(window.innerWidth * this.dpr);
    this.canvas.height = Math.floor(window.innerHeight * this.dpr);
  }

  /** Coordenada de tela (CSS px) -> tile do mundo. */
  screenToGrid(sx, sy, cam) {
    const px = (sx - window.innerWidth / 2) / cam.zoom + cam.x;
    const py = (sy - window.innerHeight / 2) / cam.zoom + cam.y;
    return toGrid(px, py);
  }

  draw(world, animals, cam, time, selected) {
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawClouds(time);

    ctx.translate(window.innerWidth / 2, window.innerHeight / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    const halfW = window.innerWidth / 2 / cam.zoom;
    const halfH = window.innerHeight / 2 / cam.zoom;
    const view = {
      left: cam.x - halfW - TILE_W,
      right: cam.x + halfW + TILE_W,
      top: cam.y - halfH - 160,
      bottom: cam.y + halfH + TILE_H * 2 + BASE_DEPTH,
    };

    this.drawTiles(world, view, time);
    this.drawEntities(world, animals, view, selected, time, cam);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.paintDusk(time.night);
  }

  drawClouds(time) {
    const { ctx } = this;
    const img = cloud();
    const w = window.innerWidth + 200;
    for (const c of this.clouds) {
      const x = ((c.x + time.t * c.v) % w) - 100;
      ctx.globalAlpha = 0.85;
      ctx.drawImage(img, x, c.y, img.logicalW * c.s, img.logicalH * c.s);
    }
    ctx.globalAlpha = 1;
  }

  /** Anoitecer discreto: um véu azulado por cima, sem escurecer demais. */
  paintDusk(night) {
    if (night <= 0.02) return;
    const { ctx } = this;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgba(150, 175, 215, ${0.42 * night})`;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }

  drawTiles(world, view, time) {
    const size = world.size;
    for (let sum = 0; sum <= (size - 1) * 2; sum++) {
      const rowY = (sum * TILE_H) / 2;
      if (rowY < view.top - 240 || rowY > view.bottom + 240) continue;
      for (let x = Math.max(0, sum - size + 1); x <= Math.min(size - 1, sum); x++) {
        const y = sum - x;
        const terrain = world.tiles[world.idx(x, y)];
        if (terrain === TERRAIN.VOID) continue;
        const p = toScreen(x, y);
        if (p.x < view.left - TILE_W || p.x > view.right + TILE_W) continue;
        this.drawTile(world, x, y, terrain, p, time);
      }
    }
  }

  drawTile(world, gx, gy, terrain, p, time) {
    const { ctx } = this;
    const i = world.idx(gx, gy);
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;
    const isWater = terrain === TERRAIN.WATER;

    const lift = world.elev[i] * LEVEL_HEIGHT;
    // A água não é deslocada verticalmente: qualquer folga abriria uma
    // fresta do fundo entre ela e a margem. A ondulação fica no tom.
    const py = p.y - lift;

    // Paredes do "bolo" da ilha, visíveis só na borda voltada para a câmera.
    const southVoid = !world.isLand(gx, gy + 1) && world.terrainAt(gx, gy + 1) !== TERRAIN.WATER;
    const eastVoid = !world.isLand(gx + 1, gy) && world.terrainAt(gx + 1, gy) !== TERRAIN.WATER;
    const lowerS = world.elevAt(gx, gy + 1) < world.elev[i];
    const lowerE = world.elevAt(gx + 1, gy) < world.elev[i];

    if (southVoid || eastVoid || lowerS || lowerE || isWater) {
      const drop = southVoid || eastVoid
        ? BASE_DEPTH + lift
        : Math.max(LEVEL_HEIGHT, lift - Math.min(world.elevAt(gx, gy + 1), world.elevAt(gx + 1, gy)) * LEVEL_HEIGHT);
      // Borda externa da ilha é penhasco cinza; degraus internos ficam
      // apenas um tom abaixo do próprio terreno, para não virar costura.
      let wallL;
      let wallR;
      if (southVoid || eastVoid) {
        wallL = isWater ? C.cliffWater : terrain === TERRAIN.SAND ? C.cliffSand : C.cliffL;
        wallR = isWater ? C.cliffWater : terrain === TERRAIN.SAND ? C.cliffSand : C.cliffR;
      } else {
        const [tl, td] = TERRAIN_COLORS[terrain];
        const surface = mix(tl, td, world.shade[i] * 0.7);
        wallL = mix(surface, '#2a3330', 0.22);
        wallR = mix(surface, '#2a3330', 0.36);
      }

      this.fillShape(wallL, () => {
        ctx.moveTo(p.x - hw, py);
        ctx.lineTo(p.x, py + hh);
        ctx.lineTo(p.x, py + hh + drop);
        ctx.lineTo(p.x - hw, py + drop);
      });
      this.fillShape(wallR, () => {
        ctx.moveTo(p.x + hw, py);
        ctx.lineTo(p.x, py + hh);
        ctx.lineTo(p.x, py + hh + drop);
        ctx.lineTo(p.x + hw, py + drop);
      });
    }

    const [light, dark] = TERRAIN_COLORS[terrain];
    // Ondulação da água: variação de tom, em vez de mover a geometria.
    const ripple = isWater ? (Math.sin(time.t * 1.1 + (gx + gy) * 0.5) + 1) * 0.16 : 0;
    this.fillShape(mix(light, dark, world.shade[i] * 0.7 + ripple), () => {
      ctx.moveTo(p.x, py - hh);
      ctx.lineTo(p.x + hw, py);
      ctx.lineTo(p.x, py + hh);
      ctx.lineTo(p.x - hw, py);
    });
  }

  /**
   * Preenche um polígono e o contorna com a mesma cor: o traço de 1px
   * cobre a fresta de antialiasing que apareceria entre tiles vizinhos.
   */
  fillShape(color, path) {
    const { ctx } = this;
    ctx.beginPath();
    path();
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  drawEntities(world, animals, view, selected, time, cam) {
    const { ctx } = this;
    const items = [];

    const push = (depth, obj) => {
      const p = toScreen(obj.x, obj.y);
      const lift = world.elevAt(Math.round(obj.x), Math.round(obj.y)) * LEVEL_HEIGHT;
      const py = p.y - lift;
      if (p.x < view.left - 100 || p.x > view.right + 100) return;
      if (py < view.top - 220 || py > view.bottom + 100) return;
      items.push({ depth, px: p.x, py, ...obj });
    };

    for (const prop of world.props) push(prop.x + prop.y, { ...prop, type: 'prop' });
    for (const d of world.decals) push(d.x + d.y + 0.4, { ...d, type: d.kind });
    for (const a of animals) push(a.x + a.y + 0.5, { x: a.x, y: a.y, type: 'animal', animal: a });

    items.sort((m, n) => m.depth - n.depth);

    const shadowImg = shadow();
    for (const item of items) {
      if (item.type === 'prop') this.drawProp(item, shadowImg);
      else if (item.type === 'bridge') this.drawSprite(bridge(), item.px, item.py + 16);
      else if (item.type === 'boat') {
        this.drawSprite(boat(), item.px, item.py + 12 + Math.sin(time.t * 1.3 + item.bob) * 1.5);
      } else this.drawAnimal(item, shadowImg, selected, time, cam);
    }
  }

  /** Blita um sprite com a âncora no pé central. */
  drawSprite(img, cx, footY, scale = 1) {
    const w = img.logicalW * scale;
    const h = img.logicalH * scale;
    this.ctx.drawImage(img, cx - w / 2, footY - h, w, h);
  }

  drawProp(item, shadowImg) {
    const img = propArt[item.kind]();
    const r = img.logicalW * 0.34;
    this.ctx.drawImage(shadowImg, item.px - r, item.py - r * 0.5, r * 2, r);
    this.drawSprite(img, item.px, item.py + 4);
  }

  drawAnimal(item, shadowImg, selected, time, cam) {
    const { ctx } = this;
    const a = item.animal;
    const img = a.sprite();
    const hover = a.hover;
    const bob = a.state === 'rest' ? 0 : Math.abs(Math.sin(a.bob)) * 1.2;
    const footY = item.py + 3 - hover - bob;

    ctx.drawImage(shadowImg, item.px - 15, item.py - 4.5, 30, 13);

    if (a === selected) {
      ctx.strokeStyle = C.ink;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(item.px, item.py + 2, 19 + Math.sin(time.t * 3) * 1.5, 9, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    this.drawSprite(img, item.px, footY, ANIMAL_SCALE);

    const top = footY - img.logicalH * ANIMAL_SCALE;
    // Rótulos em pílula, como na referência — somem quando a câmera afasta.
    const labelAlpha = a === selected ? 1 : Math.min(1, Math.max(0, (cam.zoom - 0.5) / 0.35)) * 0.9;
    if (labelAlpha > 0.03) this.drawPill(item.px, top - 6, a.def.name, labelAlpha);
    if (a.state === 'rest') this.drawSleep(item.px + img.logicalW * 0.45, top, time.t);
  }

  drawPill(cx, baseY, text, alpha) {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '600 9px ui-sans-serif, system-ui, -apple-system, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    const w = ctx.measureText(text).width + 14;
    const h = 14;
    ctx.fillStyle = C.label;
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, baseY - h, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = C.labelText;
    ctx.fillText(text, cx, baseY - h / 2 + 0.5);
    ctx.restore();
  }

  drawSleep(x, y, t) {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = 0.5 + Math.sin(t * 2) * 0.25;
    ctx.fillStyle = C.ink;
    ctx.font = '600 9px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('z', x, y - ((t * 6) % 12));
    ctx.restore();
  }
}
