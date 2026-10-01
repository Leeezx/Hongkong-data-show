import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import crypto from 'node:crypto'
import os from 'node:os'
import zlib from 'node:zlib'

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

function paethPredictor(a, b, c) {
  const estimate = a + b - c
  const distanceA = Math.abs(estimate - a)
  const distanceB = Math.abs(estimate - b)
  const distanceC = Math.abs(estimate - c)
  if (distanceA <= distanceB && distanceA <= distanceC) return a
  return distanceB <= distanceC ? b : c
}

function decodeRgbaPng(filePath) {
  const png = fs.readFileSync(filePath)
  assert.deepEqual(Array.from(png.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10])

  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let interlace = 0
  const compressed = []
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset)
    const type = png.toString('ascii', offset + 4, offset + 8)
    const data = png.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
      interlace = data[12]
    } else if (type === 'IDAT') {
      compressed.push(data)
    }
    offset += length + 12
  }

  assert.equal(bitDepth, 8, `${filePath} must use 8-bit channels`)
  assert.equal(colorType, 6, `${filePath} must use RGBA color type`)
  assert.equal(interlace, 0, `${filePath} must remain non-interlaced`)

  const bytesPerPixel = 4
  const rowLength = width * bytesPerPixel
  const filtered = zlib.inflateSync(Buffer.concat(compressed))
  const pixels = Buffer.alloc(width * height * bytesPerPixel)
  let inputOffset = 0

  for (let y = 0; y < height; y += 1) {
    const filter = filtered[inputOffset]
    inputOffset += 1
    const rowOffset = y * rowLength
    for (let x = 0; x < rowLength; x += 1) {
      const encoded = filtered[inputOffset]
      inputOffset += 1
      const left = x >= bytesPerPixel ? pixels[rowOffset + x - bytesPerPixel] : 0
      const up = y > 0 ? pixels[rowOffset - rowLength + x] : 0
      const upLeft = y > 0 && x >= bytesPerPixel ? pixels[rowOffset - rowLength + x - bytesPerPixel] : 0
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? up
            : filter === 3 ? Math.floor((left + up) / 2)
              : filter === 4 ? paethPredictor(left, up, upLeft)
                : null
      assert.notEqual(predictor, null, `${filePath} uses unsupported PNG filter ${filter}`)
      pixels[rowOffset + x] = (encoded + predictor) & 0xff
    }
  }

  return { width, height, pixels }
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

test('raster pipeline assigns the reference gray to both class-zero tables', () => {
  const script = fs.readFileSync(path.join(root, 'scripts/prepare-data.ps1'), 'utf8')
  assert.equal((script.match(/^0 232 232 232 180$/gm) ?? []).length, 2)
  assert.doesNotMatch(script, /^0 0 0 0 0$/m)
})

test('classified PNGs encode no-data pixels as semi-transparent reference gray', () => {
  for (const name of ['assets/wst.png', 'assets/chla.png']) {
    const { pixels } = decodeRgbaPng(path.join(root, name))
    let grayPixels = 0
    let transparentPixels = 0
    for (let offset = 0; offset < pixels.length; offset += 4) {
      const red = pixels[offset]
      const green = pixels[offset + 1]
      const blue = pixels[offset + 2]
      const alpha = pixels[offset + 3]
      if (red === 232 && green === 232 && blue === 232 && alpha === 180) grayPixels += 1
      if (alpha === 0) transparentPixels += 1
    }
    assert.ok(grayPixels > 0, `${name} must contain reference-gray no-data pixels`)
    assert.equal(transparentPixels, 0, `${name} class-zero pixels must not remain transparent`)
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
