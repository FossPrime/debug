/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 */

/**
 * Selects a color for a debug namespace
 * @param {String} namespace The namespace string for the debug instance to be colored
 * @return {Number|String} An ANSI color code for the given namespace
 * @api private
 */
const selectColor = (namespace) => {
  let hash = 0

  for (let i = 0; i < namespace.length; i++) {
    hash = (hash << 5) - hash + namespace.charCodeAt(i)
    hash |= 0 // Convert to 32bit integer
  }

  return common.colors[Math.abs(hash) % common.colors.length]
}

const debug = function (...args) {
  this.enabled = { // allows runtime disabling and re-enabling
    get: () => {
      if (sm.enableOverride !== null) {
        return sm.enableOverride
      }

      return true
    },
    set: (v) => {
      sm.enableOverride = v
    }
  }

  if (!this.enabled) {
    return
  }


  this.namespace = namespace
  this.color = common.selectColor(namespace)
  let myMessage = args[0]

  // Set `diff` timestamp
  const curr = Number(new Date())
  this.diff = curr - (sm.prevTime || curr)
  this.prev = sm.prevTime
  this.curr = curr
  sm.prevTime = curr

  myMessage = myMessage instanceof Error ? myMessage.stack || myMessage.message :myMessage

  if (typeof myMessage !== 'string') {
    args.unshift('%O') // Anything else let's inspect with %O
  }

  // Apply any `formatters` transformations
  let index = 0
  myMessage = myMessage.replace(/%([a-zA-Z%])/g, (match, format) => {
    // If we encounter an escaped % then don't increase the array index
    if (match === '%%') {
      return '%'
    }
    index++
    const formatter = common.formatters[format]
    if (typeof formatter === 'function') {
      const val = args[index]
      match = formatter.call(this, val)

      // Now we need to remove `args[index]` since it's inlined in the `format`
      args.splice(index, 1)
      index--
    }
    return match
  })

  // Apply Env-specific formatting (colors, etc.)
  common.formatArgs.call(this, args)

  const logFn = namespace.log || common.log
  logFn.apply(namespace, args)
}



/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */
function createDebug(context, namespace) {
  const sm = {
    enableOverride: null
  }

  debug.prototype.sm = 

  debug.useColors = common.useColors() // bad
  debug.extend = extend(context, this)

  // Env-specific initialization logic for debug instances
  if (typeof common.init === 'function') {
    common.init(debug)
  }

  return debug
}

// todo attach this to debug, or turn into a factory
const extend = (context, debug) => (namespace, delimiter) => {
  const newDebug = context.createDebug(
    debug.namespace +
      (typeof delimiter === 'undefined' ? ':' : delimiter) +
      namespace
  )
  newDebug.log = debug.log
  return newDebug
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */
function enableNamespaces(ctx, namespaces) {
  ctx.save(namespaces)
  ctx.namespaces = namespaces

  ctx.names = []
  ctx.skips = []

  let i
  const split = (typeof namespaces === 'string' ? namespaces : '').split(
    /[\s,]+/
  )
  const len = split.length

  for (i = 0; i < len; i++) {
    if (!split[i]) {
      // ignore empty strings
      continue
    }

    namespaces = split[i].replace(/\*/g, '.*?')

    if (namespaces[0] === '-') {
      ctx.skips.push(new RegExp('^' + namespaces.slice(1) + '$'))
    } else {
      ctx.names.push(new RegExp('^' + namespaces + '$'))
    }
  }
}

/**
 * Disable debug output.
 *
 * @return {String} namespaces
 * @api public
 */
function disableNamespaces(ctx) {
  const toNamespace = (regexp) => regexp.toString()
      .substring(2, regexp.toString().length - 2)
      .replace(/\.\*\?$/, '*')

  const namespaces = [
    ...ctx.names.map(toNamespace),
    ...ctx.skips.map(toNamespace).map((namespace) => '-' + namespace),
  ].join(',')
  ctx.enable('')
  return namespaces
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */
const verifyNamespaceEnabled = (context, name) => {
  if (name[name.length - 1] === '*') {
    return true
  }

  let i
  let len

  for (i = 0, len = context.skips.length; i < len; i++) {
    if (context.skips[i].test(name)) {
      return false
    }
  }

  for (i = 0, len = context.names.length; i < len; i++) {
    if (context.names[i].test(name)) {
      return true
    }
  }

  return false
}


const setupCore = (DebugRuntime) => {
  const context = {
    names: [], // currently active debug mode names
    skips: [], // names to skip.
    formatters: {}, // "%n" handling functions, global
    prevTime: Date.now(),
    DebugRuntime
  }

  enableNamespaces(context, DebugRuntime.load())
  disableNamespaces(context)

  return createDebug.bind(context)
}

export { setupCore, verifyNamespaceEnabled }
// export default setupCommon // Uncoment in 2025
