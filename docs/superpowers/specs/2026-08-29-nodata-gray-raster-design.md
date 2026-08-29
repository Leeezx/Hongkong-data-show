# No-Data Gray Raster Design

## Objective

Make pixels without displayed sample data visibly gray so the classified Water Surface Temperature and Chlorophyll-a pixels stand out, while preserving the platform's simple static architecture and existing map behavior.

## Approved Visual Treatment

- Use the reference repository's default no-data color: `#e8e8e8`.
- Use 50% per-pixel alpha: RGBA `(232, 232, 232, 128)`.
- Apply this treatment to class `0`, which is the class currently rendered fully transparent in both generated PNG overlays.
- Class `0` includes source no-data pixels and values outside the approved displayed class ranges; the underlying scientific source TIFF files are not modified.
- Keep every real data class color and legend range unchanged.
- Do not add a gray no-data item to the legend because gray represents absence of displayed sample data, not a numeric class.

## Asset Pipeline

The static asset pipeline remains the single source of truth:

1. Change the class-`0` row in both color-relief tables in `scripts/prepare-data.ps1` from transparent black to `0 232 232 232 128`.
2. Regenerate `assets/wst.png` and `assets/chla.png` from the untouched TIFF sources under `相关数据/`.
3. Do not modify `assets/metadata.js`, vector assets, source-data hashes, layer bounds, or classification thresholds.

The existing Leaflet image-overlay opacity remains in effect. At the default 75% overlay opacity, the half-alpha gray pixels appear softly over the basemap, consistent with the reference repository's approach.

## Runtime Behavior

- No JavaScript or HTML behavior changes are required.
- Opacity continues to affect the entire active raster overlay, including gray no-data pixels.
- Selecting a variable with no dataset still removes the entire raster and shows `No sample data available`; it must not display a gray placeholder raster.
- Navigation, timeline, Spatial Query presentation, legends, raster error handling, vector overlays, and automatic `fitBounds` remain unchanged.

## Test Strategy

Follow red-green-refactor:

1. Add an asset-level regression test before changing the pipeline or PNG files.
2. Verify that both generated PNGs contain RGBA `(232, 232, 232, 128)` pixels and no class-`0` pixels remain fully transparent.
3. Verify that the generation script declares `0 232 232 232 128` in both color tables.
4. Run the focused asset test and observe failure against the current transparent assets.
5. Update the color tables, regenerate only the two PNG files, and rerun the focused and full suites.
6. Confirm source TIFF SHA-256 integrity still passes.

## Acceptance Criteria

- Transparent class-`0` regions in both `wst.png` and `chla.png` become semi-transparent `#e8e8e8` gray.
- Both PNGs retain their current dimensions and RGBA color type.
- Data-class colors, units, breaks, labels, geographic bounds, and overlay opacity behavior remain unchanged.
- The legend contains only real numeric data classes.
- Variables without a dataset continue to show no raster rather than a gray raster.
- Files in `相关数据/` remain byte-for-byte unchanged.
- The full automated test suite, JavaScript syntax check, and `git diff --check` pass.
