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

  function initialize(api) { void api }
})(typeof window !== 'undefined' ? window : globalThis)
