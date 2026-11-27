import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Material } from '@babylonjs/core/Materials/material';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import { ShapeGeometry, type BufferGeometry } from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildingChunks, shape } from './geometry';
import { roadsGeometry } from './roadsGeometry';
import { asphaltTextures } from './asphalt';
import type { City } from '../geo/types';

export function material(scene: Scene, name: string, color: string) {
  const result = new StandardMaterial(name, scene);
  result.diffuseColor = Color3.FromHexString(color);
  result.specularColor.set(0.06, 0.06, 0.06);
  return result;
}

/** Keep the proven polygon triangulation, uploading its buffers to Babylon once. */
export function geometryMesh(scene: Scene, name: string, geometry: BufferGeometry) {
  // Merge only vertices whose complete attributes match: roof/wall normals and
  // colors remain separate, so sharp edges and courtyard geometry are preserved.
  const compact = mergeVertices(geometry, 1e-6);
  geometry.dispose();
  geometry = compact;
  const mesh = new Mesh(name, scene);
  // Three's buffers have right-handed, counterclockwise triangles; Babylon's
  // procedural primitives use the opposite convention even in a RH scene.
  mesh.sideOrientation = Material.CounterClockWiseSideOrientation;
  const vertices = new VertexData();
  const positions = geometry.getAttribute('position');
  vertices.positions = Float32Array.from(positions.array);
  vertices.normals = Float32Array.from(geometry.getAttribute('normal').array);
  const uv = geometry.getAttribute('uv');
  if (uv) vertices.uvs = Float32Array.from(uv.array);
  const IndexArray = positions.count <= 65536 ? Uint16Array : Uint32Array;
  vertices.indices = IndexArray.from(geometry.index!.array);
  const colors = geometry.getAttribute('color');
  if (colors) {
    const rgba = new Float32Array(colors.count * 4);
    for (let i = 0; i < colors.count; i++) {
      rgba[i * 4] = colors.getX(i);
      rgba[i * 4 + 1] = colors.getY(i);
      rgba[i * 4 + 2] = colors.getZ(i);
      rgba[i * 4 + 3] = 1;
    }
    vertices.colors = rgba;
  }
  vertices.applyToMesh(mesh);
  geometry.dispose();
  mesh.isPickable = false;
  mesh.freezeWorldMatrix();
  mesh.doNotSyncBoundingInfo = true;
  mesh.receiveShadows = true;
  return mesh;
}

export function createCityWorld(scene: Scene, city: City) {
  const ground = CreateGround('ground', { width: 6000, height: 6000 }, scene);
  ground.material = material(scene, 'ground-material', '#c5c5ae');
  ground.isPickable = false;
  ground.freezeWorldMatrix();
  ground.doNotSyncBoundingInfo = true;
  ground.receiveShadows = true;
  const areaMaterials = {
    green: material(scene, 'green', '#7f9569'),
    water: material(scene, 'water', '#83a6ad'),
    paved: material(scene, 'paved', '#bbb4a3'),
  };
  const areaBatches = new Map<string, { kind: City['areas'][number]['kind']; parts: BufferGeometry[] }>();
  for (const area of city.areas) {
    const geometry = new ShapeGeometry(shape(area.points, area.holes));
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, 0.025, 0);
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox!;
    // Same 200 m grid as buildings; retain useful frustum culling when driving.
    const key = `${area.kind}-${Math.floor((bounds.min.x + bounds.max.x) / 400)},${Math.floor((bounds.min.z + bounds.max.z) / 400)}`;
    const batch = areaBatches.get(key) ?? { kind: area.kind, parts: [] };
    batch.parts.push(geometry);
    areaBatches.set(key, batch);
  }
  for (const [key, { kind, parts }] of areaBatches) {
    const merged = mergeGeometries(parts, false)!;
    parts.forEach(part => part.dispose());
    const mesh = geometryMesh(scene, `areas-${key}`, merged);
    mesh.material = kind === 'green' ? areaMaterials.green
      : kind === 'water' ? areaMaterials.water : areaMaterials.paved;
  }
  // Concrete shoulders make source-backed bridge decks visible over water.
  const bridgeCity = { ...city, roads: city.roads.filter(r => r.bridge).map(r => ({...r, width:r.width+1, drivable:true})) };
  if (bridgeCity.roads.length) {
    const deck = roadsGeometry(bridgeCity, true);
    deck.translate(0, -0.015, 0);
    geometryMesh(scene, 'bridge-decks', deck).material = material(scene, 'bridge-concrete', '#acb3b5');
  }
  for (const drivable of [false, true]) {
    const mesh = geometryMesh(scene, drivable ? 'roads' : 'paths', roadsGeometry(city, drivable));
    const surface = material(scene, `${mesh.name}-material`, drivable ? '#303238' : '#bcb5a5');
    if (drivable) {
      const textures = asphaltTextures(scene);
      surface.diffuseTexture = textures.diffuse;
      surface.bumpTexture = textures.normal;
      surface.specularColor.set(0.025, 0.025, 0.025);
      surface.specularPower = 48;
    }
    surface.backFaceCulling = false;
    mesh.material = surface;
  }
  const buildings = material(scene, 'buildings-material', '#ffffff');
  for (const { key, geometry } of buildingChunks(city.buildings)) {
    geometryMesh(scene, `buildings-${key}`, geometry).material = buildings;
  }
}
