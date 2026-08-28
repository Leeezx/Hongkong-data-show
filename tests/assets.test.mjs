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
