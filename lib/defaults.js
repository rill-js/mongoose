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
        var docs = result[0]
        var count = result[1]
        res.set('X-Max-Results', count)
        res.set('X-Total-Results', docs ? docs.length : 0)
        res.status = 200
        res.body = docs || []
        if (!docs.length) return
        if (mongoose.populate) return Model.populate(docs, mongoose.populate)
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
        res.set('X-Max-Results', count)
        res.set('X-Total-Results', count)
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
      })
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
      options = utils.assign(PUT_OPTIONS, { select: mongoose.select })
    } else if (req.method === 'PATCH') {
      $set = { $set: req.body }
      options = utils.assign(PATCH_OPTIONS, { select: mongoose.select })
    }

    return Model.findByIdAndUpdate(req.params._id, $set, options).then(function (doc) {
      res.body = doc
      res.status = doc == null ? 204 : 200
      if (doc == null) return

      return next().then(function () {
        if (!res.body || !res.body.isModified) return
        return res.body.save().then(function (doc) {
          res.body = utils.omitObj(doc.toObject(), mongoose.hidden)
        })
      })
    })
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
