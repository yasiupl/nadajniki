import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chirpName, chirpChannels, toChirp, toSdrSharp, sdrEntries, toCsv, CHIRP_LIMIT } from '../src/js/export.js'
import { toAscii } from '../src/js/format.js'

function station(overrides = {}) {
    return {
        id: '0123456789', uid: 0, operator: { name: 'PKP Polskie Linie Kolejowe S.A.' }, name: 'Kraków Płaszów',
        location: 'Kraków', types: 'A', type: 'A', tx: [150.2], rx: [150.2], bandwidths: [25], erp: 10, radius: 15,
        antennaHeight: 30, lat: 50.04, lon: 19.98, permits: ['RRL/A/A/0001/2020'], expiry: '2030-01-01', since: '', removed: '',
        ...overrides
    }
}

test('chirpName builds a short channel name from the operator name', () => {
    assert.equal(chirpName('PKP Polskie Linie Kolejowe S.A.'), 'PKP PLK')
    assert.equal(chirpName('Lotnicze Pogotowie Ratunkowe'), 'LPR')
    assert.equal(chirpName('Miejskie Przedsiębiorstwo Wodociągów i Kanalizacji w Poddębicach sp. z o.o.'), 'MPWKP')
    assert.equal(chirpName('Komenda Wojewódzka Państwowej Straży Pożarnej w Krakowie'), 'KWPSPK')
    assert.equal(chirpName('"IP Connect" sp. z o.o.'), 'IP C')
    assert.equal(chirpName('SECURITAS POLSKA Sp. z o.o.'), 'SECURITA')
    assert.equal(chirpName('Spółka z ograniczoną odpowiedzialnością Żółw'), 'ZOLW')
    assert.ok(chirpName('Państwowe Gospodarstwo Leśne Lasy Państwowe Nadleśnictwo Łąck').length <= 8)
})

test('toAscii removes Polish diacritics and keeps the letter case', () => {
    assert.equal(toAscii('Łódź Żółć ąęś'), 'Lodz Zolc aes')
})

test('toChirp writes receive-only channels in the CHIRP CSV format', () => {
    const csv = toChirp([
        station(),
        station({ id: '1', operator: { name: 'Inny operator' }, tx: [150.2, 148.00625], bandwidths: [12.5] }),
        station({ id: '2', operator: { name: 'Trzeci' }, tx: [151.105], bandwidths: [12.5] })
    ])
    assert.ok(!csv.startsWith('\ufeff'), 'no byte order mark')
    assert.ok(csv.endsWith('\r\n'))
    const lines = csv.trimEnd().split('\r\n')
    assert.equal(lines[0], 'Location,Name,Frequency,Duplex,Offset,Tone,rToneFreq,cToneFreq,DtcsCode,DtcsPolarity,Mode,TStep,Skip,Comment,URCALL,RPT1CALL,RPT2CALL,DVCODE')
    assert.equal(lines.length, 4, 'one channel per transmit frequency')
    assert.equal(lines[1], '0,INNY,148.006250,off,0.000000,,88.5,88.5,023,NN,NFM,6.25,,Inny operator - Krakow Plaszow,,,,')
    assert.equal(lines[2], '1,PKP PLK,150.200000,off,0.000000,,88.5,88.5,023,NN,FM,12.50,,PKP Polskie Linie Kolejowe S.A. - Krakow Plaszow (+1 innych operatorow),,,,')
    assert.equal(lines[3].split(',')[11], '5.00')
    for (const line of lines.slice(1)) assert.equal(line.split(',')[3], 'off', 'transmit is off on every channel')
})

test('toChirp keeps at most CHIRP_LIMIT channels', () => {
    const frequencies = Array.from({ length: CHIRP_LIMIT + 5 }, (_, i) => Math.round((400 + i * 0.0125) * 1e5) / 1e5)
    assert.equal(chirpChannels([station({ tx: frequencies })]).length, CHIRP_LIMIT + 5)
    const lines = toChirp([station({ tx: frequencies })]).trimEnd().split('\r\n')
    assert.equal(lines.length, CHIRP_LIMIT + 1)
    assert.equal(lines.at(-1).split(',')[0], String(CHIRP_LIMIT - 1))
})

test('SDR# and table exports', () => {
    const stations = [station(), station({ id: '1', tx: [150.2, 151] })]
    assert.equal(sdrEntries(stations).length, 2, 'one entry per frequency and operator')
    assert.match(toSdrSharp(stations), /<Frequency>150200000<\/Frequency>/)
    const table = toCsv(stations, 'https://example.org')
    assert.ok(table.startsWith('\ufeffOperator;'), 'Excel needs the byte order mark')
    assert.match(table, /https:\/\/example\.org\/stacja\/0123456789-/)
})
