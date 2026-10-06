// Elementy wspólne widoków panelu.
import { typeInfo } from '../config.js'
import { html, formatFrequency, formatDate, formatDistance } from '../format.js'
import { dataset } from '../data.js'
import { state } from '../store.js'
import { isFavorite } from '../favorites.js'

export const typeColor = code => typeInfo(code)[state.theme]

export function typeDot(station) {
    return html`<span class="type-dot${station.removed ? ' removed' : ''}" style="--dot:${typeColor(station.type)}" title="${typeInfo(station.type).name}"></span>`
}

export function frequencyChips(station, limit = 4) {
    const shown = station.tx.slice(0, limit)
    return html`<span class="chips">${shown.map(frequency => html`<span class="chip mono">${formatFrequency(frequency)}</span>`)}${station.tx.length > limit ? html`<span class="chip muted">+${station.tx.length - limit}</span>` : ''}</span>`
}

// Znaczniki historii: nowa w ostatnim wydaniu, zmieniona w ostatnim wydaniu, usunięta.
export function historyBadges(station) {
    if (station.removed) return html`<span class="badge badge-removed" title="Usunięta z wykazu w wydaniu ${formatDate(station.removed)}">Usunięta</span>`
    const badges = []
    if (station.since && station.since === dataset.release) badges.push(html`<span class="badge badge-new" title="Nowa w wydaniu ${formatDate(station.since)}">Nowa</span>`)
    else if (station.changed && station.changed === dataset.release) badges.push(html`<span class="badge badge-changed" title="Zmieniona w wydaniu ${formatDate(station.changed)}">Zmieniona</span>`)
    return badges
}

export function stationItem(station, { distance = null, note = '' } = {}) {
    const subtitle = [station.name, station.location].filter(Boolean).join(' · ') ||
        (station.lat === null ? (station.badLocation ? 'Błędne współrzędne w wykazie' : 'Bez lokalizacji (obszar kraju)') : '')
    return html`<li>
        <button type="button" class="station-item" data-action="open-station" data-id="${station.id}" data-uid="${station.uid}">
            ${typeDot(station)}
            <span class="station-item-main">
                <span class="station-item-title">${station.operator.name}</span>
                <span class="station-item-sub truncate">${subtitle}</span>
                ${frequencyChips(station)}
            </span>
            <span class="station-item-meta">
                ${isFavorite(station.id) ? html`<span class="favorite-mark" title="Ulubiona">${icon('star')}</span>` : ''}
                ${historyBadges(station)}
                ${distance !== null ? html`<span class="muted small">${formatDistance(distance)}</span>` : ''}
                ${note ? html`<span class="muted small">${note}</span>` : ''}
            </span>
        </button>
    </li>`
}

export function emptyState(title, text = '', action = null) {
    return html`<div class="empty-state">
        <p><strong>${title}</strong></p>
        ${text ? html`<p class="muted">${text}</p>` : ''}
        ${action || ''}
    </div>`
}

export function icon(name) {
    return html`<i class="material-icons" aria-hidden="true">${name}</i>`
}
