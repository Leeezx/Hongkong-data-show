import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8')
const backend = fs.readFileSync(new URL('../backend/app.py', import.meta.url), 'utf8')

test('map integration preserves required layer order and bounds behavior', () => {
  assert.match(source, /L\.tileLayer\(/)
  assert.match(source, /L\.imageOverlay\(/)
  assert.match(source, /L\.geoJSON\(mapData\.administrative/)
  assert.match(source, /L\.geoJSON\(mapData\.water/)
  assert.match(source, /map\.fitBounds\(metadata\.mapBounds/)
})

test('API-backed layers use live Web Mercator tiles with PNG fallback', () => {
  assert.match(source, /L\.tileLayer\(dataset\.tileTemplate/)
  assert.match(source, /L\.imageOverlay\(dataset\.image/)
  assert.match(backend, /@app\.get\("\/api\/tiles\//)
  assert.match(backend, /WarpedVRT\(/)
  assert.match(backend, /from_bounds\(/)
})

test('vector overlays use panes above the raster pane', () => {
  assert.match(source, /map\.createPane\(['"]raster['"]\)/)
  assert.match(source, /map\.createPane\(['"]administrative['"]\)/)
  assert.match(source, /map\.createPane\(['"]water['"]\)/)
  assert.match(source, /rasterPane\.style\.zIndex\s*=\s*['"]400['"]\s*$/m)
  assert.match(source, /administrativePane\.style\.zIndex\s*=\s*['"]500['"]\s*$/m)
  assert.match(source, /waterPane\.style\.zIndex\s*=\s*['"]600['"]\s*$/m)
})

test('malformed vector data does not block map controls and announces a warning', () => {
  assert.match(source, /isFeatureCollection\(/)
  assert.match(source, /Map boundary overlays unavailable/)
  assert.match(source, /if \(.*isFeatureCollection\(.*administrative/)
  assert.match(source, /if \(.*isFeatureCollection\(.*water/)
})

test('stale raster errors cannot clear a newer active overlay', () => {
  assert.match(source, /const raster = dataset\.tileTemplate \? L\.tileLayer\(dataset\.tileTemplate|L\.imageOverlay\(dataset\.image/)
  assert.match(source, /if \(activeRaster !== raster\) return/)
})

test('unsupported data clears stale raster and announces the empty state', () => {
  assert.match(source, /activeRaster\.remove\(\)/)
  assert.match(source, /No sample data available/)
  assert.match(source, /legend\.hidden = true/)
})

test('map uses exactly the reference ArcGIS World Street Map basemap', () => {
  assert.match(source, /https:\/\/server\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Street_Map\/MapServer\/tile\/\{z\}\/\{y\}\/\{x\}/)
})

test('timeline and placeholders use approved copy', () => {
  assert.match(source, /2016-01-01/)
  assert.doesNotMatch(source, /Single time step/)
  assert.doesNotMatch(source, /layer-description|elements\.description/)
  assert.match(source, /Demonstration module — no functionality implemented/)
})
