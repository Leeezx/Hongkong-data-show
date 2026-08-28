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

test('vector overlays use panes above the raster pane', () => {
  assert.match(source, /map\.createPane\(['"]raster['"]\)/)
  assert.match(source, /map\.createPane\(['"]administrative['"]\)/)
  assert.match(source, /map\.createPane\(['"]water['"]\)/)
  assert.match(source, /rasterPane\.style\.zIndex\s*=\s*['"]400['"]\s*$/m)
  assert.match(source, /administrativePane\.style\.zIndex\s*=\s*['"]500['"]\s*$/m)
  assert.match(source, /waterPane\.style\.zIndex\s*=\s*['"]600['"]\s*$/m)
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
