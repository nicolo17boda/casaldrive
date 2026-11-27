# Geographic data

Run `npm run osm:fetch` from the repository root. The tool produces:

- `city.json`: metric geometry used by the game, with a verified clear road spawn.
- `source.geojson`: OSM ways in geographic WGS84 longitude/latitude coordinates.
- `provenance.json`: query, bounds, download time, source endpoint and attribution.

These files are deliberately local and should be committed together when regenerated.
They contain OpenStreetMap-derived data, © OpenStreetMap contributors, licensed under
[Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
See [OSM copyright and attribution](https://www.openstreetmap.org/copyright).
The repository's GPL license applies to application code, not to the OSM database.

If `city.json` is absent or invalid, the game explicitly labels its temporary test
circuit; that circuit is not a reconstruction of Casale Monferrato.

## Recompute road widths locally

Run `npm run osm:widths` to apply the current width policy to the bundled
`source.geojson`. This updates only road dimensions and their `highway` and
`widthSource` metadata in `city.json`; the original download provenance remains
unchanged. The same policy is used by future `osm:fetch` conversions.

Width precedence is `width:carriageway`, `width`, lane-based estimates, then
road-class/one-way defaults. These estimates are illustrative carriageway widths,
not surveyed curb positions, and exclude inferred sidewalks/parking lanes.
Both the 3D surfaces and the minimap use these same widths. Via Duomo retains its explicit width (4 m); `widthSource` identifies measured
versus estimated widths for every road in the expanded dataset.

## Expanded region

Default bounds: south 45.130, west 8.440, north 45.145, east 8.464.
The 24 November update contains 1,679 buildings, 1,205 road segments and
136 areas. Source URL, download timestamp and counts are in `provenance.json`.
Use `OSM_BBOX="south,west,north,east" npm run osm:fetch` for a different region.
The source includes complete ways beyond the playable bounds; incomplete
multipolygon relations are skipped rather than inventing missing geometry.


## Bridge connectivity and place names

The bundled source already contained nine bridge segments that the old converter
excluded. These are now included (five drivable, four pedestrian/cycle segments),
for 1,214 roads in total. Run `node --import tsx scripts/osm/bridges.ts` to repeat
this repair from the bundled source without a new download. `provenance.json`
records the processing separately from the original download date.
Bridge carriageways follow the source coordinates and remain at the game's flat
road elevation; concrete shoulders distinguish them from water. Underground
tunnels are still excluded. No speculative links across water were created.
Street and square names come from the same OSM data; unnamed road classes are
not displayed as place names. Labels appear in the 3D view, minimap and driving HUD.
