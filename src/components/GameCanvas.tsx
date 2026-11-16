import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import { useRef } from "react";
import { Group, Vector3 } from "three";
import type { City } from "../geo/types";
import { stepVehicle, type VehicleState } from "../game/physics";
import { controls } from "../game/input";
import CityWorld from "../world/CityWorld";
export interface GameProps {
  city: City;
  vehicle: VehicleState;
  paused: boolean;
  cameraMode: number;
  cameraDistance: number;
  topSpeed: number;
}
function Car() {
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
          <mesh
            key={`${x},${z}`}
            position={[x * 0.88, 0.4, z]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.38, 0.38, 0.25, 12]} />
            <meshStandardMaterial color="#202a29" />
          </mesh>
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
            <meshStandardMaterial color="#c84032" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
function Simulation(props: GameProps) {
  const car = useRef<Group>(null);
  const { camera } = useThree();
  const accumulator = useRef(0);
  const initialized = useRef(false);
  const desired = useRef(new Vector3());
  const target = useRef(new Vector3());
  useFrame((_, delta) => {
    const {
      vehicle: v,
      city,
      paused,
      cameraMode,
      cameraDistance,
      topSpeed,
    } = props;
    if (!paused) {
      accumulator.current += Math.min(delta, 0.1);
      while (accumulator.current >= 1 / 120) {
        stepVehicle(v, controls, 1 / 120, city, topSpeed);
        accumulator.current -= 1 / 120;
      }
    } else accumulator.current = 0;
    if (car.current) {
      car.current.position.set(v.x, 0, v.z);
      car.current.rotation.y = v.yaw;
    }
    const distance =
      cameraMode === 1 ? 5 : cameraMode === 2 ? 22 : cameraDistance;
    desired.current.set(
      v.x + Math.sin(v.yaw) * distance,
      cameraMode === 2 ? 28 : cameraMode === 1 ? 3.6 : 5.5,
      v.z + Math.cos(v.yaw) * distance,
    );
    if (
      !initialized.current ||
      camera.position.distanceTo(desired.current) > 90
    ) {
      camera.position.copy(desired.current);
      initialized.current = true;
    } else camera.position.lerp(desired.current, 1 - Math.exp(-5 * delta));
    target.current.set(
      v.x - Math.sin(v.yaw) * 5,
      1.2,
      v.z - Math.cos(v.yaw) * 5,
    );
    camera.lookAt(target.current);
  });
  return (
    <group ref={car}>
      <Car />
    </group>
  );
}
export default function GameCanvas(props: GameProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ fov: 58, near: 0.2, far: 2200, position: [0, 6, 12] }}
      gl={{ antialias: true }}
      fallback={
        <div className="fatal">
          WebGL non disponibile. Prova un browser con accelerazione grafica.
        </div>
      }
    >
      <color attach="background" args={["#d9e6df"]} />
      <fog attach="fog" args={["#d9e6df", 300, 1250]} />
      <ambientLight intensity={1.5} />
      <hemisphereLight args={["#eaf4ff", "#8a8c69", 1.3]} />
      <directionalLight position={[80, 150, 60]} intensity={2.5} />
      <Sky sunPosition={[80, 150, 60]} turbidity={4} rayleigh={0.4} />
      <CityWorld city={props.city} />
      <Simulation {...props} />
    </Canvas>
  );
}
