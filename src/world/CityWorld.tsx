import { memo, useMemo } from "react";
import {
  BufferGeometry,
  Float32BufferAttribute,
  ShapeGeometry,
} from "three";
import { buildingChunks, shape } from "./geometry";
import type { City } from "../geo/types";
function roadsGeometry(city: City, drivable: boolean) {
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
const CityWorld = memo(function CityWorld({ city }: { city: City }) {
  const buildings = useMemo(() => buildingChunks(city.buildings), [city]);
  const asphalt = useMemo(() => roadsGeometry(city, true), [city]);
  const paths = useMemo(() => roadsGeometry(city, false), [city]);
  const areas = useMemo(() => city.areas.map(a => ({...a, geometry: new ShapeGeometry(shape(a.points, a.holes))})), [city]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[6000, 6000]} />
        <meshStandardMaterial color="#c5c5ae" />
      </mesh>
      {areas.map((a) => (
        <mesh
          key={a.id}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.025, 0]}
          geometry={a.geometry}
        >
          <meshStandardMaterial
            color={
              a.kind === "green"
                ? "#7f9569"
                : a.kind === "water"
                  ? "#83a6ad"
                  : "#bbb4a3"
            }
            side={2}
          />
        </mesh>
      ))}
      <mesh geometry={paths}>
        <meshStandardMaterial color="#bcb5a5" side={2} />
      </mesh>
      <mesh geometry={asphalt} receiveShadow>
        <meshStandardMaterial color="#626b68" side={2} roughness={1} />
      </mesh>
      {buildings.map(({ key, geometry }) => (
        <mesh key={key} geometry={geometry} castShadow receiveShadow>
          <meshStandardMaterial vertexColors roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
});
export default CityWorld;
