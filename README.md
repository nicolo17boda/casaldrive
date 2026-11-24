# CasalDrive

A local arcade driving prototype built with Vite, React, TypeScript and Babylon.js.
Three.js is used only for polygon geometry preparation, not rendering.
Application code retains the existing GPL-3.0
license in `LICENSE`.

Development priorities and acceptance criteria are tracked in [ROADMAP.md](ROADMAP.md).

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
npm run benchmark # repeatable CPU simulation and camera collision measurements
npm run build    # strict TypeScript check + production bundle in dist/
npm run preview  # serve the production build
```

During initial development Node was not on the terminal PATH. A temporary runtime
was used at `/tmp/node-v22.16.0-darwin-arm64/bin`; installing Node normally is
recommended. For the current session only, that runtime can be used with:

```sh
export PATH=/tmp/node-v22.16.0-darwin-arm64/bin:$PATH
```

## Anteprima con Go Live (VS Code)

Apri la cartella `casaldrive` in VS Code e installa l'estensione **Live Server**
di Ritwick Dey, consigliata dal workspace. Dal terminale esegui:

```sh
npm install       # solo al primo avvio
npm run build
```

Premi **Go Live** nella barra di stato e apri **http://127.0.0.1:5500/**.
La configurazione `.vscode/settings.json` serve direttamente `dist/`.
L'`index.html` nella radice è l'ingresso di Vite: Live Server non compila TSX.
Usa il pulsante Go Live e l'URL sopra per aprire la versione compilata.

Per ricompilare automaticamente durante le modifiche, lascia in esecuzione
`npm run build:watch` mentre Go Live è attivo. In alternativa, `npm run dev`
offre il server di sviluppo Vite su **http://localhost:5173**.

## Motore 3D: Babylon.js

Il rendering usa **Babylon.js 9.37.2**. È una scelta progettuale per evolvere un
gioco 3D nel browser: offre scene, camere e un ecosistema per fisica, animazioni
e risorse 3D. Non implica un miglioramento FPS misurato.

| Opzione | Valutazione per CasalDrive |
| --- | --- |
| [Babylon.js](https://www.babylonjs.com/specifications/) | Scelto come motore di gioco 3D, con camere e gestione della scena integrate. |
| [Three.js + Rapier](https://threejs.org/manual/pages/physics.html) | Alternativa valida e flessibile; richiede comporre i sistemi del gioco. Rapier è un motore fisico, non un renderer. |
| [Phaser](https://phaser.io/oss/docs/phaser/getting-started/what-is-phaser) | Orientato al 2D; non adatto come base principale di questa città 3D. |

Babylon gestisce effettivamente rendering WebGL, materiali, luci, nebbia, auto,
camere di guida e camera orbitale. React gestisce menu e HUD. La triangolazione
OSM già verificata usa ancora le utility geometriche di Three.js: i buffer vengono
copiati una volta in mesh Babylon, conservando cortili, colori e scala metrica.
React Three Fiber e drei sono stati rimossi.

La fisica arcade a 120 Hz e le collisioni esistenti restano attive. Havok, WebGPU,
sospensioni e rigid body non sono abilitati da questa migrazione. Non sono
richiesti CDN o servizi esterni durante il gioco; la build funziona con Go Live.

Verifica della migrazione: 41 test automatici, inclusi due test Babylon con
NullEngine su geometrie, guida, pausa, reset, camere e rilascio della scena.
La verifica visiva e delle prestazioni GPU resta da eseguire: il collegamento
al browser non era disponibile nella sessione di migrazione.

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

- `src/components/GameCanvas.tsx`: Babylon engine lifecycle, resizing, render loop and audio.
- `src/game/babylonScene.ts`: car, fixed-step simulation, driving and overview cameras.
- `src/components/HUD.tsx`: UI and canvas minimap, sampled at 10 Hz.
- `src/game/physics.ts`: pure arcade physics at 120 Hz.
- `src/game/collision.ts`: oriented 2.1 × 4.2 m vehicle footprint, courtyard-aware
  polygon contacts, bounded movement increments and axis-separated wall sliding.
  A cached 32 m spatial grid selects buildings along the complete movement sweep;
  shared building bounds reject distant geometry. The circular helper is retained
  only for conservative spawn clearance checks.
- `src/game/input.ts`: keyboard state and focus-loss handling.
- `src/game/engineModel.ts` and `engineAudio.ts`: procedural inline-four engine
  audio with five simulated automatic gears, launch clutch slip, reverse,
  combustion harmonics and intake noise. The menu controls engine volume (zero
  mutes it). Audio starts after a keyboard/pointer gesture and fades out during
  pause, city overview and focus loss. No external audio assets are required.
- `src/geo/`: coordinate conversion, typed city model, loader and labeled test circuit.
- `src/world/babylonWorld.ts`: Babylon meshes, materials and geometry buffer conversion.
- `src/world/roadsGeometry.ts`: merged road surfaces and joins.
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
pedestrians, missions, gamepad or touch driving. Engine audio is synthesized, not
a recording of a specific car; its transmission does not change driving physics.
Collision uses an oriented rectangle including wheel clearance. Translation and
rotation are subdivided into increments of at most 0.2 m of combined travel at
the outer corner. Sliding is an arcade approximation, not a rigid-body solver.
Driving cameras retract before building walls and roofs, using conservative clearance
sampled every 0.2 m. City overview remains freely orbitable. Terrain is flat and
there is no jumping, suspension, bridge or tunnel support.
Assembled OSM multipolygons retain courtyard holes; incomplete relations are
skipped. Buildings have simple flat roofs with illustrative terracotta colors
and no detailed façades. Colors do not represent surveyed materials.

Babylon.js frustum culling is active, but the initial district is loaded as a single
local file. Chunk streaming, LOD and instanced vegetation are not implemented.
There is no hardware-wide 60 FPS guarantee. The production bundle currently has a
Vite size advisory for the 3D dependencies; it builds successfully.

Next: measure browser frame times and visually verify camera retraction,
improve intersection polygons, then extend static batches into chunk streaming.
Terrain, vegetation, landmarks and broader city coverage follow those foundations.
See [ROADMAP.md](ROADMAP.md) for the ordered development blocks.

## City rendering verification

- The bundled real dataset contains 530 buildings, 406 road segments and 39 areas.
  Source and licensing are recorded in `public/data/provenance.json`.
- Production build and 35 automated tests pass, including raycasting checks for
  open courtyards, roof elevation and finite bounds of the real city batches.
  Collision tests cover narrow alleys, rotation near walls, frontal/reverse
  contact, sliding, thin obstacles and whole-vehicle world bounds. Road tests
  verify units, class/lanes/one-way estimates and consistency with bundled tags.
- Chrome loaded the initial menu with the city overview rendered behind it.
  Full orbit/zoom and overview-to-driving interaction checks remain outstanding:
  the UI automation session was interrupted before those checks completed.
- Buildings use static spatial batches, not streaming. Full-city coverage, FPS
  benchmarking, detailed landmarks and visual camera verification remain outstanding.
- Vite still reports the existing large-bundle advisory for the 3D dependencies.

## Fluidity update

Rendering interpolates between 120 Hz physics ticks (at most 8.3 ms of visual
latency), including heading. The camera damps both position and look target.
The minimap rasterizes geography once per city into a bitmap capped at 2048 px,
then copies only the visible region at 10 Hz. Unchanged HUD values do not rerender.
City geometry is memoized across menu changes. Pausing switches the 3D canvas to
on-demand rendering and stops HUD polling. No comparative FPS claim has been
measured yet; the changes were checked with automated tests and a Chrome smoke test.

## Repeatable CPU benchmark

`npm run benchmark` runs a 60-second input replay five times after warm-up and
checks identical final states. It reports physics and camera-query timings, CPU,
Node version and a dataset hash. A separate probe checks every road vertex in
four camera directions. The stored [measurement](docs/benchmarks/2026-11-17.json)
includes 36,000 simulation ticks and 7,012 road camera probes (2,206 retractions).
This measures CPU work only, not rendering or FPS; timer overhead is included.
The latest browser opening reported WebGL unavailable, so visual checks remain pending.
