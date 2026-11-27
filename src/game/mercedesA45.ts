import type { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { material } from '../world/babylonWorld';

/** Original procedural W177-inspired model. Slightly shortened to fit the arcade collider. */
export function createMercedesA45(scene: Scene) {
  const car = new TransformNode('car', scene);
  car.metadata = { model: 'Mercedes-AMG A 45 S', procedural: true };
  const paint = material(scene, 'amg-mountain-grey', '#869398');
  paint.specularColor.set(0.85, 0.88, 0.9); paint.specularPower = 100;
  const glass = material(scene, 'amg-glass', '#14272f');
  glass.specularColor.set(0.7, 0.8, 0.9); glass.specularPower = 128;
  const black = material(scene, 'amg-night-package', '#11171b');
  const rubber = material(scene, 'amg-rubber', '#17191b');
  const alloy = material(scene, 'amg-alloy', '#a6afb4');
  alloy.specularColor.set(0.9, 0.9, 0.9); alloy.specularPower = 100;
  const red = material(scene, 'amg-calipers', '#ca202a');
  const led = material(scene, 'amg-led', '#e9f5ff'); led.emissiveColor.set(0.8, 0.9, 1);
  const brake = material(scene, 'brake-lights', '#b51824');
  const box = (name: string, size: number[], pos: number[], mat = paint, parent = car) => {
    const mesh = CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene);
    mesh.position.set(pos[0], pos[1], pos[2]); mesh.material = mat; mesh.parent = parent;
    return mesh;
  };
  // Cross-sections: z, half-width, bottom, shoulder, upper half-width, top.
  const loft = (name: string, sections: number[][], mat: typeof paint) => {
    const positions: number[] = [], indices: number[] = [], normals: number[] = [];
    for (const [z, w, bottom, shoulder, topW, top] of sections)
      positions.push(-w,bottom,z, w,bottom,z, w,shoulder,z, topW,top,z, -topW,top,z, -w,shoulder,z);
    for (let s = 0; s < sections.length - 1; s++) for (let i = 0; i < 6; i++) {
      const a = s * 6 + i, b = s * 6 + (i + 1) % 6;
      indices.push(a,b,a+6, b,b+6,a+6);
    }
    for (let i = 1; i < 5; i++) {
      indices.push(0,i+1,i);
      const end = (sections.length-1)*6; indices.push(end,end+i,end+i+1);
    }
    VertexData.ComputeNormals(positions, indices, normals);
    const mesh = new Mesh(name, scene), data = new VertexData();
    data.positions = positions; data.uvs = new Array(positions.length / 3 * 2).fill(0); data.indices = indices; data.normals = normals; data.applyToMesh(mesh);
    mesh.material = mat; mesh.parent = car; mat.backFaceCulling = false;
    return mesh;
  };
  loft('amg-sculpted-body', [
    [-2.08,.77,.32,.65,.73,.78],[-1.78,.91,.3,.73,.82,.89],
    [-.85,.925,.3,.78,.81,.98],[.75,.925,.3,.8,.82,.97],
    [1.7,.9,.32,.79,.8,.93],[2.08,.8,.36,.73,.75,.87]], paint);
  loft('amg-window-cabin', [[-.91,.78,.88,.95,.66,1.03],[-.36,.76,.91,1.02,.62,1.39],
    [.98,.76,.91,1.04,.63,1.4],[1.64,.77,.88,.96,.64,1.09]], glass);
  box('amg-roof', [1.28,.055,1.4], [0,1.415,.34], paint);
  box('amg-panoramic-roof', [1.07,.012,.94], [0,1.448,.28], black);
  box('amg-front-grille', [1.18,.3,.04], [0,.64,-2.087], black);
  for (let i = -6; i <= 6; i++) box('amg-grille-slat', [.023,.26,.025], [i*.079,.65,-2.116], alloy);
  const emblem = CreateTorus('mercedes-star-ring', {diameter:.23, thickness:.018, tessellation:24}, scene);
  emblem.rotation.x = Math.PI/2; emblem.position.set(0,.65,-2.14); emblem.parent=car; emblem.material=alloy;
  for (let i=0; i<3; i++) {
    const angle=i*Math.PI*2/3;
    const spoke=box('mercedes-star', [.012,.11,.016], [Math.sin(angle)*.05,.65+Math.cos(angle)*.05,-2.15],alloy);
    spoke.rotation.z=-angle;
  }
  box('amg-front-splitter', [1.79,.055,.22], [0,.3,-1.98], black);
  box('amg-rear-diffuser', [1.57,.2,.12], [0,.4,2.07], black);
  for (const x of [-.5,-.25,0,.25,.5]) box('diffuser-fin', [.035,.15,.28], [x,.32,1.98], black);
  box('amg-rear-wing', [1.58,.065,.32], [0,1.48,1.52], black);
  for (const side of [-1,1]) {
    box('wing-support', [.05,.15,.14], [side*.56,1.39,1.48],black);
    box('side-skirt', [.07,.13,2.65], [side*.92,.3,0],black);
    const pillar=box('b-pillar', [.035,.38,.12], [side*.725,1.17,.38],black); pillar.rotation.z=side*.2;
    const frontPillar=box('a-pillar', [.05,.57,.055], [side*.69,1.18,-.62]); frontPillar.rotation.x=-.96;
    box('mirror-arm', [.16,.04,.07], [side*.83,1.08,-.65],black);
    box('mirror', [.19,.12,.23], [side*.94,1.12,-.65],black);
    for (const z of [-.1,.97]) box('door-handle', [.025,.035,.18], [side*.9,.84,z],alloy);
    box('front-intake', [.22,.22,.055], [side*.75,.48,-2.055],black);
    const lamp=box('headlamp-housing', [.46,.13,.075], [side*.63,.81,-1.99],black); lamp.rotation.y=side*.18;
    const strip=box('led-eyebrow', [.42,.025,.083], [side*.63,.856,-2.02],led); strip.rotation.y=side*.18;
    box('led-tip', [.028,.08,.065], [side*.82,.82,-1.99],led);
    box('rear-light', [.58,.075,.055], [side*.57,.84,2.04],brake);
    for (const offset of [-.105,.105]) {
      const pipe=CreateCylinder('amg-quad-exhaust', {height:.18,diameter:.15,tessellation:20},scene);
      pipe.rotation.x=Math.PI/2; pipe.position.set(side*.63+offset,.4,2.07); pipe.parent=car; pipe.material=alloy;
      const hole=CreateCylinder('exhaust-opening',{height:.005,diameter:.115,tessellation:20},scene);
      hole.rotation.x=Math.PI/2; hole.position.set(side*.63+offset,.4,2.163);hole.parent=car;hole.material=black;
    }
  }
  box('rear-plate', [.42,.095,.02], [0,.65,2.1], alloy);
  box('third-stop', [.42,.02,.025], [0,1.13,1.63],brake);
  const wheels: {pivot: TransformNode; tire: TransformNode; front: boolean}[]=[];
  for (const side of [-1,1]) for (const z of [-1.28,1.28]) {
    const arch=CreateCylinder('wheel-well',{diameter:.77,height:.014,tessellation:24},scene);
    arch.rotation.z=Math.PI/2;arch.position.set(side*.934,.385,z);arch.parent=car;arch.material=black;
    const pivot=new TransformNode(`wheel-${side}-${z}`,scene);pivot.parent=car;pivot.position.set(side*.87,.35,z);
    const roll=new TransformNode('wheel-roll',scene);roll.parent=pivot;
    const cylinder=(name:string,diameter:number,height:number,x:number,mat:typeof paint,parent:TransformNode) => {
      const mesh=CreateCylinder(name,{diameter,height,tessellation:24},scene);
      mesh.rotation.z=Math.PI/2;mesh.position.x=x;mesh.parent=parent;mesh.material=mat;return mesh;
    };
    cylinder('tire',.7,.24,0,rubber,roll);
    cylinder('wheel-barrel',.51,.245,0,black,roll);
    cylinder('brake-disc',.4,.012,side*.13,alloy,pivot);
    box('red-caliper',[.045,.18,.1],[side*.15,0,-.15],red,pivot);
    cylinder('hub',.12,.035,side*.15,alloy,roll);
    for(let i=0;i<10;i++) {
      const a=i*Math.PI/5;
      const spoke=box('amg-spoke',[.028,.2,.026],[side*.152,Math.cos(a)*.15,Math.sin(a)*.15],alloy,roll);
      spoke.rotation.x=a;
    }
    const rim=CreateTorus('rim-lip',{diameter:.5,thickness:.025,tessellation:24},scene);
    rim.rotation.z=Math.PI/2;rim.position.x=side*.15;rim.parent=roll;rim.material=alloy;
    wheels.push({pivot,tire:roll,front:z<0});
  }
  // Batch rigid body details by material; wheels retain independent steering/rolling.
  for (const surface of [paint, glass, black, rubber, alloy, red, led, brake]) {
    const parts = car.getChildMeshes(true).filter(mesh => mesh.material === surface) as Mesh[];
    if (parts.length < 2) continue;
    const merged = Mesh.MergeMeshes(parts, true, true);
    if (merged) { merged.name = `amg-body-${surface.name}`; merged.parent = car; }
  }
  return {car,brake,wheels};
}
