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
