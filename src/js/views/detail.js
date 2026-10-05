// Karta stacji.
import { typeInfo, stationTypeName, OFFICES, CHANGE_ASPECTS } from '../config.js'
import {
    html, formatNumber, formatFrequency, formatErp, formatDate, formatDms, formatDistance, formatRelativeMonths,
    monthsUntil, stationsLabel, countLabel, plural
} from '../format.js'
import { dataset } from '../data.js'
import { typeColor, historyBadges, icon } from './common.js'

const POLARIZATIONS = { V: 'pionowa', H: 'pozioma', M: 'mieszana' }
const OMNIDIRECTIONAL = '000ND00'

const list = text => String(text || '').split(',').map(item => item.trim()).filter(Boolean)
const numbers = text => list(text).map(Number).filter(Number.isFinite)
const unique = values => [...new Set(values.filter(value => value !== '' && value !== null && value !== undefined))]

// Pary częstotliwości (nadawanie, odbiór, szerokość kanału) z rekordów pozwolenia.
function frequencyPairs(records) {
    const pairs = new Map()
    for (const record of records) {
        const tx = numbers(record.tx)
        const rx = numbers(record.rx)
        const spans = numbers(record.txSpan)
        const count = Math.max(tx.length, rx.length)
        for (let i = 0; i < count; i++) {
            const pair = { tx: tx[i] ?? null, rx: rx[i] ?? null, span: spans[i] ?? spans[0] ?? null }
            const key = `${pair.tx}|${pair.rx}|${pair.span}`
            if (!pairs.has(key)) pairs.set(key, { ...pair, stationTypes: new Set() })
            pairs.get(key).stationTypes.add(record.stationType)
        }
    }
    return [...pairs.values()].sort((a, b) => (a.tx ?? a.rx) - (b.tx ?? b.rx))
}

function section(title, content, { id = '', action = null } = {}) {
    return html`<section class="card-section"${id ? html` id="${id}"` : ''}>
        <div class="section-header"><h3>${title}</h3>${action || ''}</div>
        ${content}
    </section>`
}

function fact(label, value, hint = '') {
    return html`<div class="fact"><dt>${label}</dt><dd>${value}${hint ? html` <span class="muted small">${hint}</span>` : ''}</dd></div>`
}

function frequenciesSection(station, records) {
    const copyAction = html`<button type="button" class="text-button" data-action="copy-frequencies">${icon('content_copy')}Kopiuj</button>`
    if (!records) {
        return section('Częstotliwości', html`<div class="chips">${station.tx.map(frequency =>
            html`<button type="button" class="chip mono" data-action="filter-frequency" data-value="${frequency}">${formatFrequency(frequency)}</button>`)}</div>`,
        { action: copyAction })
    }
    const pairs = frequencyPairs(records)
    return section('Częstotliwości', html`<table class="frequency-table">
        <thead><tr><th>Nadawanie [MHz]</th><th>Odbiór [MHz]</th><th class="number">Kanał</th><th>Stacje</th></tr></thead>
        <tbody>${pairs.map(pair => {
            const shift = pair.tx !== null && pair.rx !== null && Math.abs(pair.tx - pair.rx) > 1e-6 ? pair.rx - pair.tx : null
            return html`<tr>
                <td>${pair.tx !== null ? html`<button type="button" class="link-button mono" data-action="filter-frequency" data-value="${pair.tx}" title="Pokaż stacje na tej częstotliwości">${formatFrequency(pair.tx)}</button>` : '–'}</td>
                <td class="mono">${pair.rx !== null ? formatFrequency(pair.rx) : '–'}${shift !== null ? html`<span class="muted small"> (${shift > 0 ? '+' : '−'}${formatNumber(Math.abs(shift), 4)})</span>` : ''}</td>
                <td class="number">${pair.span !== null ? `${formatNumber(pair.span, 2)} kHz` : '–'}</td>
                <td>${[...pair.stationTypes].join(' ')}</td>
            </tr>`
        })}</tbody>
    </table>
    <p class="muted small">Kliknij częstotliwość nadawczą, aby zobaczyć inne stacje na tej częstotliwości.</p>`, { action: copyAction })
}

function parametersSection(station, records) {
    const fixed = records?.filter(record => record.stationType.startsWith('F')) || []
    const source = fixed.length ? fixed : records || []
    const ground = unique(source.map(record => record.groundHeight))
    const polarizations = unique(source.map(record => record.polarization)).map(code => POLARIZATIONS[code] || code)
    const gains = unique(source.map(record => record.gain))
    const azimuths = unique(source.map(record => record.azimuth))
    const characteristics = unique(source.flatMap(record => [record.hChar, record.vChar]))
    return section('Parametry', html`<dl class="facts">
        ${fact('Maksymalna moc ERP', formatErp(station.erp))}
        ${fact('Promień obszaru obsługi', station.radius !== null && station.radius !== undefined ? `${formatNumber(station.radius, 1)} km` : '–')}
        ${fact('Wysokość anteny', station.antennaHeight !== null && station.antennaHeight !== undefined ? `${formatNumber(station.antennaHeight, 1)} m` : '–', 'nad poziomem terenu')}
        ${ground.length ? fact('Wysokość terenu', ground.map(value => `${formatNumber(Number(value))} m`).join(', '), 'n.p.m.') : ''}
        ${polarizations.length ? fact('Polaryzacja', polarizations.join(', ')) : ''}
        ${gains.length ? fact('Zysk anteny', gains.map(value => `${formatNumber(Number(value), 1)} dB`).join(', '), 'względem dipola') : ''}
        ${azimuths.length ? fact('Azymut', azimuths.map(value => `${value}°`).join(', ')) : ''}
        ${characteristics.length ? fact('Charakterystyka anteny', characteristics.map(code => code === OMNIDIRECTIONAL ? 'dookólna' : code).join(', ')) : ''}
        ${fact('Szerokość kanału', station.bandwidths.map(width => `${formatNumber(width, 2)} kHz`).join(', ') || '–')}
    </dl>`)
}

function recordsSection(records) {
    if (!records) return ''
    return section(`Rekordy wykazu (${records.length})`, html`<p class="muted small">Jeden rekord opisuje stację stałą albo grupę stacji ruchomych z jednego pozwolenia.</p>
        <ul class="record-list">${records.map(record => html`<li>
            <details>
                <summary>
                    <span class="code-badge" title="${stationTypeName(record.stationType)}">${record.stationType || '?'}</span>
                    <span class="truncate">${record.name || 'Bez nazwy'}</span>
                    <span class="muted small">${numbers(record.tx).length} częst. · ${record.erp !== '' ? `${record.erp} dBW` : '–'}</span>
                </summary>
                <dl class="facts compact">
                    ${fact('Rodzaj stacji', `${record.stationType} – ${stationTypeName(record.stationType)}`)}
                    ${fact('Rodzaj sieci', `${record.networkType} – ${typeInfo(record.networkType).name}`)}
                    ${fact('Pozwolenie', record.permit, `ważne do ${formatDate(record.expiry)}`)}
                    ${record.location ? fact('Lokalizacja', record.location) : ''}
                    ${fact('Nadawanie [MHz]', list(record.tx).join(', ') || '–')}
                    ${fact('Odbiór [MHz]', list(record.rx).join(', ') || '–')}
                    ${fact('ERP', record.erp !== '' ? `${record.erp} dBW` : '–')}
                    ${fact('Promień obsługi', record.radius !== '' ? `${record.radius} km` : '–')}
                    ${fact('Wysokość anteny', record.antennaHeight !== '' ? `${record.antennaHeight} m` : '–')}
                    ${record.groundHeight !== '' ? fact('Wysokość terenu', `${record.groundHeight} m n.p.m.`) : ''}
                    ${record.azimuth !== '' ? fact('Azymut / elewacja', `${record.azimuth}° / ${record.elevation || 0}°`) : ''}
                    ${fact('Polaryzacja, zysk', `${POLARIZATIONS[record.polarization] || record.polarization || '–'}, ${record.gain !== '' ? `${record.gain} dB` : '–'}`)}
                    ${fact('Charakterystyka (poz. / pion.)', `${record.hChar || '–'} / ${record.vChar || '–'}`)}
                </dl>
            </details>
        </li>`)}</ul>`)
}

function permitsSection(station, records) {
    const permits = records
        ? unique(records.map(record => `${record.permit}|${record.expiry}`)).map(item => item.split('|'))
        : station.permits.map(permit => [permit, station.expiry])
    return section('Pozwolenia', html`<ul class="plain-list">${permits.map(([permit, expiry]) => {
        const months = monthsUntil(expiry)
        const warning = months !== null && months < 6
        return html`<li class="permit${warning ? ' warning' : ''}">
            <span class="mono">${permit}</span>
            <span>ważne do ${formatDate(expiry)} <span class="muted small">(${formatRelativeMonths(expiry)})</span>${warning ? html` ${icon('schedule')}` : ''}</span>
        </li>`
    })}</ul>
    ${station.office ? html`<p class="muted small">Wydał: ${OFFICES[station.office] || station.office}</p>` : ''}`)
}

function operatorSection(station) {
    const operator = station.operator
    return section('Operator', html`<p><strong>${operator.name}</strong><br><span class="muted">${operator.address || ''}</span></p>
        ${operator.stations > 1 ? html`<button type="button" class="button" data-action="filter-operator" data-value="${operator.name}">${icon('filter_alt')}Pokaż ${stationsLabel(operator.stations)} operatora</button>` : ''}`)
}

function locationSection(station) {
    if (station.lat === null && station.badLocation) {
        const [lat, lon] = station.badLocation
        return section('Lokalizacja', html`<p>${station.location || ''}</p>
            <p class="notice">${icon('location_off')} Wykaz podaje współrzędne poza Polską: <span class="mono">${formatDms(lat, 'N', 'S')} ${formatDms(lon, 'E', 'W')}</span>. To prawdopodobnie błąd w wykazie, więc mapa nie pokazuje tej stacji.</p>`)
    }
    if (station.lat === null) {
        return section('Lokalizacja', html`<p>Rekordy bez współrzędnych. Nazwa grupy z przedrostkiem INTR oznacza obszar całego kraju.</p>`)
    }
    const coordinates = `${station.lat.toFixed(5)}, ${station.lon.toFixed(5)}`
    return section('Lokalizacja', html`<p>${station.location || ''}</p>
        <p class="mono">${formatDms(station.lat, 'N', 'S')} ${formatDms(station.lon, 'E', 'W')}<br><span class="muted">${coordinates}</span></p>
        <div class="button-row">
            <button type="button" class="button" data-action="copy-text" data-value="${coordinates}">${icon('content_copy')}Kopiuj</button>
            <a class="button" href="https://www.google.com/maps/search/?api=1&query=${station.lat},${station.lon}" target="_blank" rel="noopener">Google Maps</a>
            <a class="button" href="https://www.openstreetmap.org/?mlat=${station.lat}&mlon=${station.lon}#map=15/${station.lat}/${station.lon}" target="_blank" rel="noopener">OpenStreetMap</a>
        </div>
        ${station.radius ? html`<p class="muted small">Zaznaczone koło to obszar obsługi z pozwolenia (promień ${formatNumber(station.radius, 1)} km). Służy do koordynacji międzynarodowej i nie jest pomiarem zasięgu.</p>` : ''}`)
}

function sharedFrequencySection(station, shared) {
    if (!shared.length) return ''
    return section('Ta sama częstotliwość nadawcza', html`<p class="muted small">Inne stacje w wykazie, które nadają na tej częstotliwości, i najbliższa z nich.</p>
        <table class="frequency-table shared">
            <thead><tr><th>MHz</th><th class="number">Inne</th><th>Najbliższa</th></tr></thead>
            <tbody>${shared.map(item => {
                const nearest = item.nearest[0]
                return html`<tr>
                    <td><button type="button" class="link-button mono" data-action="filter-frequency" data-value="${item.frequency}" title="Pokaż wszystkie stacje na tej częstotliwości">${formatFrequency(item.frequency)}</button></td>
                    <td class="number">${formatNumber(item.others)}</td>
                    <td>${nearest ? html`<button type="button" class="link-button shared-station" data-action="open-station" data-id="${nearest.station.id}">
                        <span class="truncate">${nearest.station.operator.name}${nearest.station.name ? ` – ${nearest.station.name}` : ''}</span></button>
                        <span class="muted small">${nearest.distance !== null ? formatDistance(nearest.distance) : 'bez położenia'}</span>` : html`<span class="muted small">brak</span>`}</td>
                </tr>`
            })}</tbody>
        </table>`)
}

function describeEvent(event) {
    const [date, kind] = event
    const aspects = text => [...(text || '')].map(code => CHANGE_ASPECTS[code] || code).join(', ')
    const frequencies = (added = [], removed = []) => [
        ...added.map(value => html`<span class="chip mono plus">+${formatFrequency(value)}</span>`),
        ...removed.map(value => html`<span class="chip mono minus">−${formatFrequency(value)}</span>`)
    ]
    switch (kind) {
        case 'a': return { date, title: 'Nowa stacja w wykazie' }
        case 'r': return { date, title: 'Usunięta z wykazu' }
        case 'c': return { date, title: `Zmiana: ${aspects(event[2])}`, detail: frequencies(event[3], event[4]) }
        case 'm': {
            const changes = event[4] ? `; zmiana: ${aspects(event[4])}` : ''
            return { date, title: `Przeniesiona o ${formatDistance(event[3])} (korekta współrzędnych)${changes}`, detail: frequencies(event[5], event[6]) }
        }
        default: return { date, title: kind }
    }
}

function historySection(station, history) {
    if (!history) return section('Historia', html`<p class="muted small">Wczytywanie historii…</p>`)
    const first = history.releases[0]?.date
    const events = [...(history.events.get(station.id) || [])].reverse().map(describeEvent)
    const since = station.since
        ? `W wykazie od wydania z ${formatDate(station.since)}.`
        : first ? `W wykazie co najmniej od wydania z ${formatDate(first)} (początek historii).` : ''
    return section('Historia', html`
        ${station.removed ? '' : html`<p>${since}</p>`}
        ${events.length ? html`<ol class="timeline">${events.map(event => html`<li>
            <span class="timeline-date">${formatDate(event.date)}</span>
            <span>${event.title}${event.detail?.length ? html`<span class="chips">${event.detail}</span>` : ''}</span>
        </li>`)}</ol>` : html`<p class="muted small">Brak zmian od ${formatDate(first)}.</p>`}`)
}

function statsSection(station, popular) {
    if (!popular) return ''
    const [visitors = 0, pageviews = 0] = popular.stations.get(station.id) || []
    const period = popular.period === '30d' ? '30 dni' : popular.period
    return section('Wyświetlenia karty', html`<p><strong>${formatNumber(pageviews)}</strong> ${plural(pageviews, 'wyświetlenie', 'wyświetlenia', 'wyświetleń')}
        <span class="muted">(${countLabel(visitors, 'osoba', 'osoby', 'osób')}) w ciągu ${period} przed aktualizacją danych ${formatDate(new Date(popular.generated).toISOString().slice(0, 10))}</span></p>`)
}

export function renderDetailView({ station, records, loading, error, history, popular, shared }) {
    const type = typeInfo(station.type)
    const otherNames = station.names.length > 1 ? station.names.slice(1) : []
    return html`<article class="station-card">
        <header class="card-header" style="--accent:${typeColor(station.type)}">
            <div class="card-toolbar">
                <button type="button" class="icon-button" data-action="close-overlay" aria-label="Wróć do listy" title="Wróć do listy">${icon('arrow_back')}</button>
                <span class="spacer"></span>
                <button type="button" class="icon-button" data-action="zoom-station" aria-label="Pokaż na mapie" title="Pokaż na mapie">${icon('center_focus_strong')}</button>
                <button type="button" class="icon-button" data-action="share-station" aria-label="Udostępnij link" title="Udostępnij link">${icon('share')}</button>
            </div>
            <div class="card-tags">
                ${[...station.types].map(code => html`<span class="tag"><span class="swatch" style="--swatch:${typeColor(code)}"></span>${typeInfo(code).name}</span>`)}
                ${dataset.categories.get(station.operator.category) ? html`<span class="tag">${dataset.categories.get(station.operator.category)}</span>` : ''}
                ${historyBadges(station)}
            </div>
            <h2>${station.operator.name}</h2>
            <p class="card-subtitle">${station.name || 'Stacja bez nazwy'}${otherNames.length ? html` <span class="muted">(+${otherNames.length} ${otherNames.length === 1 ? 'nazwa' : 'nazwy'})</span>` : ''}</p>
            ${station.location ? html`<p class="muted">${station.location}</p>` : ''}
            ${station.removed ? html`<p class="notice">${icon('info')} Stacja zniknęła z wykazu w wydaniu z ${formatDate(station.removed)}. Dane pochodzą z ostatniego wydania, w którym była.</p>` : ''}
            <p class="visually-hidden">${type.name}</p>
        </header>
        ${loading ? html`<p class="muted small loading">Wczytywanie szczegółów…</p>` : ''}
        ${error ? html`<p class="notice">${icon('error_outline')} Nie można wczytać szczegółów stacji. Sprawdź połączenie.</p>` : ''}
        ${frequenciesSection(station, records)}
        ${parametersSection(station, records)}
        ${sharedFrequencySection(station, shared)}
        ${locationSection(station)}
        ${permitsSection(station, records)}
        ${operatorSection(station)}
        ${historySection(station, history)}
        ${recordsSection(records)}
        ${statsSection(station, popular)}
    </article>`
}
