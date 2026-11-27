import { Component, useEffect, useState, type ReactNode } from "react";
import GameCanvas from "./components/GameCanvas";
import HUD from "./components/HUD";
import { loadCity, testWorld } from "./geo/loaders";
import type { City } from "./geo/types";
import { createVehicle, TOP_SPEED_KMH, type VehicleState } from "./game/physics";
import { bindInput } from "./game/input";
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="loading">
        <h1>Impossibile avviare la scena 3D.</h1>
        <p>Verifica WebGL e ricarica la pagina.</p>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  const [world, setWorld] = useState<{
    city: City;
    vehicle: VehicleState;
  } | null>(null);
  const [paused, setPaused] = useState(true);
  const [started, setStarted] = useState(false);
  const [cameraMode, setCameraMode] = useState(3);
  const [cameraDistance, setCameraDistance] = useState(11);
  const [engineVolume, setEngineVolume] = useState(0.65);
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    let active = true;
    loadCity()
      .catch(() => {
        if (active) setFallback(true);
        return testWorld();
      })
      .then((city) => {
        if (active) setWorld({ city, vehicle: createVehicle(city.spawn) });
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(
    () =>
      bindInput((key) => {
        if (key === "Escape") {
          setPaused((v) => !v);
          (document.activeElement as HTMLElement)?.blur();
        }
        if (key === "blur") setPaused(true);
        if (key === "KeyC") setCameraMode((v) => (v + 1) % 4);
        if (key === "KeyR" && world)
          Object.assign(world.vehicle, createVehicle(world.city.spawn));
      }),
    [world],
  );
  if (!world)
    return (
      <div className="loading">
        <div className="brand">
          casal<span>drive</span>
        </div>
        <p>Prepariamo le strade…</p>
      </div>
    );
  return (
    <ErrorBoundary>
      <main>
        <GameCanvas
          {...world}
          paused={paused}
          cameraMode={cameraMode}
          cameraDistance={cameraDistance}
          engineVolume={engineVolume}
        />
        <HUD
          paused={paused}
          {...world}
          cameraMode={cameraMode}
          onPause={() => setPaused(true)}
          onOverview={() => {
            setCameraMode(mode => mode === 3 ? 0 : 3);
            (document.activeElement as HTMLElement)?.blur();
          }}
        />
        {paused && (
          <div className="menu-backdrop">
            <section className="menu">
              <span className="eyebrow">
                CASALDRIVE / {started ? "IN PAUSA" : "VOLUME 01"}
              </span>
              <h2>
                {started ? (
                  <>
                    Una piccola
                    <br />
                    sosta.
                  </>
                ) : (
                  <>
                    La strada
                    <br />è tua.
                  </>
                )}
              </h2>
              <p>
                {world.city.real
                  ? "Esplora Casale Monferrato in un piccolo mondo a grandezza naturale."
                  : "Un circuito di prova per prendere confidenza con la guida."}
              </p>
              {fallback && (
                <div className="notice">
                  Dati OSM locali assenti: stai entrando nella pista
                  dimostrativa.
                </div>
              )}
              <button
                className="start"
                onClick={() => {
                  setCameraMode(mode => started ? mode : 0);
                  setStarted(true);
                  setPaused(false);
                  (document.activeElement as HTMLElement)?.blur();
                }}
              >
                {started ? "Riprendi il viaggio" : "Inizia a guidare"}{" "}
                <span>↗</span>
              </button>
              {!started && <button className="preview-city" onClick={() => {
                setStarted(true);
                setCameraMode(3);
                setPaused(false);
                (document.activeElement as HTMLElement)?.blur();
              }}>Esplora dall’alto <span>◎</span></button>}
              <div className="settings">
                <label>
                  Motore AMG A 45 S <span>{engineVolume === 0 ? 'Disattivato' : `${Math.round(engineVolume * 100)}%`}</span>
                  <input
                    aria-label="Volume motore"
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={Math.round(engineVolume * 100)}
                    onChange={(e) => setEngineVolume(+e.target.value / 100)}
                  />
                </label>
                <label>
                  Distanza camera <span>{cameraDistance} m</span>
                  <input
                    aria-label="Distanza camera"
                    type="range"
                    min="7"
                    max="20"
                    value={cameraDistance}
                    onChange={(e) => setCameraDistance(+e.target.value)}
                  />
                </label>
                <div>
                  Velocità massima <strong>{TOP_SPEED_KMH} km/h</strong>
                  <p>Automatico a 7 marce · Rev match in scalata</p>
                </div>
              </div>
              <div className="menu-controls">
                <kbd>W / ↑</kbd> accelera <kbd>S / ↓</kbd> frena / retro
                <br />
                <kbd>A D / ← →</kbd> sterza <kbd>C</kbd> camera
                <br />
                <kbd>SPACE</kbd> freno a mano <kbd>R</kbd> riposiziona
              </div>
              <small>Prototipo desktop · tastiera richiesta</small>
            </section>
          </div>
        )}
      </main>
    </ErrorBoundary>
  );
}
