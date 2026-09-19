// Extrai o contorno de uma região da grade e o arredonda.
// É o que tira o serrilhado de "escadinha": em vez de desenhar losango por
// losango, desenhamos uma única silhueta suavizada por região.

/**
 * Percorre a fronteira da máscara e devolve os laços fechados, em
 * coordenadas de grade (os vértices caem nos cantos dos tiles).
 */
export function traceLoops(size, inside) {
  // Um mesmo ponto pode ser início de duas arestas quando duas partes da
  // região se tocam na diagonal, então cada chave guarda uma lista.
  const outgoing = new Map();
  const key = (x, y) => `${x},${y}`;

  const add = (x1, y1, x2, y2) => {
    const k = key(x1, y1);
    const list = outgoing.get(k);
    if (list) list.push([x2, y2]);
    else outgoing.set(k, [[x2, y2]]);
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!inside(x, y)) continue;
      const l = x - 0.5;
      const r = x + 0.5;
      const t = y - 0.5;
      const b = y + 0.5;
      // Cada aresta é emitida no sentido horário, para os laços fecharem.
      if (!inside(x, y - 1)) add(l, t, r, t);
      if (!inside(x + 1, y)) add(r, t, r, b);
      if (!inside(x, y + 1)) add(r, b, l, b);
      if (!inside(x - 1, y)) add(l, b, l, t);
    }
  }

  /**
   * No cruzamento em diagonal, seguir sempre pela curva mais à direita
   * mantém cada braço da região como um laço próprio — sem isso alguma
   * aresta some e o contorno corta reto pelo meio da mancha.
   */
  const pickNext = (list, dx, dy, px, py) => {
    if (list.length === 1) return 0;
    let best = 0;
    let bestRank = 9;
    list.forEach(([nx, ny], i) => {
      const cx = nx - px;
      const cy = ny - py;
      const cross = dx * cy - dy * cx;
      const dot = dx * cx + dy * cy;
      const rank = cross > 0 ? 0 : dot > 0 ? 1 : cross < 0 ? 2 : 3;
      if (rank < bestRank) {
        bestRank = rank;
        best = i;
      }
    });
    return best;
  };

  const loops = [];
  let remaining = 0;
  for (const list of outgoing.values()) remaining += list.length;

  while (remaining > 0) {
    let startKey = null;
    for (const [k, list] of outgoing) {
      if (list.length) {
        startKey = k;
        break;
      }
    }
    if (startKey === null) break;

    const loop = [];
    let [px, py] = startKey.split(',').map(Number);
    let dx = 0;
    let dy = 0;

    for (;;) {
      const list = outgoing.get(key(px, py));
      if (!list || !list.length) break;
      const i = pickNext(list, dx, dy, px, py);
      const [nx, ny] = list.splice(i, 1)[0];
      remaining--;
      loop.push([px, py]);
      dx = nx - px;
      dy = ny - py;
      px = nx;
      py = ny;
    }
    if (loop.length >= 4) loops.push(loop);
  }
  return loops;
}

/**
 * Chaikin: a cada passo, corta os cantos do polígono. Três passos já
 * transformam a escadinha da grade em uma curva contínua.
 */
export function smooth(loop, steps = 3) {
  let pts = loop;
  for (let s = 0; s < steps; s++) {
    const next = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[(i + 1) % pts.length];
      next.push([ax + (bx - ax) * 0.25, ay + (by - ay) * 0.25]);
      next.push([ax + (bx - ax) * 0.75, ay + (by - ay) * 0.75]);
    }
    pts = next;
  }
  return pts;
}

/** Contornos suavizados de uma máscara, prontos para projetar. */
export function regionOutlines(size, inside, steps = 3) {
  return traceLoops(size, inside).map((loop) => smooth(loop, steps));
}
