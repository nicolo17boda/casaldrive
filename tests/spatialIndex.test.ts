import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BuildingIndex, buildingIndex } from '../src/game/spatialIndex';
import { CAR_HALF_LENGTH, CAR_HALF_WIDTH, vehicleCollides } from '../src/game/collision';
import type { Building, City } from '../src/geo/types';

test('index covers negative coordinates, cell boundaries and large buildings without duplicates', () => {
  const building: Building = { id: 1, height: 10, points: [[-64,-32],[64,-32],[64,32],[-64,32]] };
  const index = new BuildingIndex([building]);
  for (const x of [-64, -32, 0, 32, 64]) assert.deepEqual(index.query([x,-32,x,32]), [building]);
  assert.deepEqual(index.query([-100,-100,100,100]), [building]);
  assert.deepEqual(index.query([65,-32,70,32]), []);
});

test('indexes are reused for static geometry and replaced for a new dataset', () => {
  const buildings: Building[] = [];
  assert.equal(buildingIndex(buildings), buildingIndex(buildings));
  assert.notEqual(buildingIndex(buildings), buildingIndex([]));
});

test('indexed contacts match a full scan across the real city and reduce candidates', () => {
  const city: City = JSON.parse(readFileSync('public/data/city.json', 'utf8'));
  const index = buildingIndex(city.buildings);
  const radius = Math.hypot(CAR_HALF_WIDTH, CAR_HALF_LENGTH);
  let total = 0, samples = 0;
  const [left, top, right, bottom] = city.bounds;
  for (let x = left; x <= right; x += 17) {
    for (let z = top; z <= bottom; z += 17) {
      const candidates = index.query([x-radius,z-radius,x+radius,z+radius]);
      total += candidates.length; samples++;
      for (const yaw of [0, .7, Math.PI / 2]) {
        assert.equal(vehicleCollides(x,z,yaw,candidates), vehicleCollides(x,z,yaw,city.buildings), `pose ${x},${z},${yaw}`);
      }
    }
  }
  assert.ok(total / samples < city.buildings.length / 10);
});
