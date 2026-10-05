// Minimalny czytnik plików XLSX. Zwraca wiersze arkuszy jako tablice tekstów.
// Obsługuje tylko to, czego potrzebują wykazy UKE: wspólne teksty, teksty
// w komórkach i liczby. Jest kilkanaście razy szybszy niż parser oparty na xml2js.
import { unzipSync, strFromU8 } from 'fflate'

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function decode(text) {
    if (!text.includes('&')) return text
    return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, entity) => {
        if (entity[0] !== '#') return ENTITIES[entity] ?? match
        const code = entity[1] === 'x' || entity[1] === 'X' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10)
        return String.fromCodePoint(code)
    })
}

// Tekst z elementów <t> (pomija transkrypcję fonetyczną <rPh>).
function textOf(xml) {
    let text = ''
    for (const match of xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) text += match[1]
    return decode(text)
}

// "AB12" -> 27
function columnIndex(ref) {
    let index = 0
    for (let i = 0; i < ref.length; i++) {
        const code = ref.charCodeAt(i)
        if (code < 65 || code > 90) break
        index = index * 26 + code - 64
    }
    return index - 1
}

function readSharedStrings(xml) {
    const strings = []
    if (!xml) return strings
    for (const match of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g)) strings.push(match[1] ? textOf(match[1]) : '')
    return strings
}

function readSheet(xml, shared) {
    const rows = []
    for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
        const row = []
        let next = 0
        for (const cell of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
            const attributes = cell[1]
            const body = cell[2] || ''
            const ref = /\br="([A-Z]+)\d*"/.exec(attributes)
            const index = ref ? columnIndex(ref[1]) : next
            const type = /\bt="(\w+)"/.exec(attributes)?.[1]
            const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1]
            let value = ''
            if (type === 's') value = shared[parseInt(raw, 10)] ?? ''
            else if (type === 'inlineStr') value = textOf(body)
            else if (raw !== undefined) value = decode(raw)
            while (row.length < index) row.push('')
            row[index] = value
            next = index + 1
        }
        rows.push(row)
    }
    return rows
}

// Zwraca [{ name, rows: [[...], ...] }] w kolejności arkuszy w skoroszycie.
export function readXlsx(buffer) {
    const files = unzipSync(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer), {
        filter: file => file.name.startsWith('xl/')
    })
    const read = name => files[name] ? strFromU8(files[name]) : ''
    const shared = readSharedStrings(read('xl/sharedStrings.xml'))

    const targets = {}
    for (const match of read('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g)) {
        const id = /\bId="([^"]+)"/.exec(match[0])?.[1]
        const target = /\bTarget="([^"]+)"/.exec(match[0])?.[1]
        if (id && target) targets[id] = target.replace(/^\/?(xl\/)?/, 'xl/')
    }

    const sheets = []
    for (const match of read('xl/workbook.xml').matchAll(/<sheet\b[^>]*>/g)) {
        const name = decode(/\bname="([^"]*)"/.exec(match[0])?.[1] || '')
        const id = /\br:id="([^"]+)"/.exec(match[0])?.[1]
        const xml = read(targets[id])
        if (xml) sheets.push({ name, rows: readSheet(xml, shared) })
    }
    return sheets
}
