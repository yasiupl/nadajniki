import { test } from 'node:test'
import assert from 'node:assert/strict'
import { zipSync, strToU8 } from 'fflate'
import { readXlsx } from '../scripts/lib/xlsx.mjs'
import {
    excelDate, parseDms, parseList, operatorKey, officeFromFile, parseSheets, groupStations, compactStation, signature
} from '../scripts/lib/stations.mjs'
import { History, findMoves } from '../scripts/lib/history.mjs'

const HEADER = ['Nr referencyjny', 'Ważna do', 'Nazwa stacji', 'Rodz stacji', 'Rodz sieci', 'Dł geo', 'Szer geo', 'R obsł',
    'Lokalizacja stacji', 'ERP', 'Azymut', 'Elewacja', 'Polar', 'Zysk ant', 'H anteny', 'H terenu', 'Ch-ka poz', 'Ch-ka pion',
    'Częstotliwości nadawcze', 'Częstotliwości odbiorcze', 'Szer kanałów nad', 'Szer kanałów odb', 'Operator', 'Adres operatora']

function row(overrides = {}) {
    const values = {
        permit: 'RRL/A/A/0001/2020', expiry: '47254', name: 'Bazowa 1', stationType: 'FB', networkType: 'A',
        lon: '23E07\'10"', lat: '53N06\'58"', radius: '25', location: 'Białystok, ul. Składowa 11', erp: '7', azimuth: '',
        elevation: '', polarization: 'V', gain: '3', antennaHeight: '28', groundHeight: '143', hChar: '000ND00',
        vChar: '000ND00', tx: '163.60000', rx: '163.60000', txSpan: '12.50', rxSpan: '12.50',
        op: 'Komunalne Przedsiębiorstwo Sp. z o.o.', opAddress: 'Białystok Składowa 7', ...overrides
    }
    return [values.permit, values.expiry, values.name, values.stationType, values.networkType, values.lon, values.lat,
        values.radius, values.location, values.erp, values.azimuth, values.elevation, values.polarization, values.gain,
        values.antennaHeight, values.groundHeight, values.hChar, values.vChar, values.tx, values.rx, values.txSpan,
        values.rxSpan, values.op, values.opAddress]
}

const sheet = rows => [{ name: 'Arkusz', rows: [HEADER, ...rows] }]
const stationsOf = rows => groupStations(parseSheets(sheet(rows), 'OBI'))

// Minimalny plik XLSX: wspólne teksty, komórka z tekstem w treści, liczba, pusta kolumna.
function buildXlsx() {
    const xml = {
        'xl/workbook.xml': '<workbook xmlns:r="r"><sheets><sheet name="OBI &amp; co" sheetId="1" r:id="rId1"/></sheets></workbook>',
        'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
        'xl/sharedStrings.xml': '<sst><si><t>Nazwa</t></si><si><r><t>Kraków </t></r><r><t xml:space="preserve">&amp; okolice</t></r></si></sst>',
        'xl/worksheets/sheet1.xml': '<worksheet><sheetData>' +
            '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="inlineStr"><is><t>Częstotliwość</t></is></c></row>' +
            '<row r="2"><c r="A2" t="s"><v>1</v></c><c r="C2"><v>148.0125</v></c></row>' +
            '</sheetData></worksheet>'
    }
    return zipSync(Object.fromEntries(Object.entries(xml).map(([name, content]) => [name, strToU8(content)])))
}

test('readXlsx reads shared strings, inline strings, numbers and empty columns', () => {
    const [result] = readXlsx(buildXlsx())
    assert.equal(result.name, 'OBI & co')
    assert.deepEqual(result.rows, [['Nazwa', '', 'Częstotliwość'], ['Kraków & okolice', '', '148.0125']])
})

test('value parsers', () => {
    assert.equal(excelDate('47254'), '2029-05-16')
    assert.equal(excelDate('2027-01-10'), '2027-01-10')
    assert.equal(parseDms('23E07\'10"'), 23.11944)
    assert.equal(parseDms('05W00\'00"'), -5)
    assert.equal(parseDms(''), null)
    assert.deepEqual(parseList('148.01250, 150.20000, -'), [148.0125, 150.2])
    assert.equal(operatorKey('Mennica Ochrona Sp. z o. o.'), operatorKey('MENNICA OCHRONA sp. z o.o.'))
    assert.equal(officeFromFile('data/current/dc_-_stan_na_2026-09-25.xlsx'), 'DC')
    assert.equal(officeFromFile('OKR - stan na 2026-09-25.xlsx'), 'OKR')
})

test('parseSheets normalizes number formats and swapped coordinates', () => {
    const [record] = parseSheets(sheet([row({ erp: '9.3000000000000007', radius: '3,7', lon: '53N06\'58"', lat: '23E07\'10"' })]), 'OBI')
    assert.equal(record.erp, '9.3')
    assert.equal(record.radius, '3.7')
    assert.equal(record.parsed.lat, 53.11611)
    assert.equal(record.parsed.lon, 23.11944)
    assert.equal(record.expiry, '2029-05-16')
    assert.equal(record.tx, '163.6')
})

test('groupStations merges records of one operator at one place and gives stable ids', () => {
    const stations = stationsOf([
        row(),
        row({ name: 'Białystok 101..150', stationType: 'ML', tx: '163.60000, 163.62500', rx: '163.60000, 163.62500', txSpan: '12.50, 12.50' }),
        row({ op: 'Inny operator' }),
        row({ lon: '', lat: '', name: 'INTR 1' })
    ])
    assert.equal(stations.size, 3)
    const again = stationsOf([row({ name: 'Bazowa 1' })])
    const [id] = again.keys()
    assert.ok(stations.has(id), 'the same operator and place give the same id')
    const merged = stations.get(id)
    assert.equal(merged.records.length, 2)
    const compact = compactStation(merged, 0)
    assert.deepEqual(compact[4], ['Bazowa 1'])
    assert.deepEqual(compact[8], [163.6, 163.625])
    assert.equal(compact[9], 0, 'rx equal to tx is stored as 0')
    assert.equal(compact[7], 'FB ML')
    const unlocated = [...stations.values()].find(station => station.lat === null)
    assert.ok(unlocated)
})

test('signature ignores number formatting', () => {
    const [a] = stationsOf([row({ erp: '9.3000000000000007' })]).values()
    const [b] = stationsOf([row({ erp: '9.300000000000001' })]).values()
    assert.deepEqual(signature(a), signature(b))
})

test('History records added, removed, changed and moved stations', () => {
    const history = new History()
    const base = [
        row({ op: 'Operator A' }),
        row({ op: 'Operator B', lon: '20E00\'00"', lat: '50N00\'00"' }),
        row({ op: 'Operator C', lon: '21E00\'00"', lat: '51N00\'00"', permit: 'RRL/C/1' })
    ]
    const first = stationsOf(base)
    history.add('2026-08-25', first)
    const idOf = (stations, operator) => [...stations.values()].find(station => station.records[0].op === operator).id

    const second = stationsOf([
        row({ op: 'Operator A', tx: '163.60000, 164.00000', rx: '163.60000, 164.00000', txSpan: '12.50, 12.50' }),
        // Operator C: współrzędne poprawione o ok. 300 m, to samo pozwolenie.
        row({ op: 'Operator C', lon: '21E00\'00"', lat: '51N00\'10"', permit: 'RRL/C/1' }),
        row({ op: 'Operator D', lon: '22E00\'00"', lat: '52N00\'00"' })
    ])
    const entry = history.add('2026-09-25', second)
    assert.deepEqual(entry, { date: '2026-09-25', stations: 3, added: 1, removed: 1, changed: 1, moved: 1 })

    const a = idOf(second, 'Operator A')
    assert.deepEqual(history.events.get(a), [['2026-09-25', 'c', 'ft', [164], []]])
    assert.equal(history.since.get(a), null)

    const oldC = idOf(first, 'Operator C')
    const newC = idOf(second, 'Operator C')
    assert.notEqual(oldC, newC)
    assert.equal(history.aliases.get(oldC), newC)
    assert.equal(history.events.get(newC)[0][1], 'm')
    assert.equal(history.events.get(newC)[0][2], oldC)
    assert.ok(Math.abs(history.events.get(newC)[0][3] - 309) < 5)

    const b = idOf(first, 'Operator B')
    assert.equal(history.removed.get(b).date, '2026-09-25')
    assert.deepEqual(history.events.get(b), [['2026-09-25', 'r']])

    const d = idOf(second, 'Operator D')
    assert.equal(history.since.get(d), '2026-09-25')
})

test('findMoves needs the same operator, a short distance and a shared permit or frequencies', () => {
    const before = stationsOf([row({ op: 'X', permit: 'P1' })])
    const near = stationsOf([row({ op: 'X', permit: 'P2', tx: '170.00000', rx: '170.00000', lat: '53N07\'20"' })])
    const snapshot = stations => new Map([...stations].map(([id, station]) => [id, signature(station)]))
    const moves = findMoves([...before.keys()], [...near.keys()], before, near, snapshot(before), snapshot(near))
    assert.equal(moves.length, 0, 'different permit and frequencies: not a move')
})

test('coordinates: swapped values are fixed, coordinates outside Poland are flagged', () => {
    const stations = stationsOf([
        row({ op: 'Swapped', lon: '51E47\'32"', lat: '19N27\'14"' }),
        row({ op: 'Truncated', lon: '20E26\'25"', lat: '05N04\'19"' })
    ])
    const swapped = [...stations.values()].find(station => station.records[0].op === 'Swapped')
    assert.equal(swapped.lat, 51.79222)
    assert.equal(swapped.lon, 19.45389)
    const truncated = [...stations.values()].find(station => station.records[0].op === 'Truncated')
    assert.equal(truncated.lat, null)
    assert.deepEqual(truncated.badLocation, [5.07194, 20.44028])
    assert.equal(compactStation(truncated, 0).at(-1).length, 2)
})
