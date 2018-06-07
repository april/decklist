decklist
========

The code behind decklist.org, which generates DCI Registration Sheets.

## Direct Linking

Interested in directly linking to [decklist.org](https://www.decklist.org) for your tournament or for your deck building application?  It's super easy!  Simply set the following GET parameters to have the fields automatically populated:

- **`firstname`**: the participant's first name (e.g. April)
- **`lastname`**: the participant's last name (e.g. King)
- **`dcinumber`**: the participant's DCI number (e.g. 1234567890, no dashes needed)
- **`event`**: the name of the event (e.g. Grand Prix Minneapolis)
- **`eventdate`**: the date of the event (e.g. 2018-12-31)
- **`eventlocation`**: the physical location of the event (e.g. Minneapolis Convention Center)
- **`deckmain`**: the deck itself; this can be in any format the website understands (use `%0A` for newlines)
- **`deckside`**: the side itself; this can be in any format the website understands (use `%0A` for newlines)
- **`disablefields`**: prevent users from editing the fields above
- **`logo`**: please contact [april@pokeinthe.io](mailto:april@pokeinthe.io), if you'd like to replace the DCI logo

Please note that any field not specifically set will simply be left blank on the form.

_Tournament organizer example, for an unregistered player:_

```
https://www.decklist.org/?eventdate=2018-12-31&event=Grand%20Prix%20Minneapolis&eventlocation=Minneapolis%20Convention%20Center
```

_Or a preregistered player:_

```
https://www.decklist.org/?firstname=April&lastname=King&dcinumber=7060000004&eventdate=2018-12-31&event=Grand%20Prix%20Minneapolis&eventlocation=Minneapolis%20Convention%20Center
```

Just replace the values above with your tournament's values; that's all! Please note that when creating a link, to replace spaces with `%20`; this is important! :)

_Deck building website example:_

```
https://www.decklist.org/?deckmain=2%09Arid%20Mesa%0A4%09Brainstorm%0A1%09Council%27s%20Judgment%0A4%09Counterbalance%0A2%09Counterspell%0A2%09Entreat%20the%20Angels%0A4%09Flooded%20Strand%0A4%09Force%20of%20Will%0A4%09Island%0A3%09Jace%2C%20the%20Mind%20Sculptor%0A2%09Plains%0A2%09Polluted%20Delta%0A4%09Ponder%0A2%09Scalding%20Tarn%0A4%09Sensei%27s%20Divining%20Top%0A3%09Snapcaster%20Mage%0A4%09Swords%20to%20Plowshares%0A4%09Terminus%0A3%09Tundra%0A2%09Volcanic%20Island&deckside=1%09Council%27s%20Judgment%0A1%09Counterspell%0A1%09Disenchant%0A3%09Flusterstorm%0A1%09Keranos%2C%20God%20of%20Storms%0A1%09Path%20to%20Exile%0A1%09Pyroblast%0A2%09Red%20Elemental%20Blast%0A2%09Rest%20in%20Peace%0A1%09Supreme%20Verdict%0A1%09Surgical%20Extraction%0A
```
