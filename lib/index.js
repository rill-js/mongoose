'use strict'

var rill = require('rill')
var utils = require('./utils')
var defaults = require('./defaults')

/*
 * Creates a mountable Rill router with REST api generated for a mongoose model.
 *
 * @param {Model} Model the mongoose Model to make routes for.
 * @param {Object} methods the methods/overrides enabled for this Model.
 * @return {app}
 */
module.exports = function (path, Model, methods) {
  // Make path optional.
  if (typeof path !== 'string') {
    methods = Model
    Model = path
    path = null
  }

  // Ensure a valid mongoose model.
  if (!Model || !Model.modelName || !Model.schema) throw new TypeError('@rill/mongoose: Model must be a mongoose model.')

  // Create a rill app to mount the methods to.
  var router = rill()

  // Setup single and multi doc paths.
  path = path || '/' + Model.modelName
  var singlePath = path + '/:_id'

  // Pull out hidden and default select fields.
  var hidden = utils.getHiddenFields(Model)
  var defaultSelect = utils.defaultSelect(Model)

  /*
   * Function that will start off the middleware for a resource and initialize some options.
   */
  function init (ctx, next) {
    var req = ctx.req
    var res = ctx.res
    var query = req.query

    // Ensure api is not cached.
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')

    // Ensure content type.
    res.set('Content-Type', 'application/json; charset=UTF-8')

    // Pass Model to middleware.
    ctx.Model = Model

    // Pass options to middleware.
    ctx.mongoose = {
      skip: Number(query.$skip || 0),
      limit: Number(query.$limit) || undefined,
      sort: utils.omitStr(query.$sort, hidden),
      select: utils.omitStr(query.$select, hidden) || defaultSelect,
      populate: utils.omitStr(query.$populate, hidden),
      hidden: hidden
    }

    // Parse populate options into a usable nested object.
    if (ctx.mongoose.populate) ctx.mongoose.populate = utils.parsePopulate(Model, ctx.mongoose.populate)

    // Remove operators from query.
    delete query.$skip
    delete query.$limit
    delete query.$sort
    delete query.$populate
    delete query.$select

    // Remove hidden fields
    utils.omitObj(req.body, hidden.concat('_id'))
    utils.omitQuery(req.query, hidden)

    // Run custom middleware.
    return next()
  }

  // Setup default handlers
  for (var method in methods) {
    if (!methods[method]) continue
    var stack = methods[method] = [].concat(methods[method])
    var defaultLocation = stack.indexOf('default')
    if (~defaultLocation) stack[defaultLocation] = defaults[method]
  }

  // Initialize routes.
  if (methods.find) {
    router.get(path, init, methods.find)
  }

  if (methods.findById) {
    router.get(singlePath, init, methods.findById)
  }

  if (methods.create) {
    router.post(path, init, methods.create)
  }

  if (methods.save) {
    router.put(singlePath, init, methods.save)
    router.patch(singlePath, init, methods.save)
  }

  if (methods.remove) {
    router.delete(singlePath, init, methods.remove)
  }

  return router
}
