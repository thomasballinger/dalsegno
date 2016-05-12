
function withConsoleLogIgnored(cb){
  var orig = global.console.log;
  global.console.log = function(){};
  try{
    return cb();
  } finally {
    global.console.log = orig;
  }
}

module.exports.withConsoleLogIgnored = withConsoleLogIgnored;
