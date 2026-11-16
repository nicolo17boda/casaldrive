import { mkdir, writeFile, rename, readFile } from "node:fs/promises";
import { convert, geojson, type OsmWay } from "./convert";
import { normalize } from "./normalize";
// South, west, north, east: central Casale, including Piazza Castello and Piazza Mazzini.
const bbox: [number, number, number, number] = [
  45.134, 8.446, 45.141, 8.457,
];
const query = `[out:json][timeout:60];(way[highway](${bbox});way[building](${bbox});way[leisure=park](${bbox});way[landuse=grass](${bbox});way[natural=water](${bbox});way[amenity=parking](${bbox}););out geom;`;
const apiUrl = `https://api.openstreetmap.org/api/0.6/map.json?bbox=${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]}`;
const endpoints = [
  apiUrl,
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
async function main() {
  let raw: { elements: OsmWay[]; osm3s?: unknown } | undefined;
  let source = "local OSM input";
  const input = process.argv[2];
  if (input) {
    raw = JSON.parse(await readFile(input, "utf8"));
    source = process.env.OSM_SOURCE_URL ?? "local OSM input";
  }
  else
    for (const endpoint of endpoints) {
      try {
        console.log(`Downloading ${endpoint}`);
        const response = await fetch(endpoint, {
          ...(endpoint === apiUrl ? {} : {method: "POST", body: new URLSearchParams({data:query})}),
          signal: AbortSignal.timeout(45000),
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
  const elements = normalize(raw.elements);
  const city = convert(elements, bbox);
  if (!city.buildings.length)
    throw new Error("No buildings returned; refusing to replace city");
  await mkdir("public/data", { recursive: true });
  await writeFile(
    "public/data/source.geojson",
    JSON.stringify(geojson(elements)),
  );
  await writeFile(
    "public/data/provenance.json",
    JSON.stringify(
      {
        source,
        query: source.includes("map.json") ? null : query,
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
          "OSM polygons and assembled multipolygon courtyards. Incomplete relations skipped. Flat terrain; no bridge/tunnel geometry. Heights estimated where absent.",
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
