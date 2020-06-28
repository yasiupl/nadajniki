import 'materialize-css/dist/js/materialize.min.js'
import mapboxgl from 'mapbox-gl'
import sources from './sources.json'
import './style.scss'

const xml2js = require('xml2js');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js');
  });
}

mapboxgl.accessToken = 'pk.eyJ1IjoieWFzaXUiLCJhIjoiY2o4dWF2dmZnMHEwODMzcnB6NmZ5cGpicCJ9.XzC5pC59qPSmqbLv2xBDQw';

var selectedTabIndex = 0;

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
    description: "System stosowany np. w szpitalach.",
    color: "#04adff"
  },
  Q: {
    name: "Mikrofony bezprzewodowe",
    description: "Technika estradowa.",
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
    7, ['+', ['/', ['number', ['get', 'mapRadius'], 1], 100], 3],
    20, ['+', ['/', ['number', ['get', 'mapRadius'], 1], 1000], 16]
  ],
  "circle-stroke-width": 1,
  "circle-opacity": 0.8,
  "circle-stroke-color": ['match',
    ['get', 'mapNetworkType'],
    "B", '#555',
    "D", '#555',
    '#FFF'
  ]
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

  // Wyświetl Disclaimer na pierwszym uruchomieniu strony.
  if (!localStorage.getItem("disclaimer")) {
    let modal = M.Modal.init(document.querySelector('.modal'));
    modal.open();
    localStorage.setItem("disclaimer", true);
  }


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
    filter: ['==', 'id', id],
    validate: false
  });
  const properties = feature[0].properties;
  const coordinates = [properties.lon, properties.lat];

  for (let i in headers) {

    let property = (typeof properties[i] === 'string') ? properties[i].replace('["', '').replace('"]', '').split('","') : properties[i];
    //let property = JSON.parse(properties[i]);

    if (i == 'networkType') {
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
    details.scrollTop = 0;
    clearPopUps();
    detailsLegend();
    detailsLoadInView();
  });

  mapInstance.flyTo({
    center: coordinates,
    offset: [(window.innerWidth > 992) ? window.innerWidth / 10 : 0, (window.innerWidth < 992) ? -1 * window.innerHeight / 4 : 0],
    speed: 0.8,
    zoom: map.getZoom(),
    bearing: 0
  });


  let popup = new mapboxgl.Popup()
    .setLngLat(coordinates)
    .setHTML(`<center>${properties.mapOp.slice(0, 30)}...</br><b>${properties.mapTx}</b></center>`)
    .addTo(mapInstance);

  (window.popups = window.popups || []).push(popup)
}


function detailsLoadInView() {
  let details = document.querySelector('#details');
  let features = map.queryRenderedFeatures({
    filter: ['has', 'tx'],
    validate: false
  }).sort((a, b) => a.properties.mapOp.localeCompare(b.properties.mapOp));
  const zoomTreshold = 12;
  const featuresTreshold = 100;

  if (details.data != 'details' && (map.getZoom() > zoomTreshold || features.length < featuresTreshold)) {
    details.innerHTML = `
    <div class="tab-menu">
      <ul class="tabs">
        <li class="tab">
          <a ${selectedTabIndex == 0 ? 'class="active"' : '' } href="#transmitter-tab">Nadajniki</a>
        </li>
        <li class="tab">
          <a ${selectedTabIndex == 1 ? 'class="active"' : ''} href="#bandplan-tab">Częstotliwości</a>
        </li>
      </ul>
      <a class='dropdown-trigger' href='#' data-target='actions-dropdown'><i class="material-icons">more_vert</i></a>
      <ul id="actions-dropdown" class="dropdown-content" />
        <li>
          <a id="details-export-to-sdr-sharp">Eksportuj widoczne do SDR#</a>
        </li>
      </ul>
    </div>`;
    details.data = 'collection'

    let containerDiv = document.createElement('div')
    containerDiv.id = "transmitter-tab"
    containerDiv.className = "tab-container"
    containerDiv.innerHTML = "Nadajniki w widoku. Oddal aby zobaczyć legendę."
    details.appendChild(containerDiv);
    
    let collection = document.createElement('ul');
    collection.className = 'transmitters collection'
    
    containerDiv.appendChild(collection);

    for (let i in features) {
      let feature = features[i];

      let element = document.createElement('li');
      element.className = 'collection-item truncate';
      element.onclick = function () {
        detailsLoad(feature.properties.id)
      };
      element.innerHTML = `${feature.properties.mapOp}${getBadgesForFrequencies(feature.properties)}`;
      collection.appendChild(element);
    }
  }

  if (details.data != 'details' && map.getZoom() < zoomTreshold && features.length > featuresTreshold) {
    detailsLegend();
    return;
  }
  
  createBandplanView(details, features);

  let tabInstance = M.Tabs.getInstance(document.querySelector('.tabs'))
  if (!tabInstance) {
    tabInstance = M.Tabs.init(document.querySelector('.tabs'), {onShow: onTabShow})
  }

  var dropdownElements = document.querySelectorAll('.dropdown-trigger');

  let dropdownInstance = M.Dropdown.init(dropdownElements, {constrainWidth: false, coverTrigger: false});  
    
  addDropdownButtonListeners();

}

function exportToSdrSharp() {

    let features = map.queryRenderedFeatures({
      filter: ['has', 'tx'],
      validate: false
    }).sort((a, b) => a.properties.mapOp.localeCompare(b.properties.mapOp));

    let bandplan = getBandplanFromFeatures(features);
    let exportedData = {ArrayOfMemoryEntry: []};

    bandplan.forEach(band => {
      exportedData.ArrayOfMemoryEntry.push({
          MemoryEntry: 
          {
            IsFavourite: false,
            Name: band.ownerName,
            GroupName: `#${types[band.networkType].name}`,
            Frequency: `${band.freq.replace('.', '')}0`,
            DetectorType: `NFM`,
            Shift: 0,
            FilterBandwidth: 12500
          }
      })
    })

  let builder = new xml2js.Builder();
  let xml = builder.buildObject(exportedData);

  downloadFile('frequencies.xml', xml);
}

function downloadFile(filename, text) {
  let element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

function addDropdownButtonListeners()
{
  let exportToSdrSharpElement = document.querySelector('#details-export-to-sdr-sharp');
  exportToSdrSharpElement.addEventListener('click', exportToSdrSharp);
}

function onTabShow() {
  let tabInstance = M.Tabs.getInstance(document.querySelector('.tabs'))

  selectedTabIndex = tabInstance.index;
}

function getBandplanFromFeatures(features)
{
  let bandplan = [];

  features.forEach(feature => {
      const freqs = feature.properties.mapTx.replace(/\s/g, "").split(",")

      freqs.forEach(freq => {
        if (freq !== '-' && !bandplan.find(a => a.freq === freq && a.ownerName === a.ownerName)) {
          bandplan.push({
              freq: freq,
              id: feature.properties.id,
              ownerName: feature.properties.mapOp,
              networkType: feature.properties.mapNetworkType
          })
        }
      })
  })
  
  return bandplan.sort((a, b) => a.freq - b.freq);
}

function createBandplanView(details, features) {

  let containerDiv = document.createElement('div')
  containerDiv.id = "bandplan-tab"
  containerDiv.className = "tab-container"
  containerDiv.innerHTML = "Częstotliwości w widoku. Oddal aby zobaczyć legendę."
  details.appendChild(containerDiv);

  let collection = document.createElement('ul');
  collection.className = 'bandplan collection'
  containerDiv.appendChild(collection);

  let bandplan = getBandplanFromFeatures(features);

  bandplan.forEach(band => {
      let element = document.createElement('li');
      element.className = 'collection-item bandplan-item truncate';

      element.onclick = function () {
        detailsLoad(band.id)
      };
      
      element.innerHTML = `<div class='bandplan-entry'><span class="badge new" data-badge-caption=""
        style="background-color:${types[band.networkType].color}">${band.freq}</span>
        <span class='bandplan-entry-owner-name'>${band.ownerName}</span></div>`;
      collection.appendChild(element);
  });
}

function getBadgesForFrequencies(featureProps) {
  const freqs = featureProps.mapTx.replace(/\s/g, "").split(",").sort();

  const freqBadges = freqs.map(freq => {
    if (freq === '-')
      return;

    return `<span class="badge new" data-badge-caption="" style="background-color:${types[featureProps.mapNetworkType].color}">${freq}</span>`
  });

  return `<div class="details-view-badges">${freqBadges.join('')}</div>`;

}

function toggleTag(tag) {
  let checkbox = document.getElementById('toggleTag' + tag);
  if (checkbox.checked == true) {
    checkbox.checked = false;
  } else {
    checkbox.checked = true;
  }
  applyFilterFromCheckboxes();
}

function toggleType(type) {
  let checkbox = document.getElementById('toggleType' + type);
  if (checkbox.checked == true) {
    checkbox.checked = false;
  } else {
    checkbox.checked = true;
  }
  applyFilterFromCheckboxes();
}

function applyFilterFromCheckboxes() {
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
  applyFilterFromCheckboxes()
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

  details.innerHTML += `Ostatnia aktualizacja: ${(new Date(sources.generated)).toISOString().split("T")[0]}`;
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
