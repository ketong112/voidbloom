// Seeded random numbers (mulberry32) so screenshot runs and play-tests are
// reproducible: the same seed always grows the same garden of enemies.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed = 1) { this.next = mulberry32(seed); }
  reseed(seed) { this.next = mulberry32(seed); }
  /** float in [0, 1) */
  f() { return this.next(); }
  /** float in [min, max) */
  range(min, max) { return min + (max - min) * this.next(); }
  /** integer in [min, max] */
  int(min, max) { return Math.floor(this.range(min, max + 1)); }
  /** true with probability p */
  chance(p) { return this.next() < p; }
  /** one element of an array */
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  /** angle in radians */
  angle() { return this.next() * Math.PI * 2; }
}

/** A point on the arena edge, just outside the view, for spawning. */
export function edgePoint(rng, w, h, margin = 30) {
  const side = rng.int(0, 3);
  if (side === 0) return { x: rng.range(0, w), y: -margin };
  if (side === 1) return { x: w + margin, y: rng.range(0, h) };
  if (side === 2) return { x: rng.range(0, w), y: h + margin };
  return { x: -margin, y: rng.range(0, h) };
}

export function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }
export function dist2(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}
export function lerp(a, b, t) { return a + (b - a) * t; }
