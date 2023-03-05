deploy: install build-data upload-data build 

install:
	npm install

serve: 
	node_modules/.bin/webpack-dev-server

build-data:
	rm -f ./src/sources.json
	rm -rf ./dist/data/
	mkdir -p ./dist/data/
	mkdir -p data
	cd data && bash ../fetch_data.sh
	node parse_data.js

upload-data:
	node mapbox.js

build:
	node_modules/.bin/webpack 