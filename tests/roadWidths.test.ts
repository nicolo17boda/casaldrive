import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { metres, roadWidth } from '../src/geo/roadWidths';
import type { City } from '../src/geo/types';

test('explicit widths override estimates and parse metric/imperial units', () => {
  assert.deepEqual(roadWidth({highway:'residential',width:'4',lanes:'2'}),{width:4,widthSource:'width'});
  assert.equal(roadWidth({width:'8','width:carriageway':'5.5 m'}).width,5.5);
  assert.equal(metres('3,5 m'),3.5);
  assert.ok(Math.abs(metres('12 ft')! - 3.6576)<1e-8);
  for (const value of ['-3','0','NaN','3;6','4 yards','about 5']) assert.equal(metres(value),undefined);
});

test('lanes, road class and one-way distinguish estimated carriageways', () => {
  assert.equal(roadWidth({highway:'primary',lanes:'2'}).width,7);
  assert.equal(roadWidth({highway:'residential',oneway:'yes'}).width,3.5);
  assert.equal(roadWidth({highway:'residential',oneway:'-1'}).width,3.5);
  assert.equal(roadWidth({highway:'residential',oneway:'no'}).width,5.5);
  assert.equal(roadWidth({highway:'footway'}).width,1.8);
  assert.equal(roadWidth({highway:'service',service:'alley'}).width,3);
  assert.equal(roadWidth({highway:'residential',access:'private'}).width,5.5);
  assert.equal(roadWidth({highway:'residential',lanes:'2;3'}).widthSource,'estimated');
});

test('bundled widths match source tags and measured Via Duomo stays four metres', () => {
  const city: City = JSON.parse(readFileSync('public/data/city.json','utf8'));
  const source = JSON.parse(readFileSync('public/data/source.geojson','utf8'));
  const tags = new Map<string,Record<string,string>>(source.features.map((f: { id:string; properties:Record<string,string> })=>[f.id,f.properties]));
  for (const road of city.roads) {
    const result = roadWidth(tags.get(`way/${road.id}`)!);
    assert.equal(road.width,result.width);
    assert.equal(road.widthSource,result.widthSource);
  }
  assert.ok(city.roads.some(r=>r.name==='Via Duomo' && r.width===4 && r.widthSource==='width'));
});
