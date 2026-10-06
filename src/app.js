import './style.scss'
import { ARCHIVE_URL, SITE_TITLE } from './js/config.js'
import { formatDate, formatFrequency, distanceMeters } from './js/format.js'
import { filtersFromParams, emptyFilters, createContext, applyFilters, activeFilterCount } from './js/filters.js'
import {
    dataset, loadStations, loadHistory, loadPopular, loadDetails, resolveStation, stationPath, stationById,
    stationsOnFrequency, ensureSearchIndex
} from './js/data.js'
import { state, on } from './js/store.js'
import * as mapView from './js/map.js'
import {
    ui, PAGE_SIZE, initPanel, scheduleRender, renderDrawer, stationsInView, setSheet, toggleCollapsed, resetScroll
} from './js/panel.js'
import { initSearch } from './js/search.js'
import { initTooltips } from './js/charts.js'
import { showStationUrl, clearStationUrl, syncFiltersUrl, currentStationId, onRouteChange } from './js/router.js'
import { openExportDialog } from './js/export-dialog.js'
import { favoriteIds, toggleFavorite, onFavoritesChange } from './js/favorites.js'
import { $, toast, copyText, isMobile } from './js/ui.js'
import { themePreference, effectiveTheme, saveThemePreference, onSystemThemeChange } from './js/theme.js'

let search = null

// --- Filtry ---

async function runFilters({ fit = false } = {}) {
    const filters = state.filters
    let history = dataset.history
    if (filters.status && !history) {
        try {
            history = await loadHistory()
        } catch {
            toast('Nie można wczytać historii zmian.')
            filters.status = ''
            filters.release = ''
        }
    }
    const base = filters.status === 'removed' ? history.removed : dataset.stations
    if (filters.q.trim()) ensureSearchIndex(base)
    const context = createContext(filters, { changes: history?.changes, favorites: favoriteIds() })
    const result = applyFilters(base, filters, context)
    state.filtered = result.stations
    state.facets = result.facets
    ui.listLimit = PAGE_SIZE
    ui.changesLimit = PAGE_SIZE
    mapView.setStations(state.filtered)
    syncPoint()
    if (state.layers.coverage) updateCoverage()
    syncFiltersUrl(filters)
    search?.setValue(filters.q)
    renderDrawer()
    scheduleRender()
    if (fit) mapView.fitToStations(state.filtered)
}

// Znacznik punktu i widok "Zasięg w punkcie" istnieją tylko razem z filtrem punktu.
function syncPoint() {
    const point = state.filters.point
    if (point) {
        mapView.showProbe(point)
        return
    }
    mapView.clearProbe()
    if (state.overlay?.type === 'probe') state.overlay = null
    if (state.overlay?.back?.type === 'probe') state.overlay.back = null
}

function updateFilters(change, options) {
    change(state.filters)
    return runFilters(options)
}

function toggleFacet(facet, value) {
    updateFilters(filters => {
        const set = filters[facet]
        if (set.has(value)) set.delete(value)
        else set.add(value)
    })
}

function setFrequencyRange(min, max, options = { fit: true }) {
    updateFilters(filters => {
        filters.frequencyMin = Number.isFinite(min) ? min : null
        filters.frequencyMax = Number.isFinite(max) ? max : null
    }, options)
}

// --- Karta stacji i nakładki ---

function sharedFrequencies(station) {
    return station.tx.slice(0, 8).map(frequency => {
        const others = stationsOnFrequency(frequency).filter(other => other !== station)
        const nearest = others.map(other => ({
            station: other,
            distance: station.lat !== null && other.lat !== null ? distanceMeters(station.lat, station.lon, other.lat, other.lon) : null
        })).sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity)).slice(0, 1)
        return { frequency, others: others.length, nearest }
    })
}

async function openStation(target, { initial = false, move = 'ensure' } = {}) {
    const station = typeof target === 'string' ? await resolveStation(target) : target
    if (!station) {
        const first = dataset.history?.releases[0]?.date
        toast(first ? `Nie znaleziono stacji. Mogła zniknąć z wykazu przed ${formatDate(first)}.` : 'Nie znaleziono stacji.')
        clearStationUrl()
        return
    }
    const previous = state.overlay
    state.overlay = {
        type: 'detail',
        station,
        records: null,
        loading: !station.removed,
        error: false,
        shared: sharedFrequencies(station),
        back: previous && previous.type !== 'detail' ? previous : previous?.back || null
    }
    mapView.setSelection(station)
    showStationUrl(station, { initial })
    if (move === 'jump') mapView.jumpToStation(station)
    else if (move === 'fly') mapView.flyToStation(station)
    else if (move === 'ensure') mapView.ensureVisible(station)
    if (isMobile() && ui.sheet === 'peek') setSheet('half')
    scheduleRender()

    const overlay = state.overlay
    const refresh = () => { if (state.overlay === overlay) scheduleRender() }
    if (!station.removed) {
        loadDetails(station.id)
            .then(records => { overlay.records = records; overlay.loading = false })
            .catch(() => { overlay.loading = false; overlay.error = true })
            .finally(refresh)
    }
    loadHistory().then(refresh).catch(() => {})
    loadPopular().then(refresh)
}

// keepPoint: widok "Zasięg w punkcie" znika, ale filtr punktu zostaje (np. przy zmianie zakładki).
function closeOverlay({ keepPoint = false } = {}) {
    const overlay = state.overlay
    if (!overlay) return
    if (overlay.type === 'detail') {
        mapView.setSelection(null)
        clearStationUrl()
        state.overlay = overlay.back || null
    } else {
        state.overlay = null
        if (overlay.type === 'probe' && !keepPoint) {
            updateFilters(filters => { filters.point = null })
            return
        }
    }
    scheduleRender()
}

// Zamyka kartę i nakładki pod nią (np. kartę otwartą z widoku "Zasięg w punkcie"). Filtr punktu zostaje.
function closeAllOverlays() {
    while (state.overlay) closeOverlay({ keepPoint: true })
}

// "Zasięg w punkcie" to filtr: zostają tylko stacje, których obszar obsługi obejmuje punkt.
function probe(lngLat) {
    if (state.overlay?.type === 'detail') {
        mapView.setSelection(null)
        clearStationUrl()
    }
    state.overlay = { type: 'probe' }
    if (isMobile() && ui.sheet === 'peek') setSheet('half')
    setToolPressed('probe', false)
    const round = value => Math.round(value * 1e5) / 1e5
    updateFilters(filters => { filters.point = { lat: round(lngLat.lat), lng: round(lngLat.lng) } })
}

async function shareStation(station) {
    const url = `${window.location.origin}${stationPath(station)}`
    if (navigator.share && isMobile()) {
        try {
            await navigator.share({ title: `${station.operator.name} – ${station.name}`, url })
            return
        } catch (error) {
            if (error.name === 'AbortError') return
        }
    }
    copyText(url, 'Skopiowano link do stacji.')
}

// Okno eksportu. Zakresy "W zasięgu punktu" i "Ulubione" są zawsze na liście; pusty zakres jest nieaktywny.
// Zaznaczony zakres zależy od miejsca, z którego użytkownik otworzył okno.
function openExport(origin) {
    const scopes = []
    const overlay = state.overlay
    if (origin === 'station' && overlay?.station) {
        scopes.push({ key: 'station', label: 'Ta stacja', stations: [overlay.station] })
    }
    if (state.mapReady) scopes.push({ key: 'view', label: 'Stacje w widoku mapy', stations: stationsInView() })
    const point = state.filters.point
    scopes.push({
        key: 'range',
        label: 'Stacje w zasięgu wybranego punktu',
        stations: point ? state.filtered : [],
        disabled: point ? '' : 'Najpierw wybierz punkt narzędziem „Zasięg w punkcie”.'
    })
    const favorites = [...favoriteIds()].map(stationById).filter(Boolean)
    scopes.push({
        key: 'favorites',
        label: 'Ulubione stacje',
        stations: favorites,
        disabled: favorites.length ? '' : 'Brak ulubionych. Gwiazdka w karcie stacji dodaje stację do ulubionych.'
    })
    scopes.push({
        key: 'filtered',
        label: activeFilterCount(state.filters) ? 'Wszystkie stacje, które spełniają filtry' : 'Wszystkie stacje w wykazie',
        stations: state.filtered
    })
    const selected = { station: 'station', probe: 'range' }[origin] || (state.mapReady ? 'view' : 'filtered')
    openExportDialog(scopes, selected)
}

// --- Warstwy mapy ---

function setToolPressed(name, pressed) {
    const button = document.querySelector(`[data-tool="${name}"]`)
    if (button) button.setAttribute('aria-pressed', String(pressed))
}

function updateCoverage() {
    const { shown, total } = mapView.setCoverage(state.filtered.filter(station => !station.removed))
    if (shown < total) toast(`Obszary obsługi: ${shown} z ${total} stacji najbliżej środka mapy. Zawęź filtry, aby zobaczyć wszystkie.`, { timeout: 6000 })
}

function setLayer(name, visible) {
    mapView.setLayerVisibility(name, visible)
    if (name === 'coverage') {
        if (visible) updateCoverage()
        else mapView.clearCoverage()
    }
    setToolPressed(name, visible)
}

// --- Motyw ---

const THEME_TITLES = { light: 'Włącz tryb ciemny', dark: 'Włącz tryb jasny' }

// Kontrolki motywu: przycisk na pasku górnym i wybór w menu.
function syncThemeControls() {
    const preference = themePreference()
    for (const button of document.querySelectorAll('[data-action="set-theme"]')) {
        button.setAttribute('aria-pressed', String(button.dataset.value === preference))
    }
    const theme = effectiveTheme()
    const toggle = $('#theme-toggle')
    toggle.title = THEME_TITLES[theme]
    toggle.setAttribute('aria-label', THEME_TITLES[theme])
    toggle.querySelector('.material-icons').textContent = theme === 'dark' ? 'light_mode' : 'dark_mode'
}

// Styl mapy i kolory w panelu zależą od motywu, więc zmiana motywu odświeża oba.
function applyTheme() {
    mapView.setTheme(effectiveTheme())
    syncThemeControls()
    renderDrawer()
    scheduleRender()
}

function setThemePreference(preference) {
    saveThemePreference(preference)
    applyTheme()
}

// --- Akcje ---

const actions = {
    'open-station': element => openStation(element.dataset.id),
    'open-station-value': element => openStation(element.dataset.value),
    'close-overlay': closeOverlay,
    'zoom-station': () => state.overlay?.station && mapView.flyToStation(state.overlay.station, { zoom: 13 }),
    'share-station': () => state.overlay?.station && shareStation(state.overlay.station),
    'copy-frequencies': () => {
        const station = state.overlay?.station
        if (station) copyText(station.tx.map(formatFrequency).join('\n'), 'Skopiowano częstotliwości nadawcze.')
    },
    'copy-text': element => copyText(element.dataset.value),
    'filter-frequency': element => {
        const value = parseFloat(element.dataset.value)
        closeAllOverlays()
        state.view = 'list'
        setFrequencyRange(value, value)
    },
    'filter-range': element => {
        const [min, max] = element.dataset.value.split('-').map(Number)
        setFrequencyRange(min, max, { fit: false })
    },
    'filter-operator': element => {
        closeAllOverlays()
        state.view = 'list'
        updateFilters(filters => { filters.operator = element.dataset.value }, { fit: true })
    },
    'filter-band': element => updateFilters(filters => { filters.bands = new Set([element.dataset.value]) }),
    'set-band': element => { ui.bandKey = element.dataset.value; ui.bandLimit = PAGE_SIZE; scheduleRender() },
    'band-sort': element => { ui.bandSort = element.dataset.value; scheduleRender() },
    'band-more': () => { ui.bandLimit += PAGE_SIZE; scheduleRender() },
    'set-scope': element => { state.scope = element.dataset.value; scheduleRender() },
    'toggle-type': element => toggleFacet('types', element.dataset.value),
    'toggle-band': element => toggleFacet('bands', element.dataset.value),
    'toggle-bandwidth': element => toggleFacet('bandwidths', element.dataset.value),
    'toggle-category': element => toggleFacet('categories', element.dataset.value),
    'toggle-office': element => toggleFacet('offices', element.dataset.value),
    'toggle-facet': element => toggleFacet(element.dataset.facet, element.dataset.value),
    'set-status': element => updateFilters(filters => {
        filters.status = element.dataset.value
        filters.release = filters.status ? dataset.release : ''
    }),
    'set-expiring': element => updateFilters(filters => { filters.expiring = parseInt(element.dataset.value, 10) || 0 }),
    'remove-query': () => updateFilters(filters => { filters.q = '' }),
    'remove-operator': () => updateFilters(filters => { filters.operator = '' }),
    'remove-range': () => setFrequencyRange(null, null, { fit: false }),
    'remove-point': () => updateFilters(filters => { filters.point = null }),
    'clear-filters': () => updateFilters(filters => Object.assign(filters, emptyFilters())),
    'fit-filtered': () => mapView.fitToStations(state.filtered),
    'list-more': () => { ui.listLimit += PAGE_SIZE; scheduleRender() },
    'changes-more': () => { ui.changesLimit += PAGE_SIZE; scheduleRender() },
    'changes-tab': element => { ui.changesTab = element.dataset.value; ui.changesLimit = PAGE_SIZE; scheduleRender() },
    'changes-release': element => { ui.changesRelease = element.dataset.value; ui.changesLimit = PAGE_SIZE; scheduleRender() },
    'changes-show': () => {
        state.view = 'list'
        updateFilters(filters => {
            filters.status = ui.changesTab
            filters.release = ui.changesRelease || ''
        }, { fit: true })
    },
    'retry-history': () => { ui.historyError = false; showView('changes') },
    'export-open': element => openExport(element.dataset.scope),
    'toggle-favorite': () => {
        const station = state.overlay?.station
        if (!station) return
        const added = toggleFavorite(station.id)
        toast(added ? 'Dodano stację do ulubionych.' : 'Usunięto stację z ulubionych.')
    },
    'set-favorites': element => updateFilters(filters => { filters.favorites = element.dataset.value === '1' }),
    'open-filters': () => openDrawer('filters'),
    'open-menu': () => openDrawer('menu'),
    'close-drawer': closeDrawers,
    'toggle-layer': element => setLayer(element.dataset.tool, element.getAttribute('aria-pressed') !== 'true'),
    'probe-pick': element => {
        if (mapView.isPickingProbe()) {
            mapView.stopProbePick()
            setToolPressed('probe', false)
        } else {
            mapView.startProbePick()
            setToolPressed('probe', true)
            toast('Kliknij punkt na mapie. Możesz też kliknąć prawym przyciskiem albo przytrzymać palec na mapie.')
        }
    },
    'set-theme': element => setThemePreference(element.dataset.value),
    'toggle-theme': () => setThemePreference(effectiveTheme() === 'dark' ? 'light' : 'dark'),
    'toggle-panel': () => toggleCollapsed(),
    'sheet-toggle': () => setSheet(ui.sheet === 'peek' ? 'half' : ui.sheet === 'half' ? 'full' : 'peek')
}

const changes = {
    'list-sort': element => { ui.listSort = element.value; ui.listLimit = PAGE_SIZE; resetScroll('list'); scheduleRender() },
    'changes-release': element => { ui.changesRelease = element.value; ui.changesLimit = PAGE_SIZE; scheduleRender() },
    'status-release': element => updateFilters(filters => { filters.release = element.value })
}

function showView(view) {
    closeAllOverlays()
    state.view = view
    if (isMobile() && ui.sheet === 'peek') setSheet('half')
    if (view === 'changes' && !dataset.history) {
        loadHistory().then(() => { renderDrawer(); scheduleRender() }).catch(() => { ui.historyError = true; scheduleRender() })
    }
    if (view === 'analysis') loadPopular().then(scheduleRender)
    scheduleRender()
}

// --- Szuflady (filtry, menu) ---

function openDrawer(name) {
    closeDrawers()
    const drawer = $(`#${name}`)
    drawer.hidden = false
    requestAnimationFrame(() => drawer.classList.add('open'))
    $('#scrim').hidden = false
    drawer.querySelector('button, a, input, select')?.focus({ preventScroll: true })
    if (name === 'filters' && !dataset.history) loadHistory().then(renderDrawer).catch(() => {})
}

function closeDrawers() {
    for (const drawer of document.querySelectorAll('.drawer.open')) {
        drawer.classList.remove('open')
        setTimeout(() => { if (!drawer.classList.contains('open')) drawer.hidden = true }, 250)
    }
    $('#scrim').hidden = true
}

// --- Start ---

function bindEvents() {
    document.addEventListener('click', event => {
        const element = event.target.closest('[data-action]')
        if (!element || element.disabled) return
        const action = actions[element.dataset.action]
        if (!action) return
        if (element.tagName === 'A' && element.getAttribute('href')) return
        event.preventDefault()
        action(element, event)
    })
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            // Otwarte okno dialogowe zamyka się samo. Karta stacji pod nim zostaje.
            if (document.querySelector('dialog[open]')) return
            if (document.querySelector('.drawer.open')) closeDrawers()
            else if (mapView.isPickingProbe()) actions['probe-pick']()
            else if (state.overlay && !event.target.closest('input, select, textarea')) closeOverlay()
            return
        }
        // Wiersze tabel z akcją działają z klawiatury tak jak przyciski.
        if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-action]:not(button):not(a)')) {
            event.preventDefault()
            event.target.click()
        }
    })
    document.addEventListener('change', event => {
        const element = event.target.closest('[data-change]')
        if (element) changes[element.dataset.change]?.(element)
    })
    document.addEventListener('submit', event => {
        const form = event.target.closest('form[data-submit="frequency-range"]')
        if (!form) return
        event.preventDefault()
        const read = name => parseFloat(String(form.elements[name].value).replace(',', '.'))
        let [min, max] = [read('min'), read('max')]
        if (Number.isFinite(min) && Number.isFinite(max) && min > max) [min, max] = [max, min]
        setFrequencyRange(min, max)
        if (isMobile()) closeDrawers()
    })

    for (const tab of document.querySelectorAll('.panel-tabs [data-view]')) {
        tab.addEventListener('click', () => showView(tab.dataset.view))
    }
    $('#scrim').addEventListener('click', closeDrawers)
    $('#filters-apply').addEventListener('click', closeDrawers)

    // Najechanie na stację na liście podświetla ją na mapie.
    const body = $('#panel-body')
    body.addEventListener('pointerover', event => {
        const item = event.target.closest('[data-uid]')
        if (item) mapView.setHover(Number(item.dataset.uid))
    })
    body.addEventListener('pointerleave', () => mapView.setHover(null))

    on('map:ready', () => { scheduleRender() })
    on('map:move', () => {
        if (!state.overlay && (state.view === 'list' || state.scope === 'view')) scheduleRender()
    })
    on('map:style', () => {
        mapView.setSelection(state.overlay?.type === 'detail' ? state.overlay.station : null)
        scheduleRender()
    })
    on('station:open', station => openStation(station))
    on('pick', ({ stations }) => {
        if (state.overlay?.type === 'detail') {
            mapView.setSelection(null)
            clearStationUrl()
        }
        state.overlay = { type: 'pick', stations }
        if (isMobile() && ui.sheet === 'peek') setSheet('half')
        scheduleRender()
    })
    on('probe', lngLat => probe(lngLat))

    onRouteChange(id => {
        syncFiltersUrl(state.filters)
        if (id) {
            if (state.overlay?.type !== 'detail' || state.overlay.station.id !== id) openStation(id, { move: 'ensure' })
        } else if (state.overlay?.type === 'detail') {
            document.title = SITE_TITLE
            mapView.setSelection(null)
            state.overlay = state.overlay.back || null
            scheduleRender()
        }
    })
}

function showDisclaimer() {
    let seen = false
    try {
        seen = Boolean(window.localStorage.getItem('disclaimer'))
    } catch {
        // Bez dostępu do localStorage komunikat pokazuje się przy każdej wizycie.
    }
    const dialog = $('#disclaimer')
    if (seen || !dialog.showModal) return
    dialog.showModal()
    dialog.addEventListener('close', () => {
        try {
            window.localStorage.setItem('disclaimer', '1')
        } catch {
            // Brak zapisu: komunikat wróci przy następnej wizycie.
        }
    }, { once: true })
}

function showDataInfo() {
    const info = $('#data-info')
    if (!info) return
    const first = dataset.releases[0]
    info.textContent = `Wydanie wykazu: ${formatDate(dataset.release)}. Historia zmian od ${formatDate(first)} (${dataset.releases.length} wydań, archiwum dane.gov.pl).`
    $('#archive-link')?.setAttribute('href', ARCHIVE_URL)
}

async function start() {
    // Pozycję mapy z adresu trzeba sprawdzić przed startem mapy, bo Mapbox zaraz zapisze własną.
    const hasMapPosition = /^#\d/.test(window.location.hash)
    state.theme = effectiveTheme()
    state.filters = filtersFromParams(new URLSearchParams(window.location.search))

    initPanel()
    bindEvents()
    syncThemeControls()
    onSystemThemeChange(applyTheme)
    // Zmiana listy ulubionych zmienia wynik filtra "Tylko ulubione" i znaczniki na liście.
    onFavoritesChange(() => {
        if (state.filters.favorites) runFilters()
        else {
            renderDrawer()
            scheduleRender()
        }
    })
    initTooltips(document.body)
    mapView.initMap($('#map'))
    search = initSearch({
        onApply: text => updateFilters(filters => { filters.q = text }, { fit: Boolean(text) }),
        onOpenStation: id => openStation(id, { move: 'fly' }),
        onOperator: name => {
            state.view = 'list'
            closeAllOverlays()
            updateFilters(filters => { filters.operator = name; filters.q = '' }, { fit: true })
        },
        onFrequency: frequency => {
            state.view = 'list'
            closeAllOverlays()
            updateFilters(filters => {
                filters.q = ''
                filters.frequencyMin = frequency
                filters.frequencyMax = frequency
            }, { fit: true })
        }
    })
    showDisclaimer()

    try {
        await loadStations()
    } catch (error) {
        console.error(error)
        $('#panel-body').innerHTML = '<div class="empty-state"><p><strong>Nie można wczytać danych.</strong></p><p class="muted">Sprawdź połączenie i odśwież stronę.</p></div>'
        return
    }
    showDataInfo()
    await runFilters()

    const id = currentStationId()
    if (id) await openStation(id, { initial: true, move: hasMapPosition ? 'none' : 'jump' })
    else if (state.filters.point) {
        // Link z punktem: widok "Zasięg w punkcie" i mapa wokół punktu.
        state.overlay = { type: 'probe' }
        if (!hasMapPosition) mapView.flyToPoint(state.filters.point, 10)
        scheduleRender()
    }
}

start()

if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    window.addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js'))
}
