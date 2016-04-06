// lispy functions or JavaScript ones that call lispy ones
// This will load once, so
//
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
  var run = require('./run');
  var Environment = require('./Environment');
  var stdlibcode = require('./stdlibcode');

  var env = new Environment([new Environment.Scope(builtins), new Environment.Scope()], null);

  // Use lambdas so snapshots aren't tracked of them
  // Don't create any funs here! They won't work.

  stdlibcode.forEach( code => run(code, env));

  var stdlib = env.scopes[1].data;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = stdlib;
    }
  } else {
    window.stdlib = stdlib;
  }
})();
