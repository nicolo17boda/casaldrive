import { BufferGeometry, Float32BufferAttribute } from "three";
import type { City } from "../geo/types";
export function roadsGeometry(city: City, drivable: boolean) {
  const vertices: number[] = [];
  for (const road of city.roads.filter((r) => r.drivable === drivable)) {
    const w = road.width / 2;
    for (let i = 1; i < road.points.length; i++) {
      const [x, z] = road.points[i - 1],
        [u, v] = road.points[i],
        len = Math.hypot(u - x, v - z);
      if (!len) continue;
      const nx = (-(v - z) / len) * w,
        nz = ((u - x) / len) * w;
      const a = [x + nx, 0.06, z + nz],
        b = [u + nx, 0.06, v + nz],
        c = [u - nx, 0.06, v - nz],
        d = [x - nx, 0.06, z - nz];
      vertices.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
    // Coplanar opaque disks join segments without depth fighting or gaps.
    for (const [x, z] of road.points)
      for (let j = 0; j < 12; j++)
        vertices.push(
          x,
          0.06,
          z,
          x + Math.cos((-j * Math.PI) / 6) * w,
          0.06,
          z + Math.sin((-j * Math.PI) / 6) * w,
          x + Math.cos((-(j + 1) * Math.PI) / 6) * w,
          0.06,
          z + Math.sin((-(j + 1) * Math.PI) / 6) * w,
        );
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  g.computeVertexNormals();
  return g;
}
