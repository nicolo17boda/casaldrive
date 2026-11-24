export type Bbox = [number, number, number, number];
// South, west, north, east: centre and surrounding neighbourhoods (~1.9 × 1.7 km).
export const DEFAULT_BBOX: Bbox = [45.130, 8.440, 45.145, 8.464];
export function parseBbox(value?: string): Bbox {
  if (!value) return [...DEFAULT_BBOX];
  const coordinates = value.split(',').map(Number);
  if (coordinates.length !== 4 || value.split(',').some(v => !v.trim()) || coordinates.some(v => !Number.isFinite(v))
    || coordinates[0] >= coordinates[2] || coordinates[1] >= coordinates[3]
    || coordinates[0] < -90 || coordinates[2] > 90 || coordinates[1] < -180 || coordinates[3] > 180) {
    throw new Error('OSM_BBOX must be south,west,north,east with increasing valid coordinates');
  }
  return coordinates as Bbox;
}
export function overpassQuery(bbox: Bbox) {
  const selectors = ['highway', 'building', 'leisure', 'landuse', 'natural', 'waterway', '"amenity"="parking"', '"place"="square"'];
  // Fetch relation members and their nodes too, to reconstruct complete courtyards.
  return `[out:json][timeout:90];(${selectors.map(tag => `way[${tag}](${bbox});relation[${tag}][type=multipolygon](${bbox});`).join('')});(._;>>;);out body;`;
}
