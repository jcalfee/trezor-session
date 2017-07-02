

// TODO support trezor.js (browser)
const trezor = require('trezor.js-node')
const session = require('./session')

module.exports = session(trezor)
