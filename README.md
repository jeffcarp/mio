# mio

[![Build Status](https://secure.travis-ci.org/alexmingoia/mio.png)](http://travis-ci.org/alexmingoia/mio) 
[![Dependency Status](https://david-dm.org/alexmingoia/mio.png)](http://david-dm.org/alexmingoia/mio)

Modern idiomatic models for client and server.

## Installation

Using [npm][0]:

```sh
npm install mio
```

Using [component][1]:

```sh
npm install alexmingoia/mio
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

Exported validators shipped with mio.

### Model.attr(name[, options])

### Model.use(fn)

### Model.displayName

### Model.validators

Array of validator functions. Validation plugins should add their validator
function here.

### Model.options

Plugins should use this object to store options.

### Model.find(id|query, callback)

### Model.findAll(query, callback)

### Model.count(query, callback)

### Model.removeAll(query, callback)

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

### Events

#### Model

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

#### Instance

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
