// Pobiera wykaz pozwoleń RRL z BIP UKE do katalogu data/.
import fs from 'node:fs/promises'
import path from 'node:path'

const BASE_URL = 'https://bip.uke.gov.pl'
const LIST_URL = `${BASE_URL}/pozwolenia-radiowe/wykaz-pozwolen-radiowych-tresci/klasyczne-sieci-rrl,9.html`
const DATA_DIR = 'data'

await fs.rm('src/sources.json', { force: true })
await fs.rm('dist/data', { recursive: true, force: true })
await fs.mkdir('dist/data', { recursive: true })
await fs.mkdir(DATA_DIR, { recursive: true })

const response = await fetch(LIST_URL)
if (!response.ok) throw new Error(`Nie można pobrać listy plików: HTTP ${response.status}`)
const html = await response.text()

const links = [...new Set([...html.matchAll(/href="([^"]*\/download\/[^"]*\.xlsx)"/gi)].map(m => m[1]))]
if (links.length === 0) throw new Error('Nie znaleziono plików .xlsx na stronie UKE')

for (const link of links) {
    const url = new URL(link, BASE_URL)
    const file = path.join(DATA_DIR, path.basename(url.pathname))
    console.log('Pobieranie', url.href)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Nie można pobrać ${url.href}: HTTP ${res.status}`)
    await fs.writeFile(file, Buffer.from(await res.arrayBuffer()))
}

console.log(`Pobrano plików: ${links.length}`)
