import type { Building, City } from '../geo/types';

type Bounds = City['bounds'];
const CELL_SIZE = 32;
const boundsCache = new WeakMap<Building, Bounds>();

export function buildingBounds(building: Building): Bounds {
  let box = boundsCache.get(building);
  if (!box) {
    box = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [x, z] of building.points) {
      box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], z);
      box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], z);
    }
    boundsCache.set(building, box);
  }
  return box;
}

/** Static geometry: replace the buildings array when loading or editing a city. */
export class BuildingIndex {
  private cells = new Map<string, Building[]>();

  constructor(buildings: Building[]) {
    for (const building of buildings) {
      this.visitCells(buildingBounds(building), key => {
        const cell = this.cells.get(key);
        if (cell) cell.push(building);
        else this.cells.set(key, [building]);
      });
    }
  }

  private visitCells([left, top, right, bottom]: Bounds, visit: (key: string) => void) {
    for (let x = Math.floor(left / CELL_SIZE); x <= Math.floor(right / CELL_SIZE); x++) {
      for (let z = Math.floor(top / CELL_SIZE); z <= Math.floor(bottom / CELL_SIZE); z++) {
        visit(`${x},${z}`);
      }
    }
  }

  query(box: Bounds): Building[] {
    const found = new Set<Building>();
    this.visitCells(box, key => {
      for (const building of this.cells.get(key) ?? []) {
        const [left, top, right, bottom] = buildingBounds(building);
        if (left <= box[2] && right >= box[0] && top <= box[3] && bottom >= box[1]) {
          found.add(building);
        }
      }
    });
    return [...found];
  }
}

const indexes = new WeakMap<Building[], BuildingIndex>();
export function buildingIndex(buildings: Building[]): BuildingIndex {
  let index = indexes.get(buildings);
  if (!index) {
    index = new BuildingIndex(buildings);
    indexes.set(buildings, index);
  }
  return index;
}
