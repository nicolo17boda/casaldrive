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

import { normalize } from '../scripts/osm/normalize';
import { collides } from '../src/game/physics';
import { readFileSync } from 'node:fs';
import type { City } from '../src/geo/types';
test('API multipolygon members assemble and preserve inner courtyards', () => {
  const elements = [
    ...[[0,0],[0,10],[10,10],[10,0],[3,3],[3,7],[7,7],[7,3]].map(([lon,lat],i)=>({type:'node',id:i+1,lon,lat})),
    {type:'way',id:10,nodes:[1,2,3]}, {type:'way',id:11,nodes:[1,4,3]},
    {type:'way',id:12,nodes:[5,6,7,8,5]},
    {type:'relation',id:20,tags:{type:'multipolygon',building:'yes'},members:[{type:'way',ref:10,role:'outer'},{type:'way',ref:11,role:'outer'},{type:'way',ref:12,role:'inner'}]}
  ];
  const result = normalize(elements);
  assert.equal(result.length,1);
  assert.equal(result[0].geometry!.length,5);
  assert.equal(result[0].holes!.length,1);
  assert.equal(geojson(result).features[0].geometry.coordinates.length,2);
});
test('courtyards remain empty but their walls still collide', () => {
  const buildings = [{id:1,height:10,points:[[0,0],[20,0],[20,20],[0,20],[0,0]] as [number,number][],holes:[[[5,5],[15,5],[15,15],[5,15],[5,5]] as [number,number][]]}];
  assert.equal(collides(10,10,buildings,1),false);
  assert.equal(collides(5.5,10,buildings,1),true);
  assert.equal(collides(2,10,buildings,1),true);
});
test('bundled Casale data contains real central squares and a clear road spawn', () => {
  const city:City = JSON.parse(readFileSync('public/data/city.json','utf8'));
  assert.equal(city.real,true);
  assert.ok(city.buildings.length>400);
  assert.ok(city.roads.some(r=>r.name==='Piazza Castello'));
  assert.ok(city.areas.some(a=>a.name?.includes('Mazzini')));
  assert.ok(city.buildings.some(b=>(b.holes?.length??0)>0));
  assert.equal(collides(city.spawn.x,city.spawn.z,city.buildings,3),false);
  assert.ok(city.roads.filter(r=>r.drivable).some(r=>r.points.slice(1).some((b,i)=>Math.hypot((r.points[i][0]+b[0])/2-city.spawn.x,(r.points[i][1]+b[1])/2-city.spawn.z)<0.01)));
});

import { DEFAULT_BBOX, parseBbox, overpassQuery } from '../scripts/osm/region';

test('expanded region is configurable and rejects malformed or reversed bounds', () => {
  assert.deepEqual(parseBbox(), DEFAULT_BBOX);
  assert.deepEqual(parseBbox('45.13,8.44,45.15,8.47'), [45.13,8.44,45.15,8.47]);
  for (const input of ['45,8,44,9', '45,9,46,8', '45,8,46', 'NaN,8,46,9', '45,,46,9']) {
    assert.throws(() => parseBbox(input));
  }
  const query = overpassQuery(DEFAULT_BBOX);
  assert.ok(query.includes('relation[building][type=multipolygon]'));
  assert.ok(query.includes('>>;')); // Resolve member ways and their nodes.
});

test('garden, meadow and riverbank polygons are retained with geographic holes', () => {
  const polygon = fixture[2].geometry!;
  const extra: OsmWay[] = [
    { type: 'way', id: 40, tags: { leisure: 'garden' }, geometry: polygon },
    { type: 'way', id: 41, tags: { landuse: 'meadow' }, geometry: polygon },
    { type: 'way', id: 42, tags: { waterway: 'riverbank' }, geometry: polygon },
  ];
  const city = convert([...fixture, ...extra], DEFAULT_BBOX);
  assert.deepEqual(city.areas.map(a => a.kind), ['green', 'green', 'water']);
  assert.ok(geojson(extra).features.every(feature => feature.geometry.type === 'Polygon'));
});

test('incomplete multipolygon inner ring never silently becomes a filled building', () => {
  const elements = [
    ...[[0,0],[0,10],[10,10],[10,0],[3,3],[3,7],[7,7]].map(([lon,lat],i)=>({type:'node',id:i+1,lon,lat})),
    {type:'way',id:10,nodes:[1,2,3,4,1]},
    {type:'way',id:12,nodes:[5,6,7]}, // Missing the closing member.
    {type:'relation',id:20,tags:{type:'multipolygon',building:'yes'},members:[
      {type:'way',ref:10,role:'outer'},{type:'way',ref:12,role:'inner'},
    ]},
  ];
  assert.equal(normalize(elements).length, 0);
});

test('expanded bundled city covers the old centre and surrounding real neighbourhoods', () => {
  const city: City = JSON.parse(readFileSync('public/data/city.json','utf8'));
  assert.ok(city.bounds[2] - city.bounds[0] > 1800);
  assert.ok(city.bounds[3] - city.bounds[1] > 1600);
  assert.ok(city.buildings.length > 1000 && city.roads.length > 800);
  assert.ok(city.areas.some(a => a.name === 'Giardini Egidio Ortona'));
  assert.ok(city.areas.some(a => a.kind === 'water'));
  assert.ok(city.roads.some(r => r.name === 'Piazza Castello'));
});
