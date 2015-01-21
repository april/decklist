#!/usr/bin/env python

import json

# Just FYI!
# White = A, Blue = B, Black = C, Red = D, Green = E, Gold = F, Artifact = G , Unknown = X, Land = Z


# Open the JSON file
jsonfh = open("AllCards.json", "r")

# Load all the cards into a giant dictionary
cards = json.load(jsonfh)

# Gotta store these cards in a dictionary
ocards = {}

# Okay, we need the colors but in a much shorter format
for card in cards:

	# We're going to store them in lowercase
	ocard = card.lower()

	# Python's Unicode support sucks, as does everybodies.  Manually
	# replace the Ae to lower case
	ocard = ocard.replace(u'\xc6', u'\xe6')

	# Skip tokens
	if cards[card]['layout'] == 'token': continue

	# Create an entry in the output dictionary
	ocards[ocard] = {}

	# Lands and (noncolored) artifacts are special
	if 'Land' in cards[card]['types']:
		ocards[ocard]['c'] = 'Z' # Sort lands last
	elif (('Artifact' in cards[card]['types']) and ('colors' not in cards[card])):
		ocards[ocard]['c'] = 'G'

	# Make the colors shorter
	if ('colors' not in cards[card]): pass
	elif len(cards[card]['colors']) > 1:      ocards[ocard]['c'] = 'F'    # gold
	elif cards[card]['colors'] == ['White']:  ocards[ocard]['c'] = 'A'
	elif cards[card]['colors'] == ['Blue']:   ocards[ocard]['c'] = 'B'
	elif cards[card]['colors'] == ['Black']:  ocards[ocard]['c'] = 'C'
	elif cards[card]['colors'] == ['Red']:    ocards[ocard]['c'] = 'D'
	elif cards[card]['colors'] == ['Green']:  ocards[ocard]['c'] = 'E'

	# Now try to deal with CMC
	if 'cmc' not in cards[card]: ocards[ocard]['m'] = 99
	else: ocards[ocard]['m'] = cards[card]['cmc']

	# And put the true name in there as well
	ocards[ocard]['n'] = card

# Print out the full list of cards
ojsonfh = open("decklist-cards.js", "w")
ojsonfh.write('cards=')
json.dump(ocards, ojsonfh)
ojsonfh.close()
