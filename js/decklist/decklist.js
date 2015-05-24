// Try to gracefully parse as many decks as possible
// Parsing data is like the worst
function parseDecklist() {
  deckmain = $('#deckmain').val();
  deckside = $('#deckside').val();

  // Let's store the lists in a tidy little array
  maindeck = [];
  sideboard = [];

  // And let's store their counts for future reference
  maindeck_count = 0;
  sideboard_count = 0;

  // Track unrecognized cards and lines that can't be parsed.
  // (encoded to prevent XSS)
  unrecognized = {};
  unparseable = [];

  // Stop processing the function if there's no main deck
  if (deckmain == '') { return (null, null); }

  // Split main deck and sideboard by newlines
  deckmain = deckmain.split('\n');
  deckside = deckside.split('\n');


  var mtgoRE   = /^(\d+)x*\s(.+)/;             // MTGO deck format (4 Brainstorm) also TCG (4x Brainstorm)
  var mtgosbRE = /^SB:\s+(\d+)\s(.+)/;       // Sideboard lines begin with SB:
  var mwsRE    = /^\s*(\d+)\s+\[.*\]\s+(.+)/;       // MWS, what an ugly format
  var mwssbRE  = /^SB:\s*(\d+)\s+\[.*\]\s(.+)/;  // MWS, what an ugly format
  var tosbRE   = /^Sideboard/;                 // Tappedout looks like MTGO, except sideboard begins with Sideboard:  Salvation, same, but no colon

  // Loop through all the cards in the main deck field
  in_sb = false;
  for (i = 0; i < deckmain.length; i++) {
    // Parse for Magic Workstation style deck
    if (mwsRE.exec(deckmain[i]) != null) {
      quantity = mwsRE.exec(deckmain[i])[1];
      card = mwsRE.exec(deckmain[i])[2];

      recognizeCard(card, quantity);
    }

    // Parse for Magic Workstation sideboards
    else if (mwssbRE.exec(deckmain[i]) != null) {
      quantity = mwssbRE.exec(deckmain[i])[1];
      card = mwssbRE.exec(deckmain[i])[2];

      recognizeCard(card, quantity, 'side');
    }

    // Parse for MTGO/TappedOut style decks
    else if (mtgoRE.exec(deckmain[i]) != null) {
      quantity = mtgoRE.exec(deckmain[i])[1];
      card = mtgoRE.exec(deckmain[i])[2];

      if (in_sb) {  // TappedOut style Sideboard listing
        recognizeCard(card, quantity, 'side');
      } else {
        recognizeCard(card, quantity);
      }
    }

    // Parse for MTGO style sideboard cards
    else if (mtgosbRE.exec(deckmain[i]) != null) {
      quantity = mtgosbRE.exec(deckmain[i])[1];
      card = mtgosbRE.exec(deckmain[i])[2];

      recognizeCard(card, quantity, 'side');
    }

    // If we see 'Sideboard:', then we're in the TappedOut style sideboard entries from now on
    else if (tosbRE.test(deckmain[i])) { in_sb = true; }

    // Could not be parsed, store in appropriate array
    else {
      addUnparseable(deckmain[i]);
    }
  }

  // Now we get to do the same for the sideboard, but we only have to worry about TCG/MTGO style entries
  for (i = 0; i < deckside.length; i++) {
    // Parse for MTGO/TappedOut style decks
    if (mtgoRE.exec(deckside[i]) != null) {
      quantity = mtgoRE.exec(deckside[i])[1];
      card = mtgoRE.exec(deckside[i])[2];

      recognizeCard(card, quantity, 'side');
    } else {
      // Could not be parsed, store in appropriate array
      addUnparseable(deckside[i]);
    }
  }

  // Now we need to sort the deck lists, with the sideboard always being sorted alphabetically
  if ( $('#sortorderfloat input[name=sortorder]:checked').prop('id') == 'sortorder1' ) { // alpabetical
    maindeck = sortDecklist(maindeck, 'alphabetically');
    sideboard = sortDecklist(sideboard, 'alphabetically');
  }
  else if ( $('#sortorderfloat input[name=sortorder]:checked').prop('id') == 'sortorder2' ) { // CMC
    maindeck = sortDecklist(maindeck, 'cmc');
    sideboard = sortDecklist(sideboard, 'alphabetically');
  }
  else if ( $('#sortorderfloat input[name=sortorder]:checked').prop('id') == 'sortorder3' ) { // color
    maindeck = sortDecklist(maindeck, 'color');
    sideboard = sortDecklist(sideboard, 'alphabetically');
  }
  else if ( $('#sortorderfloat input[name=sortorder]:checked').prop('id') == 'sortorder4' ) { // numeric
    maindeck = sortDecklist(maindeck, 'numerically');
    sideboard = sortDecklist(sideboard, 'alphabetically');
  }

  // Check the card name against the card database. If it exists, add it to the
  // appropriate list (main or side), otherwise add it to the unrecognized map.
  function recognizeCard(card, quantity, list) {
    list = list || 'main';

    if (card.slice(0,2).toLowerCase() === 'ae') { recognized = objectHasPropertyCI(cards, '\u00e6'+card.slice(2)); }
    else { recognized = objectHasPropertyCI(cards, card); }

    // Always add the card to the list, regardless of if the card is recognized
    // Still, if not recognized, add it to its special dictionary (unrecognized)

    if (recognized) { list_add(list, recognized, quantity); }
    else {
      list_add(list, card, quantity);
      unrecognized[htmlEncode(card)] = 1;
    }
  }

  // add the passed string to the unparseable array if it isn't empty or entirely whitespace
  function addUnparseable(line) {
    // only store if it's not a falsey value (empty string, etc.)
    // or entirely composed of whitespace
    if (htmlEncode(line) && !htmlEncode(line).match(/^\s+$/)) {
      unparseable.push(htmlEncode(line));
    }
  }

  // Case-insensitive property search, modified from:
  // http://stackoverflow.com/a/12484507/540162
  // Returns property value (properly-capitalized card name) if found, false otherwise
  function objectHasPropertyCI(obj, val) {
    for (var p in obj) {
      if (obj.hasOwnProperty(p) && p.toLowerCase() === val.toLowerCase()) {
        return obj[p].n;
      }
    }
    return false;
  }
}

function sortDecklist(deck, sortorder) {

  // Sort the decklist alphabetically, if chosen
  if ( sortorder == 'alphabetically' ) {

    // Add a case insensitive field to sort by
    for (i = 0; i < deck.length; i++) { deck[i] = [ deck[i][0].toLowerCase(), deck[i][0], deck[i][1] ]; }

    deck.sort();

    // After sorting is done, we can remove the lower case index
    for (i = 0; i < deck.length; i++) { deck[i] = deck[i].splice(1, 2); }
  }

  // Sort the decklist by color, if chosen
  // White = A, Blue = B, Black = C, Red = D, Green = E, Gold = F, Artifact = G , Unknown = X, Land = Z
  else if ( sortorder == 'color' ) {
    var color_to_cards = {};

    for (i = 0; i < deck.length; i++) {

      // We're going to search by lower case
      var lcard = deck[i][0].toLowerCase();

      // Grab the card's color
      if (lcard in cards) { color = cards[ lcard ]['c']; }
      else { color = 'X'; } // Unknown

      // Create the color subarray
      if ( !(color in color_to_cards ) ) { color_to_cards[color] = []; }

      // Fix the Aetherling issue until the PDF things supports it
      lcard = lcard.replace('\u00c6', 'Ae').replace('\u00e6', 'ae');
      deck[i][0] = deck[i][0].replace('\u00c6', 'Ae').replace('\u00e6', 'ae');

      // Add the card to that array, including lower-case (only used for sorting)
      color_to_cards[color].push( [ lcard, deck[i][0], deck[i][1] ] );

    }

    // Get the list of colors in the deck
    color_to_cards_keys = Object.keys(color_to_cards).sort();

    // Sort each subcolor, then append them to the final array
    deck = []
    for (i = 0; i < color_to_cards_keys.length; i++) {
      // Push a blank entry onto deck (to separate colors)
      // unless the deck is empty
      if (deck.length !== 0) {
        deck.push(['', 0]);
      }

      color = color_to_cards_keys[i];

      color_to_cards[ color ].sort();   // color_to_cards['A']

      for (j = 0; j < color_to_cards[color].length; j++) {
        card = color_to_cards[color][j][1];
        quantity = color_to_cards[color][j][2];

        deck.push([card, quantity]);
      }
    }

    // We must clear out the 32nd entry, if it's blank, as it's at the top of the 2nd column
    if (deck.length > 31) {
      if (deck[31][1] == 0) {
        deck.splice(31, 1);
      }
    }
  }

  // Sort the decklist by CMC, if chosen
  else if ( sortorder == 'cmc' ) {
    var cmc_to_cards = {}

    for (i = 0; i < deck.length; i++) {

      // We're going to search by lower case
      var lcard = deck[i][0].toLowerCase();

      // Grab the card's cmc
      if (lcard in cards) { cmc = cards[ lcard ]['m']; }
      else { cmc = 100; } // Unknown

      // Convert the CMC to a string, and pad zeroes (grr Javascript)
      cmc = cmc.toString();
      if ( cmc.length == 1 ) { cmc = '00' + cmc; }
      if ( cmc.length == 2 ) { cmc = '0' + cmc; }

      // Create the cmc subarray
      if ( !(cmc in cmc_to_cards ) ) { cmc_to_cards[cmc] = []; }

      // Fix the Aetherling issue until the PDF things supports it
      lcard = lcard.replace('\u00c6', 'Ae').replace('\u00e6', 'ae');
      deck[i][0] = deck[i][0].replace('\u00c6', 'Ae').replace('\u00e6', 'ae');

      // Add the card to that array, including lower-case (only used for sorting)
      cmc_to_cards[cmc].push( [ lcard, deck[i][0], deck[i][1] ] );

    }

    // Get the list of CMCs in the deck
    cmc_to_cards_keys = Object.keys(cmc_to_cards).sort();

    // Sort each CMC, then append them to the final array
    deck = []
    for (i = 0; i < cmc_to_cards_keys.length; i++) {
      // Push a blank entry onto deck (to separate CMCs)
      // unless the deck is empty
      if (deck.length !== 0) {
        deck.push(['', 0]);
      }

      cmc = cmc_to_cards_keys[i];

      cmc_to_cards[ cmc ].sort();   // cmc_to_cards[3]

      for (j = 0; j < cmc_to_cards[cmc].length; j++) {
        card = cmc_to_cards[cmc][j][1];
        quantity = cmc_to_cards[cmc][j][2];

        deck.push([card, quantity]);
      }
    }

    // We must clear out the 32nd entry, if it's blank, as it's at the top of the 2nd column
    if (deck.length > 31) {
      if (deck[31][1] == 0) {
        deck.splice(31, 1);
      }
    }
  }

  // Sort the decklist numerically, if chosen
  else if ( sortorder == 'numerically' ) {

    // Add a case insensitive field, swap order around
    for (i = 0; i < deck.length; i++) {
      deck[i] = [ deck[i][1], deck[i][0].toLowerCase(), deck[i][0] ]
    }

    deck.sort();

    // After sorting is done, we can remove the lower case index
    for (i = 0; i < deck.length; i++) { deck[i] = [ deck[i][2], deck[i][0] ] }
  }

  // Get the card's true English name (ignoring any particular capitalization that someone may have done)
  for (i = 0; i < deck.length; i++) {
    var lcard = deck[i][0].toLowerCase()
    if (cards[ lcard ] != undefined) {
      deck[i][0] = cards[ lcard ]['n']
    }
  }

  // Return the deck
  return(deck);

}

// Stub to simplify updating deck and sideboard counts
// Adds a new entry for unique entries, increments existing entries for duplicates
function list_add(type, card, quantity) {
  if (type === 'main') {
    cardIndex = listContainsCard(maindeck,card);
    if (cardIndex !== -1) {
      // arggh, strings!
      maindeck[cardIndex][1] = parseInt(maindeck[cardIndex][1]) + parseInt(quantity) + '';
    } else {
      maindeck.push([card, quantity]);
    }
    maindeck_count += parseInt(quantity);
  } else if (type === 'side') {
    cardIndex = listContainsCard(sideboard,card);
    if (cardIndex !== -1) {
      // arggh, strings!
      sideboard[cardIndex][1] = parseInt(sideboard[cardIndex][1]) + parseInt(quantity) + '';
    } else {
      sideboard.push([card, quantity]);
    }
    sideboard_count += parseInt(quantity);
  }

  // Returns the index of the card:quantity pair within the given list, or -1 if not found
  function listContainsCard(list, card) {
    for (j=0; j < list.length; j++) {
      if (list[j][0] === card) {
        return j;
      }
    }
    return -1;
  }
}

function htmlEncode(string) {
  return string.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
