// Stan aplikacji i prosta magistrala zdarzeń.
import { emptyFilters } from './filters.js'

export const state = {
    filters: emptyFilters(),
    // Stacje spełniające filtry (bieżące albo usunięte, zależnie od filtra stanu).
    filtered: [],
    facets: {},
    // Zakładka panelu: list, bands, analysis, changes.
    view: 'list',
    // Widok nakładany na zakładkę: { type: 'detail' | 'pick' | 'probe', ... } albo null.
    overlay: null,
    // Zakres analiz i pasm: 'all' (cała Polska) albo 'view' (widok mapy).
    scope: 'all',
    layers: { coverage: false, heat: false, labels: true },
    theme: 'light',
    mapReady: false
}

const listeners = new Map()

export function on(type, listener) {
    if (!listeners.has(type)) listeners.set(type, [])
    listeners.get(type).push(listener)
}

export function emit(type, detail) {
    for (const listener of listeners.get(type) || []) listener(detail)
}
