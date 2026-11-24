import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Material } from '@babylonjs/core/Materials/material';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import { ShapeGeometry, type BufferGeometry } from 'three';
import { buildingChunks, shape } from './geometry';
import { roadsGeometry } from './roadsGeometry';
import type { City } from '../geo/types';

export function material(scene: Scene, name: string, color: string) {
  const result = new StandardMaterial(name, scene);
  result.diffuseColor = Color3.FromHexString(color);
  result.specularColor.set(0.06, 0.06, 0.06);
  return result;
}

/** Keep the proven polygon triangulation, uploading its buffers to Babylon once. */
export function geometryMesh(scene: Scene, name: string, geometry: BufferGeometry) {
  const mesh = new Mesh(name, scene);
  // Three's buffers have right-handed, counterclockwise triangles; Babylon's
  // procedural primitives use the opposite convention even in a RH scene.
  mesh.sideOrientation = Material.CounterClockWiseSideOrientation;
  const vertices = new VertexData();
  const positions = geometry.getAttribute('position');
  vertices.positions = Float32Array.from(positions.array);
  vertices.normals = Float32Array.from(geometry.getAttribute('normal').array);
  vertices.indices = geometry.index
    ? Uint32Array.from(geometry.index.array)
    : Uint32Array.from({ length: positions.count }, (_, i) => i);
  const colors = geometry.getAttribute('color');
  if (colors) {
    const rgba = new Float32Array(colors.count * 4);
    for (let i = 0; i < colors.count; i++) {
      rgba.set([colors.getX(i), colors.getY(i), colors.getZ(i), 1], i * 4);
    }
    vertices.colors = rgba;
  }
  vertices.applyToMesh(mesh);
  geometry.dispose();
  mesh.isPickable = false;
  mesh.freezeWorldMatrix();
  return mesh;
}

export function createCityWorld(scene: Scene, city: City) {
  const ground = CreateGround('ground', { width: 6000, height: 6000 }, scene);
  ground.material = material(scene, 'ground-material', '#c5c5ae');
  ground.isPickable = false;
  ground.freezeWorldMatrix();
  const areaMaterials = {
    green: material(scene, 'green', '#7f9569'),
    water: material(scene, 'water', '#83a6ad'),
    paved: material(scene, 'paved', '#bbb4a3'),
  };
  for (const area of city.areas) {
    const geometry = new ShapeGeometry(shape(area.points, area.holes));
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, 0.025, 0);
    const mesh = geometryMesh(scene, `area-${area.id}`, geometry);
    mesh.material = area.kind === 'green' ? areaMaterials.green
      : area.kind === 'water' ? areaMaterials.water : areaMaterials.paved;
  }
  for (const drivable of [false, true]) {
    const mesh = geometryMesh(scene, drivable ? 'roads' : 'paths', roadsGeometry(city, drivable));
    const surface = material(scene, `${mesh.name}-material`, drivable ? '#626b68' : '#bcb5a5');
    surface.backFaceCulling = false;
    mesh.material = surface;
  }
  const buildings = material(scene, 'buildings-material', '#ffffff');
  for (const { key, geometry } of buildingChunks(city.buildings)) {
    geometryMesh(scene, `buildings-${key}`, geometry).material = buildings;
  }
}
