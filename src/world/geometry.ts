import { Color, ExtrudeGeometry, Float32BufferAttribute, Path, Shape } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Building, Point } from "../geo/types";

export function shape(points: Point[], holes: Point[][] = []) {
  const s = new Shape();
  points.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
  s.closePath();
  for (const ring of holes) {
    const hole = new Path();
    ring.forEach(([x,z],i) => i ? hole.lineTo(x,-z) : hole.moveTo(x,-z));
    hole.closePath();
    s.holes.push(hole);
  }
  return s;
}

/** Static 200 m batches retain courtyard holes and allow district-level culling. */
export function buildingChunks(buildings: Building[]) {
  const chunks = new Map<string, ExtrudeGeometry[]>();
  const walls = ["#d9c9ae", "#c5b49e", "#d4b494", "#c6bda9", "#e5d6be"].map(c => new Color(c));
  const roofs = ["#ad7158", "#96624f", "#bb8264", "#a97b65", "#b28b75"].map(c => new Color(c));
  for (const building of buildings) {
    const geometry = new ExtrudeGeometry(shape(building.points, building.holes), {
      depth: building.height, bevelEnabled: false,
    });
    const palette = Math.abs(building.id) % walls.length;
    const colors = new Float32Array(geometry.getAttribute("position").count * 3);
    for (const group of geometry.groups) {
      const color = group.materialIndex === 0 ? roofs[palette] : walls[palette];
      for (let i = group.start; i < group.start + group.count; i++) color.toArray(colors, i * 3);
    }
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    geometry.rotateX(-Math.PI / 2);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const key = `${Math.floor((box.min.x + box.max.x) / 400)},${Math.floor((box.min.z + box.max.z) / 400)}`;
    const bucket = chunks.get(key) ?? [];
    bucket.push(geometry);
    chunks.set(key, bucket);
  }
  return [...chunks].map(([key, parts]) => {
    const geometry = mergeGeometries(parts, false)!;
    geometry.computeBoundingSphere();
    parts.forEach(part => part.dispose());
    return { key, geometry };
  });
}
