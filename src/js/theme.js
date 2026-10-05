// Motyw strony: automatyczny (ustawienie systemu lub przeglądarki), jasny albo ciemny.
// Wybór zapisuje localStorage. Atrybut data-theme na <html> wybiera tokeny kolorów w style.scss.
// Skrypt w <head> (src/index.html) ustawia ten atrybut przed pierwszym rysowaniem strony.
const STORAGE_KEY = 'theme'
const systemDark = window.matchMedia('(prefers-color-scheme: dark)')

export const THEME_PREFERENCES = ['auto', 'light', 'dark']

function storedPreference() {
    try {
        const value = window.localStorage.getItem(STORAGE_KEY)
        return THEME_PREFERENCES.includes(value) ? value : 'auto'
    } catch {
        return 'auto'
    }
}

// Bez localStorage wybór obowiązuje do zamknięcia strony.
let preference = storedPreference()

export const themePreference = () => preference

// Motyw, który strona pokazuje: "light" albo "dark".
export function effectiveTheme() {
    if (preference !== 'auto') return preference
    return systemDark.matches ? 'dark' : 'light'
}

export function saveThemePreference(value) {
    preference = THEME_PREFERENCES.includes(value) ? value : 'auto'
    const root = document.documentElement
    if (preference === 'auto') delete root.dataset.theme
    else root.dataset.theme = preference
    try {
        if (preference === 'auto') window.localStorage.removeItem(STORAGE_KEY)
        else window.localStorage.setItem(STORAGE_KEY, preference)
    } catch {
        // Zapis jest niedostępny (np. tryb prywatny z blokadą). Wybór działa do zamknięcia strony.
    }
}

// Zmiana ustawienia systemu ma znaczenie tylko w trybie automatycznym.
export function onSystemThemeChange(listener) {
    systemDark.addEventListener('change', () => {
        if (preference === 'auto') listener()
    })
}
