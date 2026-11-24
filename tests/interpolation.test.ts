import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_STEP, MotionInterpolator } from '../src/game/interpolation';
import { createVehicle } from '../src/game/physics';

test('render motion progresses smoothly between fixed ticks', () => {
  const state = createVehicle({x:0,z:0,yaw:0});
  const motion = new MotionInterpolator(state);
  const step = () => { state.x += 1; };
  motion.advance(state, FIXED_STEP, false, step);
  assert.equal(state.x, 1);
  assert.equal(motion.pose.x, 0);
  motion.advance(state, FIXED_STEP / 2, false, step);
  assert.equal(state.x, 1);
  assert.ok(Math.abs(motion.pose.x - 0.5) < 1e-9);
});
test('pause freezes rendering; reset snaps without travelling across the world', () => {
  const state = createVehicle({x:0,z:0,yaw:0});
  const motion = new MotionInterpolator(state);
  const step = () => { state.x += 1; };
  motion.advance(state, FIXED_STEP * 1.5, false, step);
  const before = motion.pose.x;
  motion.advance(state, 10, true, step);
  assert.equal(motion.pose.x, before);
  state.x = 200;
  motion.advance(state, 0, true, step);
  assert.equal(motion.pose.x, 200);
});
test('long stalls have bounded catch-up work', () => {
  const state = createVehicle({x:0,z:0,yaw:0});
  const motion = new MotionInterpolator(state);
  let ticks = 0;
  motion.advance(state, 30, false, () => { ticks++; });
  assert.ok(ticks <= 12);
});
