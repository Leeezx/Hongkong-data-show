# No-Data Gray Raster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Regenerate the WST and Chlorophyll-a PNG overlays so every class-`0` pixel uses the reference gray RGBA `(232, 232, 232, 128)` instead of full transparency.

**Architecture:** Keep the existing build-time GDAL classification pipeline and static Leaflet runtime. Add a portable Node built-in PNG decoder only inside the asset test so the committed PNG bytes are verified directly without adding a runtime or development dependency.

**Tech Stack:** PowerShell, GDAL command-line tools, static RGBA PNG assets, Node.js built-in test runner and `node:zlib`.

## Global Constraints

- Use no-data color `#e8e8e8` with 50% per-pixel alpha: RGBA `(232, 232, 232, 128)`.
- Apply gray only to class `0`, which retains the existing definition of source no-data and values outside displayed class ranges.
- Keep all real data-class colors, thresholds, units, labels, geographic bounds, and legends unchanged.
- Do not add gray to the legend.
- Modify no files under `相关数据/`; existing SHA-256 source-integrity tests must pass.
- Regenerate only the expected raster assets `assets/wst.png` and `assets/chla.png`; metadata and vector data must remain semantically and byte-for-byte unchanged.
- Do not modify runtime HTML, CSS, JavaScript, Leaflet layer behavior, opacity behavior, navigation, timeline, Spatial Query, error handling, or automatic `fitBounds`.
- Variables without a dataset must continue to remove the raster and show `No sample data available` rather than showing a gray placeholder.
- Add no dependency or package manager.
- Follow TDD: add the asset tests first, observe the expected failure, then change the pipeline and regenerate assets.
- Work directly on `master`, as previously approved.
- Implementation and review subagents use `gpt-5.6-luna` with high reasoning effort, as requested by the user.

## File Structure

- `tests/assets.test.mjs` — decodes committed RGBA PNGs with Node built-ins and asserts the actual no-data pixel color and alpha.
- `scripts/prepare-data.ps1` — remains the single source of truth for both raster color-relief tables.
- `assets/wst.png` — regenerated WST classified raster.
- `assets/chla.png` — regenerated Chlorophyll-a classified raster.

---

### Task 1: Render class-zero pixels in reference gray

**Files:**
- Modify: `tests/assets.test.mjs`
- Modify: `scripts/prepare-data.ps1`
- Modify: `assets/wst.png`
- Modify: `assets/chla.png`

**Interfaces:**
- Consumes: existing GeoTIFF sources and class formulas in `scripts/prepare-data.ps1`.
- Produces: unchanged PNG dimensions/bounds and data colors, with class `0` encoded as RGBA `(232, 232, 232, 128)`.
- Produces: no runtime API or metadata changes.

- [ ] **Step 1: Add a portable RGBA PNG decoder to the asset test**

Add this import to `tests/assets.test.mjs`:

```javascript
import zlib from 'node:zlib'
```

Add these helpers after `verifySourceDataIntegrity`:

```javascript
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
```

- [ ] **Step 2: Write failing script and pixel assertions**

Append these tests to `tests/assets.test.mjs`:

```javascript
test('raster pipeline assigns the reference gray to both class-zero tables', () => {
  const script = fs.readFileSync(path.join(root, 'scripts/prepare-data.ps1'), 'utf8')
  assert.equal((script.match(/^0 232 232 232 128$/gm) ?? []).length, 2)
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
      if (red === 232 && green === 232 && blue === 232 && alpha === 128) grayPixels += 1
      if (alpha === 0) transparentPixels += 1
    }
    assert.ok(grayPixels > 0, `${name} must contain reference-gray no-data pixels`)
    assert.equal(transparentPixels, 0, `${name} class-zero pixels must not remain transparent`)
  }
})
```

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```powershell
& 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/assets.test.mjs
```

Expected: the two new tests FAIL because the script still declares `0 0 0 0 0`, both PNGs contain transparent pixels, and neither contains `(232,232,232,128)`. Existing asset and source-integrity tests remain passing.

- [ ] **Step 4: Change only the two class-zero color-table rows**

In `scripts/prepare-data.ps1`, replace both occurrences of:

```text
0 0 0 0 0
```

with:

```text
0 232 232 232 128
```

Do not change any other color row, formula, path, metadata block, or vector command.

- [ ] **Step 5: Regenerate the static assets**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-data.ps1
```

Expected: exit code `0`; `assets/wst.png` and `assets/chla.png` change. `assets/metadata.js` and `assets/map-data.js` must produce no Git diff. Temporary files remain under the ignored `scripts/.generated/` directory.

- [ ] **Step 6: Run the focused asset test and verify GREEN**

Run:

```powershell
& 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/assets.test.mjs
```

Expected: all asset tests PASS, including direct PNG checks for gray pixels and zero fully transparent pixels.

- [ ] **Step 7: Verify scope, source integrity, and the full suite**

Run:

```powershell
git diff --name-only
& 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/*.test.mjs
& 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check app.js
git diff --check
```

Expected:

- The relevant diff contains only `tests/assets.test.mjs`, `scripts/prepare-data.ps1`, `assets/wst.png`, and `assets/chla.png` in addition to already committed design/plan documents.
- Full suite reports 27 tests passed and 0 failed, including the existing source SHA-256 test.
- JavaScript syntax and diff checks exit `0`.

- [ ] **Step 8: Self-review and commit**

Confirm visually or through decoded pixel counts that gray occupies only the former transparent class-`0` areas and all data-class colors remain present. Confirm `git diff -- 相关数据` is empty. Then run:

```powershell
git add -- tests/assets.test.mjs scripts/prepare-data.ps1 assets/wst.png assets/chla.png
git commit -m "fix: render no-data pixels in gray"
```

Expected: one focused implementation commit; source TIFFs and runtime files remain untouched.
