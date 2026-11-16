import type { OsmWay } from './convert';
import { inside } from '../../src/game/physics';
import type { Point } from '../../src/geo/types';
interface Element extends OsmWay {
  lat?: number; lon?: number; nodes?: number[];
  members?: {type:string;ref:number;role:string}[];
}
// Assemble rings by shared OSM node IDs, never by approximate coordinates.
function rings(parts: number[][]): number[][] {
  const pending = parts.map(p => [...p]);
  const result: number[][] = [];
  while (pending.length) {
    const ring = pending.pop()!;
    while (ring[0] !== ring.at(-1)) {
      const index = pending.findIndex(p => p[0] === ring.at(-1) || p.at(-1) === ring.at(-1));
      if (index < 0) break;
      const next = pending.splice(index,1)[0];
      if (next[0] !== ring.at(-1)) next.reverse();
      ring.push(...next.slice(1));
    }
    if (ring.length >= 4 && ring[0] === ring.at(-1)) result.push(ring);
  }
  return result;
}
export function normalize(elements: Element[]): OsmWay[] {
  const nodes = new Map(elements.filter(e => e.type === 'node').map(e => [e.id,e]));
  const ways = new Map(elements.filter(e => e.type === 'way').map(e => [e.id,e]));
  const geometry = (ids:number[]) => ids.map(id => nodes.get(id)).filter(n => n?.lat != null && n?.lon != null).map(n => ({lat:n!.lat!,lon:n!.lon!}));
  const consumed = new Set<number>();
  const result: OsmWay[] = [];
  for (const relation of elements.filter(e => e.type === 'relation' && e.tags?.type === 'multipolygon')) {
    const tags = relation.tags!;
    if (!tags.building && !tags.landuse && !tags.leisure && !tags.natural && tags.highway !== 'pedestrian') continue;
    const members = relation.members ?? [];
    if (members.some(m => m.type === 'way' && !ways.get(m.ref)?.nodes)) continue;
    const outer = rings(members.filter(m => m.type === 'way' && m.role !== 'inner').map(m => ways.get(m.ref)!.nodes!));
    const inner = rings(members.filter(m => m.type === 'way' && m.role === 'inner').map(m => ways.get(m.ref)!.nodes!));
    outer.forEach((ids,i) => {
      const boundary = geometry(ids);
      if (boundary.length !== ids.length) return;
      const polygon:Point[] = boundary.map(p => [p.lon,p.lat]);
      const holes = inner.map(geometry).filter(h => h.length >= 4 && inside(h[0].lon,h[0].lat,polygon));
      const outerTags = members.filter(m => m.role !== 'inner').map(m => ways.get(m.ref)?.tags).find(t => t?.name);
      result.push({type:'way',id:-(relation.id*100+i),sourceId:`relation/${relation.id}`,tags:{...outerTags,...tags,area:'yes'},geometry:boundary,holes});
      members.forEach(m => { if(m.type==='way') consumed.add(m.ref); });
    });
  }
  for (const way of ways.values()) {
    if(consumed.has(way.id)) continue;
    const g = way.geometry ?? geometry(way.nodes ?? []);
    if(way.nodes && g.length !== way.nodes.length) continue;
    const t = way.tags ?? {};
    if (!t.highway && !t.building && !t.landuse && !t.leisure && !t.natural && t.place !== 'square' && t.amenity !== 'parking') continue;
    result.push({type:'way',id:way.id,sourceId:`way/${way.id}`,tags:t,geometry:g});
  }
  return result;
}
