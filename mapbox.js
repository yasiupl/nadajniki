const APIkey = process.env.MAPBOX_UPLOAD_KEY
const APIuser = process.env.MAPBOX_USER

const sources = require("./src/sources.json");

const AWS = require('aws-sdk');
const mbxUploads = require('@mapbox/mapbox-sdk/services/uploads');
const fs = require('fs');
const uploadsClient = mbxUploads({
    accessToken: APIkey
});

const date = new Date();

const getCredentials = () => {
    return uploadsClient
        .createUploadCredentials()
        .send()
        .then(response => response.body);
}

const putFileOnS3 = (credentials) => {
    const s3 = new AWS.S3({
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
        region: 'us-east-1'
    });
    return s3.putObject({
        Bucket: credentials.bucket,
        Key: credentials.key,
        Body: fs.createReadStream('./dist/data/all.geojson')
    }).promise();
};

async function fireAndForget() {

    const credentials = await getCredentials();

    console.log("Uploading to S3...")
    await putFileOnS3(credentials).catch((e) => console.log(e));

    console.log("Processing...")
    await uploadsClient.createUpload({
            mapId: `${APIuser}.nadajniki-${date.getFullYear()}-${date.getMonth()}`,
            url: credentials.url
        })
        .send().catch((e) => console.log(e)).then(response => {
            console.log(response.body);
            sources.uploadedTileset = response.body.tileset;
            fs.writeFile('./src/sources.json', JSON.stringify(sources), 'utf8', function (err) {
                if (err) {
                    return console.log(err);
                }
            });
            return response.body;
        });
}


fireAndForget();