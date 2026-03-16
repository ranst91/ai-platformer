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
