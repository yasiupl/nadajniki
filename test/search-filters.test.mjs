import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseQuery, matchStation, isEmptyQuery } from '../src/js/query.js'
import { emptyFilters, filtersToParams, filtersFromParams, createContext, applyFilters, indexStation } from '../src/js/filters.js'
import { normalize, slugify, formatFrequency, plural, formatDms, html, raw } from '../src/js/format.js'
import { stationIdFromPath } from '../src/js/data.js'

function station(overrides = {}) {
    const operator = { name: 'PKP Polskie Linie Kolejowe S.A.', category: 'railroad', searchName: normalize('PKP Polskie Linie Kolejowe S.A.') }
    const base = {
        uid: 0, id: '0123456789', operator, lat: 50.06, lon: 19.94, names: ['Kraków Płaszów'], name: 'Kraków Płaszów',
        location: 'Kraków, ul. Lipowa 1', types: 'A', type: 'A', stationTypes: 'FB ML', tx: [150.2, 150.35], rx: [150.2, 150.35],
        bandwidths: [12.5], erp: 10, radius: 15, antennaHeight: 30, expiry: '2030-01-01', permits: ['RRL/A/A/0001/2020'],
        office: 'DC', units: 2, since: '', changed: '', removed: '', ...overrides
    }
    const result = indexStation(base)
    result.nameText = normalize(result.names.join('\n'))
    result.locationText = normalize(result.location)
    result.searchText = normalize([operator.name, ...result.names, result.location, ...result.permits].join('\n'))
    result.frequencyText = ` ${result.frequencies.map(value => value.toFixed(5)).join(' ')} `
    return result
}

test('parseQuery recognizes text, phrases, frequencies, ranges and conditions', () => {
    const query = parseQuery('pkp "Kraków Płaszów" -tvn 150.2 148-149 typ:A,c erp>=10 r<20 kanal:12,5 150')
    assert.deepEqual(query.text, ['pkp', 'krakow plaszow'])
    assert.deepEqual(query.exclude, ['tvn'])
    assert.deepEqual(query.frequencies, ['150.2'])
    assert.deepEqual(query.ranges, [[148, 149]])
    assert.deepEqual(query.types, ['A', 'C'])
    assert.deepEqual(query.conditions, [{ field: 'erp', operator: '>=', value: 10 }, { field: 'radius', operator: '<', value: 20 }])
    assert.deepEqual(query.bandwidths, [12.5])
    assert.deepEqual(query.mixed, ['150'])
    assert.ok(isEmptyQuery(parseQuery('   ')))
})

test('matchStation applies every part of the query', () => {
    const s = station()
    const ok = text => matchStation(s, parseQuery(text))
    assert.ok(ok('pkp krakow'))
    assert.ok(ok('PŁASZÓW'))
    assert.ok(ok('150.2'))
    assert.ok(ok('150,35'))
    assert.ok(ok('150.3'), 'a frequency prefix matches')
    assert.ok(!ok('50.2'), 'a prefix must start at the beginning of a frequency')
    assert.ok(ok('150-151'))
    assert.ok(!ok('151-152'))
    assert.ok(ok('typ:a erp>5 r<=15 h>20 kanal:12.5'))
    assert.ok(!ok('erp>10'))
    assert.ok(!ok('pkp -krakow'))
    assert.ok(ok('rrl/a/a/0001'))
    assert.ok(ok('150'), 'an integer matches a frequency 150.x')
})

test('applyFilters counts facets without their own filter', () => {
    const stations = [
        station({ uid: 0, id: 'a000000000', types: 'A', type: 'A', bandwidths: [12.5] }),
        station({ uid: 1, id: 'b000000000', types: 'C', type: 'C', tx: [450.1], rx: [460.1], bandwidths: [25] }),
        station({ uid: 2, id: 'c000000000', types: 'AC', type: 'A', tx: [168.1], rx: [168.1], since: '2026-09-25' })
    ]
    const filters = emptyFilters()
    filters.types = new Set(['C'])
    const result = applyFilters(stations, filters, createContext(filters))
    assert.deepEqual(result.stations.map(s => s.id), ['b000000000', 'c000000000'])
    assert.equal(result.facets.types.get('A'), 2, 'the type facet ignores the type filter')
    assert.equal(result.facets.bands.get('uhf'), 1)

    filters.types.clear()
    filters.status = 'new'
    filters.release = '2026-09-25'
    assert.deepEqual(applyFilters(stations, filters, createContext(filters)).stations.map(s => s.id), ['c000000000'])

    const range = emptyFilters()
    range.frequencyMin = 450.1
    range.frequencyMax = 450.1
    assert.deepEqual(applyFilters(stations, range, createContext(range)).stations.map(s => s.id), ['b000000000'])
})

test('filters survive a round trip through the URL', () => {
    const filters = emptyFilters()
    filters.q = 'pkp kraków'
    filters.types = new Set(['A', 'C'])
    filters.bands = new Set(['vhf'])
    filters.frequencyMin = 148
    filters.frequencyMax = 149.5
    filters.status = 'removed'
    filters.release = '2026-09-25'
    filters.expiring = 12
    filters.operator = 'PKP Polskie Linie Kolejowe S.A.'
    const params = filtersToParams(filters)
    assert.equal(params.get('stan'), 'usuniete')
    const restored = filtersFromParams(new URLSearchParams(params.toString()))
    assert.deepEqual(restored, filters)
})

test('format helpers', () => {
    assert.equal(normalize('Łódź Żółć'), 'lodz zolc')
    assert.equal(slugify('PKP Polskie Linie Kolejowe S.A. Kraków 1'), 'pkp-polskie-linie-kolejowe-s-a-krakow-1')
    assert.equal(formatFrequency(150.2), '150.2000')
    assert.equal(formatFrequency(148.00625), '148.00625')
    assert.equal(plural(1, 'stacja', 'stacje', 'stacji'), 'stacja')
    assert.equal(plural(3, 'stacja', 'stacje', 'stacji'), 'stacje')
    assert.equal(plural(12, 'stacja', 'stacje', 'stacji'), 'stacji')
    assert.equal(plural(22, 'stacja', 'stacje', 'stacji'), 'stacje')
    assert.equal(formatDms(51.039167, 'N', 'S'), '51°02\'21"N')
    assert.equal(html`<b>${'<x>'}</b>${raw('<i>ok</i>')}`.value, '<b>&lt;x&gt;</b><i>ok</i>')
})

test('station paths', () => {
    assert.equal(stationIdFromPath('/stacja/3fa9c01b2e-pkp-krakow'), '3fa9c01b2e')
    assert.equal(stationIdFromPath('/stacja/3fa9c01b2e'), '3fa9c01b2e')
    assert.equal(stationIdFromPath('/stacja/3fa9c01b2e1f/'), '3fa9c01b2e1f')
    assert.equal(stationIdFromPath('/stacja/xyz'), null)
    assert.equal(stationIdFromPath('/'), null)
})

test('favorites filter keeps only the chosen stations and survives the URL', () => {
    const stations = [station({ uid: 0, id: 'a000000000' }), station({ uid: 1, id: 'b000000000' })]
    const filters = emptyFilters()
    filters.favorites = true
    const context = createContext(filters, { favorites: new Set(['b000000000']) })
    assert.deepEqual(applyFilters(stations, filters, context).stations.map(s => s.id), ['b000000000'])
    assert.deepEqual(applyFilters(stations, filters, createContext(filters)).stations, [], 'no favorites: no stations')
    const params = filtersToParams(filters)
    assert.equal(params.get('ulubione'), '1')
    assert.equal(filtersFromParams(params).favorites, true)
})

test('point filter keeps stations whose service area covers the point', () => {
    const near = station({ uid: 0, id: 'a000000000', lat: 50.06, lon: 19.94, radius: 5 })
    const far = station({ uid: 1, id: 'b000000000', lat: 50.06, lon: 20.5, radius: 5 })
    const big = station({ uid: 2, id: 'c000000000', lat: 50.06, lon: 20.5, radius: 50 })
    const filters = emptyFilters()
    filters.point = { lat: 50.07, lng: 19.95 }
    assert.deepEqual(applyFilters([near, far, big], filters, createContext(filters)).stations.map(s => s.id), ['a000000000', 'c000000000'])
    const restored = filtersFromParams(new URLSearchParams(filtersToParams(filters).toString()))
    assert.deepEqual(restored.point, { lat: 50.07, lng: 19.95 })
    assert.equal(filtersFromParams(new URLSearchParams('punkt=abc')).point, null)
})
