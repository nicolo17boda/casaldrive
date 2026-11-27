import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { createMercedesA45 } from '../src/game/mercedesA45';

test('AMG geometry stays finite and wheel details follow steering and rolling', () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const { car, wheels, brake } = createMercedesA45(scene);
  assert.equal(wheels.length, 4);
  assert.equal(wheels.filter(w => w.front).length, 2);
  assert.ok(car.getChildMeshes(true).length <= 8);
  for (const mesh of car.getChildMeshes()) {
    mesh.computeWorldMatrix(true);
    const { minimumWorld: min, maximumWorld: max } = mesh.getBoundingInfo().boundingBox;
    assert.ok([...min.asArray(), ...max.asArray()].every(Number.isFinite));
    assert.ok(min.y > -0.02 && max.y < 1.6);
    assert.ok(Math.abs(min.x) < 1.06 && Math.abs(max.x) < 1.06);
  }
  const front = wheels.find(w => w.front)!;
  assert.equal(front.tire.parent, front.pivot);
  assert.ok(front.tire.getChildMeshes().length > 10);
  assert.ok(car.getChildMeshes().some(mesh => mesh.material === brake));
  scene.dispose(); engine.dispose();
});
