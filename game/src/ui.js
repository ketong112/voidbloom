// Screens and HUD, drawn on the same canvas as the game so every state
// reads in a screenshot: title, HUD, upgrade draft, pause, game over.
import { COLORS, VIEW } from './config.js';
import { buildSummary } from './upgrades.js';

function centerText(ctx, text, x, y, font, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function panel(ctx, x, y, w, h, alpha = 0.82) {
  ctx.save();
  ctx.fillStyle = `rgba(10, 6, 28, ${alpha})`;
  ctx.strokeStyle = 'rgba(94, 242, 224, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawHeart(ctx, x, y, size, filled) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 10, size / 10);
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.bezierCurveTo(-12, -2, -8, -11, 0, -4);
  ctx.bezierCurveTo(8, -11, 12, -2, 0, 8);
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = COLORS.heart;
    ctx.fill();
  } else {
    ctx.strokeStyle = 'rgba(255, 107, 129, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

/** Top bar: hearts, wave, score, combo. */
export function drawHUD(ctx, game) {
  const p = game.player;
  ctx.save();
  // Hearts.
  for (let i = 0; i < p.maxHp; i++) {
    drawHeart(ctx, 34 + i * 30, 32, 11, i < p.hp);
  }
  // Wave + enemies left.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 19px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText(`WAVE ${game.wave}`, 24, 66);
  ctx.font = '15px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillStyle = COLORS.dim;
  const left = game.enemies.length + game.spawnQueue.length;
  ctx.fillText(left > 0 ? `${left} blight left` : 'Wave cleared!', 24, 90);

  // Score, centred.
  ctx.textAlign = 'center';
  ctx.font = 'bold 30px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText(String(game.score).padStart(6, '0'), VIEW.w / 2, 34);
  if (game.combo > 1) {
    const pulse = 1 + Math.sin(game.time * 8) * 0.06;
    ctx.save();
    ctx.translate(VIEW.w / 2, 62);
    ctx.scale(pulse, pulse);
    ctx.font = 'bold 17px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillStyle = game.combo >= 5 ? COLORS.gold : COLORS.player;
    ctx.fillText(`COMBO x${game.combo}`, 0, 0);
    ctx.restore();
  }

  // Right side: kills + mute hint.
  ctx.textAlign = 'right';
  ctx.font = '15px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText(`KILLS ${game.kills}`, VIEW.w - 24, 30);
  ctx.fillText(game.audio.muted ? 'M — sound off' : 'M — mute · P — pause', VIEW.w - 24, 54);
  ctx.restore();
}

/** Big centre banner (wave start, boss warning), fading in/out. */
export function drawBanner(ctx, banner) {
  if (!banner) return;
  const a = banner.t < 0.25 ? banner.t / 0.25 : banner.t > banner.max - 0.6 ? (banner.max - banner.t) / 0.6 : 1;
  centerText(ctx, banner.text, VIEW.w / 2, 300, 'bold 44px "Trebuchet MS", Verdana, sans-serif',
    banner.color ?? COLORS.text, Math.max(0, a));
  if (banner.sub) {
    centerText(ctx, banner.sub, VIEW.w / 2, 340, '18px "Trebuchet MS", Verdana, sans-serif',
      COLORS.dim, Math.max(0, a));
  }
}

export function drawTitle(ctx, game, t) {
  ctx.save();
  ctx.fillStyle = 'rgba(7, 4, 18, 0.45)';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);

  const bob = Math.sin(t * 1.4) * 6;
  ctx.save();
  ctx.shadowColor = 'rgba(94, 242, 224, 0.8)';
  ctx.shadowBlur = 34;
  centerText(ctx, 'VOIDBLOOM', VIEW.w / 2, 210 + bob, 'bold 92px "Trebuchet MS", Verdana, sans-serif', COLORS.player);
  ctx.restore();
  centerText(ctx, 'a neon arena survival shooter', VIEW.w / 2, 268 + bob,
    'italic 22px "Trebuchet MS", Verdana, sans-serif', COLORS.dim);

  panel(ctx, VIEW.w / 2 - 330, 320, 660, 150);
  centerText(ctx, 'Defend the bloom. Survive the Blight.', VIEW.w / 2, 352,
    'bold 21px "Trebuchet MS", Verdana, sans-serif', COLORS.text);
  centerText(ctx, 'WASD / arrows — move      Mouse — aim      Hold click / Space — shoot', VIEW.w / 2, 388,
    '16px "Trebuchet MS", Verdana, sans-serif', COLORS.dim);
  centerText(ctx, 'Clear a wave, pick a bloom upgrade, face the Warden every 5th wave.', VIEW.w / 2, 416,
    '16px "Trebuchet MS", Verdana, sans-serif', COLORS.dim);
  centerText(ctx, 'P — pause      M — mute      R — restart', VIEW.w / 2, 444,
    '16px "Trebuchet MS", Verdana, sans-serif', COLORS.dim);

  const pulse = 0.65 + Math.sin(t * 3.2) * 0.35;
  centerText(ctx, 'CLICK OR PRESS ENTER TO PLAY', VIEW.w / 2, 530,
    'bold 24px "Trebuchet MS", Verdana, sans-serif', COLORS.gold, pulse);

  if (game.best > 0) {
    centerText(ctx, `Best score: ${game.best}`, VIEW.w / 2, 580,
      '17px "Trebuchet MS", Verdana, sans-serif', COLORS.dim);
  }
  ctx.restore();
}

/** Upgrade draft: three cards; hover follows the mouse. Returns card rects. */
export function drawDraft(ctx, game, cards) {
  ctx.save();
  ctx.fillStyle = 'rgba(7, 4, 18, 0.72)';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  centerText(ctx, `WAVE ${game.wave} CLEARED`, VIEW.w / 2, 130,
    'bold 40px "Trebuchet MS", Verdana, sans-serif', COLORS.gold);
  centerText(ctx, 'Choose a bloom — click a card or press 1, 2 or 3', VIEW.w / 2, 176,
    '18px "Trebuchet MS", Verdana, sans-serif', COLORS.dim);

  const w = 300, h = 210, gap = 36;
  const total = w * 3 + gap * 2;
  const x0 = (VIEW.w - total) / 2;
  const y0 = 240;
  const rects = [];
  for (let i = 0; i < cards.length; i++) {
    const x = x0 + i * (w + gap);
    const hover = game.input.mouse.x >= x && game.input.mouse.x <= x + w &&
      game.input.mouse.y >= y0 && game.input.mouse.y <= y0 + h;
    ctx.save();
    if (hover) {
      ctx.shadowColor = 'rgba(94, 242, 224, 0.9)';
      ctx.shadowBlur = 24;
    }
    ctx.fillStyle = hover ? 'rgba(24, 16, 52, 0.95)' : 'rgba(14, 9, 34, 0.92)';
    ctx.strokeStyle = hover ? COLORS.player : 'rgba(157, 148, 199, 0.5)';
    ctx.lineWidth = hover ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y0, w, h, 14);
    ctx.fill(); ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.player;
    ctx.font = 'bold 15px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillText(`[${i + 1}]`, x + w / 2, y0 + 34);
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 24px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillText(cards[i].name, x + w / 2, y0 + 74);
    ctx.fillStyle = COLORS.dim;
    ctx.font = '17px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillText(cards[i].desc, x + w / 2, y0 + 112);
    const owned = game.taken[cards[i].id] ?? 0;
    ctx.fillStyle = COLORS.gold;
    ctx.font = '15px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillText(owned > 0 ? `Owned x${owned}` : 'New bloom', x + w / 2, y0 + 168);
    ctx.restore();
    rects.push({ x, y: y0, w, h, i });
  }
  centerText(ctx, `Score ${game.score}  ·  Wave ${game.wave}  ·  Next: wave ${game.wave + 1}`,
    VIEW.w / 2, 500, '17px "Trebuchet MS", Verdana, sans-serif', COLORS.dim);
  ctx.restore();
  return rects;
}

export function drawPause(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(7, 4, 18, 0.6)';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  centerText(ctx, 'PAUSED', VIEW.w / 2, 320, 'bold 52px "Trebuchet MS", Verdana, sans-serif', COLORS.text);
  centerText(ctx, 'Press P or click to keep blooming', VIEW.w / 2, 372,
    '18px "Trebuchet MS", Verdana, sans-serif', COLORS.dim);
  ctx.restore();
}

export function drawGameOver(ctx, game) {
  ctx.save();
  ctx.fillStyle = 'rgba(7, 4, 18, 0.66)';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);

  centerText(ctx, 'THE BLOOM FADES', VIEW.w / 2, 180,
    'bold 56px "Trebuchet MS", Verdana, sans-serif', COLORS.mote);
  if (game.newBest) {
    centerText(ctx, '★ NEW BEST SCORE ★', VIEW.w / 2, 228,
      'bold 22px "Trebuchet MS", Verdana, sans-serif', COLORS.gold);
  }

  panel(ctx, VIEW.w / 2 - 260, 260, 520, 190);
  ctx.textAlign = 'left';
  ctx.font = 'bold 26px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText(`Score   ${game.score}`, VIEW.w / 2 - 220, 306);
  ctx.fillText(`Wave    ${game.wave}`, VIEW.w / 2 - 220, 346);
  ctx.fillText(`Kills   ${game.kills}`, VIEW.w / 2 - 220, 386);
  ctx.font = '17px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText(`Best    ${game.best}`, VIEW.w / 2 - 220, 424);

  centerText(ctx, buildSummary(game.player, game.taken), VIEW.w / 2, 490,
    '16px "Trebuchet MS", Verdana, sans-serif', COLORS.player);

  const pulse = 0.65 + Math.sin(game.time * 3.2) * 0.35;
  centerText(ctx, 'PRESS R OR CLICK TO BLOOM AGAIN', VIEW.w / 2, 548,
    'bold 22px "Trebuchet MS", Verdana, sans-serif', COLORS.gold, pulse);
  ctx.restore();
}
