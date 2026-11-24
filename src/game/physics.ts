import { inside, moveVehicle } from "./collision";
export { inside } from "./collision";
import type { Building, City } from "../geo/types";
import { buildingBounds } from './spatialIndex';
export interface VehicleState {
  x: number;
  z: number;
  yaw: number;
  speed: number;
  vx: number;
  vz: number;
  steering: number;
  distance: number;
  collision: boolean;
}
export interface Controls {
  throttle: boolean;
  brake: boolean;
  left: boolean;
  right: boolean;
  handbrake: boolean;
}
export const emptyControls = (): Controls => ({
  throttle: false,
  brake: false,
  left: false,
  right: false,
  handbrake: false,
});
export const createVehicle = (spawn: City["spawn"]): VehicleState => ({
  ...spawn,
  speed: 0,
  vx: 0,
  vz: 0,
  steering: 0,
  distance: 0,
  collision: false,
});
export function collides(
  x: number,
  z: number,
  buildings: Building[],
  radius = 2.25,
): boolean {
  return buildings.some((b) => {
    const [minX, minZ, maxX, maxZ] = buildingBounds(b);
    if (
      x < minX - radius ||
      z < minZ - radius ||
      x > maxX + radius ||
      z > maxZ + radius
    )
      return false;
    if (inside(x, z, b.points) && !(b.holes ?? []).some(h => inside(x,z,h))) return true;
    return [b.points, ...(b.holes ?? [])].some(ring => ring.some((a, i) => {
      const c = ring[(i + 1) % ring.length],
        dx = c[0] - a[0],
        dz = c[1] - a[1];
      const t = Math.max(
        0,
        Math.min(
          1,
          ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1),
        ),
      );
      return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz) < radius;
    }));
  });
}
export function stepVehicle(
  s: VehicleState,
  c: Controls,
  dt: number,
  city: City,
  topSpeed = 100,
) {
  const steer = Number(c.left) - Number(c.right);
  s.steering += (steer - s.steering) * (1 - Math.exp(-9 * dt));
  let force = c.throttle ? (s.speed < -0.3 ? 19 : 8.5) : 0;
  if (c.brake) force += s.speed > 0.3 ? -22 : -5;
  s.speed += force * dt;
  s.speed *= Math.exp(-(c.handbrake ? 2.4 : 0.13) * dt);
  if (!c.throttle && !c.brake)
    s.speed = Math.sign(s.speed) * Math.max(0, Math.abs(s.speed) - 0.65 * dt);
  s.speed = Math.max(-8, Math.min(topSpeed / 3.6, s.speed));
  const turn =
    s.steering *
    (s.speed / 2.7) *
    (0.48 / (1 + Math.abs(s.speed) * 0.09)) *
    dt *
    (c.handbrake ? 1.5 : 1);
  const desiredYaw = s.yaw + turn;
  const grip = 1 - Math.exp(-(c.handbrake ? 2 : 12) * dt);
  s.vx += (-Math.sin(desiredYaw) * s.speed - s.vx) * grip;
  s.vz += (-Math.cos(desiredYaw) * s.speed - s.vz) * grip;
  const moved = moveVehicle(s, s.vx * dt, s.vz * dt, turn, city);
  if (moved.collision && dt > 0) {
    s.vx = (moved.x - s.x) / dt;
    s.vz = (moved.z - s.z) / dt;
    s.speed = -Math.sin(moved.yaw) * s.vx - Math.cos(moved.yaw) * s.vz;
  }
  s.x = moved.x;
  s.z = moved.z;
  s.yaw = moved.yaw;
  s.collision = moved.collision;
  s.distance += moved.distance;
}
