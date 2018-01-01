const _ = require('lodash')
const assert = require('assert')
const rill = require('rill')
const mongoose = require('mongoose')
const agent = require('supertest')
const resource = require('../lib')
const DATA = require('./data.json')
const UNUSED_ID = '000000000000000000000000'
const VISIBLE = ['_id', 'name', 'test', 'related']
const Model = mongoose.model('test', {
  name: { type: String, required: true },
  test: { type: Boolean },
  hidden: { type: String, hidden: true },
  related: { type: mongoose.Schema.ObjectId, ref: 'test' }
})

describe('@rill/mongoose', () => {
  before(() => mongoose.connect('mongodb://localhost/rill-mongoose-test'))
  after(() => mongoose.disconnect())

  // Reset database.
  beforeEach(() => {
    return Model
      .remove()
      .then(() => {
        return _.reduce(_.clone(DATA), (p, doc) => p.then(() => {
          return Model.create(doc)
        }), Promise.resolve())
      })
  })

  describe('GET', () => {
    const request = agent(rill()
      .use(require('@rill/body')())
      .use(resource(Model, { find: 'default', findById: 'default' }))
      .listen()
      .unref())

    it('should get all', () => {
      return request
        .get('/test')
        .expect(200)
        .expect('x-total-count', '10')
        .then((res) => {
          const expected = _.map(DATA, _.partial(_.pick, _, VISIBLE))
          assert.deepEqual(res.body, expected, 'GET all documents')
        })
    })

    it('should search and find one doc', () => {
      return request
        .get('/test')
        .query({ name: DATA[0].name })
        .expect(200)
        .expect('x-total-count', '1')
        .then((res) => {
          const expected = [_.pick(DATA[0], VISIBLE)]
          assert.deepEqual(res.body, expected, 'GET search documents')
        })
    })

    it('should search and find no docs', () => {
      return request
        .get('/test')
        .query({ name: 'no such thing' })
        .expect(200)
        .expect('x-total-count', '0')
    })

    it('should limit to 5 docs', () => {
      return request
        .get('/test')
        .query({ $limit: 5 })
        .expect(200)
        .expect('x-total-count', '10')
        .then((res) => {
          const expected = _.take(_.map(DATA, _.partial(_.pick, _, VISIBLE)), 5)
          assert.deepEqual(res.body, expected, 'GET limited documents')
        })
    })

    it('should skip 5 docs', () => {
      return request
        .get('/test')
        .query({ $skip: 5 })
        .expect(200)
        .expect('x-total-count', '10')
        .then((res) => {
          const expected = _.drop(_.map(DATA, _.partial(_.pick, _, VISIBLE)), 5)
          assert.deepEqual(res.body, expected, 'GET skipped documents')
        })
    })

    it('should sort docs asc', () => {
      return request
        .get('/test')
        .query({ $sort: 'name' })
        .expect(200)
        .expect('x-total-count', '10')
        .then((res) => {
          const expected = _.sortBy(_.map(DATA, _.partial(_.pick, _, VISIBLE)), 'name')
          assert.deepEqual(res.body, expected, 'GET sorted asc documents')
        })
    })

    it('should sort docs desc', () => {
      return request
        .get('/test')
        .query({ $sort: '-name' })
        .expect(200)
        .expect('x-total-count', '10')
        .then((res) => {
          const expected = _.reverse(_.sortBy(_.map(DATA, _.partial(_.pick, _, VISIBLE)), 'name'))
          assert.deepEqual(res.body, expected, 'GET sorted desc documents')
        })
    })

    it('should sort multiple fields', () => {
      return request
        .get('/test')
        .query({ $sort: 'test name' })
        .expect(200)
        .expect('x-total-count', '10')
        .then((res) => {
          const expected = _.sortBy(_.map(DATA, _.partial(_.pick, _, VISIBLE)), ['test', 'name'])
          assert.deepEqual(res.body, expected, 'GET sorted (name, test) documents')
        })
    })

    it('should select fields', () => {
      return request
        .get('/test')
        .query({ $select: '-_id name' })
        .expect(200)
        .expect('x-total-count', '10')
        .then((res) => {
          const expected = _.map(DATA, _.partial(_.pick, _, 'name'))
          assert.deepEqual(res.body, expected, 'GET select (name) documents')
        })
    })

    it('should populate fields', () => {
      return request
        .get('/test/' + DATA[0]._id)
        .query({ $populate: 'related[name]' })
        .expect(200)
        .expect('x-total-count', '1')
        .then((res) => {
          const expected = _.pick(DATA[0], VISIBLE)
          expected.related = _.pick(expected, ['name', '_id'])
          assert.deepEqual(res.body, expected, 'GET populate/select (name) documents')
        })
    })

    it('should populate nested fields', () => {
      return request
        .get('/test/' + DATA[0]._id)
        .query({ $populate: 'related:related[name]' })
        .expect(200)
        .expect('x-total-count', '1')
        .then((res) => {
          const expected = _.assign(_.pick(DATA[0], VISIBLE), {
            related: _.assign(_.pick(DATA[0], VISIBLE), {
              related: _.pick(DATA[0], ['name', '_id'])
            })
          })

          assert.deepEqual(res.body, expected, 'GET populate-deep/select (name) documents')
        })
    })

    it('should find a doc by id', () => {
      return request
        .get('/test/' + DATA[0]._id)
        .expect(200)
        .expect('x-total-count', '1')
    })

    it('should not find a doc when id doesnt exist', () => {
      return request
        .get('/test/' + UNUSED_ID)
        .expect(204)
        .expect('x-total-count', '0')
    })
  })

  describe('POST', () => {
    const request = agent(rill()
      .use(require('@rill/body')())
      .use(resource(Model, { create: 'default' }))
      .listen()
      .unref())

    const validDoc = {
      name: 'Dylan Piercey',
      test: true,
      hidden: 'Wow wow wow, what are you doing?',
      extra: 'Get outa here!'
    }

    it('should add a new doc', () => {
      return request
        .post('/test')
        .send(validDoc)
        .expect(201)
        .then((res) => {
          const actual = _.omit(res.body, '_id')
          const expected = _.omit(validDoc, ['hidden', 'extra'])
          assert.deepEqual(actual, expected, 'POST document')

          // Make sure hidden didn't make it into the database.
          return Model.findById(res.body._id).then((doc) => {
            assert.equal(doc.hidden, undefined, 'POST hidden field')
            assert.equal(doc.extra, undefined, 'POST extra field')
          })
        })
    })

    it('should throw a validation error', () => {
      return request
        .post('/test')
        .send(_.assign(_.clone(validDoc), { name: null }))
        .expect(400)
        .expect('X-Error-Message', 'Path `name` is required.')
    })
  })

  describe('PUT', () => {
    const request = agent(rill()
      .use(require('@rill/body')())
      .use(resource(Model, { create: 'default', save: 'default' }))
      .listen()
      .unref())

    const validDoc = {
      name: 'Dylan Piercey',
      test: true
    }

    const putDoc = {
      name: 'New Name'
    }

    // Create test doc.
    const createTestDoc = () => request
      .post('/test')
      .send(validDoc)
      .expect(201)
      .then((res) => res.body)

    it('should update doc', () => {
      return createTestDoc().then(testDoc => {
        return request
          .put('/test/' + testDoc._id)
          .send(putDoc)
          .expect(200)
          .then((res) => {
            const actual = _.omit(res.body, '_id')
            assert.deepEqual(actual, putDoc, 'PUT document')
          })
      })
    })

    it('should throw validation error', () => {
      return createTestDoc().then(testDoc => {
        return request
          .put('/test/' + testDoc._id)
          .send(_.assign(_.clone(validDoc), { name: null }))
          .expect(400)
          .expect('X-Error-Message', 'Path `name` is required.')
      })
    })

    it('should fail when document missing', () => {
      return request
        .put('/test/' + UNUSED_ID)
        .send(_.clone(validDoc))
        .expect(204)
    })
  })

  describe('PATCH', () => {
    const request = agent(rill()
      .use(require('@rill/body')())
      .use(resource(Model, { create: 'default', save: 'default' }))
      .listen()
      .unref())

    const validDoc = {
      name: 'Dylan Piercey',
      test: true
    }

    const patchDoc = {
      name: 'New Name'
    }

    // Create test doc.
    const createTestDoc = () => request
      .post('/test')
      .send(validDoc)
      .expect(201)
      .then((res) => res.body)

    it('should update doc', () => {
      return createTestDoc().then(testDoc => {
        return request
          .patch('/test/' + testDoc._id)
          .send(patchDoc)
          .expect(200)
          .then((res) => {
            const actual = _.omit(res.body, '_id')
            const expected = _.assign(_.clone(validDoc), patchDoc)
            assert.deepEqual(actual, expected, 'PATCH document')
          })
      })
    })

    it('should throw validation error', () => {
      return createTestDoc().then(testDoc => {
        return request
          .patch('/test/' + testDoc._id)
          .send(_.assign(_.clone(validDoc), { name: null }))
          .expect(400)
          .expect('X-Error-Message', 'Path `name` is required.')
      })
    })

    it('should fail when document missing', () => {
      return request
        .patch('/test/' + UNUSED_ID)
        .expect(204)
    })
  })

  describe('DELETE', () => {
    const request = agent(rill()
      .use(require('@rill/body')())
      .use(resource(Model, { remove: 'default' }))
      .listen()
      .unref())

    it('should delete doc', () => {
      return request
        .delete('/test/' + DATA[0]._id)
        .expect(200)
        .then((res) => {
          Model.count().then((count) => {
            assert.equal(count, _.size(DATA) - 1, 'DELETE one document')
          })
        })
    })

    it('should fail when document missing', () => {
      return request
        .delete('/test/' + UNUSED_ID)
        .expect(204)
    })
  })

  describe('OVERRIDES', () => {
    const request = agent(rill()
      .use(require('@rill/body')())
      .use(resource(Model, {
        find: respondWith(200, 'find'),
        findById: respondWith(200, 'findById'),
        create: respondWith(200, 'create'),
        save: respondWith(200, 'save'),
        remove: respondWith(200, 'remove')
      }))
      .listen()
      .unref())

    function respondWith (status, message) {
      return (ctx) => {
        ctx.res.status = 200
        ctx.res.body = { message: message }
      }
    }

    it('should override GET', () => {
      return request
        .get('/test')
        .expect(200)
        .then((res) => {
          assert.deepEqual(res.body, { message: 'find' }, 'OVERRIDE GET')
        })
    })

    it('should override POST', () => {
      return request
        .post('/test')
        .expect(200)
        .then((res) => {
          assert.deepEqual(res.body, { message: 'create' }, 'OVERRIDE POST')
        })
    })

    it('should override PUT', () => {
      return request
        .put('/test/1')
        .expect(200)
        .then((res) => {
          assert.deepEqual(res.body, { message: 'save' }, 'OVERRIDE PUT')
        })
    })

    it('should override PATCH', () => {
      return request
        .patch('/test/1')
        .expect(200)
        .then((res) => {
          assert.deepEqual(res.body, { message: 'save' }, 'OVERRIDE PATCH')
        })
    })

    it('should override DELETE', () => {
      return request
        .delete('/test/1')
        .expect(200)
        .then((res) => {
          assert.deepEqual(res.body, { message: 'remove' }, 'OVERRIDE DELETE')
        })
    })
  })
})
