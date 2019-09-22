import 'materialize-css/dist/js/materialize.min.js'
import mapboxgl from 'mapbox-gl'
import sources from './sources.json'
import './style.scss'


const headers = {
    id: 'Nr pozwolenia',
    date: 'Data wygaśnięcia',
    name: 'Nazwa stacji',
    stationType: 'Rodzaj stacji',
    networkType: 'Rodzaj sieci',
    lat: 'Długość geograficzna',
    lon: 'Szerokość geograficzna',
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
                '+',
                ['/',
                    ['number', ['get', 'mapRadius'], 1],
                    10],
                5
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
    map.on('click', hash, function (e) {
        let coordinates = e.features[0].geometry.coordinates.slice();
        let description = ''

        for (let i in headers) {
            if (i == 'networkType') {
                description += '<b>' + headers[i] + ':</b> ' + e.features[0].properties[i] + ': ' + types[e.features[0].properties[i]] + '</br>';
                continue
            }
            description += '<b>' + headers[i] + ':</b> ' + e.features[0].properties[i] + '</br>';
        }

        // Ensure that if the map is zoomed out such that multiple
        // copies of the feature are visible, the popup appears
        // over the copy being pointed to.
        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
        }

        document.querySelector('#details').innerHTML = description;

        /*
        new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(description)
            .addTo(map);
        */
    });

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


mapboxgl.accessToken = 'pk.eyJ1IjoieWFzaXUiLCJhIjoiY2o4dWF2dmZnMHEwODMzcnB6NmZ5cGpicCJ9.XzC5pC59qPSmqbLv2xBDQw';
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
    //addLayerFromHash(map, 'leftovers')
    let layers = document.getElementById('layers');

    let toggleAll = document.createElement('li');
    toggleAll.id = 'all';
    toggleAll.textContent = 'Przełącz Wszystkie';
    toggleAll.onclick = toggleAllLayers;
    layers.appendChild(toggleAll);

    for (let i in sources) {
        console.log(sources[i].name)
        // Add a layer showing the places.
        addLayerFromHash(map, sources[i].hash);

        let link = document.createElement('li');
        link.id = sources[i].hash;
        link.textContent = '[' + sources[i].length + '] ' + sources[i].name;
        link.className = 'active';
        link.onclick = toggleLayerButton;
        layers.appendChild(link);
    }
});

function toggleLayerButton(e) {

    let hash = this.id;
    e.preventDefault();
    e.stopPropagation();

    let visibility = map.getLayoutProperty(hash, 'visibility');

    if (visibility === 'visible') {
        map.setLayoutProperty(hash, 'visibility', 'none');
        this.className = '';
    } else {
        this.className = 'active';
        map.setLayoutProperty(hash, 'visibility', 'visible');
    }
}

function toggleAllLayers(e) {
    let status = this.className
    e.preventDefault();
    e.stopPropagation();
    for (let i in sources) {
        let hash = sources[i].hash;
        let button = document.getElementById(hash);


        if (status == 'active') {
            map.setLayoutProperty(hash, 'visibility', 'none');
            this.className = '';
            button.className = '';
        } else {
            this.className = 'active';
            button.className = 'active';
            map.setLayoutProperty(hash, 'visibility', 'visible');
        }
    }
}

document.addEventListener('DOMContentLoaded', function () {
    M.Sidenav.init(document.querySelector('#layers'), {edge:'right'});
    M.Sidenav.init(document.querySelector('#menu'));
});