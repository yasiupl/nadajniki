// Pobiera dane do katalogu data/:
// - bieżący wykaz pozwoleń RRL z BIP UKE do data/current/,
// - poprzednie miesięczne wydania z archiwum dane.gov.pl do data/archive/ (do historii zmian).
// Wynik opisuje plik data/releases.json, który czyta scripts/build-data.mjs.
import fs from 'node:fs/promises'
import path from 'node:path'
import { unzipSync } from 'fflate'

const BIP_URL = 'https://bip.uke.gov.pl'
const BIP_LIST_URL = `${BIP_URL}/pozwolenia-radiowe/wykaz-pozwolen-radiowych-tresci/klasyczne-sieci-rrl,9.html`
const ARCHIVE_API_URL = 'https://api.dane.gov.pl/1.4/datasets/1070/resources'
const DATA_DIR = 'data'
const CURRENT_DIR = path.join(DATA_DIR, 'current')
const ARCHIVE_DIR = path.join(DATA_DIR, 'archive')

// Liczba poprzednich wydań do historii zmian. 0 wyłącza historię.
const HISTORY_MONTHS = Math.max(0, parseInt(process.env.HISTORY_MONTHS ?? '12', 10) || 0)

const releaseDate = name => /(\d{4}-\d{2}-\d{2})/.exec(name)?.[1]

async function download(url) {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`)
    return Buffer.from(await response.arrayBuffer())
}

async function fetchCurrent() {
    const response = await fetch(BIP_LIST_URL)
    if (!response.ok) throw new Error(`Nie można pobrać listy plików: HTTP ${response.status}`)
    const html = await response.text()

    const links = [...new Set([...html.matchAll(/href="([^"]*\/download\/[^"]*\.xlsx)"/gi)].map(m => m[1]))]
    if (links.length === 0) throw new Error('Nie znaleziono plików .xlsx na stronie UKE')

    await fs.rm(CURRENT_DIR, { recursive: true, force: true })
    await fs.mkdir(CURRENT_DIR, { recursive: true })

    const files = []
    for (const link of links) {
        const url = new URL(link, BIP_URL)
        const file = path.join(CURRENT_DIR, path.basename(url.pathname))
        console.log('Pobieranie', url.href)
        await fs.writeFile(file, await download(url))
        files.push(file)
    }
    const date = files.map(releaseDate).filter(Boolean).sort().pop()
    if (!date) throw new Error('Nie można odczytać daty wydania z nazw plików UKE')
    console.log(`Bieżące wydanie: ${date}, plików: ${files.length}`)
    return { date, source: 'bip.uke.gov.pl', files }
}

async function listArchive() {
    const resources = []
    let url = `${ARCHIVE_API_URL}?page=1&per_page=50&sort=-created`
    while (url) {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`Nie można pobrać listy archiwum: HTTP ${response.status}`)
        const body = await response.json()
        for (const item of body.data || []) {
            const attributes = item.attributes || {}
            const fileUrl = attributes.link || attributes.file_url || attributes.download_url
            if (fileUrl) resources.push({ id: item.id, created: attributes.created || '', url: fileUrl })
        }
        url = body.links?.next || null
    }
    return resources.sort((a, b) => b.created.localeCompare(a.created))
}

// Pobiera archiwum ZIP (albo bierze je z data/archive/) i odczytuje datę wydania z nazw plików.
async function fetchArchive(resource) {
    const file = path.join(ARCHIVE_DIR, `${resource.id}.zip`)
    let buffer
    try {
        buffer = await fs.readFile(file)
    } catch {
        console.log('Pobieranie archiwum', resource.url)
        buffer = await download(resource.url)
        await fs.writeFile(file, buffer)
    }
    const names = []
    unzipSync(new Uint8Array(buffer), { filter: entry => { names.push(entry.name); return false } })
    const date = names.filter(name => name.toLowerCase().endsWith('.xlsx')).map(releaseDate).filter(Boolean).sort().pop()
    if (!date) throw new Error(`Brak plików .xlsx z datą w archiwum ${resource.id}`)
    return { date, source: 'dane.gov.pl', resource: resource.id, zip: file }
}

await fs.mkdir(ARCHIVE_DIR, { recursive: true })

let current = null
try {
    current = await fetchCurrent()
} catch (error) {
    console.warn('Nie można pobrać bieżącego wykazu z BIP UKE:', error.message)
    console.warn('Bieżącym wydaniem będzie najnowsze wydanie z archiwum dane.gov.pl.')
}

const archive = []
if (HISTORY_MONTHS > 0 || !current) {
    let resources = []
    try {
        resources = await listArchive()
    } catch (error) {
        console.warn('Archiwum dane.gov.pl jest niedostępne, historia zmian nie powstanie:', error.message)
    }
    for (const resource of resources) {
        if (current && archive.length >= HISTORY_MONTHS) break
        let release
        try {
            release = await fetchArchive(resource)
        } catch (error) {
            console.warn(`Pominięto archiwum ${resource.id}:`, error.message)
            continue
        }
        if (!current) {
            current = release
            console.log(`Bieżące wydanie (z archiwum): ${current.date}`)
            continue
        }
        if (release.date >= current.date || archive.some(item => item.date === release.date)) continue
        console.log(`Wydanie archiwalne: ${release.date}`)
        archive.push(release)
    }
}

if (!current) throw new Error('Brak danych: BIP UKE i archiwum dane.gov.pl są niedostępne')

archive.sort((a, b) => a.date.localeCompare(b.date))
await fs.writeFile(path.join(DATA_DIR, 'releases.json'), JSON.stringify({ current, archive }, null, 2))
console.log(`Wydań do historii: ${archive.length}`)
