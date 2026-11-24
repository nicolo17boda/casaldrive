import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { Scene } from '@babylonjs/core/scene';

/** Periodic, deterministic aggregate grain. No downloads or canvas dependency. */
export function asphaltPixels(size = 256) {
  const diffuse = new Uint8Array(size * size * 4);
  const normal = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  let seed = 173;
  for (let i = 0; i < height.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    height[i] = seed / 4294967296;
  }
  const at = (x: number, y: number) => height[((y + size) % size) * size + (x + size) % size];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const offset = (y * size + x) * 4;
    const grain = at(x, y);
    const mottling = Math.sin(x / size * Math.PI * 8) * Math.cos(y / size * Math.PI * 6);
    const value = Math.round(150 + grain * 36 + mottling * 5);
    diffuse.set([value, value + 1, value + 2, 255], offset);
    const nx = (at(x - 1, y) - at(x + 1, y)) * 0.16;
    const ny = (at(x, y - 1) - at(x, y + 1)) * 0.16;
    const length = Math.hypot(nx, ny, 1);
    normal.set([Math.round(127.5 + nx / length * 127.5),
      Math.round(127.5 + ny / length * 127.5), Math.round(127.5 + 127.5 / length), 255], offset);
  }
  return { diffuse, normal };
}

export function asphaltTextures(scene: Scene) {
  const pixels = asphaltPixels();
  const diffuse = RawTexture.CreateRGBATexture(pixels.diffuse, 256, 256, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  const normal = RawTexture.CreateRGBATexture(pixels.normal, 256, 256, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  diffuse.name = 'asphalt-grain';
  normal.name = 'asphalt-normal';
  normal.gammaSpace = false;
  for (const texture of [diffuse, normal]) {
    texture.wrapU = texture.wrapV = Texture.WRAP_ADDRESSMODE;
    texture.anisotropicFilteringLevel = 4;
  }
  return { diffuse, normal };
}
