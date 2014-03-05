var validators = module.exports = [];

/**
 * Check attribute type definition.
 *
 * @param {Model} model instance that is being validated
 * @param {Array} failed array of failed attribute maps
 * @api public
 */

validators.type = function(model, failed) {
  Object.keys(model.constructor.attributes).forEach(function(name) {
    var definition = model.constructor.attributes[name];
    var value = model[name];

    if (value === null || value === undefined || !definition.type) return;

    if (type(value) !== definition.type) {
      failed.push({
        attribute: name,
        message: name + " is not of type " + definition.type + "."
      });
    }
  });
};

/**
 * Check whether attribute is required.
 *
 * @param {Model} model instance that is being validated
 * @param {Array} failed array of failed attribute maps
 * @api public
 */

validators.required = function(model, failed) {
  Object.keys(model.constructor.attributes).forEach(function(name) {
    var definition = model.constructor.attributes[name];
    var value = model[name];

    if (!definition.required) return;

    if (value === undefined || value === null || value === "") {
      failed.push({
        attribute: name,
        message: name + " is required."
      });
    }
  });
};

/**
 * Check whether attribute has valid format.
 *
 * @param {Model} model instance that is being validated
 * @param {Array} failed array of failed attribute maps
 * @api public
 */

validators.format = function(model, failed) {
  Object.keys(model.constructor.attributes).forEach(function(name) {
    var definition = model.constructor.attributes[name];
    var value = model[name];

    if (value === null || value === undefined || !definition.type) return;

    if (validators.formats[definition.format]) {
      if (!validators.formats[definition.format].test(value)) {
        failed.push({
          attribute: name,
          message: name + " is not a valid " + definition.format
        });
      }
    }
  });
};

/**
 * Format validation regular expressions.
 */

validators.formats = Object.create(null);

validators.formats.email = /^(?:[\w\!\#\$\%\&\'\*\+\-\/\=\?\^\`\{\|\}\~]+\.)*[\w\!\#\$\%\&\'\*\+\-\/\=\?\^\`\{\|\}\~]+@(?:(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!\.)){0,61}[a-zA-Z0-9]?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!$)){0,61}[a-zA-Z0-9]?)|(?:\[(?:(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\.){3}(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\]))$/;

validators.formats.url = /^(?:(?:ht|f)tp(?:s?)\:\/\/|~\/|\/)?(?:\w+:\w+@)?((?:(?:[-\w\d{1-3}]+\.)+(?:com|org|net|gov|mil|biz|info|mobi|name|aero|jobs|edu|co\.uk|ac\.uk|it|fr|tv|museum|asia|local|travel|[a-z]{2}))|((\b25[0-5]\b|\b[2][0-4][0-9]\b|\b[0-1]?[0-9]?[0-9]\b)(\.(\b25[0-5]\b|\b[2][0-4][0-9]\b|\b[0-1]?[0-9]?[0-9]\b)){3}))(?::[\d]{1,5})?(?:(?:(?:\/(?:[-\w~!$+|.,=]|%[a-f\d]{2})+)+|\/)+|\?|#)?(?:(?:\?(?:[-\w~!$+|.,*:]|%[a-f\d{2}])+=?(?:[-\w~!$+|.,*:=]|%[a-f\d]{2})*)(?:&(?:[-\w~!$+|.,*:]|%[a-f\d{2}])+=?(?:[-\w~!$+|.,*:=]|%[a-f\d]{2})*)*)*(?:#(?:[-\w~!$ |\/.,*:;=]|%[a-f\d]{2})*)?$/i;

validators.formats.card = /^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|6(?:011|5[0-9][0-9])[0-9]{12}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|(?:2131|1800|35\d{3})\d{11})$/;

validators.formats.phone = /^(?:(?:\+?1\s*(?:[.-]\s*)?)?(?:\(\s*([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9])\s*\)|([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9]))\s*(?:[.-]\s*)?)?([2-9]1[02-9]|[2-9][02-9]1|[2-9][02-9]{2})\s*(?:[.-]\s*)?([0-9]{4})(?:\s*(?:#|x\.?|ext\.?|extension)\s*(\d+))?$/;

/**
 * Return type of value.
 *
 * @param {Mixed} val
 * @return {String}
 * @api private
 */

function type(val) {
  switch (Object.prototype.toString.call(val)) {
    case '[object Function]': return 'function';
    case '[object Date]': return 'date';
    case '[object RegExp]': return 'regexp';
    case '[object Array]': return 'array';
  }

  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (val === Object(val)) return 'object';

  return typeof val;
};

/**
 * Export validators
 */

module.exports = [
  validators.type,
  validators.required,
  validators.format
];
