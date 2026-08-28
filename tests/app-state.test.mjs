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
