# mio

[![Build Status](https://secure.travis-ci.org/alexmingoia/mio.png)](http://travis-ci.org/alexmingoia/mio) 
[![Coverage Status](https://coveralls.io/repos/alexmingoia/mio/badge.png?branch=master)](https://coveralls.io/r/alexmingoia/mio?branch=master)
[![Bower version](https://badge.fury.io/bo/mio.png)](http://badge.fury.io/bo/mio)
[![NPM version](https://badge.fury.io/js/mio.png)](http://badge.fury.io/js/mio)
[![Dependency Status](https://david-dm.org/alexmingoia/mio.png)](http://david-dm.org/alexmingoia/mio)

Modern idiomatic models for the browser and node.js.

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
  .attr('id', { primary: true })
  .attr('name', { required: true })
  .attr('password', { required: true });

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

### Model.findAll(query, callback)

### Model.count(query, callback)

### Model.removeAll(query, callback)

### Model.hasMany(anotherModel, options)

Define a "has many" relationship.

```javascript
User.hasMany(Post, { as: 'posts', foreignKey: 'user_id' });

user.related('posts').all(function(err, posts) {
  // ...
});

user.related('posts').create(function(body, function(err, post) {
  // ...
});
```

### Model.belongsTo(anotherModel, options)

Define a "belongs to" relationship.

```javascript
User.belongsTo(Post, { as: 'author', foreignKey: 'user_id' });

post.related('author').get(function(err, user) {
  // ...
});
```

### Model.hasAndBelongsToMany(anotherModel, options)

Define a "has and belongs to many" relationship.

```javascript
User.hasAndBelongsToMany(Post, {
  as: 'posts',
  through: PostUser,
  fromKey: 'user_id',
  toKey: 'post_id'
});
```

### Model#save(callback)

### Model#remove(callback)

### Model#[attr]

### Model#isNew()

### Model#isValid()

### Model#isDirty()

Whether the model has attributes that have changed since last sav.

### Model#changed()

Return attributes changed since last save.

### Model#set(attributes)

### Model#has(attribute)

### Model#error(message, attribute)

Generate and add error to `model.errors` array, and emit "error" event.

### Model#errors

Array of validation or other errors the model has encountered.

### Model#related()

```javascript
User.hasMany(Post, { as: 'posts', foreignKey: 'user_id' });

user.related('posts').all(function(err, posts) {
  // ...
});
```

### Model#related(relation).add(model[, ...], callback)

```javascript
// Add post instance(s)
user.related('post').add(post1, post2, function(err) {});

// Add array of post instances
user.related('post').add([post1, post2], function(err) {});

// Add posts by post id
user.related('post').add(1, 3, function(err) {});
```

### Model#related(relation).all([query, ]callback)

### Model#related(relation).count([query, ]callback)

### Model#related(relation).create([body, ]callback)

```javascript
// Create and save related post from attributes
user.related('post').create({
  title: 'Hello World',
  content: 'My first post.',
}, function(err, post) {
  // ...
});

// Create multiple related posts by padding multiple attributes objects.
user.related('post').create(
  { title: 'Post 1' },
  { title: 'Post 2' },
  function(err, post1, post2) {
    // ...
  }
);
```

### Model#related(relation).get([query, ]callback)

### Model#related(relation).has(model[, ...], callback)

### Model#related(relation).remove(model[, ...], callback)

```javascript
// Remove post instance(s)
user.related('post').remove(post1, post2, function(err) {});

// Remove array of post instances
user.related('post').remove([post1, post2], function(err) {});

// Remove posts by post id
user.related('post').remove(1, 3, function(err) {});
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
