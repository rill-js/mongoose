const _ = require('lodash')
const test = require('tape')
const rill = require('rill')
const mongoose = require('mongoose')
const agent = require('supertest')
const resource = require('../lib')
const DATA = require('./data.json')
const UNUSED_ID = '000000000000000000000000'
const VISIBLE = ['_id', 'name', 'test', 'related']

test.onFinish(process.exit)

mongoose.connect('localhost/testDb')
mongoose.Promise = Promise

const Model = mongoose.model('test', {
  name: { type: String, required: true },
  test: { type: Boolean },
  hidden: { type: String, hidden: true },
  related: { type: mongoose.Schema.ObjectId, ref: 'test' }
})

reset()
;test('GET', function (t) {
  t.plan(13)

  const request = agent(rill()
    .use(require('@rill/body')())
    .setup(resource(Model, { find: 'default', findById: 'default' }))
    .listen())

  // GET all
  request
    .get('/test')
    .expect(200)
    .expect('x-max-results', '10')
    .then(function (res) {
      const expected = _.map(DATA, _.partial(_.pick, _, VISIBLE))
      t.deepEqual(res.body, expected, 'GET all documents')
    }, t.fail)

  // GET search (results 1)
  request
    .get('/test')
    .query({ name: DATA[0].name })
    .expect(200)
    .expect('x-max-results', '1')
    .then(function (res) {
      const expected = [_.pick(DATA[0], VISIBLE)]
      t.deepEqual(res.body, expected, 'GET search documents')
    }, t.fail)

  // GET search (results 0)
  request
    .get('/test')
    .query({ name: 'no such thing' })
    .expect(200)
    .expect('x-max-results', '0')
    .then(t.pass.bind(t, 'GET search no document'), t.fail)

  // GET limit (results 5)
  request
    .get('/test')
    .query({ $limit: 5 })
    .expect(200)
    .expect('x-max-results', '10')
    .expect('x-total-results', '5')
    .then(function (res) {
      const expected = _.take(_.map(DATA, _.partial(_.pick, _, VISIBLE)), 5)
      t.deepEqual(res.body, expected, 'GET limited documents')
    }, t.fail)

  // GET skip (results 5)
  request
    .get('/test')
    .query({ $skip: 5 })
    .expect(200)
    .expect('x-max-results', '10')
    .expect('x-total-results', '5')
    .then(function (res) {
      const expected = _.drop(_.map(DATA, _.partial(_.pick, _, VISIBLE)), 5)
      t.deepEqual(res.body, expected, 'GET skipped documents')
    }, t.fail)

  // GET sort asc
  request
    .get('/test')
    .query({ $sort: 'name' })
    .expect(200)
    .expect('x-max-results', '10')
    .then(function (res) {
      const expected = _.sortBy(_.map(DATA, _.partial(_.pick, _, VISIBLE)), 'name')
      t.deepEqual(res.body, expected, 'GET sorted asc documents')
    }, t.fail)

  // GET sort desc
  request
    .get('/test')
    .query({ $sort: '-name' })
    .expect(200)
    .expect('x-max-results', '10')
    .then(function (res) {
      const expected = _.reverse(_.sortBy(_.map(DATA, _.partial(_.pick, _, VISIBLE)), 'name'))
      t.deepEqual(res.body, expected, 'GET sorted desc documents')
    }, t.fail)

  // GET sort order
  request
    .get('/test')
    .query({ $sort: 'test name' })
    .expect(200)
    .expect('x-max-results', '10')
    .then(function (res) {
      const expected = _.sortBy(_.map(DATA, _.partial(_.pick, _, VISIBLE)), ['test', 'name'])
      t.deepEqual(res.body, expected, 'GET sorted (name, test) documents')
    }, t.fail)

  // GET select
  request
    .get('/test')
    .query({ $select: '-_id name' })
    .expect(200)
    .expect('x-max-results', '10')
    .then(function (res) {
      const expected = _.map(DATA, _.partial(_.pick, _, 'name'))
      t.deepEqual(res.body, expected, 'GET select (name) documents')
    }, t.fail)

  // GET/id populate
  request
    .get('/test/' + DATA[0]._id)
    .query({ $populate: 'related[name]' })
    .expect(200)
    .expect('x-max-results', '1')
    .then(function (res) {
      const expected = _.pick(DATA[0], VISIBLE)
      expected.related = _.pick(expected, ['name', '_id'])
      t.deepEqual(res.body, expected, 'GET populate/select (name) documents')
    }, t.fail)

  // GET/id populate-deep
  request
    .get('/test/' + DATA[0]._id)
    .query({ $populate: 'related:related[name]' })
    .expect(200)
    .expect('x-max-results', '1')
    .then(function (res) {
      const expected = _.assign(_.pick(DATA[0], VISIBLE), {
        related: _.assign(_.pick(DATA[0], VISIBLE), {
          related: _.pick(DATA[0], ['name', '_id'])
        })
      })

      t.deepEqual(res.body, expected, 'GET populate-deep/select (name) documents')
    }, t.fail)

  // GET/id (results 1)
  request
    .get('/test/' + DATA[0]._id)
    .expect(200)
    .expect('x-max-results', '1')
    .then(t.pass.bind(t, 'GET one document'), t.fail)

  // GET/id (results 0)
  request
    .get('/test/' + UNUSED_ID)
    .expect(204)
    .expect('x-max-results', '0')
    .then(t.pass.bind(t, 'GET one no document'), t.fail)
})

reset()
;test('POST', function (t) {
  t.plan(4)

  const request = agent(rill()
    .use(require('@rill/body')())
    .setup(resource(Model, { create: 'default' }))
    .listen())

  const validDoc = {
    name: 'Dylan Piercey',
    test: true,
    hidden: 'Wow wow wow, what are you doing?',
    extra: 'Get outa here!'
  }

  request
    .post('/test')
    .send(validDoc)
    .expect(201)
    .then(function (res) {
      const actual = _.omit(res.body, '_id')
      const expected = _.omit(validDoc, ['hidden', 'extra'])
      t.deepEqual(actual, expected, 'POST document')

      // Make sure hidden didn't make it into the database.
      Model.findById(res.body._id).then(function (doc) {
        t.equal(doc.hidden, undefined, 'POST hidden field')
        t.equal(doc.extra, undefined, 'POST extra field')
      })
    }, t.fail)

  request
    .post('/test')
    .send(_.assign(_.clone(validDoc), { name: null }))
    .expect(400)
    .expect('X-Error-Message', 'Path `name` is required.')
    .then(t.pass.bind(t, 'POST validation'), t.fail)
})

reset()
;test('PUT', function (t) {
  t.plan(3)

  const request = agent(rill()
    .use(require('@rill/body')())
    .setup(resource(Model, { create: 'default', save: 'default' }))
    .listen())

  const validDoc = {
    name: 'Dylan Piercey',
    test: true
  }

  const putDoc = {
    name: 'New Name'
  }

  // Create test doc.
  request
    .post('/test')
    .send(validDoc)
    .expect(201)
    .then(function (res) {
      const testDoc = res.body

      request
        .put('/test/' + testDoc._id)
        .send(putDoc)
        .expect(200)
        .then(function (res) {
          const actual = _.omit(res.body, '_id')
          t.deepEqual(actual, putDoc, 'PUT document')
        }, t.fail)

      request
        .put('/test/' + testDoc._id)
        .send(_.assign(_.clone(validDoc), { name: null }))
        .expect(400)
        .expect('X-Error-Message', 'Path `name` is required.')
        .then(t.pass.bind(t, 'PUT validation'), t.fail)
    }, t.fail)

  request
    .put('/test/' + UNUSED_ID)
    .expect(204)
    .then(t.pass.bind(t, 'PUT no document'), t.fail)
})

reset()
;test('PATCH', function (t) {
  t.plan(3)

  const request = agent(rill()
    .use(require('@rill/body')())
    .setup(resource(Model, { create: 'default', save: 'default' }))
    .listen())

  const validDoc = {
    name: 'Dylan Piercey',
    test: true
  }

  const patchDoc = {
    name: 'New Name'
  }

  // Create test doc.
  request
    .post('/test')
    .send(validDoc)
    .expect(201)
    .then(function (res) {
      const testDoc = res.body

      request
        .patch('/test/' + testDoc._id)
        .send(patchDoc)
        .expect(200)
        .then(function (res) {
          const actual = _.omit(res.body, '_id')
          const expected = _.assign(_.clone(validDoc), patchDoc)
          t.deepEqual(actual, expected, 'PATCH document')
        }, t.fail)

      request
        .patch('/test/' + testDoc._id)
        .send(_.assign(_.clone(validDoc), { name: null }))
        .expect(400)
        .expect('X-Error-Message', 'Path `name` is required.')
        .then(t.pass.bind(t, 'PATCH validation'), t.fail)
    }, t.fail)

  request
    .patch('/test/' + UNUSED_ID)
    .expect(204)
    .then(t.pass.bind(t, 'PATCH no document'), t.fail)
})

reset()
;test('DELETE', function (t) {
  t.plan(2)

  const request = agent(rill()
    .use(require('@rill/body')())
    .setup(resource(Model, { remove: 'default' }))
    .listen())

  request
    .delete('/test/' + DATA[0]._id)
    .expect(200)
    .then(function (res) {
      Model.count().then(function (count) {
        t.equal(count, _.size(DATA) - 1, 'DELETE one document')
      })
    }, t.fail)

  request
    .delete('/test/' + UNUSED_ID)
    .expect(204)
    .then(t.pass.bind(t, 'DELETE no document'), t.fail)
})

reset()
;test('OVERRIDES', function (t) {
  t.plan(5)

  const request = agent(rill()
    .use(require('@rill/body')())
    .setup(resource(Model, {
      find: respondWith(200, 'find'),
      findById: respondWith(200, 'findById'),
      create: respondWith(200, 'create'),
      save: respondWith(200, 'save'),
      remove: respondWith(200, 'remove')
    }))
    .listen())

  function respondWith (status, message) {
    return function (ctx) {
      ctx.res.status = 200
      ctx.res.body = { message: message }
    }
  }

  request
    .get('/test')
    .expect(200)
    .then(function (res) {
      t.deepEqual(res.body, { message: 'find' }, 'OVERRIDE GET')
    }, t.fail)

  request
    .post('/test')
    .expect(200)
    .then(function (res) {
      t.deepEqual(res.body, { message: 'create' }, 'OVERRIDE POST')
    }, t.fail)

  request
    .put('/test/1')
    .expect(200)
    .then(function (res) {
      t.deepEqual(res.body, { message: 'save' }, 'OVERRIDE PUT')
    }, t.fail)

  request
    .patch('/test/1')
    .expect(200)
    .then(function (res) {
      t.deepEqual(res.body, { message: 'save' }, 'OVERRIDE PATCH')
    }, t.fail)

  request
    .delete('/test/1')
    .expect(200)
    .then(function (res) {
      t.deepEqual(res.body, { message: 'remove' }, 'OVERRIDE DELETE')
    }, t.fail)
})

function reset () {
  test('-----------RESET----------', function (t) {
    t.plan(1)

    Model
      .remove({})
      .then(Model.create.apply(Model, _.clone(DATA)))
      .then(t.pass.bind(t, ' '))
  })
}
