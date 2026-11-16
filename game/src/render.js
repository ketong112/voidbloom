// All canvas drawing: the void garden, the bloomship, the Blight, and the
// feedback (particles, flashes, shockwaves). Nothing here touches game
// logic; the Game passes it the state to draw.
import { COLORS, VIEW } from './config.js';
import { mulberry32 } from './random.js';

/** Pre-rendered starfield so the background costs nothing per frame. */
export function makeStarfield(w, h, seed = 7) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const rng = mulberry32(seed);
  for (let i = 0; i < 190; i++) {
    const x = rng() * w, y = rng() * h;
    const r = rng() * 1.6 + 0.4;
    const a = 0.25 + rng() * 0.65;
    g.fillStyle = rng() < 0.12 ? `rgba(140, 240, 255, ${a})` : `rgba(240, 235, 255, ${a})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 14; i++) {
    const x = rng() * w, y = rng() * h;
    g.fillStyle = 'rgba(255, 255, 255, 0.9)';
    g.fillRect(x, y, 2, 2);
  }
  return c;
}

export function drawBackground(ctx, t, starfield) {
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW.h);
  grad.addColorStop(0, COLORS.bg1);
  grad.addColorStop(1, COLORS.bg0);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);

  // Two slow-drifting nebulae.
  const nx1 = 300 + Math.sin(t * 0.05) * 40;
  const ny1 = 180 + Math.cos(t * 0.04) * 25;
  let neb = ctx.createRadialGradient(nx1, ny1, 0, nx1, ny1, 420);
  neb.addColorStop(0, COLORS.nebulaA);
  neb.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = neb;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);

  const nx2 = 1020 + Math.cos(t * 0.06) * 35;
  const ny2 = 560 + Math.sin(t * 0.045) * 25;
  neb = ctx.createRadialGradient(nx2, ny2, 0, nx2, ny2, 380);
  neb.addColorStop(0, COLORS.nebulaB);
  neb.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = neb;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);

  ctx.drawImage(starfield, 0, 0);
}

function glowCircle(ctx, x, y, r, color, alpha = 0.5) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

/** The bloomship: six petals around a bright core, aimed at the mouse. */
export function drawPlayer(ctx, p, t) {
  const blink = p.invuln > 0 && Math.floor(t * 14) % 2 === 0;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (blink) ctx.globalAlpha = 0.35;

  glowCircle(ctx, 0, 0, p.radius * 1.6, COLORS.player, 0.45);

  // Petals.
  ctx.rotate(p.angle + Math.PI / 2);
  ctx.fillStyle = COLORS.player;
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.ellipse(0, -p.radius - 2, 5.5, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Hull.
  ctx.beginPath(); ctx.arc(0, 0, p.radius - 2, 0, Math.PI * 2);
  ctx.fillStyle = '#0e2a33'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = COLORS.player; ctx.stroke();
  // Core.
  ctx.beginPath(); ctx.arc(0, 0, 5.5 + Math.sin(t * 6) * 1.2, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.playerCore; ctx.fill();
  ctx.restore();

  // Orbiting thorns.
  if (p.thorns > 0) {
    ctx.save();
    ctx.translate(p.x, p.y);
    for (let i = 0; i < p.thorns; i++) {
      const a = p.thornAngle + (i * Math.PI * 2) / p.thorns;
      const tx = Math.cos(a) * (p.radius + 20);
      const ty = Math.sin(a) * (p.radius + 20);
      ctx.fillStyle = COLORS.gold;
      ctx.beginPath();
      ctx.moveTo(tx, ty - 7); ctx.lineTo(tx + 5, ty + 5); ctx.lineTo(tx - 5, ty + 5);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  // Aim tick.
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.strokeStyle = 'rgba(94, 242, 224, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(p.radius + 6, 0); ctx.lineTo(p.radius + 16, 0); ctx.stroke();
  ctx.restore();
}

function drawSpiky(ctx, x, y, r, spikes, color, t, wobble) {
  ctx.save();
  ctx.translate(x, y);
  glowCircle(ctx, 0, 0, r, color, 0.35);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 + t * 0.6;
    const rr = i % 2 === 0 ? r : r * (0.62 + wobble * 0.1);
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(7, 4, 18, 0.85)'; ctx.fill();
  ctx.restore();
}

export function drawEnemy(ctx, e, t) {
  const grow = e.spawnT > 0 ? 1 - e.spawnT / 0.35 : 1;
  const flash = e.flash > 0;
  ctx.save();
  ctx.globalAlpha = 0.35 + 0.65 * grow;
  const scale = 0.4 + 0.6 * grow;
  ctx.translate(e.x, e.y);
  ctx.scale(scale, scale);

  if (e.kind === 'mote') {
    drawSpiky(ctx, 0, 0, e.radius, 8, flash ? '#ffffff' : COLORS.mote, t, e.wobble);
  } else if (e.kind === 'dasher') {
    glowCircle(ctx, 0, 0, e.radius, COLORS.dasher, e.state === 'aim' ? 0.8 : 0.35);
    ctx.rotate(e.state === 'aim' ? e.angle : t * 1.5);
    ctx.fillStyle = flash ? '#ffffff' : COLORS.dasher;
    ctx.beginPath();
    ctx.moveTo(e.radius + 6, 0); ctx.lineTo(0, e.radius); ctx.lineTo(-e.radius - 4, 0); ctx.lineTo(0, -e.radius);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#1a0b02'; ctx.fill();
  } else if (e.kind === 'spitter') {
    glowCircle(ctx, 0, 0, e.radius, COLORS.spitter, 0.35);
    ctx.fillStyle = flash ? '#ffffff' : COLORS.spitter;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + t * 0.8;
      const px = Math.cos(a) * e.radius, py = Math.sin(a) * e.radius;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, e.radius * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = '#160a2e'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 3.5 + Math.sin(t * 5) * 1, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill();
  } else if (e.kind === 'splitter') {
    drawSpiky(ctx, 0, 0, e.radius, 6, flash ? '#ffffff' : COLORS.splitter, t * 0.7, e.wobble);
    ctx.beginPath(); ctx.arc(0, 0, e.radius * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd166'; ctx.fill();
  } else if (e.kind === 'warden') {
    glowCircle(ctx, 0, 0, e.radius * 1.4, COLORS.warden, 0.5);
    ctx.rotate(t * 0.4);
    ctx.fillStyle = flash ? '#ffffff' : COLORS.warden;
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.ellipse(0, -e.radius - 4, 9, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath(); ctx.arc(0, 0, e.radius - 4, 0, Math.PI * 2);
    ctx.fillStyle = '#2a0a4a'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = COLORS.warden; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 12 + Math.sin(t * 4) * 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill();
  }
  ctx.restore();

  // Warden health bar.
  if (e.kind === 'warden' && e.hp < e.maxHp) {
    const w = 90;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 18, w, 7);
    ctx.fillStyle = COLORS.warden;
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 18, w * Math.max(0, e.hp / e.maxHp), 7);
  }
  // Small hp pips for tough enemies.
  if (e.kind !== 'warden' && e.kind !== 'mote' && e.maxHp > 1 && e.hp < e.maxHp) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const w = e.radius * 1.4;
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 9, w * (e.hp / e.maxHp), 3);
  }
}

export function drawBullets(ctx, bullets) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const b of bullets) {
    glowCircle(ctx, b.x, b.y, b.radius * 1.4, COLORS.bullet, 0.55);
    ctx.fillStyle = COLORS.bullet;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff7dd';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * 0.45, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function drawEnemyBullets(ctx, bullets) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const b of bullets) {
    glowCircle(ctx, b.x, b.y, b.radius * 1.6, '#ff7ad9', 0.5);
    ctx.fillStyle = '#ff7ad9';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function drawParticles(ctx, particles) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function drawPickups(ctx, pickups, t) {
  for (const p of pickups) {
    const bob = Math.sin(t * 4 + p.bob) * 3;
    const y = p.y + bob;
    ctx.save();
    if (p.kind === 'pollen') {
      glowCircle(ctx, p.x, y, 10, COLORS.pollen, 0.5);
      ctx.fillStyle = COLORS.pollen;
      ctx.beginPath(); ctx.arc(p.x, y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#eaffd0';
      ctx.beginPath(); ctx.arc(p.x, y, 2.5, 0, Math.PI * 2); ctx.fill();
    } else {
      glowCircle(ctx, p.x, y, 13, COLORS.heart, 0.55);
      ctx.fillStyle = COLORS.heart;
      ctx.beginPath();
      ctx.moveTo(p.x, y + 8);
      ctx.bezierCurveTo(p.x - 12, y - 2, p.x - 8, y - 11, p.x, y - 4);
      ctx.bezierCurveTo(p.x + 8, y - 11, p.x + 12, y - 2, p.x, y + 8);
      ctx.fill();
    }
    ctx.restore();
  }
}

export function drawFloatTexts(ctx, texts) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 15px "Trebuchet MS", Verdana, sans-serif';
  for (const f of texts) {
    ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.restore();
}

export function drawNova(ctx, nova) {
  if (!nova) return;
  const a = 1 - nova.t / nova.max;
  ctx.save();
  ctx.globalAlpha = a * 0.8;
  ctx.strokeStyle = COLORS.player;
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(nova.x, nova.y, nova.r, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = a * 0.25;
  ctx.fillStyle = COLORS.player;
  ctx.beginPath(); ctx.arc(nova.x, nova.y, nova.r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
