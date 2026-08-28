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

test('missing metadata falls back to the known Hong Kong extent', () => {
  const normalized = app.normalizeMetadata(undefined)
  assert.deepEqual(normalized.mapBounds, [[22.1367246, 113.8172408], [22.5683333, 114.5024867]])
  assert.deepEqual(normalized.datasets, {})
})

test('malformed dataset entries are ignored while valid entries remain usable', () => {
  const normalized = app.normalizeMetadata({
    mapBounds: [[1, 2], [3, 4]],
    datasets: {
      wst: { image: 'assets/wst.png' },
      chla: {
        image: 'assets/chla.png', unit: 'mg/m³', bounds: [[1, 2], [3, 4]],
        breaks: [0, 1], labels: ['0–1'], colors: ['#fff']
      }
    }
  })
  assert.equal(normalized.datasets.wst, undefined)
  assert.equal(normalized.datasets.chla.image, 'assets/chla.png')
})

test('a missing dataset entry is safe to request after metadata normalization', () => {
  const normalized = app.normalizeMetadata({
    mapBounds: [[1, 2], [3, 4]],
    datasets: { chla: { image: 'assets/chla.png', unit: 'mg/m³', bounds: [[1, 2], [3, 4]], breaks: [0, 1], labels: ['0–1'], colors: ['#fff'] } }
  })
  assert.equal(normalized.datasets.wst, undefined)
})
