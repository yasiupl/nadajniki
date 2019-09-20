const source = 'https://api.dane.gov.pl/media/resources/20140430/wykaz_pozwolen_rrl.zip';

const request = require('request');
const unzipper = require('unzipper');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx-extractor');

const parseFiles = function () {
    console.log("Przetwarzanie")

    let json = {}

    fs.readdir(path.join(__dirname, 'data'), function (err, files) {
        files.forEach(function (file) {
            xlsx.extractAll('./data/' + file)
                .then((sheets) => {
                    json = parseToJSON(sheets, json);
                    parseToGeoJSON(json);
                })
                .catch((err) => console.log(err));
        });
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
            
            
            
            //agregate points in the same place
            let id = (row[5] + row[6]).split(/N|S|W|E|'|"/).join(''); // could agregate points in different hemispheres (we work just on Poland, so doesnt matter)
            json[id] = json[id] || [];

            for (let k in row) {
                property = propertiesSlugs[k];
                json[id][property] = json[id][property] || [];
                //compare with last property, if its different, add it.
                if (json[id][property].indexOf(row[k]) == -1) {
                    json[id][property].push(row[k])
                } else continue;
            }
        }
        fs.writeFile('./dist/data/data.json', JSON.stringify(json), 'utf8', function (err) {
            if (err) {
                return console.log(err);
            }
        });
        return json
    }
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
        properties.mapRadius = parseInt(Array.isArray(row.radius)? row.radius[0] : row.radius);
        properties.mapERP = parseInt(Array.isArray(row.erp)? row.erp[0] : row.erp);

        geojson.features.push({
            "type": "Feature",
            "properties": properties,
            "geometry": {
                "type": "Point",
                "coordinates": [parseLatLon(properties.lat), parseLatLon(properties.lon)]
            }
        });

    }

    console.log('Prztworzono punktów: ' + geojson.features.length)
    fs.writeFile('./dist/data/data.geojson', JSON.stringify(geojson), 'utf8', function (err) {
        if (err) {
            return console.log(err);
        }
    });
    return geojson
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