// Wczytywanie i dekodowanie danych z /data/ (patrz scripts/build-data.mjs).
import { TYPE_ORDER, OFFICES, typeInfo } from './config.js'
import { normalize, frequencyKey, slugify } from './format.js'
import { indexStation } from './filters.js'

const DATA_URL = '/data/'
// Identyfikatory liczbowe (uid) stacji usuniętych zaczynają się od tej wartości.
const REMOVED_UID_OFFSET = 1000000

export const dataset = {
    release: '',
    releases: [],
    source: '',
    generated: 0,
    detailFields: [],
    operators: [],
    categories: new Map(),
    stations: [],
    byId: new Map(),
    history: null,
    popular: null
}

async function fetchJson(path) {
    const response = await fetch(`${DATA_URL}${path}`)
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${path}`)
    return response.json()
}

function primaryType(types) {
    return TYPE_ORDER.find(code => types.includes(code)) || types[0] || '?'
}

function decodeStation(row, field, operators, permits, uid) {
    const names = row[field.names] || []
    const tx = row[field.tx] || []
    const types = row[field.networkTypes] || ''
    return indexStation({
        uid,
        id: row[field.id],
        operator: operators[row[field.operator]],
        lat: row[field.lat],
        lon: row[field.lon],
        names,
        name: names[0] || '',
        location: row[field.location] || '',
        types,
        type: primaryType(types),
        stationTypes: row[field.stationTypes] || '',
        tx,
        rx: row[field.rx] === 0 ? tx : row[field.rx] || [],
        bandwidths: row[field.bandwidths] || [],
        erp: row[field.erp],
        radius: row[field.radius],
        antennaHeight: row[field.antennaHeight],
        expiry: row[field.expiry] || '',
        permits: (row[field.permits] || []).map(permit => permits ? permits[permit] : permit),
        office: row[field.office] || '',
        units: row[field.units] || 0,
        badLocation: row[field.badLocation] || null,
        since: row[field.since] || '',
        changed: row[field.changed] || '',
        removed: row[field.removed] || ''
    })
}

const fieldIndex = fields => Object.fromEntries(fields.map((name, index) => [name, index]))

export async function loadStations() {
    const json = await fetchJson('stations.json')
    const field = fieldIndex(json.fields)
    dataset.release = json.release
    dataset.releases = json.releases || [json.release]
    dataset.source = json.source
    dataset.generated = json.generated
    dataset.detailFields = json.detailFields
    dataset.categories = new Map(json.categories.map(category => [category.key, category.name]))
    dataset.operators = json.operators.map(([name, address, category], index) => ({
        index, name, address, category, stations: 0, searchName: normalize(name)
    }))
    dataset.stations = json.stations.map((row, index) => decodeStation(row, field, dataset.operators, json.permits, index))
    dataset.byId = new Map(dataset.stations.map(station => [station.id, station]))
    for (const station of dataset.stations) station.operator.stations++
    return dataset
}

// Historia zmian (ładowana dopiero wtedy, gdy jest potrzebna).
let historyPromise = null
export function loadHistory() {
    if (!historyPromise) {
        historyPromise = fetchJson(`history.json?v=${dataset.release}`).then(json => {
            const field = fieldIndex(json.fields)
            const currentOperators = new Map(dataset.operators.map(operator => [operator.name, operator]))
            const operators = json.operators.map(([name, address], index) => currentOperators.get(name) || {
                index: -1 - index, name, address, category: '', stations: 0, searchName: normalize(name)
            })
            const removed = json.removed.map((row, index) => decodeStation(row, field, operators, null, REMOVED_UID_OFFSET + index))
            const events = new Map(Object.entries(json.events))
            // Daty zmian (także przeniesień) każdej stacji, do filtra "Zmienione".
            const changes = new Map()
            for (const [id, list] of events) {
                for (const event of list) {
                    if (event[1] !== 'c' && event[1] !== 'm') continue
                    if (!changes.has(id)) changes.set(id, new Set())
                    changes.get(id).add(event[0])
                }
            }
            dataset.history = {
                releases: json.releases,
                removed,
                byId: new Map(removed.map(station => [station.id, station])),
                events,
                changes,
                aliases: new Map(Object.entries(json.aliases || {}))
            }
            return dataset.history
        }).catch(error => {
            historyPromise = null
            throw error
        })
    }
    return historyPromise
}

// Statystyki wejść (plik istnieje tylko wtedy, gdy budowanie ma klucz API Plausible).
let popularPromise = null
export function loadPopular() {
    if (!popularPromise) {
        popularPromise = fetchJson(`popular.json?v=${dataset.release}`)
            .then(json => {
                dataset.popular = { period: json.period, generated: json.generated, stations: new Map(Object.entries(json.stations)) }
                return dataset.popular
            })
            .catch(() => null)
    }
    return popularPromise
}

// Pełne rekordy stacji, z pliku details/XX.json (XX: dwa pierwsze znaki identyfikatora).
const shards = new Map()
export async function loadDetails(id) {
    const shard = id.slice(0, 2)
    if (!shards.has(shard)) {
        shards.set(shard, fetchJson(`details/${shard}.json?v=${dataset.release}`).catch(error => {
            shards.delete(shard)
            throw error
        }))
    }
    const records = (await shards.get(shard))[id]
    if (!records) return null
    return records.map(record => Object.fromEntries(dataset.detailFields.map((name, index) => [name, record[index]])))
}

export function stationByUid(uid) {
    if (uid >= REMOVED_UID_OFFSET) return dataset.history?.removed[uid - REMOVED_UID_OFFSET] || null
    return dataset.stations[uid] || null
}

export function stationById(id) {
    return dataset.byId.get(id) || dataset.history?.byId.get(id) || null
}

// Stacja z adresu URL: bieżąca, przeniesiona (nowy identyfikator) albo usunięta.
export async function resolveStation(id) {
    const current = dataset.byId.get(id)
    if (current) return current
    const history = await loadHistory().catch(() => null)
    if (!history) return null
    const alias = history.aliases.get(id)
    return stationById(alias || id)
}

export function stationPath(station) {
    const slug = slugify(`${station.operator.name} ${station.name}`)
    return `/stacja/${station.id}${slug ? `-${slug}` : ''}`
}

export function stationIdFromPath(pathname) {
    return /^\/stacja\/([0-9a-f]{10,16})(?:[-/]|$)/.exec(pathname)?.[1] || null
}

// Pola do wyszukiwania tekstowego. Indeks powstaje przy pierwszym wyszukiwaniu.
export function ensureSearchIndex(stations) {
    for (const station of stations) {
        if (station.searchText !== undefined) continue
        const types = [...station.types].map(code => typeInfo(code).name)
        station.nameText = normalize(station.names.join('\n'))
        station.locationText = normalize(station.location)
        station.searchText = normalize([
            station.operator.name, ...station.names, station.location, ...station.permits,
            dataset.categories.get(station.operator.category) || '', ...types, station.office, OFFICES[station.office] || ''
        ].join('\n'))
        station.frequencyText = ` ${station.frequencies.map(frequencyKey).join(' ')} `
    }
}

// Indeks częstotliwość nadawcza -> stacje (do wyszukiwania stacji na tej samej częstotliwości).
let frequencyIndex = null
export function stationsOnFrequency(frequency) {
    if (!frequencyIndex) {
        frequencyIndex = new Map()
        for (const station of dataset.stations) {
            for (const value of station.tx) {
                const key = frequencyKey(value)
                if (!frequencyIndex.has(key)) frequencyIndex.set(key, [])
                frequencyIndex.get(key).push(station)
            }
        }
    }
    return frequencyIndex.get(frequencyKey(frequency)) || []
}
