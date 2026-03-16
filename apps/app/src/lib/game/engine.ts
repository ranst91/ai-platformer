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
} from "./constants";
import { updatePlayer } from "./physics";
import { checkEnemyCollision, checkCoinCollision, platformWorldX } from "./physics";
import { createCamera, updateCamera } from "./camera";
import type { Camera } from "./camera";
import { clearCanvas, drawBackground, drawGround, drawChunks, drawPlayer } from "./renderer";

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
    const { ctx, camera, state, time } = this;
    const { player, chunks, gamePhase, score, coins, lives, deaths } = state;

    clearCanvas(ctx);
    drawBackground(ctx, camera);
    drawGround(ctx, camera);
    drawChunks(ctx, chunks, camera, time);

    if (gamePhase === "playing" || gamePhase === "dead") {
      drawPlayer(ctx, player, camera);
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
    const { ctx } = this;
    const cx = CANVAS_WIDTH / 2;

    // Semi-transparent dark vignette
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Title
    ctx.textAlign = "center";
    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 56px sans-serif";
    ctx.fillText("INFINITE RUNNER", cx, CANVAS_HEIGHT / 2 - 40);

    // Subtitle
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "24px sans-serif";
    ctx.fillText("Press START", cx, CANVAS_HEIGHT / 2 + 20);

    ctx.textAlign = "left";
  }

  private drawDeadOverlay(): void {
    const { ctx } = this;
    const cx = CANVAS_WIDTH / 2;

    // Red tint
    ctx.fillStyle = "rgba(200, 0, 0, 0.35)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.textAlign = "center";
    ctx.fillStyle = "#FF3333";
    ctx.font = "bold 64px sans-serif";
    ctx.fillText("YOU DIED", cx, CANVAS_HEIGHT / 2 - 10);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "22px sans-serif";
    ctx.fillText("Respawning…", cx, CANVAS_HEIGHT / 2 + 40);

    ctx.textAlign = "left";
  }

  private drawGameOverOverlay(score: number, coins: number, deaths: number): void {
    const { ctx } = this;
    const cx = CANVAS_WIDTH / 2;

    // Dark overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.textAlign = "center";

    ctx.fillStyle = "#FF4444";
    ctx.font = "bold 72px sans-serif";
    ctx.fillText("GAME OVER", cx, CANVAS_HEIGHT / 2 - 70);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "28px sans-serif";
    ctx.fillText(`Score: ${score}`, cx, CANVAS_HEIGHT / 2);
    ctx.fillText(`Coins: ${coins}   Deaths: ${deaths}`, cx, CANVAS_HEIGHT / 2 + 44);

    ctx.fillStyle = "#FFD700";
    ctx.font = "20px sans-serif";
    ctx.fillText("Talk to the AI to play again", cx, CANVAS_HEIGHT / 2 + 96);

    ctx.textAlign = "left";
  }
}
