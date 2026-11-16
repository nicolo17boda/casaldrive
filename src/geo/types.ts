export type Point = [number, number]; // east, south in metres
export interface Road {
  id: number;
  name: string;
  points: Point[];
  width: number;
  drivable: boolean;
}
export interface Building {
  id: number;
  points: Point[];
  height: number;
}
export interface Area {
  id: number;
  points: Point[];
  kind: "green" | "square" | "water";
}
export interface City {
  name: string;
  real: boolean;
  origin: [number, number];
  roads: Road[];
  buildings: Building[];
  areas: Area[];
  spawn: { x: number; z: number; yaw: number };
  bounds: [number, number, number, number];
  generatedAt?: string;
}
