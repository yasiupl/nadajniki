// Widoki list: stacje w widoku mapy, stacje w klikniętym miejscu, zasięg w punkcie.
import { html, formatNumber, formatDms, stationsLabel, matchingLabel, formatDistance } from '../format.js'
import { stationItem, emptyState, icon } from './common.js'

export const LIST_SORTS = [
    { key: 'distance', name: 'Odległość' },
    { key: 'operator', name: 'Operator' },
    { key: 'frequency', name: 'Częstotliwość' },
    { key: 'newest', name: 'Najnowsze' }
]

export function renderListView({ visible, total, unlocated, sort, limit, filtersActive, mapAvailable }) {
    const header = html`<div class="view-header">
        <p class="view-title">
            <strong>${stationsLabel(visible.length)}</strong>${mapAvailable ? ' w widoku mapy' : ''}<br>
            <span class="muted small">${filtersActive ? matchingLabel(total) : `${stationsLabel(total)} w całym wykazie`}</span>
        </p>
        <div class="view-actions">
            <label class="select-label" title="Sortowanie listy">
                <span class="visually-hidden">Sortowanie</span>
                <select data-change="list-sort">
                    ${LIST_SORTS.map(item => html`<option value="${item.key}"${item.key === sort ? ' selected' : ''}>${item.name}</option>`)}
                </select>
            </label>
            <button type="button" class="button" data-action="export-open" data-scope="view" title="Eksport do CHIRP, SDR# albo CSV">${icon('file_download')}Eksport</button>
        </div>
    </div>`

    if (!total) {
        return html`${header}${emptyState('Brak stacji, które spełniają filtry.', 'Zmień zapytanie albo wyczyść filtry.',
            html`<button type="button" class="button" data-action="clear-filters">Wyczyść filtry</button>`)}`
    }

    const items = visible.slice(0, limit)
    return html`${header}
        ${visible.length ? html`<ul class="station-list">${items.map(({ station, distance }) => stationItem(station, { distance }))}</ul>`
            : emptyState('Brak stacji w widoku mapy.', `${matchingLabel(total)} poza widokiem.`,
                html`<button type="button" class="button" data-action="fit-filtered">Pokaż wszystkie na mapie</button>`)}
        ${visible.length > limit ? html`<button type="button" class="button button-block" data-action="list-more">Pokaż więcej (${formatNumber(visible.length - limit)})</button>` : ''}
        ${unlocated.length ? html`<details class="unlocated">
            <summary>${stationsLabel(unlocated.length)} bez położenia na mapie</summary>
            <p class="muted small">Grupy stacji z obszarem całego kraju (INTR) i stacje z błędnymi współrzędnymi w wykazie.</p>
            <ul class="station-list">${unlocated.slice(0, 200).map(station => stationItem(station))}</ul>
        </details>` : ''}`
}

export function renderPickView({ stations }) {
    return html`<div class="view-header">
            <button type="button" class="icon-button" data-action="close-overlay" aria-label="Wróć">${icon('arrow_back')}</button>
            <p class="view-title"><strong>${stationsLabel(stations.length)}</strong> w tym miejscu</p>
        </div>
        <ul class="station-list">${stations.map(station => stationItem(station))}</ul>`
}

export function renderProbeView({ lngLat, results, filtersActive }) {
    return html`<div class="view-header">
            <button type="button" class="icon-button" data-action="close-overlay" aria-label="Zamknij">${icon('close')}</button>
            <p class="view-title"><strong>Zasięg w punkcie</strong><br><span class="muted small">${formatDms(lngLat.lat, 'N', 'S')} ${formatDms(lngLat.lng, 'E', 'W')}</span></p>
            <div class="view-actions">
                <button type="button" class="button" data-action="export-open" data-scope="probe" title="Eksport do CHIRP, SDR# albo CSV">${icon('file_download')}Eksport</button>
            </div>
        </div>
        <p class="note">Lista pokazuje stacje, których obszar obsługi obejmuje ten punkt. Obszar obsługi to koło o promieniu z pozwolenia radiowego, a nie zmierzony zasięg sygnału.${filtersActive ? ' Lista uwzględnia aktywne filtry.' : ''}</p>
        ${results.length
            ? html`<p class="muted small">${stationsLabel(results.length)}, od najbliższej:</p>
                <ul class="station-list">${results.slice(0, 300).map(({ station, distance }) =>
                    stationItem(station, { note: `${formatDistance(distance)} / r ${formatNumber(station.radius)} km` }))}</ul>`
            : emptyState('Żaden obszar obsługi nie obejmuje tego punktu.')}`
}
