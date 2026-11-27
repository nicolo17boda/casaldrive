import { roadWidth } from "../../src/geo/roadWidths";
import { project, ORIGIN } from "../../src/geo/coordinates";
import type { City, Point } from "../../src/geo/types";
import { collides } from "../../src/game/physics";
export interface OsmWay {
  sourceId?: string;
  holes?: { lat: number; lon: number }[][];
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}
const drivableTypes = new Set([
  "residential",
  "primary",
  "secondary",
  "tertiary",
  "unclassified",
  "service",
  "living_street",
  "primary_link",
  "secondary_link",
  "tertiary_link",
]);
export function numberTag(value: string | undefined, fallback: number) {
  const n = parseFloat(value?.replace(",", ".") ?? "");
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
export function convert(
  elements: OsmWay[],
  bbox: [number, number, number, number],
): City {
  const nw = project(bbox[1], bbox[2]),
    se = project(bbox[3], bbox[0]);
  const city: City = {
    name: "Casale Monferrato",
    real: true,
    origin: ORIGIN,
    roads: [],
    buildings: [],
    areas: [],
    bounds: [nw[0], nw[1], se[0], se[1]],
    spawn: { x: 0, z: 0, yaw: 0 },
    generatedAt: new Date().toISOString(),
  };
  for (const e of elements) {
    if (e.type !== "way" || !e.geometry || e.geometry.length < 2) continue;
    const t = e.tags ?? {},
      points = e.geometry.map((p) => project(p.lon, p.lat));
    if (points.some((p) => p.some((n) => !Number.isFinite(n)))) continue;
    const closed =
      points.length >= 4 &&
      points[0][0] === points.at(-1)![0] &&
      points[0][1] === points.at(-1)![1];
    if (t.building && t.building !== "no" && closed) {
      city.buildings.push({
        id: e.id,
        points,
        holes: e.holes?.map(ring => ring.map(p => project(p.lon, p.lat))),
        name: t.name,
        height: Math.min(
          80,
          numberTag(t.height, numberTag(t["building:levels"], 3) * 3.1),
        ),
      });
    } else if (
      t.highway &&
      t.area !== "yes" &&
      t.tunnel !== "yes"
    ) {
      const access = t.motor_vehicle ?? t.vehicle ?? t.access;
      const drivable =
        drivableTypes.has(t.highway) &&
        !["no", "private", "agricultural", "forestry"].includes(access);
      city.roads.push({
        id: e.id,
        name: t.name ?? t.highway,
        points,
        ...roadWidth(t),
        highway: t.highway,
        drivable,
        ...(t.bridge && t.bridge !== "no" ? { bridge: true } : {}),
      });
    } else if (
      closed &&
      (["park", "garden", "recreation_ground"].includes(t.leisure) ||
        ["grass", "meadow", "forest", "village_green", "recreation_ground"].includes(t.landuse) ||
        ["wood", "scrub", "grassland"].includes(t.natural) ||
        t.natural === "water" ||
        t.waterway === "riverbank" ||
        t.highway === "pedestrian" ||
        t.amenity === "parking" || t.place === "square")
    ) {
      city.areas.push({
        id: e.id,
        points,
        holes: e.holes?.map(ring => ring.map(p => project(p.lon, p.lat))),
        name: t.name,
        kind:
          t.natural === "water" || t.waterway === "riverbank"
            ? "water"
            : t.highway === "pedestrian" || t.amenity === "parking" || t.place === "square"
              ? "square"
              : "green",
      });
    }
  }
  // Prefer Piazza Castello; otherwise choose the nearest clear, wide road segment.
  const candidates: { x: number; z: number; yaw: number; score: number }[] = [];
  for (const r of city.roads.filter((r) => r.drivable && r.width >= 5))
    for (let i = 1; i < r.points.length; i++) {
      const a = r.points[i - 1],
        b = r.points[i];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 8) continue;
      const x = (a[0] + b[0]) / 2,
        z = (a[1] + b[1]) / 2;
      if (
        x < city.bounds[0] + 10 ||
        z < city.bounds[1] + 10 ||
        x > city.bounds[2] - 10 ||
        z > city.bounds[3] - 10 ||
        collides(x, z, city.buildings, 3)
      )
        continue;
      candidates.push({
        x,
        z,
        yaw: Math.atan2(-(b[0] - a[0]), -(b[1] - a[1])),
        score: Math.hypot(x, z) - (r.name.includes("Castello") ? 1000 : 0),
      });
    }
  candidates.sort((a, b) => a.score - b.score);
  if (!candidates.length)
    throw new Error("No collision-free drivable spawn found");
  const { x, z, yaw } = candidates[0];
  city.spawn = { x, z, yaw };
  return city;
}
export function geojson(elements: OsmWay[]) {
  return {
    type: "FeatureCollection",
    features: elements
      .filter((e) => e.type === "way" && e.geometry && e.geometry.length >= 2)
      .map((e) => {
        const coordinates = e.geometry!.map((p) => [p.lon, p.lat]);
        const polygon =
          coordinates.length >= 4 &&
          coordinates[0][0] === coordinates.at(-1)![0] &&
          coordinates[0][1] === coordinates.at(-1)![1] &&
          (e.tags?.building ||
            e.tags?.landuse ||
            e.tags?.leisure ||
            e.tags?.area === "yes" ||
            e.tags?.natural || e.tags?.waterway === "riverbank" || e.tags?.place === "square");
        return {
          type: "Feature",
          id: e.sourceId ?? `way/${e.id}`,
          properties: e.tags ?? {},
          geometry: {
            type: polygon ? "Polygon" : "LineString",
            coordinates: polygon ? [coordinates, ...(e.holes ?? []).map(ring => ring.map(p => [p.lon,p.lat]))] : coordinates,
          },
        };
      }),
  };
}
