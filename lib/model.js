try {
  var Emitter = require('emitter');
}
catch (e) {
  var Emitter = require('emitter-component');
}

var utils = require('./utils');

/**
 * Create Model with given `type`.
 *
 * @param {String} type
 * @return {Model}
 * @api public
 */

exports.createModel = function(type) {
  function Model(attributes) {
    this.constructor.emit('initializing', this, attributes || {});

    Object.defineProperties(this, {
      // Where we store attribute values
      attributes: {
        value: Object.create(null)
      },
      // Dirty attributes
      dirtyAttributes: {
        value: []
      },
      // For EventEmitter
      _callbacks: {
        value: Object.create(null)
      },
      // Get primary key
      primary: {
        get: function() {
          if (this.constructor.primaryKey) {
            return this[this.constructor.primaryKey];
          }
          else {
            throw utils.modelError("Primary key has not been defined.", this);
          }
        }
      },
      errors: {
        value: []
      }
    });

    // Create accessors for defined attributes
    utils.forEachObj(this.constructor.attributes, function(name) {
      var params = this.constructor.attributes[name];

      Object.defineProperty(this, name, {
        get: params.get || function() {
          return this.attributes[name];
        },
        set: function(value) {
          var changed = this.attributes[name] !== value;

          if (changed) {
            var prev = this.attributes[name];
            this.attributes[name] = value;

            if (!~this.dirtyAttributes.indexOf(name)) {
              this.dirtyAttributes.push(name);
            }

            this.constructor.emit('change', this, name, value, prev);
            this.constructor.emit('change:' + name, this, value, prev);
            this.emit('change', name, value, prev);
            this.emit('change:' + name, value, prev);
          }
        },
        enumerable: true
      });

      if (params.default && this.attributes[name] === undefined) {
        this.attributes[name] = typeof params.default === 'function' ?
          params.default.call(this) :
          params.default;
      }
    }, this);

    // Set initial attributes
    if (attributes) {
      for (var name in attributes) {
        if (this.constructor.attributes[name]) {
          this.attributes[name] = attributes[name];
        }
      }
    }

    Object.seal(this);

    this.constructor.emit('initialized', this);
  };

  Model.prototype = {
    constructor: Model,
    isNew: function() {
      if (this.constructor.primaryKey) {
        return !this[this.constructor.primaryKey];
      }
      else {
        throw utils.modelError("Primary key has not been defined.", this);
      }
    },
    isValid: function() {
      this.errors.length = 0;
      for (var len = this.constructor.validators.length, i=0; i<len; i++) {
        this.constructor.validators[i].call(this, this);
      }
      return !this.errors.length;
    },
    isDirty: function() {
      return this.dirtyAttributes.length > 0;
    },
    /**
     * Return attributes changed since last save.
     */
    changed: function() {
      var changed = Object.create(null);

      for (var len = this.dirtyAttributes.length, i=0; i<len; i++) {
        var name = this.dirtyAttributes[i];
        if (this.constructor.attributes[name]) {
          changed[name] = this[name];
        }
      }

      return changed;
    },
    has: function(attr) {
      return this.constructor.attributes[attr] !== undefined;
    },
    set: function(attrs) {
      this.constructor.emit('setting', this, attrs);
      this.emit('setting', attrs);
      for (var attr in attrs) {
        if (this.constructor.attributes[attr]) {
          this[attr] = attrs[attr];
        }
      }
      return this;
    },
    error: function(message, attribute) {
      var error = new Error(message);
      error.model = this;
      error.attribute = attribute;
      this.errors.push(error);
      this.constructor.emit('error', this, error);
      this.emit('error', error);
      return error;
    },
    save: function(callback) {
      if (!callback) callback = function() {};

      var changed = this.changed();

      this.constructor.emit('before save', this, changed);
      this.emit('before save', changed);

      var done = function(err, attributes) {
        if (err) return callback.call(this, err);

        if (attributes) {
          for (var name in attributes) {
            if (this.constructor.attributes[name]) {
              this.attributes[name] = attributes[name];
            }
          }
        }

        this.dirtyAttributes.length = 0;

        this.constructor.emit('after save', this);
        this.emit('after save');
        callback.call(this);
      }.bind(this);

      // If we're already saved, execute callback immediately.
      if (this.primary && !this.isDirty()) {
        return done();
      }

      // Validate before saving
      if (!this.isValid()) {
        var error = new Error("Validations failed.");
        error.model = this;
        throw error;
      }

      // Call our storage adapter's save method, if it exists.
      var save = this.constructor.adapter.save;
      save ? save.call(this, changed, done) : done();

      return this;
    },
    remove: function(callback) {
      if (!callback) callback = function() {};

      this.constructor.emit('before remove', this);
      this.emit('before remove');

      var done = function(err) {
        if (err) return callback.call(this, err);

        // Set primary key to null
        this.attributes[this.constructor.primaryKey] = null;

        this.constructor.emit('after remove', this);
        this.emit('after remove');
        callback.call(this);
      }.bind(this);

      // Call our storage adapter's remove method, if it exists.
      var remove = this.constructor.adapter.remove;
      remove ? remove.call(this, this.primary, done) : done();

      return this;
    }
  };

  Model.type = type.charAt(0).toUpperCase() + type.substr(1);
  Model.primaryKey = null;
  Model.attributes = Object.create(null);
  Model.options = Object.create(null);
  Model.validators = [];
  Array.prototype.push.apply(
    Model.validators,
    require('./validators').validators
  );
  Model.adapter = Object.create(null);

  /**
   * Define a model attribute with the given `name` and `params`.
   *
   * `params` supports the following options:
   *
   *    - primary     Use this attribute as primary key.
   *    - default     Provide default value or function that returns value.
   *    - get         Accessor function. Optional.
   */

  Model.attr = function(name, params) {
    if (this.attributes[name]) return this;

    params = params || Object.create(null);

    if (params.primary) {
      if (this.primaryKey) {
        throw utils.modelError(
          "Primary attribute already exists: " + this.primaryKey, this
        );
      }
      this.primaryKey = name;
    }

    this.attributes[name] = params;

    this.emit('attribute', name, params);
    return this;
  };

  /**
   * Use a plugin function that extends the model.
   */

  Model.use = function(fn) {
    fn.call(this, this);
    return this;
  };

  /**
   * Create a new model and hydrate using an existing object.
   */

  Model.create = function(attrs) {
    return (attrs instanceof this) ? attrs : new (this)(attrs);
  };

  /**
   * Find a model with given `id` or `query`.
   *
   * @param {Number|Object} query
   * @param {Function(err, model)} callback
   * @api public
   */

  Model.find = Model.findOne = Model.get = function(query, callback) {
    if (typeof query == 'number') {
      query = { id: query };
    }

    var done = function(err, attributes) {
      if (err) return callback.call(this, err);

      var model;
      if (attributes) {
        model = new (this)(attributes);
      }

      callback.call(this, null, model);
    }.bind(this);

    // Call adapter's find method, if it exists.
    this.adapter.find ? this.adapter.find.call(this, query, done) : done();

    return this;
  };

  /**
   * Find collection of models using given `query`.
   *
   * @param {Object} query
   * @param {Function(err, collection)} callback
   * @api public
   */

  Model.findAll = Model.all = function(query, callback) {
    if (typeof query === 'function') {
      callback = query;
      query = {};
    }

    var done = function(err, collection) {
      if (!collection) {
        collection = [];
        // Pagination information.
        collection.total = collection.length;
        collection.offset = query.offset || 0;
        collection.limit = query.limit || 50;
      }

      if (err) return callback.call(this, err, collection);

      // Create and hydrate models from results
      for (var len = collection.length, i=0; i<len; i++) {
        collection[i] = new (this)(collection[i]);
      }

      callback.call(this, null, collection);
    }.bind(this);

    // Call adapter's findAll method, if it exists.
    var findAll = this.adapter.findAll;
    findAll ? findAll.call(this, query, done) : done();
  };

  /**
   * Count models using given `query`.
   *
   * @param {Object} query
   * @param {Function(err, count)} callback
   * @api public
   */

  Model.count = Model.countAll = function(query, callback) {
    if (typeof query === 'function') {
      callback = query;
      query = {};
    }

    var done = function(err, count) {
      count = count || 0;

      if (err) return callback.call(this, err, count);

      callback.call(this, null, count);
    }.bind(this);

    // Call adapter's count method, if it exists.
    var count = this.adapter.count;
    count ? count.call(this, query, done) : done();
  };

  /**
   * Remove models using given `query`.
   *
   * @param {Object} query
   * @param {Function(err, count)} callback
   * @api public
   */

  Model.removeAll = Model.destroyAll = function(query, callback) {
    if (typeof query === 'function') {
      callback = query;
      query = {};
    }

    var done = function(err) {
      if (err) return callback.call(this, err);
      callback.call(this, null);
    }.bind(this);

    // Call adapter's count method, if it exists.
    var removeAll = this.adapter.removeAll;
    removeAll ? removeAll.call(this, query, done) : done();
  };

  Emitter(Model.prototype);
  Emitter(Model);

  return Model;
};
