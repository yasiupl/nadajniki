// Dzień przebudowy: 26. dzień miesiąca albo kolejny dzień roboczy w Polsce.
// Cron uruchamia funkcję codziennie od 26. do 29. dnia miesiąca. Zakres 26-29
// pokrywa najgorszy przypadek: 26 grudnia w piątek daje poniedziałek 29 grudnia.
export const DEPLOY_DAY = 26
export const TIME_ZONE = 'Europe/Warsaw'

// Data kalendarzowa (rok, miesiąc 1-12, dzień) w strefie czasowej Polski.
function localDate(date) {
    const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
        timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(date).split('-').map(Number)
    return { year, month, day }
}

// Niedziela Wielkanocna (anonimowy algorytm gregoriański).
function easterSunday(year) {
    const a = year % 19
    const b = Math.floor(year / 100)
    const c = year % 100
    const d = Math.floor(b / 4)
    const e = b % 4
    const f = Math.floor((b + 8) / 25)
    const g = Math.floor((b - f + 1) / 3)
    const h = (19 * a + b - d - g + 15) % 30
    const i = Math.floor(c / 4)
    const k = c % 4
    const l = (32 + 2 * e + 2 * i - h - k) % 7
    const m = Math.floor((a + 11 * h + 22 * l) / 451)
    const month = Math.floor((h + l - 7 * m + 114) / 31)
    const day = ((h + l - 7 * m + 114) % 31) + 1
    return Date.UTC(year, month - 1, day)
}

const DAY_MS = 86400 * 1000

// Ustawowe dni wolne od pracy w Polsce, które nie zawsze wypadają w niedzielę.
function isPolishHoliday(utc) {
    const date = new Date(utc)
    const year = date.getUTCFullYear()
    const md = `${date.getUTCMonth() + 1}-${date.getUTCDate()}`
    const fixed = ['1-1', '1-6', '5-1', '5-3', '8-15', '11-1', '11-11', '12-25', '12-26']
    if (year >= 2025) fixed.push('12-24')
    if (fixed.includes(md)) return true

    const easter = easterSunday(year)
    return utc === easter + DAY_MS || utc === easter + 60 * DAY_MS // Poniedziałek Wielkanocny, Boże Ciało
}

function isWorkingDay(utc) {
    const weekday = new Date(utc).getUTCDay()
    return weekday !== 0 && weekday !== 6 && !isPolishHoliday(utc)
}

export function isDeployDay(date = new Date()) {
    const { year, month, day } = localDate(date)
    let target = Date.UTC(year, month - 1, DEPLOY_DAY)
    while (!isWorkingDay(target)) target += DAY_MS
    return Date.UTC(year, month - 1, day) === target
}
