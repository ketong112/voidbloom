// Wave director: what spawns, in what order, and when the Warden comes.
// A wave is a queue of { kind, at } entries; the Game pops them on a timer.
import { WAVES } from './config.js';

export function isBossWave(n) {
  return n % WAVES.bossEvery === 0;
}

/** Enemy kinds unlocked by this wave. */
export function unlockedKinds(n) {
  const kinds = ['mote'];
  if (n >= 2) kinds.push('dasher');
  if (n >= 3) kinds.push('splitter');
  if (n >= 4) kinds.push('spitter');
  return kinds;
}

/** Weighted pick from the unlocked kinds (later waves lean heavier). */
export function pickKind(n, rng) {
  const kinds = unlockedKinds(n);
  const weights = { mote: 10, dasher: 5 + n, splitter: 3 + n, spitter: 2 + n };
  let total = 0;
  for (const k of kinds) total += weights[k];
  let roll = rng.f() * total;
  for (const k of kinds) {
    roll -= weights[k];
    if (roll <= 0) return k;
  }
  return 'mote';
}

/** Build the spawn queue for wave n. */
export function buildWave(n, rng) {
  const count = WAVES.baseCount + (n - 1) * WAVES.perWave;
  const queue = [];
  for (let i = 0; i < count; i++) {
    queue.push({ kind: pickKind(n, rng), at: i * WAVES.spawnInterval });
  }
  if (isBossWave(n)) {
    // The Warden arrives fashionably late, after the first few minions.
    queue.push({ kind: 'warden', at: Math.min(6, count * 0.3) * WAVES.spawnInterval });
  }
  queue.sort((a, b) => a.at - b.at);
  return queue;
}

/** Banner text shown when a wave starts. */
export function waveTitle(n) {
  if (isBossWave(n)) return `WAVE ${n} — THE WARDEN WAKES`;
  return `WAVE ${n}`;
}
