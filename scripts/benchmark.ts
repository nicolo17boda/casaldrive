import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { cpus, platform, arch } from 'node:os';
import { performance } from 'node:perf_hooks';
import type { City } from '../src/geo/types';
import { createVehicle, emptyControls, stepVehicle } from '../src/game/physics';
import { cameraTravelFraction } from '../src/game/cameraCollision';
import { FIXED_STEP } from '../src/game/interpolation';

const source = readFileSync('public/data/city.json', 'utf8');
const city: City = JSON.parse(source);
const ticks = 60 * 120;
const rounds = 5;
const physics: number[] = [], camera: number[] = [];

function replay(record: boolean) {
  const vehicle = createVehicle(city.spawn);
  let contacts = 0, cameraCorrections = 0;
  for (let tick = 0; tick < ticks; tick++) {
    // Repeatable input sequence: accelerate, turn, brake/reverse, countersteer.
    const phase = Math.floor(tick / 240) % 5;
    const input = { ...emptyControls(), throttle: phase < 3,
      brake: phase >= 3, left: phase === 1, right: phase === 4 };
    const start = performance.now();
    stepVehicle(vehicle, input, FIXED_STEP, city);
    const afterPhysics = performance.now();
    const travel = cameraTravelFraction({ x: vehicle.x, y: 1.8, z: vehicle.z },
      { x: vehicle.x + Math.sin(vehicle.yaw) * 11, y: 5.5,
        z: vehicle.z + Math.cos(vehicle.yaw) * 11 }, city);
    const end = performance.now();
    if (record) {
      physics.push(afterPhysics - start);
      camera.push(end - afterPhysics);
    }
    contacts += Number(vehicle.collision);
    cameraCorrections += Number(travel < 1);
  }
  return { x: vehicle.x, z: vehicle.z, yaw: vehicle.yaw,
    distanceMetres: vehicle.distance, contactTicks: contacts, cameraCorrections };
}

function summary(samples: number[]) {
  samples.sort((a, b) => a - b);
  return { samples: samples.length,
    meanMs: samples.reduce((sum, value) => sum + value, 0) / samples.length,
    p50Ms: samples[Math.floor(samples.length * .5)],
    p95Ms: samples[Math.floor(samples.length * .95)],
    p99Ms: samples[Math.floor(samples.length * .99)],
    maxMs: samples[samples.length - 1] };
}

const baseline = replay(false); // Warm the runtime and static geometry caches.
for (let round = 0; round < rounds; round++) {
  if (JSON.stringify(replay(true)) !== JSON.stringify(baseline)) {
    throw new Error('Replay diverged between rounds');
  }
}
// The spawn replay may not put walls behind the car: also probe the road network
// in four directions to exercise camera retraction in dense parts of the city.
const roadCamera: number[] = [];
let roadCameraCorrections = 0;
for (const road of city.roads) for (const [x, z] of road.points) {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const start = performance.now();
    const travel = cameraTravelFraction({ x, y: 1.8, z },
      { x: x + Math.sin(yaw) * 11, y: 5.5, z: z + Math.cos(yaw) * 11 }, city);
    roadCamera.push(performance.now() - start);
    roadCameraCorrections += Number(travel < 1);
  }
}
console.log(JSON.stringify({
  scenario: 'spawn-input-replay-v1', simulatedSecondsPerRound: 60, rounds,
  runtime: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model,
  datasetSha256: createHash('sha256').update(source).digest('hex'),
  buildings: city.buildings.length, finalState: baseline,
  physics: summary(physics), cameraCollision: summary(camera),
  roadCameraProbes: { ...summary(roadCamera), corrections: roadCameraCorrections },
  limitations: 'CPU-only, warm-cache replay; no rendering, browser, GPU or FPS measurement. Timings include timer overhead. Camera collision queried at every physics tick for this benchmark.',
}, null, 2));
