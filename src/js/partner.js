// Miejsce na reklamę w panelu i pomiar blokad reklam.
// Reklama to statyczny tekst i link z tej strony. Strona nie wczytuje skryptów sieci reklamowych.
// Klasy i identyfikatory nie zawierają słów "ad", "reklama", "sponsor" ani "banner".
// Filtry blokad reklam ukrywają elementy z takimi nazwami.
import { GOALS, track } from './analytics.js'

// Roczny cel zbiórki na koszty strony. Pasek postępu jest widoczny, gdy obie kwoty mają wartość (w zł).
// Zmień "collected" po każdej wpłacie.
export const SUPPORT_GOAL = { year: 2026, collected: 35, target: 500 }

// Mini profil autora w menu bocznym i w oknie wsparcia.
// Zdjęcie to łącze do pliku na yasiu.pl. Zmiana zdjęcia na yasiu.pl zmienia też zdjęcie tutaj.
// callsign: znak radioamatorski.
export const AUTHOR = {
    name: 'Marcin Jasiukowicz',
    callsign: 'SP4EVA',
    slogan: 'Majsterkowicz zafascynowany kosmosem 🚀',
    photo: 'https://yasiu.pl/assets/meirl.png',
    about: 'Jestem autorem tej strony.',
    portfolio: { text: 'Zobacz, czym jeszcze się zajmuję', href: 'https://yasiu.pl' }
}

// Treści miejsca. Strona wybiera jedną treść na sesję przeglądarki.
// id: nazwa treści w zdarzeniach Plausible (właściwość "tresc").
// links[].id: nazwa linku w zdarzeniach Plausible (właściwość "akcja").
export const SLOTS = [
    {
        id: 'zaproszenie',
        label: 'Miejsce na reklamę',
        title: 'Tu może być Twoja reklama',
        text: 'Jeden statyczny baner. Bez śledzenia i bez skryptów sieci reklamowych.',
        links: [
            { id: 'kontakt', text: 'Napisz', href: 'mailto:nadajniki@yasiu.pl?subject=Reklama%20na%20Mapie%20nadajnik%C3%B3w' }
        ]
    },
    {
        id: 'wsparcie',
        label: 'Od autora',
        title: 'Pomóż pokryć koszty strony',
        goal: SUPPORT_GOAL,
        text: 'Mapa jest bezpłatna i bez reklam sieciowych. Wpłaty pokrywają koszty serwera i map oraz rozwój nowych funkcji.',
        links: [
            { id: 'kawa', text: 'Postaw kawę', icon: 'local_cafe', href: 'https://buycoffee.to/yasiu' }
        ]
    }
]

// Zmień SLOT_VERSION, gdy zmieniasz treści. Użytkownik, który ukrył stare treści, zobaczy nowe treści jeden raz.
export const SLOT_VERSION = '1'
const HIDDEN_KEY = 'panel-note-hidden'
const MEASURED_KEY = 'panel-note-measured'
const CHOSEN_KEY = 'panel-note-choice'

// Nazwy klas, które ukrywają ogólne filtry kosmetyczne (np. EasyList).
const BAIT_CLASSES = 'ad ads adsbox ad-banner ad-placement doubleclick pub_300x250 text-ad textAd sponsor-box'

function storageGet(storage, key) {
    try { return storage.getItem(key) } catch { return null }
}

function storageSet(storage, key, value) {
    try { storage.setItem(key, value) } catch { /* Zapis jest niedostępny. Wybór działa do zamknięcia strony. */ }
}

export const isSlotHidden = (storage = globalThis.localStorage) => storageGet(storage, HIDDEN_KEY) === SLOT_VERSION

// Jedna treść na sesję: zapisany wybór albo losowa treść.
export function chooseSlot(slots = SLOTS, storage = globalThis.sessionStorage, random = Math.random) {
    const saved = slots.find(slot => slot.id === storageGet(storage, CHOSEN_KEY))
    if (saved) return saved
    const slot = slots[Math.floor(random() * slots.length)]
    storageSet(storage, CHOSEN_KEY, slot.id)
    return slot
}

// Wynik pomiaru dla Plausible.
// blokada: "tak", gdy filtr ukrył element-przynętę.
// miejsce: "widoczne", "ukryte przez blokadę" albo "ukryte przez użytkownika".
export function measurement({ baitHidden, slotRendered, slotHiddenByUser }) {
    let miejsce = 'widoczne'
    if (slotHiddenByUser) miejsce = 'ukryte przez użytkownika'
    else if (!slotRendered) miejsce = 'ukryte przez blokadę'
    return { blokada: baitHidden ? 'tak' : 'nie', miejsce }
}

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

// Pasek postępu zbiórki albo pusty tekst, gdy cel nie ma kwot.
export function goalHtml(goal) {
    if (!goal || !Number.isFinite(goal.collected) || !Number.isFinite(goal.target) || goal.target <= 0) return ''
    const share = Math.min(goal.collected / goal.target, 1)
    const percent = new Intl.NumberFormat('pl-PL', { style: 'percent', maximumFractionDigits: 0 }).format(share)
    const money = value => new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(value)
    return `<div class="panel-note-goal" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(share * 100)}" aria-label="Pokrycie kosztów w roku ${goal.year}">` +
        `<span style="width:${(share * 100).toFixed(1)}%"></span></div>` +
        `<p class="panel-note-goal-text">Koszty ${goal.year}: pokryte ${percent} (${money(goal.collected)} zł z ${money(goal.target)} zł)</p>`
}

export function profileHtml(author = AUTHOR) {
    return '<div class="note-profile">' +
        `<img class="avatar" alt="" src="${escapeHtml(author.photo)}" width="48" height="48" loading="lazy">` +
        `<div><p class="note-profile-name">${escapeHtml(author.name)}` +
        (author.callsign ? ` <span class="note-profile-callsign">${escapeHtml(author.callsign)}</span>` : '') + '</p>' +
        `<p class="note-profile-slogan">${escapeHtml(author.slogan)}</p>` +
        `<p class="note-profile-about">${escapeHtml(author.about)} ` +
        `<a href="${escapeHtml(author.portfolio.href)}" target="_blank" rel="noopener" data-note-link="portfolio">${escapeHtml(author.portfolio.text)}</a></p></div></div>`
}

// hideable: false usuwa przycisk "Ukryj" (np. w menu bocznym).
// profile: true dodaje mini profil autora.
export function slotHtml(slot, { hideable = true, profile = false } = {}) {
    const links = slot.links.map(link => {
        const external = link.href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''
        const icon = link.icon ? `<i class="material-icons" aria-hidden="true">${escapeHtml(link.icon)}</i>` : ''
        return `<a class="panel-note-link" href="${escapeHtml(link.href)}" data-note-link="${escapeHtml(link.id)}"${external}>${icon}${escapeHtml(link.text)}</a>`
    }).join('')
    const hide = hideable ? '<button type="button" class="icon-button panel-note-hide" data-note-hide aria-label="Ukryj" title="Ukryj"><i class="material-icons" aria-hidden="true">close</i></button>' : ''
    return `<div class="panel-note-header"><span class="panel-note-label">${escapeHtml(slot.label)}</span>${hide}</div>` +
        (profile ? profileHtml() : '') +
        `<p class="panel-note-title">${escapeHtml(slot.title)}</p>` +
        `<p class="panel-note-text">${escapeHtml(slot.text)}</p>` +
        goalHtml(slot.goal) +
        `<div class="panel-note-links">${links}</div>`
}

// Filtr kosmetyczny ukrywa element przez "display: none" albo usuwa go ze strony.
// Wymiary nie są dobrym wskaźnikiem: na telefonie mały panel daje miejscu zero wysokości.
const isRendered = element => Boolean(element && element.isConnected && window.getComputedStyle(element).display !== 'none')

// Element-przynęta: niewidoczny dla użytkownika, ale ma wymiary, gdy żaden filtr go nie ukrywa.
function checkBait() {
    return new Promise(resolve => {
        const bait = document.createElement('div')
        bait.className = BAIT_CLASSES
        bait.setAttribute('aria-hidden', 'true')
        bait.innerHTML = '&nbsp;'
        bait.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;'
        document.body.append(bait)
        // Filtry kosmetyczne działają z opóźnieniem. Sprawdzenie po 1 s jest pewniejsze.
        setTimeout(() => {
            const style = window.getComputedStyle(bait)
            const hidden = !bait.isConnected || bait.offsetHeight === 0 || style.display === 'none' || style.visibility === 'hidden'
            bait.remove()
            resolve(hidden)
        }, 1000)
    })
}

// Pomiar raz na sesję przeglądarki, aby nie wysyłać zdarzenia przy każdej zmianie widoku.
async function measure(element, slot) {
    if (storageGet(globalThis.sessionStorage, MEASURED_KEY)) return
    storageSet(globalThis.sessionStorage, MEASURED_KEY, '1')
    const baitHidden = await checkBait()
    const slotHiddenByUser = isSlotHidden()
    const result = measurement({ baitHidden, slotRendered: isRendered(element), slotHiddenByUser })
    track(GOALS.blocking, { ...result, tresc: slotHiddenByUser ? '' : slot.id })
}

export function initPartnerSlot() {
    const element = document.getElementById('panel-note')
    if (!element) return
    const slot = chooseSlot()
    element.innerHTML = slotHtml(slot)
    element.hidden = isSlotHidden()
    element.addEventListener('click', event => {
        if (event.target.closest('[data-note-hide]')) {
            event.preventDefault()
            storageSet(globalThis.localStorage, HIDDEN_KEY, SLOT_VERSION)
            element.hidden = true
            track(GOALS.slot, { tresc: slot.id, akcja: 'ukrycie', polozenie: 'panel' })
            return
        }
        const link = event.target.closest('[data-note-link]')
        if (link) track(GOALS.slot, { tresc: slot.id, akcja: link.dataset.noteLink, polozenie: 'panel' })
    })
    measure(element, slot)
    initMenuNote()
}

// Treść "wsparcie" bez przycisku "Ukryj": menu boczne i okno z paska górnego.
// polozenie: nazwa miejsca w zdarzeniach Plausible.
function initStaticNote(element, polozenie) {
    const slot = SLOTS.find(item => item.id === 'wsparcie')
    if (!element || !slot) return
    element.innerHTML = slotHtml(slot, { hideable: false, profile: true })
    element.hidden = false
    element.addEventListener('click', event => {
        const link = event.target.closest('[data-note-link]')
        if (link) track(GOALS.slot, { tresc: slot.id, akcja: link.dataset.noteLink, polozenie })
    })
}

function initMenuNote() {
    initStaticNote(document.getElementById('menu-note'), 'menu')
    initStaticNote(document.getElementById('dialog-note'), 'pasek')
}

// Przycisk "Wesprzyj" na pasku górnym otwiera okno z treścią "wsparcie".
export function openSupportDialog() {
    const dialog = document.getElementById('support-dialog')
    if (!dialog?.showModal) return
    track(GOALS.slot, { tresc: 'wsparcie', akcja: 'otwarcie', polozenie: 'pasek' })
    dialog.showModal()
}
