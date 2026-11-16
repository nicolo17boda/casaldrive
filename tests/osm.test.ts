import { test } from "node:test";
import assert from "node:assert/strict";
import { convert, geojson, type OsmWay } from "../scripts/osm/convert";
const fixture: OsmWay[] = [
  {
    type: "way",
    id: 1,
    tags: { highway: "residential", name: "Test" },
    geometry: [
      { lon: 8.452, lat: 45.137 },
      { lon: 8.452, lat: 45.138 },
    ],
  },
  {
    type: "way",
    id: 2,
    tags: { highway: "footway" },
    geometry: [
      { lon: 8.451, lat: 45.137 },
      { lon: 8.451, lat: 45.138 },
    ],
  },
  {
    type: "way",
    id: 3,
    tags: { building: "yes", "building:levels": "2" },
    geometry: [
      { lon: 8.453, lat: 45.137 },
      { lon: 8.4535, lat: 45.137 },
      { lon: 8.4535, lat: 45.1375 },
      { lon: 8.453, lat: 45.137 },
    ],
  },
];
test("OSM uses footprints, levels, access and road-based spawn", () => {
  const c = convert(fixture, [45.13, 8.44, 45.15, 8.47]);
  assert.equal(c.buildings[0].height, 6.2);
  assert.equal(c.roads[1].drivable, false);
  assert.equal(c.spawn.x, c.roads[0].points[0][0]);
  assert.ok(c.spawn.z < c.roads[0].points[0][1]);
});
test("GeoJSON preserves geographic coordinates", () => {
  const g = geojson(fixture);
  assert.equal(g.features[2].geometry.type, "Polygon");
  assert.deepEqual(g.features[0].geometry.coordinates[0], [8.452, 45.137]);
});
test("empty or undrivable data cannot silently create a fictional spawn", () => {
  assert.throws(() => convert([], [45.13, 8.44, 45.15, 8.47]), /spawn/);
});
