import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SLOTS, chooseSlot, measurement, slotHtml, goalHtml, hiddenSlotIds, hideSlotId, SLOT_VERSION } from '../src/js/partner.js'

const memory = (initial = {}) => {
    const data = { ...initial }
    return { getItem: key => data[key] ?? null, setItem: (key, value) => { data[key] = String(value) } }
}

test('chooseSlot draws only from contents the user did not hide', () => {
    assert.equal(chooseSlot(SLOTS, [], () => 0).id, SLOTS[0].id)
    assert.equal(chooseSlot(SLOTS, [], () => 0.99).id, SLOTS.at(-1).id)
    assert.equal(chooseSlot(SLOTS, ['wsparcie'], () => 0.99).id, 'zaproszenie')
    assert.equal(chooseSlot(SLOTS, SLOTS.map(slot => slot.id)), null)
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

test('hiding is stored per content and version', () => {
    const storage = memory()
    hideSlotId('wsparcie', storage)
    hideSlotId('wsparcie', storage)
    assert.deepEqual(hiddenSlotIds(storage), ['wsparcie'])
    hideSlotId('zaproszenie', storage)
    assert.deepEqual(hiddenSlotIds(storage), ['wsparcie', 'zaproszenie'])
    assert.deepEqual(hiddenSlotIds(memory({ 'panel-note-hidden': JSON.stringify({ version: 'old', ids: ['wsparcie'] }) })), [])
    assert.deepEqual(hiddenSlotIds(memory({ 'panel-note-hidden': 'not json' })), [])
    assert.equal(SLOT_VERSION.length > 0, true)
})

test('slot without hide button for the menu', () => {
    const slot = SLOTS.find(item => item.id === 'wsparcie')
    assert.match(slotHtml(slot), /data-note-hide/)
    assert.doesNotMatch(slotHtml(slot, { hideable: false }), /data-note-hide/)
})

test('profile appears only on request', () => {
    const slot = SLOTS.find(item => item.id === 'wsparcie')
    assert.doesNotMatch(slotHtml(slot), /note-profile/)
    const html = slotHtml(slot, { hideable: false, profile: true })
    assert.match(html, /Jestem autorem tej strony\./)
    assert.match(html, /data-note-link="portfolio"/)
    assert.match(html, /local_cafe/)
    assert.match(html, /href="https:\/\/www\.qrz\.com\/db\/SP4EVA"/)
    assert.match(html, /data-note-link="qrz"/)
})
