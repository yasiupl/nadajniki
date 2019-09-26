deploy: install build-data upload-data build 

install:
	npm ci

serve: 
	node_modules/.bin/webpack-dev-server

build-data:
	rm -f ./src/sources.json
	rm -rf ./dist/data/
	mkdir -p ./dist/data/
	node parse_data.js

upload-data:
	node mapbox.js

build:
	node_modules/.bin/webpack 