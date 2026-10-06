// Panel boczny (na telefonie: panel wysuwany od dołu). Renderuje zakładki i nakładki (karta stacji,
// stacje w miejscu kliknięcia, zasięg w punkcie) oraz ustawia marginesy mapy.
import { distanceMeters, formatNumber, plural } from './format.js'
import { activeFilterCount, createContext, matches } from './filters.js'
import { dataset } from './data.js'
import { state } from './store.js'
import { visibleBounds, mapCenter, setPadding, resizeMap } from './map.js'
import { renderListView, renderPickView, renderProbeView } from './views/list.js'
import { renderDetailView } from './views/detail.js'
import { renderBandsView, renderAnalysisView } from './views/analysis.js'
import { renderChangesView } from './views/changes.js'
import { renderFiltersDrawer, renderActiveFilters, filtersBadge } from './filters-drawer.js'
import { $, isMobile } from './ui.js'
import { favoriteIds } from './favorites.js'

const PAGE = 100
const PANEL_WIDTH = 400
const PANEL_MARGIN = 12

// Stan widoków panelu (nie trafia do adresu URL).
export const ui = {
    listSort: 'distance',
    listLimit: PAGE,
    bandKey: 'vhf',
    bandSort: 'frequency',
    bandLimit: PAGE,
    changesRelease: null,
    changesTab: 'new',
    changesLimit: PAGE,
    historyError: false,
    sheet: 'half',
    collapsed: false
}
export const PAGE_SIZE = PAGE

let body = null
let panel = null
let renderQueued = false
let lastKey = ''
const scrollPositions = new Map()
const collator = new Intl.Collator('pl')

export function initPanel() {
    panel = $('#panel')
    body = $('#panel-body')
    applyLayout()
    window.addEventListener('resize', applyLayout)
}

// Stacje spełniające filtry, z lokalizacją w widocznej części mapy.
export function stationsInView() {
    const bounds = visibleBounds()
    if (!bounds) return state.filtered
    return state.filtered.filter(station => station.lat !== null &&
        station.lat >= bounds.south && station.lat <= bounds.north && station.lon >= bounds.west && station.lon <= bounds.east)
}

// Stacje, które spełniają filtry (z filtrem punktu), od najbliższej punktu.
export function pointResults() {
    const point = state.filters.point
    if (!point) return []
    return state.filtered.map(station => ({ station, distance: distanceMeters(point.lat, point.lng, station.lat, station.lon) }))
        .sort((a, b) => a.distance - b.distance)
}

export const scopedStations = () => state.scope === 'view' ? stationsInView() : state.filtered

function listInput() {
    const bounds = visibleBounds()
    const located = bounds ? stationsInView() : state.filtered
    const center = mapCenter()
    const cos = Math.cos(center.lat * Math.PI / 180)
    let items = located.map(station => ({
        station,
        key: station.lat === null ? Infinity : (station.lat - center.lat) ** 2 + ((station.lon - center.lng) * cos) ** 2
    }))
    switch (ui.listSort) {
        case 'operator':
            items.sort((a, b) => collator.compare(a.station.operator.name, b.station.operator.name) || a.key - b.key)
            break
        case 'frequency':
            items.sort((a, b) => (a.station.tx[0] ?? Infinity) - (b.station.tx[0] ?? Infinity) || a.key - b.key)
            break
        case 'newest':
            items.sort((a, b) => (b.station.since || b.station.removed || '').localeCompare(a.station.since || a.station.removed || '') || a.key - b.key)
            break
        default:
            items.sort((a, b) => a.key - b.key)
    }
    items = items.map(({ station }, index) => ({
        station,
        distance: bounds && index < ui.listLimit && station.lat !== null ? distanceMeters(center.lat, center.lng, station.lat, station.lon) : null
    }))
    return {
        visible: items,
        total: state.filtered.length,
        unlocated: bounds ? state.filtered.filter(station => station.lat === null) : [],
        sort: ui.listSort,
        limit: ui.listLimit,
        filtersActive: activeFilterCount(state.filters) > 0,
        mapAvailable: Boolean(bounds)
    }
}

// Listy zmian dla widoku "Zmiany": filtry bez filtra stanu.
function changesInput() {
    const history = dataset.history
    if (!history) return { history: null, error: ui.historyError }
    const latest = history.releases[history.releases.length - 1]?.date
    if (ui.changesRelease === null) ui.changesRelease = latest
    const release = ui.changesRelease
    const context = createContext(state.filters, { changes: history.changes, favorites: favoriteIds() })
    const keep = station => matches(station, state.filters, context, 'status')
    const current = dataset.stations.filter(keep)
    const lists = {
        new: current.filter(station => release ? station.since === release : Boolean(station.since))
            .sort((a, b) => b.since.localeCompare(a.since) || collator.compare(a.operator.name, b.operator.name)),
        changed: current.filter(station => {
            const dates = history.changes.get(station.id)
            return Boolean(dates) && (release ? dates.has(release) : true)
        }).sort((a, b) => collator.compare(a.operator.name, b.operator.name)),
        removed: history.removed.filter(station => (release ? station.removed === release : true) && keep(station))
            .sort((a, b) => b.removed.localeCompare(a.removed) || collator.compare(a.operator.name, b.operator.name))
    }
    return {
        history,
        error: false,
        release,
        tab: ui.changesTab,
        limit: ui.changesLimit,
        lists,
        filtersActive: activeFilterCount({ ...state.filters, status: '' }) > 0
    }
}

function renderKey() {
    const overlay = state.overlay
    if (!overlay) return `view:${state.view}`
    if (overlay.type === 'detail') return `detail:${overlay.station.id}`
    return `overlay:${overlay.type}`
}

function content() {
    const overlay = state.overlay
    if (overlay?.type === 'detail') {
        return renderDetailView({ ...overlay, history: dataset.history, popular: dataset.popular })
    }
    if (overlay?.type === 'pick') return renderPickView(overlay)
    if (overlay?.type === 'probe' && state.filters.point) {
        // Licznik filtrów obejmuje sam punkt, więc "inne filtry" to więcej niż 1.
        return renderProbeView({ point: state.filters.point, results: pointResults(), filtersActive: activeFilterCount(state.filters) > 1 })
    }
    switch (state.view) {
        case 'bands':
            return renderBandsView({ stations: scopedStations(), scope: state.scope, bandKey: ui.bandKey, sort: ui.bandSort, limit: ui.bandLimit, filters: state.filters })
        case 'analysis':
            return renderAnalysisView({ stations: scopedStations(), scope: state.scope, popular: dataset.popular })
        case 'changes':
            return renderChangesView(changesInput())
        default:
            return renderListView(listInput())
    }
}

function render() {
    renderQueued = false
    if (!body) return
    const key = renderKey()
    if (key !== lastKey) scrollPositions.set(lastKey, body.scrollTop)
    body.innerHTML = content().value
    if (key !== lastKey) {
        body.scrollTop = key.startsWith('view:') ? scrollPositions.get(key) || 0 : 0
        lastKey = key
    }
    for (const tab of document.querySelectorAll('.panel-tabs [data-view]')) {
        tab.setAttribute('aria-selected', String(!state.overlay && tab.dataset.view === state.view))
    }
    panel.dataset.overlay = state.overlay?.type || ''
}

export function scheduleRender() {
    if (renderQueued) return
    renderQueued = true
    requestAnimationFrame(render)
}

export function renderDrawer() {
    $('#filters-body').innerHTML = renderFiltersDrawer().value
    const active = renderActiveFilters()
    const bar = $('#active-filters')
    bar.innerHTML = active ? active.value : ''
    bar.hidden = !active
    const count = filtersBadge()
    const badge = $('#filters-count')
    badge.textContent = String(count)
    badge.hidden = !count
    const total = state.filtered.length
    $('#filters-apply').textContent = `Pokaż ${formatNumber(total)} ${plural(total, 'stację', 'stacje', 'stacji')}`
}

export function resetScroll(view) {
    scrollPositions.delete(`view:${view}`)
}

// Układ: na komputerze panel z lewej (margines mapy z lewej), na telefonie panel od dołu (margines od dołu).
export function applyLayout() {
    if (!panel) return
    const mobile = isMobile()
    panel.dataset.sheet = mobile ? ui.sheet : ''
    panel.dataset.collapsed = !mobile && ui.collapsed ? 'true' : 'false'
    document.body.dataset.panel = mobile ? `sheet-${ui.sheet}` : ui.collapsed ? 'collapsed' : 'open'
    requestAnimationFrame(() => {
        if (mobile) {
            const height = ui.sheet === 'full' ? 0 : panel.getBoundingClientRect().height
            setPadding({ left: 0, right: 0, top: 0, bottom: Math.min(height, window.innerHeight * 0.6) })
        } else {
            setPadding({ left: ui.collapsed ? 0 : PANEL_WIDTH + PANEL_MARGIN, right: 0, top: 0, bottom: 0 })
        }
        resizeMap()
    })
}

export function setSheet(sheet) {
    ui.sheet = sheet
    applyLayout()
}

export function toggleCollapsed(collapsed = !ui.collapsed) {
    ui.collapsed = collapsed
    applyLayout()
}
