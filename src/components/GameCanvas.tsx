import { useEffect, useRef, useState } from 'react';
import { Engine } from '@babylonjs/core/Engines/engine';
import { createGameScene, type GameProps } from '../game/babylonScene';
import { attachPlaceLabels } from '../world/placeLabels';
import { EngineAudio } from '../game/engineAudio';
import { controls } from '../game/input';
import { DemandRenderLoop } from '../game/renderLoop';
export type { GameProps } from '../game/babylonScene';

export default function GameCanvas(props: GameProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const labels = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  const invalidate = useRef<() => void>(() => {});
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    latest.current = props;
    invalidate.current();
  }, [props]);
  useEffect(() => {
    const element = canvas.current!;
    let engine: Engine | undefined;
    let game: ReturnType<typeof createGameScene> | undefined;
    const audio = new EngineAudio();
    let loop: DemandRenderLoop | undefined;
    let audioActive = false;
    let audioVolume = -1;
    const unlock = () => audio.unlock();
    const silence = () => {
      audioActive = false;
      audio.setOutput(false, latest.current.engineVolume);
    };
    const resize = () => {
      engine?.resize();
      invalidate.current();
    };
    const visibility = () => {
      silence();
      if (document.hidden) loop?.suspend();
      else invalidate.current();
    };
    let detachLabels: (() => void) | undefined;
    let observer: ResizeObserver | undefined;
    try {
      engine = new Engine(element, true, { powerPreference: 'high-performance', stencil: true });
      engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 1.5));
      game = createGameScene(engine, latest.current, element);
      if (labels.current) detachLabels = attachPlaceLabels(game.scene, props.city, labels.current);
      window.addEventListener('pointerdown', unlock, true);
      window.addEventListener('keydown', unlock, true);
      window.addEventListener('blur', silence);
      document.addEventListener('visibilitychange', visibility);
      window.addEventListener('resize', resize);
      observer = new ResizeObserver(resize);
      observer.observe(element);
      loop = new DemandRenderLoop(
        frame => engine!.runRenderLoop(frame),
        frame => engine!.stopRenderLoop(frame),
        dt => {
          const current = latest.current;
          const active = !current.paused && !document.hidden && document.hasFocus();
          const audible = active && current.cameraMode !== 3;
          if (audible !== audioActive || current.engineVolume !== audioVolume) {
            audioActive = audible;
            audioVolume = current.engineVolume;
            audio.setOutput(audible, audioVolume);
          }
          // Babylon loads shaders asynchronously; finish those frames even in the opening menu.
          if (document.hidden) return false;
          try {
            game!.update(current, dt);
            audio.update(current.vehicle.speed, controls, dt);
            const ready = game!.scene.isReady();
            game!.scene.render();
            return !current.paused || !ready;
          } catch (error) {
            console.error('Babylon scene rendering failed', error);
            audio.setOutput(false, 0);
            setFailed(true);
            return false;
          }
      });
      invalidate.current = () => { if (!document.hidden) loop?.wake(); };
      engine.onContextRestoredObservable.add(() => {
        game?.thawMaterials();
        invalidate.current();
      });
      invalidate.current();
    } catch (error) {
      console.error('Babylon scene initialization failed', error);
      setFailed(true);
    }
    return () => {
      invalidate.current = () => {};
      loop?.dispose();
      observer?.disconnect();
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      window.removeEventListener('blur', silence);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('resize', resize);
      audio.dispose();
      engine?.stopRenderLoop();
      detachLabels?.();
      game?.dispose();
      engine?.dispose();
    };
  }, [props.city, props.vehicle]);
  return <>
    <canvas ref={canvas} className="game-canvas" aria-label="CasalDrive: città 3D" />
    <canvas ref={labels} aria-hidden="true" style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}} />
    {failed && <div className="fatal" role="alert">Impossibile avviare la scena 3D. Verifica l'accelerazione grafica del browser e ricarica.</div>}
  </>;
}
