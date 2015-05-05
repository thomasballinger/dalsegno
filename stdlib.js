// lispy functions or JavaScript ones that call lispy ones
// This will load once, so 
//
;(function() {
  'use strict';

  if (typeof window === 'undefined') {
    var require = module.require
  } else {
    var require = function(name){ 
      var realname = name.match(/(\w+)[.]?j?s?$/)[1];
      return window[realname];
    }
  }

  var builtins = require('./builtins.js')
  var run = require('./run');

  var stdlib = {}
  var env = new run.Environment([builtins, stdlib])

  // Use lambdas so snapshots aren't tracked of them

  run("(define reduce (lambda func arr\n"+
      "  (if (= (length arr) 1)\n"+
      "      (first arr)\n"+
      "      (func (reduce func (rest arr)) (first arr)))))",
      env)

  stdlib.stdlib = stdlib;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = stdlib;
    }
  } else {
    window.stdlib = stdlib;
  }
})();
