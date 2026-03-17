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
import type { SpriteAtlas } from "./sprites";

// ─── Clear ───────────────────────────────────────────────────────────────────

export function clearCanvas(ctx: CanvasRenderingContext2D): void {
  // Vertical gradient sky
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  grad.addColorStop(0, COLORS.skyTop);
  grad.addColorStop(1, COLORS.skyBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

// ─── Background ──────────────────────────────────────────────────────────────

// Cloud definitions: ox = world-space origin x, oy = screen y, r = base radius
const CLOUD_DEFS: Array<{ ox: number; oy: number; r: number }> = [
  { ox: 80,   oy: 70,  r: 32 },
  { ox: 230,  oy: 45,  r: 22 },
  { ox: 420,  oy: 90,  r: 38 },
  { ox: 620,  oy: 60,  r: 28 },
  { ox: 780,  oy: 85,  r: 30 },
  { ox: 1100, oy: 65,  r: 35 },
  { ox: 1350, oy: 50,  r: 24 },
];

/** Draw a fluffy cloud made of multiple overlapping circles */
function drawCloud(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  ctx.arc(cx,             cy,           r,         0, Math.PI * 2);
  ctx.arc(cx + r * 0.9,  cy - r * 0.3, r * 0.72,  0, Math.PI * 2);
  ctx.arc(cx - r * 0.9,  cy - r * 0.25,r * 0.62,  0, Math.PI * 2);
  ctx.arc(cx + r * 0.45, cy - r * 0.6, r * 0.52,  0, Math.PI * 2);
  ctx.arc(cx - r * 0.4,  cy - r * 0.55,r * 0.45,  0, Math.PI * 2);
  ctx.fill();
}

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  sprites?: SpriteAtlas
): void {
  if (sprites?.loaded) {
    drawBackgroundAllKenney(ctx, camera, sprites);
  } else {
    drawBackgroundProcedural(ctx, camera);
  }
}

/** Tile a sprite horizontally. ALL coords rounded to int, +1px overlap to kill seams. */
function tileRow(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  parallaxOffset: number,
  y: number,
  tileW: number,
  tileH: number,
): void {
  const startX = Math.round(-(((parallaxOffset % tileW) + tileW) % tileW));
  const iy = Math.round(y);
  for (let tx = startX; tx < CANVAS_WIDTH + tileW; tx += tileW) {
    ctx.drawImage(img, tx, iy, tileW + 1, tileH + 1);
  }
}

function drawBackgroundAllKenney(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  sprites: SpriteAtlas
): void {
  const T = 256;
  const SKY_H = GROUND_Y; // 520px

  // Sky: stretch the solid sky to fill the ENTIRE sky area.
  // One drawImage, no tiling, no seams. This is the base color.
  ctx.drawImage(sprites.bgSolidSky, 0, 0, CANVAS_WIDTH, SKY_H);

  // Clouds: tile horizontally at NATURAL height (256px) at the top.
  // The bottom of the cloud sprite matches the solid sky color (same pack),
  // and below it is the stretched solid sky — same color = no seam.
  // The 40 there is what makes the clouds touch the white BG below it!
  tileRow(ctx, sprites.bgClouds, camera.x * 0.15, 40, T, T);

  // Hills: tile horizontally at NATURAL height, positioned in the lower sky.
  // Clip above ground to avoid parallax mismatch with ground tiles.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, CANVAS_WIDTH, GROUND_Y);
  ctx.clip();
  const hillY = Math.round(GROUND_Y - T + 30);
  tileRow(ctx, sprites.bgHills, camera.x * 0.25, hillY, T, T);
  ctx.restore();
}

function drawBackgroundProcedural(ctx: CanvasRenderingContext2D, camera: Camera): void {
  const TILE = 1600; // world pixels before clouds repeat

  // ── Far layer: distant blue-tinted mountains (parallax 0.1) ──────────────
  const farParallax = camera.x * 0.1;
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "#90B8D8";

  // Draw several rounded mountain silhouettes tiling across the screen
  const mountainDefs = [
    { ox: 0,   w: 260, h: 110 },
    { ox: 220, w: 200, h:  80 },
    { ox: 400, w: 280, h: 130 },
    { ox: 650, w: 220, h:  95 },
    { ox: 860, w: 260, h: 120 },
    { ox: 1100,w: 200, h:  85 },
    { ox: 1300,w: 240, h: 110 },
  ];

  for (const m of mountainDefs) {
    const tileOff = Math.floor((farParallax - m.ox + TILE) / TILE) * TILE;
    const sx = m.ox + tileOff - farParallax;
    if (sx + m.w < 0 || sx > CANVAS_WIDTH) continue;
    const baseY = GROUND_Y - 20;
    ctx.beginPath();
    ctx.moveTo(sx, baseY);
    ctx.quadraticCurveTo(sx + m.w * 0.5, baseY - m.h, sx + m.w, baseY);
    ctx.closePath();
    ctx.fill();
  }

  // ── Mid layer: green rolling hills (parallax 0.3) ─────────────────────────
  const midParallax = camera.x * 0.3;
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#5D9B4A";

  const hillDefs = [
    { ox: 50,  w: 320, h:  80 },
    { ox: 350, w: 260, h:  60 },
    { ox: 600, w: 300, h:  75 },
    { ox: 900, w: 280, h:  65 },
    { ox: 1180,w: 320, h:  80 },
    { ox: 1450,w: 260, h:  60 },
  ];

  for (const hill of hillDefs) {
    const tileOff = Math.floor((midParallax - hill.ox + TILE) / TILE) * TILE;
    const sx = hill.ox + tileOff - midParallax;
    if (sx + hill.w < 0 || sx > CANVAS_WIDTH) continue;
    const baseY = GROUND_Y + 5;
    ctx.beginPath();
    ctx.moveTo(sx, baseY);
    ctx.quadraticCurveTo(sx + hill.w * 0.5, baseY - hill.h, sx + hill.w, baseY);
    ctx.closePath();
    ctx.fill();
  }

  // Hill dark base
  ctx.fillStyle = "#4A7A3A";
  for (const hill of hillDefs) {
    const tileOff = Math.floor((midParallax - hill.ox + TILE) / TILE) * TILE;
    const sx = hill.ox + tileOff - midParallax;
    if (sx + hill.w < 0 || sx > CANVAS_WIDTH) continue;
    const baseY = GROUND_Y + 5;
    ctx.fillRect(sx, baseY - 12, hill.w, 12);
  }

  // ── Near layer: bushes/shrubs (parallax 0.5) ──────────────────────────────
  const nearParallax = camera.x * 0.5;
  const bushDefs = [
    { ox: 100, w: 55, h: 25, c: "#4CAF50" },
    { ox: 280, w: 40, h: 20, c: "#388E3C" },
    { ox: 470, w: 60, h: 28, c: "#4CAF50" },
    { ox: 700, w: 45, h: 22, c: "#388E3C" },
    { ox: 950, w: 55, h: 26, c: "#4CAF50" },
    { ox: 1200,w: 50, h: 22, c: "#388E3C" },
    { ox: 1430,w: 60, h: 28, c: "#4CAF50" },
  ];

  for (const bush of bushDefs) {
    const tileOff = Math.floor((nearParallax - bush.ox + TILE) / TILE) * TILE;
    const sx = bush.ox + tileOff - nearParallax;
    if (sx + bush.w < 0 || sx > CANVAS_WIDTH) continue;
    const baseY = GROUND_Y;
    ctx.fillStyle = bush.c;
    // Bush = two overlapping circles on a flat base
    ctx.beginPath();
    ctx.arc(sx + bush.w * 0.35, baseY - bush.h * 0.7, bush.h * 0.7, 0, Math.PI * 2);
    ctx.arc(sx + bush.w * 0.7,  baseY - bush.h * 0.55, bush.h * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(sx, baseY - bush.h * 0.35, bush.w, bush.h * 0.35);
  }

  // ── Clouds (parallax 0.25) ────────────────────────────────────────────────
  const cloudParallax = camera.x * 0.25;
  ctx.fillStyle = "#FFFFFF";
  ctx.globalAlpha = 0.82;

  for (const cloud of CLOUD_DEFS) {
    const tileOff = Math.floor((cloudParallax - cloud.ox + TILE) / TILE) * TILE;
    const screenX = cloud.ox + tileOff - cloudParallax;
    if (screenX + cloud.r * 3 < 0 || screenX - cloud.r * 3 > CANVAS_WIDTH) continue;
    drawCloud(ctx, screenX, cloud.oy, cloud.r);
  }

  ctx.globalAlpha = 1;
}

// ─── Ground ───────────────────────────────────────────────────────────────────

export function drawGround(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  sprites?: SpriteAtlas
): void {
  if (sprites?.loaded) {
    drawGroundSprites(ctx, camera, sprites);
  } else {
    drawGroundProcedural(ctx, camera);
  }
}

function drawGroundSprites(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  sprites: SpriteAtlas
): void {
  const TILE = 64;
  // Ground scrolls 1:1 with camera — use integer offset
  const rawOffset = Math.floor(camera.x) % TILE;
  const startX = Math.floor(-(((rawOffset) + TILE) % TILE));

  // Top grass row — +1 overlap to prevent seams
  for (let tx = startX; tx < CANVAS_WIDTH + TILE; tx += TILE) {
    ctx.drawImage(sprites.grassTop, tx, GROUND_Y, TILE + 1, TILE + 1);
  }

  // Dirt fill below — +1 overlap on both axes
  for (let tx = startX; tx < CANVAS_WIDTH + TILE; tx += TILE) {
    for (let ty = GROUND_Y + TILE; ty < GROUND_Y + GROUND_HEIGHT + TILE; ty += TILE) {
      ctx.drawImage(sprites.dirtCenter, tx, ty, TILE + 1, TILE + 1);
    }
  }
}

function drawGroundProcedural(ctx: CanvasRenderingContext2D, camera: Camera): void {
  const GRASS_HEIGHT = 10;
  const HIGHLIGHT_HEIGHT = 3;
  const DARK_LAYER = 16;

  // Dark earth base layer
  ctx.fillStyle = COLORS.groundDark;
  ctx.fillRect(0, GROUND_Y + GRASS_HEIGHT + DARK_LAYER, CANVAS_WIDTH, GROUND_HEIGHT - GRASS_HEIGHT - DARK_LAYER);

  // Main earth body
  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(0, GROUND_Y + GRASS_HEIGHT, CANVAS_WIDTH, DARK_LAYER);

  // Subtle dirt pattern dots
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  const dotSpacing = 28;
  const dotOffX = Math.floor(camera.x * 0.95) % dotSpacing;
  for (let dx = -dotSpacing + dotOffX; dx < CANVAS_WIDTH + dotSpacing; dx += dotSpacing) {
    for (let dy = GROUND_Y + GRASS_HEIGHT + 6; dy < GROUND_Y + GROUND_HEIGHT - 6; dy += 18) {
      ctx.beginPath();
      ctx.arc(dx + (dy % 14), dy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Grass top stripe
  ctx.fillStyle = COLORS.groundTop;
  ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, GRASS_HEIGHT);

  // Grass highlight stripe
  ctx.fillStyle = COLORS.groundGrassHighlight;
  ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, HIGHLIGHT_HEIGHT);

  // Grass blade details — tiny triangles at regular intervals
  ctx.fillStyle = "#388E3C";
  const bladeSpacing = 12;
  const bladeOffX = Math.floor(camera.x % bladeSpacing);
  for (let bx = -bladeSpacing + bladeOffX; bx < CANVAS_WIDTH + bladeSpacing; bx += bladeSpacing) {
    ctx.beginPath();
    ctx.moveTo(bx,      GROUND_Y);
    ctx.lineTo(bx + 3,  GROUND_Y - 5);
    ctx.lineTo(bx + 6,  GROUND_Y);
    ctx.closePath();
    ctx.fill();
  }
}

// ─── Platform ────────────────────────────────────────────────────────────────

/** Helper: draw a rounded rectangle (compatible with older browsers) */
function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.arcTo(x + w, y, x + w, y + rad, rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
  ctx.lineTo(x + rad, y + h);
  ctx.arcTo(x, y + h, x, y + h - rad, rad);
  ctx.lineTo(x, y + rad);
  ctx.arcTo(x, y, x + rad, y, rad);
  ctx.closePath();
  ctx.fill();
}

/** Tile a sprite horizontally across a range, clipping to [startX, endX] */
function tileImageH(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  startX: number,
  y: number,
  endX: number,
  tileW: number,
  tileH: number
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(Math.floor(startX), Math.floor(y), Math.ceil(endX - startX), Math.ceil(tileH));
  ctx.clip();
  const firstTileX = Math.floor(startX / tileW) * tileW;
  for (let tx = firstTileX; tx < endX; tx += tileW) {
    // +1 overlap prevents sub-pixel seams between adjacent tiles
    ctx.drawImage(img, Math.floor(tx), Math.floor(y), tileW + 1, tileH + 1);
  }
  ctx.restore();
}

export function drawPlatform(
  ctx: CanvasRenderingContext2D,
  platform: Platform,
  worldX: number,
  camera: Camera,
  sprites?: SpriteAtlas
): void {
  const screenX = worldX - camera.x;

  if (screenX + platform.width < 0 || screenX > CANVAS_WIDTH) return;

  if (sprites?.loaded) {
    drawPlatformSprites(ctx, platform, screenX, sprites);
  } else {
    drawPlatformProcedural(ctx, platform, screenX);
  }
}

function drawPlatformSprites(
  ctx: CanvasRenderingContext2D,
  platform: Platform,
  screenX: number,
  sprites: SpriteAtlas
): void {
  const { y, width, height, type } = platform;
  const TILE = 64;

  switch (type) {
    case "normal":
    case "moving": {
      // Grass cloud tiles: left + middle (tiled) + right
      if (width <= TILE) {
        // Narrow platform: stretch a single middle tile
        ctx.drawImage(sprites.grassCloudMiddle, screenX, y, width, height);
      } else {
        const leftW = Math.min(TILE, Math.floor(width / 3));
        const rightW = Math.min(TILE, Math.floor(width / 3));
        const midW = width - leftW - rightW;
        const midStartX = screenX + leftW;

        ctx.drawImage(sprites.grassCloudLeft,   screenX,           y, leftW,  height);
        tileImageH(ctx, sprites.grassCloudMiddle, midStartX, y, midStartX + midW, TILE, height);
        ctx.drawImage(sprites.grassCloudRight,  screenX + width - rightW, y, rightW, height);
      }

      // Moving indicator: subtle blue tint overlay
      if (type === "moving") {
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = "#4FC3F7";
        ctx.fillRect(screenX, y, width, height);
        ctx.globalAlpha = 1;
      }
      break;
    }

    case "mystery": {
      const isHit = platform.hit === true;
      const blockSprite = isHit ? sprites.blockCoinActive : sprites.blockCoin;
      // Draw one block per ~56px (scale to height x height square blocks)
      const blockSize = Math.min(height, TILE);
      const numBlocks = Math.max(1, Math.round(width / blockSize));
      const actualBlockW = width / numBlocks;
      for (let i = 0; i < numBlocks; i++) {
        ctx.drawImage(blockSprite, screenX + i * actualBlockW, y, actualBlockW, height);
      }
      break;
    }

    case "bouncy": {
      // Use spring sprite — draw centered in the platform
      const springW = Math.min(width, height * 1.5);
      const springX = screenX + (width - springW) / 2;
      ctx.drawImage(sprites.spring, springX, y, springW, height);

      // Fill sides if platform wider than sprite
      if (width > springW) {
        ctx.fillStyle = "#E91E8C";
        if (springX > screenX) {
          ctx.fillRect(screenX, y, springX - screenX, height);
        }
        const rightStart = springX + springW;
        if (rightStart < screenX + width) {
          ctx.fillRect(rightStart, y, screenX + width - rightStart, height);
        }
      }
      break;
    }

    case "icy": {
      // Dirt tiles tinted light blue for icy look
      tileImageH(ctx, sprites.dirtTop, screenX, y, screenX + width, TILE, height);
      // Blue frost tint
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = "#B3E5FC";
      ctx.fillRect(screenX, y, width, height);
      ctx.globalAlpha = 1;
      // Frost highlight at top
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(screenX, y, width, 3);
      ctx.globalAlpha = 1;
      break;
    }

    case "crumbling": {
      // Brick tiles
      tileImageH(ctx, sprites.brickBrown, screenX, y, screenX + width, TILE, height);
      break;
    }

    default: {
      // Fallback: grass cloud middle tiled
      tileImageH(ctx, sprites.grassCloudMiddle, screenX, y, screenX + width, TILE, height);
      break;
    }
  }
}

function drawPlatformProcedural(
  ctx: CanvasRenderingContext2D,
  platform: Platform,
  screenX: number
): void {
  const { y, width, height, type } = platform;
  const GRASS_H = 8;
  const CORNER_R = 4;
  const SHADOW_OFFSET = 3;

  // Drop shadow
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  fillRoundRect(ctx, screenX + SHADOW_OFFSET, y + SHADOW_OFFSET, width, height, CORNER_R);

  switch (type) {
    case "bouncy": {
      // Pink/magenta body
      ctx.fillStyle = "#E91E8C";
      fillRoundRect(ctx, screenX, y, width, height, CORNER_R);

      // Darker bottom edge
      ctx.fillStyle = "#AD1457";
      fillRoundRect(ctx, screenX, y + height - 6, width, 6, CORNER_R);

      // Spring coil pattern on body
      ctx.strokeStyle = "#F48FB1";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      const coilCount = Math.floor(width / 16);
      for (let i = 0; i <= coilCount; i++) {
        const cx = screenX + (i / coilCount) * width;
        ctx.beginPath();
        ctx.moveTo(cx, y + GRASS_H);
        ctx.lineTo(cx, y + height - 4);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Spring visual on top
      ctx.fillStyle = "#FCE4EC";
      ctx.fillRect(screenX + width * 0.35, y - 4, width * 0.3, 5);
      ctx.fillStyle = "#E91E8C";
      ctx.fillRect(screenX + width * 0.4, y - 8, width * 0.2, 5);
      break;
    }

    case "icy": {
      // Light blue icy body
      ctx.fillStyle = "#B3E5FC";
      fillRoundRect(ctx, screenX, y, width, height, CORNER_R);

      // Darker ice underside
      ctx.fillStyle = "#81D4FA";
      fillRoundRect(ctx, screenX, y + height - 5, width, 5, CORNER_R);

      // Shiny highlights (diagonal stripes)
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "#FFFFFF";
      for (let ix = screenX + 6; ix < screenX + width - 4; ix += 18) {
        ctx.beginPath();
        ctx.moveTo(ix, y + 2);
        ctx.lineTo(ix + 6, y + 2);
        ctx.lineTo(ix + 2, y + height - 2);
        ctx.lineTo(ix - 4, y + height - 2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Frost crystal clusters on top
      ctx.fillStyle = "#E1F5FE";
      ctx.fillRect(screenX + 2, y, width - 4, GRASS_H - 2);

      // Little frost spikes
      ctx.fillStyle = "#FFFFFF";
      const crystalSpacing = 14;
      for (let cx2 = screenX + 6; cx2 < screenX + width - 4; cx2 += crystalSpacing) {
        ctx.beginPath();
        ctx.moveTo(cx2, y);
        ctx.lineTo(cx2 + 3, y - 5);
        ctx.lineTo(cx2 + 6, y);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }

    case "crumbling": {
      // Cracked brown body
      ctx.fillStyle = "#A1887F";
      fillRoundRect(ctx, screenX, y, width, height, CORNER_R);

      // Darker base
      ctx.fillStyle = "#795548";
      fillRoundRect(ctx, screenX, y + height - 5, width, 5, CORNER_R);

      // Chunk/gap gaps — visible cracks
      ctx.strokeStyle = "#4E342E";
      ctx.lineWidth = 1.5;
      const step = Math.max(20, Math.floor(width / 4));
      for (let cx3 = screenX + step; cx3 < screenX + width - 4; cx3 += step) {
        ctx.beginPath();
        ctx.moveTo(cx3,     y + 2);
        ctx.lineTo(cx3 - 3, y + height * 0.4);
        ctx.lineTo(cx3 + 3, y + height * 0.6);
        ctx.lineTo(cx3 - 2, y + height - 2);
        ctx.stroke();
        // Cross-crack
        ctx.beginPath();
        ctx.moveTo(cx3 - 8, y + height * 0.5);
        ctx.lineTo(cx3 + 8, y + height * 0.55);
        ctx.stroke();
      }

      // Dusty top layer
      ctx.fillStyle = "#BCAAA4";
      ctx.fillRect(screenX + 2, y, width - 4, GRASS_H - 2);
      break;
    }

    case "moving": {
      // Slightly different green — moving platform
      ctx.fillStyle = COLORS.platform;
      fillRoundRect(ctx, screenX, y, width, height, CORNER_R);

      // Dark bottom edge
      ctx.fillStyle = COLORS.platformDark;
      fillRoundRect(ctx, screenX, y + height - 5, width, 5, CORNER_R);

      // Green top
      ctx.fillStyle = "#66BB6A";
      ctx.fillRect(screenX + 2, y, width - 4, GRASS_H);

      // Highlight
      ctx.fillStyle = "#A5D6A7";
      ctx.fillRect(screenX + 2, y, width - 4, 3);

      // Arrow indicators on the body (subtle)
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      const arrowCy = y + height * 0.62;
      const arrowMidX = screenX + width * 0.5;
      // Left arrow
      ctx.beginPath();
      ctx.moveTo(arrowMidX - 6,  arrowCy);
      ctx.lineTo(arrowMidX - 12, arrowCy - 5);
      ctx.lineTo(arrowMidX - 12, arrowCy + 5);
      ctx.closePath();
      ctx.fill();
      // Right arrow
      ctx.beginPath();
      ctx.moveTo(arrowMidX + 6,  arrowCy);
      ctx.lineTo(arrowMidX + 12, arrowCy - 5);
      ctx.lineTo(arrowMidX + 12, arrowCy + 5);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case "mystery": {
      // Mario-style ? block
      const isHit = platform.hit;

      // Block body
      ctx.fillStyle = isHit ? "#8D6E63" : "#FFC107";
      fillRoundRect(ctx, screenX, y, width, height, CORNER_R);

      // Darker bottom edge
      ctx.fillStyle = isHit ? "#6D4C41" : "#FF8F00";
      fillRoundRect(ctx, screenX, y + height - 5, width, 5, CORNER_R);

      // Highlight top edge
      ctx.fillStyle = isHit ? "#A1887F" : "#FFE082";
      ctx.fillRect(screenX + 2, y + 1, width - 4, 3);

      // Border/outline
      ctx.strokeStyle = isHit ? "#5D4037" : "#E65100";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(screenX + 1, y + 1, width - 2, height - 2);
      ctx.stroke();

      if (!isHit) {
        // Question mark
        ctx.fillStyle = "#FFFFFF";
        ctx.font = `bold ${Math.min(height - 8, 20)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("?", screenX + width / 2, y + height / 2);
        // Question mark shadow
        ctx.fillStyle = "#E65100";
        ctx.fillText("?", screenX + width / 2 + 1, y + height / 2 + 1);
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText("?", screenX + width / 2, y + height / 2);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";

        // Subtle shine
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.fillRect(screenX + 3, y + 3, width * 0.3, height * 0.3);
      }
      break;
    }

    default: {
      // Normal — warm brown wood body
      ctx.fillStyle = COLORS.platform;
      fillRoundRect(ctx, screenX, y, width, height, CORNER_R);

      // Darker bottom edge
      ctx.fillStyle = COLORS.platformDark;
      fillRoundRect(ctx, screenX, y + height - 5, width, 5, CORNER_R);

      // Grass top — slightly overhanging for organic feel (+2 each side)
      ctx.fillStyle = COLORS.platformTop;
      ctx.fillRect(screenX - 2, y, width + 4, GRASS_H);

      // Grass highlight
      ctx.fillStyle = COLORS.platformTopHighlight;
      ctx.fillRect(screenX - 2, y, width + 4, 3);

      // Grass blade details
      ctx.fillStyle = "#388E3C";
      const bSpacing = 10;
      for (let bx = screenX; bx < screenX + width; bx += bSpacing) {
        ctx.beginPath();
        ctx.moveTo(bx,     y);
        ctx.lineTo(bx + 2, y - 4);
        ctx.lineTo(bx + 5, y);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
  }
}

// ─── Player ───────────────────────────────────────────────────────────────────

export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  camera: Camera,
  sprites?: SpriteAtlas,
  time: number = 0
): void {
  if (sprites?.loaded) {
    drawPlayerSprites(ctx, player, camera, sprites, time);
  } else {
    drawPlayerProcedural(ctx, player, camera);
  }
}

function drawPlayerSprites(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  camera: Camera,
  sprites: SpriteAtlas,
  time: number
): void {
  const screenX = player.x - camera.x;
  const screenY = player.y;
  const { facing, vx, vy, onGround } = player;

  // Pick the right sprite frame
  let sprite: HTMLImageElement;
  if (!onGround) {
    sprite = sprites.playerJump;
  } else if (Math.abs(vx) > 10) {
    // Walk animation alternates at ~6 fps
    const frame = Math.floor(time * 6) % 2;
    sprite = frame === 0 ? sprites.playerWalkA : sprites.playerWalkB;
  } else {
    sprite = sprites.playerIdle;
  }

  // Draw slightly larger than hitbox for visual appeal
  const drawW = 50;
  const drawH = 55;
  const drawX = screenX - 10;
  const drawY = screenY - 10;

  ctx.save();
  if (facing === -1) {
    // Flip horizontally
    ctx.scale(-1, 1);
    ctx.drawImage(sprite, -(drawX + drawW), drawY, drawW, drawH);
  } else {
    ctx.drawImage(sprite, drawX, drawY, drawW, drawH);
  }
  ctx.restore();
}

function drawPlayerProcedural(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  camera: Camera
): void {
  const screenX = player.x - camera.x;
  const screenY = player.y;
  const { facing, vy, onGround } = player;

  const bodyX = screenX;
  const bodyY = screenY;
  const bodyW = PLAYER_WIDTH;
  const bodyH = PLAYER_HEIGHT;

  // Vertical squish when falling
  const isFalling = vy > 50 && !onGround;
  const isJumping = vy < -50;
  const scaleY = isFalling ? 0.9 : 1;
  const scaleX = isFalling ? 1.1 : 1;
  const squishOffX = bodyW * (1 - scaleX) / 2;
  const squishOffY = bodyH * (1 - scaleY);

  // ── Body (red torso) ──────────────────────────────────────────────────────
  const torsoX = bodyX + squishOffX;
  const torsoY = bodyY + bodyH * 0.38 + squishOffY;
  const torsoW = bodyW * scaleX;
  const torsoH = bodyH * 0.62 * scaleY;

  ctx.fillStyle = COLORS.player;
  fillRoundRect(ctx, torsoX, torsoY, torsoW, torsoH, 4);

  // Torso shading (right side slightly darker)
  const torsoGrad = ctx.createLinearGradient(torsoX, 0, torsoX + torsoW, 0);
  torsoGrad.addColorStop(0, "rgba(255,255,255,0.1)");
  torsoGrad.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = torsoGrad;
  fillRoundRect(ctx, torsoX, torsoY, torsoW, torsoH, 4);

  // ── Head ──────────────────────────────────────────────────────────────────
  const headCx = bodyX + bodyW / 2;
  const headCy = bodyY + bodyH * 0.25;
  const headR = bodyW * 0.52;

  ctx.fillStyle = COLORS.playerSkin;
  ctx.beginPath();
  ctx.arc(headCx, headCy, headR, 0, Math.PI * 2);
  ctx.fill();

  // Head shading
  const headGrad = ctx.createRadialGradient(headCx - 3, headCy - 3, 2, headCx, headCy, headR);
  headGrad.addColorStop(0, "rgba(255,255,255,0.2)");
  headGrad.addColorStop(1, "rgba(0,0,0,0.08)");
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.arc(headCx, headCy, headR, 0, Math.PI * 2);
  ctx.fill();

  // ── Cap ───────────────────────────────────────────────────────────────────
  ctx.fillStyle = COLORS.playerDark;
  // Brim: flat rectangle over top of head
  const brimY = headCy - headR * 0.2;
  ctx.fillRect(headCx - headR * 1.15, brimY - 5, headR * 2.3, 5);
  // Cap dome: arc
  ctx.beginPath();
  ctx.arc(headCx, headCy - headR * 0.1, headR * 0.95, Math.PI, 0);
  ctx.fill();

  // ── Eyes ──────────────────────────────────────────────────────────────────
  const eyeX = facing === 1
    ? headCx + headR * 0.25
    : headCx - headR * 0.25;
  const eyeY = headCy + headR * 0.08;
  const eyeR = 4;

  ctx.fillStyle = COLORS.playerEyes;
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2);
  ctx.fill();

  const pupilX = eyeX + (facing === 1 ? 1.5 : -1.5);
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.arc(pupilX, eyeY + 1, 2, 0, Math.PI * 2);
  ctx.fill();

  // ── Arms ──────────────────────────────────────────────────────────────────
  const armY = torsoY + torsoH * 0.15;
  const armW = 5;
  const armH = torsoH * 0.45;

  if (isJumping) {
    // Arms up
    ctx.fillStyle = COLORS.playerSkin;
    // Left arm (angled up)
    ctx.save();
    ctx.translate(torsoX - 2, armY);
    ctx.rotate(-0.5);
    fillRoundRect(ctx, -armW, -armH, armW, armH, 2);
    ctx.restore();
    // Right arm (angled up)
    ctx.save();
    ctx.translate(torsoX + torsoW + 2, armY);
    ctx.rotate(0.5);
    fillRoundRect(ctx, 0, -armH, armW, armH, 2);
    ctx.restore();
  } else {
    // Arms at sides
    ctx.fillStyle = COLORS.playerSkin;
    fillRoundRect(ctx, torsoX - armW, armY, armW, armH, 2);
    fillRoundRect(ctx, torsoX + torsoW, armY, armW, armH, 2);
  }

  // ── Feet ──────────────────────────────────────────────────────────────────
  const footW = torsoW * 0.42;
  const footH = 6;
  const footY = torsoY + torsoH - 2;

  ctx.fillStyle = "#4E342E"; // dark brown shoes
  // Left foot
  fillRoundRect(ctx, torsoX, footY, footW, footH, 2);
  // Right foot
  fillRoundRect(ctx, torsoX + torsoW - footW, footY, footW, footH, 2);
}

// ─── Enemy ───────────────────────────────────────────────────────────────────

export function drawEnemy(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  worldX: number,
  camera: Camera,
  time: number = 0,
  sprites?: SpriteAtlas
): void {
  if (!enemy.alive) return;

  const screenX = worldX - camera.x;
  const screenY = enemy.type === "flyer"
    ? enemy.y + Math.sin(time * 2 + worldX * 0.01) * 15
    : enemy.y;
  const SIZE = 30;

  if (screenX + SIZE < 0 || screenX > CANVAS_WIDTH) return;

  if (sprites?.loaded) {
    drawEnemySprites(ctx, enemy, screenX, screenY, sprites, time);
  } else {
    drawEnemyProcedural(ctx, enemy, screenX, screenY, time);
  }
}

function drawEnemySprites(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  screenX: number,
  screenY: number,
  sprites: SpriteAtlas,
  time: number
): void {
  const DRAW_SIZE = 40; // Slightly larger than hitbox for visual appeal

  switch (enemy.type) {
    case "walker": {
      // Alternate walk frames at ~4 fps
      const frame = Math.floor(time * 4) % 2;
      const sprite = frame === 0 ? sprites.ladybugWalkA : sprites.ladybugWalkB;
      ctx.save();
      if (enemy.direction === -1) {
        ctx.scale(-1, 1);
        ctx.drawImage(sprite, -(screenX + DRAW_SIZE), screenY - 5, DRAW_SIZE, DRAW_SIZE);
      } else {
        ctx.drawImage(sprite, screenX - 5, screenY - 5, DRAW_SIZE, DRAW_SIZE);
      }
      ctx.restore();
      break;
    }

    case "flyer": {
      // Alternate fly frames at ~8 fps for wing flapping
      const frame = Math.floor(time * 8) % 2;
      const sprite = frame === 0 ? sprites.flyA : sprites.flyB;
      ctx.save();
      if (enemy.direction === -1) {
        ctx.scale(-1, 1);
        ctx.drawImage(sprite, -(screenX + DRAW_SIZE), screenY - 5, DRAW_SIZE, DRAW_SIZE);
      } else {
        ctx.drawImage(sprite, screenX - 5, screenY - 5, DRAW_SIZE, DRAW_SIZE);
      }
      ctx.restore();
      break;
    }

    case "shooter": {
      // Frog — stationary
      ctx.drawImage(sprites.frogIdle, screenX - 5, screenY - 5, DRAW_SIZE, DRAW_SIZE);
      break;
    }
  }
}

function drawEnemyProcedural(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  screenX: number,
  screenY: number,
  time: number
): void {
  const SIZE = 30;

  switch (enemy.type) {
    case "walker": {
      const cx = screenX + SIZE / 2;
      const cy = screenY + SIZE / 2;

      // Body — rounded purple "goomba"
      ctx.fillStyle = COLORS.enemy;
      ctx.beginPath();
      ctx.arc(cx, cy, SIZE * 0.48, 0, Math.PI * 2);
      ctx.fill();

      // Body shading
      const bodyGrad = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, SIZE * 0.48);
      bodyGrad.addColorStop(0, "rgba(255,255,255,0.15)");
      bodyGrad.addColorStop(1, "rgba(0,0,0,0.2)");
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, SIZE * 0.48, 0, Math.PI * 2);
      ctx.fill();

      // Stubby feet (alternating based on time)
      const footPhase = Math.sin(time * 6) > 0;
      ctx.fillStyle = COLORS.enemyDark;
      const footY = screenY + SIZE - 4;
      const footH = 7;
      const footW = 9;
      // Left foot
      ctx.fillStyle = COLORS.enemyDark;
      fillRoundRect(
        ctx,
        screenX + 2,
        footPhase ? footY - 3 : footY,
        footW, footH, 2
      );
      // Right foot
      fillRoundRect(
        ctx,
        screenX + SIZE - footW - 2,
        footPhase ? footY : footY - 3,
        footW, footH, 2
      );

      // Eyes — angry whites
      const eyeY = screenY + SIZE * 0.28;
      const eyeSpacingX = SIZE * 0.22;
      // Left eye
      ctx.fillStyle = COLORS.enemyEyes;
      ctx.beginPath();
      ctx.arc(cx - eyeSpacingX, eyeY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(cx - eyeSpacingX + 1, eyeY + 1, 2.5, 0, Math.PI * 2);
      ctx.fill();
      // Right eye
      ctx.fillStyle = COLORS.enemyEyes;
      ctx.beginPath();
      ctx.arc(cx + eyeSpacingX, eyeY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(cx + eyeSpacingX - 1, eyeY + 1, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Angry brows
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - eyeSpacingX - 5, eyeY - 6);
      ctx.lineTo(cx - eyeSpacingX + 4, eyeY - 3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + eyeSpacingX + 5, eyeY - 6);
      ctx.lineTo(cx + eyeSpacingX - 4, eyeY - 3);
      ctx.stroke();
      break;
    }

    case "flyer": {
      const cx = screenX + SIZE / 2;
      const cy = screenY + SIZE / 2;
      // Flapping wing phase (alternates up/down)
      const wingUp = Math.sin(time * 8) > 0;

      // Wings (flap)
      ctx.fillStyle = "#CE93D8"; // lighter purple wing
      const wingSpan = SIZE * 0.9;
      const wingH = SIZE * 0.55;
      const wingTopY = wingUp ? cy - wingH : cy - wingH * 0.4;
      const wingBotY = wingUp ? cy + wingH * 0.2 : cy + wingH * 0.7;

      // Left wing
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy);
      ctx.lineTo(cx - 4 - wingSpan, wingTopY);
      ctx.lineTo(cx - 4 - wingSpan, wingBotY);
      ctx.closePath();
      ctx.fill();
      // Right wing
      ctx.beginPath();
      ctx.moveTo(cx + 4, cy);
      ctx.lineTo(cx + 4 + wingSpan, wingTopY);
      ctx.lineTo(cx + 4 + wingSpan, wingBotY);
      ctx.closePath();
      ctx.fill();

      // Wing vein lines
      ctx.strokeStyle = COLORS.enemyDark;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy);
      ctx.lineTo(cx - 4 - wingSpan * 0.7, wingTopY + (wingBotY - wingTopY) * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 4, cy);
      ctx.lineTo(cx + 4 + wingSpan * 0.7, wingTopY + (wingBotY - wingTopY) * 0.3);
      ctx.stroke();

      // Body (bat-like oval)
      ctx.fillStyle = COLORS.enemy;
      ctx.beginPath();
      ctx.ellipse(cx, cy, SIZE * 0.32, SIZE * 0.44, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body shading
      const flyGrad = ctx.createRadialGradient(cx - 3, cy - 3, 2, cx, cy, SIZE * 0.44);
      flyGrad.addColorStop(0, "rgba(255,255,255,0.18)");
      flyGrad.addColorStop(1, "rgba(0,0,0,0.2)");
      ctx.fillStyle = flyGrad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, SIZE * 0.32, SIZE * 0.44, 0, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      ctx.fillStyle = COLORS.enemyEyes;
      ctx.beginPath();
      ctx.arc(cx - 5, cy - 4, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + 5, cy - 4, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FF0000"; // red eyes for bat
      ctx.beginPath();
      ctx.arc(cx - 5, cy - 4, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + 5, cy - 4, 2, 0, Math.PI * 2);
      ctx.fill();

      // Tiny fangs
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy + 6);
      ctx.lineTo(cx - 2, cy + 11);
      ctx.lineTo(cx,     cy + 6);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx,     cy + 6);
      ctx.lineTo(cx + 2, cy + 11);
      ctx.lineTo(cx + 4, cy + 6);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case "shooter": {
      const cx = screenX + SIZE / 2;

      // Base (dark metallic)
      const baseGrad = ctx.createLinearGradient(screenX + 4, 0, screenX + SIZE - 4, 0);
      baseGrad.addColorStop(0, "#546E7A");
      baseGrad.addColorStop(0.5, "#78909C");
      baseGrad.addColorStop(1, "#455A64");
      ctx.fillStyle = baseGrad;
      fillRoundRect(ctx, screenX + 4, screenY + SIZE * 0.45, SIZE - 8, SIZE * 0.55, 3);

      // Turret head (metallic sphere)
      const headGrad2 = ctx.createRadialGradient(cx - 3, screenY + SIZE * 0.35, 2, cx, screenY + SIZE * 0.4, SIZE * 0.36);
      headGrad2.addColorStop(0, "#90A4AE");
      headGrad2.addColorStop(1, "#37474F");
      ctx.fillStyle = headGrad2;
      ctx.beginPath();
      ctx.arc(cx, screenY + SIZE * 0.4, SIZE * 0.36, 0, Math.PI * 2);
      ctx.fill();

      // Cannon barrel
      const barrelGrad = ctx.createLinearGradient(0, screenY + SIZE * 0.32, 0, screenY + SIZE * 0.48);
      barrelGrad.addColorStop(0, "#546E7A");
      barrelGrad.addColorStop(1, "#263238");
      ctx.fillStyle = barrelGrad;
      // Barrel extends left (toward player typically)
      fillRoundRect(ctx, screenX - 10, screenY + SIZE * 0.32, 18, 7, 2);

      // Barrel ring
      ctx.fillStyle = "#37474F";
      fillRoundRect(ctx, screenX + 2, screenY + SIZE * 0.31, 5, 9, 1);

      // Warning light (blinking red)
      const blinkOn = Math.sin(time * 5) > 0;
      ctx.fillStyle = blinkOn ? "#F44336" : "#B71C1C";
      ctx.beginPath();
      ctx.arc(cx + SIZE * 0.2, screenY + SIZE * 0.3, 4, 0, Math.PI * 2);
      ctx.fill();
      if (blinkOn) {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = "#F44336";
        ctx.beginPath();
        ctx.arc(cx + SIZE * 0.2, screenY + SIZE * 0.3, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
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
  time: number,
  sprites?: SpriteAtlas
): void {
  const screenX = coinWorldX - camera.x;

  if (screenX + 20 < 0 || screenX - 20 > CANVAS_WIDTH) return;

  if (sprites?.loaded) {
    drawCoinSprites(ctx, screenX, coinY, time, sprites);
  } else {
    drawCoinProcedural(ctx, screenX, coinY, time);
  }
}

function drawCoinSprites(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  coinY: number,
  time: number,
  sprites: SpriteAtlas
): void {
  const DRAW_SIZE = 28;
  // Bobbing: ±4 px at ~1 Hz
  const bobY = coinY + Math.sin(time * 2 * Math.PI) * 4;

  // Alternate front/side views for spinning effect
  const spinFrame = Math.floor(time * 6) % 2;
  const sprite = spinFrame === 0 ? sprites.coinGold : sprites.coinGoldSide;

  ctx.drawImage(
    sprite,
    screenX - DRAW_SIZE / 2,
    bobY - DRAW_SIZE / 2,
    DRAW_SIZE,
    DRAW_SIZE
  );
}

function drawCoinProcedural(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  coinY: number,
  time: number
): void {
  const RADIUS = 10;
  // Bobbing: ±4 px at ~1 Hz
  const bobY = coinY + Math.sin(time * 2 * Math.PI) * 4;

  // 3D spin: vary apparent x-radius using cosine
  const spinAngle = time * 3;
  const xRadius = Math.abs(Math.cos(spinAngle)) * RADIUS;

  // Glow effect behind coin
  const glowSize = RADIUS * 2.2 + Math.sin(time * 4) * 2;
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = COLORS.coin;
  ctx.beginPath();
  ctx.arc(screenX, bobY, glowSize, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath();
  ctx.ellipse(screenX, bobY + RADIUS + 3, RADIUS * 0.7, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Coin body (spinning oval)
  if (xRadius > 0.5) {
    // Gradient changes with spin direction
    const coinGrad = ctx.createLinearGradient(screenX - xRadius, 0, screenX + xRadius, 0);
    const isFlipped = Math.cos(spinAngle) < 0;
    if (isFlipped) {
      coinGrad.addColorStop(0, COLORS.coinHighlight);
      coinGrad.addColorStop(0.5, COLORS.coin);
      coinGrad.addColorStop(1, COLORS.coinOutline);
    } else {
      coinGrad.addColorStop(0, COLORS.coinOutline);
      coinGrad.addColorStop(0.5, COLORS.coin);
      coinGrad.addColorStop(1, COLORS.coinHighlight);
    }
    ctx.fillStyle = coinGrad;
  } else {
    ctx.fillStyle = COLORS.coinHighlight;
  }
  ctx.beginPath();
  ctx.ellipse(screenX, bobY, xRadius, RADIUS, 0, 0, Math.PI * 2);
  ctx.fill();

  // Outline ring
  ctx.strokeStyle = COLORS.coinOutline;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(screenX, bobY, xRadius, RADIUS, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Star sparkle particles (4 tiny stars around the coin)
  if (xRadius > RADIUS * 0.6) {
    ctx.fillStyle = "#FFE082";
    const sparkAngles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
    const sparkDist = RADIUS * 1.7 + Math.sin(time * 5) * 2;
    for (const sa of sparkAngles) {
      const rotSa = sa + time * 2;
      const spx = screenX + Math.cos(rotSa) * sparkDist;
      const spy = bobY + Math.sin(rotSa) * sparkDist * 0.6;
      const ss = 2 + Math.sin(time * 4 + sa) * 1;
      ctx.globalAlpha = 0.7 + Math.sin(time * 4 + sa) * 0.3;
      ctx.beginPath();
      ctx.arc(spx, spy, ss, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// ─── Chunks ───────────────────────────────────────────────────────────────────

export function drawChunks(
  ctx: CanvasRenderingContext2D,
  chunks: LevelChunk[],
  camera: Camera,
  time: number,
  sprites?: SpriteAtlas
): void {
  for (const chunk of chunks) {
    const chunkScreenX = chunk.chunk_index * CHUNK_WIDTH - camera.x;

    // Skip entire chunk if offscreen (rough cull)
    if (chunkScreenX + CHUNK_WIDTH < 0 || chunkScreenX > CANVAS_WIDTH) continue;

    // Platforms
    for (const platform of chunk.platforms) {
      const worldX = platform.x + chunk.chunk_index * CHUNK_WIDTH;
      drawPlatform(ctx, platform, worldX, camera, sprites);
    }

    // Coins
    for (const coin of chunk.coins) {
      if (coin.collected) continue;
      const worldX = coin.x + chunk.chunk_index * CHUNK_WIDTH;
      drawCoin(ctx, worldX, coin.y, camera, time, sprites);
    }

    // Enemies
    for (const enemy of chunk.enemies) {
      if (!enemy.alive) continue;
      const worldX = enemy.x + chunk.chunk_index * CHUNK_WIDTH + (enemy.moveOffset ?? 0);
      drawEnemy(ctx, enemy, worldX, camera, time, sprites);
    }
  }
}
