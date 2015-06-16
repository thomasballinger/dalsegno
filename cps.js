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

      if (ast[0] === 'set!'){
        return cps_set(ast, env, k);
      }
      if (ast[0] === 'do'){
        return cps_do(ast, env, k);
      }
      if (ast[0] === 'if'){
        return cps_if(ast, env, k);
      }
      return cps_invoke(ast, env, k);

    } else {
      throw Error("Can't evaluate "+ast);
    }
  }

  function cps_set(ast, env, k){
    var setIt = function setIt(value) {
      env.set(ast[1], value);
      k(value);
    };
    return cps(ast[2], env, setIt);
  }
  function cps_invoke(ast, env, k){
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
    return cps(ast[1], env, pushAndEvalNext);
  }
  function cps_do(ast, env, k){
    if (ast[0] === 'do'){
      cps_do(ast.slice(1), env, k);
    } else if (ast.length === 1) {
      cps(ast[0], env, k);
    } else {
      var doRest = function doRest(value){
        cps_do(ast.slice(1), env, k);
      };
      cps(ast[0], env, doRest);
    }
  }
  function cps_if(ast, env, k){
    var ifHandler = function ifHandler(value){
      if (value) {
        cps(ast[2], env, k);
      } else {
        cps(ast[3], env, k);
      }
    };
    cps(ast[1], env, ifHandler);
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
