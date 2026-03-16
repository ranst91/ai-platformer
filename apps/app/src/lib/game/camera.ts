// apps/app/src/lib/game/camera.ts

import { CANVAS_WIDTH, CAMERA_LEAD, CAMERA_SMOOTHING } from "./constants";

export interface Camera {
  x: number;
}

export function createCamera(): Camera {
  return { x: 0 };
}

/**
 * Smooth-follow camera.
 *
 * Target: position the player at CAMERA_LEAD pixels from the left edge.
 *   targetCameraX = playerX - CAMERA_LEAD
 *
 * Exponential decay (dt-weighted):
 *   factor = 1 - (1 - CAMERA_SMOOTHING)^(dt * 60)
 *
 * The camera only scrolls right — it never moves left.
 */
export function updateCamera(camera: Camera, playerX: number, dt: number): void {
  const targetX = playerX - CAMERA_LEAD;

  // Only chase if the target is ahead (to the right) of current position
  if (targetX <= camera.x) return;

  const factor = 1 - Math.pow(1 - CAMERA_SMOOTHING, dt * 60);
  camera.x += (targetX - camera.x) * factor;
}

/**
 * Returns true if the world-space range [worldX, worldX + width) is
 * at least partially visible given the current camera position.
 */
export function isVisible(camera: Camera, worldX: number, width: number): boolean {
  const screenLeft = worldX - camera.x;
  const screenRight = screenLeft + width;
  return screenRight > 0 && screenLeft < CANVAS_WIDTH;
}
