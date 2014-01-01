exports.forEachObj = function(obj, fn, ctx) {
  for (var key in obj) {
    fn.call(ctx, key);
  }
};

exports.modelError = function(message, model) {
  var error = new Error(message);

  Object.defineProperties(error, {
    message: {
      enumerable: true,
      value: message
    },
    model: {
      value: model
    }
  });

  return error;
};

exports.type = function(val) {
  switch (toString.call(val)) {
    case '[object Function]': return 'function';
    case '[object Date]': return 'date';
    case '[object RegExp]': return 'regexp';
    case '[object Arguments]': return 'arguments';
    case '[object Array]': return 'array';
  }

  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (val === Object(val)) return 'object';

  return typeof val;
};
