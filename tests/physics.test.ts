import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createVehicle,
  emptyControls,
  stepVehicle,
  collides,
} from "../src/game/physics";
import { testWorld } from "../src/geo/loaders";
import { project, ORIGIN } from "../src/geo/coordinates";
const city = testWorld();
function drive(input: Partial<ReturnType<typeof emptyControls>>, seconds = 1) {
  const s = createVehicle(city.spawn);
  for (let i = 0; i < seconds * 120; i++)
    stepVehicle(s, { ...emptyControls(), ...input }, 1 / 120, city);
  return s;
}
test("one world unit is one metre, north is negative Z", () => {
  assert.deepEqual(project(...ORIGIN), [0, -0]);
  const north = project(ORIGIN[0], ORIGIN[1] + 0.001);
  assert.ok(Math.abs(north[1] + 111.319) < 0.01);
});
test("forward follows negative Z; reverse follows positive Z", () => {
  assert.ok(drive({ throttle: true }).z < city.spawn.z);
  assert.ok(drive({ brake: true }).z > city.spawn.z);
});
test("left steering turns toward negative X", () => {
  assert.ok(drive({ throttle: true, left: true }, 2).x < 0);
  assert.ok(drive({ throttle: true, right: true }, 2).x > 0);
});
test("braking stops faster than coasting", () => {
  const a = drive({ throttle: true }, 2),
    b = { ...a };
  for (let i = 0; i < 60; i++) {
    stepVehicle(a, emptyControls(), 1 / 120, city);
    stepVehicle(b, { ...emptyControls(), brake: true }, 1 / 120, city);
  }
  assert.ok(b.speed < a.speed);
});
test("forward speed limit is enforced", () => {
  const large = {
    ...city,
    buildings: [],
    bounds: [-10000, -10000, 10000, 10000] as [number, number, number, number],
  };
  const s = createVehicle(city.spawn);
  for (let i = 0; i < 10000; i++)
    stepVehicle(s, { ...emptyControls(), throttle: true }, 1 / 120, large, 60);
  assert.ok(s.speed <= 60 / 3.6);
  assert.ok(s.speed > 16);
});
test("footprint collisions include edges and stop a moving vehicle", () => {
  assert.equal(collides(40, -30, city.buildings), true);
  assert.equal(collides(29, -30, city.buildings), true);
  assert.equal(collides(0, 0, city.buildings), false);
  const s = createVehicle({ x: 40, z: 0, yaw: 0 });
  for (let i = 0; i < 600; i++)
    stepVehicle(s, { ...emptyControls(), throttle: true }, 1 / 120, city);
  assert.ok(s.z >= -17.9);
  assert.ok(s.collision);
});
test("handbrake dissipates speed", () => {
  const a = drive({ throttle: true }, 2),
    b = { ...a };
  for (let i = 0; i < 60; i++) {
    stepVehicle(a, emptyControls(), 1 / 120, city);
    stepVehicle(b, { ...emptyControls(), handbrake: true }, 1 / 120, city);
  }
  assert.ok(Math.abs(b.speed) < Math.abs(a.speed));
});

test('reverse speed remains limited', () => {
  const s = createVehicle(city.spawn);
  const open = {...city, buildings: [], bounds: [-10000,-10000,10000,10000] as [number,number,number,number]};
  for(let i=0;i<2400;i++) stepVehicle(s,{...emptyControls(),brake:true},1/120,open);
  assert.ok(s.speed >= -8);
  assert.ok(s.speed < -7);
});
