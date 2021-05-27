#!/usr/bin/env python3

import json

# Just FYI!
# b (banned) = [sml] (standard, modern, legacy)
# c (color) = White = A, Blue = B, Black = C, Red = D, Green = E, Gold = F, Artifact = G , Split = S, Unknown = X, Land = Z
# m (CMC) = N  (Split = 98, Land = 99)
# n (actual name) = 'true name nemesis' to 'True Name Nemesis'
# t (type) = 1 = land, 2 = creature, 3 = instant or sorcery 4 = other

FORMATS = ('standard', 'modern', 'legacy')

def getLegalities(face):
    # Let's figure out legalities
    banned = 'sml'

    for format in FORMATS:
        if face.get('legalities', {}).get(format) == 'Legal':
            banned = banned.replace(format[0].lower(), '')

    return(banned)

# Open the JSON file
jsonfh = open("AtomicCards.json", "r")

# Load all the cards into a giant dictionary
cards = json.load(jsonfh)

# Gotta store these cards in a dictionary
ocards = {}

# Okay, we need the colors but in a much shorter format
for card in cards["data"].values():
    # We only care about the first face
    face = card[0]
    is_flip = face["layout"] in ("transform", "modal_dfc")

    # We're going to store them in lowercase
    ocard = face["faceName" if is_flip else "name"].lower()

    # Python's Unicode support sucks, as does everybodies.  Manually
    # replace the Ae to lower case
    ocard = ocard.replace(u'\xc6', u'\xe6')

    # Skip tokens
    if face['layout'] == 'token':
        continue

    # Create an entry in the output dictionary
    ocards[ocard] = {}

    # Lands and (noncolored) artifacts are special
    if 'Land' in face['types']:
        ocards[ocard]['c'] = 'Z' # Sort lands last
    elif (('Artifact' in face['types']) and ('colors' not in face)):
        ocards[ocard]['c'] = 'G'

    # Make the colors shorter
    if ('colors' not in face): pass
    elif len(face['colors']) > 1:      ocards[ocard]['c'] = 'F'    # gold
    elif face['colors'] == ['White']:  ocards[ocard]['c'] = 'A'
    elif face['colors'] == ['Blue']:   ocards[ocard]['c'] = 'B'
    elif face['colors'] == ['Black']:  ocards[ocard]['c'] = 'C'
    elif face['colors'] == ['Red']:    ocards[ocard]['c'] = 'D'
    elif face['colors'] == ['Green']:  ocards[ocard]['c'] = 'E'

    if   'Land'     in face['types']:  ocards[ocard]['t'] = '1'
    elif 'Creature' in face['types']:  ocards[ocard]['t'] = '2'
    elif 'Sorcery'  in face['types']:  ocards[ocard]['t'] = '3'
    elif 'Instant'  in face['types']:  ocards[ocard]['t'] = '3'
    else:                              ocards[ocard]['t'] = '4'

    # Now try to deal with CMC
    if 'convertedManaCost' not in face: ocards[ocard]['m'] = 99
    else: ocards[ocard]['m'] = face['convertedManaCost']

    # Add it into the file if the banned list isn't empty
    legality = getLegalities(face)
    if legality != "": ocards[ocard]['b'] = legality

    # And put the true name in there as well
    ocards[ocard]['n'] = face["faceName" if is_flip else "name"]

    # Now to handle split cards (ugh)
    if ' // ' in ocard:
        ocards[ocard]['c'] = 'S'
        ocards[ocard]['m'] = 98

    # if 'names' in face:
    #     name = " // ".join(face['names'])
    #     ocard = name.lower().replace(u'\xc6', u'\xe6')   # Just like a real card
    #
    #     ocards[ocard] = {}
    #     ocards[ocard]['c'] = 'S'
    #     ocards[ocard]['m'] = 98
    #     ocards[ocard]['n'] = name
    #
    #     legality = getLegalities(face)
    #     if legality != "": ocards[ocard]['b'] = legality


# Print out the full list of cards
ojsonfh = open("decklist-cards.js", "w")
ojsonfh.write('cards=')
json.dump(ocards, ojsonfh)
ojsonfh.close()
