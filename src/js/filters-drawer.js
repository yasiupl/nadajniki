// Panel filtrów i pasek aktywnych filtrów.
import { NETWORK_TYPES, BANDS, BANDWIDTHS, OFFICES, STATUSES, typeInfo } from './config.js'
import { html, formatNumber, formatDate, formatFrequency, stationsLabel } from './format.js'
import { activeFilterCount } from './filters.js'
import { dataset } from './data.js'
import { state } from './store.js'
import { typeColor, icon } from './views/common.js'

function chip(facet, value, label, count, { swatch = '', title = '' } = {}) {
    const selected = state.filters[facet].has(value)
    return html`<button type="button" class="filter-chip${selected ? ' selected' : ''}${!count && !selected ? ' empty' : ''}"
        data-action="toggle-facet" data-facet="${facet}" data-value="${value}" aria-pressed="${selected}"${title ? html` title="${title}"` : ''}>
        ${swatch ? html`<span class="swatch" style="--swatch:${swatch}"></span>` : ''}<span>${label}</span><span class="count">${formatNumber(count || 0)}</span>
    </button>`
}

function group(title, content, { action = null, hint = '' } = {}) {
    return html`<section class="filter-group">
        <div class="filter-group-header"><h3>${title}</h3>${action || ''}</div>
        ${hint ? html`<p class="muted small">${hint}</p>` : ''}
        ${content}
    </section>`
}

const facetCount = (facet, value) => state.facets[facet]?.get(value) || 0

export function renderFiltersDrawer() {
    const filters = state.filters
    const typeCodes = [...NETWORK_TYPES.map(type => type.code), ...[...(state.facets.types?.keys() || [])].filter(code => !NETWORK_TYPES.some(type => type.code === code))]
        .filter(code => facetCount('types', code) || filters.types.has(code))
    const categories = [...dataset.categories].map(([key, name]) => ({ key, name, count: facetCount('categories', key) }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pl'))
    const offices = Object.keys(OFFICES).filter(code => facetCount('offices', code) || filters.offices.has(code))
    const releases = dataset.history?.releases || []

    return html`
        ${group('Stan w wykazie', html`<div class="segmented wrap" role="group" aria-label="Stan w wykazie">
                <button type="button" data-action="set-status" data-value="" aria-pressed="${!filters.status}">Wszystkie</button>
                ${STATUSES.map(status => html`<button type="button" data-action="set-status" data-value="${status.key}" aria-pressed="${filters.status === status.key}">${status.name}</button>`)}
            </div>
            ${filters.status ? html`<label class="field">
                <span>Wydanie</span>
                <select data-change="status-release">
                    ${releases.slice(1).reverse().map(item => html`<option value="${item.date}"${item.date === filters.release ? ' selected' : ''}>${formatDate(item.date)}</option>`)}
                    <option value=""${filters.release ? '' : ' selected'}>Cały okres historii</option>
                </select>
            </label>` : ''}`,
            { hint: 'Porównanie z poprzednimi miesięcznymi wydaniami wykazu UKE.' })}
        ${group('Rodzaj sieci', html`<div class="chip-group">${typeCodes.map(code =>
            chip('types', code, typeInfo(code).name, facetCount('types', code), { swatch: typeColor(code), title: typeInfo(code).description }))}</div>`)}
        ${group('Pasmo', html`<div class="chip-group">${BANDS.filter(band => facetCount('bands', band.key) || filters.bands.has(band.key)).map(band =>
            chip('bands', band.key, band.name, facetCount('bands', band.key)))}</div>`)}
        ${group('Zakres częstotliwości', html`<form class="range-form" data-submit="frequency-range">
                <label><span class="visually-hidden">Od</span><input name="min" inputmode="decimal" placeholder="od" value="${filters.frequencyMin ?? ''}"></label>
                <span>–</span>
                <label><span class="visually-hidden">Do</span><input name="max" inputmode="decimal" placeholder="do" value="${filters.frequencyMax ?? ''}"></label>
                <span>MHz</span>
                <button type="submit" class="button">Zastosuj</button>
            </form>`, { hint: 'Jedna wartość w obu polach wybiera jedną częstotliwość.' })}
        ${group('Szerokość kanału', html`<div class="chip-group">${BANDWIDTHS.filter(item => facetCount('bandwidths', item.key) || filters.bandwidths.has(item.key)).map(item =>
            chip('bandwidths', item.key, item.name, facetCount('bandwidths', item.key)))}</div>`)}
        ${group('Pozwolenie wygasa', html`<div class="segmented" role="group" aria-label="Pozwolenie wygasa">
                ${[[0, 'Dowolnie'], [6, '6 mies.'], [12, '12 mies.'], [24, '24 mies.']].map(([months, label]) =>
                    html`<button type="button" data-action="set-expiring" data-value="${months}" aria-pressed="${filters.expiring === months}">${label}</button>`)}
            </div>`, { hint: 'Stacje z pozwoleniem, które wygasa w wybranym okresie (lub już wygasło).' })}
        ${group('Kategoria operatora', html`<div class="chip-group">${categories.filter(item => item.count || filters.categories.has(item.key)).map(item =>
            chip('categories', item.key, item.name, item.count))}</div>`)}
        ${group('Jednostka UKE', html`<div class="chip-group">${offices.map(code =>
            chip('offices', code, code, facetCount('offices', code), { title: OFFICES[code] }))}</div>`)}
    `
}

// Pasek aktywnych filtrów nad mapą.
export function renderActiveFilters() {
    const filters = state.filters
    const chips = []
    const add = (label, action, value = '', facet = '') => chips.push(html`<button type="button" class="active-chip" data-action="${action}" data-value="${value}" data-facet="${facet}" title="Usuń filtr">
        <span>${label}</span>${icon('close')}</button>`)
    if (filters.q.trim()) add(`„${filters.q.trim()}”`, 'remove-query')
    if (filters.operator) add(`Operator: ${filters.operator}`, 'remove-operator')
    for (const code of filters.types) add(typeInfo(code).name, 'toggle-facet', code, 'types')
    for (const key of filters.bands) add(BANDS.find(band => band.key === key)?.name || key, 'toggle-facet', key, 'bands')
    if (filters.frequencyMin !== null || filters.frequencyMax !== null) {
        const min = filters.frequencyMin
        const max = filters.frequencyMax
        add(min !== null && max !== null && Math.abs(min - max) < 1e-9 ? `${formatFrequency(min)} MHz`
            : `${min !== null ? formatNumber(min, 4) : '…'}–${max !== null ? formatNumber(max, 4) : '…'} MHz`, 'remove-range')
    }
    for (const key of filters.bandwidths) add(`Kanał ${BANDWIDTHS.find(item => item.key === key)?.name || key}`, 'toggle-facet', key, 'bandwidths')
    for (const key of filters.categories) add(dataset.categories.get(key) || key, 'toggle-facet', key, 'categories')
    for (const code of filters.offices) add(`UKE ${code}`, 'toggle-facet', code, 'offices')
    if (filters.status) {
        const status = STATUSES.find(item => item.key === filters.status)
        add(`${status.name}${filters.release ? ` (${formatDate(filters.release)})` : ''}`, 'set-status', '')
    }
    if (filters.expiring) add(`Wygasa w ciągu ${filters.expiring} mies.`, 'set-expiring', '0')

    if (!chips.length) return ''
    return html`${chips}<span class="active-summary">${stationsLabel(state.filtered.length)}</span>
        ${chips.length > 1 ? html`<button type="button" class="text-button" data-action="clear-filters">Wyczyść</button>` : ''}`
}

export const filtersBadge = () => activeFilterCount(state.filters)
