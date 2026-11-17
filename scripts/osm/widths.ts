import { readFile, writeFile, rename } from 'node:fs/promises';
import { roadWidth } from '../../src/geo/roadWidths';
import type { City } from '../../src/geo/types';

// Reprocess widths from the bundled source without downloading or altering footprints.
const city: City = JSON.parse(await readFile('public/data/city.json', 'utf8'));
const source: { features: { id: string; properties: Record<string, string> }[] } =
  JSON.parse(await readFile('public/data/source.geojson', 'utf8'));
const tagsById = new Map(source.features.map(feature => [feature.id, feature.properties]));
let changed = 0;
for (const road of city.roads) {
  const tags = tagsById.get(`way/${road.id}`);
  if (!tags?.highway) throw new Error(`Missing source tags for road ${road.id}`);
  const dimensions = roadWidth(tags);
  if (road.width !== dimensions.width) changed++;
  Object.assign(road, dimensions, { highway: tags.highway });
}
await writeFile('public/data/city.json.tmp', JSON.stringify(city));
await rename('public/data/city.json.tmp', 'public/data/city.json');
console.log(`Updated ${changed}/${city.roads.length} road widths from the bundled OSM source.`);
