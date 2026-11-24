import type { City } from '../geo/types';
import { collides } from './physics';
import { buildingIndex } from './spatialIndex';

export interface CameraPoint { x: number; y: number; z: number }
// Larger than the camera near plane; conservative cylindrical clearance.
export const CAMERA_CLEARANCE = 0.4;

/** Shorten the camera boom from an anchor above the car, preserving courtyards. */
export function cameraTravelFraction(anchor: CameraPoint, desired: CameraPoint, city: City): number {
  const radius = CAMERA_CLEARANCE;
  const candidates = buildingIndex(city.buildings).query([
    Math.min(anchor.x, desired.x) - radius, Math.min(anchor.z, desired.z) - radius,
    Math.max(anchor.x, desired.x) + radius, Math.max(anchor.z, desired.z) + radius,
  ]);
  if (!candidates.length) return 1;
  const dx = desired.x - anchor.x, dy = desired.y - anchor.y, dz = desired.z - anchor.z;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy, dz) / 0.2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = anchor.y + dy * t;
    if (candidates.some(building => y + radius >= 0 && y - radius <= building.height &&
      collides(anchor.x + dx * t, anchor.z + dz * t, [building], radius))) {
      // Keep one additional sample of clearance to cover contacts between samples.
      return Math.max(0, (i - 2) / steps);
    }
  }
  return 1;
}
