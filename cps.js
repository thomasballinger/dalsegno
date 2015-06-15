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
      var func = env.lookup(ast[0]);
      var args = [];
      var pushAndEvalNext = function pushAndEvalNext(value) {
        args.push(value);
        if (args.length < ast.length - 1) {
          cps(ast[args.length + 1], env, pushAndEvalNext);
        } else {
          k(func.apply(null, args));
        }
      };
      cps(ast[1], env, pushAndEvalNext);
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
