import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Logger } from '@babylonjs/core/Misc/logger';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { createGameScene } from '../src/game/babylonScene';
import { createVehicle } from '../src/game/physics';
import type { City } from '../src/geo/types';

Logger.LogLevels = Logger.NoneLogLevel;
const source = readFileSync('public/data/city.json', 'utf8');
const city: City = JSON.parse(source);
const engine = new NullEngine();
const game = createGameScene(engine, { city, vehicle: createVehicle(city.spawn),
  paused: true, cameraMode: 3, cameraDistance: 11, engineVolume: 0 });
try {
  const meshes = game.scene.meshes.filter((mesh): mesh is Mesh => mesh instanceof Mesh
    && /^(ground|area-|areas-|roads|paths|buildings-)/.test(mesh.name));
  let vertices = 0, triangles = 0, bufferBytes = 0;
  for (const mesh of meshes) {
    vertices += mesh.getTotalVertices();
    triangles += mesh.getTotalIndices() / 3;
    for (const kind of mesh.getVerticesDataKinds()) {
      bufferBytes += mesh.getVerticesData(kind)!.length * 4;
    }
    const indices = mesh.getIndices()!;
    bufferBytes += indices.length * (indices instanceof Uint16Array ? 2 : 4);
  }
  console.log(JSON.stringify({
    datasetSha256: createHash('sha256').update(source).digest('hex'),
    staticCity: { meshes: meshes.length, vertices, triangles, bufferBytes },
    limitations: 'Geometry buffer sizes and mesh counts only. No GPU, frame-time, actual draw-call or FPS measurement.',
  }, null, 2));
} finally { game.dispose(); engine.dispose(); }
