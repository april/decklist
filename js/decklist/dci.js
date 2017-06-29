var DCI = {
  primes: [43,47,53,71,73,31,37,41,59,61,67,29], // arbitrary primes used for the checksum - thanks @luma
  isValid: function(number) { // check if DCI number is valid
    number = number.toString(); // explicitly convert to string
    if (number.length >= 8) { // if it is less than 8 digits it has no checksum
      if (number.length == 8 || number.length == 10) { // if it is 9 digits or 11+, it can't be valid
        check = this.getCheckDigit(number.substring(1));
        if (number[0] == check) { // loosely typed
          return true;
        }
        else return false; 
      }
      else return false;
    }
    else return -1; // for a under 8-digit number, return -1 (evals to true for boolean checks)
  },
  getTenDigit: function(number) { // return a 10 digit version of number
    number = number.toString();
    if (number.length == 10) { // if it is already 10 digits
      if (this.isValid(number)) {
        return parseInt(number);
      }
      else return 0; // invalid checks cause a return of 0
    }
    else if (number.length <= 8) { // here we use the 8 digit getter
      number = "0" + this.getEightDigit(number); //prepend a zero
      number = this.getCheckDigit(number) + number; //prepend the check digit
      return parseInt(number);
    }
    else return 0;
  },
  getEightDigit: function(number) {
    number = number.toString();
    if (number.length == 8) {
      if (this.isValid(number)) {
        return parseInt(number);
      }
      else return 0;
    }
    else if (number.length < 8) {
      while (number.length < 7) { // only 7 so we can add a check digit
        number = "0" + number; //prepend zeros
      }
      number = this.getCheckDigit(number) + number;
      return parseInt(number);
    }
    else return 0;
  },
  getCheckDigit: function(number) { // here is where the magic happens
    number = number.toString();
  	var sum = 0;
  	for (var i = 0; i < number.length; i++) { // iterate through the number
  		sum += parseInt(number[i]) * this.primes[i]; // take the nth number * nth prime - add to sum
  	}
  	var check = (Math.floor(sum / 10) % 9) + 1; // integer division by 10, modulo 9, add 1
  	return check;
  },
  getTenIfValid: function(number) { // if possible, return 10 digit number, else return original 
    if (this.getTenDigit(number)) {
      return this.getTenDigit(number);
    }
    else return number;
  },
  wasChanged: function(number) {
    if(this.getTenIfValid(number) == number) {
      return false;
    }
    else return true;
  }
};
