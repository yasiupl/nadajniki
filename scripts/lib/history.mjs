// Historia zmian między kolejnymi wydaniami wykazu.
//
// Zdarzenia stacji:
//   [data, 'a']                                              nowa stacja
//   [data, 'r']                                              stacja usunięta
//   [data, 'c', aspekty, dodane, usunięte]                   zmiana (aspekty: patrz signature())
//   [data, 'm', poprzedni id, odległość w m, aspekty, dodane, usunięte]   przeniesienie
// "dodane" i "usunięte" to częstotliwości; występują tylko wtedy, gdy aspekty zawierają "f".
import { signature, allFrequencies } from './stations.mjs'

// Stacja przeniesiona: UKE poprawia współrzędne i stacja dostaje nowy identyfikator.
// Para (usunięta, nowa) to przeniesienie, jeśli ma tego samego operatora, leży w odległości
// do MOVE_DISTANCE metrów i ma wspólne pozwolenie albo te same częstotliwości.
export const MOVE_DISTANCE = 2000

export function difference(a, b) {
    const set = new Set(b)
    return a.filter(value => !set.has(value))
}

// Odległość w metrach (przybliżenie równoprostokątne, wystarczające dla odległości do kilku km).
export function distance(a, b) {
    const x = (b.lon - a.lon) * Math.cos((a.lat + b.lat) / 2 * Math.PI / 180)
    const y = b.lat - a.lat
    return Math.sqrt(x * x + y * y) * 111195
}

export function findMoves(removedIds, addedIds, before, after, beforeSnapshot, afterSnapshot) {
    const addedByOperator = new Map()
    for (const id of addedIds) {
        const station = after.get(id)
        if (station.lat === null) continue
        if (!addedByOperator.has(station.opKey)) addedByOperator.set(station.opKey, [])
        addedByOperator.get(station.opKey).push(id)
    }
    const candidates = []
    for (const oldId of removedIds) {
        const old = before.get(oldId)
        if (old.lat === null) continue
        const permits = new Set(old.records.map(record => record.permit))
        for (const newId of addedByOperator.get(old.opKey) || []) {
            const station = after.get(newId)
            const meters = distance(old, station)
            if (meters > MOVE_DISTANCE) continue
            const samePermit = station.records.some(record => permits.has(record.permit))
            const sameFrequencies = beforeSnapshot.get(oldId).f === afterSnapshot.get(newId).f
            if (samePermit || sameFrequencies) candidates.push({ oldId, newId, meters })
        }
    }
    // Najpierw najbliższe pary. Każda stacja należy najwyżej do jednej pary.
    candidates.sort((a, b) => a.meters - b.meters)
    const moves = []
    const used = new Set()
    for (const candidate of candidates) {
        if (used.has(candidate.oldId) || used.has(candidate.newId)) continue
        used.add(candidate.oldId).add(candidate.newId)
        moves.push(candidate)
    }
    return moves
}

// Aspekty zmiany i zmiana listy częstotliwości.
function describeChange(oldStation, newStation, oldSig, newSig) {
    const aspects = Object.keys(newSig).filter(key => newSig[key] !== oldSig[key]).join('')
    if (!aspects.includes('f')) return [aspects]
    const before = allFrequencies(oldStation)
    const after = allFrequencies(newStation)
    return [aspects, difference(after, before), difference(before, after)]
}

// Wydania trzeba dodawać od najstarszego. W pamięci są tylko dwa sąsiednie wydania.
export class History {
    constructor() {
        this.events = new Map()
        // since: data wydania, w którym stacja się pojawiła; null: stacja jest w najstarszym wydaniu.
        this.since = new Map()
        this.lastChange = new Map()
        // removed: stacje usunięte w okresie historii (rekord z ostatniego wydania, w którym były).
        this.removed = new Map()
        // aliases: poprzedni identyfikator przeniesionej stacji -> bieżący identyfikator.
        this.aliases = new Map()
        this.releases = []
        this.previous = null
    }

    addEvent(id, event) {
        if (!this.events.has(id)) this.events.set(id, [])
        this.events.get(id).push(event)
    }

    // stations: Map(id -> stacja) z groupStations(). Zwraca podsumowanie wydania.
    add(date, stations) {
        const snapshot = new Map()
        for (const [id, station] of stations) snapshot.set(id, signature(station))
        const entry = { date, stations: stations.size }
        const previous = this.previous

        if (!previous) {
            for (const id of stations.keys()) this.since.set(id, null)
        } else {
            const addedIds = [...snapshot.keys()].filter(id => !previous.snapshot.has(id))
            const removedIds = [...previous.snapshot.keys()].filter(id => !snapshot.has(id))
            const moves = findMoves(removedIds, addedIds, previous.stations, stations, previous.snapshot, snapshot)
            const movedTo = new Map(moves.map(move => [move.newId, move]))
            const movedFrom = new Set(moves.map(move => move.oldId))

            let changed = 0
            for (const [id, sig] of snapshot) {
                const old = previous.snapshot.get(id)
                if (!old) continue
                const change = describeChange(previous.stations.get(id), stations.get(id), old, sig)
                if (!change[0]) continue
                changed++
                this.lastChange.set(id, date)
                this.addEvent(id, [date, 'c', ...change])
            }

            for (const id of addedIds) {
                this.removed.delete(id)
                const move = movedTo.get(id)
                if (!move) {
                    this.since.set(id, date)
                    this.addEvent(id, [date, 'a'])
                    continue
                }
                // Przeniesiona stacja przejmuje historię i datę pojawienia się poprzedniego identyfikatora.
                this.since.set(id, this.since.get(move.oldId) ?? null)
                this.lastChange.set(id, date)
                const change = describeChange(previous.stations.get(move.oldId), stations.get(id),
                    previous.snapshot.get(move.oldId), snapshot.get(id))
                this.events.set(id, [...(this.events.get(move.oldId) || []), [date, 'm', move.oldId, Math.round(move.meters), ...change]])
                this.events.delete(move.oldId)
                for (const [alias, target] of this.aliases) if (target === move.oldId) this.aliases.set(alias, id)
                this.aliases.set(move.oldId, id)
            }

            for (const id of removedIds) {
                this.since.delete(id)
                this.lastChange.delete(id)
                if (movedFrom.has(id)) continue
                this.removed.set(id, { station: previous.stations.get(id), date })
                this.addEvent(id, [date, 'r'])
            }

            Object.assign(entry, {
                added: addedIds.length - moves.length,
                removed: removedIds.length - moves.length,
                changed,
                moved: moves.length
            })
        }
        this.releases.push(entry)
        this.previous = { snapshot, stations }
        // Przekierowanie nie jest potrzebne, jeśli identyfikator znowu istnieje.
        for (const alias of this.aliases.keys()) if (stations.has(alias)) this.aliases.delete(alias)
        return entry
    }
}
