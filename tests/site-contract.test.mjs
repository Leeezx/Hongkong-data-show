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

test('opacity range control has a programmatic accessible label', () => {
  assert.match(html, /<label[^>]+for=["']opacity["'][^>]*>[^<]*Opacity/i)
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

test('README documents double-click and offline behavior', () => {
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8')
  assert.match(readme, /double-click `index\.html`/i)
  assert.match(readme, /offline/i)
  assert.match(readme, /No installation/i)
})
