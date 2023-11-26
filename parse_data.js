const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx-extractor');
const crypto = require('crypto');

function parseFiles() {
    console.log("Przetwarzanie")

    let json = {}

    fs.readdir(path.join(__dirname, 'data'), async function (err, files) {
        for (const file of files) {
            await xlsx.extractAll('./data/' + file)
                .then((sheets) => {
                    json = parseToJSON(sheets, json);
                })
                .catch((err) => console.log(err));
        }
        processData(json);
    });

}

function parseToJSON(sheets, json) {
    for (let i in sheets) {

        let sheet = sheets[i];

        console.log(sheet.name);
        console.log('Rekordów:' + sheet.cells.length);

        for (let j in sheet.cells) {
            if (j == 0) continue
            row = sheet.cells[j];

            let propertiesSlugs = ['permitID', 'permitExpiry', 'name', 'stationType', 'networkType', 'lon', 'lat', 'radius', 'location', 'erp', 'azimuth', 'elevation', 'polarization', 'gain', 'antennaHeight', 'groundHeight', 'horizontalCharacteristic', 'verticalCharacteristic', 'tx', 'rx', 'txSpan', 'rxSpan', 'op', 'opAdress'];
            
            // fix Excel date
            row[1] = (new Date(( parseInt(row[1]) - (25567 + 2))*86400*1000)).toISOString().split("T")[0]
            
            let op = row[22].toLowerCase();
            let tower = (row[5] + row[6]).split(/N|S|W|E|'|"/).join('');
            //agregate points in the same place, owned by the same company
            json[op] = json[op] || [];
            json[op][tower] = json[op][tower] || {};

            for (let k in row) {
                property = propertiesSlugs[k];
                json[op][tower][property] = json[op][tower][property] || [];
                //compare with last property, if its different, add it.
                if (json[op][tower][property].indexOf(row[k]) == -1) {
                    json[op][tower][property].push(row[k])
                } else continue;
            }
        }
        return json
    }
}

function processData(json) {

    // Dla jakiej minimalnej ilości nadajników rozdzielić firmę do osobnego pliku.
    const treshold = 100;

    let countAll = 0;
    let sources = {};
    let points = []

    const tags = {
        "new": {
            name: "Nowe",
            length: 0
        },
        "single": {
            name: "Pojedyncze",
            length: 0
        },
        "small": {
            name: "Małe Sieci",
            length: 0
        },
        "higher_education": {
            name: "Szkoły Wyższe",
            match: /\buniwersytet|\bpolitechnik|\bakademi|\bszkoła wyższa/,
            length: 0
        },
        "national_forrest": {
            name: "Lasy Państwowe",
            match: /\bnadleśnictwo|\bnadlesnictwo|\blasy|\blasów/,
            length: 0
        },
        "national_park": {
            name: "Parki Narodowe",
            match: /(\bpark).*(\bnarodowy)/,
            length: 0
        },
        "road": {
            name: "Drogi",
            match: /\bdróg|\bdrogi|\bautostrad/,
            length: 0
        },
        "city_guard": {
            name: "Straż Miejska",
            match: /(\bstraż).*(\bmiejsk)/,
            length: 0
        },
        "firefighter": {
            name: "Straż Pożarna",
            match: /(\bstraż).*(\bpożar)|\bpożar/,
            length: 0
        },
        "volounteer_med": {
            name: "Pogotowie Ochotnicze",
            match: /(\bochotnicz).*(\bpogotow)/,
            length: 0
        },
        "airmed": {
            name: "Pogotowie Lotnicze",
            match: /(\blotnicz).*(\bpogotow)/,
            length: 0
        },
        "med": {
            name: "Pogotowie Ratunkowe",
            match: /\bpogotowi|\bszpital|\bopieki|\bopieka|\bnfz |\b zoz |\bratownictw|\bmedycyna/,
            length: 0
        },
        "sport": {
            name: "Sport",
            match: /\bsport|\bbieg/,
            length: 0
        },
        "transportation": {
            name: "Taxi, Komunikacja Miejska",
            match: /\bkomunikacja|\bkomunikacji|\bkomunikacyj|\btramwaj|\bautobus|\btaxi|\btaksówk|\btransport|\bprzewoźnik|\bprzewóz osób/,
            length: 0
        },
        "railroad": {
            name: "Kolej",
            match: /\bpkp|\bkolej|\brail|\b db /,
            length: 0
        },
        "water_supply": {
            name: "Wodociagi",
            match: /\bwodocią|\bwoda|\bwodno|\bwodo/,
            length: 0
        },
        "waste": {
            name: "Odpady",
            match: /\bodpad|\butyliza|\boczyszcza|\bkanaliza/,
            length: 0
        },
        "water_managment": {
            name: "Gospodarka Wodna",
            match: /\bgospodarki wodnej|(\bgospodar).*(\bwod)/,
            length: 0
        },
        "heat_plant": {
            name: "Ciepłownie",
            match: /\bciepło|\bciepła|\bcieplne|\bcieplna/,
            length: 0
        },
        "power_plant": {
            name: "Elektrownie",
            match: /\belektrow|\benergety/,
            length: 0
        },
        "gas": {
            name: "Gazownictwo",
            match: /\bgazociąg|\bgazownictw/,
            length: 0
        },
        "extraction": {
            name: "Wydobywanie",
            match: /\bkghm|\bkopalni|\bgórnict|\bwęgiel/,
            length: 0
        },
        "common": {
            name: "Gminy",
            match: /\bgmina|\bgminy|\bgminna/,
            length: 0
        },
        "county": {
            name: "Powiaty",
            match: /\bpowiat|\bstarost/,
            length: 0
        },
        "city": {
            name: "Miasta",
            match: /\bmiasto|\bmiasta|\bmiejski|(\burząd).*(\bmiejsk|\bmiast)|\bprezydent|\bburmistrz/,
            length: 0
        },
        "voivodeship": {
            name: "Województwa",
            match: /\bwojewoda|\bwojewództwo/,
            length: 0
        },
        "security": {
            name: "Ochrona",
            match: /\bochrony|\bochrona|\bsecur|\bprotec|\bsolid|\bdetektyw|\b997|\bmienie|\bmienia|\binterwencj/,
            length: 0
        },
        "air": {
            name: "Lotnictwo",
            match: /\bairport|\blotnis|\blotnicz/,
            length: 0
        },
        "port": {
            name: "Porty",
            match: /\bport|\bmorski/,
            length: 0
        },
        "culture": {
            name: "Kultura",
            match: /\bmuzeum|\bmuzea|\bteatr|\bfilharmon|\bkultur/,
            length: 0
        },
        "bank": {
            name: "Banki",
            match: /\bbank/,
            length: 0
        },
        "lotos": {
            name: "Lotos",
            match: /\blotos/,
            length: 0
        },
        /*{ name: "PGE", match: /\bpge/, length: 0 },
        { name: "Tauron", match: /\btauron/, length: 0 },
        { name: "Energa", match: /\benerga/, length: 0 },
        { name: "Telewizja", match: /\btvp|\btelewizja/, length: 0 },
        { name: "Działalność Osobowa", match: /\bpod nazwą|\bpod firmą|\bprowadzący/, length: 0 },
        { name: "Spółka z o.o.", match: /(\bsp.|\bsp ).*(\bz o.o|\bz o. o|\bz  o. o|\bz  o.o)|\bspółka z ograniczoną odpowiedzialnością/, length: 0 },
        { name: "Spółka Akcyjna.", match: /\bs.a|\bspółka akcyjna|\bs. a.|\b sa/, length: 0 }*/
    };

    
    for (let i in json) {
        let company = json[i];

        companyLoop:
        for (let j in company) {

            countAll++;

            let tower = company[j];
            tower.tags = [];
            tower.networkSize = Object.keys(company).length

            for (let k in tags) {
                let tag = tags[k];
                if (tower.op[0].toLowerCase().match(tag.match || /a^/)) {
                    tower.tags.push(k);
                    tag.length++;
                    points.push(tower);
                    continue companyLoop
                };
            }

            if (tower.networkSize > treshold) {
                let tag = crypto.createHash('md5').update(tower.op[0]).digest('hex');
                tower.tags.push(tag);
                tags[tag] = (tags[tag] || {});
                tags[tag].name = tower.op[0];
                tags[tag].length = tower.networkSize;

            } else if (tower.networkSize > 1) {
                tower.tags.push("small");
                tags["small"].length++
            } else {
                tower.tags.push("single");
                tags["single"].length++
            }
            
            let today = new Date()
            today.setMonth(today.getMonth() - 2);
            const permitYears = 10;
            for(expiry of tower.permitExpiry) {
                registryDate = new Date(expiry);
                registryDate.setFullYear(registryDate.getFullYear() - permitYears);
                if(registryDate >= today) {
                    tower.tags.push("new");
                    tags["new"].length++
                    console.log(`Nowy nadajnik! ${registryDate.toISOString()}: ${tower.name[0]}`);
                    break
                }
            }

            points.push(tower);
        }
    }

    sources.tags = [];

    for(tag in tags) {
        sources.tags.push({tag: tag, name: tags[tag].name, length: tags[tag].length})
    }
    sources.tags.sort((a, b) => (a.length < b.length) ? 1 : -1);
    sources.generated = Date.now();
    sources.layers = [];
    sources.layers.push({
        length: countAll,
        name: 'Wszystko',
        hash: 'all'
    });

    console.log(sources.tags);

    saveToFile(JSON.stringify(sources), './src/', 'sources.json');

    parseGeoJSON('all', points);
}

function parseGeoJSON(collection, data) {

    let geojson = {
        type: "FeatureCollection",
        name: collection,
        features: []
    }

    for (let i in data) {
        let point = data[i];
        let properties = {
            id: crypto.createHash('md5').update(point.name[0] + point.lat[0] + point.lon[0]).digest('hex'),
            tag: point.tags[0],
            mapName: point.name[0],
            mapOp: point.op[0],
            mapTx: point.tx.join(', '),
            mapNetworkType: point.networkType[0],
            mapRadius: point.radius[0],
            mapERP: point.erp[0],
            lat: parseLatLon(point.lat[0]),
            lon: parseLatLon(point.lon[0]),
        };

        properties = Object.assign(point, properties);

        geojson.features.push({
            type: "Feature",
            properties: properties,
            geometry: {
                type: "Point",
                coordinates: [properties.lon, properties.lat]
            }
        });
    }
    saveToFile(JSON.stringify(geojson), './dist/data/', collection + '.geojson');
}

function saveToFile(data, path, name) {
    fs.writeFile(path + name, data, 'utf8', function (err) {
        if (err) {
            return console.log(err);
        }
    });
}

function parseLatLon(coordinate = '') {
    let sign = 1;
    if (coordinate.match(/S|W/)) sign = -1;
    coordinate = coordinate.split(/N|S|W|E|'|"/);
    return (Number.parseFloat((parseInt(coordinate[0]) + parseInt(coordinate[1]) / 60 + parseInt(coordinate[2]) / 3600).toFixed(6)) * sign) || 0;
}

parseFiles()
