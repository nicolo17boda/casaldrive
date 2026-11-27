import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EngineModel } from '../src/game/engineModel';
import { emptyControls } from '../src/game/physics';

test('idle is stable; throttle increases launch revs and load', () => {
  const engine = new EngineModel();
  const controls = emptyControls();
  for (let i = 0; i < 120; i++) engine.update(0, controls, 1 / 60);
  assert.equal(engine.rpm, 850);
  assert.equal(engine.load, 0);
  controls.throttle = true;
  for (let i = 0; i < 120; i++) engine.update(0, controls, 1 / 60);
  assert.ok(engine.rpm > 1490 && engine.rpm <= 1500);
  assert.ok(engine.load > 0.99);
});

test('acceleration shifts up with a rev drop and no gear hunting at steady speed', () => {
  const engine = new EngineModel();
  const controls = { ...emptyControls(), throttle: true };
  let shifts = 0;
  for (let i = 0; i < 1200; i++) {
    const gear = engine.gear;
    const rpm = engine.rpm;
    engine.update(i / 1200 * 39, controls, 1 / 60);
    if (engine.gear > gear) {
      shifts++;
      assert.ok(engine.shiftRemaining > 0);
      assert.ok(engine.rpm < rpm);
    }
    assert.ok(engine.rpm >= 850 && engine.rpm <= 7200);
  }
  assert.ok(shifts >= 3);
  const gear = engine.gear;
  for (let i = 0; i < 600; i++) {
    engine.update(39, controls, 1 / 60);
    assert.equal(engine.gear, gear);
  }
});

test('braking unloads engine, reverse uses S, and stopping resets transmission', () => {
  const engine = new EngineModel();
  for (let i = 0; i < 300; i++) engine.update(30, { ...emptyControls(), throttle: true }, 1 / 60);
  assert.ok(engine.gear > 0);
  for (let i = 0; i < 120; i++) engine.update(20, { ...emptyControls(), brake: true }, 1 / 60);
  assert.ok(engine.load < 0.01);
  for (let i = 0; i < 120; i++) engine.update(-8, { ...emptyControls(), brake: true }, 1 / 60);
  assert.equal(engine.gear, 0);
  assert.ok(engine.load > 0.99);
  assert.ok(engine.rpm > 3000 && engine.rpm < 3300);
  for (let i = 0; i < 120; i++) engine.update(0, emptyControls(), 1 / 60);
  assert.ok(engine.rpm < 851);
  assert.equal(engine.shiftRemaining, 0);
});

test('engine response is consistent across frame rates and bounded after stalls', () => {
  const a = new EngineModel(), b = new EngineModel();
  const controls = { ...emptyControls(), throttle: true };
  for (let i = 0; i < 30; i++) a.update(5, controls, 1 / 30);
  for (let i = 0; i < 144; i++) b.update(5, controls, 1 / 144);
  assert.ok(Math.abs(a.rpm - b.rpm) < 0.001);
  a.update(1000, controls, 100);
  assert.ok(Number.isFinite(a.rpm) && a.rpm <= 7200);
});


test('turbo spools under load and vents once on throttle release', () => {
  const engine = new EngineModel();
  const throttle = { ...emptyControls(), throttle: true };
  for (let i = 0; i < 240; i++) engine.update(24, throttle, 1 / 60);
  assert.ok(engine.boost > 0.8);
  engine.update(24, emptyControls(), 1 / 60);
  assert.ok(engine.blowoff > 0.8);
  for (let i = 0; i < 120; i++) engine.update(24, emptyControls(), 1 / 60);
  assert.ok(engine.boost < 0.01);
  assert.ok(engine.blowoff < 0.01);
});
