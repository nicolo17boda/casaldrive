import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DemandRenderLoop } from '../src/game/renderLoop';

function harness(draw: (dt: number) => boolean) {
  const callbacks = new Set<() => void>();
  let time = 0;
  const loop = new DemandRenderLoop(frame => callbacks.add(frame), frame => callbacks.delete(frame), draw, () => time);
  return { loop, callbacks, tick(ms: number) { time += ms; for (const frame of [...callbacks]) frame(); } };
}

test('paused menu finishes shader loading, renders the ready frame, then unregisters RAF', () => {
  let ready = false, frames = 0;
  const h = harness(() => { frames++; return !ready; });
  h.loop.wake();
  h.loop.wake();
  assert.equal(h.callbacks.size, 1);
  h.tick(16);
  h.tick(16);
  assert.equal(h.callbacks.size, 1);
  ready = true;
  h.tick(16);
  assert.equal(frames, 3);
  assert.equal(h.callbacks.size, 0);
  h.tick(1000);
  assert.equal(frames, 3);
  h.loop.wake(); // Resize or menu setting invalidates exactly one ready frame.
  h.tick(16);
  assert.equal(frames, 4);
  assert.equal(h.callbacks.size, 0);
});

test('resume after hidden/paused time never advances the car by accumulated wall time', () => {
  const deltas: number[] = [];
  const h = harness(dt => { deltas.push(dt); return true; });
  h.loop.wake();
  h.tick(16);
  h.tick(16);
  h.loop.suspend();
  h.tick(60000);
  assert.deepEqual(deltas, [0, .016]);
  h.loop.wake();
  h.tick(16);
  h.tick(500);
  assert.deepEqual(deltas, [0, .016, 0, .1]);
  h.loop.dispose();
  h.loop.wake();
  h.tick(16);
  assert.equal(h.callbacks.size, 0);
  assert.equal(deltas.length, 4);
});
