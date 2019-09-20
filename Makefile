deploy: install build-data build 

install:
	npm ci

serve: 
	node_modules/.bin/webpack-dev-server

build-data:
	mkdir -p ./dist/data
	node parse_data.js

build:
	node_modules/.bin/webpack 