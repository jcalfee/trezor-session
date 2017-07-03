const promptly = require('promptly')

/**
  @arg {object} config.trezor trezor.DeviceList configuration
  @arg {function} [config.out = console.error]
  @arg {function} [config.onConnect(device) = null] plugin or override trezor
    event listeners (pin prompting, passphrase, etc). See https://github.com/trezor/trezor.js/blob/master/API.md
*/
module.exports = trezor => (config = {}) => {
  const out = config.out ? config.out : console.error
  const debug = (...a) => out('trezor-session', ...a)
  if(!console.debug) {
    // console.debug is used by trezor.js-node
    console.debug = debug
  }

  const list = new trezor.DeviceList(config.trezor)

  let device
  let deviceResolve
  let deviceReady = new Promise(r => deviceResolve = r)

  /**
    Obtain and use a Trezor session.  The session is released after the callback
    and any Promise chain returned by the callback completes.  Any callback return
    value or thrown exception is automatically wrapped in a Promise.

    @arg {function} callback(error, session) - return a promise to leave the session. For the session API @see https://github.com/trezor/trezor.js/blob/master/API.md#session
  */
  function trezorSession(cb) {
    if(!cb) {
      throw new TypeError('callback parameter is required')
    }
    if(!device) {
      deviceReady
      .then(() => {trezorSession(cb)})
      .catch(error => {cb(error)})
      return
    }
    device.waitForSessionAndRun(session => {
      debug('session')
      try {
        const ret = cb(null, session)
        if(ret !== true) { // true is a potential future case where a Promise is not required
          if(ret == null || typeof ret.then !== 'function') {
            throw new Error('trezorSession callback must return a Promise')
          }
        }
        return ret
      } catch(error) {
        cb(error)
        return Promise.reject(error)
      }
    }).catch(error => {cb(error)})
  }

  /** @return {boolean} true if a Trezor device is plugged in and in the connected state.. */
  trezorSession.isAvailable = () => device != null
  trezorSession.close = () => {
    debug('close')
    ensureCallbackClose(cb => cb('exit'))
    // Trezor's example.js recommended calling onbeforeunload on exit
    list.onbeforeunload()
  }

  const {ensureCallback, ensureCallbackClose} = require('./ensure-callback')()
  const waitingMsg = setTimeout(() => out('Looking for a Trezor device..'), 1000)

  list.on('connect', dev => {
    clearTimeout(waitingMsg)
    device = dev

    if (device.isBootloader()) {
      deviceResolve(new Error('Device is in bootloader mode, re-connected it'))
      return
    }

    device.on('pin', ensureCallback(pinCallback))
    device.on('passphrase', ensureCallback(passphraseCallback))
    device.on('button', code => { ensureCallback(buttonCallback(device.features.label, code)) })

    if(typeof config.onConnect === 'function') {
      // Keep last, onConnect allows caller to over-write event handlers
      config.onConnect(device)
    }
    deviceResolve()
  })

  list.on('disconnect', device => {
    debug('disconnect ' + device.features.label)
    deviceReady = new Promise(r => deviceResolve = r)
    device = null
  })

  // This gets called on general error of the devicelist (no transport, etc)
  list.on('error', function (error) {
    console.error('List error:', error);
  });

  // On connecting unacquired device
  list.on('connectUnacquired', function (device) {
    askUserForceAcquire(function() {
      device.steal().then(function() {
        out("steal done. now wait for another connect");
      });
    });
  });


  // an example function, that asks user for acquiring and
  // (call agree always)
  function askUserForceAcquire(callback) {
    return setTimeout(callback, 1000);
  }

  /**
  * @param {string}
  */
  function buttonCallback(label, code) {
    out(`Check your Trezor device ${label}`);
  }

  /**
  * @param {string} type
  * @param {Function<Error, string>} callback
  */
  function pinCallback(type, callback) {
    out('Look at the trezor and find each digit of your pin, then enter the number in the coresponding position:');
    out('Please enter PIN. The positions:');
    out('7 8 9')
    out('4 5 6')
    out('1 2 3')
    promptly.prompt('PIN', {silent: true, output: process.stderr}, (err, pin) => {
      if(err) {
        callback(err)
      } else {
        callback(null, pin)
      }
    })
  }

  /**
  * @param {Function<Error, string>} callback
  */
  function passphraseCallback(callback) {
    promptly.prompt('Passphrase', {silent: true, output: process.stderr, default: ''}, (err, pass) => {
      if(err) {
        callback(err)
      } else {
        callback(null, pass)
      }
    })
  }
  return trezorSession
}
