// apps/app/src/lib/game/engine.ts

import type { LevelChunk, GameState, PlayerState } from "./types";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  CHUNK_WIDTH,
  GROUND_Y,
  CHUNK_REQUEST_THRESHOLD,
  MIN_CHUNKS_AHEAD,
  CHUNK_CLEANUP_BEHIND,
} from "./constants";
import { updatePlayer } from "./physics";
import { checkEnemyCollision, checkCoinCollision, platformWorldX } from "./physics";
import { createCamera, updateCamera } from "./camera";
import type { Camera } from "./camera";
import { clearCanvas, drawBackground, drawGround, drawChunks, drawPlayer } from "./renderer";
import type { SpriteAtlas } from "./sprites";

// ─── Callback type ────────────────────────────────────────────────────────────

export type GameEventCallback = {
  onNeedChunks?: (playerX: number) => void;
  onPlayerDied?: (deaths: number) => void;
  onScoreUpdate?: (score: number, coins: number) => void;
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function initialPlayer(): PlayerState {
  return {
    x: 100,
    y: GROUND_Y - PLAYER_HEIGHT - 100,
    vx: 0,
    vy: 0,
    onGround: false,
    alive: true,
    facing: 1,
  };
}

function initialGameState(): GameState {
  return {
    player: initialPlayer(),
    cameraX: 0,
    chunks: [],
    score: 0,
    coins: 0,
    lives: 3,
    deaths: 0,
    gamePhase: "menu",
  };
}

// ─── GameEngine ───────────────────────────────────────────────────────────────

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: GameState;
  private camera: Camera;
  private keys: Set<string> = new Set();
  private callbacks: GameEventCallback = {};
  private rafId: number | null = null;
  private lastTime: number = 0;
  private time: number = 0; // running clock for animations
  private requestingChunks: boolean = false;
  private lastScore: number = -1;
  private sprites: SpriteAtlas | undefined = undefined;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2D context");
    this.ctx = ctx;
    this.state = initialGameState();
    this.camera = createCamera();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  setCallbacks(callbacks: GameEventCallback): void {
    this.callbacks = callbacks;
  }

  setSprites(sprites: SpriteAtlas): void {
    this.sprites = sprites;
  }

  start(): void {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }

  startPlaying(): void {
    this.state = initialGameState();
    this.state.gamePhase = "playing";
    this.camera = createCamera();
    this.requestingChunks = false;
    this.lastScore = -1;
    this.time = 0;
  }

  /**
   * Merge new chunks from the agent into the current chunk list.
   * Preserves runtime state (alive, collected, direction, moveOffset) for
   * entities that already exist in the current list.
   */
  updateLevelChunks(chunks: LevelChunk[]): void {
    const existingMap = new Map<number, LevelChunk>();
    for (const chunk of this.state.chunks) {
      existingMap.set(chunk.chunk_index, chunk);
    }

    const merged: LevelChunk[] = chunks.map((incoming) => {
      const existing = existingMap.get(incoming.chunk_index);
      if (!existing) return incoming;

      // Preserve runtime state for enemies
      const enemies = incoming.enemies.map((enemy, i) => {
        const old = existing.enemies[i];
        if (!old) return enemy;
        return {
          ...enemy,
          alive: old.alive,
          direction: old.direction,
          moveOffset: old.moveOffset,
        };
      });

      // Preserve runtime state for coins
      const coins = incoming.coins.map((coin, i) => {
        const old = existing.coins[i];
        if (!old) return coin;
        return { ...coin, collected: old.collected };
      });

      // Preserve runtime state for platforms
      const platforms = incoming.platforms.map((platform, i) => {
        const old = existing.platforms[i];
        if (!old) return platform;
        return {
          ...platform,
          crumbleTimer: old.crumbleTimer,
          moveOffset: old.moveOffset,
          moveDirection: old.moveDirection,
        };
      });

      return { ...incoming, enemies, coins, platforms };
    });

    this.state.chunks = merged;
    this.requestingChunks = false;
  }

  setLives(lives: number): void {
    this.state.lives = lives;
  }

  getState(): GameState {
    return this.state;
  }

  // ── Key handlers ─────────────────────────────────────────────────────────────

  private onKeyDown = (e: KeyboardEvent): void => {
    if (["ArrowUp", "ArrowDown", " "].includes(e.key)) {
      e.preventDefault();
    }
    this.keys.add(e.key);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key);
  };

  // ── Main loop ─────────────────────────────────────────────────────────────────

  private loop = (timestamp: number): void => {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 1 / 30);
    this.lastTime = timestamp;
    this.time += dt;

    if (this.state.gamePhase === "playing") {
      this.update(dt);
    }

    this.render();

    this.rafId = requestAnimationFrame(this.loop);
  };

  // ── Update ────────────────────────────────────────────────────────────────────

  private update(dt: number): void {
    if (!this.state.player.alive) return;
    const { player, chunks } = this.state;

    // 1. Gather nearby platforms
    const nearbyPlatforms: Array<{ platform: import("./types").Platform; chunkIndex: number }> = [];
    for (const chunk of chunks) {
      for (const platform of chunk.platforms) {
        const wx = platformWorldX(platform, chunk.chunk_index);
        if (Math.abs(wx - player.x) < CANVAS_WIDTH) {
          nearbyPlatforms.push({ platform, chunkIndex: chunk.chunk_index });
        }
      }
    }

    // 2. Update player physics
    const { fellOff } = updatePlayer(player, this.keys, nearbyPlatforms, dt);

    // 3. Ground collision
    if (player.y + PLAYER_HEIGHT >= GROUND_Y) {
      player.y = GROUND_Y - PLAYER_HEIGHT;
      player.vy = 0;
      player.onGround = true;
    }

    // 4. Update camera
    updateCamera(this.camera, player.x, dt);
    this.state.cameraX = this.camera.x;

    // 5. Update enemies
    for (const chunk of chunks) {
      for (const enemy of chunk.enemies) {
        if (!enemy.alive) continue;
        const BASE_SPEED = enemy.type === "flyer" ? 60 : 80;

        if (enemy.type === "walker" || enemy.type === "flyer") {
          // Initialize direction if missing
          if (!enemy.direction) enemy.direction = 1;
          enemy.moveOffset = (enemy.moveOffset ?? 0) + enemy.direction * BASE_SPEED * dt;

          // Reverse at ±60 px range
          const RANGE = 60;
          if ((enemy.moveOffset ?? 0) > RANGE) {
            enemy.moveOffset = RANGE;
            enemy.direction = -1;
          } else if ((enemy.moveOffset ?? 0) < -RANGE) {
            enemy.moveOffset = -RANGE;
            enemy.direction = 1;
          }
        }
        // Flyers also bob vertically — handled in renderer via time
      }
    }

    // 6. Enemy collisions
    for (const chunk of chunks) {
      for (const enemy of chunk.enemies) {
        if (!enemy.alive) continue;

        const resolvedEnemy = {
          ...enemy,
          x: enemy.x + chunk.chunk_index * CHUNK_WIDTH + (enemy.moveOffset ?? 0),
        };

        const result = checkEnemyCollision(player, resolvedEnemy);
        if (result === "kill") {
          enemy.alive = false;
          // Bounce the player up slightly
          player.vy = -300;
          // Award 2 bonus coins
          this.state.coins += 2;
        } else if (result === "hurt") {
          this.playerDied();
          return; // Stop update after death
        }
      }
    }

    // 7. Coin collisions
    for (const chunk of chunks) {
      for (const coin of chunk.coins) {
        if (coin.collected) continue;
        const worldX = coin.x + chunk.chunk_index * CHUNK_WIDTH;
        if (checkCoinCollision(player, worldX, coin.y)) {
          coin.collected = true;
          this.state.coins += 1;
        }
      }
    }

    // 7b. Mystery block hit detection — player hits from below (head bonk)
    if (player.vy < 0) {
      for (const chunk of chunks) {
        for (const platform of chunk.platforms) {
          if (platform.type !== "mystery" || platform.hit) continue;
          const wx = platformWorldX(platform, chunk.chunk_index);
          const playerTop = player.y;
          const platBottom = platform.y + platform.height;
          // Player's head is rising into the bottom of the platform
          if (
            playerTop <= platBottom &&
            playerTop >= platBottom - 12 &&
            player.x + PLAYER_WIDTH > wx &&
            player.x < wx + platform.width
          ) {
            platform.hit = true;
            player.vy = 50; // Stop upward movement (bonk)
            // Spawn 3 coins above the block
            this.state.coins += 3;
          }
        }
      }
    }

    // 8. Score update
    const distanceScore = Math.floor(Math.max(player.x - 100, 0) / 10);
    const newScore = distanceScore + this.state.coins * 50;
    if (newScore !== this.lastScore) {
      this.state.score = newScore;
      this.lastScore = newScore;
      this.callbacks.onScoreUpdate?.(newScore, this.state.coins);
    }

    // 9. Fell off screen
    if (fellOff) {
      this.playerDied();
      return;
    }

    // 10. Chunk generation check
    this.checkChunkGeneration();

    // 11. Prune very old chunks far behind the player (keeps memory bounded,
    //     but with a generous buffer so removal is never visible)
    const playerChunkIdx = Math.floor(player.x / CHUNK_WIDTH);
    this.state.chunks = this.state.chunks.filter(
      (c) => c.chunk_index >= playerChunkIdx - CHUNK_CLEANUP_BEHIND
    );
  }

  // ── Player death ──────────────────────────────────────────────────────────────

  private playerDied(): void {
    const { player } = this.state;
    player.alive = false;
    this.state.deaths += 1;
    this.state.lives -= 1;

    this.callbacks.onPlayerDied?.(this.state.deaths);

    if (this.state.lives <= 0) {
      this.state.gamePhase = "game_over";
    } else {
      this.state.gamePhase = "dead";
      // Auto-respawn after a short delay is handled externally via UI;
      // we also provide a respawn() method below.
    }
  }

  respawn(): void {
    const { player } = this.state;
    player.x = Math.max(player.x - 200, 100);
    player.y = 200;
    player.vx = 0;
    player.vy = 0;
    player.alive = true;
    this.state.gamePhase = "playing";
  }

  // ── Chunk generation ──────────────────────────────────────────────────────────

  private checkChunkGeneration(): void {
    if (this.requestingChunks) return;

    const { player, chunks } = this.state;

    // Find the furthest chunk end
    let lastChunkEnd = 0;
    for (const chunk of chunks) {
      const end = (chunk.chunk_index + 1) * CHUNK_WIDTH;
      if (end > lastChunkEnd) lastChunkEnd = end;
    }

    // Count how many chunks are ahead of the player
    const playerChunkIndex = Math.floor(player.x / CHUNK_WIDTH);
    let chunksAhead = 0;
    for (const chunk of chunks) {
      if (chunk.chunk_index > playerChunkIndex) chunksAhead++;
    }

    const nearEnd = player.x + CHUNK_REQUEST_THRESHOLD >= lastChunkEnd;
    const notEnoughAhead = chunksAhead < MIN_CHUNKS_AHEAD + 1;

    if (nearEnd || notEnoughAhead) {
      this.requestingChunks = true;
      this.callbacks.onNeedChunks?.(player.x);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  private render(): void {
    const { ctx, camera, state, time, sprites } = this;
    const { player, chunks, gamePhase, score, coins, lives, deaths } = state;

    clearCanvas(ctx);
    drawBackground(ctx, camera, sprites);
    drawGround(ctx, camera, sprites);
    drawChunks(ctx, chunks, camera, time, sprites);

    if (gamePhase === "playing" || gamePhase === "dead") {
      drawPlayer(ctx, player, camera, sprites, time);
    }

    // ── Overlays ────────────────────────────────────────────────────────────

    switch (gamePhase) {
      case "menu":
        this.drawMenuOverlay();
        break;
      case "dead":
        this.drawDeadOverlay();
        break;
      case "game_over":
        this.drawGameOverOverlay(score, coins, deaths);
        break;
      default:
        break;
    }
  }

  // ── Overlay helpers ───────────────────────────────────────────────────────────

  private drawMenuOverlay(): void {
    const { ctx, time } = this;
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;

    // Gradient dark overlay
    const overlayGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    overlayGrad.addColorStop(0, "rgba(0, 0, 60, 0.55)");
    overlayGrad.addColorStop(1, "rgba(0, 0, 0, 0.7)");
    ctx.fillStyle = overlayGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Floating decoration coins
    ctx.save();
    const floatCoins = [
      { ox: -160, oy: -90 },
      { ox:  160, oy: -90 },
      { ox: -220, oy:  20 },
      { ox:  220, oy:  20 },
    ];
    for (const fc of floatCoins) {
      const fcx = cx + fc.ox;
      const fcy = cy + fc.oy + Math.sin(time * 2 + fc.ox) * 6;
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = "#FFC107";
      ctx.beginPath();
      ctx.arc(fcx, fcy, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FFE082";
      ctx.beginPath();
      ctx.arc(fcx - 3, fcy - 3, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // Title — drop shadow + outline
    ctx.textAlign = "center";
    ctx.font = "bold 58px sans-serif";

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillText("INFINITE RUNNER", cx + 4, cy - 42 + 4);

    // Outline
    ctx.strokeStyle = "#B8860B";
    ctx.lineWidth = 4;
    ctx.strokeText("INFINITE RUNNER", cx, cy - 42);

    // Fill
    ctx.fillStyle = "#FFD700";
    ctx.fillText("INFINITE RUNNER", cx, cy - 42);

    // Subtitle with pulsing opacity
    const pulse = 0.6 + Math.sin(time * 3) * 0.4;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "26px sans-serif";
    ctx.fillText("Press START to play", cx, cy + 20);
    ctx.globalAlpha = 1;

    // Decorative star row
    ctx.fillStyle = "#FFD700";
    ctx.font = "18px sans-serif";
    ctx.fillText("★  ★  ★  ★  ★", cx, cy + 56);

    ctx.textAlign = "left";
  }

  private drawDeadOverlay(): void {
    const { ctx, time } = this;
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;

    // Radial red vignette (darker at edges)
    const radGrad = ctx.createRadialGradient(cx, cy, 60, cx, cy, CANVAS_WIDTH * 0.75);
    radGrad.addColorStop(0, "rgba(180, 0, 0, 0.0)");
    radGrad.addColorStop(0.5, "rgba(180, 0, 0, 0.3)");
    radGrad.addColorStop(1, "rgba(120, 0, 0, 0.72)");
    ctx.fillStyle = radGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // "YOU DIED" — pulsing with heavy drop shadow
    const pulse = 0.85 + Math.sin(time * 4) * 0.15;
    const fontSize = Math.round(64 * pulse);
    ctx.textAlign = "center";
    ctx.font = `bold ${fontSize}px sans-serif`;

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillText("YOU DIED", cx + 5, cy - 8 + 5);

    // Outline
    ctx.strokeStyle = "#7F0000";
    ctx.lineWidth = 5;
    ctx.strokeText("YOU DIED", cx, cy - 8);

    // Fill
    ctx.fillStyle = "#FF3333";
    ctx.fillText("YOU DIED", cx, cy - 8);

    // Respawning text
    const subPulse = 0.5 + Math.sin(time * 2.5) * 0.5;
    ctx.globalAlpha = subPulse;
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "22px sans-serif";
    ctx.fillText("Respawning…", cx, cy + 44);
    ctx.globalAlpha = 1;

    ctx.textAlign = "left";
  }

  private drawGameOverOverlay(score: number, coins: number, deaths: number): void {
    const { ctx, time } = this;
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;

    // Dark gradient overlay
    const overlayGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    overlayGrad.addColorStop(0, "rgba(20, 0, 0, 0.85)");
    overlayGrad.addColorStop(1, "rgba(0, 0, 0, 0.92)");
    ctx.fillStyle = overlayGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.textAlign = "center";

    // "GAME OVER" with glow
    ctx.font = "bold 72px sans-serif";

    // Glow layers
    ctx.globalAlpha = 0.2 + Math.sin(time * 2) * 0.08;
    ctx.fillStyle = "#FF4444";
    for (const blur of [18, 12, 6]) {
      ctx.save();
      ctx.filter = `blur(${blur}px)`;
      ctx.fillText("GAME OVER", cx, cy - 80);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.filter = "none";

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillText("GAME OVER", cx + 4, cy - 80 + 4);

    // Outline
    ctx.strokeStyle = "#7F0000";
    ctx.lineWidth = 5;
    ctx.strokeText("GAME OVER", cx, cy - 80);

    // Fill
    ctx.fillStyle = "#FF4444";
    ctx.fillText("GAME OVER", cx, cy - 80);

    // Stats panel background
    const panelW = 320;
    const panelH = 110;
    const panelX = cx - panelW / 2;
    const panelY = cy - 30;
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.strokeStyle = "rgba(255, 68, 68, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 10);
    ctx.fill();
    ctx.stroke();

    // Stats
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 26px sans-serif";
    ctx.fillText(`Score: ${score}`, cx, panelY + 36);
    ctx.font = "22px sans-serif";
    ctx.fillStyle = "#FFD700";
    ctx.fillText(`Coins: ${coins}`, cx - 60, panelY + 72);
    ctx.fillStyle = "#FF8A80";
    ctx.fillText(`Deaths: ${deaths}`, cx + 60, panelY + 72);

    // "Press START to play again" with pulsing animation
    const pulse = 0.55 + Math.sin(time * 3) * 0.45;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = "#FFD700";
    ctx.font = "20px sans-serif";
    ctx.fillText("Talk to the AI to play again", cx, cy + 108);
    ctx.globalAlpha = 1;

    ctx.textAlign = "left";
  }
}
