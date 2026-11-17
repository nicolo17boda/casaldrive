import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vehicleCollides, moveVehicle } from '../src/game/collision';
import { createVehicle, emptyControls, stepVehicle } from '../src/game/physics';
import { testWorld } from '../src/geo/loaders';
import type { Building, City } from '../src/geo/types';
const box = (id: number, x: number, z: number, w: number, d: number): Building => ({
  id, height: 10, points: [[x,z],[x+w,z],[x+w,z+d],[x,z+d]],
});
const world = (buildings: Building[]): City => ({ ...testWorld(), buildings, bounds: [-100,-100,100,100] });

test('car fits a 2.8 m alley but cannot turn broadside inside it', () => {
  const buildings = [box(1,-12,-50,10.6,100),box(2,1.4,-50,10,100)];
  assert.equal(vehicleCollides(0,0,0,buildings), false);
  assert.equal(vehicleCollides(0,0,Math.PI/2,buildings), true);
  const moved = moveVehicle({x:0,z:20,yaw:0},0,-40,0,world(buildings));
  assert.equal(moved.collision, false);
  assert.ok(Math.abs(moved.z + 20) < 1e-6);
});

test('a fast move cannot cross a thin wall in either direction', () => {
  const city = world([box(1,-20,-.05,40,.1)]);
  for (const direction of [-1,1]) {
    const moved = moveVehicle({x:0,z:direction*10,yaw:0},0,-direction*30,0,city);
    assert.equal(moved.collision,true);
    assert.ok(direction * moved.z >= 2.15);
    assert.equal(vehicleCollides(moved.x,moved.z,moved.yaw,city.buildings),false);
  }
});

test('grazing a wall preserves tangential travel; turning cannot embed corners', () => {
  const city = world([box(1,1.2,-50,10,100)]);
  const moved = moveVehicle({x:0,z:10,yaw:0},3,-10,0,city);
  assert.ok(moved.collision);
  assert.ok(moved.z < 1);
  assert.ok(moved.x < .15);
  const turned = moveVehicle({x:0,z:0,yaw:0},0,0,Math.PI/2,city);
  assert.ok(turned.collision);
  assert.equal(vehicleCollides(turned.x,turned.z,turned.yaw,city.buildings),false);
});

test('courtyards stay traversable and tiny obstacles inside the car are detected', () => {
  const b = box(1,-20,-20,40,40);
  b.holes = [[[-5,-5],[5,-5],[5,5],[-5,5]]];
  assert.equal(vehicleCollides(0,0,.5,[b]),false);
  assert.equal(vehicleCollides(4,0,0,[b]),true);
  assert.equal(vehicleCollides(0,0,0,[box(2,-.1,-.1,.2,.2)]),true);
});

test('world limits contain the whole rotated vehicle', () => {
  const city = world([]);
  const moved = moveVehicle({x:95,z:0,yaw:Math.PI/2},20,0,0,city);
  assert.ok(moved.collision);
  assert.ok(moved.x <= 97.9);
});

test('frontal contact stops the car and reverse lets it back away', () => {
  const city = world([box(1,-20,-10,40,1)]);
  const vehicle = createVehicle({x:0,z:0,yaw:0});
  for (let i=0;i<600;i++) stepVehicle(vehicle,{...emptyControls(),throttle:true},1/120,city);
  assert.ok(vehicle.collision);
  assert.ok(Math.abs(vehicle.speed)<.1);
  const stopped = vehicle.z;
  for (let i=0;i<120;i++) stepVehicle(vehicle,{...emptyControls(),brake:true},1/120,city);
  assert.ok(vehicle.z > stopped + 1);
  assert.equal(vehicle.collision,false);
});
