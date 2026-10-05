// Pobiera z Plausible liczbę wejść na strony stacji (/stacja/<id>) i zapisuje dist/data/popular.json.
// Bez zmiennej PLAUSIBLE_API_KEY skrypt nic nie robi: strona działa wtedy bez statystyk.
import fs from 'node:fs'
import path from 'node:path'

const API_KEY = process.env.PLAUSIBLE_API_KEY
const BASE_URL = (process.env.PLAUSIBLE_URL || 'https://plausible.yasiu.pl').replace(/\/$/, '')
const SITE_ID = process.env.PLAUSIBLE_SITE_ID || 'nadajniki.yasiu.pl'
const PERIOD = process.env.PLAUSIBLE_PERIOD || '30d'
const OUTPUT = path.join('dist', 'data', 'popular.json')
const PAGE_PATTERN = /^\/stacja\/([0-9a-f]{10,})/

// Plausible Stats API v2 (Plausible CE 2.1 i nowsze).
async function queryV2() {
    const response = await fetch(`${BASE_URL}/api/v2/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            site_id: SITE_ID,
            metrics: ['visitors', 'pageviews'],
            date_range: PERIOD,
            dimensions: ['event:page'],
            filters: [['contains', 'event:page', ['/stacja/']]],
            pagination: { limit: 10000 }
        })
    })
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`)
    const body = await response.json()
    return body.results.map(row => ({ page: row.dimensions[0], visitors: row.metrics[0], pageviews: row.metrics[1] }))
}

// Plausible Stats API v1 (starsze instalacje).
async function queryV1() {
    const rows = []
    for (let page = 1; page <= 20; page++) {
        const params = new URLSearchParams({
            site_id: SITE_ID, period: PERIOD, property: 'event:page', metrics: 'visitors,pageviews',
            filters: 'event:page==/stacja/*', limit: '1000', page: String(page)
        })
        const response = await fetch(`${BASE_URL}/api/v1/stats/breakdown?${params}`, {
            headers: { Authorization: `Bearer ${API_KEY}` }
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`)
        const { results } = await response.json()
        rows.push(...results)
        if (results.length < 1000) break
    }
    return rows
}

if (!API_KEY) {
    console.log('Brak PLAUSIBLE_API_KEY: pomijam statystyki wejść.')
} else {
    try {
        const rows = (await queryV2()) ?? (await queryV1())
        let aliases = {}
        try {
            aliases = JSON.parse(fs.readFileSync(path.join('dist', 'data', 'history.json'), 'utf8')).aliases || {}
        } catch {
            // Bez historii nie ma przekierowań dla przeniesionych stacji.
        }
        const stations = {}
        for (const row of rows) {
            const match = PAGE_PATTERN.exec(row.page)
            if (!match) continue
            const id = aliases[match[1]] || match[1]
            const [visitors, pageviews] = stations[id] || [0, 0]
            stations[id] = [visitors + row.visitors, pageviews + row.pageviews]
        }
        fs.writeFileSync(OUTPUT, JSON.stringify({ period: PERIOD, generated: Date.now(), stations }))
        console.log(`Statystyki wejść: ${Object.keys(stations).length} stacji (${PERIOD})`)
    } catch (error) {
        // Statystyki są dodatkiem: błąd API nie zatrzymuje budowania strony.
        console.warn('Nie można pobrać statystyk z Plausible:', error.message)
    }
}
