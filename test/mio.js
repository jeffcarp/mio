var mio = require('../lib/mio');
var should = require('should');

describe('mio', function() {
  describe('.createModel()', function() {
    it('creates new models', function() {
      var Model = mio.createModel('user');
      Model.type.should.equal('User');
    });
  });
});

describe('Model', function() {
  it('inherits from EventEmitter', function() {
    var Model = mio.createModel('user');
    Model.should.have.property('emit');
    Model.should.have.property('on');
  });

  it('emits "initializing" event', function(done) {
    var Model = mio.createModel('user')
      .on('initializing', function(model, attrs) {
        should.exist(model);
        model.should.have.property('constructor', Model);
        should.exist(attrs);
        done();
      });
    new Model();
  });

  it('emits "initialized" event', function(done) {
    var Model = mio.createModel('user')
      .on('initialized', function(model) {
        should.exist(model);
        model.should.have.property('constructor', Model);
        done();
      });
    new Model();
  });

  it('emits "change" events', function(done) {
    var Model = mio.createModel('user')
      .attr('id', { primary: true })
      .attr('name')
      .on('change', function(model, name, value, prev) {
        should.exist(model);
        model.should.have.property('constructor', Model);
        name.should.equal('name');
        value.should.equal('alex');
        should.equal(prev, undefined);
        done();
      });
    var model = new Model();
    model.name = 'alex';
  });

  describe('.attr()', function() {
    it('throws error if defining two primary keys', function() {
      var Model = mio.createModel('user');
      Model.attr('id', { primary: true });
      (function() {
        Model.attr('_id', { primary: true });
      }).should.throw('Primary attribute already exists: id');
    });

    it('emits "attribute" event', function(done) {
      var Model = mio.createModel('user')
        .on('attribute', function(name, params) {
          should.exist(name);
          name.should.equal('id');
          should.exist(params);
          params.should.have.property('primary', true);
          done();
        });
      Model.attr('id', { primary: true });
    });
  });

  describe('.use()', function() {
    it('extends model', function() {
      var Model = mio.createModel('user');
      Model.use(function() {
        this.test = 1;
      });
      Model.should.have.property('test', 1);
    });
  });

  describe('.create()', function() {
    it('creates new models', function() {
      var Model = mio.createModel('user');
      var model = Model.create();
      should.exist(model);
      model.should.be.instanceOf(Model);
    });

    it('hydrates model from existing object', function() {
      var Model = mio.createModel('user').attr('id', { primary: true });
      var model = Model.create({ id: 1 });
      model.should.have.property('id', 1);
    });
  });

  describe('.find()', function() {
    it('finds models by id', function(done) {
      var Model = mio.createModel('user').attr('id', { primary: true });
      Model.find(1, function(err, model) {
        if (err) return done(err);
        done();
      });
    });

    it("uses adapter's find method", function(done) {
      var Model = mio.createModel('user').attr('id', { primary: true });
      Model.adapter.find = function(query, cb) {
        cb(null, { id: 1 });
      };
      Model.find(1, function(err, model) {
        if (err) return done(err);
        should.exist(model);
        model.should.have.property('id', 1);
        done();
      });
    });

    it('passes error from adapter to callback', function(done) {
      var Model = mio.createModel('user').attr('id', { primary: true });
      Model.adapter.find = function(query, cb) {
        cb(new Error('test'));
      };
      Model.find(1, function(err, model) {
        should.exist(err);
        err.should.have.property('message', 'test')
        done();
      });
    });
  });

  describe('.findAll()', function() {
    it('finds collection of models using query', function(done) {
      var Model = mio.createModel('user').attr('id', { primary: true });
      Model.findAll(function(err, collection) {
        if (err) return done(err);
        should.exist(collection);
        Model.findAll({ id: 1 }, function(err, collection) {
          done();
        });
      });
    });

    it("uses adapter's findAll method", function(done) {
      var Model = mio.createModel('user').attr('id', { primary: true });
      Model.adapter.findAll = function(query, cb) {
        cb(null, [{ id: 1 }]);
      };
      Model.findAll(function(err, collection) {
        if (err) return done(err);
        should.exist(collection);
        collection.should.have.property('length', 1);
        collection[0].should.have.property('constructor', Model);
        done();
      });
    });

    it('passes error from adapter to callback', function(done) {
      var Model = mio.createModel('user').attr('id', { primary: true });
      Model.adapter.findAll = function(query, cb) {
        cb(new Error('test'));
      };
      Model.findAll(function(err, collection) {
        should.exist(err);
        err.should.have.property('message', 'test')
        done();
      });
    });
  });

  describe('.count()', function() {
    it('counts models using query', function(done) {
      var Model = mio.createModel('user').attr('id', { primary: true });
      Model.count(function(err, count) {
        if (err) return done(err);
        should.exist(count);
        Model.count({ id: 1 }, function(err, count) {
          done();
        });
      });
    });

    it("uses adapter's count method", function(done) {
      var Model = mio.createModel('user').attr('id', { primary: true });
      Model.adapter.count = function(query, cb) {
        cb(null, 3);
      };
      Model.count(function(err, count) {
        if (err) return done(err);
        should.exist(count);
        count.should.equal(3);
        done();
      });
    });

    it('passes error from adapter to callback', function(done) {
      var Model = mio.createModel('user').attr('id', { primary: true });
      Model.adapter.count = function(query, cb) {
        cb(new Error('test'));
      };
      Model.count(function(err, collection) {
        should.exist(err);
        err.should.have.property('message', 'test')
        done();
      });
    });
  });

  describe('.removeAll()', function() {
    it('removes models using query', function(done) {
      var Model = mio.createModel('user').attr('id', { primary: true });
      Model.removeAll(function(err) {
        if (err) return done(err);
        Model.removeAll({ id: 1 }, function(err) {
          done();
        });
      });
    });

    it("uses adapter's removeAll method", function(done) {
      var Model = mio.createModel('user').attr('id', { primary: true });
      var model = Model.create({ id: 1 });
      Model.adapter.removeAll = function(query, cb) {
        cb();
      };
      Model.removeAll(function(err) {
        if (err) return done(err);
        done();
      });
    });

    it('passes error from adapter to callback', function(done) {
      var Model = mio.createModel('user').attr('id', { primary: true });
      var model = Model.create({ id: 1 });
      Model.adapter.removeAll = function(query, cb) {
        cb(new Error('test'));
      };
      Model.removeAll(function(err) {
        should.exist(err);
        err.should.have.property('message', 'test')
        done();
      });
    });
  });

  describe('#isNew()', function() {
    it('checks whether primary attribute is set', function() {
      var Model = mio.createModel('user').attr('id', { primary: true });
      var m1 = Model.create();
      m1.isNew().should.equal(true);
      var m2 = Model.create({ id: 1 });
      m2.isNew().should.equal(false);
    });
  });

  describe('#has()', function() {
    it('checks for attribute definition', function() {
      var Model = mio.createModel('user').attr('id', { primary: true });
      var model = Model.create({ id: 1 });
      model.has('name').should.equal(false);
      model.has('id').should.equal(true);
    });
  });

  describe('#set()', function() {
    it('sets values for defined attributes', function() {
      var Model = mio.createModel('user')
        .attr('id', { primary: true })
        .attr('name');
      var model = Model.create({ id: 1, name: 'alex', age: 26 });
      model.id.should.equal(1);
      model.name.should.equal('alex');
      model.should.not.have.property('age');
    });

    it('emits "setting" event', function(done) {
      var Model = mio.createModel('user')
        .attr('id', { primary: true })
        .attr('name')
        .on('setting', function(model, attrs) {
          should.exist(model);
          model.should.have.property('constructor', Model);
          should.exist(attrs);
          attrs.should.have.property('name', 'alex');
          done();
        });
      var model = new Model();
      model.set({ name: 'alex' });
    });
  });

  describe('#isValid()', function() {
    it('runs Model.validators functions', function(done) {
      var Model = mio.createModel('user')
        .attr('id', { primary: true })
        .use(function() {
          this.validators.push(function() {
            done();
          });
        });
      var model = Model.create({ id: 1 });
      model.isValid();
    });

    it('returns whether model is valid', function() {
      var Model = mio.createModel('user')
        .attr('id', { primary: true })
        .use(function() {
          this.validators.push(function() {
            return;
          });
        });
      var model = Model.create({ id: 1 });
      model.isValid().should.equal(true);
    });

    it('adds errors to model.errors array', function() {
      var Model = mio.createModel('user')
        .attr('id', { primary: true })
        .use(function() {
          this.validators.push(function() {
            this.error('id field is required', 'id');
          });
        });
      var model = Model.create();
      model.isValid().should.equal(false);
      model.errors.length.should.equal(1);
    });
  });

  describe('#isDirty()', function() {
    it('returns whether model is changed/dirty', function() {
      var Model = mio.createModel('user').attr('id', { primary: true });
      var model = Model.create();
      model.isDirty().should.equal(false);
      model.id = 1;
      model.isDirty().should.equal(true);
    });
  });

  describe('#changed()', function() {
    it('returns attributes changed since last save', function() {
      var Model = mio.createModel('user')
        .attr('id', { primary: true })
        .attr('name');
      var model = Model.create({ id: 1 });
      model.name = 'alex';
      should(model.changed()).have.property('name', 'alex');
    });
  });

  describe('#save()', function() {
    it('validates before saving', function() {
      var Model = mio.createModel('user')
        .attr('id', { primary: true, required: true });
      var model = Model.create();
      (function() {
        model.save();
      }).should.throw("Validations failed.");
    });

    it("uses adapter's save method", function(done) {
      var Model = mio.createModel('user')
        .attr('id', { primary: true, required: true })
        .use(function() {
          this.adapter.save = function(changed, cb) {
            should(changed).have.property('id', 1);
            cb();
          };
        });
      var model = Model.create({ id: 1 });
      model.save(function(err) {
        should.not.exist(err);
        model.id.should.equal(1);
        done();
      });
    });

    it("passes error from adapter to callback", function(done) {
      var Model = mio.createModel('user')
        .attr('id', { primary: true })
        .use(function() {
          this.adapter.save = function(changed, cb) {
            cb(new Error("test"));
          };
        });
      var model = Model.create();
      model.save(function(err) {
        should.exist(err);
        err.message.should.equal('test');
        done();
      });
    });

    it('emits "before save" event', function(done) {
      var Model = mio.createModel('user').attr('id', { primary: true });
      Model.on('before save', function(model, changed) {
        should.exist(model);
        model.constructor.should.equal(Model);
        should.exist(changed);
      });
      var model = Model.create({ id: 1 });
      model.on('before save', function(changed) {
        should.exist(changed);
        done();
      }).save(function(err) { });
    });

    it('emits "after save" event', function(done) {
      var Model = mio.createModel('user').attr('id', { primary: true });
      Model.on('after save', function(model) {
        should.exist(model);
      });
      var model = Model.create({ id: 1 });
      model.on('after save', function() {
        done();
      }).save(function(err) { });
    });
  });

  describe('#remove()', function() {
    it("uses adapter's remove method", function(done) {
      var Model = mio.createModel('user')
        .attr('id', { primary: true, required: true })
        .use(function() {
          this.adapter.remove = function(id, cb) {
            id.should.equal(1);
            cb();
          };
        });
      var model = Model.create({ id: 1 });
      model.remove(function(err) {
        should.not.exist(err);
        model.should.have.property('id', null);
        done();
      });
    });

    it("passes error from adapter to callback", function(done) {
      var Model = mio.createModel('user')
        .attr('id', { primary: true, required: true })
        .use(function() {
          this.adapter.remove = function(id, cb) {
            cb(new Error("test"));
          };
        });
      var model = Model.create({ id: 1 });
      model.remove(function(err) {
        should.exist(err);
        err.message.should.equal('test');
        done();
      });
    });

    it('emits "before remove" event', function(done) {
      var Model = mio.createModel('user').attr('id', { primary: true });
      Model.on('before remove', function(model) {
        should.exist(model);
        model.constructor.should.equal(Model);
      });
      var model = Model.create({ id: 1 });
      model.on('before remove', function() {
        done();
      }).remove(function(err) { });
    });

    it('emits "after remove" event', function(done) {
      var Model = mio.createModel('user').attr('id', { primary: true });
      Model.on('after remove', function(model) {
        should.exist(model);
      });
      var model = Model.create({ id: 1 });
      model.on('after remove', function() {
        done();
      }).remove(function(err) { });
    });
  });

  describe('#error()', function() {
    it('adds error to model.errors array', function() {
      var Model = mio.createModel('user').attr('id', { primary: true });
      var model = Model.create({ id: 1 });
      var error = model.error('test');
      model.errors.length.should.equal(1);
      model.errors[0].should.equal(error);
    });

    it('emits "error" event', function(done) {
      var Model = mio.createModel('user')
        .attr('id', { primary: true })
        .on('error', function(m, error) {
          should.exist(m);
          m.should.equal(model);
          should.exist(error);
          error.should.have.property('message', 'test');
          done();
        });
      var model = Model.create({ id: 1 });
      model.error('test');
    });
  });
});
