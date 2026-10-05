// Pole wyszukiwania z podpowiedziami (operatorzy, częstotliwości, stacje).
import { html, formatNumber, formatFrequency, frequencyKey, stationsLabel, countLabel, distanceMeters } from './format.js'
import { parseQuery, isEmptyQuery, matchStation, scoreStation } from './query.js'
import { dataset, ensureSearchIndex } from './data.js'
import { mapCenter } from './map.js'
import { typeDot, icon } from './views/common.js'
import { $, debounce } from './ui.js'

const STATION_LIMIT = 8
const OPERATOR_LIMIT = 3
const FREQUENCY_LIMIT = 4

const HELP = html`<div class="search-help">
    <p><strong>Wskazówki wyszukiwania</strong></p>
    <dl>
        <dt>pkp kraków</dt><dd>wszystkie słowa: operator, nazwa, lokalizacja, pozwolenie</dd>
        <dt>148.0125</dt><dd>częstotliwość (także początek, np. 148.01)</dd>
        <dt>148-149</dt><dd>zakres częstotliwości w MHz</dd>
        <dt>typ:A</dt><dd>rodzaj sieci (A, C, E, F, L, T…)</dd>
        <dt>erp&gt;10</dt><dd>moc ERP w dBW; także r&gt;20 (promień w km), h&gt;30 (antena w m)</dd>
        <dt>kanal:25</dt><dd>szerokość kanału w kHz</dd>
        <dt>"fraza", -słowo</dt><dd>dokładny fragment, wykluczenie słowa</dd>
    </dl>
</div>`

function suggestions(text) {
    const query = parseQuery(text)
    if (isEmptyQuery(query)) return null
    ensureSearchIndex(dataset.stations)

    const matched = dataset.stations.filter(station => matchStation(station, query))

    let operators = []
    if (query.text.length) {
        const counts = new Map()
        for (const station of matched) counts.set(station.operator, (counts.get(station.operator) || 0) + 1)
        operators = [...counts].filter(([operator]) => query.text.every(token => operator.searchName.includes(token)))
            .sort((a, b) => b[1] - a[1]).slice(0, OPERATOR_LIMIT)
    }

    let frequencies = []
    if (query.frequencies.length || query.mixed.length) {
        const prefixes = [...query.frequencies, ...query.mixed.map(value => `${value}.`)]
        const counts = new Map()
        for (const station of matched) {
            for (const frequency of station.frequencies) {
                const key = frequencyKey(frequency)
                if (prefixes.some(prefix => key.startsWith(prefix))) counts.set(frequency, (counts.get(frequency) || 0) + 1)
            }
        }
        frequencies = [...counts].sort((a, b) => b[1] - a[1]).slice(0, FREQUENCY_LIMIT)
    }

    const center = mapCenter()
    const stations = matched.map(station => ({
        station,
        score: scoreStation(station, query),
        distance: station.lat === null ? Infinity : distanceMeters(center.lat, center.lng, station.lat, station.lon)
    })).sort((a, b) => b.score - a.score || a.distance - b.distance).slice(0, STATION_LIMIT)

    return { total: matched.length, operators, frequencies, stations }
}

export function initSearch({ onApply, onOpenStation, onOperator, onFrequency }) {
    const input = $('#search-input')
    const results = $('#search-results')
    const clear = $('#search-clear')
    let active = -1

    const options = () => [...results.querySelectorAll('[role="option"]')]
    const close = () => {
        results.hidden = true
        input.setAttribute('aria-expanded', 'false')
        active = -1
    }
    const setActive = index => {
        const list = options()
        active = Math.max(-1, Math.min(index, list.length - 1))
        list.forEach((option, i) => option.setAttribute('aria-selected', String(i === active)))
        if (active >= 0) {
            input.setAttribute('aria-activedescendant', list[active].id)
            list[active].scrollIntoView({ block: 'nearest' })
        } else {
            input.removeAttribute('aria-activedescendant')
        }
    }

    const render = () => {
        clear.hidden = !input.value
        const text = input.value.trim()
        if (!dataset.stations.length) return
        const found = text ? suggestions(text) : null
        let id = 0
        const option = (content, attributes) => html`<li role="option" id="search-option-${id++}" aria-selected="false" ${attributes}>${content}</li>`
        if (!found) {
            results.innerHTML = HELP.value
        } else {
            results.innerHTML = html`<ul role="presentation">
                ${option(html`${icon('filter_alt')}<span>Pokaż wyniki na mapie</span><span class="muted">${stationsLabel(found.total)}</span>`, html`data-kind="apply"`)}
                ${found.operators.length ? html`<li class="search-group" role="presentation">Operatorzy</li>` : ''}
                ${found.operators.map(([operator, count]) => option(html`${icon('business')}<span class="truncate">${operator.name}</span><span class="muted">${formatNumber(operator.stations)}</span>`,
                    html`data-kind="operator" data-value="${operator.name}" title="${count} pasujących stacji"`))}
                ${found.frequencies.length ? html`<li class="search-group" role="presentation">Częstotliwości</li>` : ''}
                ${found.frequencies.map(([frequency, count]) => option(html`${icon('graphic_eq')}<span class="mono">${formatFrequency(frequency)} MHz</span><span class="muted">${countLabel(count, 'stacja', 'stacje', 'stacji')}</span>`,
                    html`data-kind="frequency" data-value="${frequency}"`))}
                ${found.stations.length ? html`<li class="search-group" role="presentation">Stacje</li>` : ''}
                ${found.stations.map(({ station }) => option(html`${typeDot(station)}<span class="search-station"><span class="truncate">${station.operator.name}</span><span class="muted small truncate">${[station.name, station.location].filter(Boolean).join(' · ')}</span></span>`,
                    html`data-kind="station" data-value="${station.id}"`))}
            </ul>`.value
        }
        results.hidden = false
        input.setAttribute('aria-expanded', 'true')
        setActive(found ? 0 : -1)
    }
    const renderLater = debounce(render, 120)

    const choose = option => {
        const kind = option?.dataset.kind || 'apply'
        const value = option?.dataset.value
        close()
        if (kind === 'operator') {
            input.value = ''
            onOperator(value)
        } else if (kind === 'frequency') {
            input.value = ''
            onFrequency(parseFloat(value))
        } else if (kind === 'station') {
            onOpenStation(value)
        } else {
            onApply(input.value.trim())
        }
        if (kind !== 'station') input.blur()
        clear.hidden = !input.value
    }

    input.addEventListener('input', renderLater)
    input.addEventListener('focus', render)
    input.addEventListener('keydown', event => {
        if (event.key === 'ArrowDown') {
            event.preventDefault()
            if (results.hidden) render()
            setActive(active + 1)
        } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActive(active - 1)
        } else if (event.key === 'Enter') {
            event.preventDefault()
            const list = options()
            choose(active >= 0 ? list[active] : null)
        } else if (event.key === 'Escape') {
            if (!results.hidden) close()
            else input.blur()
        }
    })
    results.addEventListener('mousedown', event => event.preventDefault())
    results.addEventListener('click', event => {
        const option = event.target.closest('[role="option"]')
        if (option) choose(option)
    })
    input.addEventListener('blur', () => setTimeout(close, 100))
    clear.addEventListener('click', () => {
        input.value = ''
        clear.hidden = true
        onApply('')
        input.focus()
    })

    return {
        setValue(value) {
            if (document.activeElement !== input) input.value = value
            clear.hidden = !input.value
        },
        refresh: () => { if (document.activeElement === input) render() }
    }
}
