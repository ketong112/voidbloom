// Between-wave upgrade draft: pick 3 distinct upgrades the player has not
// maxed out yet, and apply the chosen one to the player stats.
import { UPGRADES } from './config.js';

/** The three cards offered after a cleared wave. */
export function draftUpgrades(player, taken, rng) {
  const available = UPGRADES.filter((u) => (taken[u.id] ?? 0) < u.max);
  const picks = [];
  const pool = [...available];
  while (picks.length < 3 && pool.length > 0) {
    const i = Math.floor(rng.f() * pool.length);
    picks.push(pool.splice(i, 1)[0]);
  }
  return picks;
}

/** Apply an upgrade and record that it was taken. */
export function applyUpgrade(player, taken, upgrade) {
  upgrade.apply(player);
  taken[upgrade.id] = (taken[upgrade.id] ?? 0) + 1;
}

/** One-line summary of the player's build, for the HUD/game-over screen. */
export function buildSummary(player, taken) {
  const parts = [];
  if (player.shots > 1) parts.push(`x${player.shots} shot`);
  if (player.thorns > 0) parts.push(`${player.thorns} thorn${player.thorns > 1 ? 's' : ''}`);
  if (player.pierce > 0) parts.push(`pierce ${player.pierce}`);
  if (player.nova) parts.push('nova');
  for (const [id, n] of Object.entries(taken)) {
    if (id === 'rapid') parts.push(`rapid ${n}`);
    if (id === 'swift') parts.push(`swift ${n}`);
    if (id === 'magnet') parts.push(`magnet ${n}`);
    if (id === 'heart') parts.push(`heart ${n}`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'No upgrades yet';
}
