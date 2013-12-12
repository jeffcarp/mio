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

      if (params.default !== undefined && this.attributes[name] === undefined) {
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
          this.dirtyAttributes.push(name);
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
      var error = utils.modelError(message);
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
        return callback.call(
          this,
          utils.modelError("Validations failed.", this)
        );
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
      remove ? remove.call(this, done) : done();

      return this;
    },
    /**
     * Return query methods specific to given relation `name`.
     */
    related: function(name) {
      var model = this;
      var relation = this.constructor.relations[name];

      if (!relation) {
        throw new Error('Relation "' + name + '" not defined.');
      }

      return {
        add: function(related, callback) {
          if (!(related instanceof Array)) {
            related = Array.prototype.slice.call(arguments);
            callback = related.pop();
          }

          var i = 0;

          var next = function(err) {
            if (err) return callback.call(model, err);

            // Use adapter's .add() method if provided
            var adapter = relation.model.adapter;
            if (adapter.related && adapter.related.add) {
              return adapter.related.add.call(
                model,
                relation,
                related,
                function(err) {
                  if (err) return next(err);
                  related.unshift(null);
                  callback.apply(model, related);
                }
              );
            }

            var relatedModel = related[i];

            if (i++ == related.length) {
              related.unshift(null);
              return callback.apply(model, related);
            }

            // many-to-many relationships
            if (relation.through) {
              var through = new relation.through();
              through[relation.foreignKey] = model.primary;
              through[relation.throughKey] = relatedModel.primary;
              through.save(function(err) {
                if (err) return next(err);
                next();
              });
            }
            // one-to-one and one-to-many relationships
            else {
              if (relation.type == 'has many') {
                relatedModel[relation.foreignKey] = model.primary;
              }
              relatedModel.save(function(err) {
                if (err) return next(err);
                if (relation.type == 'belongs to') {
                  model[relation.foreignKey] = relatedModel.primary;
                  model.save(function(err) {
                    if (err) return next(err);
                    next();
                  });
                }
                next();
              });
            }
          };

          // Load models if array of ids are passed.
          if (!isNaN(related[0])) {
            var query = {};
            query[relation.anotherModel.primaryKey] = { $in: related }
            relation.anotherModel.findAll(query, function(err, collection) {
              if (err) return next(err);
              related = collection;
              next();
            });
          }
          else {
            next();
          }

          return model;
        },
        all: function(query, callback) {
          if (typeof query === 'function') {
            callback = query;
            query = {};
          }

          var adapter = relation.anotherModel.adapter;

          if (!adapter || !adapter.related || !adapter.related.findAll) {
            throw new Error("No storage adapter support for this method.");
          }
          else {
            adapter.related.findAll.call(
              model,
              relation,
              query,
              function(err, collection) {
                if (err) return callback.call(model, err);
                collection.forEach(function(attrs, i) {
                  collection[i] = relation.anotherModel.create(attrs);
                });
                callback.call(model, null, collection);
              }
            );
          }

          return model;
        },
        count: function(query, callback) {
          if (typeof query === 'function') {
            callback = query;
            query = {};
          }

          var adapter = relation.anotherModel.adapter;

          if (!adapter || !adapter.related || !adapter.related.count) {
            throw new Error("No storage adapter support for this method.");
          }
          else {
            adapter.related.count.call(
              model,
              relation,
              query,
              function(err, count) {
                if (err) return callback.call(model, err);
                callback.call(model, null, count);
              }
            );
          }

          return model;
        },
        create: function(attributes, callback) {
          if (typeof attributes === 'function') {
            callback = attributes;
            attributes = [Object.create(null)];
          }
          else if (!(attributes instanceof Array)) {
            attributes = Array.prototype.slice.call(arguments);
            callback = attributes.pop();
          }

          var i = 0;
          var collection = [];

          var next = function(err) {
            if (err) return callback.call(model, err);

            // Use adapter's .create() method if provided
            var adapter = relation.anotherModel.adapter;
            if (adapter.related && adapter.related.create) {
              return adapter.related.create.call(
                model,
                relation,
                attributes,
                function(err, collection) {
                  if (err) return next(err);
                  collection.unshift(null);
                  callback.apply(model, collection);
                }
              );
            }

            var related = new relation.anotherModel(attributes[i]);

            if (i++ == attributes.length) {
              collection.unshift(null);
              return callback.apply(model, collection);
            }

            if (relation.through) {
              related.save(function(err) {
                if (err) return next(err);
                model.related(name).add(related, function(err) {
                  if (err) return next(err);
                  collection.push(related);
                  next();
                });
              });
            }
            // one-to-one and one-to-many relationships
            else {
              if (relation.type == 'has many') {
                related[relation.foreignKey] = model.primary;
              }
              related.save(function(err) {
                if (err) return next(err);
                if (relation.type == 'belongs to') {
                  model[relation.foreignKey] = related.primary;
                  model.save(function(err) {
                    if (err) return next(err);
                    collection.push(related);
                    next();
                  });
                }
                else {
                  collection.push(related);
                  next();
                }
              });
            }
          };

          next();

          return model;
        },
        get: function(query, callback) {
          if (typeof query === 'function') {
            callback = query;
            query = {};
          }

          var adapter = relation.anotherModel.adapter;

          if (!adapter || !adapter.related || !adapter.related.find) {
            throw new Error("No storage adapter support for this method.");
          }
          else {
            adapter.related.find.call(
              model,
              relation,
              query,
              function(err, related) {
                if (err) return callback.call(model, err);
                related = relation.anotherModel.create(related);
                callback.call(model, null, related);
              }
            );
          }

          return model;
        },
        has: function(related, callback) {
          var adapter = relation.model.adapter;

          if (!adapter || !adapter.related || !adapter.related.has) {
            throw new Error("No storage adapter support for this method.");
          }
          else {
            adapter.related.has.call(
              model,
              relation,
              related,
              function(err, has) {
                if (err) return callback.call(model, err);
                callback.call(model, null, has);
              }
            );
          }

          return model;
        },
        remove: function(related, callback) {
          if (!(related instanceof Array)) {
            related = Array.prototype.slice.call(arguments);
            callback = related.pop();
          }

          var i = 0;

          var next = function(err) {
            if (err) return callback.call(model, err);

            // Use adapter's .remove() method if provided
            var adapter = relation.model.adapter;
            if (adapter.related && adapter.related.remove) {
              return adapter.related.remove.call(
                model,
                relation,
                related,
                function(err) {
                  if (err) return next(err);
                  related.unshift(null);
                  callback.apply(model, related);
                }
              );
            }

            var relatedModel = related[i];

            if (i++ == related.length) {
              related.unshift(null);
              return callback.apply(model, related);
            }

            // many-to-many relationships
            if (relation.through) {
              var query = {};
              query[relation.foreignKey] = model.primary;
              query[relation.throughKey] = relatedModel.primary;
              relation.through.find(query, function(err, through) {
                if (err) return next(err);
                if (through) {
                  return through.remove(next);
                }
                next();
              });
            }
            // one-to-one and one-to-many relationships
            else {
              if (relation.type == 'has many') {
                relatedModel[relation.foreignKey] = null;
              }
              relatedModel.save(function(err) {
                if (err) return next(err);
                if (relation.type == 'belongs to') {
                  model[relation.foreignKey] = null;
                  model.save(function(err) {
                    if (err) return next(err);
                    next();
                  });
                }
                next();
              });
            }
          };

          // Load models if array of ids are passed.
          if (!isNaN(related[0])) {
            var query = {};
            query[relation.anotherModel.primaryKey] = { $in: related }
            relation.anotherModel.findAll(query, function(err, collection) {
              if (err) return next(err);
              related = collection;
              next();
            });
          }
          else {
            next();
          }

          return model;
        }
      };
    }
  };

  Model.type = type.charAt(0).toUpperCase() + type.substr(1);
  Model.primaryKey = null;
  Model.attributes = Object.create(null);
  Model.relations = Object.create(null);
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
   *
   *     User
   *       .use(require('example-plugin'))
   *       .use('browser', 'ajax-plugin', {
   *         url: 'api.example.com'
   *       })
   *       .use('server', function() {
   *         // this === User
   *         console.log(this.displayName);
   *         // => "User"
   *       });
   *
   * @param {String} env Either "browser" or "server". Optional.
   * @param {String|Function} plugin Function or name of module to require.
   * @param {Mixed} options If plugin is a string, additional arguments are
   * passed to required plugin module.
   */

  Model.use = function(env, plugin, options) {
    options = Array.prototype.slice.call(arguments);
    if (typeof env === 'string' && env.match(/(browser|node|server)/)) {
      env = options.shift();
      env = env === 'server' ? 'node' : env;
    }
    else {
      env = null;
    }
    plugin = options.shift();
    if (env) {
      if (env !== (require('is-browser') ? 'browser' : 'node')) {
        return this;
      }
    }
    if (typeof plugin === 'string') {
      plugin = require(plugin);
    }
    plugin.apply(this, options);
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
      if (err) return callback.call(this, err);

      if (!collection) {
        collection = [];
        // Pagination information.
        collection.total = collection.length;
        collection.offset = query.offset || 0;
        collection.limit = query.limit || 50;
      }

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

  /**
   * Define a "has many" relationship.
   *
   * @example
   *
   *     User.hasMany(Post, { as: 'posts', foreignKey: 'user_id' });
   *
   *     user.related('posts').all(function(err, posts) {
   *       // ...
   *     });
   *
   *     var post = user.related('posts').create();
   *
   * @param {Model} anotherModel
   * @param {Object} params The `foreignKey` name is required.
   * @api public
   */

  Model.hasMany = function(anotherModel, params) {
    if (typeof anotherModel === 'string') {
      params.as = anotherModel;
      anotherModel = params.model;
    }

    params.type = 'has many';
    params.anotherModel = anotherModel;
    params.model = this;

    if (!params.as) {
      params.as = anotherModel.type.toLowerCase() + 's';
    }

    this.relations[params.as] = params;
    anotherModel.relations[params.as] = params;

    return this;
  };

  /**
   * Define a "belongs to" relationship.
   *
   * @example
   *
   *     Post.belongsTo(User, { as: 'author', foreignKey: 'userId' });
   *
   *     post.related('author').get(function(err, user) {
   *       // ...
   *     });
   *
   * @param {Model} Owner
   * @param {Object} params The `foreignKey` name is required.
   * @api public
   */

  Model.belongsTo = function(anotherModel, params) {
    if (!params.as) {
      params.as = anotherModel.type.toLowerCase() + 's';
    }

    params.type = 'belongs to';
    params.anotherModel = anotherModel;
    params.model = this;

    this.relations[params.as] = params;
    anotherModel.relations[params.as] = params;

    return this;
  };

  /**
   * Define a "has and belongs to many" relationship.
   *
   * @example
   *
   *     Post.hasAndBelongsToMany(Tag, {
   *       as: 'tags',
   *       through: PostTag,
   *       fromKey: 'post_id',
   *       toKey: 'tag_id'
   *     });
   *
   *     post.related('tags').all(function(err, tags) {
   *       // ...
   *     });
   *
   *     tag.related('posts').all(function(err, posts) {
   *       // ...
   *     });
   *
   * @param {Model} Model
   * @param {Object} params
   * @api public
   */

  Model.hasAndBelongsToMany = function(anotherModel, params) {
    if (typeof anotherModel === 'string') {
      params.as = anotherModel;
      anotherModel = params.model;
    }

    if (!params.as) {
      params.as = anotherModel.type.toLowerCase() + 's';
    }
    if (!params.fromKey) {
      params.fromKey = (this.type + '_' + this.primaryKey).toLowerCase();
    }
    if (!params.toKey) {
      params.toKey = (anotherModel.type + '_' + anotherModel.primaryKey).toLowerCase();
    }

    if (!params.through) {
      var name = this.type + anotherModel.type;
      if (this.type > anotherModel.type) {
        name = anotherModel.type + this.type;
      }
      params.through = exports.createModel(name).attr('id', { primary: true });
      params.through.options.tableName = this.type + '_' + anotherModel.type;
      if (this.type > anotherModel.type) {
        params.through.options.tableName = (anotherModel.type + '_' + this.type).toLowerCase();
      }
    }

    params.through.belongsTo(this, { foreignKey: params.fromKey });
    params.through.belongsTo(anotherModel, { foreignKey: params.toKey });

    this.hasMany(anotherModel, {
      as: params.as,
      foreignKey: params.fromKey,
      through: params.through,
      throughKey: params.toKey
    });

    return this;
  };

  Emitter(Model.prototype);
  Emitter(Model);

  return Model;
};
