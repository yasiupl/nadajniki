// Eksport stacji: lista częstotliwości SDR# (XML) i tabela CSV (separator ";" dla polskiego Excela).
import { typeInfo } from './config.js'
import { formatFrequency } from './format.js'
import { stationPath } from './data.js'

const escapeXml = text => String(text).replace(/[<>&'"]/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char])

// Jedna pozycja na parę (częstotliwość nadawcza, operator).
export function toSdrSharp(stations) {
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
    const rows = [...entries.values()].sort((a, b) => a.frequency - b.frequency).map(entry => `  <MemoryEntry>
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

const csvCell = value => {
    const text = value === null || value === undefined ? '' : String(value)
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
const decimal = value => value === null || value === undefined ? '' : String(value).replace('.', ',')

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
    return '﻿' + [header, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n') + '\r\n'
}
