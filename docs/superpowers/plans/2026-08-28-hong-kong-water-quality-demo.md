# Hong Kong Water Quality Demonstration Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a double-clickable static Leaflet demonstration that reproduces the reference platform's UI, shows the supplied Water Surface Temperature and Chlorophyll-a samples, and honestly handles every unsupported variable.

**Architecture:** Development-only scripts classify and reproject the supplied GeoTIFFs and convert the Shapefiles into local browser assets. A dependency-free runtime made of `index.html`, `styles.css`, `app.js`, vendored Leaflet files, and generated assets runs directly under `file://`; pure state helpers remain testable with Node's built-in test runner.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript, Leaflet 1.9.4, GDAL/OGR development tools, Node.js built-in `node:test`.

## Global Constraints

- Runtime must work by double-clicking `index.html`; no runtime server, package installation, Python, or backend.
- Exact title: `Hong Kong Remote Sensing Water Quality Monitoring Demonstration System`.
- Exact navigation labels: `Water Environment Data`, `Historical Water Quality`, `Water Quality Forecasts`, `Risk Alerts & Recommended Actions`.
- Real samples: only `Water Surface Temperature` in section 1 and `Chlorophyll-a` in section 2.
- Unsupported variables remove the raster and display `No sample data available` without retaining stale data.
- Fixed single-step timeline label: `Single time step`; previous, next, and play controls stay disabled.
- Header is 58 px; title 20 px; navigation 15 px; sidebar 320 px; sidebar headings 16 px; variable labels 14 px; timeline label 17 px; legend text 14 px.
- Do not invent acquisition dates, measurements, forecasts, alerts, or units absent from the supplied reference material.
- Source files under `相关数据/` must remain unchanged.
- Third and fourth sections are placeholders only.

---

## File Map

- `index.html` — semantic application shell, header navigation, sidebar controls, map container, status regions, and placeholder views.
- `styles.css` — reference-compatible visual system, enlarged typography, map/sidebar layout, disabled states, notices, and responsive behavior.
- `app.js` — application configuration, pure view-state transitions, DOM rendering, Leaflet initialization, raster/vector switching, and error fallbacks.
- `assets/metadata.js` — generated/checked raster bounds, classifications, labels, and map extent assigned to `window.HK_DEMO_METADATA`.
- `assets/map-data.js` — generated administrative and water GeoJSON assigned to `window.HK_MAP_DATA`.
- `assets/wst.png` — classified transparent Water Surface Temperature overlay.
- `assets/chla.png` — reprojected and classified transparent Chlorophyll-a overlay.
- `assets/leaflet/leaflet.js`, `assets/leaflet/leaflet.css`, `assets/leaflet/images/*` — local Leaflet runtime.
- `scripts/prepare-data.ps1` — development-only deterministic GDAL/OGR conversion entry point.
- `scripts/wrap-geojson.mjs` — converts temporary GeoJSON files into `map-data.js`.
- `tests/assets.test.mjs` — validates generated data files, dimensions, bounds, and global variable wrappers.
- `tests/site-contract.test.mjs` — validates required copy, local-only references, typography tokens, and semantic containers.
- `tests/app-state.test.mjs` — validates section/variable transitions and supported versus unsupported datasets.
- `tests/map-contract.test.mjs` — validates map-layer order, vector fit bounds, raster clearing, timeline disablement, and placeholder behavior.
- `README.md` — concise double-click usage and offline-basemap behavior.
- `.gitignore` — excludes temporary conversion outputs while retaining final assets and source data.

---

### Task 1: Deterministic Geospatial Asset Pipeline

**Files:**
- Create: `.gitignore`
- Create: `scripts/prepare-data.ps1`
- Create: `scripts/wrap-geojson.mjs`
- Create: `tests/assets.test.mjs`
- Create: `assets/metadata.js`
- Generate: `assets/wst.png`
- Generate: `assets/chla.png`
- Generate: `assets/map-data.js`

**Interfaces:**
- Consumes: `相关数据/wst.tif`, `相关数据/Chla.tif`, `相关数据/gis_osm_adminareas_a_free_1.shp`, and `相关数据/gis_osm_water_a_free_1.shp`.
- Produces: `window.HK_DEMO_METADATA` with `mapBounds`, `datasets.wst`, and `datasets.chla`; `window.HK_MAP_DATA` with `administrative` and `water` FeatureCollections; two RGBA PNG overlays.

- [ ] **Step 1: Add the failing generated-asset test**

Create `tests/assets.test.mjs` with this complete contract:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const root = path.resolve(import.meta.dirname, '..')

function loadBrowserScript(relativePath) {
  const context = { window: {} }
  vm.createContext(context)
  vm.runInContext(fs.readFileSync(path.join(root, relativePath), 'utf8'), context)
  return context.window
}

test('generated assets expose the approved Hong Kong datasets', () => {
  for (const name of ['assets/wst.png', 'assets/chla.png', 'assets/map-data.js', 'assets/metadata.js']) {
    assert.equal(fs.existsSync(path.join(root, name)), true, `${name} is missing`)
  }

  const metadata = loadBrowserScript('assets/metadata.js').HK_DEMO_METADATA
  assert.deepEqual(Array.from(metadata.mapBounds[0]), [22.1367246, 113.8172408])
  assert.deepEqual(Array.from(metadata.mapBounds[1]), [22.5683333, 114.5024867])
  assert.equal(metadata.datasets.wst.unit, '°C')
  assert.deepEqual(Array.from(metadata.datasets.wst.breaks), [15, 20, 25, 30, 35, 40])
  assert.equal(metadata.datasets.chla.unit, 'mg/m³')
  assert.deepEqual(Array.from(metadata.datasets.chla.breaks), [0, 1.5, 3, 4.5, 6])

  const mapData = loadBrowserScript('assets/map-data.js').HK_MAP_DATA
  assert.equal(mapData.administrative.type, 'FeatureCollection')
  assert.equal(mapData.administrative.features.length, 31)
  assert.equal(mapData.water.type, 'FeatureCollection')
  assert.equal(mapData.water.features.length, 3757)
})
```

- [ ] **Step 2: Run the asset test and confirm the expected failure**

Run:

```powershell
& 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/assets.test.mjs
```

Expected: FAIL because `assets/wst.png` does not exist.

- [ ] **Step 3: Add temporary-output exclusions**

Create `.gitignore`:

```gitignore
.tmp/
scripts/.generated/
```

Do not ignore `相关数据/`, `assets/`, planning files, or documentation.

- [ ] **Step 4: Implement the GeoJSON wrapper**

Create `scripts/wrap-geojson.mjs`:

```js
import fs from 'node:fs'
import path from 'node:path'

const [adminPath, waterPath, outputPath] = process.argv.slice(2)
if (!adminPath || !waterPath || !outputPath) {
  throw new Error('Usage: node wrap-geojson.mjs <admin.geojson> <water.geojson> <map-data.js>')
}

const administrative = JSON.parse(fs.readFileSync(adminPath, 'utf8'))
const water = JSON.parse(fs.readFileSync(waterPath, 'utf8'))
const payload = { administrative, water }
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `window.HK_MAP_DATA = ${JSON.stringify(payload)};\n`, 'utf8')
```

- [ ] **Step 5: Implement the conversion pipeline**

Create `scripts/prepare-data.ps1`. It must stop on errors, resolve commands once, validate source paths, classify rasters into byte classes, colorize them with alpha, simplify vectors, wrap GeoJSON, and write metadata:

```powershell
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceDir = Join-Path $projectRoot '相关数据'
$assetDir = Join-Path $projectRoot 'assets'
$generatedDir = Join-Path $PSScriptRoot '.generated'
$node = 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'

$required = @(
  (Join-Path $sourceDir 'wst.tif'),
  (Join-Path $sourceDir 'Chla.tif'),
  (Join-Path $sourceDir 'gis_osm_adminareas_a_free_1.shp'),
  (Join-Path $sourceDir 'gis_osm_water_a_free_1.shp')
)
foreach ($file in $required) {
  if (-not (Test-Path -LiteralPath $file)) { throw "Missing source: $file" }
}

New-Item -ItemType Directory -Force -Path $assetDir, $generatedDir | Out-Null

$wstClass = Join-Path $generatedDir 'wst-classes.tif'
$chlaWarp = Join-Path $generatedDir 'chla-wgs84.tif'
$chlaClass = Join-Path $generatedDir 'chla-classes.tif'
$wstColors = Join-Path $generatedDir 'wst-colors.txt'
$chlaColors = Join-Path $generatedDir 'chla-colors.txt'
$adminJson = Join-Path $generatedDir 'administrative.geojson'
$waterJson = Join-Path $generatedDir 'water.geojson'

@'
0 0 0 0 0
1 102 169 234 255
2 201 242 177 255
3 255 242 102 255
4 242 160 0 255
5 229 68 0 255
'@ | Set-Content -LiteralPath $wstColors -Encoding ascii

@'
0 0 0 0 0
1 102 169 234 255
2 201 242 177 255
3 51 224 0 255
4 23 117 0 255
5 242 160 0 255
'@ | Set-Content -LiteralPath $chlaColors -Encoding ascii

gdal_calc.py -A (Join-Path $sourceDir 'wst.tif') --outfile=$wstClass --type=Byte --NoDataValue=0 --overwrite --calc="1*((A>=15)*(A<20))+2*((A>=20)*(A<25))+3*((A>=25)*(A<30))+4*((A>=30)*(A<35))+5*((A>=35)*(A<=40))"
gdaldem color-relief $wstClass $wstColors (Join-Path $assetDir 'wst.png') -alpha -nearest_color_entry

gdalwarp -overwrite -t_srs EPSG:4326 -r bilinear -dstnodata -9999 (Join-Path $sourceDir 'Chla.tif') $chlaWarp
gdal_calc.py -A $chlaWarp --outfile=$chlaClass --type=Byte --NoDataValue=0 --overwrite --calc="1*((A>=0)*(A<1.5))+2*((A>=1.5)*(A<3))+3*((A>=3)*(A<4.5))+4*((A>=4.5)*(A<6))+5*(A>=6)"
gdaldem color-relief $chlaClass $chlaColors (Join-Path $assetDir 'chla.png') -alpha -nearest_color_entry

ogr2ogr -overwrite -f GeoJSON -t_srs EPSG:4326 -simplify 0.00008 -lco COORDINATE_PRECISION=6 -select name $adminJson (Join-Path $sourceDir 'gis_osm_adminareas_a_free_1.shp')
ogr2ogr -overwrite -f GeoJSON -t_srs EPSG:4326 -simplify 0.00004 -lco COORDINATE_PRECISION=6 -select name $waterJson (Join-Path $sourceDir 'gis_osm_water_a_free_1.shp')

& $node (Join-Path $PSScriptRoot 'wrap-geojson.mjs') $adminJson $waterJson (Join-Path $assetDir 'map-data.js')

@'
window.HK_DEMO_METADATA = {
  mapBounds: [[22.1367246, 113.8172408], [22.5683333, 114.5024867]],
  datasets: {
    wst: {
      image: 'assets/wst.png', unit: '°C', bounds: [[22.1362852, 113.8165465], [22.5683749, 114.5028594]],
      breaks: [15, 20, 25, 30, 35, 40], labels: ['15–20', '20–25', '25–30', '30–35', '35–40'],
      colors: ['#66a9ea', '#c9f2b1', '#fff266', '#f2a000', '#e54400']
    },
    chla: {
      image: 'assets/chla.png', unit: 'mg/m³', bounds: [[22.130450, 113.809311], [22.571122, 114.506519]],
      breaks: [0, 1.5, 3, 4.5, 6], labels: ['0–1.5', '1.5–3', '3–4.5', '4.5–6', '>6'],
      colors: ['#66a9ea', '#c9f2b1', '#33e000', '#177500', '#f2a000']
    }
  }
};
'@ | Set-Content -LiteralPath (Join-Path $assetDir 'metadata.js') -Encoding utf8
```

Before running, resolve the actual `gdal_calc.py` location with `Get-Command gdal_calc.py`; if its executable name differs, replace only that command path without changing the expressions.

- [ ] **Step 6: Run the conversion pipeline**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/prepare-data.ps1
```

Expected: exit code 0 and all four final assets created under `assets/`.

- [ ] **Step 7: Run the asset test and inspect file sizes**

Run:

```powershell
& 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/assets.test.mjs
Get-ChildItem assets | Select-Object Name,Length
```

Expected: PASS; `wst.png` and `chla.png` are non-empty; `map-data.js` and `metadata.js` expose the expected globals.

- [ ] **Step 8: Commit the data pipeline and generated assets**

```powershell
git add .gitignore scripts tests/assets.test.mjs assets
git commit -m "feat: prepare static Hong Kong map assets"
```

---

### Task 2: Static Shell and Enlarged Reference Styling

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `tests/site-contract.test.mjs`
- Create: `assets/leaflet/leaflet.js`
- Create: `assets/leaflet/leaflet.css`
- Create: `assets/leaflet/images/*`

**Interfaces:**
- Consumes: `window.HK_DEMO_METADATA` and `window.HK_MAP_DATA` scripts from Task 1.
- Produces: stable DOM IDs used by `app.js`: `primary-nav`, `sidebar`, `map`, `legend`, `map-notice`, `placeholder-view`, `layer-list`, `opacity`, and `timeline-label`.

- [ ] **Step 1: Add the failing site-contract test**

Create `tests/site-contract.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8')

test('shell contains approved title, navigation, and local assets', () => {
  for (const text of [
    'Hong Kong Remote Sensing Water Quality Monitoring Demonstration System',
    'Water Environment Data',
    'Historical Water Quality',
    'Water Quality Forecasts',
    'Risk Alerts &amp; Recommended Actions'
  ]) assert.match(html, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))

  assert.match(html, /assets\/leaflet\/leaflet\.css/)
  assert.match(html, /assets\/leaflet\/leaflet\.js/)
  assert.doesNotMatch(html, /unpkg|cdn\.jsdelivr|cdnjs/)
  for (const id of ['primary-nav', 'sidebar', 'map', 'legend', 'map-notice', 'placeholder-view', 'layer-list', 'opacity', 'timeline-label']) {
    assert.match(html, new RegExp(`id=["']${id}["']`))
  }
})

test('approved enlarged typography tokens are present', () => {
  assert.match(css, /--header-height:\s*58px/)
  assert.match(css, /--sidebar-width:\s*320px/)
  assert.match(css, /--title-size:\s*20px/)
  assert.match(css, /--nav-size:\s*15px/)
  assert.match(css, /--section-title-size:\s*16px/)
  assert.match(css, /--variable-size:\s*14px/)
  assert.match(css, /--timeline-size:\s*17px/)
  assert.match(css, /--legend-size:\s*14px/)
})
```

- [ ] **Step 2: Run the contract test and confirm failure**

Run the Node test command from Task 1 with `tests/site-contract.test.mjs`.

Expected: FAIL because `index.html` and `styles.css` do not exist.

- [ ] **Step 3: Vendor Leaflet 1.9.4 locally**

Use a temporary package directory and copy only distribution files:

```powershell
New-Item -ItemType Directory -Force -Path '.tmp\leaflet-package','assets\leaflet' | Out-Null
npm pack leaflet@1.9.4 --pack-destination '.tmp\leaflet-package'
tar -xf '.tmp\leaflet-package\leaflet-1.9.4.tgz' -C '.tmp\leaflet-package'
Copy-Item '.tmp\leaflet-package\package\dist\leaflet.js' 'assets\leaflet\leaflet.js'
Copy-Item '.tmp\leaflet-package\package\dist\leaflet.css' 'assets\leaflet\leaflet.css'
Copy-Item '.tmp\leaflet-package\package\dist\images' 'assets\leaflet\images' -Recurse
```

Expected: all runtime Leaflet references resolve locally. If network is restricted, rerun only the `npm pack` command with the required approval; do not change versions.

- [ ] **Step 4: Create the semantic HTML shell**

Create `index.html` with this exact hierarchy and script order:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hong Kong Remote Sensing Water Quality Monitoring Demonstration System</title>
  <link rel="stylesheet" href="assets/leaflet/leaflet.css">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="app-shell">
    <header class="app-header">
      <h1>Hong Kong Remote Sensing Water Quality Monitoring Demonstration System</h1>
      <nav id="primary-nav" class="app-nav" aria-label="Primary navigation">
        <button data-section="environment" class="nav-link is-active">Water Environment Data</button>
        <button data-section="historical" class="nav-link">Historical Water Quality</button>
        <button data-section="forecasts" class="nav-link">Water Quality Forecasts</button>
        <button data-section="alerts" class="nav-link">Risk Alerts &amp; Recommended Actions</button>
      </nav>
    </header>
    <main id="data-view" class="data-view">
      <aside id="sidebar" class="sidebar">
        <section class="sidebar-section"><h2>Data Layers</h2><div id="layer-list" class="layer-list"></div></section>
        <section class="sidebar-section"><h2>Opacity</h2><input id="opacity" type="range" min="0" max="1" step="0.05" value="0.75"><output id="opacity-value">75%</output></section>
        <section class="sidebar-section"><h2>Timeline</h2><div id="timeline-label" class="timeline-label">Single time step</div><div class="timeline"><button disabled aria-label="Previous time step">◀</button><div class="timeline-rail"><span></span></div><button disabled aria-label="Next time step">▶</button></div><button class="play-button" disabled>▶ Play</button></section>
        <section class="sidebar-section is-disabled" aria-disabled="true"><h2>Spatial Query</h2><p>Spatial query is not available in this demonstration.</p></section>
        <section class="sidebar-section"><h2>Layer Information</h2><p id="layer-description"></p></section>
      </aside>
      <section class="map-area" aria-label="Hong Kong water-quality map">
        <div id="map"></div>
        <div id="map-notice" class="map-notice" aria-live="polite" hidden></div>
        <aside id="legend" class="legend" aria-label="Map legend"></aside>
      </section>
    </main>
    <main id="placeholder-view" class="placeholder-view" hidden><div><h2></h2><p>Demonstration module — no functionality implemented</p></div></main>
  </div>
  <script src="assets/leaflet/leaflet.js"></script>
  <script src="assets/metadata.js"></script>
  <script src="assets/map-data.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 5: Implement the reference-compatible CSS**

Create `styles.css` with the approved tokens and complete component rules. The implementation must include these exact foundations and selectors; fill no values by guesswork:

```css
:root {
  --header-height: 58px;
  --sidebar-width: 320px;
  --title-size: 20px;
  --nav-size: 15px;
  --section-title-size: 16px;
  --variable-size: 14px;
  --timeline-size: 17px;
  --legend-size: 14px;
  --header-bg: #1a1a2e;
  --sidebar-bg: #f5f7fa;
  --active-bg: #d0e0ff;
  --primary: #1a73e8;
  color: #222;
  font-family: Arial, "Helvetica Neue", sans-serif;
}
* { box-sizing: border-box; }
html, body { width: 100%; height: 100%; margin: 0; }
button, input { font: inherit; }
.app-shell { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
.app-header { height: var(--header-height); flex: none; display: flex; align-items: center; gap: 22px; padding: 0 18px; background: var(--header-bg); color: white; }
.app-header h1 { flex: none; margin: 0; font-size: var(--title-size); font-weight: 600; white-space: nowrap; }
.app-nav { display: flex; min-width: 0; gap: 4px; overflow-x: auto; }
.nav-link { border: 0; border-radius: 4px; padding: 9px 11px; background: transparent; color: rgb(255 255 255 / 78%); font-size: var(--nav-size); white-space: nowrap; cursor: pointer; }
.nav-link:hover, .nav-link:focus-visible, .nav-link.is-active { background: rgb(255 255 255 / 14%); color: white; outline: none; }
.data-view { display: flex; flex: 1; min-height: 0; }
.sidebar { width: var(--sidebar-width); min-width: var(--sidebar-width); overflow-y: auto; padding: 12px; border-right: 1px solid #ddd; background: var(--sidebar-bg); }
.sidebar-section { margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #e0e0e0; }
.sidebar-section h2 { margin: 0 0 9px; color: #333; font-size: var(--section-title-size); }
.sidebar-section p { margin: 5px 0; color: #5b6570; font-size: 13px; line-height: 1.45; }
.sidebar-section.is-disabled { opacity: .58; }
.layer-list { display: grid; gap: 4px; }
.layer-item { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: start; gap: 7px; padding: 7px 8px; border-radius: 4px; cursor: pointer; font-size: var(--variable-size); line-height: 1.35; }
.layer-item:hover { background: #e8ecf1; }
.layer-item.is-active { background: var(--active-bg); font-weight: 600; }
.layer-item input { margin-top: 3px; }
.layer-unit { color: #7a8490; font-size: 12px; font-weight: 400; white-space: nowrap; }
#opacity { width: calc(100% - 52px); }
#opacity-value { margin-left: 8px; color: #667; font-size: 13px; }
.timeline-label { margin-bottom: 8px; color: var(--header-bg); font-size: var(--timeline-size); font-weight: 700; }
.timeline { display: grid; grid-template-columns: 28px 1fr 28px; align-items: center; gap: 8px; }
.timeline button, .play-button { border: 1px solid #c7ced6; border-radius: 4px; background: white; color: #89929c; }
.timeline button { height: 28px; }
.timeline-rail { position: relative; height: 9px; border-radius: 5px; background: #d0d0d0; }
.timeline-rail::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 50%; border-radius: inherit; background: var(--primary); }
.timeline-rail span { position: absolute; top: 50%; left: 50%; width: 16px; height: 16px; transform: translate(-50%, -50%); border: 2px solid white; border-radius: 50%; background: var(--primary); box-shadow: 0 1px 3px rgb(0 0 0 / 25%); }
.play-button { width: 100%; margin-top: 9px; padding: 7px 12px; }
.map-area { position: relative; flex: 1; min-width: 0; background: #e8e8e8; }
#map { width: 100%; height: 100%; background: #e8e8e8; }
.legend { position: absolute; z-index: 500; right: 16px; bottom: 28px; min-width: 150px; padding: 11px 14px; border-radius: 6px; background: rgb(255 255 255 / 94%); box-shadow: 0 2px 8px rgb(0 0 0 / 18%); font-size: var(--legend-size); }
.legend h3 { margin: 0 0 8px; font-size: 15px; }
.legend-item { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
.legend-swatch { width: 22px; height: 14px; border-radius: 2px; }
.map-notice { position: absolute; z-index: 600; top: 50%; left: 50%; transform: translate(-50%, -50%); max-width: min(440px, calc(100% - 40px)); padding: 14px 18px; border-radius: 7px; background: rgb(255 255 255 / 94%); box-shadow: 0 3px 14px rgb(0 0 0 / 18%); color: #4b5563; font-size: 16px; text-align: center; }
.placeholder-view { flex: 1; padding: 64px 24px; background: var(--sidebar-bg); }
.placeholder-view > div { width: min(720px, 100%); margin: 0 auto; }
.placeholder-view h2 { margin: 0 0 10px; color: var(--header-bg); font-size: 24px; }
.placeholder-view p { margin: 0; color: #667; font-size: 16px; }
[hidden] { display: none !important; }
@media (max-width: 1024px) {
  .app-header { align-items: flex-start; height: auto; min-height: var(--header-height); padding-block: 12px; flex-wrap: wrap; }
  .app-header h1 { white-space: normal; }
  .app-nav { width: 100%; }
  .data-view { flex-direction: column; overflow-y: auto; }
  .sidebar { width: 100%; min-width: 0; max-height: 46vh; border-right: 0; border-bottom: 1px solid #ddd; }
  .map-area { min-height: 54vh; }
}
```

- [ ] **Step 6: Run the site-contract test**

Run:

```powershell
& 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/site-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit the static shell**

```powershell
git add index.html styles.css assets/leaflet tests/site-contract.test.mjs
git commit -m "feat: add static water quality platform shell"
```

---

### Task 3: Test-Driven Application State and Variable Catalog

**Files:**
- Create: `app.js`
- Create: `tests/app-state.test.mjs`

**Interfaces:**
- Produces: `createInitialState()`, `selectSection(state, sectionId)`, `selectVariable(state, variableId)`, `getSection(sectionId)`, and `getActiveDataset(state)`.
- Consumers: DOM and Leaflet integration in Task 4.

- [ ] **Step 1: Add failing state-transition tests**

Create `tests/app-state.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import app from '../app.js'

test('initial state shows WST in Water Environment Data', () => {
  const state = app.createInitialState()
  assert.deepEqual(state, { sectionId: 'environment', variableId: 'wst', opacity: 0.75 })
  assert.equal(app.getActiveDataset(state), 'wst')
})

test('switching functional sections selects their only real sample', () => {
  const state = app.selectSection(app.createInitialState(), 'historical')
  assert.equal(state.variableId, 'chla')
  assert.equal(app.getActiveDataset(state), 'chla')
})

test('unsupported variables never retain the previous raster', () => {
  const state = app.selectVariable(app.createInitialState(), 'precipitation')
  assert.equal(state.variableId, 'precipitation')
  assert.equal(app.getActiveDataset(state), null)
})

test('placeholder sections have no active dataset', () => {
  const state = app.selectSection(app.createInitialState(), 'forecasts')
  assert.equal(state.variableId, null)
  assert.equal(app.getActiveDataset(state), null)
})

test('approved variable catalogs remain exact', () => {
  assert.deepEqual(app.getSection('environment').variables.map(({ label }) => label), [
    'Water Extent / Water Level / Storage', 'Water Surface Temperature', 'Chlorophyll Index',
    'Turbidity Index', 'SAR Polarimetric Index', 'Precipitation', 'Air Temperature', 'Downwelling Radiation'
  ])
  assert.deepEqual(app.getSection('historical').variables.map(({ label }) => label), [
    'Chlorophyll-a', 'Turbidity', 'Total Suspended Solids', 'Total Phosphorus', 'Total Nitrogen'
  ])
})
```

- [ ] **Step 2: Run tests and confirm failure**

Run the Node test command with `tests/app-state.test.mjs`.

Expected: FAIL because `app.js` does not exist.

- [ ] **Step 3: Implement the pure state model at the top of `app.js`**

Use these exact section IDs, variable IDs, copy values, and transitions:

```js
(function (global) {
  'use strict'

  const SECTIONS = {
    environment: {
      title: 'Water Environment Data', defaultVariableId: 'wst',
      variables: [
        { id: 'water-storage', label: 'Water Extent / Water Level / Storage' },
        { id: 'wst', label: 'Water Surface Temperature', unit: '°C', datasetId: 'wst' },
        { id: 'chlorophyll-index', label: 'Chlorophyll Index', unit: 'NDCI' },
        { id: 'turbidity-index', label: 'Turbidity Index' },
        { id: 'sar-index', label: 'SAR Polarimetric Index' },
        { id: 'precipitation', label: 'Precipitation' },
        { id: 'air-temperature', label: 'Air Temperature' },
        { id: 'downwelling-radiation', label: 'Downwelling Radiation' }
      ]
    },
    historical: {
      title: 'Historical Water Quality', defaultVariableId: 'chla',
      variables: [
        { id: 'chla', label: 'Chlorophyll-a', unit: 'mg/m³', datasetId: 'chla' },
        { id: 'turbidity', label: 'Turbidity', unit: 'NTU' },
        { id: 'tss', label: 'Total Suspended Solids', unit: 'mg/L' },
        { id: 'total-phosphorus', label: 'Total Phosphorus' },
        { id: 'total-nitrogen', label: 'Total Nitrogen' }
      ]
    },
    forecasts: { title: 'Water Quality Forecasts', defaultVariableId: null, variables: [] },
    alerts: { title: 'Risk Alerts & Recommended Actions', defaultVariableId: null, variables: [] }
  }

  const createInitialState = () => ({ sectionId: 'environment', variableId: 'wst', opacity: 0.75 })
  const getSection = (sectionId) => SECTIONS[sectionId]
  const selectSection = (state, sectionId) => {
    const section = getSection(sectionId)
    if (!section) return state
    return { ...state, sectionId, variableId: section.defaultVariableId }
  }
  const selectVariable = (state, variableId) => {
    const section = getSection(state.sectionId)
    return section.variables.some(({ id }) => id === variableId) ? { ...state, variableId } : state
  }
  const getActiveDataset = (state) => {
    const variable = getSection(state.sectionId)?.variables.find(({ id }) => id === state.variableId)
    return variable?.datasetId ?? null
  }

  const publicApi = { SECTIONS, createInitialState, getSection, selectSection, selectVariable, getActiveDataset }
  if (typeof module !== 'undefined' && module.exports) module.exports = publicApi
  global.HK_DEMO_APP = publicApi

  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => initialize(publicApi))

  function initialize(api) { void api }
})(typeof window !== 'undefined' ? window : globalThis)
```

- [ ] **Step 4: Run the state tests**

Expected: all five tests PASS.

- [ ] **Step 5: Commit the state model**

```powershell
git add app.js tests/app-state.test.mjs
git commit -m "feat: define demonstration navigation state"
```

---

### Task 4: Leaflet Rendering and Interaction Integration

**Files:**
- Modify: `app.js`
- Create: `tests/map-contract.test.mjs`

**Interfaces:**
- Consumes: Task 3 state helpers, `window.HK_DEMO_METADATA`, `window.HK_MAP_DATA`, Leaflet global `L`, and Task 2 DOM IDs.
- Produces: a working local map, persistent vector overlays, raster replacement/clearing, legends, notices, opacity changes, navigation switching, and placeholders.

- [ ] **Step 1: Add failing map-integration contract tests**

Create `tests/map-contract.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8')

test('map integration preserves required layer order and bounds behavior', () => {
  assert.match(source, /L\.tileLayer\(/)
  assert.match(source, /L\.imageOverlay\(/)
  assert.match(source, /L\.geoJSON\(mapData\.administrative/)
  assert.match(source, /L\.geoJSON\(mapData\.water/)
  assert.match(source, /map\.fitBounds\(metadata\.mapBounds/)
})

test('unsupported data clears stale raster and announces the empty state', () => {
  assert.match(source, /activeRaster\.remove\(\)/)
  assert.match(source, /No sample data available/)
  assert.match(source, /legend\.hidden = true/)
})

test('timeline and placeholders use approved copy', () => {
  assert.match(source, /Single time step/)
  assert.match(source, /Demonstration module — no functionality implemented/)
})
```

- [ ] **Step 2: Run the map contract and confirm failure**

Expected: FAIL because Leaflet integration is not yet present.

- [ ] **Step 3: Replace the Task 3 `initialize` stub with complete integration**

The final `initialize(api)` must use this flow and the same function names so tests and event handlers stay consistent:

```js
function initialize(api) {
  const metadata = global.HK_DEMO_METADATA
  const mapData = global.HK_MAP_DATA
  const elements = {
    nav: document.getElementById('primary-nav'), dataView: document.getElementById('data-view'),
    placeholder: document.getElementById('placeholder-view'), sidebar: document.getElementById('sidebar'),
    layerList: document.getElementById('layer-list'), opacity: document.getElementById('opacity'),
    opacityValue: document.getElementById('opacity-value'), timelineLabel: document.getElementById('timeline-label'),
    description: document.getElementById('layer-description'), legend: document.getElementById('legend'),
    notice: document.getElementById('map-notice')
  }
  let state = api.createInitialState()
  let activeRaster = null

  const map = L.map('map', { zoomControl: true, attributionControl: true })
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: '&copy; Esri', maxZoom: 18
  }).addTo(map)
  L.geoJSON(mapData.administrative, { style: { color: '#66717d', weight: 1.2, opacity: 0.8, fillOpacity: 0 } }).addTo(map)
  L.geoJSON(mapData.water, { style: { color: '#4e7c91', weight: 0.8, opacity: 0.6, fillOpacity: 0 } }).addTo(map)
  map.fitBounds(metadata.mapBounds, { padding: [18, 18] })

  function showNotice(message) {
    elements.notice.textContent = message
    elements.notice.hidden = !message
  }

  function clearRaster() {
    if (activeRaster) {
      activeRaster.remove()
      activeRaster = null
    }
  }

  function renderLegend(datasetId) {
    const dataset = metadata.datasets[datasetId]
    if (!dataset) {
      elements.legend.hidden = true
      elements.legend.replaceChildren()
      return
    }
    const title = document.createElement('h3')
    title.textContent = `${api.getSection(state.sectionId).variables.find(({ id }) => id === state.variableId).label} (${dataset.unit})`
    const fragment = document.createDocumentFragment()
    fragment.append(title)
    dataset.labels.forEach((label, index) => {
      const row = document.createElement('div')
      row.className = 'legend-item'
      const swatch = document.createElement('span')
      swatch.className = 'legend-swatch'
      swatch.style.backgroundColor = dataset.colors[index]
      const copy = document.createElement('span')
      copy.textContent = label
      row.append(swatch, copy)
      fragment.append(row)
    })
    elements.legend.replaceChildren(fragment)
    elements.legend.hidden = false
  }

  function renderMapData() {
    clearRaster()
    const datasetId = api.getActiveDataset(state)
    if (!datasetId) {
      renderLegend(null)
      showNotice('No sample data available')
      return
    }
    const dataset = metadata.datasets[datasetId]
    showNotice('')
    activeRaster = L.imageOverlay(dataset.image, dataset.bounds, { opacity: state.opacity, interactive: false })
    activeRaster.on('error', () => { clearRaster(); renderLegend(null); showNotice('Sample layer could not be loaded') })
    activeRaster.addTo(map)
    renderLegend(datasetId)
  }

  function renderVariableList() {
    const section = api.getSection(state.sectionId)
    const fragment = document.createDocumentFragment()
    section.variables.forEach((variable) => {
      const label = document.createElement('label')
      label.className = `layer-item${variable.id === state.variableId ? ' is-active' : ''}`
      const radio = document.createElement('input')
      radio.type = 'radio'; radio.name = 'layer'; radio.value = variable.id; radio.checked = variable.id === state.variableId
      radio.addEventListener('change', () => { state = api.selectVariable(state, variable.id); render() })
      const name = document.createElement('span'); name.textContent = variable.label
      label.append(radio, name)
      if (variable.unit) { const unit = document.createElement('span'); unit.className = 'layer-unit'; unit.textContent = `(${variable.unit})`; label.append(unit) }
      fragment.append(label)
    })
    elements.layerList.replaceChildren(fragment)
  }

  function render() {
    const section = api.getSection(state.sectionId)
    const functional = section.variables.length > 0
    elements.dataView.hidden = !functional
    elements.placeholder.hidden = functional
    elements.nav.querySelectorAll('[data-section]').forEach((button) => button.classList.toggle('is-active', button.dataset.section === state.sectionId))
    if (!functional) {
      clearRaster()
      elements.placeholder.querySelector('h2').textContent = section.title
      elements.placeholder.querySelector('p').textContent = 'Demonstration module — no functionality implemented'
      return
    }
    renderVariableList()
    const variable = section.variables.find(({ id }) => id === state.variableId)
    elements.description.textContent = variable?.datasetId ? 'Single real sample dataset.' : 'Variable listed for interface demonstration; no sample raster is available.'
    elements.timelineLabel.textContent = 'Single time step'
    elements.opacity.value = String(state.opacity)
    elements.opacityValue.value = `${Math.round(state.opacity * 100)}%`
    map.invalidateSize()
    map.fitBounds(metadata.mapBounds, { padding: [18, 18] })
    renderMapData()
  }

  elements.nav.addEventListener('click', (event) => {
    const button = event.target.closest('[data-section]')
    if (!button) return
    state = api.selectSection(state, button.dataset.section)
    render()
  })
  elements.opacity.addEventListener('input', () => {
    state = { ...state, opacity: Number(elements.opacity.value) }
    elements.opacityValue.value = `${Math.round(state.opacity * 100)}%`
    if (activeRaster) activeRaster.setOpacity(state.opacity)
  })
  window.addEventListener('resize', () => map.invalidateSize())
  render()
}
```

Keep the state model from Task 3 unchanged. Ensure the map notice is non-blocking and the vector layers are created once, before any raster overlay changes.

- [ ] **Step 4: Run state, contract, and map tests**

Run:

```powershell
& 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/app-state.test.mjs tests/site-contract.test.mjs tests/map-contract.test.mjs tests/assets.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 5: Complete the first meaningful preview handoff**

Open the absolute local path `E:\框架展示\index.html` in the Codex browser only after all Task 4 tests pass and the default WST surface is complete. Do not perform screenshot, DOM inspection, clicking, or resizing unless the user explicitly requests browser testing.

- [ ] **Step 6: Commit the working interactive platform**

```powershell
git add app.js tests/map-contract.test.mjs
git commit -m "feat: render sample water quality layers"
```

---

### Task 5: Local Usage Documentation and Final Verification

**Files:**
- Create: `README.md`
- Modify: `tests/site-contract.test.mjs`

**Interfaces:**
- Consumes: completed site from Tasks 1–4.
- Produces: the user-facing opening instructions and a final automated verification result.

- [ ] **Step 1: Extend the failing documentation contract**

Append this test to `tests/site-contract.test.mjs`:

```js
test('README documents double-click and offline behavior', () => {
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8')
  assert.match(readme, /double-click `index\.html`/i)
  assert.match(readme, /offline/i)
  assert.match(readme, /No installation/i)
})
```

- [ ] **Step 2: Run the documentation test and confirm failure**

Expected: FAIL because `README.md` does not exist.

- [ ] **Step 3: Create the concise README**

Create `README.md`:

```markdown
# Hong Kong Remote Sensing Water Quality Monitoring Demonstration System

This is a static demonstration of two supplied sample datasets.

## Open

Double-click `index.html`. No installation, server, Node.js, Python, or database is required.

The street basemap is loaded from the internet when available. When offline, the local Water Surface Temperature and Chlorophyll-a overlays and Hong Kong vector boundaries remain available on a neutral map background.

## Included samples

- Water Environment Data → Water Surface Temperature (°C)
- Historical Water Quality → Chlorophyll-a (mg/m³)

Other listed variables intentionally show `No sample data available`. The forecast and risk-alert entries are presentation-only placeholders.
```

- [ ] **Step 4: Run all tests**

Run:

```powershell
& 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/*.test.mjs
```

Expected: all tests PASS with zero failures.

- [ ] **Step 5: Verify source preservation and required deliverables**

Run:

```powershell
git diff --exit-code -- '相关数据'
Get-Item index.html,styles.css,app.js,README.md,assets/wst.png,assets/chla.png,assets/map-data.js,assets/metadata.js | Select-Object FullName,Length
git status --short
```

Expected: no diff under `相关数据`; every deliverable exists and has non-zero length; only intentional planning/progress files may remain untracked or modified.

- [ ] **Step 6: Commit documentation and final test updates**

```powershell
git add README.md tests/site-contract.test.mjs
git commit -m "docs: add local demonstration instructions"
```

- [ ] **Step 7: Run the verification-before-completion gate**

Re-run all tests from Step 4 after the final commit and record the command output in `progress.md`. Do not claim completion unless the latest run passes.
