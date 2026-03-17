// apps/app/src/lib/game/physics.ts

import type { Platform, Enemy, Coin, PlayerState, LevelChunk } from "./types";
import {
  GRAVITY,
  PLAYER_SPEED,
  PLAYER_JUMP_VELOCITY,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  MAX_FALL_SPEED,
  CHUNK_WIDTH,
  GROUND_Y,
} from "./constants";

// ─── Rectangle overlap (AABB) ───────────────────────────────────────────────

export function aabbOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// ─── Platform world position ─────────────────────────────────────────────────

export function platformWorldX(platform: Platform, chunkIndex: number): number {
  return platform.x + chunkIndex * CHUNK_WIDTH;
}

// ─── Player update ───────────────────────────────────────────────────────────

export interface UpdatePlayerResult {
  landed: boolean;
  fellOff: boolean;
}

export function updatePlayer(
  player: PlayerState,
  keys: Set<string>,
  platforms: Array<{ platform: Platform; chunkIndex: number }>,
  dt: number
): UpdatePlayerResult {
  if (!player.alive) return { landed: false, fellOff: false };

  // ── Horizontal movement ──────────────────────────────────────────────────
  const movingLeft = keys.has("ArrowLeft") || keys.has("a") || keys.has("A");
  const movingRight = keys.has("ArrowRight") || keys.has("d") || keys.has("D");

  if (movingLeft) {
    player.vx = -PLAYER_SPEED;
    player.facing = -1;
  } else if (movingRight) {
    player.vx = PLAYER_SPEED;
    player.facing = 1;
  } else {
    player.vx = 0;
  }

  // ── Jump ─────────────────────────────────────────────────────────────────
  const wantsJump =
    keys.has("ArrowUp") || keys.has("w") || keys.has("W") || keys.has(" ");
  if (wantsJump && player.onGround) {
    player.vy = PLAYER_JUMP_VELOCITY;
    player.onGround = false;
  }

  // ── Apply gravity ─────────────────────────────────────────────────────────
  player.vy = Math.min(player.vy + GRAVITY * dt, MAX_FALL_SPEED);

  // ── Store previous bottom for crossing detection ─────────────────────────
  const prevBottom = player.y + PLAYER_HEIGHT;

  // ── Integrate position ────────────────────────────────────────────────────
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  const newBottom = player.y + PLAYER_HEIGHT;

  // ── Platform collision (one-way, top only) ───────────────────────────────
  let landed = false;
  player.onGround = false;

  if (player.vy >= 0) {
    for (const { platform, chunkIndex } of platforms) {
      const wx = platformWorldX(platform, chunkIndex);
      const platTop = platform.y;

      // Player must be horizontally overlapping the platform
      const playerLeft = player.x;
      const playerRight = player.x + PLAYER_WIDTH;
      const platLeft = wx;
      const platRight = wx + platform.width;

      if (playerRight <= platLeft || playerLeft >= platRight) continue;

      // Crossing detection: previous bottom was above platform top, new bottom is at/below it
      if (prevBottom <= platTop && newBottom >= platTop) {
        player.y = platTop - PLAYER_HEIGHT;

        if (platform.type === "bouncy") {
          // Bouncy platform — launch the player high!
          player.vy = PLAYER_JUMP_VELOCITY * 1.5;
          player.onGround = false;
        } else {
          player.vy = 0;
          player.onGround = true;
        }
        landed = true;
        break;
      }
    }
  }

  // ── Fell off screen ───────────────────────────────────────────────────────
  const fellOff = player.y > GROUND_Y + 200;

  return { landed, fellOff };
}

// ─── Enemy collision ─────────────────────────────────────────────────────────

export type EnemyCollisionResult = "kill" | "hurt" | "none";

export function checkEnemyCollision(
  player: PlayerState,
  enemy: Enemy
): EnemyCollisionResult {
  // We assume enemy world x is already resolved before calling this
  if (!aabbOverlap(
    player.x, player.y, PLAYER_WIDTH, PLAYER_HEIGHT,
    enemy.x - 4, enemy.y - 4, 38, 38
  )) {
    return "none";
  }

  // Player stomping enemy: player falling (vy > 0) and player's feet are
  // near the top of the enemy — slightly generous for better game feel
  const playerBottom = player.y + PLAYER_HEIGHT;
  const enemyTop = enemy.y;

  if (player.vy > 0 && playerBottom <= enemyTop + 20) {
    return "kill";
  }

  return "hurt";
}

// ─── Coin collision ──────────────────────────────────────────────────────────

export function checkCoinCollision(
  player: PlayerState,
  coinWorldX: number,
  coinY: number
): boolean {
  const COIN_SIZE = 20;
  return aabbOverlap(
    player.x, player.y, PLAYER_WIDTH, PLAYER_HEIGHT,
    coinWorldX - COIN_SIZE / 2, coinY - COIN_SIZE / 2, COIN_SIZE, COIN_SIZE
  );
}
