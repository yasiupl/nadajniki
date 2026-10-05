// Widoki "Pasma" i "Analiza". Wykresy pokazują stacje spełniające filtry w wybranym zakresie
// (cała Polska albo widok mapy). Kliknięcie słupka dodaje filtr.
import { BANDS, BANDWIDTHS, NETWORK_TYPES, OFFICES, typeInfo, bandOf } from '../config.js'
import { html, formatNumber, formatFrequency, frequencyKey, matchingLabel, countLabel } from '../format.js'
import { barList, columnChart, chartTable } from '../charts.js'
import { dataset } from '../data.js'
import { typeColor, emptyState, icon } from './common.js'

export function scopeToggle(scope, count) {
    return html`<div class="segmented" role="group" aria-label="Zakres danych">
        <button type="button" data-action="set-scope" data-value="all" aria-pressed="${scope === 'all'}">Cała Polska</button>
        <button type="button" data-action="set-scope" data-value="view" aria-pressed="${scope === 'view'}">Widok mapy</button>
    </div>
    <p class="muted small scope-note">${matchingLabel(count)}${scope === 'view' ? ' w widoku mapy' : ''}.</p>`
}

// --- Pasma ---

function histogram(stations, band) {
    const bins = Math.round((band.max - band.min) / band.bin)
    const counts = new Array(bins).fill(0)
    for (const station of stations) {
        const seen = new Set()
        for (const frequency of station.tx) {
            if (frequency < band.min || frequency >= band.max) continue
            const bin = Math.min(bins - 1, Math.floor((frequency - band.min) / band.bin + 1e-9))
            if (seen.has(bin)) continue
            seen.add(bin)
            counts[bin]++
        }
    }
    return counts
}

function frequencyTable(stations, band) {
    const rows = new Map()
    for (const station of stations) {
        for (const frequency of station.tx) {
            if (bandOf(frequency).key !== band.key) continue
            const key = frequencyKey(frequency)
            let row = rows.get(key)
            if (!row) {
                row = { frequency, stations: 0, operators: new Map() }
                rows.set(key, row)
            }
            row.stations++
            row.operators.set(station.operator.name, (row.operators.get(station.operator.name) || 0) + 1)
        }
    }
    return [...rows.values()]
}

export function renderBandsView({ stations, scope, bandKey, sort, limit, filters }) {
    const band = BANDS.find(item => item.key === bandKey) || BANDS[2]
    const bandCounts = new Map(BANDS.map(item => [item.key, 0]))
    for (const station of stations) for (const key of station.bandList) bandCounts.set(key, bandCounts.get(key) + 1)

    const selector = html`<div class="band-tabs" role="tablist" aria-label="Pasmo">
        ${BANDS.filter(item => item.key !== 'other' || bandCounts.get('other')).map(item => html`<button type="button" role="tab"
            data-action="set-band" data-value="${item.key}" aria-selected="${item.key === band.key}">
            <span>${item.short}</span><span class="muted small">${formatNumber(bandCounts.get(item.key))}</span>
        </button>`)}
    </div>`

    const inBand = stations.filter(station => station.bandList.includes(band.key))
    const rangeActive = filters.frequencyMin !== null || filters.frequencyMax !== null
    let chart = ''
    if (band.min !== null && inBand.length) {
        const counts = histogram(inBand, band)
        const columns = counts.map((value, index) => {
            const from = band.min + index * band.bin
            const to = from + band.bin
            return {
                label: `${formatNumber(from, 1)}–${formatNumber(to, 1)} MHz`,
                value,
                data: `${from}-${to}`,
                selected: rangeActive && filters.frequencyMin <= from + 1e-9 && filters.frequencyMax >= to - 1e-9
            }
        })
        const ticks = []
        for (let tick = Math.ceil(band.min / band.tick) * band.tick; tick < band.max; tick += band.tick) {
            ticks.push({ position: (tick - band.min) / (band.max - band.min), label: formatNumber(tick) })
        }
        chart = html`<section class="card-section">
            <div class="section-header"><h3>Zajętość pasma</h3></div>
            <p class="muted small">Liczba stacji, które nadają w przedziale ${formatNumber(band.bin, 1)} MHz. Kliknij kolumnę, aby pokazać ten przedział na mapie.</p>
            ${columnChart(columns, { ticks, action: 'filter-range', height: 130 })}
            ${chartTable(['Przedział', 'Stacje'], columns.filter(column => column.value).map(column => [column.label, column.value]))}
        </section>`
    }

    const rows = frequencyTable(stations, band)
    rows.sort(sort === 'count' ? (a, b) => b.stations - a.stations || a.frequency - b.frequency : (a, b) => a.frequency - b.frequency)
    const table = rows.length ? html`<section class="card-section">
        <div class="section-header">
            <h3>${countLabel(rows.length, 'częstotliwość', 'częstotliwości', 'częstotliwości')} nadawcze</h3>
            <div class="segmented small" role="group" aria-label="Sortowanie">
                <button type="button" data-action="band-sort" data-value="frequency" aria-pressed="${sort !== 'count'}">MHz</button>
                <button type="button" data-action="band-sort" data-value="count" aria-pressed="${sort === 'count'}">Liczba stacji</button>
            </div>
        </div>
        <table class="frequency-table interactive">
            <thead><tr><th>MHz</th><th class="number">Stacje</th><th>Główny operator</th></tr></thead>
            <tbody>${rows.slice(0, limit).map(row => {
                const [operator] = [...row.operators].sort((a, b) => b[1] - a[1])[0]
                return html`<tr data-action="filter-frequency" data-value="${row.frequency}" tabindex="0">
                    <td class="mono">${formatFrequency(row.frequency)}</td>
                    <td class="number">${formatNumber(row.stations)}</td>
                    <td class="truncate-cell" title="${operator}">${operator}${row.operators.size > 1 ? html` <span class="muted small">+${row.operators.size - 1}</span>` : ''}</td>
                </tr>`
            })}</tbody>
        </table>
        ${rows.length > limit ? html`<button type="button" class="button button-block" data-action="band-more">Pokaż więcej (${formatNumber(rows.length - limit)})</button>` : ''}
    </section>` : ''

    return html`<div class="view-header"><p class="view-title"><strong>Pasma</strong></p>
            <div class="view-actions">
                <button type="button" class="button" data-action="filter-band" data-value="${band.key}" title="Pokaż na mapie tylko stacje z tego pasma">${icon('filter_alt')}Filtruj pasmo</button>
            </div>
        </div>
        ${scopeToggle(scope, stations.length)}
        ${selector}
        ${inBand.length ? html`${chart}${table}` : emptyState(`Brak stacji w paśmie ${band.name}.`, 'Zmień zakres albo filtry.')}`
}

// --- Analiza ---

function countBy(stations, valuesOf) {
    const counts = new Map()
    for (const station of stations) {
        for (const value of valuesOf(station)) counts.set(value, (counts.get(value) || 0) + 1)
    }
    return counts
}

function statTile(label, value, note = '') {
    return html`<div class="stat-tile"><span class="stat-label">${label}</span><span class="stat-value">${value}</span>${note ? html`<span class="muted small">${note}</span>` : ''}</div>`
}

function chartSection(title, content, note = '') {
    return html`<section class="card-section">
        <div class="section-header"><h3>${title}</h3></div>
        ${note ? html`<p class="muted small">${note}</p>` : ''}
        ${content}
    </section>`
}

export function renderAnalysisView({ stations, scope, popular }) {
    if (!stations.length) return html`${scopeToggle(scope, 0)}${emptyState('Brak stacji do analizy.', 'Zmień filtry albo zakres.')}`

    const operators = countBy(stations, station => [station.operator])
    const frequencies = new Set()
    for (const station of stations) for (const frequency of station.tx) frequencies.add(frequencyKey(frequency))
    const newCount = stations.filter(station => station.since && station.since === dataset.release).length

    const types = countBy(stations, station => station.typeList)
    const typeRows = [...NETWORK_TYPES.map(type => type.code), ...[...types.keys()].filter(code => !NETWORK_TYPES.some(type => type.code === code))]
        .filter(code => types.get(code))
        .map(code => ({ label: `${code} · ${typeInfo(code).name}`, value: types.get(code), color: typeColor(code), swatch: typeColor(code), data: code }))

    const bands = countBy(stations, station => station.bandList)
    const bandRows = BANDS.filter(band => bands.get(band.key)).map(band => ({ label: band.name, value: bands.get(band.key), data: band.key }))

    const widths = countBy(stations, station => station.bandwidthKeys)
    const widthRows = BANDWIDTHS.filter(item => widths.get(item.key)).map(item => ({ label: item.name, value: widths.get(item.key), data: item.key }))

    const operatorRows = [...operators].sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([operator, value]) => ({ label: operator.name, value, data: operator.name }))

    const categories = countBy(stations, station => [station.operator.category])
    const categoryRows = [...categories].sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([key, value]) => ({ label: dataset.categories.get(key) || key, value, data: key }))

    const offices = countBy(stations, station => [station.office])
    const officeRows = [...offices].sort((a, b) => b[1] - a[1])
        .map(([code, value]) => ({ label: OFFICES[code] ? OFFICES[code].replace('Delegatura UKE ', '') : code || '–', value, data: code }))

    const year = new Date().getFullYear()
    const expiry = new Map()
    for (const station of stations) {
        if (!station.expiry) continue
        const expiryYear = Math.max(parseInt(station.expiry.slice(0, 4), 10), year - 1)
        expiry.set(expiryYear, (expiry.get(expiryYear) || 0) + 1)
    }
    const lastYear = Math.max(year + 10, ...expiry.keys())
    const expiryColumns = []
    for (let y = year - 1; y <= lastYear; y++) {
        expiryColumns.push({ label: y === year - 1 ? `do ${y}` : String(y), tip: y === year - 1 ? `Wygasłe (do ${y})` : `Wygasa w ${y}`, value: expiry.get(y) || 0 })
    }
    const expiryTicks = expiryColumns.map((column, index) => ({ position: (index + 0.5) / expiryColumns.length, label: column.label }))
        .filter((tick, index) => index % 2 === 1)

    let popularSection = ''
    if (popular?.stations.size) {
        const visible = new Set(stations)
        const top = [...popular.stations].map(([id, [visitors, pageviews]]) => ({ station: dataset.byId.get(id), visitors, pageviews }))
            .filter(item => item.station && visible.has(item.station))
            .sort((a, b) => b.pageviews - a.pageviews).slice(0, 10)
        if (top.length) {
            popularSection = chartSection('Najczęściej oglądane stacje', barList(top.map(item => ({
                label: `${item.station.operator.name}${item.station.name ? ` – ${item.station.name}` : ''}`,
                value: item.pageviews,
                data: item.station.id,
                swatch: typeColor(item.station.type)
            })), { action: 'open-station-value' }), `Wyświetlenia karty w ciągu ${popular.period === '30d' ? '30 dni' : popular.period} przed aktualizacją danych.`)
        }
    }

    return html`${scopeToggle(scope, stations.length)}
        <div class="stat-row">
            ${statTile('Stacje', formatNumber(stations.length))}
            ${statTile('Operatorzy', formatNumber(operators.size))}
            ${statTile('Częstotliwości', formatNumber(frequencies.size), 'nadawcze')}
            ${statTile('Nowe', formatNumber(newCount), 'w ostatnim wydaniu')}
        </div>
        ${chartSection('Rodzaje sieci', barList(typeRows, { action: 'toggle-type' }), 'Stacja z kilkoma rodzajami sieci liczy się w każdym z nich.')}
        ${chartSection('Pasma', barList(bandRows, { action: 'toggle-band' }))}
        ${chartSection('Szerokość kanału', barList(widthRows, { action: 'toggle-bandwidth' }), 'Kanał 12,5 kHz i węższy to zwykle sprzęt nowszy lub cyfrowy (DMR, dPMR).')}
        ${chartSection('Największe sieci', barList(operatorRows, { action: 'filter-operator' }), 'Operatorzy z największą liczbą stacji.')}
        ${chartSection('Kategorie operatorów', barList(categoryRows, { action: 'toggle-category' }))}
        ${chartSection('Wygasanie pozwoleń', html`${columnChart(expiryColumns, { ticks: expiryTicks, height: 110 })}
            ${chartTable(['Rok', 'Stacje'], expiryColumns.map(column => [column.tip, column.value]))}`,
            'Rok wygaśnięcia najwcześniejszego pozwolenia stacji.')}
        ${chartSection('Jednostka UKE, która wydała pozwolenie', barList(officeRows, { action: 'toggle-office' }))}
        ${popularSection}`
}
