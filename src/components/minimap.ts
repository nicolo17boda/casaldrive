import { placeLabels } from '../geo/placeNames';
import type { City } from '../geo/types';

/** Rasterize static geography once; each HUD tick only copies the visible region. */
export function buildMinimap(city: City) {
  const padding = 220;
  const [left, top, right, bottom] = city.bounds;
  const width = right - left + padding * 2;
  const height = bottom - top + padding * 2;
  const scale = Math.min(0.6, 2048 / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  const ctx = canvas.getContext('2d')!;
  const originX = left - padding, originZ = top - padding;
  ctx.fillStyle = '#e2e4d4';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.translate(-originX, -originZ);
  // Match the world's parks, squares and water before drawing buildings/roads.
  for (const area of city.areas) {
    ctx.fillStyle = area.kind === 'water' ? '#83a6ad' : area.kind === 'green' ? '#a3b58a' : '#d4cebc';
    ctx.beginPath();
    for (const ring of [area.points, ...(area.holes ?? [])]) {
      ring.forEach(([x, z], i) => i ? ctx.lineTo(x, z) : ctx.moveTo(x, z));
      ctx.closePath();
    }
    ctx.fill('evenodd');
  }
  ctx.fillStyle = '#bdc1af';
  for (const building of city.buildings) {
    ctx.beginPath();
    building.points.forEach(([x,z], i) => i ? ctx.lineTo(x,z) : ctx.moveTo(x,z));
    for (const hole of building.holes ?? []) {
      hole.forEach(([x,z], i) => i ? ctx.lineTo(x,z) : ctx.moveTo(x,z));
      ctx.closePath();
    }
    ctx.fill('evenodd');
  }
  ctx.strokeStyle = '#faf9eb';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const road of city.roads) {
    if (road.bridge) {
      ctx.strokeStyle='#65767d';ctx.lineWidth=road.width+3;ctx.beginPath();
      road.points.forEach(([x,z],i)=>i?ctx.lineTo(x,z):ctx.moveTo(x,z));ctx.stroke();
    }
    ctx.strokeStyle='#faf9eb';
    ctx.lineWidth = road.width;
    ctx.beginPath();
    road.points.forEach(([x,z], i) => i ? ctx.lineTo(x,z) : ctx.moveTo(x,z));
    ctx.stroke();
  }
  ctx.font = '19px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
  const occupied: {x:number;z:number;w:number}[]=[];
  for(const label of placeLabels(city).sort((a,b)=>Number(b.square)-Number(a.square))) {
    const [x,z]=label.point,w=ctx.measureText(label.name).width+14;
    if(occupied.some(o=>Math.abs(o.x-x)<(o.w+w)/2 && Math.abs(o.z-z)<32)) continue;
    occupied.push({x,z,w});ctx.strokeStyle='#f8f7ef';ctx.lineWidth=5;
    ctx.strokeText(label.name,x,z);ctx.fillStyle='#24343c';ctx.fillText(label.name,x,z);
  }
  return { canvas, scale, originX, originZ };
}
