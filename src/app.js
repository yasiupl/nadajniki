import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

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
    'Częstotliwości nadawcze [MHz] ',
    'Częstotliwości odbiorcze [MHz] ',
    'Szerokości kanałów nadawczych [kHz] ',
    'Szerokości kanałów odbiorczych [kHz] ',
    'Operator',
    'Adres operatora'
]

const types = {
    "A": "Dyspozytorska",
    "B": "Przywoławcza",
    "C": "Transmisja danych",
    "D": "Retransmisja",
    "E": "Zdalne sterowanie",
    "F": "Powiadamiania o alarmach",
    "P": "Bezprzewodowe poszukiwanie osób",
    "Q": "Mikrofony bezprzewodowe",
    "R": "Reportażowa",
    "T": "Trankingowa"
}

mapboxgl.accessToken = 'pk.eyJ1IjoieWFzaXUiLCJhIjoiY2o4dWF2dmZnMHEwODMzcnB6NmZ5cGpicCJ9.XzC5pC59qPSmqbLv2xBDQw';
var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v10',
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

map.on('load', function () {

    map.addSource("nadajniki", {
        type: "geojson",
        //data: require('./data/DZC_MOB.json'),
        data: require('./data/OWA.json')
    });

    // Add a layer showing the places.
    map.addLayer({
        id: "places",
        type: "circle",
        source: "nadajniki",
        paint: {
            "circle-color": "#11b4da",
            "circle-radius": 4,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#fff"
        }
    });

    // When a click event occurs on a feature in the places layer, open a popup at the
    // location of the feature, with description HTML from its properties.
    map.on('click', 'places', function (e) {
        let coordinates = e.features[0].geometry.coordinates.slice();
        let description = ''

        for (let i in headers) {
            description += '<b>' + headers[i] + ':</b> ' + e.features[0].properties[i] + '</br>'
        }

        // Ensure that if the map is zoomed out such that multiple
        // copies of the feature are visible, the popup appears
        // over the copy being pointed to.
        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
        }

        new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(description)
            .addTo(map);
    });

    // Change the cursor to a pointer when the mouse is over the places layer.
    map.on('mouseenter', 'places', function () {
        map.getCanvas().style.cursor = 'pointer';
    });

    // Change it back to a pointer when it leaves.
    map.on('mouseleave', 'places', function () {
        map.getCanvas().style.cursor = '';
    });
});