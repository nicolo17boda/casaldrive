import { useEffect, useRef, useState } from "react";
import type { City } from "../geo/types";
import type { VehicleState } from "../game/physics";
export const cameras = ["Inseguimento", "Ravvicinata", "Panoramica"];
export default function HUD({
  city,
  vehicle,
  cameraMode,
  onPause,
}: {
  city: City;
  vehicle: VehicleState;
  cameraMode: number;
  onPause: () => void;
}) {
  const [stats, setStats] = useState({
    speed: 0,
    distance: 0,
    collision: false,
    reverse: false,
  });
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const id = setInterval(() => {
      setStats({
        speed: Math.round(Math.abs(vehicle.speed) * 3.6),
        distance: vehicle.distance,
        collision: vehicle.collision,
        reverse: vehicle.speed < -0.1,
      });
      const ctx = canvas.current?.getContext("2d");
      if (!ctx) return;
      const size = 220,
        scale = 0.6;
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = "#e2e4d4";
      ctx.fillRect(0, 0, size, size);
      ctx.save();
      ctx.translate(size / 2, size / 2);
      ctx.scale(scale, scale);
      ctx.translate(-vehicle.x, -vehicle.z);
      ctx.fillStyle = "#bdc1af";
      for (const b of city.buildings) {
        ctx.beginPath();
        b.points.forEach(([x, z], i) =>
          i ? ctx.lineTo(x, z) : ctx.moveTo(x, z),
        );
        ctx.fill();
      }
      ctx.strokeStyle = "#faf9eb";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const r of city.roads) {
        ctx.lineWidth = r.width;
        ctx.beginPath();
        r.points.forEach(([x, z], i) =>
          i ? ctx.lineTo(x, z) : ctx.moveTo(x, z),
        );
        ctx.stroke();
      }
      ctx.restore();
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
    }, 100);
    return () => clearInterval(id);
  }, [city, vehicle]);
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
        <button className="pause-button" onClick={onPause}>
          Ⅱ <span>Pausa</span>
          <kbd>ESC</kbd>
        </button>
      </header>
      <div className="place-tag">
        <span>ESPLORAZIONE LIBERA</span>
        <h1>{city.real ? "Un giro in città." : "Si parte da qui."}</h1>
        <p>
          {city.real
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
          <span>{city.real ? "CENTRO STORICO" : "TEST DRIVE"}</span>
          <b>↗</b>
        </div>
      </div>
      <div className="drive-info">
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
      </div>
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
