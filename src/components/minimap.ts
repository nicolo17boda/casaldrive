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
    ctx.lineWidth = road.width;
    ctx.beginPath();
    road.points.forEach(([x,z], i) => i ? ctx.lineTo(x,z) : ctx.moveTo(x,z));
    ctx.stroke();
  }
  return { canvas, scale, originX, originZ };
}
