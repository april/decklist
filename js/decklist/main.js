var keyupTimeout = null; // global timeout filter

// When the page loads, generate a blank deck list preview
$(document).ready(function() {
	// bind events to all the input fields on the left side, to generate a PDF on change
	$("div.left input").keyup(keyupBlock);
	$("div.left textarea").keyup(keyupBlock);
	$("#eventdate").change(keyupBlock);
	$("input[type='radio']").change(keyupBlock);  // sort order

	// bind a date picker to the event date (thanks, jQuery UI)
	// also skin the download button
	$("#eventdate").datepicker({ dateFormat: "yy-mm-dd" }); // ISO-8601, woohoo
	$("#download").button();
	$("#sortorderfloat").buttonset();
	
	// initialize field tooltips, replace | with <br> in tooltip content
	$(".left input, .left textarea").tooltip({
		content: function(callback) {
			callback($(this).prop("title").replace(/\|/g, "<br>"));
		},
		position: {
			my: "right top+10",
			at: "right bottom",
			collision: "flipfit"
		},
		tooltipClass: "tooltip"
	});

	// detect browser PDF support
	detectPDFPreviewSupport();

	// parse the GET parameters and set them, also generates preview (via event)
	parseGET();
});

// A function that blocks updates to the PDF unless 1000 milliseconds has past since changes
function keyupBlock() {
		if (keyupTimeout != null) { clearTimeout(keyupTimeout); }
		keyupTimeout = setTimeout(generateDecklistPDF, 1000);
}

// Good ol' Javascript, not having a capitalize function on string objects
String.prototype.capitalize = function() {
	// return this.replace( /(^|\s)([a-z])/g, function(m,p1,p2) { return p1+p2.toUpperCase(); } );
	return this.replace( /(^)([a-z])/g, function(m,p1,p2) { return p1+p2.toUpperCase(); } ); // 1st char
};

// A way to get the GET parameters, setting them in an array called $._GET
(function($) {
	$._GET = (function(a) {
		if (a == "") return {};
		var b = {};
		for (var i = 0; i < a.length; ++i)
		{
			var p=a[i].split('=');
			if (p.length != 2) continue;
			b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
		}
		return b;
	})(window.location.search.substr(1).split('&'))
})(jQuery);

// Parse the GET attributes, locking out fields as needed
function parseGET() {
	var params = ["event", "eventdate", "eventlocation", "deckmain", "deckside"];

	// check for event, eventdate, or eventlocation and lock down those input fields
	for (var i = 0; i < params.length; i++) {
		var param = params[i];
		var field = "#" + param;

		if ($._GET[ param ] != undefined) {
			$(field).val( $._GET[param] );    // set it to the GET variable

			if ((param != "deckmain") && (param != "deckside")) {
				$(field).prop("disabled", true);  // disable all decklist fields that are in the URL
			}
		}
	}

	// load the logo
	if ($._GET['logo'] == undefined) { $._GET['logo'] = 'dcilogo'; } // if logo isn't specified, use the DCI logo

	var logos = ['dcilogo', 'legion', 'gpsanantonio'];

	for (var i = 0; i < logos.length; i++) {
		if ($._GET['logo'] == logos[i]) {
			var element = document.createElement("script");

			element.src = 'images/' + logos[i] + '.js';
			element.type = "text/javascript";
			element.id = "logo";
			element.onload = function () { generateDecklistPDF(); };

			document.getElementsByTagName("head")[0].appendChild(element);
		}
	}
}

// Detect if there is PDF support for the autopreview
function detectPDFPreviewSupport() {
	showpreview = false;

	// Safari and Chrome have application/pdf in navigator.mimeTypes
	if (navigator.mimeTypes["application/pdf"] != undefined) { showpreview = true; }

	// Firefox desktop uses pdf.js, but not mobile or tablet
	if (navigator.userAgent.indexOf("Firefox") != -1) {
		if ((navigator.userAgent.indexOf("Mobile") == -1) && (navigator.userAgent.indexOf("Tablet") == -1)) { showpreview = true; }
		else { showpreview = false; } // have to reset it, as FF Mobile application/pdf listed, but not supported (wtf?)
	}
}


// Generates the part of the PDF that never changes (lines, boxes, etc.)
function generateDecklistLayout() {
	// Create a new dl
	dl = new jsPDF('portrait', 'pt', 'letter');

	// Add the logo
	dl.addImage(logo, 'JPEG', 27, 54, 90, 32);

	// Create all the rectangles

	// Start with the top box, for deck designer, name, etc.
	dl.setLineWidth(1);
	dl.rect(135, 54, 441, 24);  // date + event
	dl.rect(135, 78, 441, 24);  // location + deck name
	dl.rect(355, 54, 221, 72);  // event + deck name + deck designer
	dl.rect(552, 30, 24, 24);   // first letter

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

	var y = 140;
	while (y < 380) {
		dl.rect(27, y, 24, 24);  // dci digits
		y = y + 24;
	}

	// Get all the various notes down on the page
	// There are a ton of them, so this will be exciting
	dl.setFontSize(15);
	dl.setFontStyle('bold');
	dl.setFont('times'); // it's no Helvetica, that's for sure
	dl.text('DECK REGISTRATION SHEET', 135, 45);

	dl.setFontSize(13);
	dl.text('PRINT CLEARLY USING ENGLISH CARD NAMES', 36, 121);

	dl.setFontSize(13);
	dl.text('Main Deck:', 62, 149);
	dl.text('Main Deck Continued:', 336, 149);
	dl.text('Sideboard:', 336, 404);

	dl.setFontSize(11);
	dl.text('# in deck:', 62, 166);  // first row, main deck
	dl.text('Card Name:', 122, 166);
	dl.text('# in deck:', 336, 166); // second row, main deck
	dl.text('Card Name:', 396, 166);
	dl.text('# in deck:', 336, 420); // second row, sideboard
	dl.text('Card Name:', 396, 420);
	dl.text('Total Number of Cards in Main Deck:', 62, 768);
	dl.text('Total Number of Cards in Sideboard:', 336, 714);

	dl.setFontSize(7);
	dl.setFontStyle('normal');
	dl.text('First Letter of', 508, 40);
	dl.text('Last Name', 516, 48);
	dl.text('Date:', 169, 68);
	dl.text('Event:', 387, 68);
	dl.text('Location:', 158, 92);
	dl.text('Deck Name:', 370, 92);
	dl.text('Deck Designer:', 362, 116);
	dl.text('First Name:', 41, 581, 90);  // rotate
	dl.text('Last Name:', 41, 760, 90);

	dl.setFontStyle('italic');
	dl.text('DCI #:', 41, 404, 90)    // dci # is rotated and italic

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

	dl.setFontSize(5);
	dl.setFontStyle('bold');
	dl.text('FOR OFFICAL USE ONLY', 324, 730);


	// Now let's create a bunch of lines for putting cards on
	y = 186;
	while(y < 750)                  // first column of lines
	{
		dl.line(62, y, 106, y);
		dl.line(116, y, 306, y);
		y = y + 18;
	}

	y = 186;
	while(y < 386)                  // second column of lines (main deck)
	{
		dl.line(336, y, 380, y);
		dl.line(390, y, 580, y);
		y = y + 18;
	}

	y = 438;
	while(y < 696)                  // second column of lines (main deck)
	{
		dl.line(336, y, 380, y);
		dl.line(390, y, 580, y);
		y = y + 18;
	}

	return(dl);
}

function generateDecklistPDF(outputtype) {
	// default type is dataurlstring (live preview)
	// stupid shitty javascript and its lack of default arguments
	outputtype = typeof outputtype !== 'undefined' ? outputtype : 'dataurlstring';

	// clear the input timeout before we can generate the PDF
	keyupTimeout = null;

	// don't generate the preview if showpreview == false
	if ((outputtype == 'dataurlstring') && (showpreview == false)) {
		$("#decklistpreview").empty();
		$("#decklistpreview").html("Automatic decklist preview only supported in non-mobile Firefox, Safari, and Chrome.<br /><br />");
	}
		
	// start with the blank PDF
	dl = generateDecklistLayout();
	
	// Attempt to parse the decklists
	parseDecklist();

	// input validation alerts
	validateInput();

	// Helvetica, fuck yeah
	dl.setFont('helvetica');
	dl.setFontSize(11);

	// put the event name, deck designer, and deck name into the PDF
	dl.setFontStyle('normal');
	dl.text($("#eventdate").val(), 192, 69.5);
	dl.text($("#eventlocation").val().capitalize(), 192, 93.5);
	dl.text($("#event").val().capitalize(), 412, 69.5);
	dl.text($("#deckname").val().capitalize(), 412, 93.5);
	dl.text($("#deckdesigner").val().capitalize(), 412, 117.5);

	// put the first name into the PDF
	dl.setFontStyle('bold');
	firstname = $("#firstname").val().capitalize();
	dl.text(firstname, 43, 544, 90);

	// put the last name into the PDF
	lastname = $("#lastname").val().capitalize();  // the side bar
	if (lastname.length > 0) {
		// lastname = capitalize(lastname);
		dl.text(lastname, 43, 724, 90);

		dl.setFontSize(20);

		// Getting the character perfectly aligned in the center of the box is super tricky, since it's hard to
		// get a glyph width.  So we manually fix some
		lnfl = lastname.charAt(0);
		offset = 0;
		
		switch (lnfl) {
			case 'I': offset = 4; break;
			case 'J': offset = 1; break;
			case 'M': offset = -1; break;
			case 'Q': offset = -1; break;
			case 'X': offset = 1; break;
			case 'Y': offset = .5; break;
			case 'W': offset = -2; break;
			case 'Z': offset = 1; break;
		}

		dl.text(lnfl, 557 + offset, 49);
		dl.setFontSize(12);
	}

	/*
	 * to implement later; needs further discussion
	 
		// TODO: implement, see validateDCI method
		// validate DCI number
		dcinumber = validateDCI($("#dcinumber").val());
	*/
	
	dcinumber = $("#dcinumber").val();
	
	// put the DCI number into the PDF	
	y = 372;
	if (dcinumber.length > 0) {
		for (var i = 0; i < dcinumber.length; i++) {
			dl.text(dcinumber.charAt(i), 43, y, 90);
			y = y - 24;
		}
	}

	// Add the deck to the decklist
	var x = 82;
	var y = 182;
	dl.setFontStyle('normal');
	if (maindeck != []) {
		for (i = 0; i < maindeck.length; i++) {
			if (i == 32) { x = 356; y = 182; } // jump to the next row

			// Ignore zero quantity entries (blank)
			if (maindeck[i][1] != 0) {
				dl.text(maindeck[i][1], x, y);
				dl.text(maindeck[i][0].capitalize(), x + 38, y);
			}

			y = y + 18;  // move to the next row
		}
	}

	// Add the sideboard to the decklist
	var x = 356;
	var y = 434;
	if (sideboard != []) {
		for (i = 0; i < sideboard.length; i++) {

			dl.text(sideboard[i][1], x, y);
			dl.text(sideboard[i][0].capitalize(), x + 38, y);
			y = y + 18;  // move to the next row
		}
	}

	// Add the maindeck count and sideboard count
	dl.setFontSize(20);
	if (maindeck_count != 0)  { dl.text(String(maindeck_count), 268, 766); }
	if (sideboard_count != 0) {
		if (sideboard_count < 10) { dl.text(String(sideboard_count), 547, 712); }
		else { dl.text(String(sideboard_count), 541, 712); }
	}

	// Output the dl as a blob to add to the DOM
	if (outputtype == 'dataurlstring') {
		domdl = dl.output('dataurlstring');

		// Put the DOM into the live preview iframe
		$('iframe').attr('src', domdl); }
	else {
		dl.save('decklist.pdf');
	}
}

// TODO: comment
function validateInput() {
	/*
		TODO:

	*/
	
	// validation object
	// key = HTML form object (input or textarea) ID
	// value = array of error objects: {error_level: error_type}
	// error levels include "warning" and "error"
	// error types include "blank", "nonnum", "toolarge", "toosmall",
	//       "size", "unrecognized", "quantity", "futuredate"
	validate = {
		"firstname": [],
		"lastname": [],
		"dcinumber": [],
		"event": [],
		"eventdate": [],
		"eventlocation": [],
		"deckmain": [],
		"deckside": []
	};
	
	// check first/last name (nonblank)
	if ($("#firstname").val() === "") {
		validate.firstname.push({"warning": "blank"});
	} else if ($("#firstname").val().length > 20) {
		validate.firstname.push({"error": "toolarge"});
	}
	if ($("#lastname").val() === "") {
		validate.lastname.push({"warning": "blank"});
	} else if ($("#lastname").val().length > 20) {
		validate.lastname.push({"error": "toolarge"});
	}
	
	// check DCI number (nonblank, numeric, < 11 digits)
	if ($("#dcinumber").val() === "") {
		validate.dcinumber.push({"warning": "blank"});
	} else if (!$("#dcinumber").val().match(/^[\d]+$/)) {
		validate.dcinumber.push({"error": "nonnum"});
	}
	if ($("#dcinumber").val().length >= 11) {
		validate.dcinumber.push({"error": "toolarge"});
	}
	
	// check event name, date, location (nonblank)
	if ($("#event").val() === "") {
		validate.event.push({"warning": "blank"});
	}
	if ($("#eventdate").val() === "") {
		validate.eventdate.push({"warning": "blank"});
	} else if (!$("#eventdate").val().match(/^\d{4}\-\d{2}\-\d{2}$/)) {
		validate.eventdate.push({"error": "unrecognized"});
	} else if ((Date.parse($("#eventdate").val()) - Date.now()) < 0) {
		validate.eventdate.push({"warning": "futuredate"});
	}
	if ($("#eventlocation").val() === "") {	
		validate.eventlocation.push({"warning": "blank"});
	}
	
	// check maindeck (size, number of unique cards)
	// check sideboard (size)
	if (maindeck_count != 60) {
		validate.deckmain.push({"warning": "size"});
	}
	if (maindeck.length > 44) {
		validate.deckmain.push({"error": "toolarge"});
	}
	if (sideboard_count > 15) {
		validate.deckside.push({"error": "toolarge"});
	}
	if (sideboard_count < 15) {
		validate.deckside.push({"warning": "toosmall"});
	}

	// check combined main/sb (quantity of each unique card, unrecognized cards)
	mainPlusSide = mainAndSide();
	fourOrLess = true;
	excessCards = [];
	unrecognizedCards = [];
	for (i = 0; i < mainPlusSide.length; i++) {
		if (parseInt(mainPlusSide[i][1]) > 4) {
			// TODO: add checks for basic lands, relentless rats, shadowborn apostle
			fourOrLess = false;
			excessCards.push(mainPlusSide[i][0]);
		}
	}
	if (fourOrLess === false) {
		validate.deckmain.push({"warning": "quantity"});
	}
	if (unrecognized.length !== 0) {
		unrecognizedCards = unrecognized
		validate.deckmain.push({"warning": "unrecognized"});
	}
	
	// pass validation data to output status/tooltip information
	statusAndTooltips(validate);
}

// returns an array combining the main and sideboards
function mainAndSide() {
	// make deep copies by value of the maindeck and sideboard
	combined = $.extend(true,[],maindeck);
	sideQuants = $.extend(true,[],sideboard);
	
	// combine the cards!
	combined.map(addSideQuants);
	combined = combined.concat(sideQuants);
	
	return combined;
	
	// mapping function; adds quantities of identical names in main/side
	// and removes those matching cards from sideQuants
	function addSideQuants(element) {
		foundSideElement = false;
		for (i = 0; i < sideQuants.length && sideQuants.length && foundSideElement === false; i++) {
			if (sideQuants[i][0] === element[0]) {
				foundSideElement = i;
			}
		}
		if (typeof foundSideElement === "number") {
			element[1] = (parseInt(element[1]) + parseInt(sideQuants[foundSideElement][1])).toString();
			sideQuants.splice(foundSideElement, 1);
		}
		return element;
	}
}

// Change tooltips and status box to reflect current errors/warnings (or lack thereof)
function statusAndTooltips(valid) {
	// status box update
	// notifications are stored as [[message, for, level], ...]
	// (for = input element id, level = "warning" or "error")
	notifications = [];
	errorlevel = 0; // 0x000 is valid, 0x001 is empty, 0x010 is warning, 0x100 is error
	
	// check for validation objects in every category (firstname, lastname, etc.)
	for (prop in validate) {
		proplength = validate[prop].length;
		for (i=0; i < proplength; i++) {
			// bitwise AND the current error level and that of the validation object
			validationobject = validate[prop][i];
			errorlevel = errorlevel | (validationobject["warning"] ? 0x010 : 0x100);
			
			// add notification message for the validation object
			// 
			// note: this section runs only once per validation object, so all checks
			// can be run in else-if blocks; only one update is made per object
			if (prop === "firstname") {
				if (validationobject["warning"] === "blank") {
					notifications.push(["You should enter your first name.", "firstname", "warning"]);
				} else if (validationobject["error"] === "toolarge") {
					notifications.push(["Long names break the PDF layout.", "firstname", "error"]);
				}
			} else if (prop === "lastname") {
				if (validationobject["warning"] === "blank") {
					notifications.push(["You should enter your last name.", "lastname", "warning"]);
				} else if (validationobject["error"] === "toolarge") {
					notifications.push(["Long names break the PDF layout.", "lastname", "error"]);
				}
			} else if (prop === "dcinumber") {
				if (validationobject["warning"] === "blank") {
					notifications.push(["You should enter your DCI number.", "dcinumber", "warning"]);
				} else if (validationobject["error"] === "nonnum") {
					notifications.push(["Your DCI number must only contain numbers.", "dcinumber", "error"]);
				} else if (validationobject["error"] === "toolarge") {
					notifications.push(["Your DCI number must be 10 digits or less.", "dcinumber", "error"]);
				}
			} else if (prop === "event") {
				if (validationobject["warning"] === "blank") {
					notifications.push(["You should enter the event name.", "event", "warning"]);
				}
			} else if (prop === "eventdate") {
				if (validationobject["warning"] === "blank") {
					notifications.push(["You should enter the event date.", "eventdate", "warning"]);
				} else if (validationobject["warning"] === "futuredate") {
					notifications.push(["This date is not future-set.", "eventdate", "warning"]);
				} else if (validationobject["error"] === "unrecognized") {
					notifications.push(["Event dates should be in the following format: YYYY-MM-DD.", "eventdate", "error"]);
				}
			} else if (prop === "eventlocation") {
				if (validationobject["warning"] === "blank") {
					notifications.push(["You should enter the event location.", "eventlocation", "warning"]);
				}
			} else if (prop === "deckmain") {
				if (validationobject["warning"] === "size") {
					notifications.push(["Most decks consist of exactly 60 cards.", "deckmain", "warning"]);
				} else if (validationobject["error"] === "toolarge") {
					notifications.push(["This PDF only has space for up to 44 unique cards.", "deckmain", "error"]);
				} else if (validationobject["warning"] === "quantity") {
					excessCardsHtml = "<ul><li>" + excessCards.join("</li><li>") + "</li></ul>";
					notifications.push(["The following cards exceed 4 copies across the maindeck and sideboard:" + excessCardsHtml, "deckmain", "warning"]);
				} else if (validationobject["warning"] === "unrecognized") {
					// TODO: make sure unrecognized cards are listed
					// current status: only unparseable lines are listed,
					//   unrecognized cards are still listed normally - need to
					//   cross-check against cards database
					unrecognizedCardsHtml = "<ul><li>" + unrecognizedCards.join("</li><li>") + "</li></ul>";
					notifications.push(["The following lines could not be parsed as Magic: The Gathering cards:" + unrecognizedCardsHtml, "deckmain", "warning"]);
				}
			} else if (prop === "deckside") {
				if (validationobject["warning"] === "toosmall") {
					notifications.push(["Most sideboards consist of exactly 15 cards.", "deckside", "warning"]);
				} else if (validationobject["error"] === "toolarge") {
					notifications.push(["Sideboards may not consist of more than 15 cards.", "deckside", "error"]);
				}
			}
		}
	}
	
	// check if all fields are empty; if they are, set errorlevel accordingly
	// close active tooltips, clear titles and classes for new tooltip text
	allempty = true;
	$(".left input, .left textarea").tooltip("close");
	$(".left input, .left textarea").each(function() {
		if ($(this).val()) {
			allempty = false;
		}
		$(this).prop("title", "");
		$(this).removeClass("warning error");
	});
	if (allempty) {
		errorlevel = 0x001;
	}
	
	// compose new notifications HTML fragment, set new tooltips, and set input field classes
	notificationshtml = "";
	notificationslength = notifications.length;
	for (i=0; i < notificationslength; i++) {
		// create status box HTML fragment
		notificationshtml += "<li class=\"" + notifications[i][2] + "\">";
		notificationshtml += "<label for=\"" + notifications[i][1] + "\">";
		notificationshtml += notifications[i][0] + "</label></li>";
		
		// update field tooltips and classes
		fieldid = "#" + notifications[i][1];
		$(fieldid).addClass(notifications[i][2]);
		
		// we need a new line only if the title isn't blank AND it doesn't end in HTML
		// as all the HTML elements included are block elements
		appendNewLine = !($(fieldid).prop("title") === "" || $(fieldid).prop("title").slice(-1) === ">");
		
		// append the new notification, prepended with a vertical bar if it
		// requires a <br> to be inserted (bar is converted on the fly)
		newtitle = $(fieldid).prop("title") + (appendNewLine ? "|" : "") + "&bull; " + notifications[i][0];
		$(fieldid).prop("title", newtitle);
	}
	// TODO: rewrite this to use a new array for notification field text
	// and replace this hacky method of fixing the problem
	$(".left input, .left textarea").each(function() {
		if ($(this).prop("title").indexOf("|") === -1 && $(this).prop("title").indexOf(">") === -1) {
			newertitle = $(this).prop("title").slice(7);
			$(this).prop("title", newertitle);
		}
	});
	
	// compute new status
	newstatus = "valid";
	if (errorlevel & 0x100) {
		newstatus = "error";
	} else if (errorlevel & 0x010) {
		newstatus = "warning";
	} else if (errorlevel & 0x001) {
		newstatus = "empty";
	}
	
	// set new status, display new notifications
	$(".status").removeClass("default empty valid warning error").addClass(newstatus);
	$(".status .details").html(notificationshtml);
}

/*
 * to implement later; needs further discussion
 
function validateDCI(dci) {
	return dci;
	// TODO: implement DCI # checking / constructing
	/*
	
	// The process for generating DCI numbers is:

	// Prepend a zero
	// Calculate check digit
	// Prepend that check digit
	// (and repeat until full length DCI number)

	// -----------------------------------------------------

    // var primes = [43, 47, 53, 71, 73, 31, 37, 41, 59, 61, 67, 29]
    // var dcinumber = "1076753660"
     
    // var sum   = 0
    // var cdsum = 0
    // for (i = 0; i < dcinumber.length-1; i++){
        // sum += parseInt(dcinumber[i+1])*primes[i]
    // }
    // for (i = 0; i < dcinumber.length; i++){
        // cdsum += parseInt(dcinumber[i])*primes[i]
    // }
     
    // console.log("Next check digit would be " + (1 + Math.floor(cdsum / 10) % 9))
     
    // var valid = (1 + Math.floor(sum / 10) % 9) == parseInt(dcinumber[0])
     
    // console.log(valid)
	
}
*/
