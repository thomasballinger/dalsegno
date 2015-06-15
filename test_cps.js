'use strict';
var chai = require('chai');
var assert = chai.assert;

var tokenize = require('./parse.js').tokenize;
var parse = require('./parse.js').parse;
var cps = require('./cps');
var run = require('./run');
var Environment = run.Environment;
var evalGen = run.evalGen;
var Runner = run.Runner;

// environment with just an arity-2 sum function for testing
var justSum = new Environment([{
  '+': function(){
    var args = Array.prototype.slice.call(arguments);
    return args.reduce(function (acc, x) { return x + acc; }, 0)
  }
}]);

function makeAssert(expected){
  return function(v){
    assert.equal(v, expected);
  };
}

describe('continuation passing style eval', function(){
  describe('cps', function(){
    it('should evalute a literal', function(){
      cps.cps(1, justSum, makeAssert(1));
    });
    it('should call a single arity function', function(){
      cps.cps(['+', 2], justSum, makeAssert(2));
    });
    it('should call an arity 2 function', function(){
      cps.cps(['+', 2, 3], justSum, makeAssert(5));
    });
    it('should call an arity 3 function', function(){
      cps.cps(['+', 2, 3, 4], justSum, makeAssert(9));
    });
  });
});
