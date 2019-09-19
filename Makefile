install:
	npm install

build: install build-data
	node_modules/.bin/webpack 

serve: install
	node_modules/.bin/webpack-dev-server

build-data:
	node parse_data.js