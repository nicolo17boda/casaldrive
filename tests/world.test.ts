import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { buildingChunks } from '../src/world/geometry';
import type { City } from '../src/geo/types';

test('batched buildings preserve metre scale, roof height and open courtyards', () => {
  const chunks = buildingChunks([{ id: 1, height: 12,
    points: [[0,0],[20,0],[20,20],[0,20]],
    holes: [[[5,5],[15,5],[15,15],[5,15]]],
  }]);
  const geometry = chunks[0].geometry;
  geometry.computeBoundingBox();
  assert.ok(Math.abs(geometry.boundingBox!.max.y - 12) < 1e-6);
  assert.equal(geometry.boundingBox!.max.z, 20);
  const material = new MeshBasicMaterial();
  const mesh = new Mesh(geometry, material);
  const courtyard = new Raycaster(new Vector3(10, 30, 10), new Vector3(0,-1,0));
  assert.equal(courtyard.intersectObject(mesh).length, 0);
  const roof = new Raycaster(new Vector3(2, 30, 2), new Vector3(0,-1,0));
  assert.ok(roof.intersectObject(mesh).some(hit => Math.abs(hit.point.y - 12) < 1e-6));
  const colors = geometry.getAttribute('color');
  const normals = geometry.getAttribute('normal');
  let roofIndex = -1, wallIndex = -1;
  for (let i = 0; i < normals.count; i++) {
    if (normals.getY(i) > .99) roofIndex = i;
    if (Math.abs(normals.getY(i)) < .01) wallIndex = i;
  }
  assert.ok(roofIndex >= 0 && wallIndex >= 0);
  assert.notEqual(colors.getX(roofIndex), colors.getX(wallIndex));
  geometry.dispose(); material.dispose();
});

test('real city batches have finite bounds and substantially fewer building meshes', () => {
  const city: City = JSON.parse(readFileSync('public/data/city.json', 'utf8'));
  const chunks = buildingChunks(city.buildings);
  assert.ok(chunks.length > 1 && chunks.length < city.buildings.length / 5);
  for (const { geometry } of chunks) {
    assert.ok(Number.isFinite(geometry.boundingSphere!.radius));
    assert.equal(geometry.getAttribute('position').count, geometry.getAttribute('color').count);
    geometry.dispose();
  }
});
