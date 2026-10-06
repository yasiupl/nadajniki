// Eksport stacji:
// - SDR# (XML): lista częstotliwości dla programu SDR#,
// - CHIRP (CSV): kanały do programowania radiotelefonów i skanerów, tylko do odbioru,
// - tabela CSV (separator ";" dla polskiego Excela).
import { typeInfo } from './config.js'
import { formatFrequency, toAscii } from './format.js'
import { stationPath } from './data.js'

const escapeXml = text => String(text).replace(/[<>&'"]/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char])

// --- SDR# ---

// Jedna pozycja na parę (częstotliwość nadawcza, operator).
export function sdrEntries(stations) {
    const entries = new Map()
    for (const station of stations) {
        const width = station.bandwidths.length ? Math.min(...station.bandwidths) : 12.5
        for (const frequency of station.tx) {
            const key = `${frequency}|${station.operator.name}`
            if (entries.has(key)) continue
            const name = `${station.operator.name}${station.name ? ` – ${station.name}` : ''}`
            entries.set(key, { frequency, name: name.length > 60 ? `${name.slice(0, 59)}…` : name, group: typeInfo(station.type).name, width })
        }
    }
    return [...entries.values()].sort((a, b) => a.frequency - b.frequency)
}

export function toSdrSharp(stations) {
    const rows = sdrEntries(stations).map(entry => `  <MemoryEntry>
    <IsFavourite>false</IsFavourite>
    <Name>${escapeXml(entry.name)}</Name>
    <GroupName>${escapeXml(entry.group)}</GroupName>
    <Frequency>${Math.round(entry.frequency * 1e6)}</Frequency>
    <DetectorType>NFM</DetectorType>
    <Shift>0</Shift>
    <FilterBandwidth>${Math.round(entry.width * 1000)}</FilterBandwidth>
  </MemoryEntry>`)
    return `<?xml version="1.0"?>
<ArrayOfMemoryEntry xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
${rows.join('\n')}
</ArrayOfMemoryEntry>
`
}

// --- CHIRP ---

// CHIRP przyjmuje w pliku CSV kanały 0–999.
export const CHIRP_LIMIT = 1000
const CHIRP_HEADER = ['Location', 'Name', 'Frequency', 'Duplex', 'Offset', 'Tone', 'rToneFreq', 'cToneFreq', 'DtcsCode',
    'DtcsPolarity', 'Mode', 'TStep', 'Skip', 'Comment', 'URCALL', 'RPT1CALL', 'RPT2CALL', 'DVCODE']
const CHIRP_NAME_LENGTH = 8
const LEGAL_FORMS = [
    /\bsp(olka)?\.?\s*z\s*o(graniczona)?\.?\s*o(dpowiedzialnoscia)?\.?(?=\s|$|[,;)])/gi,
    /\bspolka\s+(akcyjna|jawna|komandytowa|cywilna)\b/gi,
    /\bs\.\s*a\.?(?=\s|$|[,;)])/gi,
    /\bsp\.\s*[jk]\.?(?=\s|$|[,;)])/gi
]
const STOP_WORDS = new Set(['i', 'w', 'we', 'z', 'ze', 'na', 'do', 'od', 'dla', 'oraz', 'im', 'imienia', 'o', 'the', 'and', 'of'])

// Krótka nazwa kanału z nazwy operatora: skróty zostają, pozostałe słowa dają pierwsze litery.
// "PKP Polskie Linie Kolejowe S.A." -> "PKP PLK", "Lotnicze Pogotowie Ratunkowe" -> "LPR".
export function chirpName(operatorName) {
    let text = toAscii(operatorName).replace(/\([^)]*\)/g, ' ').replace(/["'„”`]/g, ' ')
    for (const pattern of LEGAL_FORMS) text = text.replace(pattern, ' ')
    const words = text.split(/[\s\-–/,.;:]+/).filter(word => /[a-z]/i.test(word) && !STOP_WORDS.has(word.toLowerCase()))
    const parts = []
    let initials = ''
    for (const word of words) {
        if (/^[A-Z0-9]{2,5}$/.test(word)) {
            if (initials) parts.push(initials)
            initials = ''
            parts.push(word)
        } else {
            initials += word[0].toUpperCase()
        }
    }
    if (initials) parts.push(initials)
    let name = parts.join(' ')
    if (name.replace(/\s/g, '').length < 3 && words.length) name = words[0].toUpperCase()
    return name.slice(0, CHIRP_NAME_LENGTH).trim()
}

// Krok strojenia, który pasuje do częstotliwości (12,5 kHz, 6,25 kHz, 5 kHz albo 2,5 kHz).
function tuningStep(frequency) {
    const hertz = Math.round(frequency * 1e6)
    for (const step of [12500, 6250, 5000]) if (hertz % step === 0) return (step / 1000).toFixed(2)
    return '2.50'
}

// Jeden kanał na częstotliwość nadawczą. Nazwa kanału pochodzi od operatora z największą liczbą
// stacji na tej częstotliwości.
export function chirpChannels(stations) {
    const byFrequency = new Map()
    for (const station of stations) {
        for (const frequency of station.tx) {
            if (!byFrequency.has(frequency)) byFrequency.set(frequency, [])
            byFrequency.get(frequency).push(station)
        }
    }
    return [...byFrequency].sort((a, b) => a[0] - b[0]).map(([frequency, list]) => {
        const counts = new Map()
        for (const station of list) counts.set(station.operator.name, (counts.get(station.operator.name) || 0) + 1)
        const [operator] = [...counts].sort((a, b) => b[1] - a[1])[0]
        const station = list.find(item => item.operator.name === operator)
        const others = counts.size - 1
        const comment = `${operator}${station.name ? ` - ${station.name}` : ''}${others ? ` (+${others} innych operatorow)` : ''}`
        return {
            frequency,
            name: chirpName(operator),
            // Kanał 20 kHz i szerszy: FM. Węższy albo nieznany: NFM (wąskopasmowa FM).
            mode: station.bandwidths.length && Math.min(...station.bandwidths) >= 20 ? 'FM' : 'NFM',
            step: tuningStep(frequency),
            comment: toAscii(comment).slice(0, 120)
        }
    })
}

const commaCell = value => {
    const text = String(value ?? '')
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

// Plik CSV dla CHIRP. Każdy kanał ma wyłączone nadawanie (Duplex "off"): strona podaje
// częstotliwości tylko do nasłuchu. Bez znacznika BOM, bo CHIRP czyta nagłówek dosłownie.
export function toChirp(stations) {
    const rows = chirpChannels(stations).slice(0, CHIRP_LIMIT).map((channel, location) => [
        location, channel.name, channel.frequency.toFixed(6), 'off', '0.000000', '', '88.5', '88.5', '023', 'NN',
        channel.mode, channel.step, '', channel.comment, '', '', '', ''
    ])
    return [CHIRP_HEADER, ...rows].map(row => row.map(commaCell).join(',')).join('\r\n') + '\r\n'
}

// --- Tabela CSV ---

const csvCell = value => {
    const text = value === null || value === undefined ? '' : String(value)
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
const decimal = value => value === null || value === undefined ? '' : String(value).replace('.', ',')

// Znacznik BOM pozwala Excelowi rozpoznać kodowanie UTF-8.
export function toCsv(stations, origin = '') {
    const header = ['Operator', 'Nazwa stacji', 'Lokalizacja', 'Rodzaj sieci', 'Częstotliwości nadawcze [MHz]',
        'Częstotliwości odbiorcze [MHz]', 'Szerokości kanałów [kHz]', 'ERP [dBW]', 'Promień obsługi [km]',
        'Wysokość anteny [m]', 'Szerokość geograficzna', 'Długość geograficzna', 'Pozwolenia', 'Ważne do',
        'W wykazie od', 'Usunięta', 'Link']
    const rows = stations.map(station => [
        station.operator.name,
        station.name,
        station.location,
        [...station.types].map(code => `${code} ${typeInfo(code).name}`).join(', '),
        station.tx.map(formatFrequency).join(', '),
        station.rx.map(formatFrequency).join(', '),
        station.bandwidths.map(decimal).join(', '),
        decimal(station.erp),
        decimal(station.radius),
        decimal(station.antennaHeight),
        decimal(station.lat),
        decimal(station.lon),
        station.permits.join(', '),
        station.expiry,
        station.since,
        station.removed,
        `${origin}${stationPath(station)}`
    ])
    return '\ufeff' + [header, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n') + '\r\n'
}
