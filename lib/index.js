'use strict'

var utils = require('./utils')
var defaults = require('./defaults')

/*
 * Rill setup function that will add routes for a given mongoose model.
 */
module.exports = function (path, Model, methods) {
  // Make path optional.
  if (typeof path !== 'string') {
    methods = Model
    Model = path
    path = null
  }

  // Ensure a valid mongoose model.
  if (!Model || !Model.modelName) throw new TypeError('Crudge: Model must be a mongoose model.')

  // Generate a route path.
  path = path || '/' + Model.modelName
  var pathID = path + '/:_id'
  var hidden = utils.getHiddenFields(Model)
  var defaultSelect = utils.defaultSelect(Model)

  /*
   * Method to add a resource to the current Rill instance.
   *
   * @param {Model} Model the mongoose Model to make routes for.
   * @param {Object} methods the methods/overrides enabled for this Model.
   * @return {app}
   */
  return function (app) {
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
      utils.omitObj(req.query, hidden)
      utils.omitObj(req.query.$or, hidden)
      utils.omitObj(req.query.$and, hidden)
      utils.omitObj(req.query.$not, hidden)
      utils.omitObj(req.query.$nor, hidden)

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
      app.get(path, init, methods.find)
    }

    if (methods.findById) {
      app.get(pathID, init, methods.findById)
    }

    if (methods.create) {
      app.post(path, init, methods.create)
    }

    if (methods.save) {
      app.put(pathID, init, methods.save)
      app.patch(pathID, init, methods.save)
    }

    if (methods.remove) {
      app.delete(pathID, init, methods.remove)
    }
  }
}
