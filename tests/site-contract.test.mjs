import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8')
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8')

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

test('dynamic layer discovery is wired to the local API', () => {
  assert.match(app, /fetch\('\/api\/layers'\)/)
  assert.doesNotMatch(html, /upload-form|upload-file|Upload Raster Data/)
})

test('material metadata is loaded for all four data sections', () => {
  assert.match(html, /assets\/material\/metadata\.js/)
  for (const id of ['water-extent', 'hist-chla', 'forecast-chla', 'risk']) assert.match(app, new RegExp(id))
})

test('analytics and public visit counter are configured', () => {
  assert.match(html, /href=["']styles\.css\?v=[^"']+["']/)
  assert.match(html, /src=["']app\.js\?v=[^"']+["']/)
  assert.match(html, /googletagmanager\.com\/gtag\/js\?id=G-V28SBMMNE7/)
  assert.match(html, /gtag\(['"]config['"],\s*['"]G-V28SBMMNE7['"]\)/)
  assert.match(html, /data-goatcounter=["']https:\/\/lzx\.goatcounter\.com\/count["']/)
  assert.match(html, /id=["']site-counter-value["']/)
  assert.match(app, /counter\/TOTAL\.json/)
  assert.match(app, /AbortController/)
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

test('timeline controls are enabled no-op presentation controls for the fixed sample date', () => {
  const timelineSection = html.match(/<section class="sidebar-section"><h2>Timeline<\/h2>[\s\S]*?<\/section>/)?.[0]
  assert.ok(timelineSection)
  assert.match(timelineSection, /id="timeline-label"[^>]*>2016-01-01<\/div>/)
  assert.doesNotMatch(timelineSection, /\sdisabled(?:\s|>)/)
  assert.match(timelineSection, /aria-label="Previous time step"/)
  assert.match(timelineSection, /aria-label="Next time step"/)
  assert.match(timelineSection, />▶ Play<\/button>/)
  assert.match(css, /\.timeline button[^}]*cursor:\s*pointer/s)
  assert.match(css, /\.timeline button:hover/)
  assert.match(css, /\.timeline button:focus-visible/)
})

test('spatial query looks available while layer information is absent', () => {
  const querySection = html.match(/<section class="sidebar-section"><h2>Spatial Query<\/h2>[\s\S]*?<\/section>/)?.[0]
  assert.ok(querySection)
  assert.match(querySection, /Click the map to query pixel values; hold Shift and drag to select an area\./)
  assert.doesNotMatch(querySection, /is-disabled|aria-disabled/)
  assert.doesNotMatch(html, /Layer Information|layer-description/)
  assert.doesNotMatch(css, /\.sidebar-section\.is-disabled/)
})
