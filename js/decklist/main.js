/* jslint browser: true */
/* global $, jQuery, jsPDF, DCI */
/* global parseDecklist, sortDecklist, sectionDecklist, getDeckCount, filterDeckByFields */ // decklist.js functions
/* global logo, futcreaturelogo, futsorcerylogo, futlandlogo, futmultiplelogo, scglogo */

// global timeout filters
var decklistChangeTimer = null;
var pdfChangeTimer = null;

// When the page loads, generate a blank deck list preview
$(document).ready(function() {
  // bind events to all the input fields on the left side, to generate a PDF on change
  $('div.left input, div.left textarea').on('input', pdfChangeWait);
  $('#eventdate, input[type="radio"]').change(pdfChangeWait);

  // bind a date picker to the event date (thanks, jQuery UI)
  // also skin the upload and download button
  $('#eventdate').datepicker({ dateFormat: 'yy-mm-dd' }); // ISO-8601, woohoo
  $('#download').button();
  $('#upload').button();
  $('input[type=radio]').checkboxradio({
    icon: false
  });

  // initialize field tooltips, replace | with <br /> in tooltip content
  $('.left input, .left textarea').tooltip({
    content: function(callback) {
      callback($(this).prop('title').replace(/\|/g, '<br />'));
    },
    position: {
      my: 'right top+10',
      at: 'right bottom',
      collision: 'flipfit'
    },
    tooltipClass: 'tooltip'
  });

  // parse the GET parameters and set them, also generates preview (via event)
  parseGET();
});

// Blocks updates to the PDF
function pdfChangeWait() {
  // Attempt to parse the decklists and validate input every 400ms
  if (decklistChangeTimer) { clearTimeout(decklistChangeTimer); }
  decklistChangeTimer = setTimeout(function() {
    const parsedInput = parseDecklist();
    validateInput(parsedInput);
  }, 400);

  // Wait 1500 milliseconds to generate a new PDF
  if (pdfChangeTimer) { clearTimeout(pdfChangeTimer); }
  pdfChangeTimer = setTimeout(generateDecklistPDF, 1500);
}

// Good ol' Javascript, not having a capitalize function on string objects
String.prototype.capitalize = function() {
  return this.replace( /^([a-z])/g, function(m,p1) { return p1.toUpperCase(); } ); // 1st char
};

// A way to get the GET parameters, setting them in an array called $._GET
(function ($) {
  $._GET = (function(a) {
    if (a === '') return {};
    const b = {};
    for (let i = 0; i < a.length; ++i)
    {
      const p = a[i].split('=');
      if (p.length !== 2) continue;
      b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, ' '));
    }
    return b;
  })(window.location.search.substr(1).split('&'));
})(jQuery);

// Parse the GET attributes, locking out fields as needed
function parseGET() {
  // disable the fields below if the GET parameter `disablefields` is set to true
  const disableFields = $._GET['disablefields'] === 'true' ? true : false;
  const params = ['firstname', 'lastname', 'dcinumber', 'event', 'eventdate', 'eventlocation', 'deckmain', 'deckside'];

  // check for event, eventdate, or eventlocation and lock down those input fields
  params.forEach(function(param) {
    const field = '#' + param;

    if ($._GET[ param ] !== undefined) {
      $(field).val( $._GET[param] );    // set it to the GET variable

      if ((param !== 'deckmain') && (param !== 'deckside')) {
        $(field).prop('disabled', disableFields);  // disable all decklist fields that are in the URL
      }
    }
  });

  // load the logo
  if ($._GET['logo'] === undefined) { $._GET['logo'] = 'dcilogo'; } // if logo isn't specified, use the DCI logo

  // Load SCG logos
  const scglogos = ['FUTcreature', 'FUTland', 'FUTmultiple', 'FUTsorcery', 'starcitygames.com-logo-lores'];
  scglogos.forEach(function(logo) {
    const element = document.createElement('script');

    element.src = 'images/' + logo + '.js';
    element.type = 'text/javascript';
    element.id = 'logo';

    document.getElementsByTagName('head')[0].appendChild(element);
  });

  const logos = ['dcilogo', 'legion', 'gpsanantonio'];

  logos.forEach(function(logo) {
    if ($._GET['logo'] === logo) {
      const element = document.createElement('script');

      element.src = 'images/' + logo + '.js';
      element.type = 'text/javascript';
      element.id = 'logo';
      element.onload = function () { generateDecklistPDF(); };

      document.getElementsByTagName('head')[0].appendChild(element);
    }
  });

  // make the upload button visible, if uploadURL exists
  if ($._GET[ 'uploadURL' ] !== undefined) {
    $('#upload').css('display', 'inline-block');
  }
}

// Detect if there is PDF support for the autopreview
function PDFPreviewSupport() {
  let showpreview = false;

  // Safari and Chrome have application/pdf in navigator.mimeTypes
  if (navigator.mimeTypes['application/pdf'] !== undefined) { showpreview = true; }

  // Firefox desktop uses pdf.js, but not mobile or tablet
  if (navigator.userAgent.indexOf('Firefox') !== -1) {
    if ((navigator.userAgent.indexOf('Mobile') === -1) && (navigator.userAgent.indexOf('Tablet') === -1)) { showpreview = true; }
    else { showpreview = false; } // have to reset it, as FF Mobile application/pdf listed, but not supported (wtf?)
  }

  return showpreview;
}

// Calls the appropriate decklist function based on user selection and returns resulting jsPDF object
function generateDecklistLayout(parsedInput) {
  const decksheetFormat = $('#decksheetformatselector input[name=decksheetformat]:checked').prop('id').replace('decksheet-', '');
  if (decksheetFormat === 'wotc') {
    return generateStandardDecklist(parsedInput);
  } else if (decksheetFormat === 'scg') {
    return generateSCGDecklist(parsedInput);
  }
}

// Generates a StarCityGames-formatted decklist
// see: https://static.starcitygames.com/www/pdfs/Decklist.pdf
function generateSCGDecklist(parsedInput) {
  // Create a new SCG dl
  let scgdl = new jsPDF('landscape', 'pt', 'letter');

  // Create color definitions
  const white = [255],
    bggrey = [235],
    black = [43, 46, 52], // used for first page line color, not fully black
    trueblack = [0],      // used for front page text and second page text
    urlblue = [27, 94, 162];

  // Create deck variables
  const maindeck = parsedInput['main'],
    maindeck_count = getDeckCount(maindeck),
    sideboard = sortDecklist(parsedInput['side'], 'alphabetical'),
    sideboard_count = getDeckCount(sideboard),
    letter_page_h = 792; // width is 612pt but not referenced, so no variable

  // Set PDF variables
  scgdl.setFont('helvetica');
  scgdl.setDrawColor.apply(null, black);
  scgdl.setTextColor.apply(null, trueblack);
  scgdl.setLineWidth(1);

  // add first name, last name, and DCI number boxes & text (as well as "required" text)

  const monospaced_fields = {
    'LAST NAME': {
      text: $('#lastname').val().toUpperCase(),
      label_x_offset: 18,
      required: true,
      required_x_offset: pxToPt(118.171),
    },
    'FIRST NAME': {
      text: $('#firstname').val().toUpperCase(),
      label_x_offset: pxToPt(289.152),
      required: true,
      required_x_offset: pxToPt(386.727),
    },
    'DCI NUMBER': {
      text: $('#dcinumber').val(),
      label_x_offset: pxToPt(554.486),
      required: false,
    },
  };
  Object.keys(monospaced_fields).forEach(function(key, i) {
    const field = monospaced_fields[key],
      fieldoffset = (i - 1) * 0.8,
      label_font_size = 12,
      label_y = textY(54.6607, label_font_size),
      required_font_size = 4,
      required_y = textY(66.0617, required_font_size),
      field_font_size = 11;

    // draw field label
    scgdl.setFontSize(label_font_size);
    scgdl.setFontStyle('bold');
    scgdl.text(key, field['label_x_offset'], label_y);

    // draw "required" sub-label, if needed
    if (field['required']) {
      scgdl.setFontSize(required_font_size);
      scgdl.setFontStyle('normal');
      scgdl.text('*REQUIRED', field['required_x_offset'], required_y);
    }

    // draw fields and user-entered text
    scgdl.setFontSize(field_font_size);
    scgdl.setFontStyle('normal');
    for (let j = 0; j < 10; j++) {
      const letter_centering_y_offset = 4,
        box_starting_x = 19.5,
        box_w = 18,
        box_h = 21.5,
        box_x_offset = (i * 11 + j) * box_w,
        box_x = box_starting_x + fieldoffset + box_x_offset,
        box_y = 18.5,
        letter = field['text'][j] || '',
        letter_y = field_font_size + box_y + letter_centering_y_offset,
        letter_x = box_x + box_w / 2;

      scgdl.rect(box_x, box_y, box_w, box_h);
      scgdl.text(letter, letter_x, letter_y, null, null, 'center');
    }
  });

  // judge-use box and text

  const judge_x = 616.3,
    judge_y = 18.5,
    judge_w = 81.2,
    judge_h = 44,
    shading_x = 622.8,
    shading_y = 22,
    shading_w = 68.8,
    shading_h = 26,
    divider_font_size = 12,
    divider_x = pxToPt(872.4552),
    divider_y = textY(35.5260375, divider_font_size),
    judge_text_font_size = 9,
    judge_text_x = 656, // hand-kerned as opposed to centered in judge box
    judge_text_y = textY(65.6968, judge_text_font_size);

  // outer box
  scgdl.rect(judge_x, judge_y, judge_w, judge_h);
  // grey inner shading
  scgdl.setFillColor.apply(null, bggrey);
  scgdl.rect(shading_x, shading_y, shading_w, shading_h, 'F');

  // add judge box text (divider and "judge use only" text)
  scgdl.setFontSize(divider_font_size);
  scgdl.setFontStyle('bold');
  scgdl.text('/', divider_x, divider_y);

  scgdl.setFontSize(judge_text_font_size);
  scgdl.setFontStyle('normal');
  scgdl.text('JUDGE USE ONLY', judge_text_x, judge_text_y, null, null, 'center');

  // draw "table number" field and text

  const table_number_font_size = 12,
    table_number_x = pxToPt(958.662),
    table_number_y = textY(54.6607, table_number_font_size),
    player_meeting_font_size = 4,
    player_meeting_x = pxToPt(958.667),
    player_meeting_y = textY(72.4616, player_meeting_font_size);

  for (let i = 0; i < 3; i++) {
    scgdl.rect((719.5 + i * 18), 18.5, 18, 21.5);
  }
  // table number label
  scgdl.setFontSize(table_number_font_size);
  scgdl.setFontStyle('bold');
  scgdl.text('TABLE #', table_number_x, table_number_y);
  // add "at players' meeting" text to table # field
  scgdl.setFontSize(player_meeting_font_size);
  scgdl.setFontStyle('normal');
  scgdl.text('AT PLAYERS\' MEETING', player_meeting_x, player_meeting_y);

  // decklist collection info
  const decklist_collection_font_size = 8.5,
    decklist_collection_x = letter_page_h / 2,
    decklist_collection_y = textY(82.5093, decklist_collection_font_size);

  scgdl.setFontSize(decklist_collection_font_size);
  scgdl.setFontStyle('bolditalic');
  scgdl.text('Judges will come by and collect all decklists at the players’ meeting before the start of the event',
             decklist_collection_x,
             decklist_collection_y,
             null, null, 'center');

  // creature, spells, and lands maindeck sections

  const maindeck_sections = {
      'CREATURES': filterDeckByFields(maindeck, 't', '2'),
      'SPELLS': filterDeckByFields(maindeck, 't', ['1', '2'], 'exclude'),
      'LANDS': filterDeckByFields(maindeck, 't', '1'),
    },
    maindeck_section_title_x_offsets = {
      'CREATURES': pxToPt(121.44),
      'SPELLS': pxToPt(456.48),
      'LANDS': pxToPt(805.44),
    },
    section_title_font_size = 12,
    section_title_y = textY(110.821, section_title_font_size),
    section_offset_y = 103.5,
    section_total_font_size = 11,
    listing_font_size = section_total_font_size,
    section_total_y = 79.5,
    section_total_w = 28,
    section_total_h = 19.2,
    section_total_text_y = section_total_y + section_total_font_size + 3, // hand-kerned
    listing_gap = 257.4,
    listing_w = 240,
    listing_h = 291.5,
    listing_quantity_column_w = 28,
    rows = 15;
  // sort and add separators to deck sections
  Object.keys(maindeck_sections).forEach(function (key) {
    maindeck_sections[key] = sectionDecklist(sortDecklist(maindeck_sections[key]));
  });

  // draw sections and deck entries
  Object.keys(maindeck_sections).forEach(function (key, i) {
    const deck_section = maindeck_sections[key],
      offset_x = 18.7 + i * listing_gap,
      section_total_x = offset_x,
      quantity_column_x = listing_quantity_column_w + offset_x,
      section_total_text_x = section_total_x + section_total_w / 2;

    // section total box
    scgdl.rect(offset_x, section_total_y, section_total_w, section_total_h);
    // section total
    scgdl.setFontSize(section_total_font_size);
    scgdl.setFontStyle('bold');
    scgdl.text(getDeckCount(deck_section).toString(),
               section_total_text_x,
               section_total_text_y,
               null, null, 'center');

    // section title
    scgdl.setFontSize(section_title_font_size);
    scgdl.setFontStyle('bold');
    scgdl.text(key, maindeck_section_title_x_offsets[key], section_title_y);

    // listing area outer border
    scgdl.rect(offset_x, section_offset_y, listing_w, listing_h);
    // column line
    scgdl.line(quantity_column_x, section_offset_y,
               quantity_column_x, section_offset_y + listing_h);
    // row lines and text
    scgdl.setFontSize(listing_font_size);
    scgdl.setFontStyle('normal');
    for (let j = 0; j < rows; j++) {
      const quantity_x = offset_x + listing_quantity_column_w / 2,
        card_name_padding = 5,
        card_x = offset_x + listing_quantity_column_w + card_name_padding,
        card_y = section_offset_y + (j * listing_h / rows) + listing_font_size + 3; // hand-kerned

      // row line
      if (j > 0) { // don't draw a line on top of the outside box
        scgdl.line(offset_x,             section_offset_y + (j * listing_h/rows),
                   offset_x + listing_w, section_offset_y + (j * listing_h/rows));
      }
      // write card
      if (j < deck_section.length) {
        const card = deck_section[j];
        // ignore blank entries
        if (card['q'] > 0) {
          // quantity
          scgdl.text(card['q'].toString(), quantity_x, card_y, null, null, 'center');
          // card name
          scgdl.text(card['n'], card_x, card_y);
        }
      }
    }
  });
  // add section logos
  scgdl.addImage(futcreaturelogo, 'JPEG', 59, 73.7, 30, 26.5);
  scgdl.addImage(futsorcerylogo, 'JPEG', 317.7, 75, 20, 25.5);
  scgdl.addImage(futlandlogo, 'JPEG', 565.5, 74.2, 32.3, 25.8);

  // sideboard section

  const sb_x = 18.7,
    sb_y = 413,
    sb_w = 480,
    sb_h = 155.5,
    sb_rows = 8,
    sb_title_font_size = 12,
    sb_font_size = 11,
    sb_quantity_column_w = 28;

  // grey background
  scgdl.setFillColor.apply(null, bggrey);
  scgdl.rect(sb_x, sb_y, sb_w, sb_h, 'F');
  // use a white background for the upper-left corner
  scgdl.setFillColor.apply(null, white);
  scgdl.rect(sb_x, sb_y, sb_w / 2, sb_h / sb_rows, 'F');
  // outer border
  scgdl.rect(sb_x, sb_y, sb_w, sb_h);
  // column lines (divide into two columns and add quantity columns)
  scgdl.line(sb_x + sb_quantity_column_w, sb_y + sb_h/sb_rows,
             sb_x + sb_quantity_column_w, sb_y + sb_h);
  scgdl.line(sb_x + (sb_w/2), sb_y,
             sb_x + (sb_w/2), sb_y + sb_h);
  scgdl.line(sb_x + (sb_w/2) + sb_quantity_column_w, sb_y,
             sb_x + (sb_w/2) + sb_quantity_column_w, sb_y + sb_h);
  // row lines
  for (let i = 1; i < sb_rows; i++) {
    scgdl.line(sb_x,        sb_y + (i * sb_h / sb_rows),
               sb_x + sb_w, sb_y + (i * sb_h / sb_rows));
  }
  // sideboard title
  scgdl.setFontSize(sb_title_font_size);
  scgdl.setFontStyle('bold');
  scgdl.text('SIDEBOARD', pxToPt(67.68), textY(552.421, sb_title_font_size));
  // sideboard logo
  scgdl.addImage(futmultiplelogo, 'JPEG', 29.5, 414.8, 15, 15);
  // sideboard cards
  scgdl.setFontSize(sb_font_size);
  scgdl.setFontStyle('normal');
  for (let i = 0; i < sideboard.length && i < 15; i++) {
    const card = sideboard[i],
      row = i + 1, // first row of first column is skipped
      row_y = row % sb_rows * sb_h / sb_rows,
      column_w = sb_w / 2,
      column_no = Math.floor(row / sb_rows),
      offset_x = sb_x + column_no * column_w,
      offset_y = sb_y + row_y;

    //quantity
    scgdl.text(card['q'].toString(),
               offset_x + sb_quantity_column_w / 2,
               offset_y + sb_font_size + 3,
               null, null, 'center');
    // card name
    scgdl.text(card['n'], offset_x + sb_quantity_column_w + 5, offset_y + sb_font_size + 3);
  }

  // main deck and sideboard totals

  const mdsb_totals = {
      'main': {
        title: 'MAIN DECK',
        val: maindeck_count,
        subtitle: '60 CARDS MINIMUM',
      },
      'side': {
        title: 'SIDEBOARD',
        val: sideboard_count,
        subtitle: 'BETWEEN 0 & 15 CARDS',
      },
    },
    mdsb_label_font_size = 11.5,
    mdsb_label_x_offset = pxToPt(767.521),
    mdsb_label_y_offset = textY(572.147, mdsb_label_font_size),
    mdsb_title_y_offset = textY(544.271, mdsb_label_font_size),
    mdsb_subtitle_font_size = 5,
    mdsb_subtitle_y_offset = textY(602.648, mdsb_subtitle_font_size),
    mdsb_font_size = 14;

  // add "total" label
  scgdl.setFontSize(mdsb_label_font_size);
  scgdl.setFontStyle('normal');
  scgdl.text('TOTAL', mdsb_label_x_offset, mdsb_label_y_offset);

  // add totals boxes
  for (let i = 0; i < 2; i++) {
    const mdsb_gap = 77,
      mdsb_x = 620.5 + i * mdsb_gap,
      mdsb_y = 425.5,
      mdsb_w = 63.2,
      mdsb_h = 25.5,
      mdsb_text_x = mdsb_x + mdsb_w / 2,
      mdsb_text_y = mdsb_y + mdsb_font_size + 3, // hand-kerned
      totals_object = Object.values(mdsb_totals)[i],
      totals_title = totals_object['title'],
      totals_subtitle = totals_object['subtitle'],
      totals_text = totals_object['val'].toString();

    // draw outer box
    scgdl.rect(mdsb_x, mdsb_y, mdsb_w, mdsb_h);
    // draw total title
    scgdl.setFontSize(mdsb_label_font_size);
    scgdl.setFontStyle('normal');
    scgdl.text(totals_title, mdsb_x, mdsb_title_y_offset);
    // draw total subtitle
    scgdl.setFontSize(mdsb_subtitle_font_size);
    scgdl.setFontStyle('normal');
    scgdl.text(totals_subtitle, mdsb_x + mdsb_w / 2, mdsb_subtitle_y_offset, null, null, 'center');
    // draw total (if at least one non-zero total)
    if (Object.values(mdsb_totals).some(function(total) { return total.val > 0; })) {
      scgdl.setFontSize(mdsb_font_size);
      scgdl.setFontStyle('normal');
      scgdl.text(totals_text, mdsb_text_x, mdsb_text_y, null, null, 'center');
    }
  }

  // archetype and event boxes and text

  const ae_metadata = {
      'ARCHETYPE': $('#deckname').val().capitalize(),
      'EVENT'    : $('#event').val().capitalize(),
    },
    ae_gap = 40,
    ae_x = 511.5,
    ae_w = 132,
    ae_h = 32,
    ae_title_font_size = 11,
    ae_title_x = 518,
    ae_font_size = 14;
  for (let i = 0; i < 2; i++) {
    const ae_y = 496.5 + i * ae_gap,
      ae_title = Object.keys(ae_metadata)[i],
      ae_text = Object.values(ae_metadata)[i];
    // title is carefully hand-placed; looks better than supposedly mathematically-correct positioning
    if (ae_title === 'ARCHETYPE') {
      var ae_box_cutout_width = 72;
      var ae_title_y = 500;
    } else if (ae_title === 'EVENT') {
      ae_box_cutout_width = 43,
      ae_title_y = 541.5;
    }

    // border
    scgdl.rect(ae_x, ae_y, ae_w, ae_h);
    // cut out space for title
    scgdl.setFillColor.apply(null, white);
    scgdl.rect(ae_x + 3, ae_y - 2, ae_box_cutout_width, 4, 'F');
    // title
    scgdl.setFontSize(ae_title_font_size);
    scgdl.setFontStyle('normal');
    scgdl.text(ae_title, ae_title_x, ae_title_y);
    // text
    scgdl.setFontSize(ae_font_size);
    scgdl.setFontStyle('bold');
    scgdl.text(ae_text, ae_x + 5, ae_y + ae_font_size + (ae_h - ae_font_size) / 2);
  }

  // misc info and disclaimers (bottom of page)

  const disclaimers_font_size = 8.5;
  scgdl.setTextColor.apply(null, black);
  scgdl.setFontSize(disclaimers_font_size);
  scgdl.setFontStyle('bolditalic');
  // y-positioning for the following lines is a bit wonky, so it is calculated by hand rather than via textY()
  scgdl.text('Main Deck must contain at least 60 cards • Sideboard must contain between 0 and 15 cards • If you need additional space for a category, use other columns',
             (letter_page_h / 2),
             pxToPt(762.158) + disclaimers_font_size + 0.5,
             null, null, 'center');
  scgdl.text('Use full English card names • Failure to submit a legal decklist may result in a game loss penalty',
             (letter_page_h / 2),
             pxToPt(775.758) + disclaimers_font_size + 0.5,
             null, null, 'center');

  // SCG logo in bottom-right corner
  scgdl.addImage(scglogo, 'PNG', 651, 473, 113.5, 88);

  // Add second page
  scgdl.addPage('letter', 'portrait');
  scgdl.setTextColor.apply(null, trueblack);

  // Header
  scgdl.setFontSize(9);
  scgdl.setFontStyle('bold');
  scgdl.text('STAR CITY COMICS & GAMES, INC. PUBLICITY RELEASE & TOURNAMENT POLICIES', 306, 55.117875, null, null, 'center');

  const body_text_x_offset = 70.312875,
    page_two_font_size = pxToPt(11.4667);

  // Consent notice
  scgdl.setFontSize(page_two_font_size);
  scgdl.text('Consent to Photography; Audio and Video Recording and Use Thereof',
             body_text_x_offset,
             80);

  // Body
  scgdl.setFontStyle('normal');
  const paragraphs = [
      {
        text: [
          'Upon the earlier to occur of (i) registering for an StarCityGames.com event or (ii) entering the premises of a ',
          'StarCityGames.com event, you consent to the display, transmittal, distribution, or other use of your name, image, ',
          'voice or likeness and its/their release, publication, exhibition, or reproduction which may be used in whole or ',
          'in part without restriction or limitation in any medium, including by photograph, video, audio taping, or the ',
          'Internet, by StarCityGames.com and/or its affiliates, for any purpose as determined in StarCityGames.com’s sole ',
          'discretion, including, but not limited to, webcasting, for public relations, in news articles or telecasts, in advertising, ',
          'commercial purposes, or by inclusion on StarCityGames.com. You release and hold harmless StarCityGames.com, ',
          'its officers, agents, and employees, and each and all persons involved from any and all claims, demands, causes ',
          'of actions (including any rights of privacy or rights of publicity), liabilities, damages, rights, costs, and expenses ',
          'connected with the display, transmittal, distribution, or other use of your name, image, voice or likeness, including ',
          'the taking, recording, or publication of such interviews, photographs, slides, computer images, video recordings, or ',
          'sound recordings which you have or may in the future have related to the foregoing.'
        ],
        offset: pxToPt(128.061) + page_two_font_size,
      },
      {
        text: [
          'You further agree that upon the earlier to occur of (i) registering for an StarCityGames.com event or (ii) entering the ',
          'premises of an StarCityGames.com Event, you waive all rights you may have to any claims for payment or royalties ',
          'in connection with any exhibition, televising, or other publication, in any medium and whether online or otherwise, ',
          'of the above materials. You also waive any right to inspect or approve any photograph, sound or video recording, ',
          'or film taken by StarCityGames.com, or the person or entity designated by it.'
        ],
        offset: pxToPt(365.394) + page_two_font_size,
      },
    ],
    paragraphLineOffset = pxToPt(18.667);

  // write paragraphs
  paragraphs.forEach(function(paragraph) {
    for (let i = 0; i < paragraph.text.length; i++) {
      scgdl.text(paragraph.text[i],
                 body_text_x_offset,
                 paragraph.offset + i * paragraphLineOffset);
    }
  });

  // Signing lines and text
  // fields listed from left-to-right, top-to-bottom
  const fields = [
      'Name',
      'Signature',
      'Name of Parent or Guardian if minor',
      'Signature of Parent or Guardian, if minor',
      'Date'
    ],
    fieldTextYOrigin = pxToPt(509.394) + page_two_font_size,
    fieldTextYOffset = 42,
    evenFieldXOffset = 286.31025,
    fieldLineYOffset = -10,
    fieldLineLength = 175;

  for (let i = 0; i < fields.length; i++) {
    const lineNumber = Math.floor(i/2),
      evenField = i % 2 === 1,
      yOffset = fieldTextYOrigin + lineNumber * fieldTextYOffset,
      xOffset = (evenField ? evenFieldXOffset : body_text_x_offset),
      lineYOffset = yOffset + fieldLineYOffset;

    // draw line
    scgdl.line(xOffset, lineYOffset, xOffset + fieldLineLength, lineYOffset);
    // draw text
    scgdl.text(fields[i], xOffset, yOffset);
  }

  // SCG tournament policies note
  scgdl.text('A full list of StarCityGames.com Tournament Policies can be obtained from an Event Representative or viewed at',
             body_text_x_offset,
             pxToPt(658.727) + page_two_font_size);
  // set to URL color
  scgdl.setTextColor.apply(null, urlblue);
  scgdl.setDrawColor.apply(null, urlblue);
  const urlXOffset = pxToPt(225.761),
    urlYOffset = pxToPt(677.394) + page_two_font_size;
  scgdl.text('http://static.starcitygames.com/www/pdfs/Tournament_Policy.pdf',
             urlXOffset,
             urlYOffset);
  scgdl.line(urlXOffset,       urlYOffset + 1,
             urlXOffset + 247, urlYOffset + 1);

  return scgdl;

  // helper functions

  // Converts px values to pt values (pt = px * 3/4)
  function pxToPt(px) {
    return px * 3 / 4;
  }
  // Gives an approximate pt value for font Y placement given an offset and font size values
  // Accepts a px value (derived from output PDF) of Y placement, and font size (in pt)
  // Returns an adjusted pt value which should give a close approximate of placement
  function textY(px, font_size) {
    return pxToPt(px) + font_size * 1.1;
  }
}

// Generates a WotC-style decklist
// see: https://wpn.wizards.com/sites/wpn/files/attachements/mtg_constructed_deck_registration_sheet_pdf11.pdf
function generateStandardDecklist(parsedInput) {
  // Create a new dl
  let dl = new jsPDF('portrait', 'pt', 'letter');

  // Create deck variables
  const maindeck = sectionDecklist(sortDecklist(parsedInput['main'])),
    maindeck_count = getDeckCount(maindeck),
    sideboard = sortDecklist(parsedInput['side'], 'alphabetical'),
    sideboard_count = getDeckCount(sideboard);

  // Add the logo
  dl.addImage(logo, 'JPEG', 27, 54, 90, 32);

  // Create all the rectangles

  // Start with the top box, for deck designer, name, etc.
  dl.setLineWidth(1);
  dl.rect(135, 54, 441, 24);  // date + event
  dl.rect(135, 78, 441, 24);  // location + deck name
  dl.rect(355, 54, 221, 72);  // event + deck name + deck designer
  dl.rect(552, 30, 24, 24);   // first letter
  dl.rect(445, 30, 55, 24);   // table number

  dl.rect(27, 140, 24, 628);  // last name + first name + dci
  dl.rect(27, 140, 24, 270);  // dci
  dl.rect(27, 140, 24, 449);  // first name + dci

  dl.rect(250, 748, 56, 22); // total number main deck
  dl.rect(524, 694, 56, 22); // total number side deck
  dl.rect(320, 722, 260, 48); // judge box


  dl.setLineWidth(.5);
  dl.rect(135, 54, 54, 48);   // date + location
  dl.rect(355, 54, 54, 72);   // event + deck name + deck designer
  dl.rect(320, 722, 130, 48); // official use + dc round + status + judge
  dl.rect(320, 722, 260, 12); // official use + main/sb
  dl.rect(320, 734, 260, 12); // dc round + dc round
  dl.rect(320, 746, 260, 12); // status + status

  let y = 140;
  while (y < 380) {
    dl.rect(27, y, 24, 24);  // dci digits
    y += 24;
  }

  // Now let's create a bunch of lines for putting cards on
  y = 186;
  while(y < 750)                  // first column of lines
  {
    dl.line(62, y, 106, y);
    dl.line(116, y, 306, y);
    y += 18;
  }

  y = 186;
  while(y < 386)                  // second column of lines (main deck)
  {
    dl.line(336, y, 380, y);
    dl.line(390, y, 580, y);
    y += 18;
  }

  y = 438;
  while(y < 696)                  // second column of lines (main deck)
  {
    dl.line(336, y, 380, y);
    dl.line(390, y, 580, y);
    y += 18;
  }

  // Get all the various notes down on the page
  // Interleave user input for better copy+paste behavior
  // There are a ton of them, so this will be exciting
  dl.setFontSize(15);
  dl.setFontStyle('bold');
  dl.setFont('times'); // it's no Helvetica, that's for sure
  dl.text('DECK REGISTRATION SHEET', 135, 45);

  dl.setFontSize(7);
  dl.setFontStyle('normal');
  dl.text('Table', 421, 40);
  dl.text('Number', 417, 48);
  dl.text('First Letter of', 508, 40);
  dl.text('Last Name', 516, 48);

  const lastname = $('#lastname').val().capitalize();  // the side bar
  if (lastname.length > 0) {
    const lnfl = lastname.charAt(0);
    dl.setFont('helvetica');
    dl.setFontSize(20);
    dl.setFontStyle('bold');
    dl.text(lnfl, 552 + 12, 49, null, null, 'center'); // x offset + half width of outside box
  }

  // put the event name, deck designer, and deck name into the PDF
  dl.setFont('times');
  dl.setFontSize(7);
  dl.setFontStyle('normal');
  dl.text('Date:', 169, 68);
  dl.setFont('helvetica');
  dl.setFontSize(11);
  dl.text($('#eventdate').val(), 192, 69.5);

  dl.setFont('times');
  dl.setFontSize(7);
  dl.text('Event:', 387, 68);
  dl.setFont('helvetica');
  dl.setFontSize(11);
  dl.text($('#event').val().capitalize(), 412, 69.5);

  dl.setFont('times');
  dl.setFontSize(7);
  dl.text('Location:', 158, 92);
  dl.setFont('helvetica');
  dl.setFontSize(11);
  dl.text($('#eventlocation').val().capitalize(), 192, 93.5);

  dl.setFont('times');
  dl.setFontSize(7);
  dl.text('Deck Name:', 370, 92);
  dl.setFont('helvetica');
  dl.setFontSize(11);
  dl.text($('#deckname').val().capitalize(), 412, 93.5);

  dl.setFont('times');
  dl.setFontSize(7);
  dl.text('Deck Designer:', 362, 116);
  dl.setFont('helvetica');
  dl.setFontSize(11);
  dl.text($('#deckdesigner').val().capitalize(), 412, 117.5);

  dl.setFont('times');
  dl.setFontSize(13);
  dl.setFontStyle('bold');
  dl.text('PRINT CLEARLY USING ENGLISH CARD NAMES', 36, 121);

  // put the last name into the PDF
  dl.setFont('times');
  dl.setFontSize(7);
  dl.setFontStyle('normal');
  dl.text('Last Name:', 41, 760, 90);
  dl.setFont('helvetica');
  dl.setFontSize(11);
  dl.setFontStyle('bold');
  dl.text(lastname, 43, 724, 90);

  // put the first name into the PDF
  const firstname = $('#firstname').val().capitalize();
  dl.setFont('times');
  dl.setFontSize(7);
  dl.setFontStyle('normal');
  dl.text('First Name:', 41, 581, 90);  // rotate
  dl.setFont('helvetica');
  dl.setFontSize(11);
  dl.setFontStyle('bold');
  dl.text(firstname, 43, 544, 90);

  // put the DCI number into the PDF
  dl.setFont('times');
  dl.setFontSize(7);
  dl.setFontStyle('italic');
  dl.text('DCI #:', 41, 404, 90);    // dci # is rotated and italic
  let dcinumber = $('#dcinumber').val();
  if (dcinumber) { // only if there is a dci number
    dcinumber = DCI.getTenIfValid(dcinumber).toString();
  }
  dl.setFont('helvetica');
  dl.setFontSize(12);
  dl.setFontStyle('bold');
  if (dcinumber.length > 0) {
    for (let i = 0, y = 372; i < dcinumber.length; i++, y -= 24) {
      dl.text(dcinumber.charAt(i), 43, y, 90);
    }
  }

  // Add the deck to the decklist
  for (let column = 0, x = 82, y = 182; column < 2; column++) {
    dl.setFont('times');
    dl.setFontStyle('bold');
    if (column === 0) {
      dl.setFontSize(13);
      dl.text('Main Deck:', 62, 149);
      dl.setFontSize(11);
      dl.text('# in deck:', 62, 166);  // first row, main deck
      dl.text('Card Name:', 122, 166);
    } else {
      dl.setFontSize(13);
      dl.text('Main Deck Continued:', 336, 149);
      dl.setFontSize(11);
      dl.text('# in deck:', 336, 166); // second row, main deck
      dl.text('Card Name:', 396, 166);
    }
    dl.setFont('helvetica');
    dl.setFontSize(12);
    dl.setFontStyle('normal');
    for (let j = 0, index = j + column * 32; j < 32 && index < 44 && index < maindeck.length; j++, index++, y += 18) {
      let card = maindeck[index];
      if (column === 1 && j === 0 && card['q'] === 0) {
        // remove blank entry at top of second column
        maindeck.splice(index, 1);
        card = maindeck[index];
      } else if (card['q'] === 0) {
        // Ignore zero quantity entries (blank)
        continue;
      }

      dl.text(card['q'].toString(), x, y);
      dl.text(card['n'], x + 38, y);
    }
    x = 356, y = 182;
  }

  dl.setFont('times');
  dl.setFontSize(13);
  dl.setFontStyle('bold');
  dl.text('Sideboard:', 336, 404);
  dl.setFontSize(11);
  dl.text('# in deck:', 336, 420); // second row, sideboard
  dl.text('Card Name:', 396, 420);

  // Add the sideboard to the decklist
  dl.setFont('helvetica');
  dl.setFontSize(12);
  dl.setFontStyle('normal');
  for (let i = 0, x = 356, y = 434; i < 15 && i < sideboard.length; i++, y += 18) {
    dl.text(sideboard[i]['q'].toString(), x, y);
    dl.text(sideboard[i]['n'], x + 38, y);
  }

  // Add the maindeck count
  dl.setFont('times');
  dl.setFontSize(11);
  dl.setFontStyle('bold');
  dl.text('Total Number of Cards in Main Deck:', 62, 768);
  dl.setFont('helvetica');
  dl.setFontSize(20);
  dl.setFontStyle('normal');
  if (maindeck_count !== 0) {
    dl.text(String(maindeck_count), 250 + 56 / 2, 766, null, null, 'center');
  }

  // Add the sideboard count
  dl.setFont('times');
  dl.setFontSize(11);
  dl.setFontStyle('bold');
  dl.text('Total Number of Cards in Sideboard:', 336, 714);
  dl.setFont('helvetica');
  dl.setFontSize(20);
  dl.setFontStyle('normal');
  if (sideboard_count !== 0) {
    dl.text(String(sideboard_count), 524 + 56 / 2, 712, null, null, 'center');
  }

  dl.setFont('times');
  dl.setFontSize(5);
  dl.setFontStyle('bold');
  dl.text('FOR OFFICAL USE ONLY', 324, 730);

  dl.setFontSize(6);
  dl.setFontStyle('normal');
  dl.text('Deck Check Rd #:', 324, 742); // first row
  dl.text('Status:', 324, 754);
  dl.text('Judge:', 324, 766);

  dl.text('Main/SB:', 454, 730);        // second row
  dl.text('/', 520, 730);
  dl.text('Deck Check Rd #:', 454, 742);
  dl.text('Status:', 454, 754);
  dl.text('Judge:', 454, 766);

  return dl;
}

// Performs validation on user input and updates PDF
function generateDecklistPDF(outputtype = 'dataurlstring') {
  // clear the input timeout before we can generate the PDF
  pdfChangeTimer = null;

  // don't generate the preview if showpreview === false
  if ((outputtype === 'dataurlstring') && !PDFPreviewSupport()) {
    $('#decklistpreview').empty();
    $('#decklistpreview').html('Automatic decklist preview only supported in non-mobile Firefox, Safari, and Chrome.<br /><br />');
  }

  // Parse the deck list
  const parsedInput = parseDecklist();

  // Validate the input
  validateInput(parsedInput);

  // get complete PDF
  const dl = generateDecklistLayout(parsedInput);

  // Output the dl as a blob to add to the DOM
  if (outputtype === 'dataurlstring') {
    const domdl = dl.output('dataurlstring');

    // Put the DOM into the live preview iframe
    $('iframe').attr('src', domdl);
  }
  else if (outputtype === 'raw') {
    const rawPDF = dl.output();
    return(rawPDF);
  }
  else {
    dl.save('decklist.pdf');
  }
}

// performs a number of checks against the values filled out in the fields
// and stores any warnings or errors found during these checks within a
// validation object which is used to generate tooltip and status box text
function validateInput(parsedLists) {
  // validation object
  // key = HTML form object (input or textarea) ID
  // value = array of error objects: {error_level: error_type}
  // error levels include 'warning' and 'error'
  // error types include 'blank', 'nonnum', 'toolarge', 'toosmall',
  //       'size', 'unrecognized', 'quantity', 'futuredate'
  // error objects may have other keys (eg. data) which contain extra information
  const validate = {
    'firstname': [],
    'lastname': [],
    'dcinumber': [],
    'event': [],
    'eventdate': [],
    'eventlocation': [],
    'deckmain': [],
    'deckside': []
  };
  const maindeck = parsedLists['main'],
    maindeck_count = getDeckCount(maindeck),
    sideboard = parsedLists['side'],
    sideboard_count = getDeckCount(sideboard),
    unrecognized = parsedLists['unrecognized'],
    unparseable = parsedLists['unparseable'];

  // check first name (non-blank, too long)
  const decksheetFormat = $('#decksheetformatselector input[name=decksheetformat]:checked').prop('id').replace('decksheet-', '');
  if (decksheetFormat === 'wotc') {
    var maxFirstNameLength = 20;
    var maxLastNameLength = maxFirstNameLength;
  } else if (decksheetFormat === 'scg') {
    maxFirstNameLength = 10;
    maxLastNameLength = maxFirstNameLength;
  }
  if ($('#firstname').val() === '')                           { validate.firstname.push({ warning: 'blank' });  }
  else if ($('#firstname').val().length > maxFirstNameLength) { validate.firstname.push({ error: 'toolarge' }); }

  // check last name (non-blank, too long)
  if ($('#lastname').val() === '')                          { validate.lastname.push({ warning: 'blank' });  }
  else if ($('#lastname').val().length > maxLastNameLength) { validate.lastname.push({ error: 'toolarge' }); }

  // check DCI number (non-blank, numeric, < 11 digits, valid, has check digit, was changed)
  if ($('#dcinumber').val() === '')                 { validate.dcinumber.push({ warning: 'blank' });  }
  else if (!$('#dcinumber').val().match(/^[\d]+$/)) { validate.dcinumber.push({ error: 'nonnum' });   }
  else if ($('#dcinumber').val().length >= 11)      { validate.dcinumber.push({ error: 'toolarge' }); }
  else if (!DCI.isValid($('#dcinumber').val()))     { validate.dcinumber.push({ error: 'invalid' });  }
  else {
    if (DCI.isValid($('#dcinumber').val()) === -1)  { validate.dcinumber.push({ warning: 'nocheck' });}
    if (DCI.wasChanged($('#dcinumber').val()))      { validate.dcinumber.push({ warning: 'changed' });}
  }

  // check event name (non-blank)
  if ($('#event').val() === '') { validate.event.push({ warning: 'blank' }); }

  // check event date (non-blank, unrecognized format, before today)
  if (decksheetFormat !== 'scg') {
    if ($('#eventdate').val() === '')                             { validate.eventdate.push({ warning: 'blank' });      }
    else if (!$('#eventdate').val().match(/^\d{4}-\d{2}-\d{2}$/)) { validate.eventdate.push({ error: 'unrecognized' }); }
    else if (Date.parse($('#eventdate').val()) <= new Date(new Date().setDate(new Date().getDate()-1)).setHours(0)) {
      validate.eventdate.push({ warning: 'futuredate' });
    }
  }

  // check event location (non-blank)
  if (decksheetFormat !== 'scg') {
    if ($('#eventlocation').val() === '') { validate.eventlocation.push({ warning: 'blank' }); }
  }

  // check maindeck (size, number of unique cards)
  if ((maindeck_count === 0) || (maindeck_count > 60)) { validate.deckmain.push({ warning: 'size' });   }
  else if (maindeck_count < 60)                        { validate.deckmain.push({ error: 'toosmall' }); }
  if (decksheetFormat === 'wotc') {
    if (maindeck.length > 44)                          { validate.deckmain.push({ error: 'toolarge' }); }
  } else if (decksheetFormat === 'scg') {
    const maindeck_sections = [filterDeckByFields(maindeck, 't', '2'), filterDeckByFields(maindeck, 't', ['1', '2'], 'exclude'), filterDeckByFields(maindeck, 't', '1')].map(sortDecklist).map(sectionDecklist);
    if (maindeck_sections.some(function(arr) { return arr.length > 15; })) {
      validate.deckmain.push({ error: 'sectiontoolarge' });
    }
  }

  // check sideboard (size)
  if (sideboard_count > 15) { validate.deckside.push({ error: 'toolarge' });   }
  if (sideboard_count < 15) { validate.deckside.push({ warning: 'toosmall' }); }

  // check combined main/sb (quantity of each unique card, unrecognized cards)
  const mainPlusSide = combineDecks(parsedLists['main'], parsedLists['side']),
    excessCards = [];
  const allowedDupes = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest',
    'Snow-Covered Plains', 'Snow-Covered Island', 'Snow-Covered Swamp', 'Snow-Covered Mountain',
    'Snow-Covered Forest', 'Wastes', 'Relentless Rats', 'Shadowborn Apostle'];
  mainPlusSide.forEach(function(card) {
    if (card['q'] > 4 && !allowedDupes.includes(card['n'])) {
      excessCards.push(card['n']);
    }
  });
  if (excessCards.length) { validate.deckmain.push({ error: 'quantity', data: excessCards }); }

  if (unrecognized.length !== 0) {
    validate.deckmain.push({ warning: 'unrecognized', data: unrecognized });
  }
  if (unparseable.length !== 0) {
    validate.deckmain.push({ warning: 'unparseable', data: unparseable });
  }

  // pass validation data to output status/tooltip information
  statusAndTooltips(validate);

  // functions

  // combines any number of decks into one deck (combines quantities for duplicate entries)
  function combineDecks(...lists) {
    const combinedList = [];
    lists.forEach(function (list) {
      list.forEach(function (card) {
        let inCombinedList = false;
        for (var i = 0; i < combinedList.length; i++) {
          if (card['n'] === combinedList[i]['n']) {
            inCombinedList = true;
            break;
          }
        }
        if (inCombinedList) {
          combinedList[i]['q'] += card['q'];
        } else {
          combinedList.push(card);
        }
      });
    });
    return combinedList;
  }
}


// Change tooltips and status box to reflect current errors/warnings (or lack thereof)
function statusAndTooltips(valid) {
  // notifications are stored as the following:
  // notifications: {
  //   for: [[message, level], [message, level], ...],
  //   for: [[message, level], [message, level], ...],
  //   ...
  // }
  // in this case, the key 'for' represents the input element id, and
  // the value 'level' represents the string 'warning' or 'error'
  const notifications = {};

  // define push method for notifications
  // accepts a key and an array (assumed [message, level] input)
  // if the key does not exist, add [array], else push it to that key's array
  notifications.push = function(key, array) {
    if (typeof this[key] === 'undefined') {
      this[key] = [array];
    } else {
      this[key].push(array);
    }
  };

  // 0x000 is valid, 0x001 is empty, 0x010 is warning, 0x100 is error
  // default error level to 'valid'
  let errorLevel = 0;

  // check for validation objects in every category (firstname, lastname, etc.)
  for (const prop in valid) {
    // check each instance of a warning/error per field
    let proplength = valid[prop].length;
    for (let i = 0; i < proplength; i++) {
      const validationObject = valid[prop][i],
        // store validation object type for abstraction
        validType = (validationObject['warning'] ? 'warning' : 'error');

      // bitwise AND the current error level and that of the validation object
      errorLevel = errorLevel | (validType === 'warning' ? 0x010 : 0x100);

      // add notification message for the validation object
      //   note: this section runs only once per validation object, so all checks
      //   can be run in else-if blocks; only one update is made per object

      if (prop === 'firstname') {
        if (validationObject['warning'] === 'blank') {
          notifications.push(prop, ['Missing first name', validType]);
        } else if (validationObject['error'] === 'toolarge') {
          notifications.push(prop, ['First name too long', validType]);
        }
      } else if (prop === 'lastname') {
        if (validationObject['warning'] === 'blank') {
          notifications.push(prop, ['Missing last name', validType]);
        } else if (validationObject['error'] === 'toolarge') {
          notifications.push(prop, ['Last name too long', validType]);
        }
      } else if (prop === 'dcinumber') {
        if (validationObject['warning'] === 'blank') {
          notifications.push(prop, ['Missing DCI number', validType]);
        } else if (validationObject['error'] === 'nonnum') {
          notifications.push(prop, ['DCI number must contain only numbers', validType]);
        } else if (validationObject['error'] === 'toolarge') {
          notifications.push(prop, ['DCI numbers must be 10 digits or less', validType]);
        } else if (validationObject['error'] === 'invalid') {
          notifications.push(prop, ['DCI number is invalid', validType]);
        } else if (validationObject['warning'] === 'nocheck') {
          notifications.push(prop, ['We cannot verify that your DCI number is valid as it is in an old format. Please double-check it.', validType]);
        } else if (validationObject['warning'] === 'changed') {
          notifications.push(prop, ['Your DCI number was expanded to the newer 10 digit system', validType]);
        }
      } else if (prop === 'event') {
        if (validationObject['warning'] === 'blank') {
          notifications.push(prop, ['Missing event name', validType]);
        }
      } else if (prop === 'eventdate') {
        if (validationObject['warning'] === 'blank') {
          notifications.push(prop, ['Missing event date', validType]);
        } else if (validationObject['warning'] === 'futuredate') {
          notifications.push(prop, ['Event date is set in the past', validType]);
        } else if (validationObject['error'] === 'unrecognized') {
          notifications.push(prop, ['Event dates should be in the following format: YYYY-MM-DD', validType]);
        }
      } else if (prop === 'eventlocation') {
        if (validationObject['warning'] === 'blank') {
          notifications.push(prop, ['Missing event location', validType]);
        }
      } else if (prop === 'deckmain') {
        if (validationObject['warning'] === 'size') {
          notifications.push(prop, ['Most decks consist of exactly 60 cards', validType]); }
        else if (validationObject['error'] === 'toosmall') {
          notifications.push(prop, ['Decks may not consist of less than 60 cards', validType]);
        } else if (validationObject['error'] === 'toolarge') {
          notifications.push(prop, ['This PDF only has space for up to 44 unique cards (including spaces)', validType]);
        } else if (validationObject['error'] === 'sectiontoolarge') {
          notifications.push(prop, ['This PDF only has space for up to 15 cards per section (including spaces)', validType]);
        } else if (validationObject['error'] === 'quantity') {
          // include a list of cards that exceed 4 across the main/side
          const excessCardsHtml = '<ul><li>' + validationObject['data'].join('</li><li>') + '</li></ul>';
          notifications.push(prop, ['The following cards exceed 4 copies:' + excessCardsHtml, validType]);
        } else if (validationObject['warning'] === 'unrecognized') {
          // include a list of unrecognized card names
          const unrecognizedCardsHtml = '<ul><li>' + validationObject['data'].join('</li><li>') + '</li></ul>';
          notifications.push(prop, ['Couldn\'t recognize the following card(s):' + unrecognizedCardsHtml, validType]);
        } else if (validationObject['warning'] === 'unparseable') {
          // include a list of unparseable lines
          const unparseableCardsHtml = '<ul><li>' + validationObject['data'].join('</li><li>') + '</li></ul>';
          notifications.push(prop, ['Couldn\'t parse the following lines:' + unparseableCardsHtml, validType]);
        }
      } else if (prop === 'deckside') {
        if (validationObject['warning'] === 'toosmall') {
          notifications.push(prop, ['Most sideboards consist of exactly 15 cards', validType]);
        } else if (validationObject['error'] === 'toolarge') {
          notifications.push(prop, ['Sideboards may not consist of more than 15 cards', validType]);
        }
      }
    }
  }

  // check if all fields are empty; if they are, set errorLevel accordingly
  // close active tooltips, clear titles and classes for new tooltip text
  let allEmpty = true;
  $('.left input, .left textarea').tooltip('close');
  $('.left input, .left textarea').each(function() {
    if ($(this).val()) {
      allEmpty = false;
    }
    $(this).prop('title', '');
    $(this).removeClass('warning error');
  });
  if (allEmpty) {
    errorLevel = 0x001;
  }

  // compose new notifications HTML fragment, set new tooltips, and set input field classes
  let statusBoxHtml = '';
  for (const key in notifications) {
    // exclude any functions of the object
    if (typeof notifications[key] !== 'function') {
      let newTitle = '';

      const notificationsLength = notifications[key].length;
      let fieldClass = 'warning';
      for (let i = 0; i < notificationsLength; i++) {
        // create status box HTML fragment
        statusBoxHtml += '<li class=\'' + notifications[key][i][1] + '\'>';
        statusBoxHtml += '<label for=\'' + key + '\'>';
        statusBoxHtml += notifications[key][i][0] + '</label></li>';

        // determine field class
        if (notifications[key][i][1] === 'error') {
          fieldClass = 'error';
        }

        // construct field notification string
        if (notificationsLength === 1) {
          // don't add a bullet, there's only one line for this field
          newTitle = notifications[key][0][0];
        } else {
          // don't add a newline denotator (vertical bar) for first entry
          if (i !== 0) {
            newTitle += '|';
          }
          newTitle += '&bull; ' + notifications[key][i][0];
        }
      }

      // update field class and title
      const fieldId = '#' + key;
      $(fieldId).addClass(fieldClass);

      // add a tooltip only for errors; people were complaining about overzealous tooltips
      if (fieldClass === 'error') { $(fieldId).prop('title', newTitle); }
    }
  }

  // compute new status
  let newStatus = 'valid';
  if (errorLevel & 0x100)      { newStatus = 'error'; }
  else if (errorLevel & 0x010) { newStatus = 'warning'; }
  else if (errorLevel & 0x001) { newStatus = 'empty'; }

  // set new status, display new notifications
  $('.status').removeClass('default empty valid warning error').addClass(newStatus);
  $('.status .details').html(statusBoxHtml);
}
