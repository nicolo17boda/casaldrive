import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { EngineAudio } from '../game/engineAudio';
import { controls } from '../game/input';
import type { VehicleState } from '../game/physics';

export default function EngineSound({ vehicle, active, volume }: {
  vehicle: VehicleState;
  active: boolean;
  volume: number;
}) {
  const audio = useRef<EngineAudio | null>(null);
  useEffect(() => {
    const engine = new EngineAudio();
    audio.current = engine;
    const unlock = () => engine.unlock();
    // Capture also covers menu buttons, before React handles the click.
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    return () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      engine.dispose();
      audio.current = null;
    };
  }, []);
  useEffect(() => {
    const sync = () => audio.current?.setOutput(active && !document.hidden && document.hasFocus(), volume);
    const silence = () => audio.current?.setOutput(false, volume);
    sync();
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('blur', silence);
    window.addEventListener('focus', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('blur', silence);
      window.removeEventListener('focus', sync);
    };
  }, [active, volume]);
  useFrame((_, dt) => audio.current?.update(vehicle.speed, controls, dt));
  return null;
}
