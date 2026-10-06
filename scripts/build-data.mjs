// Przetwarza wydania wykazu opisane w data/releases.json (patrz fetch-data.mjs) i zapisuje do dist/data/:
// - stations.json: skrócone rekordy wszystkich stacji (mapa, wyszukiwarka, filtry, analizy),
// - details/XX.json: pełne rekordy stacji, podzielone według dwóch pierwszych znaków identyfikatora,
// - history.json: zmiany między kolejnymi wydaniami (stacje nowe, usunięte i zmienione).
import fs from 'node:fs'
import path from 'node:path'
import { unzipSync } from 'fflate'
import { readXlsx } from './lib/xlsx.mjs'
import { CATEGORIES } from './lib/categories.mjs'
import {
    STATION_FIELDS, DETAIL_FIELDS, parseSheets, officeFromFile, groupStations, buildOperators,
    compactStation, detailRecords
} from './lib/stations.mjs'
import { History } from './lib/history.mjs'
import { pipelineHash } from './lib/pipeline.mjs'

const OUTPUT_DIR = path.join('dist', 'data')
const DETAILS_DIR = path.join(OUTPUT_DIR, 'details')

function loadRecords(release) {
    const records = []
    if (release.files) {
        for (const file of release.files) {
            records.push(...parseSheets(readXlsx(fs.readFileSync(file)), officeFromFile(file)))
        }
    } else {
        const files = unzipSync(new Uint8Array(fs.readFileSync(release.zip)), {
            filter: entry => entry.name.toLowerCase().endsWith('.xlsx')
        })
        for (const [name, content] of Object.entries(files)) {
            records.push(...parseSheets(readXlsx(content), officeFromFile(name)))
        }
    }
    return records
}

function writeJson(file, data) {
    fs.writeFileSync(file, JSON.stringify(data))
    return fs.statSync(file).size
}

const generated = Date.now()
const { current, archive } = JSON.parse(fs.readFileSync(path.join('data', 'releases.json'), 'utf8'))
const releases = [...archive, current]

// Historia: kolejne wydania od najstarszego (patrz lib/history.mjs).
const history = new History()
let stations = null
for (const release of releases) {
    const started = Date.now()
    const records = loadRecords(release)
    stations = groupStations(records)
    const entry = history.add(release.date, stations)
    console.log(`${release.date} (${release.source}): rekordów ${records.length}, stacji ${stations.size}` +
        (entry.added !== undefined ? `, nowe ${entry.added}, usunięte ${entry.removed}, zmienione ${entry.changed}, przeniesione ${entry.moved}` : '') +
        ` [${Date.now() - started} ms]`)
}
const { since, lastChange, removed, aliases, events } = history

// Bieżące wydanie: tabela operatorów, kategorie i skrócone rekordy.
const operators = buildOperators(stations)
const operatorIndex = new Map(operators.map((operator, index) => [operator.key, index]))

const categoryNames = new Map(CATEGORIES.map(category => [category.key, category.name]))
for (const operator of operators) {
    if (!categoryNames.has(operator.category)) categoryNames.set(operator.category, operator.name)
}
const usedCategories = new Set(operators.map(operator => operator.category))
const categories = [...categoryNames].filter(([key]) => usedCategories.has(key)).map(([key, name]) => ({ key, name }))

// Numery pozwoleń powtarzają się w wielu stacjach, więc stations.json ma ich osobną tabelę.
const permits = []
const permitIndex = new Map()
const PERMITS = STATION_FIELDS.indexOf('permits')
const compact = [...stations.values()].map(station => {
    const record = compactStation(station, operatorIndex.get(station.opKey))
    record[PERMITS] = record[PERMITS].map(permit => {
        if (!permitIndex.has(permit)) permitIndex.set(permit, permits.push(permit) - 1)
        return permitIndex.get(permit)
    })
    return [...record, since.get(station.id) || '', lastChange.get(station.id) || '']
})

fs.rmSync(OUTPUT_DIR, { recursive: true, force: true })
fs.mkdirSync(DETAILS_DIR, { recursive: true })

const stationsSize = writeJson(path.join(OUTPUT_DIR, 'stations.json'), {
    version: 2,
    release: current.date,
    source: current.source,
    generated,
    releases: releases.map(release => release.date),
    fields: [...STATION_FIELDS, 'since', 'changed'],
    detailFields: DETAIL_FIELDS,
    operators: operators.map(operator => [operator.name, operator.address, operator.category]),
    categories,
    permits,
    stations: compact
})

const shards = new Map()
for (const station of stations.values()) {
    const shard = station.id.slice(0, 2)
    if (!shards.has(shard)) shards.set(shard, {})
    shards.get(shard)[station.id] = detailRecords(station)
}
let detailsSize = 0
for (const [shard, content] of shards) detailsSize += writeJson(path.join(DETAILS_DIR, `${shard}.json`), content)

// Stacje usunięte w okresie historii. Operatorzy usuniętych stacji mają własną tabelę,
// bo mogą nie występować w bieżącym wydaniu.
const removedOperators = []
const removedOperatorIndex = new Map()
const removedRecords = [...removed.values()].map(({ station, date }) => {
    const names = station.records.map(record => record.op)
    if (!removedOperatorIndex.has(station.opKey)) {
        removedOperatorIndex.set(station.opKey, removedOperators.length)
        removedOperators.push([names[0], station.records[0].opAddress])
    }
    return [...compactStation(station, removedOperatorIndex.get(station.opKey)), date]
})

const historySize = writeJson(path.join(OUTPUT_DIR, 'history.json'), {
    release: current.date,
    releases: history.releases,
    fields: [...STATION_FIELDS, 'removed'],
    operators: removedOperators,
    removed: removedRecords,
    aliases: Object.fromEntries(aliases),
    events: Object.fromEntries(events)
})

// Opis danych dla scripts/data.mjs: kolejne budowanie może skopiować te pliki zamiast budować je od nowa.
writeJson(path.join(OUTPUT_DIR, 'manifest.json'), {
    version: 2,
    release: current.date,
    generated,
    pipeline: pipelineHash(),
    files: ['stations.json', 'history.json', ...[...shards.keys()].sort().map(shard => `details/${shard}.json`)]
})

const kB = size => `${Math.round(size / 1024)} kB`
console.log(`Stacji: ${compact.length}, operatorów: ${operators.length}, kategorii: ${categories.length}`)
console.log(`stations.json ${kB(stationsSize)}, details ${kB(detailsSize)} (${shards.size} plików), history.json ${kB(historySize)}`)
