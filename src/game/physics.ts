import type { Building, City, Point } from "../geo/types";
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
export function inside(x: number, z: number, points: Point[]) {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i],
      b = points[j];
    if (
      a[1] > z !== b[1] > z &&
      x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
    )
      hit = !hit;
  }
  return hit;
}
const boundsCache = new WeakMap<Building, [number, number, number, number]>();
function buildingBounds(b: Building) {
  let bounds = boundsCache.get(b);
  if (!bounds) {
    bounds = [
      Math.min(...b.points.map((p) => p[0])),
      Math.min(...b.points.map((p) => p[1])),
      Math.max(...b.points.map((p) => p[0])),
      Math.max(...b.points.map((p) => p[1])),
    ];
    boundsCache.set(b, bounds);
  }
  return bounds;
}
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
  s.yaw +=
    s.steering *
    (s.speed / 2.7) *
    (0.48 / (1 + Math.abs(s.speed) * 0.09)) *
    dt *
    (c.handbrake ? 1.5 : 1);
  const grip = 1 - Math.exp(-(c.handbrake ? 2 : 12) * dt);
  s.vx += (-Math.sin(s.yaw) * s.speed - s.vx) * grip;
  s.vz += (-Math.cos(s.yaw) * s.speed - s.vz) * grip;
  const x = s.x + s.vx * dt,
    z = s.z + s.vz * dt;
  const [minX, minZ, maxX, maxZ] = city.bounds;
  s.collision =
    collides(x, z, city.buildings) ||
    x < minX + 3 ||
    x > maxX - 3 ||
    z < minZ + 3 ||
    z > maxZ - 3;
  if (s.collision) {
    s.speed = 0;
    s.vx = 0;
    s.vz = 0;
  } else {
    s.distance += Math.hypot(x - s.x, z - s.z);
    s.x = x;
    s.z = z;
  }
}
