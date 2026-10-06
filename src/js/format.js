// Formatowanie wartości i bezpieczne składanie HTML. Moduł nie używa DOM.

export class Raw {
    constructor(value) {
        this.value = value
    }
    toString() {
        return this.value
    }
}
export const raw = value => new Raw(value)

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export const escapeHtml = text => String(text).replace(/[&<>"']/g, char => ESCAPES[char])

function render(value) {
    if (value === null || value === undefined || value === false) return ''
    if (value instanceof Raw) return value.value
    if (Array.isArray(value)) return value.map(render).join('')
    return escapeHtml(value)
}

// Szablon HTML: wstawiane wartości są escapowane, chyba że są opakowane w raw() albo html``.
export function html(strings, ...values) {
    let out = strings[0]
    for (let i = 0; i < values.length; i++) out += render(values[i]) + strings[i + 1]
    return new Raw(out)
}

// Tekst do wyszukiwania: małe litery, bez znaków diakrytycznych.
export function normalize(text) {
    return String(text ?? '').toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// Tekst bez znaków diakrytycznych, z zachowaniem wielkości liter: "Łódź Żółć" -> "Lodz Zolc".
export function toAscii(text) {
    return String(text ?? '').replace(/ł/g, 'l').replace(/Ł/g, 'L').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// Fragment adresu URL: "PKP Polskie Linie Kolejowe, Kraków 1" -> "pkp-polskie-linie-kolejowe-krakow-1".
export function slugify(text, maxLength = 60) {
    const slug = normalize(text).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    if (slug.length <= maxLength) return slug
    return slug.slice(0, maxLength).replace(/-[^-]*$/, '') || slug.slice(0, maxLength)
}

const numberFormats = new Map()
export function formatNumber(value, maximumFractionDigits = 0, minimumFractionDigits = 0) {
    if (value === null || value === undefined || Number.isNaN(value)) return '–'
    const key = `${maximumFractionDigits}/${minimumFractionDigits}`
    if (!numberFormats.has(key)) {
        numberFormats.set(key, new Intl.NumberFormat('pl-PL', { maximumFractionDigits, minimumFractionDigits }))
    }
    return numberFormats.get(key).format(value)
}

// Częstotliwość w MHz: co najmniej 4 miejsca po przecinku (raster 12,5 kHz), do 5 dla 6,25 kHz.
export function formatFrequency(value) {
    if (value === null || value === undefined) return '–'
    const fixed = value.toFixed(5)
    return fixed.endsWith('0') ? fixed.slice(0, -1) : fixed
}

// Klucz wyszukiwania częstotliwości: zawsze 5 miejsc po kropce ("150.20000").
export const frequencyKey = value => value.toFixed(5)

// ERP w dBW -> W.
export function erpToWatts(dbw) {
    return dbw === null || dbw === undefined ? null : Math.pow(10, dbw / 10)
}

export function formatErp(dbw) {
    if (dbw === null || dbw === undefined) return '–'
    const watts = erpToWatts(dbw)
    const digits = watts < 1 ? 2 : watts < 10 ? 1 : 0
    return `${formatNumber(dbw, 1)} dBW (${formatNumber(watts, digits)} W)`
}

export function formatDate(iso) {
    if (!iso) return '–'
    const [year, month, day] = iso.split('-')
    return `${day}.${month}.${year}`
}

const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień',
    'październik', 'listopad', 'grudzień']
export function formatMonth(iso) {
    if (!iso) return '–'
    const [year, month] = iso.split('-')
    return `${MONTHS[parseInt(month, 10) - 1]} ${year}`
}

// Odmiana: plural(5, 'stacja', 'stacje', 'stacji') -> "stacji".
export function plural(count, one, few, many) {
    if (count === 1) return one
    const last = count % 10
    const lastTwo = count % 100
    return last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? few : many
}
export const countLabel = (count, one, few, many) => `${formatNumber(count)} ${plural(count, one, few, many)}`
export const stationsLabel = count => countLabel(count, 'stacja', 'stacje', 'stacji')
export const matchingLabel = count => `${stationsLabel(count)} ${plural(count, 'spełnia', 'spełniają', 'spełnia')} filtry`

export function formatDistance(meters) {
    if (meters === null || meters === undefined) return '–'
    return meters < 1000 ? `${formatNumber(Math.round(meters / 10) * 10)} m` : `${formatNumber(meters / 1000, meters < 10000 ? 1 : 0)} km`
}

// Liczba miesięcy między datami (dodatnia dla dat w przyszłości).
export function monthsUntil(iso, now = new Date()) {
    if (!iso) return null
    const date = new Date(`${iso}T00:00:00`)
    return (date.getFullYear() - now.getFullYear()) * 12 + date.getMonth() - now.getMonth() + (date.getDate() - now.getDate()) / 31
}

export function formatRelativeMonths(iso, now = new Date()) {
    const months = monthsUntil(iso, now)
    if (months === null) return ''
    if (months < 0) return 'wygasło'
    if (months < 1) return 'wygasa w tym miesiącu'
    if (months < 24) {
        const whole = Math.round(months)
        return `za ${countLabel(whole, 'miesiąc', 'miesiące', 'miesięcy')}`
    }
    const years = Math.round(months / 12)
    return `za ${countLabel(years, 'rok', 'lata', 'lat')}`
}

// 51.039167 -> 51°02'21"N
export function formatDms(value, positive, negative) {
    if (value === null || value === undefined) return '–'
    const absolute = Math.abs(value)
    let degrees = Math.floor(absolute)
    let minutes = Math.floor((absolute - degrees) * 60)
    let seconds = Math.round(((absolute - degrees) * 60 - minutes) * 60)
    if (seconds === 60) { seconds = 0; minutes++ }
    if (minutes === 60) { minutes = 0; degrees++ }
    const pad = number => String(number).padStart(2, '0')
    return `${degrees}°${pad(minutes)}'${pad(seconds)}"${value < 0 ? negative : positive}`
}

// Odległość w metrach (wzór haversine).
export function distanceMeters(lat1, lon1, lat2, lon2) {
    const rad = Math.PI / 180
    const dLat = (lat2 - lat1) * rad
    const dLon = (lon2 - lon1) * rad
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2
    return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(a)))
}
