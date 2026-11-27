import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { placeLabels, currentPlace } from '../src/geo/placeNames';
import type { City } from '../src/geo/types';
import { project } from '../src/geo/coordinates';
import { roadsGeometry } from '../src/world/roadsGeometry';
const city:City=JSON.parse(readFileSync('public/data/city.json','utf8'));
const source=JSON.parse(readFileSync('public/data/source.geojson','utf8'));

test('all nine source bridges retain their real geometry and connect to the road network',()=>{
  const bridges=source.features.filter((f:any)=>f.properties.highway && f.properties.bridge==='yes');
  assert.equal(bridges.length,9);
  for(const feature of bridges) {
    const id=Number(feature.id.split('/')[1]);
    const road=city.roads.find(r=>r.id===id)!;
    assert.ok(road?.bridge);
    assert.deepEqual(road.points,feature.geometry.coordinates.map(([lon,lat]:number[])=>project(lon,lat)));
    if(road.drivable) for(const end of [road.points[0],road.points.at(-1)!]) {
      assert.ok(city.roads.some(r=>r.id!==id && r.points.some(p=>Math.hypot(p[0]-end[0],p[1]-end[1])<0.1)),`${id} endpoint must connect`);
    }
    const geometry=roadsGeometry({...city,roads:[road]},road.drivable);
    assert.ok(geometry.getAttribute('position').count>0);
    geometry.dispose();
  }
});

test('named streets and squares are deduplicated; unnamed highway types are not labels',()=>{
  const labels=placeLabels(city);
  assert.ok(labels.length>80);
  assert.equal(new Set(labels.map(l=>l.name)).size,labels.length);
  assert.ok(labels.some(l=>l.name==='Via Francesco Negri'));
  assert.ok(labels.some(l=>l.name.includes('Piazza')));
  assert.ok(!labels.some(l=>['primary','residential','footway'].includes(l.name)));
  const road=city.roads.find(r=>r.name==='Via Francesco Negri' && r.bridge)!;
  const a=road.points[0], b=road.points[1];
  assert.equal(currentPlace(city,(a[0]+b[0])/2,(a[1]+b[1])/2),'Via Francesco Negri');
  assert.equal(currentPlace(city,100000,100000),'');
});
