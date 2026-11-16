import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SLOTS, chooseSlot, measurement, slotHtml, goalHtml, isSlotHidden, SLOT_VERSION } from '../src/js/partner.js'

const memory = (initial = {}) => {
    const data = { ...initial }
    return { getItem: key => data[key] ?? null, setItem: (key, value) => { data[key] = String(value) } }
}

test('chooseSlot keeps one content for the session', () => {
    const storage = memory()
    const first = chooseSlot(SLOTS, storage, () => 0.99)
    assert.equal(first.id, SLOTS.at(-1).id)
    assert.equal(chooseSlot(SLOTS, storage, () => 0).id, first.id)
})

test('measurement separates blocking from hiding by the user', () => {
    assert.deepEqual(measurement({ baitHidden: false, slotRendered: true, slotHiddenByUser: false }), { blokada: 'nie', miejsce: 'widoczne' })
    assert.deepEqual(measurement({ baitHidden: true, slotRendered: false, slotHiddenByUser: false }), { blokada: 'tak', miejsce: 'ukryte przez blokadę' })
    assert.deepEqual(measurement({ baitHidden: true, slotRendered: false, slotHiddenByUser: true }), { blokada: 'tak', miejsce: 'ukryte przez użytkownika' })
})

test('slot markup has no class names that ad filters hide', () => {
    for (const slot of SLOTS) {
        const classes = [...slotHtml(slot).matchAll(/class="([^"]+)"/g)].flatMap(match => match[1].split(' '))
        for (const name of classes) assert.doesNotMatch(name, /(^|-)(ad|ads|advert|reklama|sponsor|banner|promo)(-|$)/i, name)
    }
})

test('goal bar appears only with both amounts', () => {
    assert.equal(goalHtml({ year: 2026, collected: null, target: 500 }), '')
    const html = goalHtml({ year: 2026, collected: 347, target: 500 })
    assert.match(html, /aria-valuenow="69"/)
    assert.match(html, /347 zł z 500 zł/)
    assert.match(goalHtml({ year: 2026, collected: 900, target: 500 }), /width:100\.0%/)
})

test('hiding is stored per content version', () => {
    assert.equal(isSlotHidden(memory({ 'panel-note-hidden': SLOT_VERSION })), true)
    assert.equal(isSlotHidden(memory({ 'panel-note-hidden': 'old' })), false)
})

test('slot without hide button for the menu', () => {
    const slot = SLOTS.find(item => item.id === 'wsparcie')
    assert.match(slotHtml(slot), /data-note-hide/)
    assert.doesNotMatch(slotHtml(slot, { hideable: false }), /data-note-hide/)
})
