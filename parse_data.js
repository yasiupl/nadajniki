const source = 'https://api.dane.gov.pl/media/resources/20140430/wykaz_pozwolen_rrl.zip';

const request = require('request');
const unzipper = require('unzipper');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx-extractor');

const parseFiles = function () {
    console.log("Przetwarzanie")
    let geojson = {
        "type": "FeatureCollection",
        "features": []
    }
    fs.readdir(path.join(__dirname, 'data'), function (err, files) {
        files.forEach(function (file) {
            xlsx.extractAll('./data/' + file)
                .then((sheets) => parseToGeoJSON(sheets, geojson))
                .catch((err) => console.log(err));
        });
    });
}

const parseToGeoJSON = function (sheets, json) {
    for (let i in sheets) {
        let sheet = sheets[i];
        console.log(sheet.name);
        console.log('Rekordów:' + sheet.cells.length);

        for (let j in sheet.cells) {
            if (j == 0) continue
            row = sheet.cells[j];
            json.features.push({
                "type": "Feature",
                "properties": row,
                "geometry": {
                    "type": "Point",
                    "coordinates": [parseLatLon(row[5]), parseLatLon(row[6])]
                }
            })
        }
        fs.writeFile('./src/data/' + sheet.name.split('q_')[1] + '.json', JSON.stringify(json), 'utf8', function (err) {
            if (err) {
                return console.log(err);
            }
        });
    }
}


const parseLatLon = function (coordinate = '') {
    let sign = 1;
    if (coordinate.match(/S|W/)) sign = -1;
    coordinate = coordinate.split(/N|S|W|E|'|"/);
    return (parseInt(coordinate[0]) + parseInt(coordinate[1]) / 60 + parseInt(coordinate[2]) / 3600) * sign;
}

// Download and unzip 
if (fs.existsSync('data')) {
    parseFiles()
} else {
    console.log("Pobieram dane z " + source);
    request(source).pipe(unzipper.Extract({ path: path.resolve(__dirname, 'data') })).on('finish', parseFiles);
}