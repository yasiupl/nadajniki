// Adres URL: /stacja/<id>-<opis> otwiera kartę stacji, parametry zapytania zapisują filtry,
// a część po "#" zapisuje widok mapy (obsługuje ją Mapbox).
//
// Statystyki wejść: Plausible liczy odsłony ścieżek /stacja/<id>.
// - Otwarcie karty z listy dodaje wpis historii (pushState). Plausible liczy tę odsłonę automatycznie.
// - Zmiana karty na inną zastępuje wpis (replaceState). Tę odsłonę aplikacja wysyła do Plausible sama.
// - Wejście z linku Plausible liczy przy wczytaniu strony. Poprawka adresu (opis, nowy identyfikator) nie jest odsłoną.
import { SITE_TITLE } from './config.js'
import { stationPath, stationIdFromPath } from './data.js'
import { filtersToParams } from './filters.js'

const urlWith = (pathname, search = window.location.search) => `${pathname}${search}${window.location.hash}`

function trackPageview() {
    if (typeof window.plausible === 'function') window.plausible('pageview', { u: window.location.href })
}

export function currentStationId() {
    return stationIdFromPath(window.location.pathname)
}

export function showStationUrl(station, { initial = false } = {}) {
    document.title = `${station.operator.name}${station.name ? ` – ${station.name}` : ''} | ${SITE_TITLE}`
    const path = stationPath(station)
    if (window.location.pathname === path) return
    if (initial) {
        window.history.replaceState({ station: station.id }, '', urlWith(path))
    } else if (currentStationId()) {
        // "pushed" zostaje: przycisk Wstecz nadal wraca do listy.
        window.history.replaceState({ station: station.id, pushed: Boolean(window.history.state?.pushed) }, '', urlWith(path))
        trackPageview()
    } else {
        window.history.pushState({ station: station.id, pushed: true }, '', urlWith(path))
    }
}

// Zamyka kartę: wraca do wpisu listy (jeśli kartę otworzyła aplikacja) albo zastępuje adres stroną główną.
export function clearStationUrl() {
    document.title = SITE_TITLE
    if (!currentStationId()) return
    if (window.history.state?.pushed) window.history.back()
    else window.history.replaceState(null, '', urlWith('/'))
}

export function syncFiltersUrl(filters) {
    const params = filtersToParams(filters).toString()
    const search = params ? `?${params}` : ''
    if (search === window.location.search) return
    window.history.replaceState(window.history.state, '', urlWith(window.location.pathname, search))
}

export function onRouteChange(listener) {
    window.addEventListener('popstate', () => listener(currentStationId()))
}
