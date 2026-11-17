import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Sky } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import { FIXED_STEP, MotionInterpolator } from "../game/interpolation";
import { Group, MeshStandardMaterial, Vector3 } from "three";
import type { City } from "../geo/types";
import { stepVehicle, type VehicleState } from "../game/physics";
import { controls } from "../game/input";
import { cameraTravelFraction } from '../game/cameraCollision';
import CityWorld from "../world/CityWorld";
export interface GameProps {
  city: City;
  vehicle: VehicleState;
  paused: boolean;
  cameraMode: number;
  cameraDistance: number;
  topSpeed: number;
}
function Car({ vehicle, paused }: { vehicle: VehicleState; paused: boolean }) {
  const frontWheels = useRef<(Group | null)[]>([]);
  const brakeLights = useRef<(MeshStandardMaterial | null)[]>([]);
  useFrame(() => {
    if (paused) return;
    for (const wheel of frontWheels.current) {
      if (wheel) wheel.rotation.y = vehicle.steering * 0.48;
    }
    // S brakes while travelling forwards; reversing alone does not light the stops.
    const braking = (controls.brake && vehicle.speed > 0.3) ||
      (controls.throttle && vehicle.speed < -0.3) || controls.handbrake;
    for (const light of brakeLights.current) {
      if (light) light.emissiveIntensity = braking ? 2.5 : 0.12;
    }
  });
  return (
    <group>
      <mesh position={[0, 0.65, 0]} castShadow>
        <boxGeometry args={[1.8, 0.65, 4.1]} />
        <meshStandardMaterial color="#e97945" roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.18, 0.15]} castShadow>
        <boxGeometry args={[1.5, 0.65, 1.85]} />
        <meshStandardMaterial color="#263c40" roughness={0.25} />
      </mesh>
      <mesh position={[0, 1.53, 0.15]} castShadow>
        <boxGeometry args={[1.57, 0.12, 1.95]} />
        <meshStandardMaterial color="#f38b54" />
      </mesh>
      {[-1, 1].flatMap((x) =>
        [-1.25, 1.25].map((z) => (
          <group
            key={`${x},${z}`}
            position={[x * 0.88, 0.4, z]}
            ref={z < 0 ? (wheel) => { frontWheels.current[x < 0 ? 0 : 1] = wheel; } : undefined}
          >
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.38, 0.38, 0.25, 12]} />
              <meshStandardMaterial color="#202a29" />
            </mesh>
          </group>
        )),
      )}
      {[-0.6, 0.6].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.7, -2.06]}>
            <boxGeometry args={[0.45, 0.18, 0.04]} />
            <meshStandardMaterial
              color="#fff2c5"
              emissive="#ffe8ac"
              emissiveIntensity={0.5}
            />
          </mesh>
          <mesh position={[x, 0.7, 2.06]}>
            <boxGeometry args={[0.45, 0.18, 0.04]} />
            <meshStandardMaterial
              ref={(light) => { brakeLights.current[x < 0 ? 0 : 1] = light; }}
              color="#c84032"
              emissive="#ff2418"
              emissiveIntensity={0.12}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
function Simulation(props: GameProps) {
  const car = useRef<Group>(null);
  const { camera } = useThree();
  const motion = useMemo(() => new MotionInterpolator(props.vehicle), [props.vehicle]);
  const initialized = useRef(false);
  const desired = useRef(new Vector3());
  const target = useRef(new Vector3());
  const smoothTarget = useRef(new Vector3());
  const anchor = useRef(new Vector3());
  useFrame((_, delta) => {
    const {
      vehicle: v,
      city,
      paused,
      cameraMode,
      cameraDistance,
      topSpeed,
    } = props;
    const pose = motion.advance(v, delta, paused || cameraMode === 3, () => {
      stepVehicle(v, controls, FIXED_STEP, city, topSpeed);
    });
    if (car.current) {
      car.current.position.set(pose.x, 0, pose.z);
      car.current.rotation.y = pose.yaw;
    }
    if (cameraMode === 3) {
      initialized.current = false;
      return;
    }
    const distance = cameraMode === 1 ? 5 : cameraMode === 2 ? 22 : cameraDistance;
    const sin = Math.sin(pose.yaw), cos = Math.cos(pose.yaw);
    desired.current.set(pose.x + sin * distance,
      cameraMode === 2 ? 28 : cameraMode === 1 ? 3.6 : 5.5,
      pose.z + cos * distance);
    target.current.set(pose.x - sin * 5, 1.2, pose.z - cos * 5);
    const damping = 1 - Math.exp(-5 * Math.min(delta, 0.1));
    if (!initialized.current || camera.position.distanceTo(desired.current) > 90) {
      camera.position.copy(desired.current);
      smoothTarget.current.copy(target.current);
      initialized.current = true;
    } else {
      camera.position.lerp(desired.current, damping);
      smoothTarget.current.lerp(target.current, damping);
    }
    // Clamp after damping: interpolation between two safe positions can cross a wall.
    anchor.current.set(pose.x, 1.8, pose.z);
    const travel = cameraTravelFraction(anchor.current, camera.position, city);
    camera.position.lerpVectors(anchor.current, camera.position, travel);
    camera.lookAt(smoothTarget.current);
  }, -1);

  return (
    <group ref={car}>
      <Car vehicle={props.vehicle} paused={props.paused} />
    </group>
  );
}
function CityOverview({ city, paused }: { city: City; paused: boolean }) {
  const { camera, size, invalidate } = useThree();
  const [left, top, right, bottom] = city.bounds;
  const target = useMemo(() => new Vector3((left + right) / 2, 0, (top + bottom) / 2), [left, top, right, bottom]);
  const extent = Math.max(right - left, bottom - top);
  useLayoutEffect(() => {
    const distance = extent * Math.max(1, size.height / size.width);
    camera.position.set(target.x + distance * 0.35, distance * 0.95, target.z + distance * 0.7);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, target, extent, size.width, size.height, invalidate]);
  return <OrbitControls makeDefault target={target} enabled={!paused}
    minDistance={40} maxDistance={extent * 2.5} maxPolarAngle={Math.PI / 2.4}
    enableDamping dampingFactor={0.08} />;
}

export default function GameCanvas(props: GameProps) {
  return (
    <Canvas
      frameloop={props.paused ? "demand" : "always"}
      dpr={[1, 1.5]}
      camera={{ fov: 58, near: 0.2, far: 6000, position: [0, 6, 12] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      fallback={
        <div className="fatal">
          WebGL non disponibile. Prova un browser con accelerazione grafica.
        </div>
      }
    >
      <color attach="background" args={["#d9e6df"]} />
      <fog attach="fog" args={["#d9e6df", props.cameraMode === 3 ? 1800 : 300, props.cameraMode === 3 ? 5000 : 1250]} />
      <ambientLight intensity={1.5} />
      <hemisphereLight args={["#eaf4ff", "#8a8c69", 1.3]} />
      <directionalLight position={[80, 150, 60]} intensity={2.5} />
      <Sky sunPosition={[80, 150, 60]} turbidity={4} rayleigh={0.4} />
      <CityWorld city={props.city} />
      <Simulation {...props} />
      {props.cameraMode === 3 && <CityOverview city={props.city} paused={props.paused} />}
    </Canvas>
  );
}
