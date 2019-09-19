install:
	npm ci

build: build-data
	node_modules/.bin/webpack 

deploy: install build

serve: 
	node_modules/.bin/webpack-dev-server

build-data:
	node parse_data.js