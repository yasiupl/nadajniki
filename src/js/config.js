// Stałe aplikacji: słowniki UKE, pasma, kolory.

export const MAPBOX_TOKEN = 'pk.eyJ1IjoieWFzaXUiLCJhIjoiY2o4dWF2dmZnMHEwODMzcnB6NmZ5cGpicCJ9.XzC5pC59qPSmqbLv2xBDQw'
export const MAP_STYLES = {
    light: 'mapbox://styles/mapbox/light-v11',
    dark: 'mapbox://styles/mapbox/dark-v11'
}
export const MAP_CENTER = [19.134422, 51.919231]
export const MAP_ZOOM = 5.6
export const SITE_TITLE = 'Mapa nadajników radiowych'

// Rodzaje sieci (legenda UKE). Kolejność to kolejność kolorów palety kategorycznej:
// najliczniejsze rodzaje dostają kolory, które są najlepiej rozróżnialne.
// Kolory: zwalidowana paleta kategoryczna (jasny i ciemny motyw).
export const NETWORK_TYPES = [
    { code: 'A', name: 'Dyspozytorska', description: 'Łączność dyspozytora z ekipami w terenie.', light: '#2a78d6', dark: '#3987e5' },
    { code: 'C', name: 'Transmisja danych', description: 'Na przykład odczyt liczników i telemetria.', light: '#eb6834', dark: '#d95926' },
    { code: 'F', name: 'Powiadamianie o alarmach', description: 'Systemy alarmowe ochrony mienia.', light: '#1baf7a', dark: '#199e70' },
    { code: 'E', name: 'Zdalne sterowanie', description: 'Zdalne sterowanie urządzeniami.', light: '#eda100', dark: '#c98500' },
    { code: 'L', name: 'Samorządowa', description: 'Rodzaj sieci, którego nie opisuje legenda UKE.', light: '#e87ba4', dark: '#d55181' },
    { code: 'T', name: 'Trankingowa', description: 'Wiele grup użytkowników dzieli wspólną pulę kanałów.', light: '#008300', dark: '#008300' },
    { code: 'B', name: 'Przywoławcza', description: 'Stacje radiowe przywoławcze.', light: '#4a3aa7', dark: '#9085e9' },
    { code: 'D', name: 'Retransmisyjna', description: 'Retransmisja sygnałów, przemienniki.', light: '#e34948', dark: '#e66767' },
    { code: 'P', name: 'Poszukiwanie osób', description: 'Bezprzewodowe poszukiwanie osób, na przykład w szpitalach.', light: '#898781', dark: '#898781' },
    { code: 'Q', name: 'Mikrofony bezprzewodowe', description: 'Technika estradowa.', light: '#898781', dark: '#898781' },
    { code: 'R', name: 'Reportażowa', description: 'Stacje reporterów rozgłośni radiowych.', light: '#898781', dark: '#898781' }
]
export const OTHER_TYPE = { code: '?', name: 'Inny', description: 'Kod rodzaju sieci spoza legendy UKE.', light: '#898781', dark: '#898781' }
export const TYPE_ORDER = NETWORK_TYPES.map(type => type.code)
export const typeInfo = code => NETWORK_TYPES.find(type => type.code === code) || { ...OTHER_TYPE, code, name: `${OTHER_TYPE.name} (${code})` }

// Rodzaje stacji (Regulamin radiokomunikacyjny, legenda UKE).
export const STATION_TYPES = {
    FB: 'Stacja stała (bazowa)',
    FS: 'Stacja lądowa do ratowania życia',
    ML: 'Stacja ruchoma',
    MO: 'Stacja ruchoma'
}
export const stationTypeName = code => STATION_TYPES[code] || `Stacja rodzaju ${code}`

// Pasma. Zakres obejmuje wszystkie częstotliwości z wykazu RRL.
// bin: szerokość przedziału histogramu [MHz], tick: odstęp opisów osi [MHz].
export const BANDS = [
    { key: 'vhf-low', name: 'VHF 30–60 MHz', short: '30–60', min: 25, max: 60, bin: 1, tick: 5 },
    { key: 'vhf-mid', name: 'VHF 60–100 MHz', short: '60–100', min: 60, max: 100, bin: 1, tick: 10 },
    { key: 'vhf', name: 'VHF 136–174 MHz', short: '136–174', min: 136, max: 174, bin: 0.5, tick: 5 },
    { key: 'uhf', name: 'UHF 380–470 MHz', short: '380–470', min: 380, max: 470, bin: 1, tick: 10 },
    { key: 'other', name: 'Inne częstotliwości', short: 'inne', min: null, max: null }
]
export function bandOf(frequency) {
    return BANDS.find(band => band.min !== null && frequency >= band.min && frequency < band.max) || BANDS[BANDS.length - 1]
}
export const bandBit = key => 1 << BANDS.findIndex(band => band.key === key)

// Szerokości kanałów [kHz].
export const BANDWIDTHS = [
    { key: '6.25', name: '6,25 kHz' },
    { key: '12.5', name: '12,5 kHz' },
    { key: '20', name: '20 kHz' },
    { key: '25', name: '25 kHz' },
    { key: 'other', name: 'Inne' }
]
export const bandwidthKey = width => BANDWIDTHS.find(item => item.key === String(width))?.key || 'other'

// Jednostki UKE, które wydają pozwolenia (kody z nazw plików wykazu).
export const OFFICES = {
    DC: 'Departament Częstotliwości UKE',
    OBI: 'Delegatura UKE w Białymstoku',
    OBY: 'Delegatura UKE w Bydgoszczy',
    OGD: 'Delegatura UKE w Gdyni',
    OKI: 'Delegatura UKE w Kielcach',
    OKR: 'Delegatura UKE w Krakowie',
    OLD: 'Delegatura UKE w Łodzi',
    OLU: 'Delegatura UKE w Lublinie',
    OOL: 'Delegatura UKE w Olsztynie',
    OOP: 'Delegatura UKE w Opolu',
    OPO: 'Delegatura UKE w Poznaniu',
    ORZ: 'Delegatura UKE w Rzeszowie',
    OSS: 'Delegatura UKE w Siemianowicach Śląskich',
    OSZ: 'Delegatura UKE w Szczecinie',
    OWA: 'Delegatura UKE w Warszawie',
    OWR: 'Delegatura UKE we Wrocławiu',
    OZG: 'Delegatura UKE w Zielonej Górze'
}

// Aspekty zmiany stacji między wydaniami (patrz scripts/lib/stations.mjs, signature()).
export const CHANGE_ASPECTS = {
    f: 'częstotliwości',
    p: 'pozwolenie',
    t: 'parametry techniczne',
    u: 'urządzenia'
}

export const STATUSES = [
    { key: 'new', param: 'nowe', name: 'Nowe' },
    { key: 'changed', param: 'zmienione', name: 'Zmienione' },
    { key: 'removed', param: 'usuniete', name: 'Usunięte' }
]

export const LEGEND_URL = 'https://bip.uke.gov.pl/download/gfx/bip/pl/defaultaktualnosci/140/9/96/_legenda_do_wykazu_rrl.pdf'
export const SOURCE_URL = 'https://bip.uke.gov.pl/pozwolenia-radiowe/wykaz-pozwolen-radiowych-tresci/klasyczne-sieci-rrl,9.html'
export const ARCHIVE_URL = 'https://dane.gov.pl/dataset/1070'
