import { mkdir, writeFile, rename, readFile } from "node:fs/promises";
import { convert, geojson, type OsmWay } from "./convert";
// South, west, north, east: central Casale, including Piazza Castello and Piazza Mazzini.
const bbox: [number, number, number, number] = [
  45.1318, 8.4435, 45.143, 8.4625,
];
const query = `[out:json][timeout:60];(way[highway](${bbox});way[building](${bbox});way[leisure=park](${bbox});way[landuse=grass](${bbox});way[natural=water](${bbox});way[amenity=parking](${bbox}););out geom;`;
const endpoints = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
async function main() {
  let raw: { elements: OsmWay[]; osm3s?: unknown } | undefined;
  let source = "local OSM input";
  const input = process.argv[2];
  if (input) raw = JSON.parse(await readFile(input, "utf8"));
  else
    for (const endpoint of endpoints) {
      try {
        console.log(`Downloading ${endpoint}`);
        const response = await fetch(endpoint, {
          method: "POST",
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(90000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        raw = (await response.json()) as typeof raw;
        source = endpoint;
        break;
      } catch (error) {
        console.warn(String(error));
      }
    }
  if (!raw?.elements?.length)
    throw new Error(
      "OSM unavailable or empty. Existing data retained; application can use the labeled test circuit.",
    );
  const city = convert(raw.elements, bbox);
  if (!city.buildings.length)
    throw new Error("No buildings returned; refusing to replace city");
  await mkdir("public/data", { recursive: true });
  await writeFile(
    "public/data/source.geojson",
    JSON.stringify(geojson(raw.elements)),
  );
  await writeFile(
    "public/data/provenance.json",
    JSON.stringify(
      {
        source,
        query,
        bbox,
        downloadedAt: new Date().toISOString(),
        osm3s: raw.osm3s,
        attribution: "© OpenStreetMap contributors",
        license: "ODbL-1.0",
        copyright: "https://www.openstreetmap.org/copyright",
        projection:
          "Local equirectangular, WGS84 radius 6378137, X east / Z south, metres",
        origin: city.origin,
        limitations:
          "Way polygons only; multipolygon relations, holes, elevation and bridges not supported.",
      },
      null,
      2,
    ),
  );
  await writeFile("public/data/city.json.tmp", JSON.stringify(city));
  await rename("public/data/city.json.tmp", "public/data/city.json");
  console.log(
    `Saved ${city.roads.length} roads, ${city.buildings.length} buildings, ${city.areas.length} areas. Spawn: ${JSON.stringify(city.spawn)}`,
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
