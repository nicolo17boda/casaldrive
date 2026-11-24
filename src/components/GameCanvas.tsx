import { useEffect, useRef, useState } from 'react';
import { Engine } from '@babylonjs/core/Engines/engine';
import { createGameScene, type GameProps } from '../game/babylonScene';
import { EngineAudio } from '../game/engineAudio';
import { controls } from '../game/input';
export type { GameProps } from '../game/babylonScene';

export default function GameCanvas(props: GameProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  const dirty = useRef(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    latest.current = props;
    dirty.current = true;
  }, [props]);
  useEffect(() => {
    const element = canvas.current!;
    let engine: Engine | undefined;
    let game: ReturnType<typeof createGameScene> | undefined;
    const audio = new EngineAudio();
    let audioActive = false;
    let audioVolume = -1;
    const unlock = () => audio.unlock();
    const silence = () => {
      audioActive = false;
      audio.setOutput(false, latest.current.engineVolume);
    };
    const resize = () => {
      engine?.resize();
      dirty.current = true;
    };
    let observer: ResizeObserver | undefined;
    try {
      engine = new Engine(element, true, { powerPreference: 'high-performance', stencil: true });
      engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 1.5));
      game = createGameScene(engine, latest.current, element);
      window.addEventListener('pointerdown', unlock, true);
      window.addEventListener('keydown', unlock, true);
      window.addEventListener('blur', silence);
      document.addEventListener('visibilitychange', silence);
      window.addEventListener('resize', resize);
      observer = new ResizeObserver(resize);
      observer.observe(element);
      let last = performance.now();
      let renderedReady = false;
      engine.runRenderLoop(() => {
        const now = performance.now();
        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        const current = latest.current;
        const active = !current.paused && !document.hidden && document.hasFocus();
        const audible = active && current.cameraMode !== 3;
        if (audible !== audioActive || current.engineVolume !== audioVolume) {
          audioActive = audible;
          audioVolume = current.engineVolume;
          audio.setOutput(audible, audioVolume);
        }
        // Babylon loads shaders asynchronously; finish those frames even in the opening menu.
        if (document.hidden || (current.paused && !dirty.current && renderedReady)) return;
        try {
          game!.update(current, dt);
          audio.update(current.vehicle.speed, controls, dt);
          renderedReady = game!.scene.isReady();
          game!.scene.render();
          dirty.current = false;
        } catch (error) {
          console.error('Babylon scene rendering failed', error);
          engine?.stopRenderLoop();
          audio.setOutput(false, 0);
          setFailed(true);
        }
      });
    } catch (error) {
      console.error('Babylon scene initialization failed', error);
      setFailed(true);
    }
    return () => {
      observer?.disconnect();
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      window.removeEventListener('blur', silence);
      document.removeEventListener('visibilitychange', silence);
      window.removeEventListener('resize', resize);
      audio.dispose();
      engine?.stopRenderLoop();
      game?.dispose();
      engine?.dispose();
    };
  }, [props.city, props.vehicle]);
  return <>
    <canvas ref={canvas} className="game-canvas" aria-label="CasalDrive: città 3D" />
    {failed && <div className="fatal" role="alert">Impossibile avviare la scena 3D. Verifica l'accelerazione grafica del browser e ricarica.</div>}
  </>;
}
