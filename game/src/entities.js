// Entity factories and per-kind behaviour. Entities are plain objects; the
// Game in main.js owns the arrays and the collision step.
import { ENEMIES, PLAYER } from './config.js';
import { edgePoint } from './random.js';

export function makePlayer() {
  return {
    x: 640, y: 360, vx: 0, vy: 0,
    angle: -Math.PI / 2,
    radius: PLAYER.radius,
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    // Upgradeable stats (upgrades.js mutates these).
    speed: PLAYER.speed,
    fireInterval: PLAYER.fireInterval,
    bulletSpeed: PLAYER.bulletSpeed,
    bulletDamage: PLAYER.bulletDamage,
    shots: 1,
    pierce: 0,
    thorns: 0,
    pickupRadius: PLAYER.pickupRadius,
    nova: false,
    fireTimer: 0,
    invuln: 0,
    thornAngle: 0,
    novaTimer: 0,
    dead: false,
  };
}

export function makeBullet(x, y, angle, opts) {
  return {
    x, y, angle,
    vx: Math.cos(angle) * opts.speed,
    vy: Math.sin(angle) * opts.speed,
    radius: PLAYER.bulletRadius,
    damage: opts.damage,
    pierce: opts.pierce,
    life: 1.4,
    hitIds: new Set(),
  };
}

export function makeEnemy(kind, x, y, wave, rng) {
  const base = ENEMIES[kind];
  const hpBonus = Math.floor((wave - 1) * 0.35);
  const speedMul = 1 + (wave - 1) * 0.03;
  const e = {
    id: rng.int(1, 1e9),
    kind,
    x, y,
    vx: 0, vy: 0,
    radius: base.radius,
    hp: base.hp + hpBonus + (kind === 'warden' ? wave * 8 : 0),
    maxHp: base.hp + hpBonus + (kind === 'warden' ? wave * 8 : 0),
    speed: base.speed * speedMul,
    score: base.score,
    touch: base.touch,
    // Behaviour state.
    state: 'chase',
    stateT: rng.range(0, 1),
    shootT: rng.range(1.2, 2.4),
    angle: rng.angle(),
    flash: 0,
    spawnT: 0.35,      // grows in, cannot be hit yet
    wobble: rng.range(0, Math.PI * 2),
  };
  return e;
}

/** Spawn one enemy of a kind at the arena edge. */
export function spawnEnemy(kind, wave, rng, w, h) {
  const p = edgePoint(rng, w, h);
  return makeEnemy(kind, p.x, p.y, wave, rng);
}

export function makeParticle(x, y, opts = {}) {
  return {
    x, y,
    vx: opts.vx ?? 0, vy: opts.vy ?? 0,
    life: opts.life ?? 0.5,
    maxLife: opts.life ?? 0.5,
    size: opts.size ?? 3,
    color: opts.color ?? '#ffffff',
    drag: opts.drag ?? 0.9,
    grow: opts.grow ?? 0,
  };
}

export function burst(particles, x, y, color, count, speed, rng, size = 3) {
  for (let i = 0; i < count; i++) {
    const a = rng.angle();
    const s = rng.range(speed * 0.3, speed);
    particles.push(makeParticle(x, y, {
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: rng.range(0.3, 0.7), size: rng.range(size * 0.6, size * 1.4),
      color,
    }));
  }
}

export function makePickup(kind, x, y) {
  return {
    kind, x, y,
    vx: 0, vy: 0,
    radius: kind === 'heart' ? 11 : 8,
    life: 9,
    bob: Math.random() * Math.PI * 2,
  };
}

export function makeFloatText(x, y, text, color) {
  return { x, y, text, color, life: 0.9, maxLife: 0.9 };
}

/** Per-kind enemy steering. Returns nothing; mutates e. */
export function steerEnemy(e, player, dt, t) {
  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const nx = dx / d, ny = dy / d;

  if (e.kind === 'mote' || e.kind === 'splitter') {
    // Wobbly direct chase.
    const wob = Math.sin(t * 3 + e.wobble) * 0.35;
    const px = -ny * wob, py = nx * wob;
    e.vx = (nx + px) * e.speed;
    e.vy = (ny + py) * e.speed;
  } else if (e.kind === 'dasher') {
    e.stateT -= dt;
    if (e.state === 'chase') {
      e.vx = nx * e.speed; e.vy = ny * e.speed;
      if (e.stateT <= 0) { e.state = 'aim'; e.stateT = 0.55; e.vx = 0; e.vy = 0; }
    } else if (e.state === 'aim') {
      e.angle = Math.atan2(dy, dx);
      if (e.stateT <= 0) { e.state = 'dash'; e.stateT = 0.42; }
    } else {
      e.vx = Math.cos(e.angle) * 430;
      e.vy = Math.sin(e.angle) * 430;
      if (e.stateT <= 0) { e.state = 'chase'; e.stateT = 1.6; }
    }
  } else if (e.kind === 'spitter') {
    // Keep a ring around the player, strafe slowly.
    const want = 260;
    const radial = d < want ? -1 : 1;
    e.vx = nx * radial * e.speed * 0.8 + -ny * 30;
    e.vy = ny * radial * e.speed * 0.8 + nx * 30;
    e.shootT -= dt;
  } else if (e.kind === 'warden') {
    // Slow advance, never too close; its attacks are radial bursts.
    const want = 300;
    const radial = d < want ? -0.4 : 1;
    e.vx = nx * radial * e.speed;
    e.vy = ny * radial * e.speed;
    e.shootT -= dt;
  }
}
