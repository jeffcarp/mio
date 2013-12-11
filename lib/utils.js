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
