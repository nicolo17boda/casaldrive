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
Both the 3D surfaces and the minimap use these same widths. In this dataset only
Via Duomo has an explicit width (4 m); all other widths are estimated.
