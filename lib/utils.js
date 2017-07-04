'use strict'

var mongoose = require('mongoose')
var mutils = require('mongoose/lib/utils')
var del = require('del-values')
var hiddenPath = /(^_|\._).*/g
var monStr = /-?([^, ]+)/g
var popSub = /:(.*)/
var popSelect = /\[([^\]]+)\]/
var popOptions = { lean: true }
var HIDDEN_FIELDS = '__rill_mongoose_hidden__'

module.exports = {
  getHiddenFields: getHiddenFields,
  parsePopulate: parsePopulate,
  defaultSelect: defaultSelect,
  omitQuery: omitQuery,
  omitObj: omitObj,
  omitStr: omitStr,
  assign: assign
}

// Extract hidden fields from a Model
function getHiddenFields (model) {
  if (model[HIDDEN_FIELDS]) return model[HIDDEN_FIELDS]

  var hidden = []
  if (model && model.schema) {
    model.schema.eachPath(function (path, type) {
      var options = type.options
      if (path === '_id') return
      if (options.hidden === false) return
      if (options.hidden === true || hiddenPath.test(path)) hidden.push(path)
    })
  }

  model[HIDDEN_FIELDS] = hidden
  return hidden
}

// Parse populate string with mongoose utils.
function parsePopulate (from, paths) {
  if (!from || !from.schema || typeof paths !== 'string') return
  var fields = mutils.populate(paths, null, from)
  for (var i = fields.length, it, field, model; i--;) {
    it = fields[i]
    it.path = it.path
      .replace(popSub, function (m, populate) {
        it.populate = populate
        return ''
      })
      .replace(popSelect, function (m, select) {
        it.select = select
        return ''
      })
    field = from.schema.path(it.path)

    if (!field || !field.options.ref) {
      fields.splice(i, 1)
      continue
    }

    try { model = mongoose.model(field.options.ref) } catch (e) {
      fields.splice(i, 1)
      continue
    }

    var hidden = getHiddenFields(model)
    it.path = field.path
    it.model = model
    it.options = popOptions
    it.select = omitStr(it.select, hidden) || defaultSelect(model)
    it.populate = parsePopulate(it.model, omitStr(it.populate, hidden))
  }

  return fields
}

// Build a default select query for a model based on hidden fields.
function defaultSelect (model) {
  var hidden = getHiddenFields(model)
  if (!hidden) return
  var result = new Array(hidden.length)
  for (var i = result.length; i--;) result[i] = '-' + hidden[i]
  return result.join(' ')
}

// Remove mongo query style fields from an object.
function omitQuery (it, fields) {
  if (it.$or) omitQuery(it.$or, fields)
  if (it.$and) omitQuery(it.$and, fields)
  if (it.$nor) omitQuery(it.$nor, fields)
  omitObj(it, fields)
  return it
}

// Remove all fields from an object.
function omitObj (it, fields) {
  if (!fields) return it
  if (!it || typeof it !== 'object') return
  if (Array.isArray(it)) for (var i = it.length; i--;) omitObj(it[i], fields)
  return del(it, fields)
}

// Remove all fields from a string.
function omitStr (it, fields) {
  if (!fields) return it
  if (typeof it !== 'string') return
  var m
  var arr = []
  while ((m = monStr.exec(it))) if (!~fields.indexOf(m[1])) arr.push(m[0])
  return arr.join(' ')
}

// Assign keys from one object to another.
function assign (dst, src) {
  for (var key in src) dst[key] = src[key]
  return dst
}
