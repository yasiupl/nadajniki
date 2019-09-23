import 'materialize-css/dist/js/materialize.min.js'
import mapboxgl from 'mapbox-gl'
import sources from './sources.json'
import './style.scss'

mapboxgl.accessToken = 'pk.eyJ1IjoieWFzaXUiLCJhIjoiY2o4dWF2dmZnMHEwODMzcnB6NmZ5cGpicCJ9.XzC5pC59qPSmqbLv2xBDQw';

const headers = {
    permitID: 'Nr pozwolenia',
    permitExpiry: 'Data wygaśnięcia',
    name: 'Nazwa stacji',
    stationType: 'Rodzaj stacji',
    networkType: 'Rodzaj sieci',
    lon: 'Długość geograficzna',
    lat: 'Szerokość geograficzna',
    radius: 'Promień obszaru obsługi',
    location: 'Lokalizacja stacji',
    erp: 'Maksymalna zastępcza moc promieniowania [dBW]',
    azimuth: 'Azymut',
    elevation: 'Elewacja',
    polarization: 'Polaryzacja',
    gain: 'Zysk anteny',
    antennaHeight: 'Wysokość umieszczenia anteny',
    groundHeight: 'Wysokość anteny',
    verticalCharacteristic: 'Kod charakterystyki promieniowania - pion',
    horizontalCharacteristic: 'Kod charakterystyki promieniowania - poziom',
    tx: 'Częstotliwości nadawcze [MHz]',
    rx: 'Częstotliwości odbiorcze [MHz]',
    txSpan: 'Szerokości kanałów nadawczych [kHz]',
    rxSpan: 'Szerokości kanałów odbiorczych [kHz]',
    op: 'Operator',
    opAdress: 'Adres operatora'
}

const types = {
    A: "Dyspozytorska",
    B: "Przywoławcza",
    C: "Transmisja danych",
    D: "Retransmisja",
    E: "Zdalne sterowanie",
    F: "Powiadamiania o alarmach",
    P: "Bezprzewodowe poszukiwanie osób",
    Q: "Mikrofony bezprzewodowe",
    R: "Reportażowa",
    T: "Trunkingowa"
}


/* 
const headers = [
    'Nr pozwolenia',
    'Data wygaśnięcia',
    'Nazwa stacji',
    'Rodzaj stacji',
    'Rodzaj sieci',
    'Długość geograficzna',
    'Szerokość geograficzna',
    'Promień obszaru obsługi',
    'Lokalizacja stacji',
    'Maksymalna zastępcza moc promieniowania [dBW]',
    'Azymut',
    'Elewacja',
    'Polaryzacja',
    'Zysk anteny',
    'Wysokość umieszczenia anteny',
    'Wysokość terenu',
    'Kod charakterystyki promieniowania - poziom',
    'Kod charakterystyki promieniowania - pion',
    'Częstotliwości nadawcze [MHz]',
    'Częstotliwości odbiorcze [MHz]',
    'Szerokości kanałów nadawczych [kHz]',
    'Szerokości kanałów odbiorczych [kHz]',
    'Operator',
    'Adres operatora'
]
*/

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v10',
    hash: true,
    center: [19.134422, 51.919231],
    zoom: 6
});

// Add geolocate control to the map.
map.addControl(new mapboxgl.GeolocateControl({
    positionOptions: {
        enableHighAccuracy: true
    },
    trackUserLocation: true
}));

map.addControl(new mapboxgl.NavigationControl());


map.on('load', function () {
    let layers = document.getElementById('layers');

    let toggleAll = document.createElement('li');
    toggleAll.data = 'all';
    toggleAll.innerHTML = '<a>Przełącz Wszystkie</a>';
    toggleAll.onclick = toggleAllLayers;
    layers.appendChild(toggleAll);

    for (let i in sources) {
        // Add a layer showing the places.
        addLayerFromHash(map, sources[i].hash);

        let link = document.createElement('li');
        link.data = sources[i].hash;
        link.innerHTML = '<a class="truncate"><label><input type="checkbox" id="' + sources[i].hash + '" checked="checked"/><span></span></label><span class="badge">' + sources[i].length + '</span>' + sources[i].name + '</a>';
        link.onclick = toggleLayerButton;
        layers.appendChild(link);
    }
});

map.on('idle', detailsLoadInView);

map.on('moveend', detailsLoadInView);

document.addEventListener('DOMContentLoaded', function () {
    const details = document.querySelector('#details');

    M.Sidenav.init(document.querySelector('#layers'), { edge: 'right' });
    M.Sidenav.init(document.querySelector('#menu'));
});

function addLayerFromHash(map, hash) {

    //if (typeof map.getLayer(hash) !== 'undefined') {
    map.addLayer({
        id: hash,
        type: "circle",
        source: {
            type: "geojson",
            data: './data/' + hash + '.geojson'
        },
        paint: {
            "circle-color": [
                'match',
                ['get', 'networkType'],
                "A", "#03a8a0",
                "B", "#039c4b",
                "C", "#66d313",
                "D", "#fedf17",
                "E", "#ff0984",
                "F", "#21409a",
                "P", "#04adff",
                "Q", "#e48873",
                "R", "#f16623",
                "T", "#f44546",
                '#11b4da'
            ],
            "circle-radius": [
                'interpolate', ['linear'], ['zoom'],
                7, ['+', ['/', ['number', ['get', 'mapRadius'], 1], 100], 2],
                12, ['+', ['/', ['number', ['get', 'mapRadius'], 1], 1000], 10]
            ],
            "circle-stroke-width": 1,
            "circle-opacity": 0.8,
            /*[
                "+",
                ["/", ['log10',
                ['number', ['get', 'mapERP'], 1]],5],
                0.5
            ],*/
            "circle-stroke-color": "#FFF"
        }
    });


    // When a click event occurs on a feature in the places layer, open a popup at the
    // location of the feature, with description HTML from its properties.
    map.on('click', hash, (e) => { loadDetails(e.features[0].properties.id); });

    // Change the cursor to a pointer when the mouse is over the places layer.
    map.on('mouseenter', hash, function () {
        map.getCanvas().style.cursor = 'pointer';
    });

    // Change it back to a pointer when it leaves.
    map.on('mouseleave', hash, function () {
        map.getCanvas().style.cursor = '';
    });
    //}
}

async function loadProperties(id) {
    const response = await fetch('./data/points/' + id + '.json');
    const data = await response.json();
    return data;
}

window.loadDetails = async function(id, mapInstance=map) {
    let description = ''
    const properties = await loadProperties(id);
    const coordinates = [properties.mapLon, properties.mapLat];

    for (let i in headers) {
        if (i == 'networkType') {
            description += '<b>' + headers[i] + ':</b> ' + properties[i] + ': ' + types[properties[i][0]] + '</br>';
            continue
        }
        description += '<b>' + headers[i] + ':</b> ' + properties[i].join(', ')+ '</br>';
    }

    details.data = 'details'
    details.innerHTML = '<i id="detailsClose" class="material-icons right">arrow_back</i>'
    details.innerHTML += description;

    document.querySelector("#detailsClose").addEventListener('click', () => {
        details.innerHTML = 'Kliknij na mapę lub przybliż aby wyświelić więcej informacji';
        details.data = '';
        clearPopUps();
        detailsLoadInView();
    });

    /* 
        mapInstance.flyTo({
        center: coordinates,
        offset: [(window.innerWidth  > 992) ? window.innerWidth  / 10 : 0, (window.innerWidth  < 992) ? -1 * window.innerHeight  / 4 : 0],
        speed: 0.8,
        zoom: 14,
        bearing: 0
    });
    */


    let popup = new mapboxgl.Popup()
        .setLngLat(coordinates)
        .setHTML('<center>' + properties.op.slice(0, 30) + '...</br><b>' + properties.tx + '</b></center>')
        .addTo(mapInstance);

    (window.popups = window.popups|| []).push(popup)
}

function detailsLoadInView() {

    let zoomTreshold = 12;
    let features = map.queryRenderedFeatures();
    
    if (details.data != 'details' && map.getZoom() > zoomTreshold) {
        details.innerHTML = '';
        details.data = 'collection'
        let list = document.createElement('ul');
        list.className = 'collection'
        details.appendChild(list);

        let bounds = map.getBounds();


        for (let i in features) {
            let feature = features[i];
            if (feature.properties.mapLat < bounds._ne.lat && feature.properties.mapLat > bounds._sw.lat && feature.properties.mapLon < bounds._ne.lng && feature.properties.mapLon > bounds._sw.lng) {

                list.innerHTML += '<li class="collection-item truncate" onclick="loadDetails(\''+feature.properties.id+'\')">' + feature.properties.op + ' <span class="badge">'+((feature.properties.tx.match(','))? (feature.properties.tx.split(',').length + ' częstotliwości') : feature.properties.tx)+'</span></li>';
            }
        }
    }
    if (details.data == 'collection' && map.getZoom() < zoomTreshold) { details.innerHTML = 'Kliknij na mapę lub przybliż aby wyświelić więcej informacji' }
}


function toggleLayerButton(e) {

    let hash = this.data;
    let checkbox = document.getElementById(hash);
    e.preventDefault();
    e.stopPropagation();

    let visibility = map.getLayoutProperty(hash, 'visibility');

    if (visibility === 'visible') {
        map.setLayoutProperty(hash, 'visibility', 'none');
        checkbox.checked = '';
    } else {
        checkbox.checked = 'active';
        map.setLayoutProperty(hash, 'visibility', 'visible');
    }
}

function toggleAllLayers(e) {
    let status = this.data
    e.preventDefault();
    e.stopPropagation();
    for (let i in sources) {
        let hash = sources[i].hash;
        let checkbox = document.getElementById(hash);


        if (status == 'all') {
            this.data = 'none';
            checkbox.checked = '';
            map.setLayoutProperty(hash, 'visibility', 'none');

        } else {
            this.data = 'all';
            checkbox.checked = 'checked';
            map.setLayoutProperty(hash, 'visibility', 'visible');
        }
    }
}

function clearPopUps() {
    for(let i in window.popups) {
        window.popups[i].remove();
    }
}