// lispy functions that can be run a step at a time
;(function() {
  'use strict';

  var require;
  if (typeof window === 'undefined') {
    require = module.require;
  } else {
    require = function(name){
      var realname = name.match(/(\w+)[.]?j?s?$/)[1];
      return window[realname];
    };
  }

  var builtins = require('./builtins.js');
  var bcrun = require('./bcrun');
  var Environment = require('./Environment');
  var stdlibcode = require('./stdlibcode');
  var ScopeCheck = require('./ScopeCheck');

  //TODO this will take some rethinking: is it ok if they use a different scopeCheck?
  //I think so, but need to be careful about this.

  // A new environment with these arguments will create its own ScopeCheck

  var env = new Environment.fromMultipleMutables([builtins, {}]);

  stdlibcode.forEach( code => bcrun(code, env));

  // Use lambdas so snapshots aren't tracked of them
  // Don't create any funs here! They won't work.

  var bcstdlib = env.runner.scopeCheck.mapping(env.mutableScope);
  // This can be used alone as a library scope, but it you want it
  // to be a mutable scope its ScopeCheck needs to be consumed by the
  // one you're using to do the mutation.
  
  console.log(bcstdlib);
  console.log('keys:', Object.keys(bcstdlib));

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = bcstdlib;
    }
  } else {
    window.bcstdlib = bcstdlib;
  }
})();
