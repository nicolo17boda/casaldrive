import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cameraTravelFraction } from '../src/game/cameraCollision';
import { testWorld } from '../src/geo/loaders';
import type { Building, City } from '../src/geo/types';

const block = (height = 10): Building => ({ id: 1, height,
  points: [[-10,5],[10,5],[10,5.05],[-10,5.05]] });
const city = (buildings: Building[]): City => ({ ...testWorld(), buildings });
const anchor = { x: 0, y: 1.8, z: 0 };

test('camera keeps requested distance in open space and stops before thin walls', () => {
  const desired = { x: 0, y: 5.5, z: 11 };
  assert.equal(cameraTravelFraction(anchor, desired, city([])), 1);
  const t = cameraTravelFraction(anchor, desired, city([block()]));
  assert.ok(t > .3 && t < .42);
  assert.ok(desired.z * t < 4.6);
});

test('camera can see over low buildings but cannot pass through a roof', () => {
  assert.equal(cameraTravelFraction(anchor, { x: 0, y: 28, z: 22 }, city([block(2)])), 1);
  const roof: Building = { id: 2, height: 4, points: [[-5,-5],[5,-5],[5,5],[-5,5]] };
  const t = cameraTravelFraction({ x: 0, y: 10, z: 0 }, { x: 0, y: 2, z: 0 }, city([roof]));
  assert.ok(t > 0 && 10 - 8 * t > 4.4);
});

test('courtyards remain open while inner walls constrain the camera', () => {
  const building: Building = { id: 3, height: 12,
    points: [[-20,-20],[20,-20],[20,20],[-20,20]],
    holes: [[[-5,-5],[5,-5],[5,5],[-5,5]]] };
  assert.equal(cameraTravelFraction(anchor, { x: 0, y: 3, z: 3 }, city([building])), 1);
  assert.ok(cameraTravelFraction(anchor, { x: 0, y: 3, z: 10 }, city([building])) < .46);
});

test('clearance catches grazing walls and handles zero length or obstructed anchors', () => {
  const building = block();
  assert.equal(cameraTravelFraction(anchor, anchor, city([building])), 1);
  const inside = { x: 0, y: 2, z: 5.02 };
  assert.equal(cameraTravelFraction(inside, inside, city([building])), 0);
  assert.ok(cameraTravelFraction({ x: -12, y: 2, z: 4.8 }, { x: 12, y: 2, z: 4.8 }, city([building])) < 1);
});
