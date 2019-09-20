import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

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

mapboxgl.accessToken = 'pk.eyJ1IjoieWFzaXUiLCJhIjoiY2o4dWF2dmZnMHEwODMzcnB6NmZ5cGpicCJ9.XzC5pC59qPSmqbLv2xBDQw';
var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/outdoors-v10',
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

    map.addSource("nadajniki", {
        type: "geojson",
        data: './data/data.geojson',
        //cluster: true,
        clusterMaxZoom: 8, // Max zoom to cluster points on
        clusterRadius: 50
    });

    map.addLayer({
        id: "clusters",
        type: "circle",
        source: "nadajniki",
        filter: ["has", "point_count"],
        paint: {
            // Use step expressions (https://docs.mapbox.com/mapbox-gl-js/style-spec/#expressions-step)
            // with three steps to implement three types of circles:
            //   * Blue, 20px circles when point count is less than 100
            //   * Yellow, 30px circles when point count is between 100 and 750
            //   * Pink, 40px circles when point count is greater than or equal to 750
            "circle-color": [
                "step",
                ["get", "point_count"],
                "#51bbd6",
                100,
                "#f1f075",
                750,
                "#f28cb1"
            ],
            "circle-radius": [
                "step",
                ["get", "point_count"],
                20,
                100,
                30,
                750,
                40
            ]
        }
    });

    map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "nadajniki",
        filter: ["has", "point_count"],
        layout: {
            "text-field": "{point_count_abbreviated}",
            "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
            "text-size": 12
        }
    });

    // Add a layer showing the places.
    map.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: "nadajniki",
        filter: ["!", ["has", "point_count"]],
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
    map.on('click', 'unclustered-point', function (e) {
        let coordinates = e.features[0].geometry.coordinates.slice();
        let description = ''

        for (let i in headers) {
            if (i == 'networkType') {
                description += '<b>' + headers[i] + ':</b> ' + e.features[0].properties[i] + ': '+ types[e.features[0].properties[i]] + '</br>';
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
    map.on('mouseenter', 'unclustered-point', function () {
        map.getCanvas().style.cursor = 'pointer';
    });

    // Change it back to a pointer when it leaves.
    map.on('mouseleave', 'unclustered-point', function () {
        map.getCanvas().style.cursor = '';
    });
});