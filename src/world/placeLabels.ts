import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { City } from '../geo/types';
import { placeLabels } from '../geo/placeNames';

/** Screen-space map labels: one canvas, no textures or per-label draw calls. */
export function attachPlaceLabels(scene: Scene, city: City, canvas: HTMLCanvasElement) {
  const labels=placeLabels(city), ctx=canvas.getContext('2d');
  if(!ctx) return () => {};
  let last=-Infinity;
  const observer=scene.onAfterRenderObservable.add(()=> {
    const now=performance.now();if(now-last<90)return;last=now;
    const width=canvas.clientWidth,height=canvas.clientHeight;
    if(canvas.width!==width || canvas.height!==height){canvas.width=width;canvas.height=height;}
    ctx.clearRect(0,0,width,height);
    const camera=scene.activeCamera;if(!camera)return;
    const viewport=camera.viewport.toGlobal(width,height);
    const occupied: {x:number;y:number;w:number}[]=[];
    const candidates=labels.map(l=>({...l,d:Vector3.DistanceSquared(camera.position,new Vector3(l.point[0],0,l.point[1]))}))
      .filter(l=>l.d<(camera.name==='city-overview'?5000:260)**2)
      .sort((a,b)=>Number(b.square)-Number(a.square)||a.d-b.d);
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
    for(const l of candidates) {
      const p=Vector3.Project(new Vector3(l.point[0],1.8,l.point[1]),Matrix.Identity(),scene.getTransformMatrix(),viewport);
      if(p.z<0 || p.z>1 || p.x<90 || p.x>width-90 || p.y<100 || p.y>height-110)continue;
      ctx.font=`${l.square?'600':'500'} ${l.square?14:12}px system-ui`;
      const w=ctx.measureText(l.name).width+18;
      if(occupied.some(o=>Math.abs(o.x-p.x)<(o.w+w)/2 && Math.abs(o.y-p.y)<27))continue;
      occupied.push({x:p.x,y:p.y,w});
      ctx.strokeStyle='rgba(15,25,30,.85)';ctx.lineWidth=4;ctx.strokeText(l.name,p.x,p.y);
      ctx.fillStyle=l.square?'#ffe6a8':'#ffffff';ctx.fillText(l.name,p.x,p.y);
      if(occupied.length>=20)break;
    }
  });
  return ()=>scene.onAfterRenderObservable.remove(observer);
}
