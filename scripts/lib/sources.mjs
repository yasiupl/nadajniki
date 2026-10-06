// Bieżący wykaz pozwoleń RRL na stronie BIP UKE.
export const BIP_URL = 'https://bip.uke.gov.pl'
export const BIP_LIST_URL = `${BIP_URL}/pozwolenia-radiowe/wykaz-pozwolen-radiowych-tresci/klasyczne-sieci-rrl,9.html`

// Data wydania z nazwy pliku: "dc_-_stan_na_2026-09-25.xlsx" -> "2026-09-25".
export const releaseDate = name => /(\d{4}-\d{2}-\d{2})/.exec(name)?.[1]

// Odnośniki do plików XLSX na stronie wykazu.
export function bipLinks(html) {
    return [...new Set([...html.matchAll(/href="([^"]*\/download\/[^"]*\.xlsx)"/gi)].map(match => match[1]))]
}

export async function fetchBipLinks() {
    const response = await fetch(BIP_LIST_URL, { signal: AbortSignal.timeout(30000) })
    if (!response.ok) throw new Error(`Nie można pobrać listy plików: HTTP ${response.status}`)
    const links = bipLinks(await response.text())
    if (links.length === 0) throw new Error('Nie znaleziono plików .xlsx na stronie UKE')
    return links
}

// Data najnowszego wydania w BIP UKE (bez pobierania plików).
export async function latestBipRelease() {
    const date = (await fetchBipLinks()).map(releaseDate).filter(Boolean).sort().pop()
    if (!date) throw new Error('Nie można odczytać daty wydania z nazw plików UKE')
    return date
}
