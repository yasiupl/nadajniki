import 'materialize-css/dist/js/materialize.min.js'
import mapboxgl from 'mapbox-gl'
import sources from './sources.json'
import './style.scss'

mapboxgl.accessToken = 'pk.eyJ1IjoieWFzaXUiLCJhIjoiY2o4dWF2dmZnMHEwODMzcnB6NmZ5cGpicCJ9.XzC5pC59qPSmqbLv2xBDQw';

const layers = sources.layers;

const headers = {
  tag: 'tag',
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
  A: ["Dyspozytorska", "#03a8a0"],
  B: ["Przywoławcza", "#039c4b"],
  C: ["Transmisja danych", "#66d313"],
  D: ["Retransmisja", "#fedf17"],
  E: ["Zdalne sterowanie", "#ff0984"],
  F: ["Powiadamiania o alarmach", "#21409a"],
  P: ["Bezprzewodowe poszukiwanie osób", "#04adff"],
  Q: ["Mikrofony bezprzewodowe", "#e48873"],
  R: ["Reportażowa", "#f16623"],
  T: ["Trunkingowa", "#f44546"]
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

  map.addLayer({
    id: 'nadajniki',
    type: "circle",
    source: {
      type: 'vector',
      url: `mapbox://${sources.uploadedTileset}`
    },
    'source-layer': "original",
    paint: {
      "circle-color": [
        'match',
        ['get', 'mapNetworkType'],
        "A", types["A"][1],
        "B", types["B"][1],
        "C", types["C"][1],
        "D", types["D"][1],
        "E", types["E"][1],
        "F", types["F"][1],
        "P", types["P"][1],
        "Q", types["Q"][1],
        "R", types["R"][1],
        "T", types["T"][1],
        '#11b4da'
      ],
      "circle-radius": [
        'interpolate', ['linear'],
        ['zoom'],
        7, ['+', ['/', ['number', ['get', 'mapRadius'], 1], 100], 2],
        12, ['+', ['/', ['number', ['get', 'mapRadius'], 1], 1000], 10]
      ],
      "circle-stroke-width": 1,
      "circle-opacity": 0.8,
      "circle-stroke-color": "#FFF"
    }
  });

  map.on('click', 'nadajniki', (e) => {
    detailsLoad(e.features[0].layer.id, e.features[0].properties.id);
  });

  map.on('mouseenter', 'nadajniki', function () {
    map.getCanvas().style.cursor = 'pointer';
  });

  map.on('mouseleave', 'nadajniki', function () {
    map.getCanvas().style.cursor = '';
  });

});

map.on('idle', detailsLoadInView);

map.on('moveend', detailsLoadInView);

document.addEventListener('DOMContentLoaded', function () {
  M.Sidenav.init(document.querySelector('#filters'), {
    edge: 'right'
  });
  M.Sidenav.init(document.querySelector('#menu'));


  const filters = document.getElementById('filters');
  let toggleAll = document.createElement('li');
  toggleAll.data = 'all';
  toggleAll.innerHTML = '<a>Przełącz Wszystkie</a>';
  toggleAll.onclick = toggleAllLayers;
  filters.appendChild(toggleAll);

  const tags = sources.tags;
  for (let tag of tags) {
    let link = document.createElement('li');
    link.innerHTML = `<a class="truncate"><label><input type="checkbox" id="${tag.tag}" checked="checked"/><span></span></label><span class="badge">${tag.length}</span>${tag.name}</a>`;
    link.data = tag.tag;
    link.onclick = toggleLayerButton;
    filters.appendChild(link);
  }

  detailsLegend();
});


window.detailsLoad = function (layer, id, mapInstance = map) {
  let details = document.querySelector('#details');
  let description = ''
  const feature = map.queryRenderedFeatures({
    filter: ['==', 'id', id]
  });
  const properties = feature[0].properties;
  const coordinates = [properties.lon, properties.lat];

  for (let i in headers) {

    let property = (typeof properties[i] === 'string')? properties[i].replace('["', '').replace('"]', '').split('","'): properties[i];
    //let property = JSON.parse(properties[i]);

    if (i == 'networkType') {
      console.log(property[0])
      description += `<b>${headers[i]}:</b> ${property}: ${types[property[0]][0]}</br>`;
      continue
    }
    description += `<b>${headers[i]}:</b> ${(Array.isArray(property))?property.join(', ') : property}</br>`;
  }

  details.data = 'details'
  details.innerHTML = `<i id="detailsClose" class="material-icons right">arrow_back</i>`
  details.innerHTML += description;

  document.querySelector("#detailsClose").addEventListener('click', () => {
    details.data = '';
    clearPopUps();
    detailsLegend();
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
    .setHTML(`<center>${properties.mapOp.slice(0, 30)}...</br><b>${properties.mapTx}</b></center>`)
    .addTo(mapInstance);

  (window.popups = window.popups || []).push(popup)
}

function detailsLoadInView() {
  let details = document.querySelector('#details');
  let zoomTreshold = 12;
  let features = map.queryRenderedFeatures();
  let bounds = map.getBounds();
  //let bandplan = {};

  if (details.data != 'details' && map.getZoom() > zoomTreshold) {
    details.innerHTML = `Nadajniki w widoku. Oddal aby zobaczyć legendę.`;
    details.data = 'collection'

    let element = document.createElement('ul');
    element.className = 'collection'
    details.appendChild(element);


    for (let i in features) {
      let feature = features[i];
      if (feature.properties.lat < bounds._ne.lat && feature.properties.lat > bounds._sw.lat && feature.properties.lon < bounds._ne.lng && feature.properties.lon > bounds._sw.lng) {

        /* 
         // Bandplan w danym widoku
         let frequencies = feature.properties.tx.split(", ");
          for (let j in frequencies) {
              let frequency = frequencies[j];
              bandplan[frequency] = bandplan[frequency] || {};
              bandplan[frequency].op = feature.properties.op;
              (bandplan[frequency].stations = bandplan[frequency].stations || []).push(feature.properties.name);

          }*/
        element.innerHTML += `<li class="collection-item truncate" onclick="detailsLoad('${feature.sourceLayer || feature.layer}','${feature.properties.id}')">${feature.properties.mapOp }<span class="badge new" data-badge-caption="" style="background-color:${types[feature.properties.mapNetworkType[1]]}">${(feature.properties.tx.match(',')) ? (feature.properties.tx.split(',').length + ' częstotliwości') : feature.properties.mapTx}</span></li>`;
      }
    }
    //console.log(bandplan);
  }
  if (details.data != 'details' && map.getZoom() < zoomTreshold) detailsLegend();
}

function detailsLegend() {
  details.innerHTML = `Kliknij na mapę lub przybliż aby wyświelić więcej informacji.
    <ul class="collection">
    <li class="collection-item avatar">
      <div style="background-color: #03a8a0" class="circle"></div>
      <span class="title">Typ A</span>
      <p>
        Stacja nadawcza Dyspozytorska.
      </p>
    </li>
    <li class="collection-item avatar">
      <div style="background-color: #039c4b" class="circle"></div>
      <span class="title">Typ B</span>
      <p>
        Stacja nadawcza Przywoławcza.
      </p>
    </li>
    <li class="collection-item avatar">
      <div style="background-color: #66d313" class="circle"></div>
      <span class="title">Typ C</span>
      <p>
        Stacja transmisji danych.
      </p>
    </li>
    <li class="collection-item avatar">
      <div style="background-color: #fedf17" class="circle"></div>
      <span class="title">Typ D</span>
      <p>
        Stacja retransmisyjna / przemiennik.
      </p>
    </li>
    <li class="collection-item avatar">
      <div style="background-color: #ff0984" class="circle"></div>
      <span class="title">Typ E</span>
      <p>
        Stacja zdalnego sterowania.
      </p>
    </li>
    <li class="collection-item avatar">
      <div style="background-color: #21409a" class="circle"></div>
      <span class="title">Typ F</span>
      <p>
        Stacja powiadomianiania o alarmach.
      </p>
    </li>
    <li class="collection-item avatar">
      <div style="background-color: #04adff" class="circle"></div>
      <span class="title">Typ P</span>
      <p>
        Stacja bezprzewodowego poszukiwania osób.
      </p>
    </li>
    <li class="collection-item avatar">
      <div style="background-color: #e48873" class="circle"></div>
      <span class="title">Typ Q</span>
      <p>
        Mikrofony bezprzewodowe.
      </p>
    </li>
    <li class="collection-item avatar">
      <div style="background-color: #f16623" class="circle"></div>
      <span class="title">Typ R</span>
      <p>
        Stacja Reportażowa.
      </p>
    </li>
    <li class="collection-item avatar">
      <div style="background-color: #f44546" class="circle"></div>
      <span class="title">Typ T</span>
      <p>
        Stacja Trunkingowa.
      </p>
    </li>
  </ul>`
}

function toggleLayerButton(e) {


  let tag = this.data;
  let checkbox = document.getElementById(tag);
  e.preventDefault();
  e.stopPropagation();
  if (checkbox.checked == true) {
    checkbox.checked = false;
  } else {
    checkbox.checked = true;
  }

  let hidden = ['all']
  let checkboxes = document.querySelectorAll('input');
  for(let i in checkboxes) {
    checkbox = checkboxes[i];
    if (checkbox.checked == false) {
      hidden.push(['!=', 'tag', checkbox.id]);
    }
    if(i == (checkboxes.length - 1)) map.setFilter('nadajniki', hidden);
  };
  console.log(map.getFilter('nadajniki'));
}

function toggleAllLayers(e) {
  let status = this.data
  e.preventDefault();
  e.stopPropagation();
  for (let tag of sources.tags) {
    let checkbox = document.getElementById(tag.tag);
    if (status == 'all') {
      this.data = 'none';
      checkbox.checked = false;
      map.setFilter('nadajniki', ['any']);
    } else {
      this.data = 'all';
      checkbox.checked = true;
      map.setFilter('nadajniki', ['all']);
    }
  }
}

function clearPopUps() {
  for (let i in window.popups) {
    window.popups[i].remove();
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js');
  });
}