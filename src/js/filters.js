// Model filtrów, dopasowanie stacji i zapis filtrów w adresie URL. Moduł nie używa DOM.
import { BANDS, BANDWIDTHS, STATUSES, bandBit, bandwidthKey } from './config.js'
import { parseQuery, isEmptyQuery, matchStation } from './query.js'

// Pusty zbiór oznacza brak ograniczenia (wszystkie wartości).
export function emptyFilters() {
    return {
        q: '',
        types: new Set(),
        bands: new Set(),
        categories: new Set(),
        bandwidths: new Set(),
        offices: new Set(),
        operator: '',
        frequencyMin: null,
        frequencyMax: null,
        status: '',
        release: '',
        expiring: 0
    }
}

// Fasety: filtry z wieloma wartościami. Licznik fasety pomija jej własny filtr.
export const FACETS = ['types', 'bands', 'categories', 'bandwidths', 'offices']

export function facetValues(station, facet) {
    switch (facet) {
        case 'types': return station.typeList
        case 'bands': return station.bandList
        case 'categories': return [station.operator.category]
        case 'bandwidths': return station.bandwidthKeys
        case 'offices': return [station.office]
        default: return []
    }
}

function intersects(values, selected) {
    for (const value of values) if (selected.has(value)) return true
    return false
}

// Kontekst dopasowania: zapytanie po parsowaniu, granica dat wygasania, zbiory zmian z historii.
export function createContext(filters, { now = new Date(), changes = null } = {}) {
    const query = parseQuery(filters.q)
    let expiryLimit = ''
    if (filters.expiring) {
        const limit = new Date(now)
        limit.setMonth(limit.getMonth() + filters.expiring)
        expiryLimit = limit.toISOString().slice(0, 10)
    }
    return { query: isEmptyQuery(query) ? null : query, expiryLimit, changes }
}

// Czy stacja spełnia filtry. Parametr skip pomija jedną fasetę (do liczników faset).
export function matches(station, filters, context, skip = '') {
    for (const facet of FACETS) {
        if (facet === skip || !filters[facet].size) continue
        if (!intersects(facetValues(station, facet), filters[facet])) return false
    }
    if (filters.operator && station.operator.name !== filters.operator) return false
    if (filters.frequencyMin !== null || filters.frequencyMax !== null) {
        const min = filters.frequencyMin ?? -Infinity
        const max = filters.frequencyMax ?? Infinity
        if (!station.frequencies.some(frequency => frequency >= min - 1e-6 && frequency <= max + 1e-6)) return false
    }
    if (context.expiryLimit && !(station.expiry && station.expiry <= context.expiryLimit)) return false
    if (filters.status && skip !== 'status' && !matchesStatus(station, filters, context)) return false
    if (context.query) {
        // querySet: wynik wyszukiwania obliczony raz dla wszystkich faset.
        if (context.querySet ? !context.querySet.has(station) : !matchStation(station, context.query)) return false
    }
    return true
}

// Stacje spełniające filtry i liczniki faset (Map: wartość -> liczba stacji).
export function applyFilters(stations, filters, context) {
    if (context.query) {
        context.querySet = new Set()
        for (const station of stations) if (matchStation(station, context.query)) context.querySet.add(station)
    }
    const result = []
    for (const station of stations) if (matches(station, filters, context)) result.push(station)
    const facets = {}
    for (const facet of FACETS) {
        const counts = new Map()
        const source = filters[facet].size ? stations : result
        for (const station of source) {
            if (source !== result && !matches(station, filters, context, facet)) continue
            for (const value of facetValues(station, facet)) counts.set(value, (counts.get(value) || 0) + 1)
        }
        facets[facet] = counts
    }
    return { stations: result, facets }
}

// Stan stacji względem wydania: nowa (since), zmieniona lub przeniesiona (zdarzenia z historii).
// Bez wskazanego wydania liczy się cały okres historii.
function matchesStatus(station, filters, context) {
    if (filters.status === 'removed') return Boolean(station.removed) && (!filters.release || station.removed === filters.release)
    if (station.removed) return false
    if (filters.status === 'new') return filters.release ? station.since === filters.release : Boolean(station.since)
    if (filters.status === 'changed') {
        if (context.changes) {
            const dates = context.changes.get(station.id)
            return Boolean(dates) && (!filters.release || dates.has(filters.release))
        }
        return filters.release ? station.changed === filters.release : Boolean(station.changed)
    }
    return true
}

export function activeFilterCount(filters) {
    let count = FACETS.reduce((sum, facet) => sum + (filters[facet].size ? 1 : 0), 0)
    if (filters.q.trim()) count++
    if (filters.operator) count++
    if (filters.frequencyMin !== null || filters.frequencyMax !== null) count++
    if (filters.status) count++
    if (filters.expiring) count++
    return count
}

// Parametry URL (polskie nazwy, czytelne w udostępnianym linku).
const PARAMS = {
    q: 'q',
    types: 'typ',
    bands: 'pasmo',
    categories: 'kat',
    bandwidths: 'kanal',
    offices: 'urzad',
    operator: 'operator',
    frequency: 'f',
    status: 'stan',
    release: 'wydanie',
    expiring: 'wygasa'
}

const toNumber = text => {
    const value = parseFloat(String(text).replace(',', '.'))
    return Number.isFinite(value) ? value : null
}

export function filtersToParams(filters) {
    const params = new URLSearchParams()
    if (filters.q.trim()) params.set(PARAMS.q, filters.q.trim())
    for (const facet of FACETS) {
        if (filters[facet].size) params.set(PARAMS[facet], [...filters[facet]].join(','))
    }
    if (filters.operator) params.set(PARAMS.operator, filters.operator)
    if (filters.frequencyMin !== null || filters.frequencyMax !== null) {
        const min = filters.frequencyMin ?? ''
        const max = filters.frequencyMax ?? ''
        params.set(PARAMS.frequency, min === max ? String(min) : `${min}-${max}`)
    }
    if (filters.status) {
        params.set(PARAMS.status, STATUSES.find(status => status.key === filters.status).param)
        if (filters.release) params.set(PARAMS.release, filters.release)
    }
    if (filters.expiring) params.set(PARAMS.expiring, String(filters.expiring))
    return params
}

export function filtersFromParams(params) {
    const filters = emptyFilters()
    filters.q = params.get(PARAMS.q) || ''
    const list = key => (params.get(key) || '').split(',').map(item => item.trim()).filter(Boolean)
    filters.types = new Set(list(PARAMS.types).map(code => code.toUpperCase()))
    filters.bands = new Set(list(PARAMS.bands).filter(key => BANDS.some(band => band.key === key)))
    filters.categories = new Set(list(PARAMS.categories))
    filters.bandwidths = new Set(list(PARAMS.bandwidths).filter(key => BANDWIDTHS.some(item => item.key === key)))
    filters.offices = new Set(list(PARAMS.offices).map(code => code.toUpperCase()))
    filters.operator = params.get(PARAMS.operator) || ''
    const frequency = params.get(PARAMS.frequency)
    if (frequency) {
        const [min, max = min] = frequency.split('-')
        filters.frequencyMin = toNumber(min)
        filters.frequencyMax = toNumber(max)
    }
    const status = STATUSES.find(item => item.param === params.get(PARAMS.status))
    if (status) {
        filters.status = status.key
        filters.release = /^\d{4}-\d{2}-\d{2}$/.test(params.get(PARAMS.release) || '') ? params.get(PARAMS.release) : ''
    }
    const expiring = parseInt(params.get(PARAMS.expiring) || '0', 10)
    filters.expiring = [6, 12, 24].includes(expiring) ? expiring : 0
    return filters
}

// Pola pomocnicze stacji używane przez filtry (wywoływane raz przy wczytaniu danych).
export function indexStation(station) {
    station.typeList = [...station.types]
    station.frequencies = [...new Set([...station.tx, ...station.rx])].sort((a, b) => a - b)
    let mask = 0
    const bands = new Set()
    for (const frequency of station.frequencies) {
        const band = BANDS.find(item => item.min !== null && frequency >= item.min && frequency < item.max) || BANDS[BANDS.length - 1]
        bands.add(band.key)
        mask |= bandBit(band.key)
    }
    station.bandList = [...bands]
    station.bandMask = mask
    station.bandwidthKeys = [...new Set(station.bandwidths.map(bandwidthKey))]
    return station
}
