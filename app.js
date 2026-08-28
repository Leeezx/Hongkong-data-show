(function (global) {
  'use strict'

  const SECTIONS = {
    environment: {
      title: 'Water Environment Data', defaultVariableId: 'wst',
      variables: [
        { id: 'water-storage', label: 'Water Extent / Water Level / Storage' },
        { id: 'wst', label: 'Water Surface Temperature', unit: '°C', datasetId: 'wst' },
        { id: 'chlorophyll-index', label: 'Chlorophyll Index', unit: 'NDCI' },
        { id: 'turbidity-index', label: 'Turbidity Index' },
        { id: 'sar-index', label: 'SAR Polarimetric Index' },
        { id: 'precipitation', label: 'Precipitation' },
        { id: 'air-temperature', label: 'Air Temperature' },
        { id: 'downwelling-radiation', label: 'Downwelling Radiation' }
      ]
    },
    historical: {
      title: 'Historical Water Quality', defaultVariableId: 'chla',
      variables: [
        { id: 'chla', label: 'Chlorophyll-a', unit: 'mg/m³', datasetId: 'chla' },
        { id: 'turbidity', label: 'Turbidity', unit: 'NTU' },
        { id: 'tss', label: 'Total Suspended Solids', unit: 'mg/L' },
        { id: 'total-phosphorus', label: 'Total Phosphorus' },
        { id: 'total-nitrogen', label: 'Total Nitrogen' }
      ]
    },
    forecasts: { title: 'Water Quality Forecasts', defaultVariableId: null, variables: [] },
    alerts: { title: 'Risk Alerts & Recommended Actions', defaultVariableId: null, variables: [] }
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

  const publicApi = { SECTIONS, createInitialState, getSection, selectSection, selectVariable, getActiveDataset }
  if (typeof module !== 'undefined' && module.exports) module.exports = publicApi
  global.HK_DEMO_APP = publicApi

  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => initialize(publicApi))

  function initialize(api) {
    const metadata = global.HK_DEMO_METADATA
    const mapData = global.HK_MAP_DATA
    const elements = {
      nav: document.getElementById('primary-nav'), dataView: document.getElementById('data-view'),
      placeholder: document.getElementById('placeholder-view'), sidebar: document.getElementById('sidebar'),
      layerList: document.getElementById('layer-list'), opacity: document.getElementById('opacity'),
      opacityValue: document.getElementById('opacity-value'), timelineLabel: document.getElementById('timeline-label'),
      description: document.getElementById('layer-description'), legend: document.getElementById('legend'),
      notice: document.getElementById('map-notice')
    }
    let state = api.createInitialState()
    let activeRaster = null

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
    L.geoJSON(mapData.administrative, {
      pane: 'administrative', style: { color: '#66717d', weight: 1.2, opacity: 0.8, fillOpacity: 0 }
    }).addTo(map)
    L.geoJSON(mapData.water, {
      pane: 'water', style: { color: '#4e7c91', weight: 0.8, opacity: 0.6, fillOpacity: 0 }
    }).addTo(map)
    map.fitBounds(metadata.mapBounds, { padding: [18, 18] })

    function showNotice(message) {
      elements.notice.textContent = message
      elements.notice.hidden = !message
    }

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
      const variable = api.getSection(state.sectionId).variables.find(({ id }) => id === state.variableId)
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
      const datasetId = api.getActiveDataset(state)
      if (!datasetId) {
        renderLegend(null)
        showNotice('No sample data available')
        return
      }
      const dataset = metadata.datasets[datasetId]
      showNotice('')
      activeRaster = L.imageOverlay(dataset.image, dataset.bounds, { pane: 'raster', opacity: state.opacity, interactive: false })
      activeRaster.on('error', () => { clearRaster(); renderLegend(null); showNotice('Sample layer could not be loaded') })
      activeRaster.addTo(map)
      renderLegend(datasetId)
    }

    function renderVariableList() {
      const section = api.getSection(state.sectionId)
      const fragment = document.createDocumentFragment()
      section.variables.forEach((variable) => {
        const label = document.createElement('label')
        label.className = `layer-item${variable.id === state.variableId ? ' is-active' : ''}`
        const radio = document.createElement('input')
        radio.type = 'radio'; radio.name = 'layer'; radio.value = variable.id; radio.checked = variable.id === state.variableId
        radio.addEventListener('change', () => { state = api.selectVariable(state, variable.id); render() })
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
      const variable = section.variables.find(({ id }) => id === state.variableId)
      elements.description.textContent = variable?.datasetId ? 'Single real sample dataset.' : 'Variable listed for interface demonstration; no sample raster is available.'
      elements.timelineLabel.textContent = 'Single time step'
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
  }
})(typeof window !== 'undefined' ? window : globalThis)
