import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { roadsGeometry } from '../src/world/roadsGeometry';
import { geometryMesh } from '../src/world/babylonWorld';
import type { City } from '../src/geo/types';

test('asphalt UVs keep the same metre scale across turns, joins and negative coordinates after compaction', () => {
  const city: City = { name: 'junction', real: false, origin: [0,0], bounds: [-30,-30,30,30],
    spawn: { x: 0, z: 0, yaw: 0 }, buildings: [], areas: [], roads: [
      { id: 1, name: 'bend', width: 6, drivable: true, points: [[-20,-10],[0,0],[20,0]] },
      { id: 2, name: 'crossing', width: 4, drivable: true, points: [[0,-20],[0,20]] },
    ] };
  const engine = new NullEngine();
  const scene = new Scene(engine);
  try {
    const mesh = geometryMesh(scene, 'roads', roadsGeometry(city, true));
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
    const uv = mesh.getVerticesData(VertexBuffer.UVKind)!;
    assert.equal(uv.length, mesh.getTotalVertices() * 2);
    for (let i = 0; i < mesh.getTotalVertices(); i++) {
      assert.ok(Math.abs(uv[i * 2] - positions[i * 3] / 4) < 1e-6);
      assert.ok(Math.abs(uv[i * 2 + 1] - positions[i * 3 + 2] / 4) < 1e-6);
    }
  } finally { scene.dispose(); engine.dispose(); }
});
