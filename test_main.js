'use strict';
var chai = require('chai');
var assert = chai.assert;

var tokenize = require('./parse.js').tokenize;
var parse = require('./parse.js').parse;
var run = require('./run');
var Environment = run.Environment;
var evalGen = run.evalGen;
var Runner = run.Runner;
var builtins = require('./builtins.js');
var stdlib = require('./stdlib.js');

var buildEnv = function(){
  return new run.Environment([builtins, stdlib, {}], {});
};

describe('integration', function(){
  describe('global functions', function(){
    run("\n"+
        "(do                                   \n"+
        "  (defn foo x (do (display x) x))     \n"+
        "  (defn main (do                      \n"+
        "    (foo 1)                           \n"+
        "    (map foo (list 1 2 3))))          \n"+
        "  (main))",
    buildEnv());
  });
});
