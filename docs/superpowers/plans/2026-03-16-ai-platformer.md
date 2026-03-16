# AI Infinite Platformer - Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a side-scrolling platformer where the AI generates levels in real-time using CopilotKit's headless agent state pattern — no chat UI, pure game.

**Architecture:** Game engine runs client-side at 60fps in a `<canvas>`. Agent state (managed by LangGraph Python backend) holds the game world — level chunks, difficulty, DM messages, command suggestions. Frontend reads state via `useAgent()` hook to render, and sends messages via `agent.addMessage()` + `agent.runAgent()` to trigger chunk generation. Player commands are buttons rendered from agent state, clicked to send messages.

**Tech Stack:** Next.js 16, React 19, Canvas 2D, TailwindCSS 4 (frontend) | LangGraph, Python 3.12, CopilotKit middleware (agent)

---

## File Structure

### Files to Create

```
apps/app/src/
  lib/game/
    types.ts              # TypeScript interfaces for game entities
    constants.ts          # Physics values, canvas dims, colors
    engine.ts             # GameEngine class — loop, update, state management
    physics.ts            # Gravity, movement, AABB collision detection
    renderer.ts           # Canvas 2D draw functions for all entities
    camera.ts             # Camera tracking (follow player, smooth lerp)
  components/game/
    GameCanvas.tsx         # Canvas element, engine lifecycle, keyboard input
    GameWrapper.tsx        # CopilotKit ↔ Game bridge (reads/writes agent state)
    HUD.tsx                # Score, lives, difficulty meter overlay
    DMBar.tsx              # Dungeon Master message with typewriter effect
    CommandButtons.tsx     # Dynamic game command buttons from agent state

apps/agent/src/
    game.py                # GameAgentState schema + append_chunks/reset_game tools
```

### Files to Modify

```
apps/app/src/app/page.tsx           # Replace todo demo with GameWrapper
apps/app/src/app/layout.tsx         # Minor: remove unused imports if needed
apps/agent/main.py                  # Replace todo agent with game agent
```

### Files to Keep (unchanged)

```
apps/app/src/app/api/copilotkit/route.ts   # CopilotKit API route — works as-is
apps/app/src/app/layout.tsx                # CopilotKit provider — works as-is
```

---

## Chunk 1: Foundation & Agent Backend

### Task 1: Game TypeScript Types

**Files:**
- Create: `apps/app/src/lib/game/types.ts`

- [ ] **Step 1: Create game type definitions**

```typescript
// apps/app/src/lib/game/types.ts

export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  type: "normal" | "moving" | "crumbling" | "bouncy" | "icy";
  // Runtime state (not from agent)
  crumbleTimer?: number;
  moveOffset?: number;
  moveDirection?: number;
}

export interface Enemy {
  x: number;
  y: number;
  type: "walker" | "flyer" | "shooter";
  // Runtime state
  alive: boolean;
  direction: number;
  moveOffset?: number;
}

export interface Coin {
  x: number;
  y: number;
  collected: boolean;
}

export interface LevelChunk {
  chunk_index: number;
  platforms: Platform[];
  enemies: Enemy[];
  coins: Coin[];
}

export interface Suggestion {
  label: string;
  command: string;
}

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  alive: boolean;
  facing: number; // 1 = right, -1 = left
}

export interface GameState {
  player: PlayerState;
  cameraX: number;
  chunks: LevelChunk[];
  score: number;
  coins: number;
  lives: number;
  deaths: number;
  gamePhase: "menu" | "playing" | "dead" | "game_over";
}

// What the agent sends us (matches Python AgentState)
export interface AgentGameState {
  level_chunks: LevelChunk[];
  difficulty: number;
  game_phase: "menu" | "playing" | "dead" | "game_over";
  dm_message: string;
  suggestions: Suggestion[];
  score: number;
  lives: number;
  player_x: number;
  deaths: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/app/src/lib/game/types.ts
git commit -m "feat: add game type definitions"
```

---

### Task 2: Game Constants

**Files:**
- Create: `apps/app/src/lib/game/constants.ts`

- [ ] **Step 1: Create constants file**

```typescript
// apps/app/src/lib/game/constants.ts

// Canvas
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;

// Physics
export const GRAVITY = 1800;
export const PLAYER_SPEED = 300;
export const PLAYER_JUMP_VELOCITY = -620;
export const PLAYER_WIDTH = 30;
export const PLAYER_HEIGHT = 40;
export const MAX_FALL_SPEED = 800;

// Level
export const CHUNK_WIDTH = 1000;
export const GROUND_Y = 520;
export const GROUND_HEIGHT = 80;

// Camera
export const CAMERA_LEAD = CANVAS_WIDTH * 0.35; // Player positioned at 35% from left
export const CAMERA_SMOOTHING = 0.08;

// Chunk generation
export const CHUNK_REQUEST_THRESHOLD = CHUNK_WIDTH * 2; // Request when within 2 chunks of end
export const MIN_CHUNKS_AHEAD = 2; // Don't request if already this many chunks ahead of player

// Colors (placeholder — will be polished later)
export const COLORS = {
  sky: "#87CEEB",
  ground: "#8B4513",
  groundTop: "#228B22",
  platform: "#8B4513",
  platformTop: "#228B22",
  player: "#FF6347",
  playerEyes: "#FFFFFF",
  coin: "#FFD700",
  enemy: "#FF4444",
  heart: "#FF0000",
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/app/src/lib/game/constants.ts
git commit -m "feat: add game constants"
```

---

### Task 3: Agent Game State Schema & Tools (Python)

**Files:**
- Create: `apps/agent/src/game.py`

- [ ] **Step 1: Create game state schema and tools**

```python
# apps/agent/src/game.py

from langchain.agents import AgentState as BaseAgentState
from langchain.tools import ToolRuntime, tool
from langchain.messages import ToolMessage
from langgraph.types import Command
from typing import TypedDict, Literal


class Platform(TypedDict):
    x: float
    y: float
    width: float
    height: float
    type: Literal["normal", "moving", "crumbling", "bouncy", "icy"]


class Enemy(TypedDict):
    x: float
    y: float
    type: Literal["walker", "flyer", "shooter"]


class Coin(TypedDict):
    x: float
    y: float


class LevelChunk(TypedDict):
    chunk_index: int
    platforms: list[Platform]
    enemies: list[Enemy]
    coins: list[Coin]


class Suggestion(TypedDict):
    label: str
    command: str


class GameAgentState(BaseAgentState):
    level_chunks: list[LevelChunk]
    difficulty: float
    game_phase: Literal["menu", "playing", "dead", "game_over"]
    dm_message: str
    suggestions: list[Suggestion]
    score: int
    lives: int
    player_x: float
    deaths: int


@tool
def append_chunks(
    new_chunks: list[LevelChunk],
    difficulty: float,
    dm_message: str,
    suggestions: list[Suggestion],
    runtime: ToolRuntime,
) -> Command:
    """Append new level chunks to the existing game world.

    Use this for ongoing chunk generation. Only provide the NEW chunks —
    existing chunks are preserved automatically. This avoids re-sending
    the entire world on every generation call.
    """
    existing = runtime.state.get("level_chunks", [])
    return Command(
        update={
            "level_chunks": existing + new_chunks,
            "difficulty": difficulty,
            "game_phase": "playing",
            "dm_message": dm_message,
            "suggestions": suggestions,
            "messages": [
                ToolMessage(
                    content=f"Appended {len(new_chunks)} chunks (total: {len(existing) + len(new_chunks)})",
                    tool_call_id=runtime.tool_call_id,
                )
            ],
        }
    )


@tool
def reset_game(
    level_chunks: list[LevelChunk],
    difficulty: float,
    dm_message: str,
    suggestions: list[Suggestion],
    lives: int,
    runtime: ToolRuntime,
) -> Command:
    """Reset the game with a fresh set of level chunks.

    Use this ONLY when starting a new game or restarting after game over.
    Replaces ALL existing chunks.
    """
    return Command(
        update={
            "level_chunks": level_chunks,
            "difficulty": difficulty,
            "game_phase": "playing",
            "dm_message": dm_message,
            "suggestions": suggestions,
            "lives": lives,
            "deaths": 0,
            "score": 0,
            "player_x": 0,
            "messages": [
                ToolMessage(
                    content="Game reset",
                    tool_call_id=runtime.tool_call_id,
                )
            ],
        }
    )


@tool
def get_game_state(runtime: ToolRuntime):
    """Get the current game state including chunk count, player position, score, deaths."""
    chunks = runtime.state.get("level_chunks", [])
    return {
        "total_chunks": len(chunks),
        "last_chunk_index": chunks[-1]["chunk_index"] if chunks else -1,
        "difficulty": runtime.state.get("difficulty", 0.3),
        "game_phase": runtime.state.get("game_phase", "menu"),
        "score": runtime.state.get("score", 0),
        "lives": runtime.state.get("lives", 3),
        "player_x": runtime.state.get("player_x", 0),
        "deaths": runtime.state.get("deaths", 0),
    }


game_tools = [append_chunks, reset_game, get_game_state]
```

- [ ] **Step 2: Commit**

```bash
git add apps/agent/src/game.py
git commit -m "feat: add game agent state schema and tools"
```

---

### Task 4: Agent Configuration

**Files:**
- Modify: `apps/agent/main.py`

- [ ] **Step 1: Replace todo agent with game agent**

Replace the entire contents of `main.py`:

```python
"""
AI Infinite Platformer - Game Agent

The AI acts as a Dungeon Master, generating level chunks in real-time
as the player runs through an infinite side-scrolling platformer.
"""

from copilotkit import CopilotKitMiddleware
from langchain.agents import create_agent
from langchain_openai import ChatOpenAI

from src.game import GameAgentState, game_tools

SYSTEM_PROMPT = """
You are the Dungeon Master of an infinite side-scrolling platformer game.
Your job is to generate level chunks that are fun, challenging, and fair.
You also have a personality — you're snarky, playful, and competitive.

## Game World Constants
- Canvas: 800x600 pixels
- Chunk width: 1000 pixels (platforms use x: 0 to 1000 within a chunk)
- Ground level: y=520 (the floor). Platforms are placed ABOVE this (lower y = higher on screen)
- Player size: 30x40 pixels
- Jump height: ~130 pixels (player can reach platforms up to 130px above their current y)
- Jump distance: ~200 pixels horizontally with a running jump
- Platform y range: 300 to 500 (below 300 is too high to reach, above 500 is below ground)

## Level Chunk Format
Each chunk has a sequential chunk_index and contains:
- platforms: list of {x, y, width, height, type}
  - x: 0 to 1000 (relative to chunk start in world space, actual world x = chunk_index * 1000 + x)
  - y: 300 to 500
  - width: 80 to 350
  - height: 20 to 40
  - type: "normal", "moving", "crumbling", "bouncy", "icy"
- enemies: list of {x, y, type}
  - Place ON platforms (same y as platform top minus enemy height)
  - type: "walker", "flyer", "shooter"
- coins: list of {x, y}
  - Place above platforms or along jump arcs to guide the player

## CRITICAL DESIGN RULES
1. EVERY chunk MUST have a ground-level platform (y=480-500, width >= 200) OR multiple stepping-stone platforms that form a clear path
2. Gaps between platforms must be jumpable: max 180px horizontal, max 120px vertical
3. The FIRST platform of each chunk must be reachable from the LAST platform of the previous chunk
4. Place at least 3-5 coins per chunk to guide the player's path
5. Start chunk_index from where the last chunk left off

## Difficulty Scaling (0.0 to 1.0)
- 0.0-0.3: Wide ground platforms, few small gaps, no enemies, lots of coins
- 0.3-0.5: Some gaps, introduce walkers, moderate coins, occasional moving platform
- 0.5-0.7: Narrower platforms, moving/crumbling, flyers, fewer coins
- 0.7-1.0: Small platforms, crumbling/icy, shooters, max-range gaps

## Suggestions
Always provide 3-4 contextual command buttons as suggestions. Examples:
- Player struggling: ["Easier please", "More coins", "Slow down"]
- Player cruising: ["Crank it up", "Boss mode", "Surprise me"]
- After difficulty change: ["That's perfect", "Even more!", "Too much"]
- General: ["Harder", "Easier", "Surprise me", "More enemies"]

## Personality (dm_message)
Keep messages SHORT (under 60 chars). Be snarky and fun:
- Game start: "Welcome, mortal. Let's see what you've got."
- Easy mode: "Fine... I'll go easy. For now."
- Hard mode: "You asked for it. Don't cry."
- Player dying a lot: "Having fun down there?"
- Player doing well: "Impressive. Time to fix that."
- Surprise: "Oh, you're gonna love this..."

## Tools
- Use `reset_game` ONLY for new games or restarts — provides full initial chunks + lives
- Use `append_chunks` for ongoing generation — only send NEW chunks, existing ones are kept automatically
- Use `get_game_state` to check current state before generating

## When generating chunks
- Generate the number of chunks requested
- Maintain continuity — new chunks must connect to existing ones
- For new games, use reset_game with 4 initial chunks and lives=3
- For ongoing play, use append_chunks with only the new chunks
"""

agent = create_agent(
    model=ChatOpenAI(model="gpt-5-mini", reasoning={"effort": "low", "summary": "concise"}),
    tools=game_tools,
    middleware=[CopilotKitMiddleware()],
    state_schema=GameAgentState,
    system_prompt=SYSTEM_PROMPT,
)

graph = agent
```

- [ ] **Step 2: Commit**

```bash
git add apps/agent/main.py apps/agent/src/game.py
git commit -m "feat: configure game agent with DM system prompt"
```

---

## Chunk 2: Game Engine

### Task 5: Collision Detection

**Files:**
- Create: `apps/app/src/lib/game/physics.ts`

- [ ] **Step 1: Create physics module with AABB collision and player movement**

```typescript
// apps/app/src/lib/game/physics.ts

import { Platform, Enemy, Coin, PlayerState } from "./types";
import {
  GRAVITY,
  PLAYER_SPEED,
  PLAYER_JUMP_VELOCITY,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  MAX_FALL_SPEED,
  GROUND_Y,
  CHUNK_WIDTH,
} from "./constants";

export interface CollisionResult {
  collides: boolean;
  overlapY?: number;
}

/** AABB overlap test */
export function aabbOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/** Get the world-x of a platform given its chunk_index */
export function platformWorldX(platform: Platform, chunkIndex: number): number {
  return chunkIndex * CHUNK_WIDTH + platform.x;
}

/** Update player physics for one frame */
export function updatePlayer(
  player: PlayerState,
  keys: Set<string>,
  platforms: { platform: Platform; worldX: number }[],
  dt: number,
): { landed: boolean; fellOff: boolean } {
  let landed = false;
  let fellOff = false;

  // Horizontal movement
  const moveLeft = keys.has("ArrowLeft") || keys.has("a") || keys.has("A");
  const moveRight = keys.has("ArrowRight") || keys.has("d") || keys.has("D");

  if (moveLeft) {
    player.vx = -PLAYER_SPEED;
    player.facing = -1;
  } else if (moveRight) {
    player.vx = PLAYER_SPEED;
    player.facing = 1;
  } else {
    player.vx = 0;
  }

  // Jumping
  const jumpKey = keys.has("ArrowUp") || keys.has("w") || keys.has("W") || keys.has(" ");
  if (jumpKey && player.onGround) {
    player.vy = PLAYER_JUMP_VELOCITY;
    player.onGround = false;
  }

  // Apply gravity
  player.vy = Math.min(player.vy + GRAVITY * dt, MAX_FALL_SPEED);

  // Move horizontally
  player.x += player.vx * dt;

  // Move vertically
  player.y += player.vy * dt;

  // Ground collision
  player.onGround = false;

  // Check platform collisions (only when falling)
  if (player.vy >= 0) {
    for (const { platform, worldX } of platforms) {
      const platTop = platform.y;
      const prevBottom = player.y + PLAYER_HEIGHT - player.vy * dt;
      const currBottom = player.y + PLAYER_HEIGHT;

      // Player's feet were above platform, now at or below
      if (
        prevBottom <= platTop + 5 &&
        currBottom >= platTop &&
        player.x + PLAYER_WIDTH > worldX &&
        player.x < worldX + platform.width
      ) {
        player.y = platTop - PLAYER_HEIGHT;
        player.vy = 0;
        player.onGround = true;
        landed = true;
        break;
      }
    }
  }

  // Fall off screen
  if (player.y > GROUND_Y + 200) {
    fellOff = true;
  }

  return { landed, fellOff };
}

/** Check if player overlaps an enemy */
export function checkEnemyCollision(
  player: PlayerState,
  enemy: { x: number; y: number; width: number; height: number },
): "kill" | "hurt" | "none" {
  if (!aabbOverlap(
    player.x, player.y, PLAYER_WIDTH, PLAYER_HEIGHT,
    enemy.x, enemy.y, enemy.width, enemy.height,
  )) {
    return "none";
  }

  // If player is falling and hitting from above → kill enemy
  if (player.vy > 0 && player.y + PLAYER_HEIGHT - 10 < enemy.y + enemy.height / 2) {
    return "kill";
  }

  return "hurt";
}

/** Check if player overlaps a coin */
export function checkCoinCollision(
  player: PlayerState,
  coinWorldX: number,
  coinY: number,
): boolean {
  return aabbOverlap(
    player.x, player.y, PLAYER_WIDTH, PLAYER_HEIGHT,
    coinWorldX - 10, coinY - 10, 20, 20,
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/app/src/lib/game/physics.ts
git commit -m "feat: add physics and collision detection"
```

---

### Task 6: Camera System

**Files:**
- Create: `apps/app/src/lib/game/camera.ts`

- [ ] **Step 1: Create camera module**

```typescript
// apps/app/src/lib/game/camera.ts

import { CAMERA_LEAD, CAMERA_SMOOTHING, CANVAS_WIDTH } from "./constants";

export interface Camera {
  x: number;
}

export function createCamera(): Camera {
  return { x: 0 };
}

/** Smooth camera follow — player at 35% from left edge, only moves right.
 *  Uses dt-weighted exponential decay so smoothing is frame-rate independent. */
export function updateCamera(camera: Camera, playerX: number, dt: number): void {
  const targetX = playerX - CAMERA_LEAD;
  // Only scroll right, never left
  if (targetX > camera.x) {
    const factor = 1 - Math.pow(1 - CAMERA_SMOOTHING, dt * 60);
    camera.x += (targetX - camera.x) * factor;
  }
}

/** Check if a world-x coordinate is visible on screen */
export function isVisible(camera: Camera, worldX: number, width: number): boolean {
  return worldX + width > camera.x && worldX < camera.x + CANVAS_WIDTH;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/app/src/lib/game/camera.ts
git commit -m "feat: add camera system"
```

---

### Task 7: Canvas Renderer

**Files:**
- Create: `apps/app/src/lib/game/renderer.ts`

- [ ] **Step 1: Create renderer with draw functions for all entities**

```typescript
// apps/app/src/lib/game/renderer.ts

import { Platform, Enemy, Coin, PlayerState, LevelChunk } from "./types";
import { Camera, isVisible } from "./camera";
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

export function clearCanvas(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = COLORS.sky;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

export function drawBackground(ctx: CanvasRenderingContext2D, camera: Camera): void {
  // Simple parallax clouds (placeholder)
  ctx.fillStyle = "#ffffff88";
  const parallax = camera.x * 0.2;
  for (let i = 0; i < 5; i++) {
    const cx = (i * 300 - parallax % 1500 + 1500) % 1500;
    ctx.beginPath();
    ctx.arc(cx, 80 + (i % 3) * 40, 30, 0, Math.PI * 2);
    ctx.arc(cx + 25, 70 + (i % 3) * 40, 25, 0, Math.PI * 2);
    ctx.arc(cx - 20, 75 + (i % 3) * 40, 22, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawPlatform(
  ctx: CanvasRenderingContext2D,
  platform: Platform,
  worldX: number,
  camera: Camera,
): void {
  const screenX = worldX - camera.x;
  const screenY = platform.y;

  // Platform body
  ctx.fillStyle = COLORS.platform;
  ctx.fillRect(screenX, screenY, platform.width, platform.height);

  // Grass/top
  ctx.fillStyle = COLORS.platformTop;
  ctx.fillRect(screenX, screenY, platform.width, 6);

  // Type indicators
  if (platform.type === "bouncy") {
    ctx.fillStyle = "#FF69B4";
    ctx.fillRect(screenX, screenY, platform.width, 6);
  } else if (platform.type === "icy") {
    ctx.fillStyle = "#ADD8E6";
    ctx.fillRect(screenX, screenY, platform.width, platform.height);
    ctx.fillStyle = "#E0F0FF";
    ctx.fillRect(screenX, screenY, platform.width, 6);
  } else if (platform.type === "crumbling") {
    ctx.fillStyle = "#A0522D";
    ctx.fillRect(screenX, screenY, platform.width, platform.height);
    // Crack lines
    ctx.strokeStyle = "#654321";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(screenX + platform.width * 0.3, screenY);
    ctx.lineTo(screenX + platform.width * 0.5, screenY + platform.height);
    ctx.moveTo(screenX + platform.width * 0.7, screenY);
    ctx.lineTo(screenX + platform.width * 0.6, screenY + platform.height);
    ctx.stroke();
  }
}

export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  camera: Camera,
): void {
  const screenX = player.x - camera.x;
  const screenY = player.y;

  // Body
  ctx.fillStyle = COLORS.player;
  ctx.fillRect(screenX, screenY, PLAYER_WIDTH, PLAYER_HEIGHT);

  // Eyes
  ctx.fillStyle = COLORS.playerEyes;
  const eyeX = player.facing === 1 ? screenX + 18 : screenX + 6;
  ctx.fillRect(eyeX, screenY + 10, 6, 6);

  // Pupil
  ctx.fillStyle = "#000000";
  const pupilX = player.facing === 1 ? eyeX + 3 : eyeX + 1;
  ctx.fillRect(pupilX, screenY + 12, 2, 3);
}

export function drawEnemy(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  worldX: number,
  camera: Camera,
): void {
  if (!enemy.alive) return;
  const screenX = worldX - camera.x;
  const screenY = enemy.y;
  const size = 28;

  ctx.fillStyle = COLORS.enemy;

  if (enemy.type === "walker") {
    ctx.fillRect(screenX, screenY, size, size);
    // Angry eyes
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(screenX + 5, screenY + 6, 6, 6);
    ctx.fillRect(screenX + 17, screenY + 6, 6, 6);
    ctx.fillStyle = "#000000";
    ctx.fillRect(screenX + 7, screenY + 8, 3, 3);
    ctx.fillRect(screenX + 19, screenY + 8, 3, 3);
  } else if (enemy.type === "flyer") {
    // Winged triangle
    ctx.beginPath();
    ctx.moveTo(screenX + size / 2, screenY);
    ctx.lineTo(screenX + size, screenY + size);
    ctx.lineTo(screenX, screenY + size);
    ctx.closePath();
    ctx.fill();
    // Wings
    ctx.fillStyle = "#FF6666";
    ctx.fillRect(screenX - 8, screenY + 8, 10, 4);
    ctx.fillRect(screenX + size - 2, screenY + 8, 10, 4);
  } else if (enemy.type === "shooter") {
    // Turret
    ctx.fillRect(screenX, screenY + size / 2, size, size / 2);
    ctx.fillStyle = "#CC0000";
    ctx.fillRect(screenX + size / 2 - 4, screenY, 8, size / 2);
  }
}

export function drawCoin(
  ctx: CanvasRenderingContext2D,
  coinWorldX: number,
  coinY: number,
  camera: Camera,
  time: number,
): void {
  const screenX = coinWorldX - camera.x;
  // Bobbing animation
  const bobY = coinY + Math.sin(time * 3 + coinWorldX * 0.01) * 4;

  ctx.fillStyle = COLORS.coin;
  ctx.beginPath();
  ctx.arc(screenX, bobY, 8, 0, Math.PI * 2);
  ctx.fill();

  // Shine
  ctx.fillStyle = "#FFEC8B";
  ctx.beginPath();
  ctx.arc(screenX - 2, bobY - 2, 3, 0, Math.PI * 2);
  ctx.fill();
}

export function drawGround(ctx: CanvasRenderingContext2D, camera: Camera): void {
  // Ground extends across the full visible area
  const screenY = GROUND_Y;
  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(0, screenY, CANVAS_WIDTH, GROUND_HEIGHT);
  // Grass on top
  ctx.fillStyle = COLORS.groundTop;
  ctx.fillRect(0, screenY, CANVAS_WIDTH, 6);
}

/** Draw all chunks (platforms, enemies, coins) that are visible */
export function drawChunks(
  ctx: CanvasRenderingContext2D,
  chunks: LevelChunk[],
  camera: Camera,
  time: number,
): void {
  for (const chunk of chunks) {
    const chunkWorldStart = chunk.chunk_index * CHUNK_WIDTH;

    // Skip chunks that are off-screen
    if (!isVisible(camera, chunkWorldStart, CHUNK_WIDTH)) continue;

    // Platforms
    for (const platform of chunk.platforms) {
      const worldX = chunkWorldStart + platform.x;
      if (isVisible(camera, worldX, platform.width)) {
        drawPlatform(ctx, platform, worldX, camera);
      }
    }

    // Coins
    for (const coin of chunk.coins) {
      if (coin.collected) continue;
      const worldX = chunkWorldStart + coin.x;
      if (isVisible(camera, worldX - 10, 20)) {
        drawCoin(ctx, worldX, coin.y, camera, time);
      }
    }

    // Enemies
    for (const enemy of chunk.enemies) {
      if (!enemy.alive) continue;
      const worldX = chunkWorldStart + enemy.x;
      if (isVisible(camera, worldX, 28)) {
        drawEnemy(ctx, enemy, worldX, camera);
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/app/src/lib/game/renderer.ts
git commit -m "feat: add canvas renderer for all game entities"
```

---

### Task 8: Game Engine

**Files:**
- Create: `apps/app/src/lib/game/engine.ts`

This is the core game loop that ties physics, camera, and rendering together.

- [ ] **Step 1: Create the GameEngine class**

```typescript
// apps/app/src/lib/game/engine.ts

import { GameState, LevelChunk, PlayerState } from "./types";
import { Camera, createCamera, updateCamera } from "./camera";
import {
  updatePlayer,
  checkEnemyCollision,
  checkCoinCollision,
  platformWorldX,
} from "./physics";
import {
  clearCanvas,
  drawBackground,
  drawGround,
  drawChunks,
  drawPlayer,
} from "./renderer";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  CHUNK_WIDTH,
  CHUNK_REQUEST_THRESHOLD,
  MIN_CHUNKS_AHEAD,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  PLAYER_JUMP_VELOCITY,
  GROUND_Y,
} from "./constants";

export type GameEventCallback = {
  onNeedChunks?: (playerX: number) => void;
  onPlayerDied?: (deaths: number) => void;
  onScoreUpdate?: (score: number, coins: number) => void;
};

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: GameState;
  private camera: Camera;
  private keys: Set<string> = new Set();
  private animFrameId: number = 0;
  private lastTime: number = 0;
  private time: number = 0;
  private requestingChunks: boolean = false;
  private callbacks: GameEventCallback = {};

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;
    this.camera = createCamera();
    this.state = this.createInitialState();
  }

  private createInitialState(): GameState {
    return {
      player: {
        x: 100,
        y: GROUND_Y - PLAYER_HEIGHT - 100,
        vx: 0,
        vy: 0,
        onGround: false,
        alive: true,
        facing: 1,
      },
      cameraX: 0,
      chunks: [],
      score: 0,
      coins: 0,
      lives: 3,
      deaths: 0,
      gamePhase: "menu",
    };
  }

  setCallbacks(callbacks: GameEventCallback): void {
    this.callbacks = callbacks;
  }

  start(): void {
    this.addKeyListeners();
    this.lastTime = performance.now();
    this.gameLoop(this.lastTime);
  }

  stop(): void {
    cancelAnimationFrame(this.animFrameId);
    this.removeKeyListeners();
  }

  startPlaying(): void {
    this.state = this.createInitialState();
    this.state.gamePhase = "playing";
    this.camera = createCamera();
    this.requestingChunks = false;
  }

  /** Called when new chunks arrive from agent */
  updateLevelChunks(chunks: LevelChunk[]): void {
    // Merge runtime state (alive, collected, etc.) from existing chunks
    const existingMap = new Map<number, LevelChunk>();
    for (const c of this.state.chunks) {
      existingMap.set(c.chunk_index, c);
    }

    this.state.chunks = chunks.map((newChunk) => {
      const existing = existingMap.get(newChunk.chunk_index);
      if (existing) {
        // Preserve runtime state
        return existing;
      }
      // Initialize runtime state for new chunks
      return {
        ...newChunk,
        enemies: newChunk.enemies.map((e) => ({
          ...e,
          alive: true,
          direction: 1,
          moveOffset: 0,
        })),
        coins: newChunk.coins.map((c) => ({ ...c, collected: false })),
      };
    });

    this.requestingChunks = false;
  }

  setLives(lives: number): void {
    this.state.lives = lives;
  }

  getState(): GameState {
    return this.state;
  }

  // --- Input ---

  private keyDownHandler = (e: KeyboardEvent) => {
    this.keys.add(e.key);
    // Prevent scrolling
    if (["ArrowUp", "ArrowDown", " "].includes(e.key)) {
      e.preventDefault();
    }
  };

  private keyUpHandler = (e: KeyboardEvent) => {
    this.keys.delete(e.key);
  };

  private addKeyListeners(): void {
    window.addEventListener("keydown", this.keyDownHandler);
    window.addEventListener("keyup", this.keyUpHandler);
  }

  private removeKeyListeners(): void {
    window.removeEventListener("keydown", this.keyDownHandler);
    window.removeEventListener("keyup", this.keyUpHandler);
  }

  // --- Game Loop ---

  private gameLoop(timestamp: number): void {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 1 / 30);
    this.lastTime = timestamp;
    this.time += dt;

    if (this.state.gamePhase === "playing") {
      this.update(dt);
    }

    this.render();
    this.animFrameId = requestAnimationFrame((t) => this.gameLoop(t));
  }

  private update(dt: number): void {
    if (!this.state.player.alive) return;

    // Gather nearby platforms for collision
    const nearbyPlatforms = this.getNearbyPlatforms();

    // Update player physics
    const { landed, fellOff } = updatePlayer(
      this.state.player,
      this.keys,
      nearbyPlatforms,
      dt,
    );

    // Update camera
    updateCamera(this.camera, this.state.player.x, dt);

    // Update enemies
    this.updateEnemies(dt);

    // Check enemy collisions
    this.checkEnemyCollisions();

    // Check coin collisions
    this.checkCoinCollisions();

    // Ground collision (always present as a safety net)
    if (this.state.player.y + PLAYER_HEIGHT >= GROUND_Y) {
      this.state.player.y = GROUND_Y - PLAYER_HEIGHT;
      this.state.player.vy = 0;
      this.state.player.onGround = true;
    }

    // Update score based on distance
    const distanceScore = Math.max(0, Math.floor(this.state.player.x / 10));
    const newScore = distanceScore + this.state.coins * 50;
    if (newScore !== this.state.score) {
      this.state.score = newScore;
      this.callbacks.onScoreUpdate?.(this.state.score, this.state.coins);
    }

    // Player fell off screen (below ground + buffer)
    if (fellOff) {
      this.playerDied();
    }

    // Check if we need more chunks
    this.checkChunkGeneration();
  }

  private getNearbyPlatforms(): { platform: any; worldX: number }[] {
    const result: { platform: any; worldX: number }[] = [];
    const px = this.state.player.x;

    for (const chunk of this.state.chunks) {
      const chunkStart = chunk.chunk_index * CHUNK_WIDTH;
      if (chunkStart > px + CANVAS_WIDTH || chunkStart + CHUNK_WIDTH < px - 200) continue;

      for (const platform of chunk.platforms) {
        const worldX = chunkStart + platform.x;
        if (Math.abs(worldX - px) < CANVAS_WIDTH) {
          result.push({ platform, worldX });
        }
      }
    }

    return result;
  }

  private updateEnemies(dt: number): void {
    for (const chunk of this.state.chunks) {
      const chunkStart = chunk.chunk_index * CHUNK_WIDTH;
      for (const enemy of chunk.enemies) {
        if (!enemy.alive) continue;
        if (enemy.type === "walker") {
          enemy.moveOffset = (enemy.moveOffset || 0) + enemy.direction * 50 * dt;
          if (Math.abs(enemy.moveOffset) > 80) {
            enemy.direction *= -1;
          }
        } else if (enemy.type === "flyer") {
          enemy.moveOffset = (enemy.moveOffset || 0) + dt;
        }
      }
    }
  }

  private checkEnemyCollisions(): void {
    const player = this.state.player;
    for (const chunk of this.state.chunks) {
      const chunkStart = chunk.chunk_index * CHUNK_WIDTH;
      for (const enemy of chunk.enemies) {
        if (!enemy.alive) continue;
        const worldX = chunkStart + enemy.x + (enemy.moveOffset || 0);
        const worldY = enemy.type === "flyer"
          ? enemy.y + Math.sin((enemy.moveOffset || 0) * 2) * 30
          : enemy.y;

        const result = checkEnemyCollision(player, {
          x: worldX,
          y: worldY,
          width: 28,
          height: 28,
        });

        if (result === "kill") {
          enemy.alive = false;
          player.vy = PLAYER_JUMP_VELOCITY * 0.6; // Bounce off enemy
          this.state.coins += 2; // Bonus for killing enemy
        } else if (result === "hurt") {
          this.playerDied();
          return;
        }
      }
    }
  }

  private checkCoinCollisions(): void {
    const player = this.state.player;
    for (const chunk of this.state.chunks) {
      const chunkStart = chunk.chunk_index * CHUNK_WIDTH;
      for (const coin of chunk.coins) {
        if (coin.collected) continue;
        const worldX = chunkStart + coin.x;
        if (checkCoinCollision(player, worldX, coin.y)) {
          coin.collected = true;
          this.state.coins += 1;
        }
      }
    }
  }

  private playerDied(): void {
    this.state.player.alive = false;
    this.state.deaths += 1;
    this.state.lives -= 1;

    if (this.state.lives <= 0) {
      this.state.gamePhase = "game_over";
    } else {
      this.state.gamePhase = "dead";
    }

    this.callbacks.onPlayerDied?.(this.state.deaths);
  }

  /** Respawn at a safe position */
  respawn(): void {
    // Find the last platform near where the player was
    const respawnX = Math.max(this.state.player.x - 200, 100);

    this.state.player = {
      x: respawnX,
      y: 200,
      vx: 0,
      vy: 0,
      onGround: false,
      alive: true,
      facing: 1,
    };
    this.state.gamePhase = "playing";
  }

  private checkChunkGeneration(): void {
    if (this.requestingChunks) return;
    if (this.state.chunks.length === 0) return; // Wait for initial chunks

    const lastChunkEnd = this.getLastChunkEnd();
    const chunksAheadOfPlayer = (lastChunkEnd - this.state.player.x) / CHUNK_WIDTH;

    // Only request when player is within threshold of the end
    // AND there aren't already enough chunks ahead
    if (
      this.state.player.x > lastChunkEnd - CHUNK_REQUEST_THRESHOLD &&
      chunksAheadOfPlayer < MIN_CHUNKS_AHEAD + 1
    ) {
      this.requestingChunks = true;
      this.callbacks.onNeedChunks?.(this.state.player.x);
    }
  }

  private getLastChunkEnd(): number {
    if (this.state.chunks.length === 0) return 0;
    const maxIndex = Math.max(...this.state.chunks.map((c) => c.chunk_index));
    return (maxIndex + 1) * CHUNK_WIDTH;
  }

  // --- Rendering ---

  private render(): void {
    clearCanvas(this.ctx);
    drawBackground(this.ctx, this.camera);
    drawGround(this.ctx, this.camera);
    drawChunks(this.ctx, this.state.chunks, this.camera, this.time);

    if (this.state.gamePhase === "playing" || this.state.gamePhase === "dead") {
      drawPlayer(this.ctx, this.state.player, this.camera);
    }

    // Menu overlay
    if (this.state.gamePhase === "menu") {
      this.drawMenuOverlay();
    }

    // Death overlay
    if (this.state.gamePhase === "dead") {
      this.drawDeathOverlay();
    }

    // Game over overlay
    if (this.state.gamePhase === "game_over") {
      this.drawGameOverOverlay();
    }
  }

  private drawMenuOverlay(): void {
    this.ctx.fillStyle = "rgba(0,0,0,0.5)";
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    this.ctx.fillStyle = "#FFFFFF";
    this.ctx.font = "bold 48px monospace";
    this.ctx.textAlign = "center";
    this.ctx.fillText("AI PLATFORMER", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);
    this.ctx.font = "20px monospace";
    this.ctx.fillText("Press START to play", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
    this.ctx.textAlign = "left";
  }

  private drawDeathOverlay(): void {
    this.ctx.fillStyle = "rgba(255,0,0,0.2)";
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    this.ctx.fillStyle = "#FFFFFF";
    this.ctx.font = "bold 32px monospace";
    this.ctx.textAlign = "center";
    this.ctx.fillText("YOU DIED", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
    this.ctx.font = "18px monospace";
    this.ctx.fillText(`Lives: ${this.state.lives}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
    this.ctx.textAlign = "left";
  }

  private drawGameOverOverlay(): void {
    this.ctx.fillStyle = "rgba(0,0,0,0.7)";
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    this.ctx.fillStyle = "#FF4444";
    this.ctx.font = "bold 48px monospace";
    this.ctx.textAlign = "center";
    this.ctx.fillText("GAME OVER", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);
    this.ctx.fillStyle = "#FFFFFF";
    this.ctx.font = "24px monospace";
    this.ctx.fillText(`Score: ${this.state.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
    this.ctx.font = "18px monospace";
    this.ctx.fillText("Press START to play again", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);
    this.ctx.textAlign = "left";
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/app/src/lib/game/engine.ts
git commit -m "feat: add game engine with loop, physics, enemies, coins, death"
```

---

## Chunk 3: CopilotKit Integration & UI

### Task 9: GameCanvas React Component

**Files:**
- Create: `apps/app/src/components/game/GameCanvas.tsx`

- [ ] **Step 1: Create canvas component that manages engine lifecycle**

```tsx
// apps/app/src/components/game/GameCanvas.tsx
"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { GameEngine, GameEventCallback } from "@/lib/game/engine";

export interface GameCanvasHandle {
  engine: GameEngine | null;
}

interface GameCanvasProps {
  callbacks: GameEventCallback;
}

export const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>(
  function GameCanvas({ callbacks }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<GameEngine | null>(null);

    useImperativeHandle(ref, () => ({
      get engine() {
        return engineRef.current;
      },
    }));

    useEffect(() => {
      if (!canvasRef.current) return;

      const engine = new GameEngine(canvasRef.current);
      engine.setCallbacks(callbacks);
      engine.start();
      engineRef.current = engine;

      return () => {
        engine.stop();
        engineRef.current = null;
      };
    }, []); // Engine created once

    // Update callbacks without recreating engine
    useEffect(() => {
      engineRef.current?.setCallbacks(callbacks);
    }, [callbacks]);

    return (
      <canvas
        ref={canvasRef}
        className="block mx-auto border-2 border-gray-700 rounded-lg shadow-2xl"
        style={{ imageRendering: "pixelated" }}
      />
    );
  },
);
```

- [ ] **Step 2: Commit**

```bash
git add apps/app/src/components/game/GameCanvas.tsx
git commit -m "feat: add GameCanvas React component"
```

---

### Task 10: HUD Overlay

**Files:**
- Create: `apps/app/src/components/game/HUD.tsx`

- [ ] **Step 1: Create HUD component**

```tsx
// apps/app/src/components/game/HUD.tsx
"use client";

interface HUDProps {
  score: number;
  lives: number;
  coins: number;
  difficulty: number;
}

export function HUD({ score, lives, coins, difficulty }: HUDProps) {
  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 w-[800px] flex items-center justify-between px-4 py-2 bg-black/60 backdrop-blur-sm rounded-b-lg font-mono text-sm text-white">
      {/* Lives */}
      <div className="flex items-center gap-1">
        {Array.from({ length: lives }).map((_, i) => (
          <span key={i} className="text-red-500">&#9829;</span>
        ))}
        {Array.from({ length: Math.max(0, 3 - lives) }).map((_, i) => (
          <span key={i} className="text-gray-600">&#9829;</span>
        ))}
      </div>

      {/* Score */}
      <div className="flex items-center gap-4">
        <span className="text-yellow-400">{coins} coins</span>
        <span className="font-bold">Score: {score}</span>
      </div>

      {/* Difficulty */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Difficulty</span>
        <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 rounded-full transition-all duration-500"
            style={{ width: `${difficulty * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/app/src/components/game/HUD.tsx
git commit -m "feat: add HUD overlay component"
```

---

### Task 11: Dungeon Master Bar

**Files:**
- Create: `apps/app/src/components/game/DMBar.tsx`

- [ ] **Step 1: Create DM bar with typewriter effect**

```tsx
// apps/app/src/components/game/DMBar.tsx
"use client";

import { useEffect, useState, useRef } from "react";

interface DMBarProps {
  message: string;
}

export function DMBar({ message }: DMBarProps) {
  const [displayText, setDisplayText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const currentMessage = useRef("");

  useEffect(() => {
    if (!message || message === currentMessage.current) return;
    currentMessage.current = message;
    setIsTyping(true);
    setDisplayText("");

    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayText(message.slice(0, i));
      if (i >= message.length) {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [message]);

  if (!message) return null;

  return (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] bg-gray-900/90 backdrop-blur-sm border-b-2 border-purple-500/50 px-4 py-2 rounded-b-lg z-10">
      <div className="flex items-center gap-2 font-mono text-sm">
        <span className="text-purple-400 font-bold shrink-0">
          DUNGEON MASTER:
        </span>
        <span className="text-gray-200 italic">
          &quot;{displayText}&quot;
          {isTyping && <span className="animate-pulse">|</span>}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/app/src/components/game/DMBar.tsx
git commit -m "feat: add Dungeon Master bar with typewriter effect"
```

---

### Task 12: Command Buttons

**Files:**
- Create: `apps/app/src/components/game/CommandButtons.tsx`

- [ ] **Step 1: Create dynamic command buttons component**

```tsx
// apps/app/src/components/game/CommandButtons.tsx
"use client";

import { Suggestion } from "@/lib/game/types";

interface CommandButtonsProps {
  suggestions: Suggestion[];
  onCommand: (command: string) => void;
  disabled: boolean;
}

export function CommandButtons({ suggestions, onCommand, disabled }: CommandButtonsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.label}
          onClick={() => onCommand(suggestion.command)}
          disabled={disabled}
          className="px-4 py-2 bg-gray-800/80 backdrop-blur-sm border border-gray-600 rounded-lg
                     font-mono text-sm text-white hover:bg-purple-600/80 hover:border-purple-400
                     transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed
                     active:scale-95 shadow-lg"
        >
          {suggestion.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/app/src/components/game/CommandButtons.tsx
git commit -m "feat: add dynamic command buttons component"
```

---

### Task 13: GameWrapper — CopilotKit Bridge

**Files:**
- Create: `apps/app/src/components/game/GameWrapper.tsx`

This is the critical component that bridges CopilotKit agent state with the game engine.

- [ ] **Step 1: Create GameWrapper**

```tsx
// apps/app/src/components/game/GameWrapper.tsx
"use client";

import { useAgent } from "@copilotkit/react-core/v2";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameCanvas, GameCanvasHandle } from "./GameCanvas";
import { HUD } from "./HUD";
import { DMBar } from "./DMBar";
import { CommandButtons } from "./CommandButtons";
import { GameEventCallback } from "@/lib/game/engine";
import { AgentGameState } from "@/lib/game/types";

export function GameWrapper() {
  const { agent } = useAgent();
  const gameRef = useRef<GameCanvasHandle>(null);
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [lives, setLives] = useState(3);
  const [gamePhase, setGamePhase] = useState<"menu" | "loading" | "playing" | "dead" | "game_over">("menu");

  const agentState = agent.state as AgentGameState | undefined;

  // --- Sync agent state → game engine ---

  // When chunks arrive, push them to the engine.
  // Also handle initial load: start playing once first chunks arrive.
  useEffect(() => {
    if (agentState?.level_chunks?.length) {
      gameRef.current?.engine?.updateLevelChunks(agentState.level_chunks);
      // Start playing once initial chunks arrive (handles loading delay)
      if (gamePhase === "loading") {
        gameRef.current?.engine?.startPlaying();
        setGamePhase("playing");
      }
    }
  }, [agentState?.level_chunks]);

  useEffect(() => {
    if (agentState?.lives !== undefined) {
      gameRef.current?.engine?.setLives(agentState.lives);
      setLives(agentState.lives);
    }
  }, [agentState?.lives]);

  // --- Send messages to agent ---

  const sendToAgent = useCallback(
    (message: string) => {
      agent.addMessage({
        role: "user",
        id: crypto.randomUUID(),
        content: message,
      });
      agent.runAgent();
    },
    [agent],
  );

  // --- Start game ---

  const startGame = useCallback(() => {
    // Don't start playing yet — wait for chunks to arrive (see useEffect above)
    setGamePhase("loading");
    sendToAgent(
      "Start a new game! Use reset_game to generate 4 level chunks (chunk_index 0, 1, 2, 3). " +
      "Set difficulty to 0.3 (easy start). Set lives to 3. " +
      "Welcome the player with a fun dm_message. " +
      "Include 3-4 suggestion buttons for the player."
    );
  }, [sendToAgent]);

  // --- Request more chunks ---

  const requestChunks = useCallback(
    (playerX: number) => {
      const existingChunks = agentState?.level_chunks || [];
      const maxIndex = existingChunks.length > 0
        ? Math.max(...existingChunks.map((c) => c.chunk_index))
        : -1;
      const nextIndex = maxIndex + 1;

      sendToAgent(
        `Player reached x=${Math.round(playerX)}. Use append_chunks to generate 2 more chunks ` +
        `(chunk_index ${nextIndex} and ${nextIndex + 1}). ` +
        `Current difficulty: ${agentState?.difficulty || 0.3}. Player deaths: ${agentState?.deaths || 0}. ` +
        `Adjust difficulty slightly based on performance. Update suggestions.`
      );
    },
    [agentState, sendToAgent],
  );

  // --- Handle player death ---

  const handlePlayerDied = useCallback(
    (deaths: number) => {
      setGamePhase("dead");

      // Auto-respawn after a short delay
      setTimeout(() => {
        const engine = gameRef.current?.engine;
        if (engine) {
          const state = engine.getState();
          if (state.gamePhase === "dead") {
            engine.respawn();
            setGamePhase("playing");
          } else if (state.gamePhase === "game_over") {
            setGamePhase("game_over");
          }
        }
      }, 1500);

      // Tell the agent about the death via message (not setState, to avoid triggering re-runs)
      sendToAgent(
        `Player died! Total deaths: ${deaths}. ` +
        `Use append_chunks to react — update dm_message, adjust difficulty if player is struggling. ` +
        `Keep existing chunks, no new chunks needed unless difficulty changed.`
      );
    },
    [sendToAgent],
  );

  // --- Handle commands from buttons ---

  const handleCommand = useCallback(
    (command: string) => {
      sendToAgent(
        `Player command: "${command}". ` +
        `Respond to this command — adjust difficulty, generate new chunks if appropriate, ` +
        `update dm_message with a reaction, and provide new suggestion buttons. ` +
        `Keep all existing chunks.`
      );
    },
    [sendToAgent],
  );

  // --- Score update ---

  const handleScoreUpdate = useCallback((newScore: number, newCoins: number) => {
    setScore(newScore);
    setCoins(newCoins);
  }, []);

  // --- Engine callbacks ---
  // Note: No periodic setState sync — player stats are passed in messages
  // when events occur (chunk requests, deaths, commands) to avoid triggering agent re-runs.

  const callbacks: GameEventCallback = useMemo(
    () => ({
      onNeedChunks: requestChunks,
      onPlayerDied: handlePlayerDied,
      onScoreUpdate: handleScoreUpdate,
    }),
    [requestChunks, handlePlayerDied, handleScoreUpdate],
  );

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-gray-950">
      {/* DM Bar */}
      <DMBar message={agentState?.dm_message || ""} />

      {/* Game Canvas */}
      <GameCanvas ref={gameRef} callbacks={callbacks} />

      {/* HUD */}
      <HUD
        score={score}
        lives={lives}
        coins={coins}
        difficulty={agentState?.difficulty || 0}
      />

      {/* Command Buttons */}
      {gamePhase === "playing" && (
        <CommandButtons
          suggestions={agentState?.suggestions || []}
          onCommand={handleCommand}
          disabled={agent.isRunning}
        />
      )}

      {/* Start / Restart Button */}
      {(gamePhase === "menu" || gamePhase === "game_over") && (
        <button
          onClick={startGame}
          disabled={agent.isRunning}
          className="absolute bottom-20 px-8 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg
                     font-mono text-lg text-white font-bold transition-all duration-200
                     active:scale-95 shadow-lg shadow-purple-500/30
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {gamePhase === "menu" ? "START GAME" : "PLAY AGAIN"}
        </button>
      )}

      {/* Loading screen while waiting for initial chunks */}
      {gamePhase === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-950/80">
          <div className="text-center font-mono text-white">
            <div className="text-2xl font-bold mb-2 animate-pulse">Generating world...</div>
            <div className="text-sm text-gray-400">The Dungeon Master is preparing your fate</div>
          </div>
        </div>
      )}

      {/* Loading indicator when agent is generating more chunks */}
      {agent.isRunning && gamePhase === "playing" && (
        <div className="absolute top-14 right-[calc(50%-390px)] px-2 py-1 bg-purple-600/60 rounded text-xs text-white font-mono animate-pulse">
          AI generating...
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/app/src/components/game/GameWrapper.tsx
git commit -m "feat: add GameWrapper CopilotKit bridge component"
```

---

### Task 14: Update Page Entry Point

**Files:**
- Modify: `apps/app/src/app/page.tsx`

- [ ] **Step 1: Replace todo demo with game**

Replace the entire contents of `page.tsx`:

```tsx
// apps/app/src/app/page.tsx
"use client";

import { GameWrapper } from "@/components/game/GameWrapper";

export default function GamePage() {
  return <GameWrapper />;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/app/src/app/page.tsx
git commit -m "feat: wire up game as main page"
```

---

## Chunk 4: Testing, Integration & Polish

### Task 15: Manual Integration Test — First Playthrough

- [ ] **Step 1: Start the agent**

```bash
cd apps/agent && pnpm dev
```

Expected: LangGraph agent starts on port 8123

- [ ] **Step 2: Start the frontend**

```bash
cd apps/app && pnpm dev
```

Expected: Next.js starts on port 3000

- [ ] **Step 3: Open browser and test the game flow**

Navigate to `http://localhost:3000`. Verify:
1. Menu screen shows with "START GAME" button
2. Clicking start triggers agent (loading indicator appears)
3. Level chunks appear and player can move with arrow keys / WASD
4. Jumping works (ArrowUp / W / Space)
5. Camera follows player to the right
6. More chunks generate as player progresses
7. Coins are collectible, enemies are interactive
8. Command buttons appear and trigger agent responses
9. DM bar shows messages with typewriter effect
10. Death/respawn works
11. Game over screen appears when lives = 0

- [ ] **Step 4: Fix any issues found during testing**

Iterate on bugs found. Common issues to check:
- Chunk positions calculated correctly (chunk_index * 1000 + platform.x)
- Platforms are at valid positions for jumping
- Agent returns valid JSON for level chunks
- State sync works bidirectionally

- [ ] **Step 5: Commit fixes**

```bash
git add -A
git commit -m "fix: integration fixes from first playthrough"
```

---

### Task 16: Visual Polish Pass

This task improves the visuals from placeholder to polished. Specific improvements depend on what the game looks like after the integration test, but key areas:

- [ ] **Step 1: Improve canvas rendering**

Key visual improvements in `renderer.ts`:
- Add parallax background layers (distant mountains, mid-ground hills, near ground)
- Add particle effects (dust when landing, sparkles on coins, poof on enemy death)
- Add squash/stretch to player (compress on land, stretch on jump)
- Improve platform rendering (rounded corners, shadows, textures)
- Add gradient sky background

- [ ] **Step 2: Improve UI components**

Key UI improvements:
- Style the start screen with a proper title treatment
- Add screen transitions (fade in/out on death)
- Polish the HUD with better icons and layout
- Add animation to command buttons (slide in/out)
- Improve DM bar styling

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: visual polish pass"
```

---

### Task 17: Final Cleanup

- [ ] **Step 1: Remove unused todo components and hooks**

Delete or leave these files (they don't interfere but can be cleaned):
- `apps/app/src/components/example-canvas/` (todo UI)
- `apps/app/src/components/example-layout/` (chat+app layout)
- `apps/app/src/hooks/use-example-suggestions.tsx`
- `apps/app/src/hooks/use-generative-ui-examples.tsx`
- `apps/agent/src/todos.py`
- `apps/agent/src/query.py`
- `apps/agent/src/form.py`

- [ ] **Step 2: Verify build succeeds**

```bash
pnpm build
```

Expected: Builds successfully with no errors

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove unused todo demo files"
```

---

## Summary

**4 chunks, 17 tasks:**
- Chunk 1 (Foundation): Types, constants, agent schema, agent config
- Chunk 2 (Engine): Physics, camera, renderer, game engine class
- Chunk 3 (Integration): Canvas component, HUD, DM bar, buttons, wrapper, page
- Chunk 4 (Polish): Integration test, visual polish, cleanup

**CopilotKit features showcased:**
- Headless agent state (`useAgent()` — no chat UI)
- Bidirectional state sync (agent → game world, player → agent)
- Agent-driven content generation (LLM designs game levels)
- Dynamic suggestions (agent-controlled command buttons)
- Real-time AI interaction (player commands change the game world)
