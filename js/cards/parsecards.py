#!/usr/bin/env python3

import json

# Just FYI!
# b (banned) = [sml] (standard, modern, legacy)
# c (color) = White = A, Blue = B, Black = C, Red = D, Green = E, Gold = F, Artifact = G , Split = S, Unknown = X, Land = Z
# m (CMC) = N  (Split = 98, Land = 99)
# n (actual name) = 'true name nemesis' to 'True Name Nemesis'
# t (type) = 1 = land, 2 = creature, 3 = instant or sorcery 4 = other

FORMATS = {
    'standard': 's',
    'modern': 'm',
    'legacy': 'l'
}

def getLegalities(card, cards):
    # Let's figure out legalities
    banned = 'sml'

    for gameformat, abbrevation in FORMATS.items():
        if cards[card].get('legalities', {}).get(gameformat) == 'Legal':
            banned = banned.replace(abbrevation, '')

    return(banned)

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
    elif len(cards[card]['colors']) > 1:  ocards[ocard]['c'] = 'F'    # gold
    elif cards[card]['colors'] == ['W']:  ocards[ocard]['c'] = 'A'
    elif cards[card]['colors'] == ['U']:  ocards[ocard]['c'] = 'B'
    elif cards[card]['colors'] == ['B']:  ocards[ocard]['c'] = 'C'
    elif cards[card]['colors'] == ['R']:  ocards[ocard]['c'] = 'D'
    elif cards[card]['colors'] == ['G']:  ocards[ocard]['c'] = 'E'

    if   'Land'     in cards[card]['types']:  ocards[ocard]['t'] = '1'
    elif 'Creature' in cards[card]['types']:  ocards[ocard]['t'] = '2'
    elif 'Sorcery'  in cards[card]['types']:  ocards[ocard]['t'] = '3'
    elif 'Instant'  in cards[card]['types']:  ocards[ocard]['t'] = '3'
    else:                                     ocards[ocard]['t'] = '4'

    # Now try to deal with CMC
    if 'convertedManaCost' not in cards[card]: ocards[ocard]['m'] = 99
    else: ocards[ocard]['m'] = cards[card]['convertedManaCost']

    # Add it into the file if the banned list isn't empty
    legality = getLegalities(card, cards)
    if legality != "": ocards[ocard]['b'] = legality

    # And put the true name in there as well
    ocards[ocard]['n'] = card

    # Now to handle split cards (ugh)
    if 'names' in cards[card]:
        name = " // ".join(cards[card]['names'])
        ocard = name.lower().replace(u'\xc6', u'\xe6')   # Just like a real card

        ocards[ocard] = {}
        ocards[ocard]['c'] = 'S'
        ocards[ocard]['m'] = 98 
        ocards[ocard]['n'] = name

        legality = getLegalities(card, cards)
        if legality != "": ocards[ocard]['b'] = legality


# Print out the full list of cards
ojsonfh = open("decklist-cards.js", "w")
ojsonfh.write('cards=')
json.dump(ocards, ojsonfh)
ojsonfh.close()
