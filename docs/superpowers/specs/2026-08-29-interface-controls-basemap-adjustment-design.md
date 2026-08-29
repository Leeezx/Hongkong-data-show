# Interface Controls and Basemap Adjustment Design

## Objective

Refine the existing static Hong Kong water-quality demonstration interface without adding production functionality or increasing runtime complexity.

## Approved Changes

### Timeline

- Replace every visible `Single time step` label with the fixed date `2016-01-01`.
- Keep the previous, next, and play controls visually enabled.
- Remove their HTML `disabled` state and disabled styling.
- The three controls intentionally perform no action: clicking them must not change the date, selected layer, raster, section, or play state.
- Retain the existing timeline rail and thumb as static presentation elements.

### Spatial Query

- Present Spatial Query as an available section rather than a disabled section.
- Remove `is-disabled` styling and `aria-disabled` metadata.
- Show the reference-interface guidance: `Click the map to query pixel values; hold Shift and drag to select an area.`
- Do not add map click, drag-selection, result-card, or backend query behavior.

### Layer Information

- Remove the complete Layer Information sidebar section.
- Remove the corresponding `layer-description` DOM lookup and all render-time description updates.
- Do not replace it with another panel.

### Basemap and Vector Overlays

- Keep the ArcGIS World Street Map tile endpoint already used by the project because it exactly matches the reference repository:
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}`.
- Do not introduce additional street, road, label, or other basemap vector layers.
- Preserve the existing local administrative and water overlays. They define the supplied sample-data region and remain necessary for the previously approved automatic `fitBounds` behavior.
- Preserve the current offline fallback: if online tiles are unavailable, local raster/vector overlays remain visible on the neutral map background.

## Implementation Approach

Use the smallest static-page change:

1. Update the sidebar markup in `index.html`.
2. Remove obsolete disabled-state styling and add ordinary pointer/hover/active feedback for the timeline buttons in `styles.css`.
3. Remove obsolete Layer Information references and set the fixed timeline date in `app.js`.
4. Keep the existing basemap initialization and vector rendering logic unchanged except where tests make an unnecessary extra layer evident.

No new state object, time array, event handler, dependency, service, or runtime asset will be introduced.

## Accessibility

- Timeline controls remain native buttons with their existing accessible labels.
- Buttons are keyboard focusable and visibly interactive, although they intentionally have no action in this demonstration.
- Spatial Query must not advertise a disabled state to assistive technology.

## Test Strategy

Follow red-green-refactor:

1. Add or update contract tests that initially fail against the current interface.
2. Assert the fixed date, enabled controls, enabled Spatial Query copy, and absence of Layer Information.
3. Assert the ArcGIS World Street Map URL remains unchanged and no additional tile layer is introduced.
4. Implement the minimum markup, CSS, and JavaScript changes.
5. Run the focused contract tests, full Node test suite, JavaScript syntax checks, and `git diff --check`.

## Acceptance Criteria

- Both functional modules display `2016-01-01` in the timeline.
- Previous, next, and play buttons are clickable-looking and not disabled, but clicks do not change application state.
- Spatial Query has normal enabled styling and the approved instruction text, with no implemented query result.
- No Layer Information heading or content remains.
- Exactly the same ArcGIS World Street Map basemap used by the reference repository remains configured.
- Administrative/water overlays, sample rasters, legends, opacity, navigation, automatic extent fitting, local double-click opening, and placeholder modules continue to behave as before.

