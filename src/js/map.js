// Mapa (Mapbox GL): warstwy stacji, obszarów obsługi, gęstości i zaznaczenia.
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MAPBOX_TOKEN, MAP_STYLES, MAP_CENTER, MAP_ZOOM, NETWORK_TYPES, OTHER_TYPE, typeInfo } from './config.js'
import { formatFrequency } from './format.js'
import { state, emit } from './store.js'
import { stationByUid } from './data.js'

// Kolory interfejsu mapy (paleta wykresów: powierzchnia, tusz, akcent, skala sekwencyjna).
const THEME = {
    light: {
        surface: '#fcfcfb', ink: '#0b0b0b', ink2: '#52514e', muted: '#898781', accent: '#2a78d6',
        heat: ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b']
    },
    dark: {
        surface: '#1a1a19', ink: '#ffffff', ink2: '#c3c2b7', muted: '#898781', accent: '#3987e5',
        heat: ['#104281', '#184f95', '#256abf', '#3987e5', '#6da7ec', '#9ec5f4', '#cde2fb']
    }
}

const EMPTY = { type: 'FeatureCollection', features: [] }
const COVERAGE_LIMIT = 8000
const LONG_PRESS_MS = 600

let map = null
let ready = false
let stationData = EMPTY
let coverageData = EMPTY
let selectionData = EMPTY
let hoverUid = null
let selectedUid = null
let probeMarker = null
let pickingProbe = false
let popup = null

const colors = () => THEME[state.theme]

function typeColorExpression() {
    const theme = state.theme
    const expression = ['match', ['get', 't']]
    for (const type of NETWORK_TYPES) expression.push(type.code, type[theme])
    expression.push(OTHER_TYPE[theme])
    return expression
}

const isState = name => ['boolean', ['feature-state', name], false]

function addLayers() {
    const theme = colors()
    const firstSymbol = map.getStyle().layers.find(layer => layer.type === 'symbol')?.id

    map.addSource('stations', { type: 'geojson', data: stationData })
    map.addSource('coverage', { type: 'geojson', data: coverageData })
    map.addSource('selection', { type: 'geojson', data: selectionData })

    map.addLayer({
        id: 'coverage-fill',
        type: 'fill',
        source: 'coverage',
        layout: { visibility: state.layers.coverage ? 'visible' : 'none' },
        paint: { 'fill-color': theme.accent, 'fill-opacity': 0.07 }
    }, firstSymbol)
    map.addLayer({
        id: 'coverage-line',
        type: 'line',
        source: 'coverage',
        minzoom: 8,
        layout: { visibility: state.layers.coverage ? 'visible' : 'none' },
        paint: { 'line-color': theme.accent, 'line-opacity': 0.35, 'line-width': 0.75 }
    }, firstSymbol)
    map.addLayer({
        id: 'station-heat',
        type: 'heatmap',
        source: 'stations',
        maxzoom: 13,
        layout: { visibility: state.layers.heat ? 'visible' : 'none' },
        paint: {
            'heatmap-weight': 1,
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 12, 2],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 4, 6, 8, 14, 12, 24],
            'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
                0, 'rgba(0,0,0,0)', 0.05, theme.heat[0], 0.2, theme.heat[1], 0.35, theme.heat[2], 0.5, theme.heat[3],
                0.65, theme.heat[4], 0.8, theme.heat[5], 1, theme.heat[6]],
            'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.8, 13, 0]
        }
    }, firstSymbol)
    map.addLayer({
        id: 'selection-fill',
        type: 'fill',
        source: 'selection',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.12 }
    })
    map.addLayer({
        id: 'selection-line',
        type: 'line',
        source: 'selection',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'line-color': ['get', 'color'], 'line-width': 2 }
    })

    const removed = ['==', ['get', 'x'], 1]
    const strokeWidth = base => ['case',
        isState('selected'), 3,
        isState('hover'), 2.5,
        removed, 1.5,
        base]
    map.addLayer({
        id: 'stations',
        type: 'circle',
        source: 'stations',
        paint: {
            'circle-color': ['case', removed, theme.surface, typeColorExpression()],
            'circle-radius': ['interpolate', ['linear'], ['zoom'],
                4, ['case', isState('selected'), 5, 1.8],
                7, ['case', isState('selected'), 6, 3],
                10, ['case', isState('selected'), 8, 5],
                14, ['case', isState('selected'), 11, 8]],
            'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 4, strokeWidth(0.4), 10, strokeWidth(1)],
            'circle-stroke-color': ['case',
                ['any', isState('selected'), isState('hover')], theme.ink,
                removed, theme.muted,
                theme.surface],
            'circle-opacity': 0.92
        }
    })
    // Zaznaczona stacja jest widoczna także wtedy, gdy filtry ją ukrywają.
    map.addLayer({
        id: 'selection-point',
        type: 'circle',
        source: 'selection',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
            'circle-color': ['get', 'color'],
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 5, 10, 8, 14, 11],
            'circle-stroke-width': 3,
            'circle-stroke-color': theme.ink
        }
    })
    map.addLayer({
        id: 'station-labels',
        type: 'symbol',
        source: 'stations',
        minzoom: 12,
        layout: {
            visibility: state.layers.labels ? 'visible' : 'none',
            'text-field': ['step', ['zoom'], ['get', 'f'], 14,
                ['format', ['get', 'f'], {}, '\n', {}, ['get', 'o'], { 'font-scale': 0.85 }]],
            'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
            'text-size': 11,
            'text-offset': [0, 0.9],
            'text-anchor': 'top',
            'text-max-width': 12
        },
        paint: { 'text-color': theme.ink2, 'text-halo-color': theme.surface, 'text-halo-width': 1.5 }
    })
    ready = true
    applyFeatureStates()
}

function setFeatureState(uid, key, value) {
    if (!ready || uid === null || uid === undefined) return
    map.setFeatureState({ source: 'stations', id: uid }, { [key]: value })
}

function applyFeatureStates() {
    setFeatureState(selectedUid, 'selected', true)
    setFeatureState(hoverUid, 'hover', true)
}

// Skrócona nazwa operatora do etykiety na mapie.
function shortName(name) {
    const short = name.replace(/\b(spółka z ograniczoną odpowiedzialnością|sp\. ?z ?o\. ?o\.?|s\.a\.|spółka akcyjna)\b/gi, '').trim()
    return short.length > 28 ? `${short.slice(0, 27)}…` : short
}

function toFeatures(stations) {
    const features = []
    for (const station of stations) {
        if (station.lat === null || station.lat === undefined) continue
        features.push({
            type: 'Feature',
            id: station.uid,
            geometry: { type: 'Point', coordinates: [station.lon, station.lat] },
            properties: {
                t: station.type,
                x: station.removed ? 1 : 0,
                f: station.tx.length ? formatFrequency(station.tx[0]) + (station.tx.length > 1 ? ' …' : '') : '',
                o: shortName(station.operator.name)
            }
        })
    }
    return { type: 'FeatureCollection', features }
}

// Wielokąt koła o promieniu w km (przybliżenie wystarczające do skali kraju).
export function circlePolygon(lon, lat, radiusKm, steps = 40) {
    const coordinates = []
    const dLat = radiusKm / 111.32
    const dLon = radiusKm / (111.32 * Math.cos(lat * Math.PI / 180))
    for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * 2 * Math.PI
        coordinates.push([lon + dLon * Math.cos(angle), lat + dLat * Math.sin(angle)])
    }
    return coordinates
}

export function initMap(container) {
    mapboxgl.accessToken = MAPBOX_TOKEN
    try {
        map = new mapboxgl.Map({
            container,
            style: MAP_STYLES[state.theme],
            projection: 'mercator',
            hash: true,
            center: MAP_CENTER,
            zoom: MAP_ZOOM,
            minZoom: 3,
            attributionControl: true
        })
    } catch (error) {
        console.error(error)
        container.classList.add('map-error')
        container.textContent = 'Mapa nie działa w tej przeglądarce (wymagany WebGL). Lista stacji, wyszukiwarka i analizy działają.'
        return null
    }

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), 'top-right')
    map.addControl(new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true
    }), 'top-right')
    map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-right')

    popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 10, className: 'station-popup' })

    map.on('style.load', () => {
        addLayers()
        if (!state.mapReady) {
            state.mapReady = true
            emit('map:ready')
        } else {
            emit('map:style')
        }
    })
    map.on('moveend', () => emit('map:move'))

    const canHover = window.matchMedia('(hover: hover)').matches
    map.on('mousemove', 'stations', event => {
        map.getCanvas().style.cursor = pickingProbe ? 'crosshair' : 'pointer'
        const uid = event.features[0]?.id
        if (uid === undefined || uid === hoverUid) return
        setHover(uid)
        const station = stationByUid(uid)
        if (station && canHover) showPopup(station, event.features[0].geometry.coordinates)
    })
    map.on('mouseleave', 'stations', () => {
        map.getCanvas().style.cursor = pickingProbe ? 'crosshair' : ''
        setHover(null)
        popup.remove()
    })

    map.on('click', event => {
        if (pickingProbe) {
            stopProbePick()
            emit('probe', event.lngLat)
            return
        }
        const { x, y } = event.point
        const features = ready ? map.queryRenderedFeatures([[x - 6, y - 6], [x + 6, y + 6]], { layers: ['stations'] }) : []
        const stations = [...new Set(features.map(feature => feature.id))].map(stationByUid).filter(Boolean)
        if (stations.length === 1) emit('station:open', stations[0])
        else if (stations.length > 1) emit('pick', { stations, lngLat: event.lngLat })
    })
    map.on('contextmenu', event => emit('probe', event.lngLat))

    // Długie przytrzymanie na ekranie dotykowym: sprawdzenie punktu.
    let pressTimer = null
    const cancelPress = () => clearTimeout(pressTimer)
    map.on('touchstart', event => {
        cancelPress()
        if (event.originalEvent.touches.length !== 1) return
        pressTimer = setTimeout(() => emit('probe', event.lngLat), LONG_PRESS_MS)
    })
    for (const type of ['touchend', 'touchcancel', 'touchmove', 'movestart']) map.on(type, cancelPress)
    return map
}

function showPopup(station, coordinates) {
    const element = document.createElement('div')
    const title = document.createElement('strong')
    title.textContent = station.operator.name
    const details = document.createElement('div')
    const frequencies = station.tx.slice(0, 3).map(formatFrequency).join(', ') + (station.tx.length > 3 ? ` (+${station.tx.length - 3})` : '')
    details.textContent = `${typeInfo(station.type).name} · ${frequencies || 'brak częstotliwości'} MHz`
    if (station.removed) details.textContent += ' · usunięta'
    element.append(title, details)
    popup.setLngLat(coordinates).setDOMContent(element).addTo(map)
}

export function setTheme(theme) {
    if (theme === state.theme) return
    state.theme = theme
    if (!map) return
    ready = false
    popup?.remove()
    // Bez porównywania stylów: mapa wczytuje styl od nowa i zgłasza "style.load", więc warstwy wracają.
    map.setStyle(MAP_STYLES[theme], { diff: false })
}

export function setStations(stations) {
    stationData = toFeatures(stations)
    if (ready) map.getSource('stations').setData(stationData)
    applyFeatureStates()
}

// Obszary obsługi (koła o promieniu z pozwolenia). Zwraca liczbę narysowanych obszarów.
export function setCoverage(stations) {
    let list = stations.filter(station => station.lat !== null && station.radius > 0)
    const total = list.length
    if (list.length > COVERAGE_LIMIT) {
        const center = map ? map.getCenter() : { lng: MAP_CENTER[0], lat: MAP_CENTER[1] }
        const distance = station => (station.lat - center.lat) ** 2 + ((station.lon - center.lng) * 0.62) ** 2
        list = list.map(station => [distance(station), station]).sort((a, b) => a[0] - b[0])
            .slice(0, COVERAGE_LIMIT).map(item => item[1])
    }
    coverageData = {
        type: 'FeatureCollection',
        features: list.map(station => ({
            type: 'Feature',
            properties: {},
            geometry: { type: 'Polygon', coordinates: [circlePolygon(station.lon, station.lat, station.radius, 32)] }
        }))
    }
    if (ready) map.getSource('coverage').setData(coverageData)
    return { shown: list.length, total }
}

export function clearCoverage() {
    coverageData = EMPTY
    if (ready) map.getSource('coverage').setData(coverageData)
}

export function setLayerVisibility(name, visible) {
    state.layers[name] = visible
    if (!ready) return
    const layers = { coverage: ['coverage-fill', 'coverage-line'], heat: ['station-heat'], labels: ['station-labels'] }[name]
    for (const id of layers) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
}

export function setHover(uid) {
    if (hoverUid === uid) return
    if (hoverUid !== null) setFeatureState(hoverUid, 'hover', false)
    hoverUid = uid
    if (uid !== null) setFeatureState(uid, 'hover', true)
}

// Zaznaczona stacja: obwódka i obszar obsługi.
export function setSelection(station) {
    if (selectedUid !== null) setFeatureState(selectedUid, 'selected', false)
    selectedUid = station ? station.uid : null
    if (station) setFeatureState(station.uid, 'selected', true)
    const features = []
    if (station && station.lat !== null) {
        const color = station.removed ? colors().muted : typeInfo(station.type)[state.theme]
        if (station.radius > 0) {
            features.push({
                type: 'Feature',
                properties: { color },
                geometry: { type: 'Polygon', coordinates: [circlePolygon(station.lon, station.lat, station.radius)] }
            })
        }
        features.push({ type: 'Feature', properties: { color }, geometry: { type: 'Point', coordinates: [station.lon, station.lat] } })
    }
    selectionData = { type: 'FeatureCollection', features }
    if (ready) map.getSource('selection').setData(selectionData)
}

export function showProbe(lngLat) {
    if (!map) return
    if (!probeMarker) {
        const element = document.createElement('div')
        element.className = 'probe-marker'
        probeMarker = new mapboxgl.Marker({ element })
    }
    probeMarker.setLngLat(lngLat).addTo(map)
}

export function clearProbe() {
    probeMarker?.remove()
}

export function startProbePick() {
    pickingProbe = true
    if (map) map.getCanvas().style.cursor = 'crosshair'
}

export function stopProbePick() {
    pickingProbe = false
    if (map) map.getCanvas().style.cursor = ''
}

export const isPickingProbe = () => pickingProbe

export function flyToStation(station, { zoom = 12 } = {}) {
    if (!map || station.lat === null) return
    map.flyTo({ center: [station.lon, station.lat], zoom: Math.max(map.getZoom(), zoom), speed: 1.4, essential: true })
}

// Przesuwa mapę tylko wtedy, gdy stacja jest poza widoczną częścią mapy.
export function ensureVisible(station) {
    if (!map || station.lat === null) return
    const bounds = visibleBounds()
    const inside = bounds && station.lat >= bounds.south && station.lat <= bounds.north &&
        station.lon >= bounds.west && station.lon <= bounds.east
    if (!inside) flyToStation(station, { zoom: 11 })
}

export function jumpToStation(station, zoom = 12) {
    if (!map || station.lat === null) return
    map.jumpTo({ center: [station.lon, station.lat], zoom })
}

export function fitToStations(stations) {
    if (!map) return
    const located = stations.filter(station => station.lat !== null)
    if (!located.length) return
    const bounds = new mapboxgl.LngLatBounds()
    for (const station of located) bounds.extend([station.lon, station.lat])
    // Górny margines zostawia miejsce na narzędzia mapy i pasek aktywnych filtrów.
    map.fitBounds(bounds, { padding: { top: 120, right: 70, bottom: 50, left: 50 }, maxZoom: 13, duration: 800 })
}

export function flyToPoint(lngLat, zoom) {
    if (map) map.flyTo({ center: lngLat, zoom: Math.max(map.getZoom(), zoom), essential: true })
}

// Obszar mapy, którego nie zasłania panel (z uwzględnieniem marginesów mapy).
export function visibleBounds() {
    if (!map || !state.mapReady) return null
    const padding = map.getPadding()
    const canvas = map.getCanvas()
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const topLeft = map.unproject([padding.left, padding.top])
    const bottomRight = map.unproject([width - padding.right, height - padding.bottom])
    return { west: topLeft.lng, north: topLeft.lat, east: bottomRight.lng, south: bottomRight.lat }
}

export function mapCenter() {
    if (!map) return { lng: MAP_CENTER[0], lat: MAP_CENTER[1] }
    return map.getCenter()
}

export function setPadding(padding) {
    if (map) map.setPadding(padding)
}

export function resizeMap() {
    map?.resize()
}
