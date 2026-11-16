# CasalDrive

A local, lightweight arcade driving prototype built with Vite, React, TypeScript,
Three.js, React Three Fiber and drei. Application code retains the existing GPL-3.0
license in `LICENSE`.

## Run on macOS

Install Node.js 22 LTS (or a newer supported LTS) and npm, then:

```sh
npm install
npm run dev
```

Open **http://localhost:5173**. A desktop keyboard and a WebGL2-capable browser are
required. No account, backend, API key or database is needed. Dependencies need
network access at install time; gameplay uses only local assets.

```sh
npm test          # physics and OSM conversion regression tests
npm run build    # strict TypeScript check + production bundle in dist/
npm run preview  # serve the production build
```

During initial development Node was not on the terminal PATH. A temporary runtime
was used at `/tmp/node-v22.16.0-darwin-arm64/bin`; installing Node normally is
recommended. For the current session only, that runtime can be used with:

```sh
export PATH=/tmp/node-v22.16.0-darwin-arm64/bin:$PATH
```

## Controls

| Key | Action |
| --- | --- |
| W / ↑ | Accelerate |
| S / ↓ | Brake, then reverse |
| A D / ← → | Steer |
| Space | Handbrake / reduced lateral grip |
| R | Reset at the initial spawn |
| C | Chase, close, overhead camera |
| Esc | Pause / resume |

The menu controls camera distance and maximum forward speed (40–140 km/h).
Losing window focus clears held keys and pauses the game. The HUD shows speed,
gear, traveled distance, contact status, camera mode and a north-up minimap.

## Real geographical data

```sh
npm run osm:fetch
# Or convert a previously downloaded Overpass JSON response:
npm run osm:fetch -- /absolute/path/to/overpass.json
```

The preprocessing query covers the centre around Piazza Castello and Piazza
Mazzini: south/west/north/east `45.1318, 8.4435, 45.1430, 8.4625`.
It downloads OSM ways through Overpass, saves a geographic GeoJSON intermediate,
then writes metric geometry and provenance to `public/data/`.
The game never contacts Overpass while playing. Failed downloads exit nonzero
and preserve the existing city file. With no valid local city file, the application
uses an explicitly labeled **Circuito di prova**, not fictional Casale geography.

One world unit is one metre. Coordinates use a local equirectangular projection
centred at longitude 8.4524, latitude 45.1372, with X east, Y up and Z south.
This is appropriate for the small initial area; use a projected CRS such as UTM
32N before expanding significantly. Street widths come from `width`, then `lanes`,
then defaults. Building heights use `height`, then `building:levels × 3.1 m`, then
9.3 m. Heights are conservative visual estimates when OSM has no measurement.
The spawn is selected from an actual accessible road segment, clear of buildings.
Pedestrian/private roads use a distinct surface; access classification does not
yet enforce traffic rules or prohibit the player from driving over that surface.

OSM-derived data is **© OpenStreetMap contributors**, under **ODbL 1.0**.
Attribution appears in the HUD when real data is loaded. See
[OpenStreetMap copyright](https://www.openstreetmap.org/copyright) and
[`public/data/README.md`](public/data/README.md). No proprietary map assets are used.

## Architecture

- `src/components/GameCanvas.tsx`: renderer, car, fixed-step simulation and damped camera.
- `src/components/HUD.tsx`: UI and canvas minimap, sampled at 10 Hz.
- `src/game/physics.ts`: pure arcade physics at 120 Hz, conservative circular car
  collision against building polygons; cached bounding boxes reject distant buildings.
- `src/game/input.ts`: keyboard state and focus-loss handling.
- `src/geo/`: coordinate conversion, typed city model, loader and labeled test circuit.
- `src/world/CityWorld.tsx`: extruded building footprints and merged road geometry.
- `scripts/osm/`: reproducible download, conversion, spawn selection and provenance.
- `tests/`: movement, steering, braking, collisions, projection and OSM tests.

Physics and camera mutate refs outside React state; HUD updates are throttled.
The ground is flat, so gravity and Rapier are unnecessary for this milestone.
Opaque coplanar road segments and round joins avoid gaps and flickering; full
intersection polygon unions and lane markings remain future work.

## Scope and limitations

This is a prototype, not the full city or a complete GTA simulation. No traffic,
pedestrians, audio, missions, gamepad or touch driving. Collision uses a conservative
2.25 m circle, so tight gaps can be inaccessible. Camera does not avoid building
walls. Terrain is flat and there is no jumping, suspension, bridge or tunnel support.
OSM multipolygon relations and courtyard holes are not supported yet; missing
features are not invented. Buildings have simple flat roofs and no detailed façades.

Three.js frustum culling is active, but the initial district is loaded as a single
local file. Chunk streaming, LOD and instanced vegetation are not implemented.
There is no hardware-wide 60 FPS guarantee. The production bundle currently has a
Vite size advisory for the 3D dependencies; it builds successfully.

Next: improve intersection polygons and multipolygons, implement 200 × 200 m
chunk streaming and a spatial collision index, then add terrain, vegetation,
landmarks and broader city coverage.

## Verification for this delivery

- Production build and fourteen automated regression tests pass.
- Chrome manual smoke test: rendered 3D scene, forward acceleration, reverse,
  camera switching, reset and pause verified using actual keyboard input.
- OSM retrieval was attempted against two endpoints (HTTP 406 and 429), plus a
  third mirror (90-second timeout). No real city dataset is bundled in this
  delivery. Converter tests use synthetic fixtures explicitly confined to tests.
- Full-city geography, FPS benchmarking and detailed collision/camera QA remain
  outstanding; Milestone 2 is prepared but not complete.

## Fluidity update

Rendering interpolates between 120 Hz physics ticks (at most 8.3 ms of visual
latency), including heading. The camera damps both position and look target.
The minimap rasterizes geography once per city into a bitmap capped at 2048 px,
then copies only the visible region at 10 Hz. Unchanged HUD values do not rerender.
City geometry is memoized across menu changes. Pausing switches the 3D canvas to
on-demand rendering and stops HUD polling. No comparative FPS claim has been
measured yet; the changes were checked with automated tests and a Chrome smoke test.
