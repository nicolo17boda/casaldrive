import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Ray } from '@babylonjs/core/Culling/ray';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Material } from '@babylonjs/core/Materials/material';
import { buildingChunks } from '../src/world/geometry';
import { geometryMesh } from '../src/world/babylonWorld';
import { createGameScene, type GameProps } from '../src/game/babylonScene';
import { createVehicle } from '../src/game/physics';
import { controls } from '../src/game/input';
import type { City } from '../src/geo/types';

test('Babylon geometry retains roof elevation, open courtyards, normals and vertex colors', () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  scene.useRightHandedSystem = true;
  try {
    const [{ geometry }] = buildingChunks([{ id: 1, height: 12,
      points: [[0,0],[20,0],[20,20],[0,20]], holes: [[[5,5],[15,5],[15,15],[5,15]]],
    }]);
    const mesh = geometryMesh(scene, 'building', geometry);
    assert.equal(mesh.sideOrientation, Material.CounterClockWiseSideOrientation);
    mesh.computeWorldMatrix(true);
    assert.equal(mesh.getBoundingInfo().boundingBox.maximumWorld.y, 12);
    assert.equal(new Ray(new Vector3(10, 30, 10), new Vector3(0,-1,0)).intersectsMesh(mesh).hit, false);
    const hit = new Ray(new Vector3(2, 30, 2), new Vector3(0,-1,0)).intersectsMesh(mesh);
    assert.ok(hit.hit);
    assert.ok(Math.abs(hit.pickedPoint!.y - 12) < 1e-6);
    assert.equal(mesh.getVerticesData(VertexBuffer.ColorKind)!.length, mesh.getTotalVertices() * 4);
    assert.equal(mesh.getVerticesData(VertexBuffer.NormalKind)!.length, mesh.getTotalVertices() * 3);
  } finally { scene.dispose(); engine.dispose(); }
});

test('Babylon real-city scene preserves driving, pause, overview, reset and disposal', () => {
  const engine = new NullEngine();
  const city: City = JSON.parse(readFileSync('public/data/city.json', 'utf8'));
  const vehicle = createVehicle(city.spawn);
  const props: GameProps = { city, vehicle, paused: true, cameraMode: 3,
    cameraDistance: 11, topSpeed: 100, engineVolume: 0 };
  const game = createGameScene(engine, props);
  try {
    const buildings = game.scene.meshes.filter(m => m.name.startsWith('buildings-'));
    assert.ok(buildings.length > 1 && buildings.length < city.buildings.length / 5);
    assert.equal(game.scene.activeCamera!.name, 'city-overview');
    controls.throttle = true;
    const initial = { ...vehicle };
    for (let i = 0; i < 30; i++) game.update(props, 1 / 60);
    assert.deepEqual(vehicle, initial);
    props.paused = false;
    for (let i = 0; i < 30; i++) game.update(props, 1 / 60);
    assert.deepEqual(vehicle, initial); // City overview freezes the vehicle.
    props.cameraMode = 0;
    for (let i = 0; i < 30; i++) game.update(props, 1 / 60);
    assert.equal(game.scene.activeCamera!.name, 'driving-camera');
    assert.ok(Math.hypot(vehicle.x - initial.x, vehicle.z - initial.z) > 0.1);
    for (const mode of [1, 2, 3, 0]) {
      props.cameraMode = mode;
      game.update(props, 1 / 60);
      assert.ok(game.scene.activeCamera!.position.asArray().every(Number.isFinite));
    }
    props.paused = true;
    Object.assign(vehicle, createVehicle(city.spawn));
    game.update(props, 0);
    const car = game.scene.getTransformNodeByName('car')!;
    assert.equal(car.position.x, vehicle.x);
    assert.equal(car.position.z, vehicle.z);
  } finally {
    controls.throttle = false;
    game.dispose();
    assert.equal(engine.scenes.length, 0);
    engine.dispose();
  }
});
