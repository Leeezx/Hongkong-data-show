(function (global) {
  'use strict'

  const FALLBACK_MAP_BOUNDS = [[22.1367246, 113.8172408], [22.5683333, 114.5024867]]

  const SECTIONS = {
    environment: {
      title: 'Water Environment Data', defaultVariableId: 'wst',
      variables: [
        { id: 'water-storage', label: 'Water Extent / Water Level / Storage', datasetId: 'water-extent' },
        { id: 'wst', label: 'Water Surface Temperature', unit: '°C', datasetId: 'wst' },
        { id: 'chlorophyll-index', label: 'Chlorophyll Index', unit: 'NDCI', datasetId: 'chal-index' },
        { id: 'turbidity-index', label: 'Turbidity Index' },
        { id: 'sar-index', label: 'SAR Polarimetric Index', datasetId: 'vv-vh' },
        { id: 'precipitation', label: 'Precipitation', unit: 'mm/day', datasetId: 'pr' },
        { id: 'air-temperature', label: 'Air Temperature', unit: '°C', datasetId: 'air-temperature' },
        { id: 'downwelling-radiation', label: 'Downwelling Radiation', unit: 'W/m²', datasetId: 'srad' }
      ]
    },
    historical: {
      title: 'Historical Water Quality', defaultVariableId: 'chla',
      variables: [
        { id: 'chla', label: 'Chlorophyll-a', unit: 'mg/m³', datasetId: 'hist-chla' },
        { id: 'turbidity', label: 'Turbidity', unit: 'NTU', datasetId: 'hist-turbidity' },
        { id: 'tss', label: 'Total Suspended Solids', unit: 'mg/L', datasetId: 'hist-tss' },
        { id: 'total-phosphorus', label: 'Total Phosphorus', unit: 'mg/L', datasetId: 'hist-total-phosphorus' },
        { id: 'total-nitrogen', label: 'Total Nitrogen', unit: 'mg/L', datasetId: 'hist-total-nitrogen' }
      ]
    },
    forecasts: {
      title: 'Water Quality Forecasts', defaultVariableId: 'chla',
      variables: [
        { id: 'chla', label: 'Chlorophyll-a', unit: 'mg/m³', datasetId: 'forecast-chla' },
        { id: 'turbidity', label: 'Turbidity', unit: 'NTU', datasetId: 'forecast-turbidity' },
        { id: 'tss', label: 'Total Suspended Solids', unit: 'mg/L', datasetId: 'forecast-tss' },
        { id: 'total-phosphorus', label: 'Total Phosphorus', unit: 'mg/L', datasetId: 'forecast-total-phosphorus' },
        { id: 'total-nitrogen', label: 'Total Nitrogen', unit: 'mg/L', datasetId: 'forecast-total-nitrogen' }
      ]
    },
    alerts: { title: 'Risk Alerts & Recommended Actions', defaultVariableId: 'risk', variables: [
      { id: 'risk', label: 'Hong Kong Risk Map', unit: '—', datasetId: 'risk' }
    ] }
  }

  const createInitialState = () => ({ sectionId: 'environment', variableId: 'wst', opacity: 0.75 })
  const getSection = (sectionId) => SECTIONS[sectionId]
  const selectSection = (state, sectionId) => {
    const section = getSection(sectionId)
    if (!section) return state
    return { ...state, sectionId, variableId: section.defaultVariableId }
  }
  const selectVariable = (state, variableId) => {
    const section = getSection(state.sectionId)
    return section.variables.some(({ id }) => id === variableId) ? { ...state, variableId } : state
  }
  const getActiveDataset = (state) => {
    const variable = getSection(state.sectionId)?.variables.find(({ id }) => id === state.variableId)
    return variable?.datasetId ?? null
  }

  const isBounds = (value) => Array.isArray(value) && value.length === 2 && value.every((point) => (
    Array.isArray(point) && point.length === 2 && point.every((coordinate) => Number.isFinite(coordinate))
  ))

  const isDataset = (value) => Boolean(
    value && typeof value === 'object' && typeof value.image === 'string' && value.image.length > 0 &&
    typeof value.unit === 'string' && isBounds(value.bounds) &&
    Array.isArray(value.breaks) && value.breaks.every((entry) => Number.isFinite(entry)) &&
    Array.isArray(value.labels) && Array.isArray(value.colors) &&
    value.labels.length > 0 && value.labels.length === value.colors.length
  )

  const normalizeMetadata = (rawMetadata) => {
    const source = rawMetadata && typeof rawMetadata === 'object' ? rawMetadata : {}
    const datasets = {}
    if (source.datasets && typeof source.datasets === 'object') {
      for (const [datasetId, dataset] of Object.entries(source.datasets)) {
        if (isDataset(dataset)) datasets[datasetId] = dataset
      }
    }
    return {
      mapBounds: isBounds(source.mapBounds)
        ? source.mapBounds
        : FALLBACK_MAP_BOUNDS.map((point) => point.slice()),
      datasets
    }
  }

  const publicApi = { SECTIONS, createInitialState, getSection, selectSection, selectVariable, getActiveDataset, normalizeMetadata }
  if (typeof module !== 'undefined' && module.exports) module.exports = publicApi
  global.HK_DEMO_APP = publicApi

  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => {
    initializeVisitCounter()
    initialize(publicApi)
  })

  function initializeVisitCounter() {
    const valueElement = document.getElementById('site-counter-value')
    if (!valueElement) return

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    fetch('https://lzx.goatcounter.com/counter/TOTAL.json', {
      mode: 'cors', cache: 'no-store', signal: controller.signal
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Counter request failed: ${response.status}`)
        return response.json()
      })
      .then((data) => {
        const count = data && (typeof data.count === 'string' || typeof data.count === 'number')
          ? String(data.count)
          : ''
        if (!count) throw new Error('Counter response did not contain a count')
        valueElement.textContent = count
      })
      .catch(() => {
        valueElement.textContent = '暂不可用'
      })
      .finally(() => clearTimeout(timeoutId))
  }

  function initialize(api) {
    const rawMetadata = {
      ...(global.HK_DEMO_METADATA || {}),
      datasets: { ...(global.HK_DEMO_METADATA?.datasets || {}), ...(global.HK_MATERIAL_METADATA || {}) }
    }
    const metadata = api.normalizeMetadata(rawMetadata)
    const mapData = global.HK_MAP_DATA
    const metadataWarning = !rawMetadata || typeof rawMetadata !== 'object' ||
      !isBounds(rawMetadata.mapBounds) || !rawMetadata.datasets || typeof rawMetadata.datasets !== 'object'
    const elements = {
      nav: document.getElementById('primary-nav'), dataView: document.getElementById('data-view'),
      placeholder: document.getElementById('placeholder-view'), sidebar: document.getElementById('sidebar'),
      layerList: document.getElementById('layer-list'), opacity: document.getElementById('opacity'),
      opacityValue: document.getElementById('opacity-value'), timelineLabel: document.getElementById('timeline-label'),
      legend: document.getElementById('legend'),
      notice: document.getElementById('map-notice')
    }
    let state = api.createInitialState()
    let activeRaster = null
    let vectorDataWarning = false
    const dynamicLayers = { environment: [], historical: [], forecasts: [], alerts: [] }
    const variablesFor = (sectionId) => [
      ...api.getSection(sectionId).variables,
      ...(dynamicLayers[sectionId] || [])
    ]
    const activeDataset = () => variablesFor(state.sectionId)
      .find(({ id }) => id === state.variableId)?.datasetId ?? null
    const selectVariable = (nextState, variableId) => (
      variablesFor(nextState.sectionId).some(({ id }) => id === variableId)
        ? { ...nextState, variableId }
        : nextState
    )
    function mergeServerLayers(serverLayers) {
      serverLayers.forEach((layer) => {
        metadata.datasets[layer.id] = {
          ...layer,
          image: layer.image || `/api/layers/${layer.id}/preview`,
          tileTemplate: layer.tileTemplate || `/api/tiles/${layer.id}/{z}/{x}/{y}.png`
        }
        if (layer.source === 'upload' && !dynamicLayers[layer.section].some(({ id }) => id === layer.id)) {
          dynamicLayers[layer.section].push({ id: layer.id, label: layer.name, unit: layer.unit, datasetId: layer.id })
        }
      })
    }

    const map = L.map('map', { zoomControl: true, attributionControl: true })
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri', maxZoom: 18
    }).addTo(map)

    const rasterPane = map.createPane('raster')
    rasterPane.style.zIndex = '400'
    const administrativePane = map.createPane('administrative')
    administrativePane.style.zIndex = '500'
    const waterPane = map.createPane('water')
    waterPane.style.zIndex = '600'

    function showNotice(message) {
      const visibleMessage = message || (vectorDataWarning ? 'Map boundary overlays unavailable' : '') ||
        (metadataWarning ? 'Sample metadata unavailable; using fallback map extent' : '')
      elements.notice.textContent = visibleMessage
      elements.notice.hidden = !visibleMessage
    }

    function isFeatureCollection(value) {
      return Boolean(value && value.type === 'FeatureCollection' && Array.isArray(value.features))
    }

    if (isFeatureCollection(mapData?.administrative)) {
      try {
        L.geoJSON(mapData.administrative, {
          pane: 'administrative', style: { color: '#66717d', weight: 1.2, opacity: 0.8, fillOpacity: 0 }
        }).addTo(map)
      } catch {
        vectorDataWarning = true
      }
    } else {
      vectorDataWarning = true
    }
    if (isFeatureCollection(mapData?.water)) {
      try {
        L.geoJSON(mapData.water, {
          pane: 'water', style: { color: '#4e7c91', weight: 0.8, opacity: 0.6, fillOpacity: 0 }
        }).addTo(map)
      } catch {
        vectorDataWarning = true
      }
    } else {
      vectorDataWarning = true
    }
    map.fitBounds(metadata.mapBounds, { padding: [18, 18] })

    function clearRaster() {
      if (activeRaster) {
        activeRaster.remove()
        activeRaster = null
      }
    }

    function renderLegend(datasetId) {
      const dataset = metadata.datasets[datasetId]
      if (!dataset) {
        elements.legend.hidden = true
        elements.legend.replaceChildren()
        return
      }
      const variable = variablesFor(state.sectionId).find(({ id }) => id === state.variableId)
      const title = document.createElement('h3')
      title.textContent = `${variable.label} (${dataset.unit})`
      const fragment = document.createDocumentFragment()
      fragment.append(title)
      dataset.labels.forEach((label, index) => {
        const row = document.createElement('div')
        row.className = 'legend-item'
        const swatch = document.createElement('span')
        swatch.className = 'legend-swatch'
        swatch.style.backgroundColor = dataset.colors[index]
        const copy = document.createElement('span')
        copy.textContent = label
        row.append(swatch, copy)
        fragment.append(row)
      })
      elements.legend.replaceChildren(fragment)
      elements.legend.hidden = false
    }

    function renderMapData() {
      clearRaster()
      const datasetId = activeDataset()
      if (!datasetId) {
        renderLegend(null)
        showNotice('No sample data available')
        return
      }
      const dataset = metadata.datasets[datasetId]
      if (!dataset) {
        renderLegend(null)
        showNotice('Sample layer could not be loaded')
        return
      }
      showNotice('')
      map.fitBounds(dataset.bounds || metadata.mapBounds, { padding: [18, 18] })
      const raster = dataset.tileTemplate
        ? L.tileLayer(dataset.tileTemplate, { pane: 'raster', opacity: state.opacity, minZoom: 0, maxZoom: 22, maxNativeZoom: 18 })
        : L.imageOverlay(dataset.image, dataset.bounds, { pane: 'raster', opacity: state.opacity, interactive: false })
      activeRaster = raster
      raster.on('error tileerror', () => {
        if (activeRaster !== raster) return
        clearRaster()
        renderLegend(null)
        showNotice('Sample layer could not be loaded')
      })
      raster.addTo(map)
      renderLegend(datasetId)
    }

    function renderVariableList() {
      const section = api.getSection(state.sectionId)
      const fragment = document.createDocumentFragment()
      variablesFor(state.sectionId).forEach((variable) => {
        const label = document.createElement('label')
        label.className = `layer-item${variable.id === state.variableId ? ' is-active' : ''}`
        const radio = document.createElement('input')
        radio.type = 'radio'; radio.name = 'layer'; radio.value = variable.id; radio.checked = variable.id === state.variableId
        radio.addEventListener('change', () => { state = selectVariable(state, variable.id); render() })
        const name = document.createElement('span'); name.textContent = variable.label
        label.append(radio, name)
        if (variable.unit) { const unit = document.createElement('span'); unit.className = 'layer-unit'; unit.textContent = `(${variable.unit})`; label.append(unit) }
        fragment.append(label)
      })
      elements.layerList.replaceChildren(fragment)
    }

    function render() {
      const section = api.getSection(state.sectionId)
      const functional = section.variables.length > 0
      elements.dataView.hidden = !functional
      elements.placeholder.hidden = functional
      elements.nav.querySelectorAll('[data-section]').forEach((button) => button.classList.toggle('is-active', button.dataset.section === state.sectionId))
      if (!functional) {
        clearRaster()
        elements.placeholder.querySelector('h2').textContent = section.title
        elements.placeholder.querySelector('p').textContent = 'Demonstration module — no functionality implemented'
        return
      }
      renderVariableList()
      elements.timelineLabel.textContent = '2016-01-01'
      elements.opacity.value = String(state.opacity)
      elements.opacityValue.value = `${Math.round(state.opacity * 100)}%`
      map.invalidateSize()
      map.fitBounds(metadata.mapBounds, { padding: [18, 18] })
      renderMapData()
    }

    elements.nav.addEventListener('click', (event) => {
      const button = event.target.closest('[data-section]')
      if (!button) return
      state = api.selectSection(state, button.dataset.section)
      render()
    })
    elements.opacity.addEventListener('input', () => {
      state = { ...state, opacity: Number(elements.opacity.value) }
      elements.opacityValue.value = `${Math.round(state.opacity * 100)}%`
      if (activeRaster) activeRaster.setOpacity(state.opacity)
    })
    window.addEventListener('resize', () => map.invalidateSize())
    render()
    fetch('/api/layers')
      .then((response) => response.ok ? response.json() : [])
      .then((serverLayers) => { mergeServerLayers(serverLayers); render() })
      .catch(() => { /* Direct file opening keeps the bundled static fallback. */ })
  }
})(typeof window !== 'undefined' ? window : globalThis)
