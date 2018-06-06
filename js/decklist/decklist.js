/* global $, cards */

// Accepts optional parameters for maindeck and sideboard input
// If not passed--except when testing, this should be the case--form fields are read for these values
// Returns the following object:
// {
//   main: [ {...card, q: quantity}, ... ],
//   side: [ {...card, q: quantity}, ... ],
//   unrecognized: [ cardName, ... ],
//   unparseable: [ string, ... ]
// }
function parseDecklist(deckmain, deckside) {
  deckmain = deckmain || $('#deckmain'), deckmain = deckmain.val().split('\n'),
  deckside = deckside || $('#deckside'), deckside = deckside.val().split('\n');
  var lists = {
    main: [],
    side: [],
    unrecognized: [],
    unparseable: [],
  };
  const cardRE = {
    main: [
      /^\s*(\d+)\s+\[.*\]\s+(.+?)\s*$/,      // MWS, what an ugly format
      /^\s*(\d+)x*\s(.+?)\s*$/,              // MTGO deck format (4 Brainstorm) also TCG (4x Brainstorm)
    ],
    side: [
      /^\s*SB:\s*(\d+)\s+\[.*\]\s(.+?)\s*$/, // MWS, what an ugly format
      /^\s*SB:\s+(\d+)\s(.+?)\s*$/,          // Sideboard lines begin with SB:
    ],
  };

  // Get cards from maindeck and sideboard inputs
  lists = list_merge(lists, scan(deckmain, cardRE['main'].concat(cardRE['side'])));
  lists = list_merge(lists, scan(deckside, cardRE['main'], 'side'));

  // de-duplicate unrecognized card names
  lists['unrecognized'] = lists['unrecognized'].filter(onlyUnique);

  return lists;

  // helper functions

  // Scans lines of a given array for cards
  // Accepts an array of input strings, an array of regexes to check against, and
  // an optional "list" referring to the deck that should be used by default (default is 'main')
  // Returns a "lists" object, structured like the one defined at the top of parseDecklist()
  function scan(lines, regexes, list = 'main') {
    var identified = {
        main: [],
        side: [],
        unrecognized: [],
        unparseable: [],
      },
      toSB = /^\s*Sideboard/, // Tappedout looks like MTGO, except sideboard begins with "Sideboard:"; Salvation, same, but no colon
      in_sb = false;
    // ensure list is actually a property of identified
    if (!identified.hasOwnProperty(list)) {
      list = 'main';
    }

    // main parsing loop
    linesLoop: for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      // check for sideboard switch statement
      if (list === 'main' && toSB.test(line)) {
        in_sb = true;
        continue;
      }
      // check lines against passed regexes for cards
      for (var j = 0; j < regexes.length; j++) {
        let re = regexes[j];
        if (!re.test(line)) {
          continue;
        }

        let result = re.exec(line),
          quantity = parseInt(result[1]),
          cardName = result[2],
          card = getCard(cardName);
        // add quantity field to card object
        if (card) {
          card['q'] = quantity;
        } else {
          // car is not recognized; create a dummy card object
          var encodedCardName = htmlEncode(cardName);
          card = {
            'n': encodedCardName,
            'q': quantity,
          };
          // add card name to unrecognized array only if it is not already present
          if (identified['unrecognized'].indexOf(encodedCardName) === -1) {
            identified['unrecognized'].push(encodedCardName);
          }
        }
        // switch to sideboard if sideboard switch has already been found
        if (list === 'main' && in_sb) {
          list = 'side';
        }
        // add card to identified list
        identified[list] = list_add(identified[list], card);
        continue linesLoop;
      }
      // this statement will only be reached if no passed regexes match the current line
      // add to unparseable list if it is not only whitespace
      if (line.trim()) {
        identified['unparseable'].push(htmlEncode(line));
      }
    }
    return identified;

    // Returns an HTML-safe string (to avoid XSS)
    // Accepts a string
    // Returns a string with HTML-unsafe entities escaped
    function htmlEncode(string) {
      return string.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    // Finds the card object from the global cards object
    // Accepts a card name string
    // Returns the card's object if found, or null if not found
    function getCard(name) {
      name = name.toLowerCase();
      name = name.replace('\u00e6', 'ae');
      if (cards.hasOwnProperty(name)) {
        return cards[name];
      } else {
        return null;
      }
    }
  }
  // Adds a card object to a given deck list (new addition or updates an already-present quantity)
  // Accepts a deck list (array of card objects) and a card object
  // Returns the deck after adding the card or updating the quantity of the already-present card
  // Alternatively, if newCard is a string, simply adds the string to the deck list (used for identified['unrecognized'] and identified['unparseable'])
  function list_add(list, newCard) {
    if (typeof newCard === 'string') {
      return list.push(newCard);
    }
    var cardName = newCard['n'],
      cardIndex = listContainsCard(list, cardName);
    if (cardIndex !== -1) {
      list[cardIndex]['q'] += newCard['q'];
    } else {
      // deep clone object when adding to list to avoid pointer issues when
      // incrementing its size if it is duplicated
      list.push(Object.assign({}, newCard));
    }
    return list;

    // Finds the index of a card name within the given deck list
    // Accepts a deck list (array of card objects) and a card name string
    // Returns the index of the card, if found, or -1 otherwise
    function listContainsCard(list, cardName) {
      for (var i = 0; i < list.length; i++) {
        if (list[i]['n'] === cardName) {
          return i;
        }
      }
      return -1;
    }
  }
  // Merges list objects
  // Accepts two list objects (see lists of parseDecklist() for reference)
  // Returns a single list with the items of b's list added to a's lists using list_add()
  function list_merge(a, b) {
    var list = {};
    for (const keyA in a) {
      if (!list.hasOwnProperty(keyA)) {
        list[keyA] = a[keyA];
      }
      b[keyA].forEach(function (card) {
        list_add(list[keyA], card);
      });
    }
    return list;
  }
  // A uniqueness filtering function for use in array.filter()
  // Returns true only for unique values (the first value found for any duplicates)
  function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
  }
}

// Sorts a given deck list
// Accepts a deck list (array of card objects) and an optional sort order
// If no order is passed, it is read from the sort order input on the page
// Returns the deck list after being sorted via the given order
function sortDecklist(deck, sortorder) {
  let formsortorder = $('#sortorderfloat input[name=sortorder]:checked').prop('id').replace('sort-', '');
  // to allow the function to be mappable, we force non-string "sortorder" values to default to user-entered sort order
  sortorder = typeof sortorder === 'string' ? sortorder || formsortorder : formsortorder;

  if (sortorder === 'original') {
    return deck;
  } else if (sortorder === 'alphabetical') {
    deck.sort(alphabeticalCardSort);
  } else if (sortorder === 'cmc') {
    deck.sort(cmcCardSort);
  } else if (sortorder === 'color') {
    deck.sort(colorCardSort);
  } else if (sortorder === 'numeric') {
    deck.sort(numericCardSort);
  } else if (sortorder === 'type') {
    deck.sort(typeCardSort);
  } else {
    console.error('Unrecognized sort order passed: ' + sortorder + ', no deck sorting will be performed.');
  }
  return deck;

  // sort functions

  // sort cards alphabetically
  function alphabeticalCardSort(a, b) {
    var cardA = a['n'].toLowerCase(),
      cardB = b['n'].toLowerCase();
    if (cardA > cardB) {
      return 1;
    } else if (cardA < cardB) {
      return -1;
    }
    return 0;
  }
  // sort by CMC, then alphabetically
  function cmcCardSort(a, b) {
    var cmcA = a['m'] || 100,
      cmcB = b['m'] || 100;
    return cmcA - cmcB || alphabeticalCardSort(a, b);
  }
  // sort by color of cards, then alphabetically
  function colorCardSort(a, b) {
    var colorA = a['c'] || 'X',
      colorB = b['c'] || 'X';
    if (colorA > colorB) {
      return 1;
    } else if (colorA < colorB) {
      return -1;
    } else {
      return alphabeticalCardSort(a, b);
    }
  }
  // sort by quantity of cards, then alphabetically
  function numericCardSort(a, b) {
    var numA = a['q'],
      numB = b['q'];
    if (numA > numB) {
      return 1;
    } else if (numA < numB) {
      return -1;
    } else {
      return alphabeticalCardSort(a, b);
    }
  }
  // sort by type, then alphabetically
  function typeCardSort(a, b) {
    var typeA = a['t'] || '9',
      typeB = b['t'] || '9';
    if (typeA > typeB) {
      return 1;
    } else if (typeA < typeB) {
      return -1;
    } else {
      return alphabeticalCardSort(a, b);
    }
  }
}

// Add spacers between decklist sections
// Accepts a (presumably sorted) decklist (array of card objects) and an optional section type to separate sections by
// If no section type is passed, it is read from the sort order input on the page
// Returns a decklist that contains the argument's cards with separators between sections as defined by sectionType
function sectionDecklist(deck, sectionType) {
  let formSectionType = $('#sortorderfloat input[name=sortorder]:checked').prop('id').replace('sort-', '');
  // to allow the function to be mappable, we force non-string "sectionType" values to default to user-entered sort order
  sectionType = typeof sectionType === 'string' ? sectionType || formSectionType : formSectionType;

  if (sectionType === 'cmc') {
    return addSections(deck, 'm');
  } else if (sectionType ==='color') {
    return addSections(deck, 'c');
  } else if (sectionType === 'type') {
    return addSections(deck, 't');
  } else {
    // no-op
    return deck;
  }

  // Adds spacers based on delimiters
  // See sectionDecklist(), except delimiter is the card property name (eg. 'c', not 'color') and is not optional
  function addSections(list, delimiter) {
    var numAdded = 0,
      listLength = list.length;
    for (var i = 1; i < listLength; i++) {
      var index = i + numAdded,
        emptyCard = { n: '', q: 0 };
      if (list[index][delimiter] !== list[index - 1][delimiter]) {
        list.splice(index, 0, emptyCard);
        numAdded++;
      }
    }
    return list;
  }
}

// Accepts a deck list (array of card objects)
// Returns a count of number of cards in a given deck
function getDeckCount(deck) {
  var count = 0;
  Object.values(deck).forEach(function(card) {
    count += card['q'];
  });
  return count;
}

// Filters a deck by a given field for some set of allowed values
// Accepts a deck list (array of card objects), a card field, an allowed value
// or array of allowed values, and an optional mode--"include" or "exclude" (default is "include")
// Returns the filtered deck list, only including (or excluding) the given field values
function filterDeckByFields(deck, field, values, mode = 'include') {
  if (!Array.isArray(values)) {
    values = [values];
  }
  return deck.filter(function(card) {
    let include = false;
    if (card.hasOwnProperty(field) && values.includes(card[field])) {
      include = true;
    }
    if (mode === 'exclude') {
      include = !include;
    }
    return include;
  });
}
