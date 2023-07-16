const childProcess = require('child_process')

function runScript(scriptPath, callback) {
  var invoked = false
  var process = childProcess.fork(scriptPath)
  kill = function() {
    process.kill('SIGINT')
  }

  process.on('error', function (err) {
    if (invoked) return
    invoked = true
    callback(err)
  })

  process.on('exit', function (code) {
    if (invoked) return
    invoked = true
    var err = code === 0 ? null : new Error('exit code ' + code)
    callback(err)
  })
}

function startServer() {
  runScript('./index.mjs', function(err) {
    console.log(err)
    startServer()
  })
}

startServer()
