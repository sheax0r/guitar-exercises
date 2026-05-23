.PHONY: dev install build test check preview clean

dev:
	npm run dev

install:
	npm install

build:
	npm run build

test:
	npm test

check:
	npm run check

preview:
	npm run preview

clean:
	rm -rf dist node_modules
