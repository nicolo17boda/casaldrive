import type { Point } from "./types";
export const ORIGIN: Point = [8.4524, 45.1372];
export function project(lon: number, lat: number, origin = ORIGIN): Point {
  const rad = Math.PI / 180;
  return [
    (lon - origin[0]) * rad * 6378137 * Math.cos(origin[1] * rad),
    -(lat - origin[1]) * rad * 6378137,
  ];
}
