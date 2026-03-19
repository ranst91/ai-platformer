// apps/app/src/lib/game/constants.ts

// Canvas
export const CANVAS_WIDTH = 1024;
export const CANVAS_HEIGHT = 768;

// Physics
export const GRAVITY = 1800;
export const PLAYER_SPEED = 300;
export const PLAYER_JUMP_VELOCITY = -620;
export const PLAYER_WIDTH = 30;
export const PLAYER_HEIGHT = 40;
export const MAX_FALL_SPEED = 800;

// Level
export const CHUNK_WIDTH = 1000;
export const GROUND_Y = 668;
export const GROUND_HEIGHT = 100;

// Camera
export const CAMERA_LEAD = CANVAS_WIDTH * 0.35; // Player positioned at 35% from left
export const CAMERA_SMOOTHING = 0.08;

// Chunk generation — only generate when the player has consumed enough terrain.
// With CHUNK_WIDTH=1000 and player speed 300px/s, each chunk is ~3.3s of gameplay.
export const CHUNK_REQUEST_THRESHOLD = CHUNK_WIDTH * 3; // Request when within 3 chunks of the END
export const MIN_CHUNKS_AHEAD = 3; // Only trigger if fewer than 3 chunks ahead of player
export const CHUNKS_PER_REQUEST = 3; // Request 3 chunks per batch
export const INITIAL_CHUNKS = 6; // Start with 6 chunks
export const CHUNK_CLEANUP_BEHIND = 8; // Only prune chunks 8+ behind player (very generous)

// Colors — Mario-inspired palette
export const COLORS = {
  // Sky gradient
  sky: "#4EC5F1",
  skyTop: "#4EC5F1",
  skyBottom: "#B5E8FB",

  // Ground
  ground: "#7B5B3A",
  groundDark: "#5C3D1E",
  groundTop: "#4CAF50",
  groundGrassHighlight: "#66BB6A",

  // Platforms
  platform: "#8D6E40",
  platformDark: "#6B5030",
  platformTop: "#4CAF50",
  platformTopHighlight: "#66BB6A",

  // Player (Mario-red)
  player: "#E53935",
  playerDark: "#B71C1C",
  playerSkin: "#FFCCBC",
  playerEyes: "#FFFFFF",

  // Coin
  coin: "#FFC107",
  coinHighlight: "#FFE082",
  coinOutline: "#FF8F00",

  // Enemy
  enemy: "#9C27B0",
  enemyDark: "#6A1B9A",
  enemyEyes: "#FFFFFF",

  // UI
  heart: "#E53935",
};
