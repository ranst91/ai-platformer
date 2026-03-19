// apps/app/src/lib/game/types.ts

export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  type: "normal" | "moving" | "crumbling" | "bouncy" | "icy" | "mystery";
  // Runtime state (not from agent)
  crumbleTimer?: number;  // crumbling: counts up while player stands on it
  crumbled?: boolean;     // crumbling: true = platform has collapsed
  moveOffset?: number;
  moveDirection?: number;
  hit?: boolean;          // mystery blocks: true after player hits from below
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
