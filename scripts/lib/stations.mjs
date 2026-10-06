// Przetwarzanie wierszy wykazu RRL na stacje.
// Stacja to wszystkie rekordy jednego operatora w jednym punkcie (te same współrzędne).
// Rekordy bez współrzędnych (np. grupy INTR, obszar całego kraju) tworzą jedną stację operatora.
import crypto from 'node:crypto'
import { CATEGORIES, NETWORK_SIZE_THRESHOLD } from './categories.mjs'

// Kolumny wykazu. Prefiks znormalizowanego nagłówka -> pole. Kolejność to układ domyślny.
const COLUMNS = [
    ['nrreferencyjny', 'permit'],
    ['waznado', 'expiry'],
    ['nazwastacji', 'name'],
    ['rodzstacji', 'stationType'],
    ['rodzsieci', 'networkType'],
    ['dlgeo', 'lon'],
    ['szergeo', 'lat'],
    ['robsl', 'radius'],
    ['lokalizacjastacji', 'location'],
    ['erp', 'erp'],
    ['azymut', 'azimuth'],
    ['elewacja', 'elevation'],
    ['polar', 'polarization'],
    ['zyskant', 'gain'],
    ['hanteny', 'antennaHeight'],
    ['hterenu', 'groundHeight'],
    ['chkapoz', 'hChar'],
    ['chkapion', 'vChar'],
    ['czestotliwoscinadawcze', 'tx'],
    ['czestotliwosciodbiorcze', 'rx'],
    ['szerkanalownad', 'txSpan'],
    ['szerkanalowodb', 'rxSpan'],
    ['operator', 'op'],
    ['adresoperatora', 'opAddress']
]

// Pola rekordu w pliku szczegółów (dist/data/details/*.json), w tej kolejności.
export const DETAIL_FIELDS = ['permit', 'expiry', 'name', 'stationType', 'networkType', 'radius', 'location',
    'erp', 'azimuth', 'elevation', 'polarization', 'gain', 'antennaHeight', 'groundHeight', 'hChar', 'vChar',
    'tx', 'rx', 'txSpan', 'rxSpan']

// Pola skróconego rekordu stacji (dist/data/stations.json), w tej kolejności.
// badLocation: współrzędne z wykazu spoza obszaru Polski (błąd w wykazie) albo 0.
export const STATION_FIELDS = ['id', 'operator', 'lat', 'lon', 'names', 'location', 'networkTypes', 'stationTypes',
    'tx', 'rx', 'bandwidths', 'erp', 'radius', 'antennaHeight', 'expiry', 'permits', 'office', 'units', 'badLocation']

const STATION_TYPE_ORDER = ['FB', 'FS', 'FC', 'FW', 'ML', 'MO', 'MS']

function normalizeHeader(text) {
    return String(text).toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[^a-z0-9]/g, '')
}

function columnMap(header) {
    const map = COLUMNS.map(([, field]) => field)
    if (!header) return map
    const found = header.map(cell => {
        const key = normalizeHeader(cell)
        // Najdłuższy pasujący prefiks: "adresoperatora" nie może trafić w "operator".
        let best = null
        for (const [prefix, field] of COLUMNS) {
            if (key.startsWith(prefix) && (!best || prefix.length > best[0].length)) best = [prefix, field]
        }
        return best?.[1]
    })
    return found.filter(Boolean).length >= COLUMNS.length - 2 ? found : map
}

function clean(value) {
    const text = value == null ? '' : String(value)
    return /\s\s|[\t\n\r\u00a0]/.test(text) ? text.replace(/\s+/g, ' ').trim() : text.trim()
}

// Pamięć podręczna dla wartości, które powtarzają się w tysiącach rekordów.
function memoize(fn) {
    const cache = new Map()
    return value => {
        let result = cache.get(value)
        if (result === undefined) {
            result = fn(value)
            cache.set(value, result)
        }
        return result
    }
}

// Liczba seryjna daty Excela -> "RRRR-MM-DD".
export const excelDate = memoize(value => {
    const text = clean(value)
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
    const serial = parseFloat(text)
    if (!Number.isFinite(serial)) return ''
    return new Date(Math.round((serial - 25569) * 86400 * 1000)).toISOString().slice(0, 10)
})

// "23E07'10\"" -> 23.119444. Zwraca null dla pustych i błędnych wartości.
export function parseDms(value) {
    const match = /^(\d+)\s*([NSEW])\s*(\d+)'\s*(\d+(?:[.,]\d+)?)/.exec(clean(value))
    if (!match) return null
    const decimal = parseInt(match[1], 10) + parseInt(match[3], 10) / 60 + parseFloat(match[4].replace(',', '.')) / 3600
    return Math.round(decimal * (/[SW]/.test(match[2]) ? -1 : 1) * 1e5) / 1e5
}

// "148.01250, 148.02500" -> [148.0125, 148.025]
export function parseList(value) {
    return clean(value).split(',').map(item => item.trim())
        .filter(item => item && item !== '-')
        .map(item => Math.round(parseFloat(item.replace(',', '.')) * 1e5) / 1e5)
        .filter(Number.isFinite)
}

function parseNumber(value) {
    const number = parseFloat(clean(value).replace(',', '.'))
    return Number.isFinite(number) ? number : null
}

// Pola liczbowe mają w kolejnych wydaniach różny zapis ("9.3000000000000007", "9.300000000000001", "3,7").
// Zapis kanoniczny usuwa te różnice, więc porównanie wydań pokazuje tylko rzeczywiste zmiany.
const NUMBER_FIELDS = ['radius', 'erp', 'azimuth', 'elevation', 'gain', 'antennaHeight', 'groundHeight']
const LIST_FIELDS = ['tx', 'rx', 'txSpan', 'rxSpan']

const canonicalNumber = memoize(value => {
    const number = parseNumber(value)
    return number === null ? clean(value).replace(/^-$/, '') : String(Math.round(number * 1e5) / 1e5)
})

const parseListCached = memoize(parseList)

// Klucz operatora: bez wielkości liter, spacji i interpunkcji ("Sp. z o. o." == "sp. z o.o.").
export const operatorKey = memoize(name => clean(name).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ''))

// Kod jednostki UKE z nazwy pliku: "dc_-_stan_na_2026-09-25.xlsx" -> "DC".
export function officeFromFile(name) {
    return (/^([a-z]+)/i.exec(name.split(/[\\/]/).pop())?.[1] || '').toUpperCase()
}

// Obszar stacji z polskich pozwoleń (z polską strefą Bałtyku). Współrzędne poza nim to błąd w wykazie.
const AREA = { south: 48.5, north: 56, west: 13.5, east: 25 }
export function inArea(lat, lon) {
    return lat !== null && lon !== null && lat >= AREA.south && lat <= AREA.north && lon >= AREA.west && lon <= AREA.east
}

// Arkusze jednego pliku -> rekordy z nazwanymi polami.
// Pole "parsed" zawiera wartości liczbowe i listy, żeby nie parsować ich wielokrotnie.
export function parseSheets(sheets, office) {
    const records = []
    for (const sheet of sheets) {
        const [header, ...rows] = sheet.rows
        const fields = columnMap(header)
        for (const row of rows) {
            const record = { office }
            let empty = true
            for (let i = 0; i < fields.length; i++) {
                if (!fields[i]) continue
                const value = clean(row[i])
                record[fields[i]] = value
                if (value) empty = false
            }
            if (empty || (!record.permit && !record.op)) continue
            record.expiry = excelDate(record.expiry)
            for (const field of NUMBER_FIELDS) record[field] = canonicalNumber(record[field])
            const parsed = {}
            for (const field of LIST_FIELDS) {
                parsed[field] = parseListCached(record[field])
                record[field] = parsed[field].join(', ')
            }
            // Niektóre rekordy mają zamienione kolumny długości i szerokości geograficznej.
            if (/[EW]/.test(record.lat) && /[NS]/.test(record.lon)) [record.lat, record.lon] = [record.lon, record.lat]
            parsed.lat = parseDms(record.lat)
            parsed.lon = parseDms(record.lon)
            if (parsed.lat === 0 && parsed.lon === 0) {
                record.lat = record.lon = ''
                parsed.lat = parsed.lon = null
            }
            // Niektóre rekordy mają zamienione wartości, ale poprawne litery kierunku.
            if (!inArea(parsed.lat, parsed.lon) && inArea(parsed.lon, parsed.lat)) [parsed.lat, parsed.lon] = [parsed.lon, parsed.lat]
            parsed.erp = parseNumber(record.erp)
            parsed.radius = parseNumber(record.radius)
            parsed.antennaHeight = parseNumber(record.antennaHeight)
            record.parsed = parsed
            records.push(record)
        }
    }
    return records
}

function unique(values) {
    return [...new Set(values)]
}

function sortedNumbers(values) {
    return unique(values).sort((a, b) => a - b)
}

function max(values) {
    const numbers = values.filter(value => value !== null)
    return numbers.length ? Math.max(...numbers) : null
}

function mostCommon(values) {
    const counts = new Map()
    for (const value of values) if (value) counts.set(value, (counts.get(value) || 0) + 1)
    let best = ''
    let bestCount = 0
    for (const [value, count] of counts) if (count > bestCount) [best, bestCount] = [value, count]
    return best
}

function shortHash(text, length = 8) {
    return crypto.createHash('sha1').update(text).digest('hex').slice(0, length)
}

// Rekordy -> Map(id -> stacja). Identyfikator zależy tylko od operatora i położenia,
// więc ta sama stacja ma ten sam identyfikator w kolejnych wydaniach wykazu.
export function groupStations(records) {
    const groups = new Map()
    for (const record of records) {
        const opKey = operatorKey(record.op)
        const lat = record.parsed.lat
        const lon = record.parsed.lon
        const located = lat !== null && lon !== null
        const key = located ? `${opKey}|${lon.toFixed(4)}|${lat.toFixed(4)}` : `${opKey}|-`
        let group = groups.get(key)
        if (!group) {
            // Stacja z błędnymi współrzędnymi zachowuje identyfikator, ale nie ma położenia na mapie.
            const valid = located && inArea(lat, lon)
            group = {
                key, opKey, lat: valid ? lat : null, lon: valid ? lon : null,
                badLocation: located && !valid ? [lat, lon] : null, records: [], seen: new Set()
            }
            groups.set(key, group)
        }
        const detail = DETAIL_FIELDS.map(field => record[field] ?? '')
        const detailKey = detail.join('\u0001')
        if (group.seen.has(detailKey)) continue
        group.seen.add(detailKey)
        group.records.push(record)
        group.office = group.office || record.office
    }

    const stations = new Map()
    for (const key of [...groups.keys()].sort()) {
        const group = groups.get(key)
        let length = 10
        let id = shortHash(key, length)
        while (stations.has(id)) id = shortHash(key, ++length)
        delete group.seen
        group.id = id
        stations.set(id, group)
    }
    return stations
}

// Tabela operatorów: nazwa i adres w najczęstszym zapisie, kategoria i liczba stacji.
export function buildOperators(stations) {
    const byKey = new Map()
    for (const station of stations.values()) {
        let operator = byKey.get(station.opKey)
        if (!operator) {
            operator = { key: station.opKey, names: [], addresses: [], stations: 0 }
            byKey.set(station.opKey, operator)
        }
        operator.stations++
        for (const record of station.records) {
            operator.names.push(record.op)
            operator.addresses.push(record.opAddress)
        }
    }
    const operators = [...byKey.values()].map(operator => {
        const name = mostCommon(operator.names)
        return { key: operator.key, name, address: mostCommon(operator.addresses), stations: operator.stations, category: categoryOf(name, operator) }
    })
    operators.sort((a, b) => b.stations - a.stations || a.name.localeCompare(b.name, 'pl'))
    return operators
}

function categoryOf(name, operator) {
    const lower = name.toLowerCase()
    for (const category of CATEGORIES) {
        if (category.match && category.match.test(lower)) return category.key
    }
    if (operator.stations > NETWORK_SIZE_THRESHOLD) return `op-${shortHash(operator.key, 6)}`
    return operator.stations > 1 ? 'small' : 'single'
}

// Skrócony rekord stacji (kolejność pól: STATION_FIELDS).
export function compactStation(station, operatorIndex) {
    const records = station.records
    const fixedRecords = records.filter(record => record.stationType.startsWith('F'))
    const fixed = fixedRecords[0] || records[0]
    // Nazwy stacji stałych. Nazwy grup stacji ruchomych ("NOSZONA 1,2") są tylko w szczegółach.
    const names = unique([fixed.name, ...fixedRecords.map(record => record.name)].filter(Boolean)).slice(0, 5)
    const location = fixed.location || records.find(record => record.location)?.location || ''
    const networkTypes = unique(records.map(record => record.networkType).filter(Boolean)).sort().join('')
    const stationTypes = unique(records.map(record => record.stationType).filter(Boolean))
        .sort((a, b) => (STATION_TYPE_ORDER.indexOf(a) + 1 || 99) - (STATION_TYPE_ORDER.indexOf(b) + 1 || 99))
        .join(' ')
    const tx = sortedNumbers(records.flatMap(record => record.parsed.tx))
    const rx = sortedNumbers(records.flatMap(record => record.parsed.rx))
    const bandwidths = sortedNumbers(records.flatMap(record => [...record.parsed.txSpan, ...record.parsed.rxSpan]))
    const expiry = records.map(record => record.expiry).filter(Boolean).sort()[0] || ''
    const permits = unique(records.map(record => record.permit).filter(Boolean)).sort()

    return [
        station.id,
        operatorIndex,
        station.lat,
        station.lon,
        names,
        location,
        networkTypes,
        stationTypes,
        tx,
        rx.join() === tx.join() ? 0 : rx,
        bandwidths,
        max(records.map(record => record.parsed.erp)),
        max(records.map(record => record.parsed.radius)),
        max(records.map(record => record.parsed.antennaHeight)),
        expiry,
        permits,
        station.office || '',
        records.length,
        station.badLocation || 0
    ]
}

// Rekordy szczegółowe stacji (kolejność pól: DETAIL_FIELDS).
export function detailRecords(station) {
    return station.records.map(record => DETAIL_FIELDS.map(field => record[field] ?? ''))
}

// Sygnatury do wykrywania zmian między wydaniami:
// f - częstotliwości, p - pozwolenia, t - parametry techniczne, u - urządzenia (nazwy, rodzaje, liczba rekordów).
export function signature(station) {
    const records = station.records
    const join = values => shortHash(values.join('\u0001'))
    return {
        f: join([
            sortedNumbers(records.flatMap(record => record.parsed.tx)).join(','),
            sortedNumbers(records.flatMap(record => record.parsed.rx)).join(',')
        ]),
        p: join(unique(records.map(record => `${record.permit} ${record.expiry}`)).sort()),
        t: join(unique(records.map(record => [record.stationType, record.erp, record.radius, record.azimuth, record.elevation,
            record.polarization, record.gain, record.antennaHeight, record.groundHeight, record.hChar, record.vChar,
            record.txSpan, record.rxSpan].join(' '))).sort()),
        u: join([...unique(records.map(record => `${record.stationType} ${record.name}`)).sort(), String(records.length)])
    }
}

// Wszystkie częstotliwości stacji (nadawcze i odbiorcze), do opisu zmian.
export function allFrequencies(station) {
    return sortedNumbers(station.records.flatMap(record => [...record.parsed.tx, ...record.parsed.rx]))
}
