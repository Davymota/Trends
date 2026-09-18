/** PRNG determinístico (mulberry32) para gerar florestas reproduzíveis. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ruído de valor suavizado, usado para relevo, umidade e clareiras. */
export function makeNoise(seed) {
  const rng = makeRng(seed);
  const perm = new Float32Array(256 * 256);
  for (let i = 0; i < perm.length; i++) perm[i] = rng();

  const at = (x, y) => perm[(((y & 255) << 8) | (x & 255)) >>> 0];
  const fade = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;

  return function noise(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const tx = fade(x - xi);
    const ty = fade(y - yi);
    return lerp(
      lerp(at(xi, yi), at(xi + 1, yi), tx),
      lerp(at(xi, yi + 1), at(xi + 1, yi + 1), tx),
      ty,
    );
  };
}

/** Soma de oitavas: detalhe fino sobre formas grandes. */
export function fbm(noise, x, y, octaves = 4) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x, y) * amp;
    norm += amp;
    amp *= 0.5;
    x *= 2;
    y *= 2;
  }
  return sum / norm;
}
