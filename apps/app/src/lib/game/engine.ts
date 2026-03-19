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
import { clearCanvas, drawBackground, drawGround, drawChunks, drawPlayer, drawHUD } from "./renderer";
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

/** Hardcoded starter chunks so the game is playable instantly while the AI loads. */
function starterChunks(): LevelChunk[] {
  return [
    {
      chunk_index: 0,
      platforms: [
        { x: 0, y: 610, width: 300, height: 30, type: "normal" },
        { x: 400, y: 570, width: 220, height: 30, type: "normal" },
        { x: 720, y: 530, width: 250, height: 30, type: "normal" },
        { x: 250, y: 500, width: 55, height: 30, type: "mystery" },
      ],
      enemies: [
        { x: 250, y: 580, type: "walker", alive: true, direction: 1, moveOffset: 0 },
        { x: 500, y: 540, type: "walker", alive: true, direction: -1, moveOffset: 0 },
        { x: 800, y: 480, type: "flyer", alive: true, direction: 1, moveOffset: 0 },
      ],
      coins: [
        { x: 100, y: 570, collected: false },
        { x: 180, y: 570, collected: false },
        { x: 460, y: 530, collected: false },
        { x: 540, y: 530, collected: false },
        { x: 790, y: 490, collected: false },
        { x: 278, y: 460, collected: false },
      ],
    },
    {
      chunk_index: 1,
      platforms: [
        { x: 50, y: 600, width: 250, height: 30, type: "normal" },
        { x: 400, y: 550, width: 180, height: 30, type: "bouncy" },
        { x: 650, y: 510, width: 300, height: 30, type: "normal" },
        { x: 500, y: 480, width: 55, height: 30, type: "mystery" },
      ],
      enemies: [
        { x: 130, y: 570, type: "walker", alive: true, direction: 1, moveOffset: 0 },
        { x: 750, y: 480, type: "walker", alive: true, direction: -1, moveOffset: 0 },
        { x: 450, y: 490, type: "flyer", alive: true, direction: 1, moveOffset: 0 },
      ],
      coins: [
        { x: 100, y: 560, collected: false },
        { x: 200, y: 560, collected: false },
        { x: 450, y: 510, collected: false },
        { x: 700, y: 470, collected: false },
        { x: 800, y: 470, collected: false },
        { x: 528, y: 445, collected: false },
      ],
    },
  ];
}

function initialGameState(): GameState {
  return {
    player: initialPlayer(),
    cameraX: 0,
    chunks: starterChunks(),
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
  private requestingChunksTime: number = 0; // when we started requesting
  private lastScore: number = -1;
  private sprites: SpriteAtlas | undefined = undefined;
  private difficulty: number = 0.4;
  private dmMessages: Array<{ text: string; from: "dm" | "you"; time: number }> = [];
  private dmMessage: string = "";
  private dmMessageTime: number = 0;
  private suggestions: Array<{ label: string; command: string }> = [];
  private pressedButtonIndex: number = -1;
  private pressedButtonTime: number = 0;

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

      if (!existing) {
        // NEW chunk — initialize runtime state for all entities
        return {
          ...incoming,
          enemies: (incoming.enemies || []).map((e) => ({
            ...e,
            alive: true,
            direction: 1,
            moveOffset: 0,
          })),
          coins: (incoming.coins || []).map((c) => ({
            ...c,
            collected: false,
          })),
          platforms: (incoming.platforms || []).map((p) => ({
            ...p,
            hit: false,
          })),
        };
      }

      // EXISTING chunk — preserve runtime state
      const enemies = incoming.enemies.map((enemy, i) => {
        const old = existing.enemies[i];
        if (!old) return { ...enemy, alive: true, direction: 1, moveOffset: 0 };
        return {
          ...enemy,
          alive: old.alive,
          direction: old.direction,
          moveOffset: old.moveOffset,
        };
      });

      const coins = incoming.coins.map((coin, i) => {
        const old = existing.coins[i];
        if (!old) return { ...coin, collected: false };
        return { ...coin, collected: old.collected };
      });

      const platforms = incoming.platforms.map((platform, i) => {
        const old = existing.platforms[i];
        if (!old) return { ...platform, hit: false };
        return {
          ...platform,
          crumbleTimer: old.crumbleTimer,
          moveOffset: old.moveOffset,
          moveDirection: old.moveDirection,
          hit: old.hit,
        };
      });

      return { ...incoming, enemies, coins, platforms };
    });

    // Keep existing chunks that the agent didn't send (e.g., starter chunks).
    // This prevents the wipe when AI responds with only its new chunks.
    const incomingIndices = new Set(chunks.map((c) => c.chunk_index));
    const kept = this.state.chunks.filter((c) => !incomingIndices.has(c.chunk_index));
    this.state.chunks = [...kept, ...merged].sort((a, b) => a.chunk_index - b.chunk_index);
    this.requestingChunks = false;
  }

  setLives(lives: number): void {
    this.state.lives = lives;
  }

  setDifficulty(d: number): void {
    this.difficulty = d;
  }

  setDMMessage(msg: string, from: "dm" | "you" = "dm"): void {
    this.dmMessage = msg;
    this.dmMessageTime = this.time;
    // Add to timeline, cap at 4 messages
    this.dmMessages.push({ text: msg, from, time: this.time });
    if (this.dmMessages.length > 4) this.dmMessages.shift();
  }

  setSuggestions(suggestions: Array<{ label: string; command: string }>): void {
    this.suggestions = suggestions;
  }

  /** Flash a button as "pressed" for visual feedback */
  pressButton(index: number): void {
    this.pressedButtonIndex = index;
    this.pressedButtonTime = this.time;
  }

  private _loading: boolean = false;
  setLoading(loading: boolean): void {
    this._loading = loading;
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

    // 3b. Crumbling platforms — collapse after player stands on them for ~1s
    if (player.onGround) {
      for (const chunk of chunks) {
        for (const plat of chunk.platforms) {
          if (plat.type !== "crumbling" || plat.crumbled) continue;
          const wx = platformWorldX(plat, chunk.chunk_index);
          const onThis = player.x + PLAYER_WIDTH > wx &&
                         player.x < wx + plat.width &&
                         Math.abs((player.y + PLAYER_HEIGHT) - plat.y) < 5;
          if (onThis) {
            plat.crumbleTimer = (plat.crumbleTimer ?? 0) + dt;
            if (plat.crumbleTimer > 0.8) {
              plat.crumbled = true;
              // Player falls through
              player.onGround = false;
            }
          }
        }
      }
    }

    // 4. Update camera
    updateCamera(this.camera, player.x, dt);
    this.state.cameraX = this.camera.x;

    // 5. Update enemies — walkers patrol within their host platform bounds
    for (const chunk of chunks) {
      for (const enemy of chunk.enemies) {
        if (!enemy.alive) continue;

        if (enemy.type === "walker") {
          const SPEED = 80;
          if (!enemy.direction) enemy.direction = 1;
          enemy.moveOffset = (enemy.moveOffset ?? 0) + enemy.direction * SPEED * dt;

          // Find the platform this walker sits on and clamp to its edges
          let minOff = -40;
          let maxOff = 40;
          for (const plat of chunk.platforms) {
            if (Math.abs(enemy.y - (plat.y - 30)) < 10 &&
                enemy.x >= plat.x && enemy.x <= plat.x + plat.width) {
              // Clamp so enemy stays visually within platform bounds
              // The sprite is ~40px wide and drawn from x-5, so the visual
              // right edge is at enemy.x + 35. Tighten right bound accordingly.
              minOff = plat.x + 15 - enemy.x;
              maxOff = plat.x + plat.width - 35 - enemy.x;
              break;
            }
          }

          if ((enemy.moveOffset ?? 0) > maxOff) {
            enemy.moveOffset = maxOff;
            enemy.direction = -1;
          } else if ((enemy.moveOffset ?? 0) < minOff) {
            enemy.moveOffset = minOff;
            enemy.direction = 1;
          }
        } else if (enemy.type === "flyer") {
          const SPEED = 60;
          if (!enemy.direction) enemy.direction = 1;
          enemy.moveOffset = (enemy.moveOffset ?? 0) + enemy.direction * SPEED * dt;
          const RANGE = 60;
          if ((enemy.moveOffset ?? 0) > RANGE) {
            enemy.moveOffset = RANGE;
            enemy.direction = -1;
          } else if ((enemy.moveOffset ?? 0) < -RANGE) {
            enemy.moveOffset = -RANGE;
            enemy.direction = 1;
          }
        }
        // Shooters don't move. Flyers bob vertically in renderer via time.
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
    // Don't request more chunks in the first 5 seconds — let the player
    // actually move before triggering AI generation
    if (this.time < 5) return;

    // If we've been waiting for chunks for more than 15 seconds, reset the flag
    if (this.requestingChunks && this.time - this.requestingChunksTime > 15) {
      this.requestingChunks = false;
    }
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
      this.requestingChunksTime = this.time;
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
        if (!this._loading) this.drawMenuOverlay();
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

    // Loading overlay (shown while waiting for AI's first response)
    if (this._loading) {
      this.drawLoadingOverlay();
    }

    // ── Canvas HUD (always on top, unaffected by camera) ────────────────────
    if (gamePhase === "playing" || gamePhase === "dead") {
      drawHUD(ctx, {
        lives,
        coins,
        score,
        difficulty: this.difficulty,
        dmMessage: this.dmMessage,
        dmMessageTime: this.dmMessageTime,
        dmMessages: this.dmMessages,
        aiGenerating: this.requestingChunks,
        suggestions: this.suggestions,
        pressedButtonIndex: this.pressedButtonIndex,
        pressedButtonTime: this.pressedButtonTime,
      }, sprites, time);
    }
  }

  // ── Overlay helpers ───────────────────────────────────────────────────────────

  private drawMenuOverlay(): void {
    const { ctx, time, sprites } = this;
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;

    // Dark overlay — slightly transparent so the game world peeks through
    ctx.fillStyle = "rgba(0, 0, 20, 0.65)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // ── Character mascot ──────────────────────────────────────────────────
    if (sprites?.loaded) {
      const mascotSize = 80;
      const bobY = Math.sin(time * 2) * 6;
      ctx.drawImage(
        sprites.playerIdle,
        cx - mascotSize / 2,
        cy - 150 + bobY,
        mascotSize,
        mascotSize,
      );
    }

    // ── Title ─────────────────────────────────────────────────────────────
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Shadow
    ctx.font = "bold 44px monospace";
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillText("AI PLATFORMER", cx + 3, cy - 40 + 3);

    // Main title
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("AI PLATFORMER", cx, cy - 40);

    // Subtitle
    ctx.font = "bold 14px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText("Powered by CopilotKit", cx, cy + 5);

    // ── START button (same 3D shadow style as command buttons, but green) ─
    const btnW = 180;
    const btnH = 36;
    const btnX = cx - btnW / 2;
    const btnY = cy + 40;
    const btnR = 6;
    const shadowOff = 3;

    // 3D shadow — dark green, offset below
    ctx.fillStyle = "#14532d";
    ctx.beginPath();
    ctx.roundRect(btnX, btnY + shadowOff, btnW, btnH, btnR);
    ctx.fill();

    // Button body
    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, btnR);
    ctx.fill();

    // Text
    ctx.font = "bold 16px monospace";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("START GAME", cx, btnY + btnH / 2 + 1);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
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
    ctx.font = `bold ${fontSize}px monospace`;

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
    ctx.font = "16px monospace";
    ctx.fillText("Respawning…", cx, cy + 44);
    ctx.globalAlpha = 1;

    ctx.textAlign = "left";
  }

  private drawGameOverOverlay(score: number, coins: number, deaths: number): void {
    const { ctx, time, sprites } = this;
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;

    // Dark overlay — same style as menu
    ctx.fillStyle = "rgba(0, 0, 20, 0.75)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Sad character mascot
    if (sprites?.loaded) {
      const mascotSize = 64;
      ctx.globalAlpha = 0.8;
      ctx.drawImage(
        sprites.playerHit,
        cx - mascotSize / 2,
        cy - 140,
        mascotSize,
        mascotSize,
      );
      ctx.globalAlpha = 1;
    }

    // "GAME OVER" title — same style as menu title
    ctx.font = "bold 44px monospace";
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillText("GAME OVER", cx + 3, cy - 55 + 3);
    ctx.fillStyle = "#FF6B6B";
    ctx.fillText("GAME OVER", cx, cy - 55);

    // Stats — clean monospace layout
    ctx.font = "bold 16px monospace";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(`Score: ${score}`, cx, cy + 5);

    ctx.font = "13px monospace";
    ctx.fillStyle = "#C4A882";
    ctx.fillText(`Coins: ${coins}     Deaths: ${deaths}`, cx, cy + 30);

    // PLAY AGAIN button — same green 3D style as start button
    const btnW = 180;
    const btnH = 36;
    const btnX = cx - btnW / 2;
    const btnY = cy + 60;
    const btnR = 6;

    // 3D shadow
    ctx.fillStyle = "#14532d";
    ctx.beginPath();
    ctx.roundRect(btnX, btnY + 3, btnW, btnH, btnR);
    ctx.fill();

    // Button body
    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, btnR);
    ctx.fill();

    // Button text
    ctx.font = "bold 16px monospace";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("PLAY AGAIN", cx, btnY + btnH / 2 + 1);

    // Hint
    ctx.font = "11px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillText("or press Enter", cx, btnY + btnH + 18);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  private drawLoadingOverlay(): void {
    const { ctx, time, sprites } = this;
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;

    // Dark overlay
    ctx.fillStyle = "rgba(0, 0, 20, 0.75)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Bouncing character mascot
    if (sprites?.loaded) {
      const mascotSize = 64;
      const bounceY = Math.abs(Math.sin(time * 3)) * 20;
      ctx.drawImage(
        sprites.playerJump,
        cx - mascotSize / 2,
        cy - 60 - bounceY,
        mascotSize,
        mascotSize,
      );
    }

    // "Loading" text with animated dots
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 24px monospace";
    ctx.fillStyle = "#FFFFFF";
    const dotCount = Math.floor(time * 2) % 4;
    const dots = ".".repeat(dotCount);
    ctx.fillText("Loading" + dots, cx, cy + 30);

    // Subtle subtitle
    ctx.font = "13px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText("The Dungeon Master is building your world", cx, cy + 60);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }
}
