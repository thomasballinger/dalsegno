// lispy functions or JavaScript ones that call lispy ones
// This will load once, so
//
;(function() {
  'use strict';

  if (typeof window === 'undefined') {
    var require = module.require;
  } else {
    var require = function(name){
      var realname = name.match(/(\w+)[.]?j?s?$/)[1];
      return window[realname];
    };
  }

  var builtins = require('./builtins.js');
  var run = require('./run');
  var Immutable = require('./Immutable');

  var env = new run.Environment([builtins, Immutable.Map()], null);

  // Use lambdas so snapshots aren't tracked of them
  // Don't create any funs here! They won't work.

  run("(define reduce (lambda func arr initial\n"+
      "  (if (= (length arr) 0)\n"+
      "      initial\n"+
      "      (func (reduce func (rest arr) initial) (first arr)))))",
      env);

  run("(define filter (lambda func arr\n"+
      "  (reduce \n"+
      "    (lambda acc item (if (func item)\n"+
      "                     (prepend item acc)\n"+
      "                     acc))\n"+
      "    arr (list))))",
      env);

  run("(define map (lambda func arr\n"+
      "  (if (= (length arr) 0)\n"+
      "      (list)\n"+
      "      (prepend (func (first arr)) (map func (rest arr))))))",
      env);


  var stdlib = env.scopes[1];

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = stdlib;
    }
  } else {
    window.stdlib = stdlib;
  }
})();
