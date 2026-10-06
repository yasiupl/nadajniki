// Okno eksportu: wybór stacji (zakresu) i formatu pliku.
import { html, formatNumber, stationsLabel, countLabel } from './format.js'
import { sdrEntries, toSdrSharp, chirpChannels, toChirp, CHIRP_LIMIT, toCsv } from './export.js'
import { dataset } from './data.js'
import { $, downloadFile, toast } from './ui.js'
import { icon } from './views/common.js'
import { GOALS, track } from './analytics.js'

// Nazwy zakresów we właściwości "zakres" zdarzenia Plausible.
const SCOPE_NAMES = { station: 'stacja', view: 'widok mapy', range: 'zasięg punktu', favorites: 'ulubione', filtered: 'filtry' }

const FORMATS = [
    {
        key: 'chirp',
        name: 'CHIRP',
        file: 'chirp.csv',
        type: 'text/csv;charset=utf-8',
        description: 'Plik CSV do programu CHIRP, który programuje radiotelefony i skanery. Jeden kanał na częstotliwość nadawczą.',
        count: stations => chirpChannels(stations).length,
        unit: count => countLabel(count, 'kanał', 'kanały', 'kanałów'),
        build: stations => toChirp(stations)
    },
    {
        key: 'sdr',
        name: 'SDR#',
        file: 'sdrsharp.xml',
        type: 'application/xml',
        description: 'Lista częstotliwości (Frequency Manager) dla programu SDR#. Jedna pozycja na częstotliwość i operatora.',
        count: stations => sdrEntries(stations).length,
        unit: count => countLabel(count, 'pozycja', 'pozycje', 'pozycji'),
        build: stations => toSdrSharp(stations)
    },
    {
        key: 'csv',
        name: 'Tabela CSV',
        file: 'stacje.csv',
        type: 'text/csv;charset=utf-8',
        description: 'Wszystkie dane stacji do arkusza kalkulacyjnego (Excel, LibreOffice). Separator: średnik.',
        count: stations => stations.length,
        unit: count => stationsLabel(count),
        build: stations => toCsv(stations, window.location.origin)
    }
]

// Wybór zostaje między kolejnymi otwarciami okna (do przeładowania strony).
const selection = { scopes: [], scope: '', format: FORMATS[0].key }
let initialized = false

const dialog = () => $('#export-dialog')
const currentScope = () => selection.scopes.find(scope => scope.key === selection.scope && !scope.disabled) ||
    selection.scopes.find(scope => !scope.disabled)
const currentFormat = () => FORMATS.find(format => format.key === selection.format) || FORMATS[0]
const fileName = format => `nadajniki-${dataset.release || 'dane'}-${format.file}`

function summary() {
    const format = currentFormat()
    const count = format.count(currentScope().stations)
    const notes = []
    if (format.key === 'chirp') {
        notes.push('Każdy kanał ma wyłączone nadawanie (Duplex: off). Częstotliwości służą tylko do nasłuchu.')
        if (count > CHIRP_LIMIT) {
            notes.push(`CHIRP przyjmuje do ${formatNumber(CHIRP_LIMIT)} kanałów. Plik zawiera ${formatNumber(CHIRP_LIMIT)} kanałów o najniższych częstotliwościach z ${formatNumber(count)}. Zawęź filtry albo widok mapy, żeby wybrać inne kanały.`)
        }
        notes.push('Radiotelefon może mieć mniej pamięci niż plik. Przy imporcie CHIRP pozwala wybrać kanały.')
    }
    const exported = format.key === 'chirp' ? Math.min(count, CHIRP_LIMIT) : count
    return {
        count,
        content: html`<p><span class="mono">${fileName(format)}</span> · ${count ? format.unit(exported) : 'brak danych do eksportu'}</p>
            ${notes.map(note => html`<p class="muted small">${note}</p>`)}`
    }
}

function updateSummary() {
    const { count, content } = summary()
    $('#export-summary').innerHTML = content.value
    dialog().querySelector('[data-export="download"]').disabled = !count
}

function render() {
    const scope = currentScope()
    const format = currentFormat()
    dialog().innerHTML = html`<form method="dialog" class="export-form">
        <div class="dialog-header">
            <h2 id="export-title">Eksport</h2>
            <button type="submit" value="cancel" class="icon-button" aria-label="Zamknij">${icon('close')}</button>
        </div>
        <fieldset>
            <legend>Stacje</legend>
            ${selection.scopes.map(item => html`<label class="option${item.disabled ? ' disabled' : ''}">
                <input type="radio" name="scope" value="${item.key}"${item.key === scope.key ? ' checked' : ''}${item.disabled ? ' disabled' : ''}>
                <span class="option-text"><strong>${item.label}</strong><span class="muted small">${item.disabled || stationsLabel(item.stations.length)}</span></span>
            </label>`)}
        </fieldset>
        <fieldset>
            <legend>Format</legend>
            ${FORMATS.map(item => html`<label class="option">
                <input type="radio" name="format" value="${item.key}"${item.key === format.key ? ' checked' : ''}>
                <span class="option-text"><strong>${item.name}</strong><span class="muted small">${item.description}</span></span>
            </label>`)}
        </fieldset>
        <div id="export-summary" class="export-summary" aria-live="polite"></div>
        <div class="dialog-actions">
            <button type="submit" value="cancel" class="button">Anuluj</button>
            <button type="button" class="button button-primary" data-export="download">${icon('file_download')}Pobierz</button>
        </div>
    </form>`.value
    updateSummary()
}

function download() {
    const format = currentFormat()
    const stations = currentScope().stations
    if (!format.count(stations)) return
    downloadFile(fileName(format), format.build(stations), format.type)
    track(GOALS.export, { format: format.name, zakres: SCOPE_NAMES[currentScope().key] || currentScope().key })
    dialog().close()
    toast(`Pobrano plik ${fileName(format)}.`)
}

function initialize() {
    const element = dialog()
    element.addEventListener('change', event => {
        const input = event.target
        if (input.name !== 'scope' && input.name !== 'format') return
        selection[input.name] = input.value
        updateSummary()
    })
    element.addEventListener('click', event => {
        if (event.target.closest('[data-export="download"]')) download()
    })
    initialized = true
}

// scopes: [{ key, label, stations, disabled }]. disabled: powód, dla którego zakres jest nieaktywny, albo pusty tekst.
// selected: zakres zaznaczony na start (jeśli jest aktywny).
export function openExportDialog(scopes, selected = scopes[0].key) {
    if (!initialized) initialize()
    selection.scopes = scopes
    selection.scope = selected
    render()
    dialog().showModal()
}
