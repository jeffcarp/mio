exports.forEachObj = function(obj, fn, ctx) {
  for (var key in obj) {
    fn.call(ctx, key);
  }
};

exports.modelError = function(message, model) {
  var error = new Error(message);
  error.model = model;
  return error;
};
