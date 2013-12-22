# mio

[![Build Status](https://secure.travis-ci.org/alexmingoia/mio.png)](http://travis-ci.org/alexmingoia/mio) 
[![Coverage Status](https://coveralls.io/repos/alexmingoia/mio/badge.png?branch=master)](https://coveralls.io/r/alexmingoia/mio?branch=master)
[![Bower version](https://badge.fury.io/bo/mio.png)](http://badge.fury.io/bo/mio)
[![NPM version](https://badge.fury.io/js/mio.png)](http://badge.fury.io/js/mio)
[![Dependency Status](https://david-dm.org/alexmingoia/mio.png)](http://david-dm.org/alexmingoia/mio)

Modern idiomatic models for the browser and node.js.

* Restrict enumerable properties to defined model attributes.
* Events emitted for initialization, attribute changes, errors, etc.
* Attribute validators and defaults.
* Computed properties (accessors) and sealed models.
* Usable seamlessly across the browser and server.
* Plugins specific to environment.
* Tests and MIT license.

## Installation

Using [npm][0]:

```sh
npm install mio
```

Using [component][1]:

```sh
component install alexmingoia/mio
```

Using [bower][2]:

```sh
bower install mio
```

## Usage

```javascript
var mio = require('mio');

var User = mio.createModel('user');

User
  .attr('id', {
    primary: true
  })
  .attr('name', {
    required: true
  })
  .attr('created_at', {
    required: true,
    default: function() {
      return new Date();
    }
  });

var user = new User({ name: 'alex' });
```

## API

### mio.createModel(name)

Create new model constructor with given `name`.

### mio.validators

Exported array of validators shipped with mio.

### Model.attr(name[, options])

Define an attribute with given `name` and `options`.

```javascript
User.attr('created_at', {
  type: 'date',
  required: true,
  default: function() {
    return new Date();
  }
});
```

### Model.use([env, ]plugin[, options])

Use a plugin function that extends the model.

* env `String` Either "browser" or "server". Optional.
* plugin `String|Function` Function or name of module to require.
* options `Mixed` If plugin is a string, additional arguments are passed to
  required plugin module.

```javascript
User
  .use(require('example-plugin'))
  .use('browser', 'mio-ajax', {
    url: 'api.example.com'
  })
  .use('server', function() {
    // this === User
    console.log(this.displayName);
    // => "User"
  });
```

### Model.type

```javascript
var User = mio.createModel('user');

console.log(User.type);
// => "User"
```

### Model.adapter

Storage adapter plugin.

### Model.validators

Array of validator functions. Validation plugins should add their validator
function here.

### Model.options

Plugins should use this object to store options.

### Model.find(id|query, callback)

```javascript
User.find(123, function(err, user) {
  // ...
});
```

### Model.findAll(query, callback)

```javascript
User.findAll({
  approved: true
}, function(err, collection) {
  console.log(collection);
  // => [user1, user2, user3, ...]
});
```

### Model.count(query, callback)

```javascript
User.count(function(err, count) {
  console.log(count);
  // => 47
});
```

### Model.removeAll(query, callback)

```javascript
User.removeAll({
  created: '2013-11-01'
}, function(err) {
  // ...
});
```

### Model.hasMany(anotherModel, options)

Define a "has many" relationship.

```javascript
User.hasMany(Post, {
  as: 'posts',
  foreignKey: 'user_id'
});

user.posts.all(function(err, posts) {
  // ...
});

user.posts.create(function(body, function(err, post) {
  // ...
});
```

Specify a model using `params.through` to relate the other two models:

```javascript
Post.hasMany(Tag, {
  as: 'tags',
  through: PostTag, // model with "tag_id" and "post_id" properties
  throughKey: 'tag_id',
  foreignKey: 'post_id'
});
```

### Model.belongsTo(anotherModel, options)

Define a "belongs to" relationship.

```javascript
Post.belongsTo(User, {
  as: 'author',
  foreignKey: 'user_id'
});

post.author.get(function(err, user) {
  // ...
});
```

### Model.hasOne(anotherModel, options)

Define a "has one" relationship.

```javascript
User.hasOne(Subscription, {
  as: 'subscription',
  foreignKey: 'subscription_id'
});
```

Specify a model using `params.through` to relate the other two models:

```javascript
User.hasOne(Group, {
  as: 'group',
  through: Membership,
  throughKey: 'group_id',
  foreignKey: 'user_id'
});
```

### Model#save(callback)

```javascript
user.save(function(err) {
  // ...
});
```

### Model#remove(callback)

```javascript
user.remove(function(err) {
  // ...
});
```

### Model#[attr]

### Model#isNew()

### Model#isValid()

Runs validators, repopulates model.errors array with any validation errors
encountered, and returns a boolean of whether the model validated.

### Model#isDirty()

Whether the model has attributes that have changed since last sav.

### Model#changed()

Return attributes changed since last save.

### Model#has(attribute)

### Model#error(message, attribute)

Generate and add error to `model.errors` array, and emit "error" event.

### Model#errors

Array of validation or other errors the model has encountered.

### Model#extras

A mutable object for saving extra information pertaining to the model instance.

### Model#[relation]

Query methods specific to `relation`, where `relation` is the `options.as`
parameter defined with `Model.hasMany()`, `.belongsTo()`, or `.hasOne()`.

```javascript
User.hasMany(Post, { as: 'posts', foreignKey: 'user_id' });

user.posts.all(function(err, posts) {
  // ...
});
```

### Model#[relation].add(model[, ...], callback)

```javascript
// Add post instance(s)
user.post.add(post1, post2, function(err) {});

// Add array of post instances
user.post.add([post1, post2], function(err) {});

// Add posts by post id
user.post.add(1, 3, function(err) {});
```

### Model#[relation].all([query, ]callback)

```javascript
user.post.all({
  created_at: '2013-10-31'
},
function(err, collection) {
  console.log(collection);
  // => [post1, post2, post3, ...]
});
```

### Model#[relation].count([query, ]callback)

```javascript
user.post.count({
  created_at: '2013-10-31'
},
function(err, count) {
  console.log(count);
  // => 64
});
```

### Model#[relation].create([body, ]callback)

```javascript
// Create and save related post from attributes
user.post.create({
  title: 'Hello World',
  content: 'My first post.',
},
function(err, post) {
  // ...
});

// Create multiple related posts by padding multiple attributes objects.
user.post.create(
  { title: 'Post 1' },
  { title: 'Post 2' },
  function(err, post1, post2) {
    // ...
  }
);
```

### Model#[relation].get([query, ]callback)

```javascript
post.author.get(function(err, user) {
  // ...
});
```

### Model#[relation].has(model[, ...], callback)

```javascript
user.post.has(post, function(err, isRelated) {
  console.log(isRelated);
  // => true
});
```

### Model#[relation].remove(model[, ...], callback)

```javascript
// Remove post instance(s)
user.post.remove(post1, post2, function(err) {});

// Remove array of post instances
user.post.remove([post1, post2], function(err) {});

// Remove posts by post id
user.post.remove(1, 3, function(err) {});
```

### Events

#### Model events

##### initializing

Receives arguments `model` and `attributes`.

##### initialized

Receives argument `model`.

##### setting

Receives arguments `model` and `attributes`.

##### change

Receives arguments `model`, `name`, `value`, and `prev`.

##### change:[attr]

Receives arguments `model`, `value`, and `prev`.

##### attribute

Receives arguments `name` and `params`.

##### before save

##### after save

##### before remove

##### after remove

##### error

Receives arguments `model` and `error`.

#### Instance events

##### setting

Receives argument `attributes`.

##### change

Receives arguments `name`, `value`, and `prev`.

##### change:[attr]

Receives arguments `value`, and `prev`.

##### before save

##### after save

##### before remove

##### after remove

##### error

Receives argument `error`.

## MIT Licensed

[0]: https://npmjs.org/
[1]: https://github.com/component/component/
[2]: http://bower.io/
