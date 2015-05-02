'use strict';
var chai = require('chai');
var assert = chai.assert;

var tokenize = require('./parse.js').tokenize;
var parse = require('./parse.js').parse;
var Runner = require('./objeval').Runner;
var Environment = require('./objeval').Environment;
var evalGen = require('./objeval').evalGen;

// environment with just an arity-2 sum function for testing
var justSum = new Environment([{'+': function(a, b){return a + b}}]);

describe('objeval', function(){
  describe('Environment', function(){
    it('should do lookup through scopes from right to left', function(){
      var env = new Environment([{a:1}, {a:2}, {}], {});
      assert.deepEqual(env.lookup('a'), 2)
    });
    it('should create new environments with scopes', function(){
      var env = new Environment([{a:1}, {a:2}, {}], {});
      var newEnv = env.newWithScope({a:3})
      assert.deepEqual(newEnv.lookup('a'), 3);
      assert.deepEqual(env.lookup('a'), 2);
    });
  });
  describe('evalGen', function(){
    it('should return an evaluation object', function(){
      var e = evalGen(1);
      assert(e.isEvalGen);
      assert.equal(e.ast, 1)
      var e = evalGen(parse('(+ 1 2)'), justSum);
      assert(e.isEvalGen);
      assert.deepEqual(e.ast, ['+', 1, 2])
    });
  });
  describe('Invocation', function(){
    it('should be iterable', function(){
      var e = evalGen(parse('(+ 1 2)'), justSum);
      assert.deepEqual(e.next(), {value: null, finished: false});
      assert.deepEqual(e.next(), {value: null, finished: false});
      assert.deepEqual(e.next(), {value: null, finished: false});
      assert.deepEqual(e.next(), {value: 3, finished: true});
      assert.deepEqual(e.next(), {value: 3, finished: true});
    });
  });
	/*
  describe('Runner', function(){
    it('should iterate to run', function(){
      var r = Runner('(+ 1 1)');
      var g = g[Symbol.iterator]();
      assert.deepEqual(g.next(), {value: null, finished: false});
    });
  });
  */
/*
  describe('eval', function(){
    it('should passthrough literals', function(){
      assert.deepEqual(eval(1.2), 1.2);
      assert.deepEqual(eval('"asdf"'), "asdf");
      assert.deepEqual(, ['2']);
      assert.deepEqual(eval('"asdf"'), ['"asdf"']);
    });
  });
*/
});
