// Wyszukiwanie bez serwera: parser zapytania i dopasowanie stacji. Moduł nie używa DOM.
//
// Składnia zapytania:
//   słowa            wszystkie słowa muszą wystąpić (operator, nazwa, lokalizacja, pozwolenie, kategoria)
//   "fraza"          dokładny fragment tekstu
//   -słowo           stacje bez tego słowa
//   148.0125         częstotliwość, która zaczyna się od tych cyfr (także 148,0125)
//   148-149          zakres częstotliwości w MHz (także 148..149)
//   typ:A,C          rodzaj sieci
//   erp>10           moc ERP w dBW (operatory > >= < <= =)
//   r>20             promień obszaru obsługi w km
//   h>30             wysokość anteny w m
//   kanal:25         szerokość kanału w kHz
import { normalize } from './format.js'

const FIELD_ALIASES = {
    erp: 'erp',
    moc: 'erp',
    r: 'radius',
    promien: 'radius',
    zasieg: 'radius',
    h: 'antennaHeight',
    wys: 'antennaHeight',
    wysokosc: 'antennaHeight'
}

const NUMBER = '(\\d{2,3}(?:[.,]\\d*)?)'
const RANGE_PATTERN = new RegExp(`^${NUMBER}(?:-|–|\\.\\.)${NUMBER}$`)
const FREQUENCY_PATTERN = /^\d{2,3}[.,]\d*$/
const INTEGER_PATTERN = /^\d{2,3}$/
const CONDITION_PATTERN = /^([a-z]+)(>=|<=|>|<|=|:)(-?\d+(?:[.,]\d+)?)$/
const MIN_FREQUENCY = 25
const MAX_FREQUENCY = 1000

const toNumber = text => parseFloat(text.replace(',', '.'))
const isFrequency = value => value >= MIN_FREQUENCY && value <= MAX_FREQUENCY

function tokenize(input) {
    const tokens = []
    for (const match of String(input || '').matchAll(/(-?)"([^"]*)"?|(\S+)/g)) {
        if (match[3] !== undefined) tokens.push({ text: match[3], phrase: false, negative: false })
        else if (match[2].trim()) tokens.push({ text: match[2].trim(), phrase: true, negative: match[1] === '-' })
    }
    return tokens
}

export function parseQuery(input) {
    const query = {
        source: String(input || '').trim(),
        text: [],
        exclude: [],
        frequencies: [],
        mixed: [],
        ranges: [],
        types: [],
        conditions: [],
        bandwidths: []
    }
    for (const token of tokenize(input)) {
        if (token.phrase) {
            (token.negative ? query.exclude : query.text).push(normalize(token.text))
            continue
        }
        const text = normalize(token.text)
        const typeMatch = /^(?:typ|rodzaj):([a-z,]+)$/.exec(text)
        if (typeMatch) {
            query.types.push(...typeMatch[1].split(',').filter(Boolean).map(code => code.toUpperCase()))
            continue
        }
        const bandwidthMatch = /^(?:kanal|bw|szer):(\d+(?:[.,]\d+)?)$/.exec(text)
        if (bandwidthMatch) {
            query.bandwidths.push(toNumber(bandwidthMatch[1]))
            continue
        }
        const conditionMatch = CONDITION_PATTERN.exec(text)
        if (conditionMatch && FIELD_ALIASES[conditionMatch[1]]) {
            query.conditions.push({
                field: FIELD_ALIASES[conditionMatch[1]],
                operator: conditionMatch[2] === ':' ? '=' : conditionMatch[2],
                value: toNumber(conditionMatch[3])
            })
            continue
        }
        const value = text.replace(/^(?:f|czest):/, '')
        const rangeMatch = RANGE_PATTERN.exec(value)
        if (rangeMatch) {
            const [min, max] = [toNumber(rangeMatch[1]), toNumber(rangeMatch[2])].sort((a, b) => a - b)
            if (isFrequency(min) && isFrequency(max)) {
                query.ranges.push([min, max])
                continue
            }
        }
        if (FREQUENCY_PATTERN.test(value) && isFrequency(toNumber(value))) {
            query.frequencies.push(value.replace(',', '.'))
            continue
        }
        if (INTEGER_PATTERN.test(value) && isFrequency(toNumber(value))) {
            // "148" może być częstotliwością (148.xxx MHz) albo tekstem (numer domu, nazwa stacji).
            query.mixed.push(value)
            continue
        }
        if (text.length > 1 && text.startsWith('-')) query.exclude.push(text.slice(1))
        else query.text.push(text)
    }
    return query
}

export function isEmptyQuery(query) {
    return !query || (!query.text.length && !query.exclude.length && !query.frequencies.length && !query.mixed.length &&
        !query.ranges.length && !query.types.length && !query.conditions.length && !query.bandwidths.length)
}

function compare(left, operator, right) {
    switch (operator) {
        case '>': return left > right
        case '>=': return left >= right
        case '<': return left < right
        case '<=': return left <= right
        default: return Math.abs(left - right) < 1e-9
    }
}

// Stacja musi mieć pola: searchText (znormalizowany tekst), frequencyText (" 148.01250 150.20000 "),
// frequencies (liczby), types (np. "AC"), bandwidths, erp, radius, antennaHeight.
export function matchStation(station, query) {
    for (const text of query.text) if (!station.searchText.includes(text)) return false
    for (const text of query.exclude) if (station.searchText.includes(text)) return false
    for (const prefix of query.frequencies) if (!station.frequencyText.includes(` ${prefix}`)) return false
    for (const value of query.mixed) {
        if (!station.searchText.includes(value) && !station.frequencyText.includes(` ${value}.`)) return false
    }
    for (const [min, max] of query.ranges) {
        if (!station.frequencies.some(frequency => frequency >= min && frequency <= max)) return false
    }
    if (query.types.length && !query.types.some(type => station.types.includes(type))) return false
    for (const condition of query.conditions) {
        const value = station[condition.field]
        if (value === null || value === undefined || !compare(value, condition.operator, condition.value)) return false
    }
    if (query.bandwidths.length && !station.bandwidths.some(width => query.bandwidths.includes(width))) return false
    return true
}

// Trafność do sortowania podpowiedzi: dopasowanie nazwy operatora liczy się najbardziej.
export function scoreStation(station, query) {
    let score = 0
    const operator = station.operator.searchName
    for (const text of [...query.text, ...query.mixed]) {
        if (operator.startsWith(text)) score += 4
        else if (operator.includes(text)) score += 2
        if (station.nameText.includes(text)) score += 2
        if (station.locationText.includes(text)) score += 1
    }
    return score + query.frequencies.length * 3
}
