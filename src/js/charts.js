// Wykresy w HTML: słupki poziome (kategorie), kolumny (histogramy, serie w czasie) i podpowiedzi.
// Zasady: cienkie znaczniki, zaokrąglony koniec danych, 2 px odstępu, wartość przy końcu słupka,
// tekst w kolorach tekstu (nie serii), tabela jako alternatywa dla każdego wykresu kolumnowego.
import { html, formatNumber } from './format.js'

// Słupki poziome. rows: [{ label, value, color?, swatch?, action?, data?, note? }]
export function barList(rows, { color = 'var(--series-1)', action = '', emptyText = 'Brak danych.' } = {}) {
    if (!rows.length) return html`<p class="muted small">${emptyText}</p>`
    const max = Math.max(...rows.map(row => row.value), 1)
    return html`<ul class="bar-list">${rows.map(row => {
        const rowAction = row.action ?? action
        return html`<li>
            <${rowAction ? 'button' : 'div'} class="bar-row" ${rowAction ? html`type="button" data-action="${rowAction}" data-value="${row.data ?? row.label}"` : ''}
                data-tip-value="${formatNumber(row.value)}" data-tip-label="${row.label}">
                <span class="bar-label">${row.swatch ? html`<span class="swatch" style="--swatch:${row.swatch}"></span>` : ''}<span class="truncate">${row.label}</span>${row.note ? html` <span class="muted">${row.note}</span>` : ''}</span>
                <span class="bar-track"><span class="bar-fill" style="--p:${(row.value / max).toFixed(4)};--bar:${row.color || color}"></span><span class="bar-value">${formatNumber(row.value)}</span></span>
            </${rowAction ? 'button' : 'div'}>
        </li>`
    })}</ul>`
}

// Kolumny od wspólnej linii bazowej. columns: [{ label, value, tip, action?, data?, selected? }]
// ticks: [{ position (0-1), label }] pod osią.
export function columnChart(columns, { color = 'var(--series-1)', height = 120, ticks = [], action = '', caption = '', unit = '' } = {}) {
    const max = Math.max(...columns.map(column => column.value), 1)
    const peak = columns.reduce((best, column) => column.value > (best?.value ?? -1) ? column : best, null)
    return html`<figure class="column-chart">
        <div class="columns" style="--chart-height:${height}px;--bar:${color}" role="list">
            ${columns.map(column => {
                const columnAction = column.action ?? action
                const tag = columnAction ? 'button' : 'div'
                return html`<${tag} class="column${column.selected ? ' selected' : ''}" role="listitem" ${columnAction ? html`type="button" data-action="${columnAction}" data-value="${column.data ?? column.label}"` : 'tabindex="0"'}
                    data-tip-value="${formatNumber(column.value)}${unit}" data-tip-label="${column.tip || column.label}" aria-label="${column.tip || column.label}: ${formatNumber(column.value)}${unit}">
                    <span class="column-fill" style="--p:${(column.value / max).toFixed(4)}"></span>
                    ${column === peak && column.value > 0 ? html`<span class="column-peak" style="--p:${(column.value / max).toFixed(4)}">${formatNumber(column.value)}</span>` : ''}
                </${tag}>`
            })}
        </div>
        ${ticks.length ? html`<div class="column-axis">${ticks.map(tick => html`<span style="left:${(tick.position * 100).toFixed(2)}%">${tick.label}</span>`)}</div>` : ''}
        ${caption ? html`<figcaption class="muted small">${caption}</figcaption>` : ''}
    </figure>`
}

// Kolumny rozbieżne: wartości dodatnie nad linią bazową, ujemne pod nią (np. nowe i usunięte stacje).
// columns: [{ label, up, down, tip, data, selected }]
export function divergingChart(columns, { up, down, height = 140, action = '', ticks = [] }) {
    const max = Math.max(...columns.map(column => Math.max(column.up, column.down)), 1)
    return html`<figure class="column-chart diverging">
        <div class="legend">
            <span><span class="swatch" style="--swatch:${up.color}"></span>${up.name}</span>
            <span><span class="swatch" style="--swatch:${down.color}"></span>${down.name}</span>
        </div>
        <div class="diverging-columns" style="--chart-height:${height}px">
            ${columns.map(column => html`<button type="button" class="diverging-column${column.selected ? ' selected' : ''}" data-action="${action}" data-value="${column.data}"
                data-tip-value="+${formatNumber(column.up)} / −${formatNumber(column.down)}" data-tip-label="${column.tip}"
                aria-label="${column.tip}: ${up.name} ${column.up}, ${down.name} ${column.down}">
                <span class="half up"><span class="column-fill" style="--p:${(column.up / max).toFixed(4)};--bar:${up.color}"></span></span>
                <span class="half down"><span class="column-fill" style="--p:${(column.down / max).toFixed(4)};--bar:${down.color}"></span></span>
            </button>`)}
        </div>
        ${ticks.length ? html`<div class="column-axis">${ticks.map(tick => html`<span style="left:${(tick.position * 100).toFixed(2)}%">${tick.label}</span>`)}</div>` : ''}
    </figure>`
}

// Tabela danych wykresu (zwinięta pod wykresem).
export function chartTable(headers, rows, summary = 'Tabela') {
    return html`<details class="chart-table">
        <summary>${summary}</summary>
        <table>
            <thead><tr>${headers.map((header, index) => html`<th${index ? html` class="number"` : ''}>${header}</th>`)}</tr></thead>
            <tbody>${rows.map(row => html`<tr>${row.map((cell, index) => html`<td${index ? html` class="number"` : ''}>${typeof cell === 'number' ? formatNumber(cell) : cell}</td>`)}</tr>`)}</tbody>
        </table>
    </details>`
}

// Wspólna podpowiedź dla elementów z atrybutami data-tip-value i data-tip-label.
export function initTooltips(root) {
    const tooltip = document.createElement('div')
    tooltip.className = 'chart-tooltip'
    tooltip.setAttribute('role', 'tooltip')
    tooltip.hidden = true
    const value = document.createElement('strong')
    const label = document.createElement('span')
    tooltip.append(value, label)
    document.body.append(tooltip)

    const show = target => {
        value.textContent = target.dataset.tipValue
        label.textContent = target.dataset.tipLabel || ''
        tooltip.hidden = false
        const rect = target.getBoundingClientRect()
        const width = tooltip.offsetWidth
        const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8)
        const top = rect.top - tooltip.offsetHeight - 8
        tooltip.style.left = `${left}px`
        tooltip.style.top = `${top < 8 ? rect.bottom + 8 : top}px`
    }
    const hide = () => { tooltip.hidden = true }
    const find = event => event.target.closest?.('[data-tip-value]')

    root.addEventListener('pointerover', event => { const target = find(event); if (target) show(target) })
    root.addEventListener('pointerout', event => { if (find(event)) hide() })
    root.addEventListener('focusin', event => { const target = find(event); if (target) show(target) })
    root.addEventListener('focusout', hide)
    root.addEventListener('scroll', hide, true)
}
