import type { City, Point } from './types';
import { inside } from '../game/collision';
export interface PlaceLabel { name: string; point: Point; square: boolean }
export function placeLabels(city: City): PlaceLabel[] {
  const labels: PlaceLabel[] = [];
  const roads = new Map<string, { points: Point[]; length: number }>();
  for (const road of city.roads) {
    if (!road.name || road.name === road.highway) continue;
    const length = road.points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0]-road.points[i][0], p[1]-road.points[i][1]), 0);
    if (length > (roads.get(road.name)?.length ?? 0)) roads.set(road.name, {points:road.points,length});
  }
  for (const [name, {points,length}] of roads) {
    let remaining = length / 2;
    for (let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i],d=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if (d && remaining <= d) { labels.push({name,point:[a[0]+(b[0]-a[0])*remaining/d,a[1]+(b[1]-a[1])*remaining/d],square:false}); break; }
      remaining -= d;
    }
  }
  for (const area of city.areas) if (area.kind === 'square' && area.name) {
    const points=area.points.slice(0,-1);
    const point: Point=[points.reduce((n,p)=>n+p[0],0)/points.length,points.reduce((n,p)=>n+p[1],0)/points.length];
    const old=labels.findIndex(l=>l.name===area.name);if(old>=0) labels.splice(old,1);
    labels.push({name:area.name,point,square:true});
  }
  return labels.filter(l => l.point.every(Number.isFinite));
}
export function currentPlace(city: City, x: number, z: number): string {
  for (const area of city.areas) if (area.kind==='square' && area.name && inside(x,z,area.points)
    && !(area.holes??[]).some(h=>inside(x,z,h))) return area.name;
  let nearest=35*35, name='';
  for(const road of city.roads) {
    if(!road.name || road.name===road.highway) continue;
    for(let i=1;i<road.points.length;i++) {
      const a=road.points[i-1],b=road.points[i],dx=b[0]-a[0],dz=b[1]-a[1];
      const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
      const d=(x-a[0]-t*dx)**2+(z-a[1]-t*dz)**2;
      if(d<nearest){nearest=d;name=road.name;}
    }
  }
  return name;
}
