const APIkey = process.env.MAPBOX_UPLOAD_KEY
const APIuser = process.env.MAPBOX_USER || "yasiu"
const COMMIT = process.env.COMMIT_REF || "testing"

const sources = require("./src/sources.json");
const AWS = require('aws-sdk');
const mbxUploads = require('@mapbox/mapbox-sdk/services/uploads');
const fs = require('fs');
const uploadsClient = mbxUploads({ accessToken: APIkey });

const date = new Date();

const getCredentials = () => {
    return uploadsClient
        .createUploadCredentials()
        .send()
        .then(response => response.body)
        .catch(error => {
            console.error("Error getting credentials:", error);
            throw error;
        });
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
    try {
        await putFileOnS3(credentials);
    } catch (e) {
        console.log("Error uploading to S3:", e);
        return;
    }

    console.log("Processing...")
    const shortCommit = COMMIT.slice(0, 8);
    const name = `${APIuser}.nadajniki-${date.getFullYear()}-${date.getMonth() + 1}_${shortCommit}`;
    console.log("Tileset name:", name);

    await uploadsClient.createUpload({
        tileset: name,
        url: credentials.url,
        name: name
    }).send().catch((e) => console.log(e)).then(response => {
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