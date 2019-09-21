const source = 'https://api.dane.gov.pl/media/resources/20140430/wykaz_pozwolen_rrl.zip';

const request = require('request');
const unzipper = require('unzipper');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx-extractor');
const crypto = require('crypto');

 const parseFiles = function () {
    console.log("Przetwarzanie")

    let json = {}

    fs.readdir(path.join(__dirname, 'data'), async function (err, files) {
        for(const file of files) {
            await xlsx.extractAll('./data/' + file)
                .then((sheets) => {
                    json = parseToJSON(sheets, json);
                })
                .catch((err) => console.log(err));
        }
        saveToFiles(json)
    });
    
}

const parseToJSON = function (sheets, json) {
    for (let i in sheets) {

        let sheet = sheets[i];

        console.log(sheet.name);
        console.log('Rekordów:' + sheet.cells.length);

        for (let j in sheet.cells) {

            if (j == 0) continue
            row = sheet.cells[j];

            let propertiesSlugs = ['id', 'date', 'name', 'stationType', 'networkType', 'lat', 'lon', 'radius', 'location', 'erp', 'azimuth', 'elevation', 'polarization', 'gain', 'antennaHeight', 'groundHeight', 'horizontalCharacteristic', 'verticalCharacteristic', 'tx', 'rx', 'txSpan', 'rxSpan', 'op', 'opAdress'];

            //agregate points in the same place, owned by the same company
            let op = row[22]
            let tower = (row[5] + row[6]).split(/N|S|W|E|'|"/).join(''); // could agregate points in different hemispheres (we work just on Poland, so doesnt matter)
            
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

const saveToFiles = function (json) {

    // Dla jakiej minimalnej ilości nadajników rozdzielić firmę do osobnego pliku.
    const treshold = 10;

    let countAll = 0;
    let companies = 0;
    let masts = 0;

    let singles = [];
    let small = [];
    let fileNames = {};
    let geojson = {};

    for(let i in json) {
        let company = json[i];
        let towers = [];
        for(let j in company) {
            countAll++;
            let tower = company[j];
            if(Object.keys(company).length > treshold) {
                towers.push(tower);
            } else if(Object.keys(company).length > 1) {
                small.push(tower);
            } else singles.push(tower);
        }
        if(towers.length) {
            console.log(i + ': ' + towers.length);

            companies++;
            masts += towers.length;
            
            let hash = crypto.createHash('md5').update(i.replace(/["|'|-|_|/|\|.| ]/g, "_")).digest('hex');
            fileNames[hash] = '[' + towers.length + '] ' + i; 
            saveJSONToFile(parseToGeoJSON(towers), './dist/data/', hash + '.geojson');
        }
    }

    console.log('Firm: ' + Object.keys(json).length)
    console.log('Firm spełniających kryterium: ' + companies);
    console.log('Nadajników spełniających kryterium: ' + masts);
    console.log('Małe sieci: ' + small.length);
    console.log('Pojedyńcze nadajniki: ' + singles.length);
    console.log('Unikalnych punktów: ' + countAll);

    fileNames['singles'] = '[' + singles.length + '] Pojedyńcze';
    fileNames['small'] = '[' + small.length + '] Małe sieci';
    saveJSONToFile(fileNames, './src/','sources.json');

    saveJSONToFile(parseToGeoJSON(singles), './dist/data/', 'singles.geojson');
    saveJSONToFile(parseToGeoJSON(small), './dist/data/', 'small.geojson');
}

const parseToGeoJSON = function (data) {

    let geojson = {
        "type": "FeatureCollection",
        "features": []
    }

    for (let i in data) {
        let row = data[i]

        let properties = {}

        for (let j in row) {
            properties[j] = row[j].join(', ');
        }


        //Mapbox spłaszcza parametry, i nie możemy działać na tablicach :/
        properties.mapRadius = parseInt(Array.isArray(row.radius) ? row.radius[0] : row.radius);
        properties.mapERP = parseInt(Array.isArray(row.erp) ? row.erp[0] : row.erp);

        geojson.features.push({
            "type": "Feature",
            "properties": properties,
            "geometry": {
                "type": "Point",
                "coordinates": [parseLatLon(properties.lat), parseLatLon(properties.lon)]
            }
        });

    }
    return geojson
}

const saveJSONToFile = function (data, path, name) {
    fs.writeFile(path + name, JSON.stringify(data), 'utf8', function (err) {
        if (err) {
            return console.log(err);
        }
    });
}

const parseLatLon = function (coordinate = '') {
    let sign = 1;
    if (coordinate.match(/S|W/)) sign = -1;
    coordinate = coordinate.split(/N|S|W|E|'|"/);
    return Number.parseFloat((parseInt(coordinate[0]) + parseInt(coordinate[1]) / 60 + parseInt(coordinate[2]) / 3600).toFixed(6)) * sign;
}

// Download and unzip 
if (fs.existsSync('data')) {
    parseFiles()
} else {
    console.log("Pobieram dane z " + source);
    request(source).pipe(unzipper.Extract({ path: path.resolve(__dirname, 'data') })).on('finish', parseFiles);
}