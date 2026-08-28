# Hong Kong Remote Sensing Water Quality Monitoring Demonstration System — Design

## 1. Purpose

Build a lightweight, local-only demonstration platform that visually follows the existing `remote-sensing-data-shows` repository while avoiding its production backend and deployment complexity. The platform presents two real sample rasters, keeps the full requested variable catalog visible, and exposes two additional navigation entries as non-functional demonstrations.

The finished platform must open by double-clicking `index.html`. It must not require Node.js, Python, a database, a web server, or an installation step at runtime.

## 2. Scope

### Included

- A single static page with the title `Hong Kong Remote Sensing Water Quality Monitoring Demonstration System`.
- Four top-level navigation entries:
  1. `Water Environment Data`
  2. `Historical Water Quality`
  3. `Water Quality Forecasts`
  4. `Risk Alerts & Recommended Actions`
- Functional map views for the first two entries.
- Variable selection, raster opacity control, a single-step timeline, map zooming and panning, vector overlays, and legends.
- A clear empty-data state for variables without sample rasters.
- Placeholder views for the third and fourth entries.
- Responsive behavior based on the reference repository.

### Excluded

- Backend APIs, databases, authentication, uploads, persistence, deployment configuration, raster tile services, spatial querying, animation, forecast calculations, risk analysis, and production monitoring.
- Fabricated values, fabricated acquisition dates, or generated time series.

## 3. Technical Approach

Use a static HTML/CSS/JavaScript application with a vendored local copy of Leaflet. The runtime page performs no package loading or data conversion.

The source GeoTIFF and Shapefile files are processed once during development:

- `wst.tif` becomes a transparent, classified PNG in WGS84.
- `Chla.tif` is reprojected from EPSG:32650 to WGS84 and becomes a transparent, classified PNG.
- The administrative-area and water Shapefiles become simplified JavaScript data objects containing GeoJSON-compatible features.
- Raster bounds, legends, labels, and configuration become a small local JavaScript metadata object.

All runtime assets are loaded with ordinary local `<script>`, stylesheet, and image references so the application works under `file://` when `index.html` is double-clicked. An online basemap is attempted when network access exists; a neutral grey map background remains usable when it does not.

## 4. File Structure

```text
index.html
styles.css
app.js
assets/
  leaflet/
  wst.png
  chla.png
  map-data.js
  metadata.js
README.md
```

Development-only conversion scripts may be kept under `scripts/`, but they are not required to open or use the finished demonstration.

## 5. Visual Design

The interface follows the reference repository's visual language:

- A dark `#1a1a2e` header.
- White title and navigation text.
- A light `#f5f7fa` control sidebar.
- Blue `#1a73e8` as the primary interactive color.
- A pale-blue `#d0e0ff` active-variable row.
- A full-height map with a floating white legend at the lower right.
- Desktop layout places the sidebar to the left of the map; screens below 1024 px use a stacked layout.

Typography is intentionally larger than the reference repository:

- Header height: 58 px.
- System title: 20 px, semibold.
- Navigation: 15 px.
- Sidebar width: 320 px.
- Sidebar section headings: 16 px.
- Variable names: 14 px.
- Units and secondary copy: 12–13 px.
- Current timeline label: 17 px, bold.
- Legend text: 14 px.
- Placeholder-page heading: 24 px.

## 6. Navigation and View State

The page uses JavaScript state rather than URL routing. Selecting a navigation item swaps the central view without reloading the document. This avoids local-file routing failures.

- `Water Environment Data` and `Historical Water Quality` render the shared sidebar-and-map shell.
- `Water Quality Forecasts` and `Risk Alerts & Recommended Actions` preserve the header and render a centered demonstration placeholder.
- Returning to either functional section restores that section's default real-data variable.

## 7. Water Environment Data

The sidebar lists these variables exactly:

- `Water Extent / Water Level / Storage`
- `Water Surface Temperature`
- `Chlorophyll Index`
- `Turbidity Index`
- `SAR Polarimetric Index`
- `Precipitation`
- `Air Temperature`
- `Downwelling Radiation`

`Water Surface Temperature` is selected by default and is the only variable with real sample data. Its unit is `°C`, and its legend uses the supplied classes:

- 15–20
- 20–25
- 25–30
- 30–35
- 35–40

Values outside the meaningful displayed classes and invalid pixels are transparent. Units not explicitly supplied in the reference material are not invented.

## 8. Historical Water Quality

The sidebar lists these variables exactly:

- `Chlorophyll-a`
- `Turbidity`
- `Total Suspended Solids`
- `Total Phosphorus`
- `Total Nitrogen`

`Chlorophyll-a` is selected by default and is the only variable with real sample data. Its unit is `mg/m³`, and its legend uses the supplied classes:

- 0–1.5
- 1.5–3
- 3–4.5
- 4.5–6
- >6

Invalid pixels are transparent. The reference-material units `NTU` for Turbidity and `mg/L` for Total Suspended Solids may be shown in their inactive rows; units not supplied for other inactive variables are omitted.

## 9. Map Layers and Initial Extent

The layer order is:

1. Optional online street basemap.
2. Active classified raster image.
3. Administrative-area outlines.
4. Water-feature outlines.
5. Leaflet controls and floating legend.

Entering either functional section calls `fitBounds` with the Hong Kong vector extent, approximately 113.81724–114.50249E and 22.13672–22.56833N. The map permits panning and zooming after the initial fit.

The opacity slider changes only the active raster. Administrative and water vectors remain visible and use stable line opacity.

## 10. Timeline and Unsupported Features

The timeline retains the reference repository's appearance but represents exactly one sample:

- The displayed label is `Single time step`.
- The progress line contains one fixed point.
- Previous, next, and play controls are visible but disabled.
- No acquisition date is inferred from file timestamps.

The spatial-query section remains in the sidebar as a visually disabled informational block. Map click statistics and rectangle selection are not implemented.

## 11. Empty-Data Behavior

Selecting a variable without real data must:

1. Remove the current raster immediately.
2. Preserve the basemap and vector overlays.
3. Hide the previous variable's legend.
4. Show `No sample data available` in a centered, non-blocking map notice.
5. Keep the chosen variable highlighted so the state is unambiguous.

Selecting the real-data variable again restores its raster, legend, opacity, and single-step timeline state.

## 12. Placeholder Views

The third and fourth entries contain no controls or simulated results. Each displays its navigation title and the message `Demonstration module — no functionality implemented` in the same neutral background and typographic system as the functional views.

## 13. Error Handling

- If a local raster asset fails to load, the map remains usable and shows `Sample layer could not be loaded`.
- If the online basemap is unavailable, no blocking dialog appears; the neutral map background and all local overlays remain visible.
- If vector data is unavailable, the application falls back to the known Hong Kong raster bounds and shows a subtle warning.
- Errors in one section do not prevent navigation to the other sections.

## 14. Accessibility and Responsive Behavior

- Navigation and variable selection use semantic buttons or form controls with visible focus states.
- Disabled timeline controls use native disabled states and accessible labels.
- Status notices use an `aria-live` region.
- Legend colors include text ranges so color is not the only information carrier.
- Below 1024 px, the sidebar moves above the map and uses flexible section wrapping.
- At narrow phone widths, the header navigation scrolls horizontally instead of shrinking text to unreadable sizes.

## 15. Validation

Validation remains proportional to a demonstration project:

- Confirm all required files exist and local paths resolve.
- Confirm the title, four navigation labels, and all variable names match the approved copy.
- Confirm the two default variables render their correct raster and legend.
- Confirm every inactive variable removes the previous raster and shows the empty-data notice.
- Confirm both functional entries fit to the Hong Kong vector extent.
- Confirm raster opacity changes do not affect vectors.
- Confirm the single-step timeline controls remain disabled.
- Confirm the third and fourth views remain placeholders.
- Confirm the page loads without a backend under `file://`.
- Confirm source GeoTIFF and Shapefile files remain unchanged.

## 16. Acceptance Criteria

The design is complete when a user can double-click `index.html`, recognize the visual structure of the reference repository, navigate among all four requested entries, view the two real Hong Kong sample datasets in their correct sections, select every requested variable, see an honest empty state for unsupported variables, and use the demonstration without installing or starting any service.
