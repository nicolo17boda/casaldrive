import { readFile, writeFile } from 'node:fs/promises';
import { convert, type OsmWay } from './convert';
import type { City } from '../../src/geo/types';

// Restore only source-backed bridges; preserve the existing city, spawn and download date.
const city: City = JSON.parse(await readFile('public/data/city.json', 'utf8'));
const provenance = JSON.parse(await readFile('public/data/provenance.json', 'utf8'));
const source = JSON.parse(await readFile('public/data/source.geojson', 'utf8'));
const elements: OsmWay[] = source.features.filter((f: any) =>
  f.properties.highway && f.properties.bridge && f.properties.bridge !== 'no'
  && f.geometry.type === 'LineString').map((f: any) => ({
    type: 'way', id: Number(f.id.split('/')[1]), tags: f.properties,
    geometry: f.geometry.coordinates.map(([lon, lat]: number[]) => ({lon, lat})),
  }));
const bridges = convert(elements, provenance.bbox).roads;
for (const bridge of bridges) {
  const index = city.roads.findIndex(r => r.id === bridge.id);
  if (index < 0) city.roads.push(bridge); else city.roads[index] = bridge;
}
provenance.counts.roads = city.roads.length;
provenance.processing = { ...provenance.processing,
  bridges: { source: 'bundled source.geojson', restored: bridges.length, representation: 'Flat drivable bridge decks; no elevation simulation' } };
provenance.limitations = 'Flat terrain including bridge decks; underground tunnels excluded. Heights estimated where absent. Incomplete relations skipped.';
await writeFile('public/data/city.json', JSON.stringify(city));
await writeFile('public/data/provenance.json', JSON.stringify(provenance, null, 2) + '\n');
console.log(`Restored ${bridges.length} OSM bridge segments, ${bridges.filter(r => r.drivable).length} drivable.`);
