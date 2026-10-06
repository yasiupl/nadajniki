// Zdarzenia Plausible dla celów (konwersji). Listę celów i właściwości opisuje docs/architektura.md.
// Właściwości zdarzeń nie zawierają tekstu wpisanego przez użytkownika ani identyfikatorów stacji.
export const GOALS = {
    search: 'Wyszukiwanie',
    filter: 'Filtr',
    export: 'Eksport',
    favorite: 'Ulubione',
    point: 'Zasięg w punkcie',
    share: 'Udostępnienie',
    copyFrequencies: 'Kopiowanie częstotliwości',
    tab: 'Zakładka',
    layer: 'Warstwa mapy',
    theme: 'Motyw'
}

// Puste właściwości nie trafiają do Plausible. Wartości są tekstami.
export function track(goal, props = {}) {
    const plausible = globalThis.window?.plausible
    if (typeof plausible !== 'function') return
    const entries = Object.entries(props).filter(([, value]) => value !== undefined && value !== null && value !== '')
    if (entries.length) plausible(goal, { props: Object.fromEntries(entries.map(([key, value]) => [key, String(value)])) })
    else plausible(goal)
}
