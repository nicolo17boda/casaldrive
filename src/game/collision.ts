import type { Building, City, Point } from '../geo/types';
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


// Includes the wheels and a small clearance around the 1.8 × 4.1 m body.
export const CAR_HALF_WIDTH = 1.05;
export const CAR_HALF_LENGTH = 2.1;
const RADIUS = Math.hypot(CAR_HALF_WIDTH, CAR_HALF_LENGTH);
const boundsCache = new WeakMap<Building, number[]>();

function bounds(building: Building) {
  let box = boundsCache.get(building);
  if (!box) {
    box = [Math.min(...building.points.map(p => p[0])), Math.min(...building.points.map(p => p[1])),
      Math.max(...building.points.map(p => p[0])), Math.max(...building.points.map(p => p[1]))];
    boundsCache.set(building, box);
  }
  return box;
}

/** Segment / local car rectangle intersection (including endpoints inside). */
function intersectsCar(a: Point, b: Point) {
  let enter = 0, exit = 1;
  for (const axis of [0, 1] as const) {
    const half = axis === 0 ? CAR_HALF_WIDTH : CAR_HALF_LENGTH;
    const delta = b[axis] - a[axis];
    if (Math.abs(delta) < 1e-10) {
      if (Math.abs(a[axis]) > half) return false;
    } else {
      const t1 = (-half - a[axis]) / delta, t2 = (half - a[axis]) / delta;
      enter = Math.max(enter, Math.min(t1, t2));
      exit = Math.min(exit, Math.max(t1, t2));
      if (enter > exit) return false;
    }
  }
  return true;
}

export function vehicleCollides(x: number, z: number, yaw: number, buildings: Building[], worldBounds?: City['bounds']) {
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  const corners: Point[] = [];
  for (const side of [-1, 1]) for (const end of [-1, 1]) {
    corners.push([x + side * CAR_HALF_WIDTH * cos + end * CAR_HALF_LENGTH * sin,
      z - side * CAR_HALF_WIDTH * sin + end * CAR_HALF_LENGTH * cos]);
  }
  if (worldBounds && corners.some(([u,v]) => u < worldBounds[0] || v < worldBounds[1] || u > worldBounds[2] || v > worldBounds[3])) return true;
  return buildings.some(building => {
    const [left, top, right, bottom] = bounds(building);
    if (x + RADIUS < left || x - RADIUS > right || z + RADIUS < top || z - RADIUS > bottom) return false;
    const holes = building.holes ?? [];
    if (corners.some(([u,v]) => inside(u,v,building.points) && !holes.some(hole => inside(u,v,hole)))) return true;
    const local = ([u,v]: Point): Point => [(u-x)*cos - (v-z)*sin, (u-x)*sin + (v-z)*cos];
    return [building.points, ...holes].some(ring => ring.some((a,i) =>
      intersectsCar(local(a), local(ring[(i+1) % ring.length]))));
  });
}

/** Sweep in short translation/rotation increments, retaining tangential movement. */
export function moveVehicle(pose: { x: number; z: number; yaw: number }, dx: number, dz: number, turn: number, city: City) {
  const steps = Math.max(1, Math.ceil((Math.hypot(dx,dz) + Math.abs(turn) * RADIUS) / 0.2));
  const sx = dx / steps, sz = dz / steps, syaw = turn / steps;
  let { x, z, yaw } = pose;
  let collision = false;
  let distance = 0;
  const blocked = (u: number,v: number,angle: number) => vehicleCollides(u,v,angle,city.buildings,city.bounds);
  for (let i = 0; i < steps; i++) {
    const previousX = x, previousZ = z;
    if (!blocked(x + sx, z + sz, yaw + syaw)) {
      x += sx; z += sz; yaw += syaw;
    } else {
      collision = true;
      // Reject unsafe rotation too: steering must never rotate corners into walls.
      if (!blocked(x, z, yaw + syaw)) yaw += syaw;
      if (!blocked(x + sx, z + sz, yaw)) { x += sx; z += sz; }
      else {
        // Preserve the free component when grazing a wall; never teleport out.
        if (!blocked(x + sx, z, yaw)) x += sx;
        if (!blocked(x, z + sz, yaw)) z += sz;
      }
    }
    distance += Math.hypot(x - previousX, z - previousZ);
  }
  return { x, z, yaw, collision, distance };
}
