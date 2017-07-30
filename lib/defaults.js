'use strict'

var utils = require('./utils')
var PATCH_OPTIONS = { runValidators: true, new: true }
var PUT_OPTIONS = { runValidators: true, overwrite: true, new: true }

module.exports = {
  /**
   * Default handler for GET requests.
   */
  find: function (ctx, next) {
    var req = ctx.req
    var res = ctx.res
    var mongoose = ctx.mongoose
    var Model = ctx.Model

    return Promise.all([
      Model
        .find(req.query)
        .sort(mongoose.sort)
        .skip(mongoose.skip)
        .limit(mongoose.limit)
        .select(mongoose.select)
        .lean(),
      Model.count(req.query)
    ])
      .then(function (result) {
        var docs = result[0] || []
        var count = result[1]
        res.set('X-Total-Count', count)
        res.status = 200
        res.body = docs

        if (docs.length && mongoose.populate) {
          return Model.populate(docs, mongoose.populate)
        }
      })
      .then(next)
  },
  /**
   * Default handler for GET/id requests.
   */
  findById: function (ctx, next) {
    var req = ctx.req
    var res = ctx.res
    var params = req.params
    var mongoose = ctx.mongoose
    var Model = ctx.Model

    return Model
      .findById(params._id)
      .select(mongoose.select)
      .lean()
      .then(function (doc) {
        var notFound = doc == null
        var count = notFound ? 0 : 1
        res.body = doc
        res.status = notFound ? 204 : 200
        res.set('X-Total-Count', count)
        if (notFound) return
        if (mongoose.populate) return Model.populate(doc, mongoose.populate)
      })
      .then(next)
  },
  /**
   * Default handler for POST requests.
   */
  create: function (ctx, next) {
    var req = ctx.req
    var res = ctx.res
    var mongoose = ctx.mongoose
    var Model = ctx.Model

    res.body = new Model(req.body)
    res.status = 201

    return next().then(function () {
      if (!res.body || typeof res.body.save !== 'function') return
      return res.body.save().then(function (doc) {
        res.body = utils.omitObj(doc.toObject(), mongoose.hidden)
      }).catch(handleValidationError.bind(ctx))
    })
  },
  /**
   * Default handler for PUT/PATCH requests.
   */
  save: function (ctx, next) {
    var req = ctx.req
    var res = ctx.res
    var mongoose = ctx.mongoose
    var Model = ctx.Model
    var $set
    var options

    if (req.method === 'PUT') {
      $set = req.body
      options = utils.assign(PUT_OPTIONS, { fields: mongoose.select })
    } else if (req.method === 'PATCH') {
      $set = { $set: req.body }
      options = utils.assign(PATCH_OPTIONS, { fields: mongoose.select })
    }

    return Model.findByIdAndUpdate(req.params._id, $set, options).then(function (doc) {
      res.body = doc
      res.status = doc == null ? 204 : 200
      if (doc == null) return

      return next().then(function () {
        if (!res.body || typeof res.body.save !== 'function') return
        return res.body.save().then(function (doc) {
          res.body = utils.omitObj(doc.toObject(), mongoose.hidden)
        })
      })
    }).catch(handleValidationError.bind(ctx))
  },
  /**
   * Default handler for DELETE requests.
   */
  remove: function (ctx, next) {
    var res = ctx.res
    var req = ctx.req
    var params = req.params
    var mongoose = ctx.mongoose
    var Model = ctx.Model

    return Model.findById(params._id, mongoose.select).then(function (doc) {
      res.body = doc
      res.status = doc == null ? 204 : 200
      if (doc == null) return

      return next().then(function () {
        if (!res.body || typeof res.body.remove !== 'function') return
        return res.body.remove()
      })
    })
  }
}

/**
 * Special handler for validation errors.
 */
function handleValidationError (e) {
  // Handle validation errors specially.
  if (e.name !== 'ValidationError') throw e
  var res = this.res
  // Set "Bad Request" error status.
  res.status = 400

  // Generate an 'x-error-message' header.
  var xErrorMessage = []
  for (var key in e.errors) xErrorMessage.push(e.errors[key].message)
  res.set('X-Error-Message', xErrorMessage.join('\n'))

  // Send the error to the client.
  res.body = JSON.stringify({ error: e })
}
