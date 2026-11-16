// VOIDBLOOM tuning: every number the game balances on lives here, so a
// play-test can retune the feel without touching the logic files.
export const VIEW = { w: 1280, h: 720 };

export const PLAYER = {
  radius: 14,
  speed: 305,            // px per second
  maxHp: 3,
  fireInterval: 0.19,   // seconds between shots
  bulletSpeed: 640,
  bulletDamage: 1,
  bulletRadius: 5,
  invulnTime: 1.4,       // seconds of mercy after a hit
  pickupRadius: 70,
};

export const COMBO = {
  window: 2.5,           // seconds a kill chain stays alive
  step: 1,               // multiplier grows by 1 per chained kill
  max: 8,
};

export const ENEMIES = {
  mote:     { radius: 11, hp: 1,  speed: 88,  score: 50,  touch: 1 },
  dasher:   { radius: 13, hp: 2,  speed: 72,  score: 100, touch: 1 },
  spitter:  { radius: 15, hp: 3,  speed: 58,  score: 150, touch: 1 },
  splitter: { radius: 18, hp: 3,  speed: 54,  score: 150, touch: 1 },
  warden:   { radius: 46, hp: 60, speed: 46,  score: 2000, touch: 2 },
};

export const WAVES = {
  baseCount: 5,          // enemies in wave 1
  perWave: 3,            // extra enemies each later wave
  spawnInterval: 0.6,    // seconds between spawns
  intermission: 1.6,     // seconds of calm before a wave starts
  bossEvery: 5,          // a Warden appears on these waves
  hpPerWave: 0.35,       // enemy hp grows ~35% per wave (rounded, min +0)
  speedPerWave: 0.03,    // enemy speed grows 3% per wave
};

export const PICKUPS = {
  pollenScore: 25,
  heartDropChance: 0.08, // chance a splitter/spitter/warden drops a heart
  pollenDropChance: 0.55,
  heartHeal: 1,
  life: 9,               // seconds a pickup stays on the field
};

export const NOVA = {
  interval: 12,          // seconds between nova bursts (when owned)
  radius: 240,
  damage: 3,
};

// Upgrade draft pool. Each entry: id, name, short description, and the
// maximum times it can be taken. apply() mutates the player stats object.
export const UPGRADES = [
  { id: 'rapid',   name: 'Rapid Petals',   desc: '+25% fire rate',                 max: 5,
    apply: (s) => { s.fireInterval *= 0.8; } },
  { id: 'twin',    name: 'Twin Bloom',     desc: '+1 bullet per shot',             max: 3,
    apply: (s) => { s.shots += 1; } },
  { id: 'thorn',   name: 'Thorn Shield',   desc: '+1 orbiting thorn',              max: 3,
    apply: (s) => { s.thorns += 1; } },
  { id: 'swift',   name: 'Swift Roots',    desc: '+15% move speed',                max: 4,
    apply: (s) => { s.speed *= 1.15; } },
  { id: 'magnet',  name: 'Magnet Pollen',  desc: '+70% pickup radius',             max: 3,
    apply: (s) => { s.pickupRadius *= 1.7; } },
  { id: 'heart',   name: 'Heart Seed',     desc: '+1 max heart, heal 1',           max: 4,
    apply: (s) => { s.maxHp += 1; s.hp = Math.min(s.maxHp, s.hp + 1); } },
  { id: 'pierce',  name: 'Piercing Thorns', desc: 'Bullets pierce +1 enemy',       max: 3,
    apply: (s) => { s.pierce += 1; } },
  { id: 'nova',    name: 'Nova Burst',     desc: 'Shockwave every 12s',            max: 1,
    apply: (s) => { s.nova = true; } },
];

export const COLORS = {
  bg0: '#070412',
  bg1: '#0d0724',
  nebulaA: 'rgba(88, 40, 180, 0.20)',
  nebulaB: 'rgba(16, 120, 140, 0.16)',
  player: '#5ef2e0',
  playerCore: '#eafffb',
  bullet: '#ffd76a',
  mote: '#ff5fa2',
  dasher: '#ff8a3d',
  spitter: '#c77dff',
  splitter: '#ff4d6d',
  warden: '#e0aaff',
  pollen: '#b8ff7a',
  heart: '#ff6b81',
  text: '#f2ecff',
  dim: '#9d94c7',
  gold: '#ffd76a',
};
