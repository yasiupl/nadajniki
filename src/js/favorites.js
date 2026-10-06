// Ulubione stacje: identyfikatory zapisane w localStorage tej przeglądarki.
// Bez localStorage lista działa do zamknięcia strony.
const STORAGE_KEY = 'favorites'
const listeners = []

function load() {
    try {
        const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
        return new Set(Array.isArray(value) ? value.filter(id => typeof id === 'string') : [])
    } catch {
        return new Set()
    }
}

const favorites = load()

function save() {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites]))
    } catch {
        // Zapis jest niedostępny. Lista działa do zamknięcia strony.
    }
    for (const listener of listeners) listener()
}

export const favoriteIds = () => favorites
export const isFavorite = id => favorites.has(id)

// Zwraca true, jeśli stacja jest teraz w ulubionych.
export function toggleFavorite(id) {
    if (favorites.has(id)) favorites.delete(id)
    else favorites.add(id)
    save()
    return favorites.has(id)
}

export function onFavoritesChange(listener) {
    listeners.push(listener)
}
