import type { City } from "./types";
export function testWorld(): City {
  return {
    name: "Circuito di prova",
    real: false,
    origin: [0, 0],
    bounds: [-220, -220, 220, 220],
    spawn: { x: 0, z: 60, yaw: 0 },
    roads: [
      {
        id: 1,
        name: "Rettilineo",
        points: [
          [0, 180],
          [0, -150],
        ],
        width: 16,
        drivable: true,
      },
      {
        id: 2,
        name: "Circuito",
        points: [
          [0, -150],
          [150, -150],
          [150, 150],
          [0, 150],
          [-150, 150],
          [-150, -150],
          [0, -150],
        ],
        width: 14,
        drivable: true,
      },
    ],
    buildings: [
      {
        id: 1,
        points: [
          [30, -60],
          [65, -60],
          [65, -20],
          [30, -20],
          [30, -60],
        ],
        height: 14,
      },
      {
        id: 2,
        points: [
          [-65, 0],
          [-30, 0],
          [-30, 45],
          [-65, 45],
          [-65, 0],
        ],
        height: 9,
      },
    ],
    areas: [],
  };
}
export async function loadCity(): Promise<City> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/city.json`);
  if (!response.ok) throw new Error("Dati locali non disponibili");
  const city = (await response.json()) as City;
  if (!city.roads?.length || !city.buildings || !city.spawn || !city.bounds)
    throw new Error("Dati città non validi");
  return city;
}
