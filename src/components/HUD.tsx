import { useEffect, useRef, useState } from "react";
import { buildMinimap } from "./minimap";
import type { City } from "../geo/types";
import type { VehicleState } from "../game/physics";
const cameras = ["Inseguimento", "Ravvicinata", "Panoramica", "Vista città"];
export default function HUD({
  city,
  vehicle,
  cameraMode,
  onPause,
  onOverview,
  paused,
}: {
  city: City;
  vehicle: VehicleState;
  cameraMode: number;
  onPause: () => void;
  onOverview: () => void;
  paused: boolean;
}) {
  const [stats, setStats] = useState({
    speed: 0,
    distance: 0,
    collision: false,
    reverse: false,
  });
  const canvas = useRef<HTMLCanvasElement>(null);
  const map = useRef<ReturnType<typeof buildMinimap> | null>(null);
  useEffect(() => {
    map.current = buildMinimap(city);
    return () => { map.current = null; };
  }, [city]);
  useEffect(() => {
    const draw = () => {
      const nextStats = {
        speed: Math.round(Math.abs(vehicle.speed) * 3.6),
        distance: Math.floor(vehicle.distance / 100) * 100,
        collision: vehicle.collision,
        reverse: vehicle.speed < -0.1,
      };
      setStats(previous => previous.speed === nextStats.speed && previous.distance === nextStats.distance && previous.collision === nextStats.collision && previous.reverse === nextStats.reverse ? previous : nextStats);
      const ctx = canvas.current?.getContext("2d");
      if (!ctx) return;
      const size = 220,
        scale = 0.6;
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = "#e2e4d4";
      ctx.fillRect(0, 0, size, size);
      const cached = map.current;
      if (cached) {
        const extent = size / scale * cached.scale;
        ctx.drawImage(cached.canvas,
          (vehicle.x - cached.originX) * cached.scale - extent / 2,
          (vehicle.z - cached.originZ) * cached.scale - extent / 2,
          extent, extent, 0, 0, size, size);
      }
      ctx.save();
      ctx.translate(110, 110);
      ctx.rotate(-vehicle.yaw);
      ctx.fillStyle = "#e76f41";
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(7, 8);
      ctx.lineTo(0, 5);
      ctx.lineTo(-7, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };
    draw();
    if (paused) return;
    const id = setInterval(draw, 100);
    return () => clearInterval(id);
  }, [city, vehicle, paused]);
  return (
    <div className="hud">
      <header>
        <a className="brand" href="/">
          casal<span>drive</span>
          <i>●</i>
        </a>
        <div className="location">
          <span className="live-dot" />{" "}
          {city.real ? "CASALE MONFERRATO" : "AMBIENTE DI PROVA"}
          <small>
            {city.real
              ? "Piemonte, Italia · scala 1:1"
              : "Geometria dimostrativa · non geografica"}
          </small>
        </div>
        <button className="overview-button" onClick={onOverview}>
          {cameraMode === 3 ? "Torna alla guida" : "Vista città"}
        </button>
        <button className="pause-button" onClick={onPause}>
          Ⅱ <span>Pausa</span>
          <kbd>ESC</kbd>
        </button>
      </header>
      <div className="place-tag">
        <span>{cameraMode === 3 ? "LA CITTÀ DALL’ALTO" : "ESPLORAZIONE LIBERA"}</span>
        <h1>{cameraMode === 3 ? city.name : city.real ? "Un giro in città." : "Si parte da qui."}</h1>
        <p>
          {cameraMode === 3 ? "Trascina per ruotare · rotella per avvicinarti · tasto destro per spostarti" : city.real
            ? "Le strade di Casale, al tuo ritmo."
            : "Metti alla prova la tua prossima avventura."}
        </p>
      </div>
      <div className="map-panel">
        <div className="map-wrap">
          <canvas ref={canvas} width="220" height="220" />
          <b className="north">N ↑</b>
          <span className="map-scale">100 m</span>
        </div>
        <div className="map-caption">
          <span>{city.real ? "CASALE E DINTORNI" : "TEST DRIVE"}</span>
          <b>↗</b>
        </div>
      </div>
      {cameraMode === 3 ? <div className="city-summary">
        <span>{city.real ? "CENTRO E DINTORNI · SCALA 1:1" : "CIRCUITO DIMOSTRATIVO"}</span>
        <strong>{city.buildings.length} edifici</strong>
        <p>{city.roads.length} tratti stradali · {city.areas.length} aree</p>
        <p>{((city.bounds[2] - city.bounds[0]) / 1000).toFixed(1)} × {((city.bounds[3] - city.bounds[1]) / 1000).toFixed(1)} km da esplorare</p>
        <small>Volumi semplificati · altezze stimate dove assenti</small>
      </div> : <div className="drive-info">
        <div className="camera-label">
          ◉ {cameras[cameraMode]} <kbd>C</kbd>
        </div>
        <div className="speed">
          <span className="gear">{stats.reverse ? "R" : "D"}</span>
          <strong>{String(stats.speed).padStart(3, "0")}</strong>
          <span>km/h</span>
        </div>
        <div className="speed-track">
          <i style={{ width: `${Math.min(100, stats.speed)}%` }} />
        </div>
        <div className="vehicle-status">
          <span className={stats.collision ? "warn" : ""}>
            ●{" "}
            {stats.collision
              ? "Contatto · cambia direzione"
              : "Pronta per esplorare"}
          </span>
          <span>{(stats.distance / 1000).toFixed(1)} km</span>
        </div>
      </div>}
      <footer>
        <span>
          <kbd>W A S D</kbd> guida
        </span>
        <span>
          <kbd>SPACE</kbd> freno a mano
        </span>
        <span>
          <kbd>R</kbd> riposiziona
        </span>
      </footer>
      <div className="attribution">
        {city.real ? (
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            © OpenStreetMap contributors · ODbL
          </a>
        ) : (
          "Pista temporanea · nessun dato geografico"
        )}
      </div>
    </div>
  );
}
