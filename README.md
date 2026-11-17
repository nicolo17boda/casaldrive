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
| C | Chase, close, overhead, city overview |
| Esc | Pause / resume |

Choose **Esplora dall’alto** in the opening menu to inspect the city: left-drag
rotates, the wheel zooms and right-drag pans. **Torna alla guida** returns to the
car; **Vista città** opens the overview again. Vehicle simulation freezes in the
overview and resumes at its previous position when returning to driving.

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
Mazzini: south/west/north/east `45.134, 8.446, 45.141, 8.457`.
It tries the OSM map API first, with Overpass fallbacks, saves a geographic GeoJSON intermediate,
then writes metric geometry and provenance to `public/data/`.
The game never contacts Overpass while playing. Failed downloads exit nonzero
and preserve the existing city file. With no valid local city file, the application
uses an explicitly labeled **Circuito di prova**, not fictional Casale geography.

One world unit is one metre. Coordinates use a local equirectangular projection
centred at longitude 8.4524, latitude 45.1372, with X east, Y up and Z south.
This is appropriate for the small initial area; use a projected CRS such as UTM
32N before expanding significantly. Street widths prefer `width:carriageway`, then `width`, then lane-based
estimates, then defaults by road class and one-way tags. Explicit metric and
feet measurements are parsed; access restrictions do not change physical width.
Each road records `widthSource` so estimates remain distinguishable from measurements.
Run `npm run osm:widths` to reprocess the bundled GeoJSON without a new download. Building heights use `height`, then `building:levels × 3.1 m`, then
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
- `src/game/physics.ts`: pure arcade physics at 120 Hz.
- `src/game/collision.ts`: oriented 2.1 × 4.2 m vehicle footprint, courtyard-aware
  polygon contacts, bounded movement increments and axis-separated wall sliding.
  Cached building bounds reject distant geometry; the circular helper is retained
  only for conservative spawn clearance checks.
- `src/game/input.ts`: keyboard state and focus-loss handling.
- `src/geo/`: coordinate conversion, typed city model, loader and labeled test circuit.
- `src/world/CityWorld.tsx`: area surfaces, merged roads and building batches.
- `src/world/geometry.ts`: extruded footprints with courtyard holes, roof/wall colors
  and static 200 m spatial batches for frustum culling.
- `scripts/osm/`: reproducible download, conversion, spawn selection and provenance.
- `tests/`: movement, steering, braking, collisions, projection and OSM tests.

Physics and camera mutate refs outside React state; HUD updates are throttled.
The ground is flat, so gravity and Rapier are unnecessary for this milestone.
Opaque coplanar road segments and round joins avoid gaps and flickering; full
intersection polygon unions and lane markings remain future work.

## Scope and limitations

This is a prototype, not the full city or a complete GTA simulation. No traffic,
pedestrians, audio, missions, gamepad or touch driving. Collision uses an oriented rectangle including wheel clearance. Translation and
rotation are subdivided into increments of at most 0.2 m of combined travel at
the outer corner. Sliding is an arcade approximation, not a rigid-body solver. Camera does not avoid building
walls. Terrain is flat and there is no jumping, suspension, bridge or tunnel support.
Assembled OSM multipolygons retain courtyard holes; incomplete relations are
skipped. Buildings have simple flat roofs with illustrative terracotta colors
and no detailed façades. Colors do not represent surveyed materials.

Three.js frustum culling is active, but the initial district is loaded as a single
local file. Chunk streaming, LOD and instanced vegetation are not implemented.
There is no hardware-wide 60 FPS guarantee. The production bundle currently has a
Vite size advisory for the 3D dependencies; it builds successfully.

Next: improve intersection polygons, extend static batches into chunk streaming
and implement a spatial collision index, then add terrain, vegetation,
landmarks and broader city coverage.

## City rendering verification

- The bundled real dataset contains 530 buildings, 406 road segments and 39 areas.
  Source and licensing are recorded in `public/data/provenance.json`.
- Production build and 28 automated tests pass, including raycasting checks for
  open courtyards, roof elevation and finite bounds of the real city batches.
  Collision tests cover narrow alleys, rotation near walls, frontal/reverse
  contact, sliding, thin obstacles and whole-vehicle world bounds. Road tests
  verify units, class/lanes/one-way estimates and consistency with bundled tags.
- Chrome loaded the initial menu with the city overview rendered behind it.
  Full orbit/zoom and overview-to-driving interaction checks remain outstanding:
  the UI automation session was interrupted before those checks completed.
- Buildings use static spatial batches, not streaming. Full-city coverage, FPS
  benchmarking, detailed landmarks and camera collision remain outstanding.
- Vite still reports the existing large-bundle advisory for the 3D dependencies.

## Fluidity update

Rendering interpolates between 120 Hz physics ticks (at most 8.3 ms of visual
latency), including heading. The camera damps both position and look target.
The minimap rasterizes geography once per city into a bitmap capped at 2048 px,
then copies only the visible region at 10 Hz. Unchanged HUD values do not rerender.
City geometry is memoized across menu changes. Pausing switches the 3D canvas to
on-demand rendering and stops HUD polling. No comparative FPS claim has been
measured yet; the changes were checked with automated tests and a Chrome smoke test.
