import 'materialize-css/dist/js/materialize.min.js'
import mapboxgl from 'mapbox-gl'
import sources from './sources.json'
import './style.scss'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js');
  });
}

mapboxgl.accessToken = 'pk.eyJ1IjoieWFzaXUiLCJhIjoiY2o4dWF2dmZnMHEwODMzcnB6NmZ5cGpicCJ9.XzC5pC59qPSmqbLv2xBDQw';

const layers = sources.layers;

const headers = {
  permitID: 'Nr pozwolenia',
  op: 'Operator',
  opAdress: 'Adres operatora',
  name: 'Nazwa stacji',
  stationType: 'Rodzaj stacji',
  networkType: 'Rodzaj sieci',
  lon: 'Długość geograficzna',
  lat: 'Szerokość geograficzna',
  radius: 'Promień obszaru obsługi',
  location: 'Lokalizacja stacji',
  erp: 'Maksymalna moc zastępcza (ERP) [dBW]',
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
  permitExpiry: 'Data wygaśnięcia',
}

const types = {
  A: {
    name: "Dyspozytorska",
    description: "Stacja radiowa dyspozytorska",
    color: "#03a8a0"
  },
  B: {
    name: "Przywoławcza",
    description: "Stacja radiowa przywoławcza.",
    color: "#039c4b"
  },
  C: {
    name: "Transmisja danych",
    description: "np. stany liczników cyfrowych.",
    color: "#66d313"
  },
  D: {
    name: "Retransmisja",
    description: "Retransmisja sygnałów / przemiennik.",
    color: "#fedf17"
  },
  E: {
    name: "Zdalne sterowanie",
    description: "Zdalne sterowanie urządzeniami.",
    color: "#ff0984"
  },
  F: {
    name: "Powiadamiania o alarmach",
    description: "Systemy alarmowe ochrony mienia.",
    color: "#21409a"
  },
  P: {
    name: "Bezprzewodowe poszukiwanie osób",
    description: "Stacje radiowe systemu bezprzewodowego poszukiwania osób.",
    color: "#04adff"
  },
  Q: {
    name: "Mikrofony bezprzewodowe",
    description: "np. Technika estradowa.",
    color: "#e48873"
  },
  R: {
    name: "Reportażowa",
    description: "Stacja reporterów rozgłośni radiowej.",
    color: "#f16623"
  },
  T: {
    name: "Trunkingowa",
    description: "Sieć kumulująca sygnały z wielu źródeł w jedną wiązkę.",
    color: "#f44546"
  },
  L: {
    name: "Nieznane",
    description: "Nowy typ UKE.",
    color: "#666"
  }
}

const paint = {
  "circle-color": [
    'match',
    ['get', 'mapNetworkType'],
    "A", types["A"].color,
    "B", types["B"].color,
    "C", types["C"].color,
    "D", types["D"].color,
    "E", types["E"].color,
    "F", types["F"].color,
    "P", types["P"].color,
    "Q", types["Q"].color,
    "R", types["R"].color,
    "T", types["T"].color,
    "L", types["L"].color,
    '#11b4da'
  ],
  "circle-radius": [
    'interpolate', ['linear'],
    ['zoom'],
    7, ['+', ['/', ['number', ['get', 'mapRadius'], 1], 100], 4],
    12, ['+', ['/', ['number', ['get', 'mapRadius'], 1], 1000], 10]
  ],
  "circle-stroke-width": 1,
  "circle-opacity": 0.8,
  "circle-stroke-color": "#FFF"
}

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

  if (sources.uploadedTileset) {
    map.addLayer({
      id: 'nadajniki',
      type: "circle",
      source: {
        type: 'vector',
        url: `mapbox://${sources.uploadedTileset}`
      },
      'source-layer': "original",
      paint: paint
    });

    map.on('click', 'nadajniki', (e) => {
      detailsLoad(e.features[0].properties.id);
    });

    map.on('mouseenter', 'nadajniki', function () {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'nadajniki', function () {
      map.getCanvas().style.cursor = '';
    });
  } else {
    for (let i in layers) {
      addLayerFromHash(map, layers[i].hash);
    }
  }

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
  toggleAll.innerHTML = '<a>Przełącz Wszystkie</a>';
  toggleAll.onclick = toggleAllFilters;
  filters.appendChild(toggleAll);


  let divider1 = document.createElement('li');
  divider1.innerHTML = '<a>Typy sieci (Kliknij aby przełączyć)</a>';
  divider1.onclick = toggleAllFilters;
  divider1.category = 'toggleType';
  filters.appendChild(divider1);

  // Wypisz wszystkie typy w menu bocznym
  for (let i in types) {
    let type = types[i];
    let link = document.createElement('li');
    link.innerHTML = `<a class="truncate"><label><input type="checkbox" id="toggleType${i}" toggles="mapNetworkType" data="${i}" checked="checked"/><span></span></label><span class="badge" style="background-color:${type.color}"> </span>${type.name}</a>`;
    link.onclick = function () {
      toggleType(i)
    };
    filters.appendChild(link);
  }

  let divider2 = document.createElement('li');
  divider2.innerHTML = '<a>Sieci (Kliknij aby przełączyć)</a>';
  divider2.onclick = toggleAllFilters;
  divider2.category = 'toggleTag';
  filters.appendChild(divider2);


  // Wypisz wszystkie tagi w menu bocznym
  const tags = sources.tags;
  for (let tag of tags) {
    let link = document.createElement('li');
    link.innerHTML = `<a class="truncate"><label><input type="checkbox" id="toggleTag${tag.tag}" toggles="tag" data="${tag.tag}" checked="checked"/><span></span></label><span class="badge">${tag.length}</span>${tag.name}</a>`;
    link.onclick = function () {
      toggleTag(tag.tag)
    };
    filters.appendChild(link);
  }

  // przerwa od dołu aby wszystkie elementy były widoczne
  let divider3 = document.createElement('li');
  divider3.innerHTML = '<a></br></br></a>';
  filters.appendChild(divider3);

  detailsLegend();
});


function detailsLoad(id, mapInstance = map) {
  let details = document.querySelector('#details');
  let description = ''
  const feature = map.queryRenderedFeatures({
    filter: ['==', 'id', id]
  });
  const properties = feature[0].properties;
  const coordinates = [properties.lon, properties.lat];

  for (let i in headers) {

    let property = (typeof properties[i] === 'string') ? properties[i].replace('["', '').replace('"]', '').split('","') : properties[i];
    //let property = JSON.parse(properties[i]);

    if (i == 'networkType') {
      console.log(property[0])
      description += `<b>${headers[i]}:</b> ${property}: ${types[property[0]].name}</br>`;
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

    let collection = document.createElement('ul');
    collection.className = 'collection'
    details.appendChild(collection);



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
        let element = document.createElement('li');
        element.className = 'collection-item truncate';
        element.onclick = function () {
          detailsLoad(feature.properties.id)
        };
        element.innerHTML = `${feature.properties.mapOp }<span class="badge new" data-badge-caption="" style="background-color:${types[feature.properties.mapNetworkType].color}">${(feature.properties.tx.match(',')) ? (feature.properties.tx.split(',').length + ' częstotliwości') : feature.properties.mapTx}</span>`;
        collection.appendChild(element);
      }
    }
    //console.log(bandplan);
  }
  if (details.data != 'details' && map.getZoom() < zoomTreshold) detailsLegend();
}


function toggleTag(tag) {
  let checkbox = document.getElementById('toggleTag' + tag);
  if (checkbox.checked == true) {
    checkbox.checked = false;
  } else {
    checkbox.checked = true;
  }
  applyFilterFromChecboxes();
}

function toggleType(type) {
  let checkbox = document.getElementById('toggleType' + type);
  if (checkbox.checked == true) {
    checkbox.checked = false;
  } else {
    checkbox.checked = true;
  }
  applyFilterFromChecboxes();
}

function applyFilterFromChecboxes() {
  let hidden = ['all']
  let checkboxes = document.querySelectorAll('input');
  for (let i in checkboxes) {
    let checkbox = checkboxes[i];
    if (checkbox.checked == false) {
      hidden.push(['!=', checkbox.getAttribute("toggles"), checkbox.getAttribute("data")]);
    }
    // zaaplikuj filtr w ostatniej iteracji
    if (i == (checkboxes.length - 1)) map.setFilter('nadajniki', hidden);
  };
}

function toggleAllFilters(e) {
  let category = this.category || /.*/;
  let status = this.data
  let checkboxes = document.querySelectorAll('input');

  console.log(category)

  checkboxes.forEach((checkbox) => {
    if (checkbox.id.match(category)) {
      if (status == 'none') {
        this.data = 'all';
        checkbox.checked = true;
      } else {
        this.data = 'none';
        checkbox.checked = false;
      }
    }
  });
  applyFilterFromChecboxes()
}

function clearPopUps() {
  for (let i in window.popups) {
    window.popups[i].remove();
  }
}

function detailsLegend() {

  details.innerHTML = "Kliknij na mapę lub przybliż aby wyświelić więcej informacji."

  let legend = document.createElement('ul');
  legend.className = 'collection';
  details.appendChild(legend);

  for (let i in types) {
    let type = types[i];
    let legendOfType = document.createElement('li');
    legendOfType.className = 'collection-item avatar'
    legendOfType.innerHTML = `<div style="background-color: ${type.color}" class="circle"></div><span class="title">Typ ${i}: ${type.name} </span><p>${type.description}</p>`
    legend.appendChild(legendOfType);
  }
}

function addLayerFromHash(map, hash) {
  map.addLayer({
    id: hash,
    type: "circle",
    source: {
      type: "geojson",
      data: `./data/${hash}.geojson?t=${sources.generated}`
    },
    paint: paint
  });
  map.on('click', hash, (e) => {
    loadDetails(e.features[0].properties.id);
  });

  map.on('mouseenter', hash, function () {
    map.getCanvas().style.cursor = 'pointer';
  });

  map.on('mouseleave', hash, function () {
    map.getCanvas().style.cursor = '';
  });
}