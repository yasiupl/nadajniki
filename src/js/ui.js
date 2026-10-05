// Drobne narzędzia DOM: komunikaty, schowek, pobieranie plików.

export const $ = (selector, root = document) => root.querySelector(selector)

let toastTimer = null
export function toast(message, { timeout = 3500 } = {}) {
    const element = $('#toast')
    element.textContent = message
    element.hidden = false
    element.classList.add('visible')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
        element.classList.remove('visible')
        toastTimer = setTimeout(() => { element.hidden = true }, 250)
    }, timeout)
}

export async function copyText(text, message = 'Skopiowano do schowka') {
    try {
        await navigator.clipboard.writeText(text)
        toast(message)
    } catch {
        const area = document.createElement('textarea')
        area.value = text
        area.setAttribute('readonly', '')
        area.style.position = 'fixed'
        area.style.opacity = '0'
        document.body.append(area)
        area.select()
        const copied = document.execCommand('copy')
        area.remove()
        toast(copied ? message : 'Nie można skopiować. Zaznacz tekst ręcznie.')
    }
}

export function downloadFile(filename, content, type = 'text/plain;charset=utf-8') {
    const url = URL.createObjectURL(new Blob([content], { type }))
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const isMobile = () => window.matchMedia('(max-width: 760px)').matches

// Wywołuje fn najwyżej raz na wait ms, z ostatnimi argumentami.
export function debounce(fn, wait) {
    let timer = null
    return (...args) => {
        clearTimeout(timer)
        timer = setTimeout(() => fn(...args), wait)
    }
}
