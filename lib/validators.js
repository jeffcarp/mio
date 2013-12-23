var utils = require('./utils');

/**
 * Check attribute type definition.
 */

exports.type = function() {
  try {
    var type = require('type');
  }
  catch (e) {
    var type = require('type-component');
  }

  utils.forEachObj(this.constructor.attributes, function(name) {
    var definition = this.constructor.attributes[name];
    var value = this[name];

    if (value === null || value === undefined || !definition.type) return;

    if (type(value) !== definition.type) {
      this.error(name + " is not of type " + definition.type + ".", name);
    }
  }, this);
};

exports.required = function() {
  utils.forEachObj(this.constructor.attributes, function(name) {
    var definition = this.constructor.attributes[name];
    var value = this[name];

    if (!definition.required) return;

    if (value === undefined || value === null || value === "") {
      this.error(name + " is required.", name);
    }
  }, this);
};

exports.format = function() {
  utils.forEachObj(this.constructor.attributes, function(name) {
    var definition = this.constructor.attributes[name];
    var value = this[name];

    if (value === null || value === undefined || !definition.type) return;

    if (exports.formats[definition.format]) {
      if (!exports.formats[definition.format].test(value)) {
        this.error(name + " is not a valid " + definition.format, name);
      }
    }
  }, this);
};

exports.formats = Object.create(null);
exports.formats.email = /^(?:[\w\!\#\$\%\&\'\*\+\-\/\=\?\^\`\{\|\}\~]+\.)*[\w\!\#\$\%\&\'\*\+\-\/\=\?\^\`\{\|\}\~]+@(?:(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!\.)){0,61}[a-zA-Z0-9]?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!$)){0,61}[a-zA-Z0-9]?)|(?:\[(?:(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\.){3}(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\]))$/;
exports.formats.url = /^(?:(?:ht|f)tp(?:s?)\:\/\/|~\/|\/)?(?:\w+:\w+@)?((?:(?:[-\w\d{1-3}]+\.)+(?:com|org|net|gov|mil|biz|info|mobi|name|aero|jobs|edu|co\.uk|ac\.uk|it|fr|tv|museum|asia|local|travel|[a-z]{2}))|((\b25[0-5]\b|\b[2][0-4][0-9]\b|\b[0-1]?[0-9]?[0-9]\b)(\.(\b25[0-5]\b|\b[2][0-4][0-9]\b|\b[0-1]?[0-9]?[0-9]\b)){3}))(?::[\d]{1,5})?(?:(?:(?:\/(?:[-\w~!$+|.,=]|%[a-f\d]{2})+)+|\/)+|\?|#)?(?:(?:\?(?:[-\w~!$+|.,*:]|%[a-f\d{2}])+=?(?:[-\w~!$+|.,*:=]|%[a-f\d]{2})*)(?:&(?:[-\w~!$+|.,*:]|%[a-f\d{2}])+=?(?:[-\w~!$+|.,*:=]|%[a-f\d]{2})*)*)*(?:#(?:[-\w~!$ |\/.,*:;=]|%[a-f\d]{2})*)?$/i;
exports.formats.card = /^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|6(?:011|5[0-9][0-9])[0-9]{12}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|(?:2131|1800|35\d{3})\d{11})$/;
exports.formats.phone = /^(?:(?:\+?1\s*(?:[.-]\s*)?)?(?:\(\s*([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9])\s*\)|([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9]))\s*(?:[.-]\s*)?)?([2-9]1[02-9]|[2-9][02-9]1|[2-9][02-9]{2})\s*(?:[.-]\s*)?([0-9]{4})(?:\s*(?:#|x\.?|ext\.?|extension)\s*(\d+))?$/;

exports.validators = [
  exports.required,
  exports.type,
  exports.format
];
