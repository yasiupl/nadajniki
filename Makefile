deploy: install download-data build-data upload-data build 

install:
	# nvm install 14
	# nvm use 14
	npm install

serve: 
	node_modules/.bin/webpack-dev-server

download-data:
	rm -f ./src/sources.json
	rm -rf ./dist/data/
	mkdir -p ./dist/data/
	mkdir -p data
	cd data && bash ../fetch_data.sh

build-data:
	node parse_data.js

upload-data:
	node mapbox.js

build:
	node_modules/.bin/webpack 