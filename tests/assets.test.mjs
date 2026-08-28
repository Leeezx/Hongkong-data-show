import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import crypto from 'node:crypto'
import os from 'node:os'

const root = path.resolve(import.meta.dirname, '..')

function loadBrowserScript(relativePath) {
  const context = { window: {} }
  vm.createContext(context)
  vm.runInContext(fs.readFileSync(path.join(root, relativePath), 'utf8'), context)
  return context.window
}

function verifySourceDataIntegrity(projectRoot) {
  const sourceDir = path.join(projectRoot, '相关数据')
  if (!fs.existsSync(sourceDir)) {
    return { skipped: true, reason: 'source data directory 相关数据/ is unavailable in this workspace' }
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, 'tests/source-data.sha256.json'), 'utf8'))
  const sourcePaths = fs.readdirSync(sourceDir)
    .filter((name) => !name.startsWith('~$'))
    .map((name) => `相关数据/${name}`)
    .sort()
  assert.deepEqual(sourcePaths, Object.keys(manifest).sort(), 'source manifest must cover the complete baseline set')
  for (const [relativePath, expectedHash] of Object.entries(manifest)) {
    const filePath = path.join(projectRoot, relativePath)
    assert.equal(fs.existsSync(filePath), true, `${relativePath} is missing`)
    const actualHash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
    assert.equal(actualHash, expectedHash, `${relativePath} changed`)
  }
  return { skipped: false, fileCount: Object.keys(manifest).length }
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

test('classified PNGs have the expected dimensions and RGBA color type', () => {
  const expected = {
    'assets/wst.png': [764, 481],
    'assets/chla.png': [3666, 2317]
  }
  for (const [name, [width, height]] of Object.entries(expected)) {
    const png = fs.readFileSync(path.join(root, name))
    assert.deepEqual(Array.from(png.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10])
    assert.equal(png.readUInt32BE(16), width, `${name} width changed`)
    assert.equal(png.readUInt32BE(20), height, `${name} height changed`)
    assert.equal(png[24], 8, `${name} bit depth changed`)
    assert.equal(png[25], 6, `${name} must remain RGBA`)
  }
})

test('untracked source data matches the committed SHA-256 baseline when available', (t) => {
  const result = verifySourceDataIntegrity(root)
  if (result.skipped) t.skip(result.reason)
})

test('source-integrity verification reports a clear skip when source data is absent', () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hk-water-quality-'))
  try {
    assert.deepEqual(verifySourceDataIntegrity(fixtureRoot), {
      skipped: true,
      reason: 'source data directory 相关数据/ is unavailable in this workspace'
    })
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true })
  }
})
