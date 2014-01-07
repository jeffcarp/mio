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
 * @param {Object} options Optional.
 * @return {Model}
 * @api public
 */

exports.createModel = function(type, options) {
  options = options || Object.create(null);

  // If visionmedia/co module is available, wrap callback methods to return
  // thunks for generator-based flow control.
  if (options.thunks !== false) {
    try {
      require.resolve('co');
      options.thunks = true;
    }
    catch (e) {};
  }

  function Model(attributes) {
    if (!attributes) attributes = {};

    this.constructor.emit('initializing', this, attributes);

    Object.defineProperties(this, {
      // Where we store attribute values
      attributes: {
        value: Object.create(null)
      },
      // A mutable object for saving extra information
      extras: {
        value: Object.create(null),
        writable: true
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
        enumerable: false,
        get: function() {
          if (this.constructor.primaryKey) {
            return this[this.constructor.primaryKey];
          }
          else {
            throw utils.modelError("Primary key has not been defined.", this);
          }
        },
        set: function(value) {
          if (this.constructor.primaryKey) {
            this[this.constructor.primaryKey] = value;
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
        enumerable: params.enumerable === false || params.filtered ? false : true
      });

      if (params.default !== undefined && this.attributes[name] === undefined) {
        attributes[name] = typeof params.default === 'function' ?
          params.default.call(this) :
          params.default;
      }
      else {
        this.attributes[name] = null;
      }
    }, this);

    // Set initial attributes
    for (var name in attributes) {
      if (this.constructor.attributes[name]) {
        if (this.attributes[name] !== attributes[name]) {
          this.dirtyAttributes.push(name);
        }
        this.attributes[name] = attributes[name];
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
    relation: function(name) {
      var model = this;
      var relation;

      this.constructor.relations.forEach(function(params) {
        if (params.model === model.constructor && params.as === name) {
          relation = params;
        }
      });

      if (!relation) {
        throw new Error('Relation "' + name + '" not defined.');
      }

      var relationMethods = {
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
                if (relation.type.match(/(belongs to|has one)/)) {
                  model[relation.foreignKey] = relatedModel.primary;
                  return model.save(function(err) {
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
        findAll: function(query, callback) {
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
                if (relation.type.match(/(belongs to|has one)/)) {
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
        find: function(query, callback) {
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
                if (relation.type.match(/(belongs to|has one)/)) {
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

      if (options.thunks) {
        var methods = ['findAll', 'find', 'add', 'create', 'has', 'count', 'remove'];
        methods.forEach(function(method) {
          relationMethods[method] = thunkify(relationMethods[method]);
        });
      }

      // Aliases
      relationMethods.all = relationMethods.findAll;
      relationMethods.get = relationMethods.find;
      relationMethods.findOne = relationMethods.find;

      return relationMethods;
    }
  };

  Model.type = type.charAt(0).toUpperCase() + type.substr(1);
  Model.primaryKey = null;
  Model.attributes = Object.create(null);
  Model.relations = [];
  Model.options = options;
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
   *       .server(function() {
   *         this.use(require('mio-mysql'));
   *       })
   *       .browser(function() {
   *         this.use(require('mio-ajax'));
   *       });
   *
   * @param {Function} plugin
   */

  Model.use = function(plugin) {
    plugin.call(this, this);
    return this;
  };

  Model.browser = function(fn) {
    if (require('is-browser')) {
      fn.call(this, this);
    }
    return this;
  };

  Model.server = function(fn) {
    if (!require('is-browser')) {
      fn.call(this, this);
    }
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

  Model.find = function(query, callback) {
    if (typeof query == 'number') {
      query = { id: query };
    }

    this.emit('before find', query);

    var done = function(err, attributes) {
      if (err) return callback.call(this, err);

      var model;
      if (attributes) {
        model = new (this)(attributes);
      }

      this.emit('after find', model);

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

  Model.findAll = function(query, callback) {
    if (typeof query === 'function') {
      callback = query;
      query = {};
    }

    this.emit('before findAll', query);

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

      this.emit('after findAll', collection);

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

  Model.count = function(query, callback) {
    if (typeof query === 'function') {
      callback = query;
      query = {};
    }

    this.emit('before count', query);

    var done = function(err, count) {
      count = count || 0;

      if (err) return callback.call(this, err, count);

      this.emit('after count', count);

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

  Model.removeAll = function(query, callback) {
    if (typeof query === 'function') {
      callback = query;
      query = {};
    }

    this.emit('before removeAll', query);

    var done = function(err) {
      if (err) return callback.call(this, err);
      this.emit('after removeAll');
      callback.call(this, null);
    }.bind(this);

    // Call adapter's count method, if it exists.
    var removeAll = this.adapter.removeAll;
    removeAll ? removeAll.call(this, query, done) : done();
  };

  /**
   * Define a "has many" relationship.
   *
   *     User.hasMany(Post, {
   *       as: 'posts',
   *       foreignKey: 'user_id'
   *     });
   *
   *     user.posts.all(function(err, posts) {
   *       // ...
   *     });
   *
   *     user.posts.create(function(body, function(err, post) {
   *       // ...
   *     });
   *
   * Specify a model using `params.through` to relate the other two models:
   *
   *     Post.hasMany(Tag, {
   *       as: 'tags',
   *       through: PostTag, // model with "tag_id" and "post_id" properties
   *       throughKey: 'tag_id',
   *       foreignKey: 'post_id'
   *     });
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

    if (params.throughKey && !params.through) {
      var name = this.type + anotherModel.type;
      if (this.type > anotherModel.type) {
        name = anotherModel.type + this.type;
      }
      params.through = exports.createModel(name);
      params.through.options.tableName = this.type + '_' + anotherModel.type;
      if (this.type > anotherModel.type) {
        params.through.options.tableName = (anotherModel.type + '_' + this.type).toLowerCase();
      }
      params.through
        .attr('id', { primary: true })
        .attr(params.throughKey)
        .attr(params.foreignKey);
    }

    this.relations.push(params);
    anotherModel.relations.push(params);
    if (params.through) {
      params.through.relations.push(params);
    }

    Object.defineProperty(this.prototype, params.as, {
      get: function() {
        return this.relation(params.as);
      }
    });

    return this;
  };

  /**
   * Define a "belongs to" relationship:
   *
   *     Post.belongsTo(User, {
   *       as: 'author',
   *       foreignKey: 'user_id'
   *     });
   *
   *     post.author.get(function(err, user) {
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

    this.relations.push(params);
    anotherModel.relations.push(params);

    Object.defineProperty(this.prototype, params.as, {
      get: function() {
        return this.relation(params.as);
      }
    });

    return this;
  };

  /**
   * Define a "has one" relationship:
   *
   *     User.hasOne(Subscription, {
   *       as: 'subscription',
   *       foreignKey: 'subscription_id'
   *     });
   *
   * Specify a model using `params.through` to relate the other two models:
   *
   *     User.hasOne(Group, {
   *       as: 'group',
   *       through: Membership,
   *       throughKey: 'group_id',
   *       foreignKey: 'user_id'
   *     });
   *
   * @param {Model} Owner
   * @param {Object} params The `foreignKey` name is required.
   * @api public
   */

  Model.hasOne = function(anotherModel, params) {
    if (!params.as) {
      params.as = anotherModel.type.toLowerCase() + 's';
    }

    params.type = 'has one';
    params.anotherModel = anotherModel;
    params.model = this;

    this.relations.push(params);
    anotherModel.relations.push(params);

    if (params.throughKey && !params.through) {
      var name = this.type + anotherModel.type;
      if (this.type > anotherModel.type) {
        name = anotherModel.type + this.type;
      }
      params.through = exports.createModel(name);
      params.through.options.tableName = this.type + '_' + anotherModel.type;
      if (this.type > anotherModel.type) {
        params.through.options.tableName = (anotherModel.type + '_' + this.type).toLowerCase();
      }
      params.through
        .attr('id', { primary: true })
        .attr(params.throughKey)
        .attr(params.foreignKey);
    }

    Object.defineProperty(this.prototype, params.as, {
      get: function() {
        return this.relation(params.as);
      }
    });

    return this;
  };

  Emitter(Model.prototype);
  Emitter(Model);

  if (options.thunks) {
    Model.prototype.save = thunkify(Model.prototype.save);
    Model.prototype.remove = thunkify(Model.prototype.remove);
    Model.findAll = thunkify(Model.findAll);
    Model.find = thunkify(Model.find);
    Model.count = thunkify(Model.count);
    Model.removeAll = thunkify(Model.removeAll);
  }

  // Aliases
  Model.all = Model.findAll;
  Model.get = Model.find;
  Model.findOne = Model.find;

  return Model;
};

/**
 * Wrap function to return thunk.
 *
 * See https://github.com/visionmedia/co/#thunks-vs-promises
 */

function thunkify(fn) {
  return function() {
    var args = Array.prototype.slice.call(arguments);
    var ctx = this;

    return function(cb) {
      args.push(cb);
      fn.apply(ctx, args);
    };
  };
};
