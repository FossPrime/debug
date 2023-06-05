/**
 * Module dependencies.
 */
import common from './common.mjs'
import * as tty from 'https://deno.land/x/tty/mod.ts'
import { inspect, format } from 'https://deno.land/std@0.110.0/node/util.ts'
import { ms } from "https://raw.githubusercontent.com/denolib/ms/master/ms.ts";


/**
 * This is the Node.js implementation of `debug()`.
 */

const configMap = {
  init: init,
  log: log,
  formatArgs: formatArgs,
  save: save,
  load: load,
  useColors: useColors,
  formatters: {},
  colors: [6, 2, 3, 4, 5, 1]
}

/**
 * Colors.
 */

// try {
//   // Optional dependency (as in, doesn't need to be installed, NOT like optionalDependencies in package.json)
//   // eslint-disable-next-line import/no-extraneous-dependencies
//   const supportsColor = await import('supports-color')

//   if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
//     configMap.colors = [
//       20, 21, 26, 27, 32, 33, 38, 39, 40, 41, 42, 43, 44, 45, 56, 57, 62, 63,
//       68, 69, 74, 75, 76, 77, 78, 79, 80, 81, 92, 93, 98, 99, 112, 113, 128,
//       129, 134, 135, 148, 149, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169,
//       170, 171, 172, 173, 178, 179, 184, 185, 196, 197, 198, 199, 200, 201, 202,
//       203, 204, 205, 206, 207, 208, 209, 214, 215, 220, 221,
//     ]
//   }
// } catch (error) {
//   // Swallow - we only care if `supports-color` is available; it doesn't have to be.
// }

/**
 * Build up the default `inspectOpts` object from the environment variables.
 *
 *   $ DEBUG_COLORS=no DEBUG_DEPTH=10 DEBUG_SHOW_HIDDEN=enabled node script.js
 */

configMap.inspectOpts = Object.keys(Deno.env.toObject())
  .filter((key) => {
    return /^debug_/i.test(key)
  })
  .reduce((obj, key) => {
    // Camel-case
    const prop = key
      .substring(6)
      .toLowerCase()
      .replace(/_([a-z])/g, (_, k) => {
        return k.toUpperCase()
      })

    // Coerce string value into JS value
    let val = Deno.env.get("key")
    if (/^(yes|on|true|enabled)$/i.test(val)) {
      val = true
    } else if (/^(no|off|false|disabled)$/i.test(val)) {
      val = false
    } else if (val === 'null') {
      val = null
    } else {
      val = Number(val)
    }

    obj[prop] = val
    return obj
  }, {})

/**
 * Is stdout a TTY? Colored output is enabled when `true`.
 */

function useColors() {
  return 'colors' in configMap.inspectOpts
    ? !!configMap.inspectOpts.colors
    : Deno.isatty()
}


function getDate() {
  if (configMap.inspectOpts.hideDate) {
    return ''
  } else {
    return new Date().toISOString() + ' '
  }
}

// Adds ANSI color escape codes if enabled.
export function formatArgs(args) {
  const { namespace: name, useColors, diff } = this

  if (useColors) {
    const c = this.color
    const colorCode = '\u001B[3' + (c < 8 ? c : '8;5;' + c)
    const prefix = `  ${colorCode};1m${name} \u001B[0m`

    args[0] = prefix + args[0].split('\n').join('\n' + prefix)
    args.push(colorCode + 'm+' + ms(diff) + '\u001B[0m')
  } else {
    args[0] = getDate() + name + ' ' + args[0]
  }
}


/**
 * Invokes `format()` with the specified arguments and writes to stderr.
 */
function log(...args) {
  const output = new TextEncoder().encode(format(...args) + '\n')
  console.warn(args)
  return Deno.isatty() ? Deno.stderr.write(output) : Deno.stdout.write(output)
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */
function save(namespaces) {
  if (namespaces) {
    Deno.env.set("DEBUG", namespaces)
  } else {
    // If you set a Deno.env field to null or undefined, it gets cast to the
    // string 'null' or 'undefined'. Just delete instead.
    delete Deno.env.get("DEBUG")
  }
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  return Deno.env.get("DEBUG")
}

/**
 * Init logic for `debug` instances.
 *
 * Create a new `inspectOpts` object in case `useColors` is set
 * differently for a particular `debug` instance.
 */

function init(debug) {
  debug.inspectOpts = {}

  const keys = Object.keys(configMap.inspectOpts) // BAD, use for of
  for (let i = 0; i < keys.length; i++) {
    debug.inspectOpts[keys[i]] = configMap.inspectOpts[keys[i]]
  }
}

export const createDebug = common(configMap)
