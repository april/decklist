#!/bin/sh

# Clean up a bit
rm *.js

curl http://mtgjson.com/json/AllCards-x.json.zip > AllCards-x.json.zip
unzip AllCards-x.json.zip

# Parse out the giant JSON and make a much smaller one
./parsecards.py

# Minify
java -jar ../../tools/yuicompressor-2.4.8.jar -o '.js$:-min.js' *.js

# Clean up a bit
rm AllCards*
rm decklist-cards.js
