// VOIDBLOOM — the game itself: state machine, loop, collisions, scoring,
// waves, upgrades, and the deterministic ?shot= states used for screenshots.
import { VIEW, PLAYER, COMBO, WAVES, PICKUPS, NOVA, COLORS } from './config.js';
import { Rng, clamp, dist2, edgePoint } from './random.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import {
  makePlayer, makeBullet, makeEnemy, spawnEnemy, makeParticle, burst,
  makePickup, makeFloatText, steerEnemy,
} from './entities.js';
import { buildWave, isBossWave, waveTitle } from './waves.js';
import { draftUpgrades, applyUpgrade } from './upgrades.js';
import {
  makeStarfield, drawBackground, drawPlayer, drawEnemy, drawBullets,
  drawEnemyBullets, drawParticles, drawPickups, drawFloatTexts, drawNova,
} from './render.js';
import { drawHUD, drawBanner, drawTitle, drawDraft, drawPause, drawGameOver } from './ui.js';

const BEST_KEY = 'voidbloom-best';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input(canvas);
    this.audio = new AudioSys();
    this.rng = new Rng(1);
    this.starfield = makeStarfield(VIEW.w, VIEW.h, 7);
    this.time = 0;
    this.timeScale = 1;
    this.shake = 0;
    this.state = 'title';
    this.frozen = false;       // ?shot= states freeze the sim for a clean frame
    this.autopilot = null;     // 'play' | 'suicide' | null (screenshot driver)
    this.best = 0;
    try { this.best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch { /* no storage */ }
    this.newBest = false;
    this.resetRun();
    this.shot = new URLSearchParams(window.location.search).get('shot');
    this.seed = Number(new URLSearchParams(window.location.search).get('seed') || 1);
  }

  resetRun() {
    this.player = makePlayer();
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.particles = [];
    this.pickups = [];
    this.texts = [];
    this.novaFx = null;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.wave = 0;
    this.score = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.taken = {};
    this.draft = [];
    this.draftRects = [];
    this.banner = null;
    this.waveClearTimer = 0;
    this.bossWarned = false;
    this.slowmoTimer = 0;
    this.deathTimer = 0;
  }

  // ---------- flow ----------

  startGame() {
    this.resetRun();
    this.state = 'playing';
    this.startWave(1);
    this.audio.ensure();
    this.audio.uiClick();
  }

  startWave(n) {
    this.wave = n;
    this.spawnQueue = buildWave(n, this.rng);
    this.spawnTimer = -1.0;   // a breath before the first Blight arrives
    this.bossWarned = false;
    this.setBanner(waveTitle(n), isBossWave(n) ? 'The Warden wakes — keep moving' : null, 2.2);
    if (isBossWave(n)) this.audio.bossWarn();
  }

  setBanner(text, sub, max = 2.2) {
    this.banner = { text, sub, t: 0, max, color: COLORS.text };
  }

  waveCleared() {
    const bonus = 250 + this.wave * 100;
    this.score += bonus;
    this.texts.push(makeFloatText(VIEW.w / 2, 240, `WAVE BONUS +${bonus}`, COLORS.gold));
    this.audio.waveClear();
    this.waveClearTimer = 1.1;
    this.state = 'intermission';
  }

  openDraft() {
    this.draft = draftUpgrades(this.player, this.taken, this.rng);
    this.state = 'draft';
  }

  pickUpgrade(i) {
    const up = this.draft[i];
    if (!up) return;
    applyUpgrade(this.player, this.taken, up);
    this.audio.upgrade();
    burst(this.particles, this.player.x, this.player.y, COLORS.player, 26, 260, this.rng, 4);
    this.draft = [];
    this.startWave(this.wave + 1);
    this.state = 'playing';
  }

  gameOver() {
    this.state = 'gameover';
    this.audio.gameOver();
    if (this.score > this.best) {
      this.best = this.score;
      this.newBest = true;
      try { localStorage.setItem(BEST_KEY, String(this.best)); } catch { /* no storage */ }
    }
  }

  hurtPlayer(dmg) {
    const p = this.player;
    if (p.invuln > 0 || p.dead) return;
    p.hp -= dmg;
    p.invuln = PLAYER.invulnTime;
    this.shake = Math.max(this.shake, 10);
    this.audio.hurt();
    burst(this.particles, p.x, p.y, COLORS.heart, 18, 220, this.rng, 4);
    if (p.hp <= 0) {
      p.dead = true;
      this.slowmoTimer = 0.9;
      this.deathTimer = 0.9;
      this.timeScale = 0.25;
      this.audio.explode(true);
      burst(this.particles, p.x, p.y, COLORS.player, 70, 380, this.rng, 5);
      burst(this.particles, p.x, p.y, COLORS.gold, 30, 260, this.rng, 4);
      this.shake = 18;
    }
  }

  killEnemy(e, award = true) {
    const idx = this.enemies.indexOf(e);
    if (idx === -1) return;
    this.enemies.splice(idx, 1);
    this.kills += 1;
    this.comboTimer = COMBO.window;
    this.combo = Math.min(COMBO.max, this.combo + COMBO.step);
    if (award) {
      const pts = e.score * this.combo;
      this.score += pts;
      this.texts.push(makeFloatText(e.x, e.y - 14, `+${pts}`, this.combo >= 4 ? COLORS.gold : COLORS.text));
    }
    this.audio.explode(e.kind === 'warden');
    burst(this.particles, e.x, e.y, enemyColor(e.kind), e.kind === 'warden' ? 60 : 22,
      e.kind === 'warden' ? 380 : 240, this.rng, 4);
    this.shake = Math.max(this.shake, e.kind === 'warden' ? 14 : 4);

    if (e.kind === 'splitter') {
      for (let i = 0; i < 2; i++) {
        const m = makeEnemy('mote', e.x + this.rng.range(-14, 14), e.y + this.rng.range(-14, 14), this.wave, this.rng);
        m.spawnT = 0.15;
        this.enemies.push(m);
      }
    }
    // Drops.
    if (e.kind === 'warden' || this.rng.chance(PICKUPS.heartDropChance)) {
      this.pickups.push(makePickup('heart', e.x, e.y));
    } else if (this.rng.chance(PICKUPS.pollenDropChance)) {
      this.pickups.push(makePickup('pollen', e.x, e.y));
    }
    if (e.kind === 'warden') {
      this.setBanner('THE WARDEN FALLS', `+${e.score * this.combo} — the garden breathes`, 2.4);
    }
  }

  // ---------- update ----------

  update(dt) {
    this.time += dt;
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t >= this.banner.max) this.banner = null;
    }
    this.shake = Math.max(0, this.shake - dt * 26);
    if (this.slowmoTimer > 0) {
      this.slowmoTimer -= dt;
      if (this.slowmoTimer <= 0) this.timeScale = 1;
    }

    // Particles and floating text always animate.
    for (const pt of this.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      pt.vx *= Math.pow(pt.drag, dt * 60); pt.vy *= Math.pow(pt.drag, dt * 60);
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.texts) { f.life -= dt; f.y -= 34 * dt; }
    this.texts = this.texts.filter((f) => f.life > 0);
    if (this.novaFx) {
      this.novaFx.t += dt;
      this.novaFx.r = (this.novaFx.t / this.novaFx.max) * NOVA.radius;
      if (this.novaFx.t >= this.novaFx.max) this.novaFx = null;
    }

    if (this.state === 'intermission') {
      this.waveClearTimer -= dt;
      if (this.waveClearTimer <= 0) this.openDraft();
      return;
    }
    if (this.state !== 'playing') return;

    const p = this.player;
    if (p.dead) {
      // Death cinematic: the slow-mo plays out, then the game-over screen.
      if (this.deathTimer > 0) {
        this.deathTimer -= dt;
        if (this.deathTimer <= 0) this.gameOver();
      }
      return;
    }

    // Combo decay.
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    // --- input / autopilot ---
    let move = { x: 0, y: 0 };
    let aimX = this.input.mouse.x, aimY = this.input.mouse.y;
    let firing = this.input.firing;
    if (this.autopilot) {
      const ap = this.autopilotDrive();
      move = ap.move; aimX = ap.aimX; aimY = ap.aimY; firing = ap.firing;
    }
    p.vx = move.x * p.speed;
    p.vy = move.y * p.speed;
    p.x = clamp(p.x + p.vx * dt, p.radius, VIEW.w - p.radius);
    p.y = clamp(p.y + p.vy * dt, p.radius, VIEW.h - p.radius);
    p.angle = Math.atan2(aimY - p.y, aimX - p.x);
    p.invuln = Math.max(0, p.invuln - dt);
    p.thornAngle += dt * 3.2;

    // --- firing ---
    p.fireTimer -= dt;
    if (firing && p.fireTimer <= 0) {
      p.fireTimer = p.fireInterval;
      const spread = 0.09;
      for (let i = 0; i < p.shots; i++) {
        const off = (i - (p.shots - 1) / 2) * spread;
        const bx = p.x + Math.cos(p.angle) * (p.radius + 8);
        const by = p.y + Math.sin(p.angle) * (p.radius + 8);
        this.bullets.push(makeBullet(bx, by, p.angle + off, {
          speed: p.bulletSpeed, damage: p.bulletDamage, pierce: p.pierce,
        }));
      }
      this.audio.shoot();
      burst(this.particles, p.x + Math.cos(p.angle) * (p.radius + 10),
        p.y + Math.sin(p.angle) * (p.radius + 10), COLORS.bullet, 2, 60, this.rng, 2);
    }

    // --- nova burst ---
    if (p.nova) {
      p.novaTimer -= dt;
      if (p.novaTimer <= 0) {
        p.novaTimer = NOVA.interval;
        this.novaFx = { x: p.x, y: p.y, r: 0, t: 0, max: 0.45 };
        this.audio.nova();
        for (const e of [...this.enemies]) {
          if (dist2(e.x, e.y, p.x, p.y) < NOVA.radius * NOVA.radius) {
            this.damageEnemy(e, NOVA.damage);
          }
        }
      }
    }

    // --- spawning ---
    if (this.spawnQueue.length > 0) {
      this.spawnTimer += dt;
      while (this.spawnQueue.length > 0 && this.spawnQueue[0].at <= this.spawnTimer) {
        const s = this.spawnQueue.shift();
        const e = spawnEnemy(s.kind, this.wave, this.rng, VIEW.w, VIEW.h);
        this.enemies.push(e);
        if (s.kind === 'warden') this.setBanner('THE WARDEN WAKES', 'Break its bloom before it breaks yours', 2.4);
      }
    } else if (this.enemies.length === 0 && !p.dead) {
      this.waveCleared();
    }

    // --- enemies ---
    for (const e of this.enemies) {
      if (e.spawnT > 0) { e.spawnT -= dt; continue; }
      e.flash = Math.max(0, e.flash - dt);
      steerEnemy(e, p, dt, this.time);
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.x = clamp(e.x, -60, VIEW.w + 60);
      e.y = clamp(e.y, -60, VIEW.h + 60);
      // Spitter / warden ranged attacks.
      if ((e.kind === 'spitter' || e.kind === 'warden') && e.shootT <= 0) {
        this.enemyShoot(e);
      }
    }
    // Gentle separation so enemies do not stack.
    for (let i = 0; i < this.enemies.length; i++) {
      for (let j = i + 1; j < this.enemies.length; j++) {
        const a = this.enemies[i], b = this.enemies[j];
        const rr = a.radius + b.radius;
        const d2 = dist2(a.x, a.y, b.x, b.y);
        if (d2 < rr * rr && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = (rr - d) / 2;
          const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
        }
      }
    }

    // --- player bullets ---
    for (const b of this.bullets) {
      b.life -= dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      for (const e of [...this.enemies]) {
        if (e.spawnT > 0 || b.hitIds.has(e.id)) continue;
        const rr = b.radius + e.radius;
        if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
          b.hitIds.add(e.id);
          this.damageEnemy(e, b.damage);
          if (b.pierce > 0) { b.pierce -= 1; } else { b.life = 0; }
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) =>
      b.life > 0 && b.x > -20 && b.x < VIEW.w + 20 && b.y > -20 && b.y < VIEW.h + 20);

    // --- enemy bullets ---
    for (const b of this.enemyBullets) {
      b.life -= dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      const rr = b.radius + p.radius - 4;
      if (dist2(b.x, b.y, p.x, p.y) < rr * rr) {
        b.life = 0;
        this.hurtPlayer(1);
      }
    }
    this.enemyBullets = this.enemyBullets.filter((b) =>
      b.life > 0 && b.x > -20 && b.x < VIEW.w + 20 && b.y > -20 && b.y < VIEW.h + 20);

    // --- thorns ---
    if (p.thorns > 0) {
      for (let i = 0; i < p.thorns; i++) {
        const a = p.thornAngle + (i * Math.PI * 2) / p.thorns;
        const tx = p.x + Math.cos(a) * (p.radius + 20);
        const ty = p.y + Math.sin(a) * (p.radius + 20);
        for (const e of [...this.enemies]) {
          if (e.spawnT > 0) continue;
          const rr = 9 + e.radius;
          if (dist2(tx, ty, e.x, e.y) < rr * rr) {
            e.thornCd = e.thornCd ?? 0;
            if (e.thornCd <= 0) {
              e.thornCd = 0.5;
              this.damageEnemy(e, 1);
            }
          }
        }
      }
      for (const e of this.enemies) e.thornCd = Math.max(0, (e.thornCd ?? 0) - dt);
    }

    // --- touch damage ---
    for (const e of [...this.enemies]) {
      if (e.spawnT > 0) continue;
      const rr = e.radius + p.radius - 3;
      if (dist2(e.x, e.y, p.x, p.y) < rr * rr) {
        this.hurtPlayer(e.touch);
        // Knock the enemy back so one touch is not a chain.
        const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
        e.x += ((e.x - p.x) / d) * 44;
        e.y += ((e.y - p.y) / d) * 44;
        if (p.dead) break;
      }
    }

    // --- pickups ---
    for (const pk of this.pickups) {
      pk.life -= dt;
      const d2 = dist2(pk.x, pk.y, p.x, p.y);
      const magnetR = p.pickupRadius * (pk.kind === 'pollen' ? 1.7 : 1.2);
      if (d2 < magnetR * magnetR) {
        const d = Math.sqrt(d2) || 1;
        const pull = 520 * dt;
        pk.x += ((p.x - pk.x) / d) * pull;
        pk.y += ((p.y - pk.y) / d) * pull;
      }
      if (d2 < (p.radius + pk.radius + 4) * (p.radius + pk.radius + 4)) {
        pk.life = 0;
        if (pk.kind === 'pollen') {
          this.score += PICKUPS.pollenScore * Math.max(1, this.combo);
          this.texts.push(makeFloatText(pk.x, pk.y - 10, `+${PICKUPS.pollenScore}`, COLORS.pollen));
          this.audio.pickup();
        } else {
          p.hp = Math.min(p.maxHp, p.hp + PICKUPS.heartHeal);
          this.texts.push(makeFloatText(pk.x, pk.y - 10, '+1 ♥', COLORS.heart));
          this.audio.heal();
        }
        burst(this.particles, pk.x, pk.y, pk.kind === 'heart' ? COLORS.heart : COLORS.pollen, 8, 120, this.rng, 3);
      }
    }
    this.pickups = this.pickups.filter((pk) => pk.life > 0);
  }

  damageEnemy(e, dmg) {
    e.hp -= dmg;
    e.flash = 0.09;
    this.audio.hit();
    burst(this.particles, e.x, e.y, '#ffffff', 3, 120, this.rng, 2);
    if (e.hp <= 0) this.killEnemy(e);
  }

  enemyShoot(e) {
    const p = this.player;
    if (e.kind === 'spitter') {
      e.shootT = 2.3;
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      this.enemyBullets.push({
        x: e.x, y: e.y, vx: Math.cos(a) * 175, vy: Math.sin(a) * 175,
        radius: 7, life: 5,
      });
      this.audio.blip({ type: 'sine', from: 300, to: 160, dur: 0.12, vol: 0.12 });
    } else if (e.kind === 'warden') {
      e.shootT = 2.6;
      const n = 12;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + this.time * 0.3;
        this.enemyBullets.push({
          x: e.x, y: e.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150,
          radius: 8, life: 6,
        });
      }
      // The Warden also seeds the garden with motes.
      for (let i = 0; i < 2; i++) {
        const m = makeEnemy('mote', e.x + this.rng.range(-40, 40), e.y + this.rng.range(-40, 40), this.wave, this.rng);
        m.spawnT = 0.2;
        this.enemies.push(m);
      }
      this.audio.bossWarn();
    }
  }

  /** Screenshot autopilot: aim at the nearest enemy, kite away from it. */
  autopilotDrive() {
    const p = this.player;
    if (this.autopilot === 'suicide') {
      return { move: { x: 0, y: 0 }, aimX: p.x, aimY: p.y - 100, firing: false };
    }
    let target = null;
    let best = Infinity;
    for (const e of this.enemies) {
      if (e.spawnT > 0) continue;
      const d2 = dist2(e.x, e.y, p.x, p.y);
      if (d2 < best) { best = d2; target = e; }
    }
    if (!target) {
      // No enemy in sight: drift back toward the middle of the garden.
      const cx = VIEW.w / 2 - p.x, cy = VIEW.h / 2 - p.y;
      const d = Math.hypot(cx, cy);
      if (d < 60) return { move: { x: 0, y: 0 }, aimX: p.x, aimY: p.y - 100, firing: false };
      return { move: { x: cx / d, y: cy / d }, aimX: p.x, aimY: p.y - 100, firing: false };
    }
    // Kite: orbit the nearest enemy at a healthy distance, circling toward
    // the middle of the garden so the fight stays in view.
    const dx = target.x - p.x, dy = target.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    let px = -dy / d, py = dx / d;
    const cx = VIEW.w / 2 - p.x, cy = VIEW.h / 2 - p.y;
    if (px * cx + py * cy < 0) { px = -px; py = -py; }
    const radial = d > 300 ? 0.45 : d < 180 ? -0.45 : 0;
    let mx = px * 0.9 + (dx / d) * radial + cx * 0.0006;
    let my = py * 0.9 + (dy / d) * radial + cy * 0.0006;
    const len = Math.hypot(mx, my) || 1;
    return { move: { x: mx / len, y: my / len }, aimX: target.x, aimY: target.y, firing: true };
  }

  // ---------- render ----------

  draw() {
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0.3) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }
    drawBackground(ctx, this.time, this.starfield);
    if (this.state !== 'title') {
      drawPickups(ctx, this.pickups, this.time);
      for (const e of this.enemies) drawEnemy(ctx, e, this.time);
      if (!this.player.dead) drawPlayer(ctx, this.player, this.time);
      drawBullets(ctx, this.bullets);
      drawEnemyBullets(ctx, this.enemyBullets);
      drawParticles(ctx, this.particles);
      drawNova(ctx, this.novaFx);
      drawFloatTexts(ctx, this.texts);
    }
    ctx.restore();

    if (this.state === 'title') drawTitle(ctx, this, this.time);
    if (this.state === 'playing' || this.state === 'intermission' || this.state === 'paused') {
      drawHUD(ctx, this);
    }
    if (this.state === 'draft') {
      this.draftRects = drawDraft(ctx, this, this.draft);
    }
    if (this.state === 'paused') drawPause(ctx);
    if (this.state === 'gameover') drawGameOver(ctx, this);
    drawBanner(ctx, this.banner);
  }

  // ---------- input routing ----------

  handleClick() {
    this.audio.ensure();
    if (this.state === 'title') { this.startGame(); return; }
    if (this.state === 'gameover') { this.startGame(); return; }
    if (this.state === 'paused') { this.state = 'playing'; return; }
    if (this.state === 'draft') {
      const m = this.input.mouse;
      for (const r of this.draftRects) {
        if (m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h) {
          this.pickUpgrade(r.i);
          return;
        }
      }
    }
  }

  handleKeys() {
    const input = this.input;
    if (input.pressed('Enter')) {
      if (this.state === 'title' || this.state === 'gameover') this.startGame();
    }
    if (input.pressed('KeyR')) {
      if (this.state === 'gameover' || this.state === 'playing' || this.state === 'paused') this.startGame();
    }
    if (input.pressed('KeyP') || input.pressed('Escape')) {
      if (this.state === 'playing') this.state = 'paused';
      else if (this.state === 'paused') this.state = 'playing';
    }
    if (input.pressed('KeyM')) {
      this.audio.setMuted(!this.audio.muted);
    }
    if (this.state === 'draft') {
      if (input.pressed('Digit1')) this.pickUpgrade(0);
      if (input.pressed('Digit2')) this.pickUpgrade(1);
      if (input.pressed('Digit3')) this.pickUpgrade(2);
    }
  }

  // ---------- deterministic screenshot states ----------

  /** Drive the real sim into a screenshot state, then freeze it. */
  setupShot() {
    if (!this.shot) return;
    this.rng.reseed(this.seed);
    if (this.shot === 'start') {
      this.state = 'title';
      return;
    }
    this.autopilot = 'play';
    this.startGame();
    // Step the real sim; auto-pick the draft whenever a wave clears so the
    // frozen frame lands mid-combat, not on a menu.
    const step = (n) => {
      for (let i = 0; i < n; i++) {
        if (this.state === 'draft') this.pickUpgrade(0);
        this.update(1 / 60);
      }
    };
    if (this.shot === 'play') {
      // Play into a busy mid-wave moment and freeze the instant it arrives:
      // wave 2 or later, several enemies on screen, banner already gone.
      for (let t = 0; t < 60 * 40; t++) {
        if (this.state === 'draft') this.pickUpgrade(0);
        this.update(1 / 60);
        if (this.state === 'playing' && this.wave >= 2 &&
            this.enemies.length >= 5 && this.spawnQueue.length === 0 && !this.banner) break;
      }
      this.frozen = true;
      return;
    }
    if (this.shot === 'draft') {
      // Play until wave 1 clears and the draft opens (cap the sim).
      for (let i = 0; i < 60 * 90 && this.state !== 'draft'; i++) this.update(1 / 60);
      this.frozen = true;
      return;
    }
    if (this.shot === 'end') {
      // Survive a little, then stand still and let the Blight win.
      step(60 * 8);
      this.autopilot = 'suicide';
      for (let i = 0; i < 60 * 120 && this.state !== 'gameover'; i++) this.update(1 / 60);
      this.frozen = true;
    }
  }

  frame(now) {
    const dt = Math.min(0.033, (now - (this._last ?? now)) / 1000 || 0.016);
    this._last = now;
    this.handleKeys();
    if (!this.frozen) this.update(dt * this.timeScale);
    this.draw();
    this.input.endFrame();
  }

  run() {
    this.setupShot();
    const loop = (now) => {
      this.frame(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

function enemyColor(kind) {
  return {
    mote: COLORS.mote, dasher: COLORS.dasher, spitter: COLORS.spitter,
    splitter: COLORS.splitter, warden: COLORS.warden,
  }[kind] ?? '#ffffff';
}

// Boot.
const canvas = document.getElementById('game');
const game = new Game(canvas);
canvas.addEventListener('mousedown', () => game.handleClick());
window.__voidbloom = { game };
game.run();
