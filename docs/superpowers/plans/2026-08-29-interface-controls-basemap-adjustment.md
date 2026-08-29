# Interface Controls and Basemap Adjustment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the timeline and spatial-query controls look enabled while remaining non-functional, show the fixed date `2016-01-01`, remove Layer Information, and retain only the reference-compatible basemap configuration.

**Architecture:** Keep the existing dependency-free static-page architecture. Modify only the HTML contract, presentation CSS, and obsolete DOM references in `app.js`; no new state, event handler, dependency, service, or runtime asset is introduced.

**Tech Stack:** Static HTML5, CSS, browser JavaScript, Leaflet 1.9.4, Node.js built-in test runner.

## Global Constraints

- Replace every visible `Single time step` label with the fixed date `2016-01-01`.
- Previous, next, and play controls are native enabled buttons and intentionally perform no action.
- Clicking a timeline control must not change the date, selected layer, raster, section, or play state.
- Spatial Query has normal enabled styling and displays exactly `Click the map to query pixel values; hold Shift and drag to select an area.`
- Do not add map click, drag-selection, result-card, or backend query behavior.
- Remove the complete Layer Information sidebar section and its JavaScript DOM references.
- Keep exactly one ArcGIS World Street Map tile layer using `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}`.
- Do not add street, road, label, or other basemap vector layers.
- Preserve the existing administrative and water overlays, automatic `fitBounds`, raster layers, legends, opacity behavior, navigation, placeholders, offline fallback, and double-click local opening.
- Use TDD: add the contract test first, run it and observe the expected failure, then make production changes.
- Work directly on `master`, as previously approved.
- Implementation and review subagents use `gpt-5.6-luna` with high reasoning effort, as requested by the user.

## File Structure

- `tests/site-contract.test.mjs` — owns sidebar markup, accessibility, enabled-state, fixed-copy, and removed-panel contracts.
- `tests/map-contract.test.mjs` — owns the exact single-basemap contract and render-source copy contract.
- `index.html` — owns the static timeline, Spatial Query, and sidebar panel markup.
- `styles.css` — owns interactive visual feedback for the enabled no-op buttons.
- `app.js` — owns render-time timeline text and DOM lookups; removes the obsolete Layer Information reference.

---

### Task 1: Refine sidebar controls and preserve the reference basemap

**Files:**
- Modify: `tests/site-contract.test.mjs`
- Modify: `tests/map-contract.test.mjs`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `app.js`

**Interfaces:**
- Consumes: the existing static DOM IDs `timeline-label`, `primary-nav`, `layer-list`, `opacity`, `legend`, and `map-notice`.
- Produces: unchanged `HK_DEMO_APP` public API; no new exported function or state field.
- Produces: a timeline label with fixed copy `2016-01-01`, three enabled no-op buttons, enabled Spatial Query guidance, and no Layer Information DOM node.

- [ ] **Step 1: Write failing sidebar and basemap contract tests**

Append these tests to `tests/site-contract.test.mjs`:

```javascript
test('timeline controls are enabled no-op presentation controls for the fixed sample date', () => {
  const timelineSection = html.match(/<section class="sidebar-section"><h2>Timeline<\/h2>[\s\S]*?<\/section>/)?.[0]
  assert.ok(timelineSection)
  assert.match(timelineSection, /id="timeline-label"[^>]*>2016-01-01<\/div>/)
  assert.doesNotMatch(timelineSection, /\sdisabled(?:\s|>)/)
  assert.match(timelineSection, /aria-label="Previous time step"/)
  assert.match(timelineSection, /aria-label="Next time step"/)
  assert.match(timelineSection, />▶ Play<\/button>/)
  assert.match(css, /\.timeline button[^}]*cursor:\s*pointer/s)
  assert.match(css, /\.timeline button:hover/)
  assert.match(css, /\.timeline button:focus-visible/)
})

test('spatial query looks available while layer information is absent', () => {
  const querySection = html.match(/<section class="sidebar-section"><h2>Spatial Query<\/h2>[\s\S]*?<\/section>/)?.[0]
  assert.ok(querySection)
  assert.match(querySection, /Click the map to query pixel values; hold Shift and drag to select an area\./)
  assert.doesNotMatch(querySection, /is-disabled|aria-disabled/)
  assert.doesNotMatch(html, /Layer Information|layer-description/)
  assert.doesNotMatch(css, /\.sidebar-section\.is-disabled/)
})
```

Replace the final test in `tests/map-contract.test.mjs` and add the basemap assertion:

```javascript
test('map uses exactly the reference ArcGIS World Street Map basemap', () => {
  const tileLayerCalls = [...source.matchAll(/L\.tileLayer\(/g)]
  assert.equal(tileLayerCalls.length, 1)
  assert.match(source, /https:\/\/server\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Street_Map\/MapServer\/tile\/\{z\}\/\{y\}\/\{x\}/)
})

test('timeline and placeholders use approved copy', () => {
  assert.match(source, /2016-01-01/)
  assert.doesNotMatch(source, /Single time step/)
  assert.doesNotMatch(source, /layer-description|elements\.description/)
  assert.match(source, /Demonstration module — no functionality implemented/)
})
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
& 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/site-contract.test.mjs tests/map-contract.test.mjs
```

Expected: FAIL because `Single time step`, disabled timeline buttons, disabled Spatial Query, Layer Information, `.sidebar-section.is-disabled`, and obsolete description references still exist. The exact basemap test should already pass, proving the project is preserving rather than replacing the reference basemap.

- [ ] **Step 3: Replace the sidebar markup with the approved static controls**

In `index.html`, replace the Timeline, Spatial Query, and Layer Information sequence with:

```html
<section class="sidebar-section">
  <h2>Timeline</h2>
  <div id="timeline-label" class="timeline-label">2016-01-01</div>
  <div class="timeline">
    <button type="button" aria-label="Previous time step">◀</button>
    <div class="timeline-rail"><span></span></div>
    <button type="button" aria-label="Next time step">▶</button>
  </div>
  <button type="button" class="play-button">▶ Play</button>
</section>
<section class="sidebar-section">
  <h2>Spatial Query</h2>
  <p>Click the map to query pixel values; hold Shift and drag to select an area.</p>
</section>
```

There must be no following Layer Information section.

- [ ] **Step 4: Give enabled no-op controls ordinary interaction styling**

Delete this obsolete rule from `styles.css`:

```css
.sidebar-section.is-disabled { opacity: .58; }
```

Replace the timeline button styling block with:

```css
.timeline button, .play-button {
  border: 1px solid #c7ced6;
  border-radius: 4px;
  background: white;
  color: #4d5966;
  cursor: pointer;
}
.timeline button { height: 28px; }
.timeline button:hover, .play-button:hover {
  border-color: var(--primary);
  background: #f4f8ff;
  color: var(--primary);
}
.timeline button:focus-visible, .play-button:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
.timeline button:active, .play-button:active { transform: translateY(1px); }
```

Retain the existing `.play-button` width, margin, and padding declaration.

- [ ] **Step 5: Remove obsolete Layer Information rendering and set the fixed date**

In the `elements` object in `app.js`, remove:

```javascript
description: document.getElementById('layer-description'),
```

In `render()`, remove the variable/description block:

```javascript
const variable = section.variables.find(({ id }) => id === state.variableId)
elements.description.textContent = variable?.datasetId ? 'Single real sample dataset.' : 'Variable listed for interface demonstration; no sample raster is available.'
```

Replace:

```javascript
elements.timelineLabel.textContent = 'Single time step'
```

with:

```javascript
elements.timelineLabel.textContent = '2016-01-01'
```

Do not add click handlers for the timeline or Spatial Query controls. Keep the current `L.tileLayer`, both `L.geoJSON` calls, and both `map.fitBounds` calls unchanged.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```powershell
& 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/site-contract.test.mjs tests/map-contract.test.mjs
```

Expected: all focused tests PASS with zero failures.

- [ ] **Step 7: Run the full verification suite**

Run:

```powershell
& 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/*.test.mjs
& 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check app.js
git diff --check
```

Expected: all Node tests PASS, `app.js` syntax check exits 0, and `git diff --check` exits 0.

- [ ] **Step 8: Self-review and commit**

Confirm that the diff contains no new event handler, dependency, runtime asset, map query implementation, or extra tile/vector basemap layer. Then run:

```powershell
git add -- tests/site-contract.test.mjs tests/map-contract.test.mjs index.html styles.css app.js
git commit -m "fix: refine demonstration controls"
```

Expected: one focused implementation commit containing the test-first contract and minimum production changes.

