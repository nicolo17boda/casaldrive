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
