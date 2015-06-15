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
  var parse = require('./parse.js');
  var run = require('./run.js');
  var Environment = run.Environment;

  function cps(ast, env, k){
    if (typeof ast === 'number') {
      k(ast);
    } else if (typeof ast === 'string') {
      k(ast);
    } else if (Array.isArray(ast)) {
      if (ast.length != 2) {throw Error("only arity 1 for now");}
      var func = env.lookup(ast[0]);

      var callFunc = function callFunc(value) {
        k(func(value));
      };
      cps(ast[1], env, callFunc);
    } else {
      throw Error("Can't evaluate "+ast);
    }
  }

  cps.cps = cps;


  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = cps;
    }
  } else {
    window.cps = cps;
  }
})();
