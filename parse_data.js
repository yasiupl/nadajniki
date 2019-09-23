
const danegovplAPI = 'https://api.dane.gov.pl/resources/19111';

const request = require('request');
const unzipper = require('unzipper');
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
        processData(json)
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
    let companies = 0;
    let masts = 0;

    let singles = [];
    let small = [];

    const customList = [
        { name: "Szkoły Wyższe", match: /\buniwersytet|\bpolitechnik|\bakademi|\bszkoła wyższa/, data: [] },
        { name: "Lasy Państwowe", match: /\bnadleśnictwo|\bnadlesnictwo|\blasy|\blasów/, data: [] },
        { name: "Parki Narodowe", match: /(\bpark).*(\bnarodowy)/, data: [] },
        { name: "Drogi", match: /\bdróg|\bdrogi|\bautostrad/, data: [] },
        { name: "Straż Miejska", match: /(\bstraż).*(\bmiejsk)/, data: [] },
        { name: "Straż Pożarna", match: /(\bstraż).*(\bpożar)|\bpożar/, data: [] },
        { name: "Pogotowie Ochotnicze", match: /(\bochotnicz).*(\bpogotow)/, data: [] },
        { name: "Pogotowie Lotnicze", match: /(\blotnicz).*(\bpogotow)/, data: [] },
        { name: "Pogotowie Ratunkowe", match: /\bpogotowi|\bszpital|\bopieki|\bopieka|\bnfz |\b zoz |\bratownictw|\bmedycyna/, data: [] },
        { name: "Sport", match: /\bsport|\bbieg/, data: [] },
        { name: "Taxi, Transport, Komunikacja", match: /\bkomunikacja|\bkomunikacji|\bkomunikacyj|\btramwaj|\bautobus|\btaxi|\btaksówk|\btransport|\bprzewoźnik|\bprzewóz osób/, data: [] },
        { name: "Kolej", match: /\bpkp|\bkolej|\brail|\b db /, data: [] },
        { name: "Wodociagi", match: /\bwodocią|\bwoda|\bwodno|\bwodo/, data: [] },
        { name: "Odpady", match: /\bodpad|\butyliza|\boczyszcza|\bkanaliza/, data: [] },
        { name: "Gospodarka Wodna", match: /\bgospodarki wodnej|(\bgospodar).*(\bwod)/, data: [] },
        { name: "Ciepłownie", match: /\bciepło|\bciepła|\bcieplne|\bcieplna/, data: [] },
        { name: "Elektrownie", match: /\belektrow|\benergety/, data: [] },
        { name: "Gazownictwo", match: /\bgazociąg|\bgazownictw/, data: [] },
        { name: "Wydobystwo", match: /\bkghm|\bkopalni|\bgórnict|\bwęgiel/, data: [] },
        { name: "Gminy", match: /\bgmina|\bgminy|\bgminna/, data: [] },
        { name: "Powiaty", match: /\bpowiat|\bstarost/, data: [] },
        { name: "Miasta", match: /\bmiasto|\bmiasta|\bmiejski|(\burząd).*(\bmiejsk|\bmiast)|\bprezydent|\bburmistrz/, data: [] },
        { name: "Województwa", match: /\bwojewoda|\bwojewództwo/, data: [] },
        { name: "Ochrona", match: /\bochrony|\bochrona|\bsecur|\bprotec|\bsolid|\bdetektyw|\b997|\bmienie|\bmienia|\binterwencj/, data: [] },
        { name: "Lotnictwo", match: /\bairport|\blotnis|\blotnicz/, data: [] },
        { name: "Porty", match: /\bport|\bmorski/, data: [] },
        { name: "Kultura", match: /\bmuzeum|\bmuzea|\bteatr|\bfilharmon|\bkultur/, data: [] },
        { name: "Banki", match: /\bbank/, data: [] },
        { name: "Lotos", match: /\blotos/, data: [] },
        /*{ name: "PGE", match: /\bpge/, data: [] },
        { name: "Tauron", match: /\btauron/, data: [] },
        { name: "Energa", match: /\benerga/, data: [] },
        { name: "Telewizja", match: /\btvp|\btelewizja/, data: [] },
        { name: "Działalność Osobowa", match: /\bpod nazwą|\bpod firmą|\bprowadzący/, data: [] },
        { name: "Spółka z o.o.", match: /(\bsp.|\bsp ).*(\bz o.o|\bz o. o|\bz  o. o|\bz  o.o)|\bspółka z ograniczoną odpowiedzialnością/, data: [] },
        { name: "Spółka Akcyjna.", match: /\bs.a|\bspółka akcyjna|\bs. a.|\b sa/, data: [] }*/
    ];

    let sources = [];
    let geojson = {};

    for (let i in json) {
        let company = json[i];
        let towers = [];
        companyLoop:
        for (let j in company) {
            countAll++;
            let tower = company[j];

            for (let k in customList) {
                let list = customList[k];
                if (tower.op[0].toLowerCase().match(list.match)) {
                    list.data.push(tower);
                    continue companyLoop
                };
            }

            let companyLength = Object.keys(company).length;
            if (companyLength > treshold) {
                towers.push(tower);
            } else if (companyLength > 1) {
                small.push(tower);
            } else singles.push(tower);

        }
        if (towers.length) {
            console.log(i + ': ' + towers.length);

            companies++;
            masts += towers.length;

            let hashedName = crypto.createHash('md5').update(i.replace(/["|'|-|_|/|\|.|,| ]/g, "_")).digest('hex');
            sources.push({ length: towers.length, name: i, hash: hashedName });
            saveJSONToFile(parseToGeoJSON(towers), './dist/data/', hashedName + '.geojson');
        }
    }

    for (let k in customList) {
        let list = customList[k];
        let filename = list.name.toLowerCase().replace(/["|'|-|_|/|\|.|,| ]/g, "_").replace("__", "_");
        console.log(list.name + ': ' + list.data.length);
        sources.push({ length: list.data.length, name: list.name, hash: filename });
        saveJSONToFile(parseToGeoJSON(list.data), './dist/data/', filename + '.geojson');
    }

    console.log('\nFirm: ' + Object.keys(json).length)
    console.log('Firm spełniających kryterium: ' + companies);
    console.log('Nadajników spełniających kryterium: ' + masts);
    console.log('Małe sieci: ' + small.length);
    console.log('Pojedyńcze nadajniki: ' + singles.length);
    console.log('Unikalnych punktów: ' + countAll);

    sources.push({ length: singles.length, name: 'Pojedyńcze', hash: 'singles' });
    sources.push({ length: small.length, name: 'Małe sieci', hash: 'small' });
    sources.sort((a, b) => (a.length < b.length) ? 1 : -1);
    saveJSONToFile(sources, './src/', 'sources.json');

    saveJSONToFile(parseToGeoJSON(singles), './dist/data/', 'singles.geojson');
    saveJSONToFile(parseToGeoJSON(small), './dist/data/', 'small.geojson');
}

function parseToGeoJSON(data) {

    let geojson = {
        "type": "FeatureCollection",
        "features": []
    }

    for (let i in data) {
        let point = data[i];

        let mapProperties = {
            id: crypto.createHash('md5').update(point.name + point.lat + point.lon).digest('hex'),
            name: point.name[0],
            op: point.op[0],
            tx: point.tx.join(', '),
            networkType: point.networkType[0],
            mapRadius: point.radius[0],
            mapERP: point.erp[0],
            mapLat: parseLatLon(point.lat[0]),
            mapLon: parseLatLon(point.lon[0]),
        };

        
        geojson.features.push({
            type: "Feature",
            properties: mapProperties,
            geometry: {
                type: "Point",
                coordinates: [parseLatLon(point.lon[0]), parseLatLon(point.lat[0])]
            }
        });


        point.id = mapProperties.id
        point.mapLat = mapProperties.mapLat
        point.mapLon = mapProperties.mapLon

        saveJSONToFile(point, './dist/data/points/', mapProperties.id + '.json');
    }

    return geojson
}

function saveJSONToFile(data, path, name) {
    fs.writeFile(path + name, JSON.stringify(data), 'utf8', function (err) {
        if (err) {
            return console.log(err);
        }
    });
}

function parseLatLon(coordinate = '') {
    let sign = 1;
    if (coordinate.match(/S|W/)) sign = -1;
    coordinate = coordinate.split(/N|S|W|E|'|"/);
    return Number.parseFloat((parseInt(coordinate[0]) + parseInt(coordinate[1]) / 60 + parseInt(coordinate[2]) / 3600).toFixed(6)) * sign;
}

function searchAndDestroy() {
    // Download and unzip 
    if (fs.existsSync('data')) {
        parseFiles()
    } else {
        console.log("Pobieram dane z " + danegovplAPI);
        request({ url: danegovplAPI, json: true }, function (error, response, body) {
            const source = body.data.attributes.file_url;
            console.log("Pobieram dane z " + source);
            request(source).pipe(unzipper.Extract({ path: path.resolve(__dirname, 'data') })).on('finish', parseFiles);
        });
    }
}

searchAndDestroy();