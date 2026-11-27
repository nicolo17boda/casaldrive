import { Scene } from '@babylonjs/core/scene';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { CascadedShadowGenerator } from '@babylonjs/core/Lights/Shadows/cascadedShadowGenerator';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { createMercedesA45 } from './mercedesA45';
import { createCityWorld } from '../world/babylonWorld';
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
  // Input operates on the canvas, never on individual city meshes.
  scene.skipPointerMovePicking = true;
  scene.skipPointerDownPicking = true;
  scene.skipPointerUpPicking = true;
  scene.clearColor = Color4.FromHexString('#c8dae9ff');
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogColor = Color3.FromHexString('#c8dae9');
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure = 1.05;
  scene.imageProcessingConfiguration.contrast = 1.12;
  const ambient = new HemisphericLight('sky', Vector3.Up(), scene);
  ambient.intensity = 0.65;
  ambient.diffuse = Color3.FromHexString('#d8e8ff');
  ambient.groundColor = Color3.FromHexString('#777568');
  const sun = new DirectionalLight('sun', new Vector3(-80, -110, -60).normalize(), scene);
  sun.diffuse = Color3.FromHexString('#fff0d6');
  sun.intensity = 1.8;
  createCityWorld(scene, initial.city);

  const { car, brake, wheels } = createMercedesA45(scene);

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
  // A city-wide view needs more depth precision than the close driving camera:
  // keep asphalt (6 cm above terrain) from flickering against the ground.
  overview.minZ = 5;
  // Two local cascades instead of shadow maps covering the entire city.
  // Unsupported renderers retain the same materials and lighting without CSM.
  scene.activeCamera = chase;
  if (CascadedShadowGenerator.IsSupported) {
    const shadows = new CascadedShadowGenerator(1024, sun);
    shadows.numCascades = 2;
    shadows.shadowMaxZ = 180;
    shadows.stabilizeCascades = true;
    shadows.usePercentageCloserFiltering = true;
    shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    shadows.bias = 0.001;
    shadows.normalBias = 0.08;
    for (const mesh of scene.meshes) {
      if (mesh.name.startsWith('buildings-') || mesh.isDescendantOf(car)) {
        shadows.addShadowCaster(mesh, false);
        mesh.receiveShadows = true;
      }
    }
  }
  let previousMode = -1;
  let attached = false;
  let initialized = false;
  const motion = new MotionInterpolator(initial.vehicle);
  const desired = new Vector3();
  const target = new Vector3();
  const smoothTarget = new Vector3();
  const anchor = new Vector3();
  let materialsFrozen = false;
  const thawMaterials = () => {
    for (const surface of scene.materials) surface.unfreeze();
    materialsFrozen = false;
  };
  scene.onAfterRenderObservable.add(() => {
    if (!materialsFrozen && scene.isReady()) {
      // Stop lights change every frame and must keep their material mutable.
      for (const surface of scene.materials) if (surface !== brake) surface.freeze();
      materialsFrozen = true;
    }
  });
  function update(props: GameProps, delta: number) {
    const { vehicle, city, paused, cameraMode, cameraDistance, topSpeed } = props;
    if (cameraMode !== previousMode) {
      thawMaterials();
      scene.activeCamera = cameraMode === 3 ? overview : chase;
      scene.shadowsEnabled = cameraMode !== 3;
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
      if (!paused && cameraMode !== 3) tire.rotation.x -= vehicle.speed * Math.min(delta, 0.1) / 0.35;
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
  return { scene, update, thawMaterials, dispose: () => scene.dispose() };
}
