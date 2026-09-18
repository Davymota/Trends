// Projeção isométrica 2:1 (losangos de 64x32 px).
export const TILE_W = 64;
export const TILE_H = 32;

/** Coordenada de grade (x, y) -> ponto no "mundo" em pixels (centro do losango). */
export function toScreen(x, y) {
  return {
    x: (x - y) * (TILE_W / 2),
    y: (x + y) * (TILE_H / 2),
  };
}

/** Ponto em pixels -> coordenada de grade fracionária. */
export function toGrid(px, py) {
  const a = px / (TILE_W / 2);
  const b = py / (TILE_H / 2);
  return { x: (b + a) / 2, y: (b - a) / 2 };
}

/** Ordem de desenho: quem está mais "à frente" no losango é pintado depois. */
export function depth(x, y, z = 0) {
  return (x + y) * 1000 + z;
}
