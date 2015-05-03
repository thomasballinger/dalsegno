'use strict';
var chai = require('chai');
var assert = chai.assert;

var tokenize = require('./parse.js').tokenize;
var parse = require('./parse.js').parse;
var Runner = require('./objeval').Runner;
var Environment = require('./objeval').Environment;
var evalGen = require('./objeval').evalGen;
var run = require('./objeval').run;

// environment with just an arity-2 sum function for testing
var justSum = new Environment([{'+': function(a, b){return a + b}}]);

describe('objeval', function(){
  describe('Environment', function(){
    it('should do lookup through scopes from right to left', function(){
      var env = new Environment([{a:1}, {a:2}, {}], {});
      assert.deepEqual(env.lookup('a'), 2)
    });
    it('should use functions if not found in scopes', function(){
      var env = new Environment([{a:1}, {a:2}, {}], {b:3});
      assert.deepEqual(env.lookup('b'), 3);
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
  describe('Lambda', function(){
    it('should work', function(){
      assert.deepEqual(run('((lambda 1))'), 1);
      assert.deepEqual(run('((lambda a b (+ a b)) 1 2)'), 3);
    });
  });
  describe('NamedFunction', function(){
    it('should work', function(){
      var tmpEnv = new Environment([{'+': function(a, b){return a + b}}]);
      run('(defn foo x y (+ x y))', tmpEnv);
      assert.isDefined(tmpEnv.funs.foo);
      assert.deepEqual(run('(foo 1 2)', tmpEnv), 3);
    });
  });
  describe('Set', function(){
    it('should change the rightmost occurence', function(){
      var tmpEnv = new Environment([{a: 1}, {a: 2}]);
      run('(set! a 3)', tmpEnv)
      assert.deepEqual(tmpEnv.scopes, [{a: 1}, {a: 3}]);
    });
  });
  describe('If', function(){
    it('should not evaluate the wrong case', function(){
      assert.deepEqual(run('(if 1 2 a)'), 2);
    });
  });
  describe('Runner', function(){
    it('should be iterable', function(){
      var e = new Runner('1');
      assert.deepEqual(e.next(), {value: 1, finished: true});
      var e = new Runner('(+ 1 2)');
      assert.deepEqual(e.next(), {value: null, finished: false});
    });
  });
  describe('run', function(){
    assert.deepEqual(run('1'), 1);
    assert.deepEqual(run('"a"'), "a");
    assert.deepEqual(run('(+ 1 2)'), 3);
  });
});
