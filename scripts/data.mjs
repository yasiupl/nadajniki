// Dane strony (dist/data/): kopia z działającej strony albo pełne budowanie.
//
// Pełne budowanie (fetch-data, build-data, fetch-stats) trwa kilka minut. Gdy zmiana dotyczy tylko
// interfejsu, skrypt kopiuje gotowe pliki z działającej strony. Zmienna DATA_BUILD wybiera tryb:
//   auto (domyślnie)  kopia, jeśli dane strony są aktualne i potok danych się nie zmienił,
//   full              zawsze pełne budowanie,
//   reuse             kopia bez sprawdzania aktualności (potok danych nadal musi być ten sam).
// Dane strony są aktualne, jeśli BIP UKE nie ma nowszego wydania. Jeśli BIP UKE nie działa, podgląd gałęzi
// używa danych młodszych niż MAX_AGE_DAYS, a produkcja buduje dane od nowa.
// Opcja --dry-run tylko wypisuje decyzję.
import fs from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { pipelineHash } from './lib/pipeline.mjs'
import { latestBipRelease } from './lib/sources.mjs'

const MODE = process.env.DATA_BUILD || 'auto'
const SITE_URL = (process.env.DATA_REUSE_URL || 'https://nadajniki.yasiu.pl').replace(/\/$/, '')
const OUTPUT_DIR = path.join('dist', 'data')
const MAX_AGE_DAYS = 31
const PARALLEL_DOWNLOADS = 16
const TIMEOUT_MS = 30000

// Podgląd gałęzi: Vercel (VERCEL_ENV) albo Netlify (CONTEXT).
const isPreview = process.env.VERCEL_ENV === 'preview' || ['deploy-preview', 'branch-deploy'].includes(process.env.CONTEXT)

async function fetchOk(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`)
    return response
}

async function decide() {
    if (MODE === 'full') return { reuse: false, reason: 'DATA_BUILD=full' }

    let manifest
    try {
        manifest = await (await fetchOk(`${SITE_URL}/data/manifest.json`)).json()
    } catch (error) {
        return { reuse: false, reason: `brak danych do skopiowania na ${SITE_URL} (${error.message})` }
    }
    const pipeline = pipelineHash()
    if (manifest.pipeline !== pipeline) {
        return { reuse: false, reason: `potok danych jest inny niż na stronie (${manifest.pipeline} / ${pipeline})` }
    }
    if (MODE === 'reuse') return { reuse: true, reason: 'DATA_BUILD=reuse', manifest }

    try {
        const latest = await latestBipRelease()
        if (latest > manifest.release) return { reuse: false, reason: `BIP UKE ma nowe wydanie ${latest} (strona: ${manifest.release})` }
        return { reuse: true, reason: `dane strony są aktualne (wydanie ${manifest.release})`, manifest }
    } catch (error) {
        const age = (Date.now() - manifest.generated) / 86400000
        if (isPreview && age < MAX_AGE_DAYS) {
            return { reuse: true, reason: `BIP UKE nie działa (${error.message}), dane mają ${Math.floor(age)} dni`, manifest }
        }
        return { reuse: false, reason: `BIP UKE nie działa (${error.message})` }
    }
}

async function copyFromSite(manifest) {
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true })
    await fs.mkdir(path.join(OUTPUT_DIR, 'details'), { recursive: true })
    const files = [...manifest.files]
    let next = 0
    const worker = async () => {
        while (next < files.length) {
            const file = files[next++]
            const response = await fetchOk(`${SITE_URL}/data/${file}`)
            await fs.writeFile(path.join(OUTPUT_DIR, file), Buffer.from(await response.arrayBuffer()))
        }
    }
    await Promise.all(Array.from({ length: PARALLEL_DOWNLOADS }, worker))
    // Statystyki wejść są opcjonalne (powstają tylko z kluczem API Plausible).
    try {
        const response = await fetchOk(`${SITE_URL}/data/popular.json`)
        await fs.writeFile(path.join(OUTPUT_DIR, 'popular.json'), Buffer.from(await response.arrayBuffer()))
    } catch {
        // Strona nie ma statystyk wejść.
    }
    await fs.writeFile(path.join(OUTPUT_DIR, 'manifest.json'), JSON.stringify(manifest))
    return files.length
}

function run(script, nodeOptions = []) {
    const result = spawnSync(process.execPath, [...nodeOptions, script], { stdio: 'inherit' })
    if (result.status !== 0) process.exit(result.status ?? 1)
}

const started = Date.now()
const decision = await decide()
console.log(`Dane: ${decision.reuse ? 'kopia z działającej strony' : 'pełne budowanie'}. Powód: ${decision.reason}.`)
if (process.argv.includes('--dry-run')) process.exit(0)

if (decision.reuse) {
    try {
        const count = await copyFromSite(decision.manifest)
        console.log(`Skopiowano ${count} plików z ${SITE_URL}/data/ (wydanie ${decision.manifest.release}) w ${Math.round((Date.now() - started) / 1000)} s.`)
        process.exit(0)
    } catch (error) {
        console.warn(`Kopia danych nie powiodła się (${error.message}). Pełne budowanie.`)
    }
}

run('scripts/fetch-data.mjs')
run('scripts/build-data.mjs', ['--max-old-space-size=4096'])
run('scripts/fetch-stats.mjs')
