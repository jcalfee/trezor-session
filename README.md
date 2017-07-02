#About

Attempts to make Trezor's example.js modular.

# Usage

```javascript
TrezorSession = require('trezor-session') // or TrezorSession = require('.')

// trezorSession = TrezorSession( config = {out: console.out, trezor: {}, onConnect: device => {}} )
// See config's jsdocs in ./session.js

// Wait until your ready, this is going to start "Looking for the device"
trezorSession = TrezorSession()


console.log(trezorSession.isAvailable()) // true after connecting

// This can pause: "Looking for device.."
trezorSession((err, session) => {
  if(err) {
    console.error(err)
    return
  }
  // Trezor session: See https://github.com/trezor/trezor.js/blob/master/API.md

  // Currently all Trezor session methods return a Promise.  So you must return a
  // Promise here or an Error will be thrown. It is very confusing without this
  // error.  If there is a future case to skip the Promise return true.

  // Remember to return a Promise
  return session.getEntropy(16).then(entropy => {
    console.log('entropy', entropy)
    console.log('done')
  })
  .catch(error => {
    console.error(error)
  })

})

// process.on('exit', () => { trezorSession.close() })
```

# Environment

Node 6+
