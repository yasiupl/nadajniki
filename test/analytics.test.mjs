import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GOALS, track } from '../src/js/analytics.js'

test('track sends Plausible events with text properties and skips empty ones', () => {
    const calls = []
    globalThis.window = { plausible: (...args) => calls.push(args) }
    track(GOALS.export, { format: 'CHIRP', zakres: 'ulubione', puste: '', brak: null })
    track(GOALS.point)
    track(GOALS.filter, { liczba: 3 })
    assert.deepEqual(calls, [
        ['Eksport', { props: { format: 'CHIRP', zakres: 'ulubione' } }],
        ['Zasięg w punkcie'],
        ['Filtr', { props: { liczba: '3' } }]
    ])
    delete globalThis.window
    assert.doesNotThrow(() => track(GOALS.search, { rodzaj: 'tekst' }), 'no error without Plausible')
})
