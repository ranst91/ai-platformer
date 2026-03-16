// apps/app/src/lib/game/renderer.ts

import type { Platform, Enemy, Coin, PlayerState, LevelChunk } from "./types";
import type { Camera } from "./camera";
import { isVisible } from "./camera";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  CHUNK_WIDTH,
  GROUND_Y,
  GROUND_HEIGHT,
  COLORS,
} from "./constants";

// ─── Clear ───────────────────────────────────────────────────────────────────

export function clearCanvas(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = COLORS.sky;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

// ─── Background ──────────────────────────────────────────────────────────────

// Simple parallax clouds stored as offsets from the origin
const CLOUD_DEFS: Array<{ ox: number; oy: number; r: number }> = [
  { ox: 80,  oy: 80,  r: 30 },
  { ox: 200, oy: 50,  r: 20 },
  { ox: 400, oy: 100, r: 35 },
  { ox: 600, oy: 65,  r: 25 },
  { ox: 750, oy: 90,  r: 28 },
  { ox: 1100, oy: 70, r: 32 },
  { ox: 1400, oy: 55, r: 22 },
];

export function drawBackground(ctx: CanvasRenderingContext2D, camera: Camera): void {
  ctx.fillStyle = "#FFFFFF";
  ctx.globalAlpha = 0.7;

  // Parallax factor 0.3 — clouds scroll slower than the world
  const parallaxX = camera.x * 0.3;

  for (const cloud of CLOUD_DEFS) {
    // Tile clouds so they repeat every 1600 px of world space
    const tileOffset = Math.floor((parallaxX - cloud.ox + 1600) / 1600) * 1600;
    const screenX = cloud.ox + tileOffset - parallaxX;

    if (screenX + cloud.r * 2 < 0 || screenX - cloud.r * 2 > CANVAS_WIDTH) continue;

    // Draw a fluffy cloud from 3 overlapping circles
    ctx.beginPath();
    ctx.arc(screenX,        cloud.oy,           cloud.r,       0, Math.PI * 2);
    ctx.arc(screenX + cloud.r * 0.8, cloud.oy - cloud.r * 0.4, cloud.r * 0.7, 0, Math.PI * 2);
    ctx.arc(screenX - cloud.r * 0.8, cloud.oy - cloud.r * 0.3, cloud.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

// ─── Ground ───────────────────────────────────────────────────────────────────

export function drawGround(ctx: CanvasRenderingContext2D, camera: Camera): void {
  // Main ground body
  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, GROUND_HEIGHT);

  // Grass stripe on top
  const GRASS_HEIGHT = 8;
  ctx.fillStyle = COLORS.groundTop;
  ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, GRASS_HEIGHT);
}

// ─── Platform ────────────────────────────────────────────────────────────────

export function drawPlatform(
  ctx: CanvasRenderingContext2D,
  platform: Platform,
  worldX: number,
  camera: Camera
): void {
  const screenX = worldX - camera.x;

  if (screenX + platform.width < 0 || screenX > CANVAS_WIDTH) return;

  const { y, width, height, type } = platform;

  // Base body
  ctx.fillStyle = COLORS.platform;
  ctx.fillRect(screenX, y, width, height);

  // Top stripe / type indicator
  const TOP_H = 6;

  switch (type) {
    case "bouncy":
      // Pink top
      ctx.fillStyle = "#FF69B4";
      ctx.fillRect(screenX, y, width, TOP_H);
      break;

    case "icy":
      // Light blue top
      ctx.fillStyle = "#ADD8E6";
      ctx.fillRect(screenX, y, width, TOP_H);
      break;

    case "crumbling":
      // Brown with crack lines
      ctx.fillStyle = "#8B6914";
      ctx.fillRect(screenX, y, width, TOP_H);
      // Crack lines
      ctx.strokeStyle = "#5C4A1E";
      ctx.lineWidth = 1.5;
      const step = Math.max(20, Math.floor(width / 4));
      for (let cx = screenX + step; cx < screenX + width - 4; cx += step) {
        ctx.beginPath();
        ctx.moveTo(cx, y);
        ctx.lineTo(cx - 4, y + height);
        ctx.stroke();
      }
      break;

    case "moving":
      // Green-yellow top
      ctx.fillStyle = "#9ACD32";
      ctx.fillRect(screenX, y, width, TOP_H);
      break;

    default:
      // Normal — classic green top
      ctx.fillStyle = COLORS.platformTop;
      ctx.fillRect(screenX, y, width, TOP_H);
      break;
  }
}

// ─── Player ───────────────────────────────────────────────────────────────────

export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  camera: Camera
): void {
  const screenX = player.x - camera.x;
  const screenY = player.y;

  // Body
  ctx.fillStyle = COLORS.player;
  ctx.fillRect(screenX, screenY, PLAYER_WIDTH, PLAYER_HEIGHT);

  // Eye position depends on facing direction
  // facing = 1 → right side, facing = -1 → left side
  const eyeOffsetX = player.facing === 1 ? PLAYER_WIDTH * 0.6 : PLAYER_WIDTH * 0.2;
  const eyeOffsetY = PLAYER_HEIGHT * 0.25;
  const eyeR = 5;

  // White of eye
  ctx.fillStyle = COLORS.playerEyes;
  ctx.beginPath();
  ctx.arc(screenX + eyeOffsetX, screenY + eyeOffsetY, eyeR, 0, Math.PI * 2);
  ctx.fill();

  // Pupil
  const pupilOffsetX = player.facing === 1 ? 2 : -2;
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.arc(
    screenX + eyeOffsetX + pupilOffsetX,
    screenY + eyeOffsetY + 1,
    2.5,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

// ─── Enemy ───────────────────────────────────────────────────────────────────

export function drawEnemy(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  worldX: number,
  camera: Camera
): void {
  if (!enemy.alive) return;

  const screenX = worldX - camera.x;
  const screenY = enemy.y;
  const SIZE = 30;

  if (screenX + SIZE < 0 || screenX > CANVAS_WIDTH) return;

  ctx.fillStyle = COLORS.enemy;

  switch (enemy.type) {
    case "walker": {
      // Square body
      ctx.fillRect(screenX, screenY, SIZE, SIZE);

      // Angry eyes
      const eyeY = screenY + SIZE * 0.25;
      // Left eye
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(screenX + 4, eyeY, 8, 6);
      ctx.fillStyle = "#000000";
      ctx.fillRect(screenX + 7, eyeY + 1, 3, 4);
      // Right eye
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(screenX + SIZE - 12, eyeY, 8, 6);
      ctx.fillStyle = "#000000";
      ctx.fillRect(screenX + SIZE - 10, eyeY + 1, 3, 4);

      // Angry brow
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(screenX + 4,        eyeY - 2);
      ctx.lineTo(screenX + 12,       eyeY + 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(screenX + SIZE - 4, eyeY - 2);
      ctx.lineTo(screenX + SIZE - 12, eyeY + 2);
      ctx.stroke();
      break;
    }

    case "flyer": {
      // Triangle body
      ctx.beginPath();
      ctx.moveTo(screenX + SIZE / 2, screenY);
      ctx.lineTo(screenX + SIZE,     screenY + SIZE);
      ctx.lineTo(screenX,            screenY + SIZE);
      ctx.closePath();
      ctx.fill();

      // Wings
      ctx.fillStyle = "#FF8888";
      // Left wing
      ctx.beginPath();
      ctx.moveTo(screenX,            screenY + SIZE * 0.5);
      ctx.lineTo(screenX - 12,       screenY + SIZE * 0.2);
      ctx.lineTo(screenX - 12,       screenY + SIZE * 0.7);
      ctx.closePath();
      ctx.fill();
      // Right wing
      ctx.beginPath();
      ctx.moveTo(screenX + SIZE,     screenY + SIZE * 0.5);
      ctx.lineTo(screenX + SIZE + 12, screenY + SIZE * 0.2);
      ctx.lineTo(screenX + SIZE + 12, screenY + SIZE * 0.7);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case "shooter": {
      // Turret base (rectangle)
      ctx.fillRect(screenX + 4, screenY + SIZE * 0.4, SIZE - 8, SIZE * 0.6);

      // Turret head (circle)
      ctx.beginPath();
      ctx.arc(screenX + SIZE / 2, screenY + SIZE * 0.4, SIZE * 0.35, 0, Math.PI * 2);
      ctx.fill();

      // Gun barrel (rect pointing left — shoots at player)
      ctx.fillStyle = "#CC0000";
      ctx.fillRect(screenX - 8, screenY + SIZE * 0.3, 14, 6);
      break;
    }
  }
}

// ─── Coin ─────────────────────────────────────────────────────────────────────

export function drawCoin(
  ctx: CanvasRenderingContext2D,
  coinWorldX: number,
  coinY: number,
  camera: Camera,
  time: number
): void {
  const screenX = coinWorldX - camera.x;

  if (screenX + 20 < 0 || screenX - 20 > CANVAS_WIDTH) return;

  const RADIUS = 10;
  // Bobbing: ±4 px at ~1 Hz
  const bobY = coinY + Math.sin(time * 2 * Math.PI) * 4;

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath();
  ctx.ellipse(screenX, bobY + RADIUS + 3, RADIUS * 0.7, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Coin body
  ctx.fillStyle = COLORS.coin;
  ctx.beginPath();
  ctx.arc(screenX, bobY, RADIUS, 0, Math.PI * 2);
  ctx.fill();

  // Shine highlight
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.arc(screenX - 3, bobY - 3, RADIUS * 0.4, 0, Math.PI * 2);
  ctx.fill();
}

// ─── Chunks ───────────────────────────────────────────────────────────────────

export function drawChunks(
  ctx: CanvasRenderingContext2D,
  chunks: LevelChunk[],
  camera: Camera,
  time: number
): void {
  for (const chunk of chunks) {
    const chunkScreenX = chunk.chunk_index * CHUNK_WIDTH - camera.x;

    // Skip entire chunk if offscreen (rough cull)
    if (chunkScreenX + CHUNK_WIDTH < 0 || chunkScreenX > CANVAS_WIDTH) continue;

    // Platforms
    for (const platform of chunk.platforms) {
      const worldX = platform.x + chunk.chunk_index * CHUNK_WIDTH;
      drawPlatform(ctx, platform, worldX, camera);
    }

    // Coins
    for (const coin of chunk.coins) {
      if (coin.collected) continue;
      const worldX = coin.x + chunk.chunk_index * CHUNK_WIDTH;
      drawCoin(ctx, worldX, coin.y, camera, time);
    }

    // Enemies
    for (const enemy of chunk.enemies) {
      if (!enemy.alive) continue;
      const worldX = enemy.x + chunk.chunk_index * CHUNK_WIDTH + (enemy.moveOffset ?? 0);
      drawEnemy(ctx, enemy, worldX, camera);
    }
  }
}
