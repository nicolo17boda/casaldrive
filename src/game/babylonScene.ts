import { Scene } from '@babylonjs/core/scene';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { createCityWorld, material } from '../world/babylonWorld';
import { MotionInterpolator, FIXED_STEP } from './interpolation';
import { stepVehicle, type VehicleState } from './physics';
import { controls } from './input';
import { cameraTravelFraction } from './cameraCollision';
import type { City } from '../geo/types';

export interface GameProps {
  city: City;
  vehicle: VehicleState;
  paused: boolean;
  cameraMode: number;
  cameraDistance: number;
  topSpeed: number;
  engineVolume: number;
}

export function createGameScene(engine: AbstractEngine, initial: GameProps, canvas?: HTMLCanvasElement) {
  const scene = new Scene(engine);
  // OSM geometry and vehicle headings use X east, Y up, Z south.
  scene.useRightHandedSystem = true;
  scene.clearColor = Color4.FromHexString('#d9e6dfff');
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogColor = Color3.FromHexString('#d9e6df');
  const ambient = new HemisphericLight('sky', Vector3.Up(), scene);
  ambient.intensity = 1.15;
  ambient.groundColor = Color3.FromHexString('#8a8c69');
  const sun = new DirectionalLight('sun', new Vector3(-80, -150, -60).normalize(), scene);
  sun.intensity = 1.5;
  createCityWorld(scene, initial.city);

  const car = new TransformNode('car', scene);
  const paint = material(scene, 'car-paint', '#e97945');
  const glass = material(scene, 'car-glass', '#263c40');
  const roof = material(scene, 'car-roof', '#f38b54');
  const rubber = material(scene, 'tires', '#202a29');
  const headlight = material(scene, 'headlights', '#fff2c5');
  headlight.emissiveColor = Color3.FromHexString('#ffe8ac').scale(0.5);
  const brake = material(scene, 'brake-lights', '#c84032');
  const box = (name: string, size: number[], position: number[], surface: typeof paint) => {
    const mesh = CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.material = surface;
    mesh.parent = car;
    return mesh;
  };
  box('body', [1.8, 0.65, 4.1], [0, 0.65, 0], paint);
  box('cabin', [1.5, 0.65, 1.85], [0, 1.18, 0.15], glass);
  box('roof', [1.57, 0.12, 1.95], [0, 1.53, 0.15], roof);
  const wheels: { pivot: TransformNode; tire: ReturnType<typeof CreateCylinder>; front: boolean }[] = [];
  for (const x of [-1, 1]) {
    for (const z of [-1.25, 1.25]) {
      const pivot = new TransformNode(`wheel-${x}-${z}`, scene);
      pivot.parent = car;
      pivot.position.set(x * 0.88, 0.4, z);
      const tire = CreateCylinder('tire', { height: 0.25, diameter: 0.76, tessellation: 12 }, scene);
      tire.rotation.z = Math.PI / 2;
      tire.parent = pivot;
      tire.material = rubber;
      wheels.push({ pivot, tire, front: z < 0 });
    }
    box('headlight', [0.45, 0.18, 0.04], [x * 0.6, 0.7, -2.06], headlight);
    box('stop', [0.45, 0.18, 0.04], [x * 0.6, 0.7, 2.06], brake);
  }

  const chase = new FreeCamera('driving-camera', new Vector3(0, 6, 12), scene);
  const [left, top, right, bottom] = initial.city.bounds;
  const extent = Math.max(right - left, bottom - top);
  const center = new Vector3((left + right) / 2, 0, (top + bottom) / 2);
  const overview = new ArcRotateCamera('city-overview', 1, 0.7, extent, center, scene);
  overview.lowerRadiusLimit = 40;
  overview.upperRadiusLimit = extent * 3;
  overview.lowerBetaLimit = 0.05;
  overview.upperBetaLimit = Math.PI / 2.4;
  overview.wheelDeltaPercentage = 0.01;
  overview.panningSensibility = 15;
  overview.inertia = 0.85;
  // Arrow keys belong to the car, not the overview camera.
  overview.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');
  for (const camera of [chase, overview]) {
    camera.fov = 58 * Math.PI / 180;
    camera.minZ = 0.2;
    camera.maxZ = 6000;
  }
  let previousMode = -1;
  let attached = false;
  let initialized = false;
  const motion = new MotionInterpolator(initial.vehicle);
  const desired = new Vector3();
  const target = new Vector3();
  const smoothTarget = new Vector3();
  const anchor = new Vector3();
  function update(props: GameProps, delta: number) {
    const { vehicle, city, paused, cameraMode, cameraDistance, topSpeed } = props;
    if (cameraMode !== previousMode) {
      scene.activeCamera = cameraMode === 3 ? overview : chase;
      scene.fogStart = cameraMode === 3 ? 1800 : 300;
      scene.fogEnd = cameraMode === 3 ? 5000 : 1250;
      if (cameraMode === 3) {
        const distance = extent * Math.max(1, engine.getRenderHeight() / engine.getRenderWidth());
        overview.setTarget(center.clone());
        overview.setPosition(center.add(new Vector3(distance * 0.35, distance * 0.95, distance * 0.7)));
      }
      initialized = false;
      previousMode = cameraMode;
    }
    const interactive = cameraMode === 3 && !paused;
    if (canvas && interactive !== attached) {
      if (interactive) overview.attachControl(canvas, false);
      else {
        overview.detachControl();
        overview.inertialAlphaOffset = overview.inertialBetaOffset = overview.inertialRadiusOffset = 0;
        overview.inertialPanningX = overview.inertialPanningY = 0;
      }
      attached = interactive;
    }
    const pose = motion.advance(vehicle, delta, paused || cameraMode === 3, () => {
      stepVehicle(vehicle, controls, FIXED_STEP, city, topSpeed);
    });
    car.position.set(pose.x, 0, pose.z);
    car.rotation.y = pose.yaw;
    for (const { pivot, tire, front } of wheels) {
      if (front) pivot.rotation.y = vehicle.steering * 0.48;
      if (!paused && cameraMode !== 3) tire.rotation.x -= vehicle.speed * Math.min(delta, 0.1) / 0.38;
    }
    const braking = (controls.brake && vehicle.speed > 0.3)
      || (controls.throttle && vehicle.speed < -0.3) || controls.handbrake;
    brake.emissiveColor.set(braking ? 1 : 0.12, braking ? 0.08 : 0.01, 0.01);
    if (cameraMode === 3) return;
    const distance = cameraMode === 1 ? 5 : cameraMode === 2 ? 22 : cameraDistance;
    const sin = Math.sin(pose.yaw), cos = Math.cos(pose.yaw);
    desired.set(pose.x + sin * distance, cameraMode === 2 ? 28 : cameraMode === 1 ? 3.6 : 5.5,
      pose.z + cos * distance);
    target.set(pose.x - sin * 5, 1.2, pose.z - cos * 5);
    const damping = 1 - Math.exp(-5 * Math.min(delta, 0.1));
    if (!initialized || Vector3.Distance(chase.position, desired) > 90) {
      chase.position.copyFrom(desired);
      smoothTarget.copyFrom(target);
      initialized = true;
    } else {
      Vector3.LerpToRef(chase.position, desired, damping, chase.position);
      Vector3.LerpToRef(smoothTarget, target, damping, smoothTarget);
    }
    anchor.set(pose.x, 1.8, pose.z);
    const travel = cameraTravelFraction(anchor, chase.position, city);
    Vector3.LerpToRef(anchor, chase.position, travel, chase.position);
    chase.setTarget(smoothTarget);
  }
  update(initial, 0);
  return { scene, update, dispose: () => scene.dispose() };
}
