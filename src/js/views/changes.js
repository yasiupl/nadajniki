// Widok "Zmiany": porównanie kolejnych wydań wykazu (nowe, usunięte, zmienione i przeniesione stacje).
import { CHANGE_ASPECTS } from '../config.js'
import { html, formatNumber, formatDate, formatDistance, stationsLabel } from '../format.js'
import { divergingChart, chartTable } from '../charts.js'
import { stationItem, emptyState, icon } from './common.js'
import { state } from '../store.js'

const SERIES = {
    light: { added: '#2a78d6', removed: '#e34948' },
    dark: { added: '#3987e5', removed: '#e66767' }
}

const TABS = [
    { key: 'new', name: 'Nowe' },
    { key: 'removed', name: 'Usunięte' },
    { key: 'changed', name: 'Zmienione' }
]

// Opis zmiany stacji w wybranym wydaniu (albo ostatniej zmiany w całym okresie).
function changeNote(station, history, release) {
    const events = (history.events.get(station.id) || []).filter(event => (event[1] === 'c' || event[1] === 'm') && (!release || event[0] === release))
    const event = events[events.length - 1]
    if (!event) return ''
    const aspects = text => [...(text || '')].map(code => CHANGE_ASPECTS[code] || code).join(', ')
    const date = release ? '' : `${formatDate(event[0])}: `
    if (event[1] === 'm') return `${date}przeniesiona o ${formatDistance(event[3])}${event[4] ? `, ${aspects(event[4])}` : ''}`
    return `${date}${aspects(event[2])}`
}

export function renderChangesView({ history, error, release, tab, limit, lists, filtersActive }) {
    if (error) return emptyState('Nie można wczytać historii zmian.', 'Sprawdź połączenie i spróbuj ponownie.',
        html`<button type="button" class="button" data-action="retry-history">Spróbuj ponownie</button>`)
    if (!history) return html`<p class="muted loading">Wczytywanie historii zmian…</p>`
    if (history.releases.length < 2) return emptyState('Brak historii zmian.', 'Budowanie strony nie pobrało poprzednich wydań wykazu.')

    const releases = history.releases
    const index = releases.findIndex(item => item.date === release)
    const selected = index > 0 ? releases[index] : null
    const previous = index > 0 ? releases[index - 1] : releases[0]
    const colors = SERIES[state.theme]

    const columns = releases.slice(1).map(item => ({
        data: item.date,
        up: item.added,
        down: item.removed,
        tip: `Wydanie ${formatDate(item.date)} · zmienione ${formatNumber(item.changed)}, przeniesione ${formatNumber(item.moved || 0)}`,
        selected: item.date === release
    }))
    const ticks = columns.map((column, i) => ({ position: (i + 0.5) / columns.length, label: column.data.slice(2, 7).split('-').reverse().join('.') }))
        .filter((tick, i, all) => i % 2 === (all.length - 1) % 2)

    const items = lists[tab] || []
    const moved = tab === 'changed' ? items.filter(station => changeNote(station, history, selected?.date).startsWith('przeniesiona')).length : 0

    return html`<div class="view-header">
            <p class="view-title"><strong>Zmiany w wykazie</strong></p>
        </div>
        <label class="field">
            <span>Wydanie</span>
            <select data-change="changes-release">
                ${[...releases.slice(1)].reverse().map(item => html`<option value="${item.date}"${item.date === release ? ' selected' : ''}>${formatDate(item.date)}</option>`)}
                <option value=""${selected ? '' : ' selected'}>Cały okres (od ${formatDate(releases[0].date)})</option>
            </select>
        </label>
        <p class="muted small">${selected
            ? `Porównanie wydania z ${formatDate(selected.date)} z wydaniem z ${formatDate(previous.date)}.`
            : `Zmiany od wydania z ${formatDate(releases[0].date)} do bieżącego.`}${filtersActive ? ' Liczby uwzględniają aktywne filtry.' : ''}</p>
        <div class="stat-row">
            ${TABS.map(item => html`<button type="button" class="stat-tile${item.key === tab ? ' selected' : ''}" data-action="changes-tab" data-value="${item.key}" aria-pressed="${item.key === tab}">
                <span class="stat-label">${item.name}</span>
                <span class="stat-value">${formatNumber((lists[item.key] || []).length)}</span>
            </button>`)}
        </div>
        <section class="card-section">
            <div class="section-header"><h3>Nowe i usunięte w kolejnych wydaniach</h3></div>
            ${divergingChart(columns, {
                up: { name: 'Nowe', color: colors.added },
                down: { name: 'Usunięte', color: colors.removed },
                action: 'changes-release',
                ticks
            })}
            ${chartTable(['Wydanie', 'Stacje', 'Nowe', 'Usunięte', 'Zmienione', 'Przeniesione'],
                [...releases].reverse().map(item => [formatDate(item.date), item.stations, item.added ?? '–', item.removed ?? '–', item.changed ?? '–', item.moved ?? '–']))}
            <p class="muted small">Wykres pokazuje wszystkie stacje, bez filtrów. Przeniesiona stacja to stacja, której UKE poprawił współrzędne (do 2 km), z tym samym operatorem i pozwoleniem albo częstotliwościami.</p>
        </section>
        <section class="card-section">
            <div class="section-header">
                <h3>${TABS.find(item => item.key === tab).name}: ${stationsLabel(items.length)}${moved ? html` <span class="muted small">(w tym ${formatNumber(moved)} przeniesionych)</span>` : ''}</h3>
                ${items.length ? html`<button type="button" class="text-button" data-action="changes-show" title="Pokaż te stacje na mapie">${icon('map')}Na mapie</button>` : ''}
            </div>
            ${items.length
                ? html`<ul class="station-list">${items.slice(0, limit).map(station => stationItem(station, {
                    note: tab === 'changed' ? changeNote(station, history, selected?.date)
                        : tab === 'new' ? (selected ? '' : formatDate(station.since))
                            : (selected ? '' : formatDate(station.removed))
                }))}</ul>
                ${items.length > limit ? html`<button type="button" class="button button-block" data-action="changes-more">Pokaż więcej (${formatNumber(items.length - limit)})</button>` : ''}`
                : html`<p class="muted small">Brak stacji w tej grupie.</p>`}
        </section>`
}
