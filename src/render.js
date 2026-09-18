import { TILE_W, TILE_H, toScreen, toGrid } from './iso.js';
import { TERRAIN, TERRAIN_COLORS, LEVEL_HEIGHT } from './world.js';
import { props as propArt, shadow } from './sprites.js';

/** Escurece/clareia uma cor hex por um fator. */
function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 255) * (1 + amount));
  const g = clamp(((n >> 8) & 255) * (1 + amount));
  const b = clamp((n & 255) * (1 + amount));
  return `rgb(${r},${g},${b})`;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.dpr = 1;
    this.resize();
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(window.innerWidth * this.dpr);
    this.canvas.height = Math.floor(window.innerHeight * this.dpr);
    this.ctx.imageSmoothingEnabled = false;
  }

  /** Coordenada de tela (CSS px) -> tile do mundo. */
  screenToGrid(sx, sy, cam) {
    const px = (sx - window.innerWidth / 2) / cam.zoom + cam.x;
    const py = (sy - window.innerHeight / 2) / cam.zoom + cam.y;
    return toGrid(px, py);
  }

  draw(world, animals, cam, time, selected) {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;

    const night = time.night;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.paintSky(ctx, w, h, night);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(window.innerWidth / 2, window.innerHeight / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    // Retângulo visível em pixels de mundo, com folga para sprites altos.
    const halfW = window.innerWidth / 2 / cam.zoom;
    const halfH = window.innerHeight / 2 / cam.zoom;
    const view = {
      left: cam.x - halfW - TILE_W,
      right: cam.x + halfW + TILE_W,
      top: cam.y - halfH - 140,
      bottom: cam.y + halfH + TILE_H * 2,
    };

    this.drawTiles(world, view, time);
    this.drawEntities(world, animals, view, selected, time);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.paintNight(ctx, w, h, night);
    this.paintVignette(ctx, w, h);
  }

  paintSky(ctx, w, h, night) {
    const day = ['#7fc6d8', '#bfe3d0'];
    const dusk = ['#2a3f5c', '#5b4468'];
    const dark = ['#0a1220', '#101c22'];
    const pick = (a, b, t) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, mix(a[0], b[0], t));
      grad.addColorStop(1, mix(a[1], b[1], t));
      return grad;
    };
    const grad = night < 0.5
      ? pick(day, dusk, night / 0.5)
      : pick(dusk, dark, (night - 0.5) / 0.5);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  paintNight(ctx, w, h, night) {
    if (night <= 0.02) return;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    const t = night;
    ctx.fillStyle = `rgba(${Math.round(90 - 60 * t)}, ${Math.round(120 - 70 * t)}, ${Math.round(190 - 60 * t)}, ${0.55 * t})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  paintVignette(ctx, w, h) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  drawTiles(world, view, time) {
    const { ctx } = this;
    const size = world.size;

    for (let sum = 0; sum <= (size - 1) * 2; sum++) {
      const yWorld = (sum * TILE_H) / 2;
      if (yWorld < view.top - 200 || yWorld > view.bottom + 200) continue;

      for (let x = Math.max(0, sum - size + 1); x <= Math.min(size - 1, sum); x++) {
        const y = sum - x;
        const p = toScreen(x, y);
        if (p.x < view.left - TILE_W || p.x > view.right + TILE_W) continue;

        const i = world.idx(x, y);
        const terrain = world.tiles[i];
        const lift = world.elev[i] * LEVEL_HEIGHT;
        this.drawTile(ctx, p.x, p.y - lift, terrain, world, x, y, lift, time);
      }
    }
  }

  drawTile(ctx, px, py, terrain, world, gx, gy, lift, time) {
    const [top, sideL, sideR] = TERRAIN_COLORS[terrain];
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;

    let surfaceY = py;
    if (terrain === TERRAIN.WATER) {
      // Ondulação suave só na água.
      surfaceY += Math.sin(time.t * 1.6 + (gx + gy) * 0.55) * 1.6;
    }

    // Faces laterais, dando volume ao degrau.
    const drop = lift + TILE_H;
    if (lift > 0 || terrain === TERRAIN.WATER) {
      ctx.fillStyle = sideL;
      ctx.beginPath();
      ctx.moveTo(px - hw, surfaceY);
      ctx.lineTo(px, surfaceY + hh);
      ctx.lineTo(px, surfaceY + hh + drop);
      ctx.lineTo(px - hw, surfaceY + drop);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = sideR;
      ctx.beginPath();
      ctx.moveTo(px + hw, surfaceY);
      ctx.lineTo(px, surfaceY + hh);
      ctx.lineTo(px, surfaceY + hh + drop);
      ctx.lineTo(px + hw, surfaceY + drop);
      ctx.closePath();
      ctx.fill();
    }

    // Topo do losango, com variação sutil de tom por tile.
    ctx.fillStyle = shade(top, world.tint[world.idx(gx, gy)]);
    ctx.beginPath();
    ctx.moveTo(px, surfaceY - hh);
    ctx.lineTo(px + hw, surfaceY);
    ctx.lineTo(px, surfaceY + hh);
    ctx.lineTo(px - hw, surfaceY);
    ctx.closePath();
    ctx.fill();

    if (terrain === TERRAIN.WATER) {
      const glint = (Math.sin(time.t * 2 + gx * 1.7 - gy * 0.9) + 1) / 2;
      if (glint > 0.85) {
        ctx.fillStyle = 'rgba(210, 240, 255, 0.35)';
        ctx.fillRect(px - 6, surfaceY - 1, 12, 2);
      }
    }
  }

  drawEntities(world, animals, view, selected, time) {
    const { ctx } = this;
    const items = [];

    for (const prop of world.props) {
      const p = toScreen(prop.x, prop.y);
      const lift = world.elevAt(Math.round(prop.x), Math.round(prop.y)) * LEVEL_HEIGHT;
      if (p.x < view.left - 80 || p.x > view.right + 80) continue;
      if (p.y - lift < view.top - 200 || p.y - lift > view.bottom + 80) continue;
      items.push({ depth: prop.x + prop.y, kind: 'prop', prop, px: p.x, py: p.y - lift });
    }

    for (const a of animals) {
      const p = toScreen(a.x, a.y);
      const lift = world.elevAt(Math.round(a.x), Math.round(a.y)) * LEVEL_HEIGHT;
      if (p.x < view.left - 80 || p.x > view.right + 80) continue;
      if (p.y - lift < view.top - 200 || p.y - lift > view.bottom + 80) continue;
      items.push({ depth: a.x + a.y + 0.001, kind: 'animal', animal: a, px: p.x, py: p.y - lift });
    }

    items.sort((m, n) => m.depth - n.depth);

    const shadowImg = shadow();
    for (const item of items) {
      if (item.kind === 'prop') {
        const img = propArt[item.prop.kind]();
        ctx.drawImage(shadowImg, item.px - img.width * 0.28, item.py - 6, img.width * 0.56, img.width * 0.28);
        ctx.drawImage(img, Math.round(item.px - img.width / 2), Math.round(item.py - img.height + 6));
      } else {
        const a = item.animal;
        const img = a.sprite();
        const hover = a.hover;
        ctx.globalAlpha = hover ? 0.5 : 1;
        ctx.drawImage(shadowImg, item.px - 18, item.py - 8, 36, 16);
        ctx.globalAlpha = 1;

        const bob = a.state === 'rest' ? 0 : Math.abs(Math.sin(a.bob)) * 1.5;
        const dy = item.py - img.height - hover - bob + 4;

        if (a === selected) {
          ctx.strokeStyle = 'rgba(216, 245, 120, 0.9)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(item.px, item.py - 2, 20 + Math.sin(time.t * 4) * 2, 10, 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.drawImage(img, Math.round(item.px - img.width / 2), Math.round(dy));

        if (a.state === 'rest') this.drawSleep(ctx, item.px + 10, dy - 4, time.t);
      }
    }
  }

  drawSleep(ctx, x, y, t) {
    ctx.save();
    ctx.globalAlpha = 0.55 + Math.sin(t * 2) * 0.25;
    ctx.fillStyle = '#e8f2e4';
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText('z', x, y - (t * 6) % 10);
    ctx.restore();
  }
}

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh) => Math.round((((pa >> sh) & 255) * (1 - t)) + (((pb >> sh) & 255) * t));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
