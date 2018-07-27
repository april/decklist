#!/bin/sh

set -e

# Clean up a bit
rm -f -- *.js *.zip

curl http://mtgjson.com/json/AllCards-x.json.zip > AllCards-x.json.zip
unzip AllCards-x.json.zip

# Parse out the giant JSON and make a much smaller one
./parsecards.py

# Minify
uglifyjs decklist-cards.js -c -m -o decklist-cards-min.js

# Clean up a bit
rm AllCards* decklist-cards.js
