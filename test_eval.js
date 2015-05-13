'use strict';
var chai = require('chai');
var assert = chai.assert;

var tokenize = require('./parse.js').tokenize;
var parse = require('./parse.js').parse;
var run = require('./run');
var Environment = run.Environment;
var evalGen = run.evalGen;
var Runner = run.Runner;

// environment with just an arity-2 sum function for testing
var justSum = new Environment([{'+': function(a, b){return a + b}}]);

describe('Evaluation Iterators', function(){
  describe('evalGen', function(){
    it('should return an evaluation object', function(){
      var e = evalGen(1);
      assert(e.isEvalGen);
      assert.equal(e.ast, 1);
      var e = evalGen(parse('(+ 1 2)'), justSum);
      assert(e.isEvalGen);
      assert.deepEqual(e.ast, ['+', 1, 2]);
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
      assert.deepEqual(run('((lambda a b (+ a b)) 1 2)', justSum), 3);
    });
  });
  describe('NamedFunction', function(){
    it('should work with Runner', function(){
      var tmpEnv = new Environment( [{'+': function(a, b){return a + b;}}]);
      run.runWithDefn('(defn foo x y (+ x y))', tmpEnv);
      assert.isDefined(tmpEnv.runner.funs.foo);
      assert.deepEqual(run.runWithDefn('(do (defn foo x y (+ x y)) (foo 1 2))', tmpEnv), 3);
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
  describe('Begin', function(){
    it('should run stuff in order', function(){
      var tmpEnv = new Environment([{a: 2}]);
      run('(begin (set! a 3) (set! a 4))', tmpEnv);
      assert.deepEqual(tmpEnv.scopes, [{a: 4}]);
    });
    it('should run all statements', function(){
      var tmpEnv = new Environment([{a: 2}]);
      run('(begin (define b 3) (define c 4) (define d 5))', tmpEnv);
      assert.deepEqual(tmpEnv.scopes, [{a: 2, b: 3, c: 4, d: 5}]);
    });
    it('should run each statement once', function(){
      var tmpEnv = new Environment([{'+': function(a, b){return a + b;}}, {a: 1, b: 1, c: 1}]);
      run('(begin (set! a (+ a 1)) (set! b (+ b 1)) (set! c (+ c 1)))', tmpEnv);
      assert.deepEqual(tmpEnv.scopes[1], {a: 2, b: 2, c: 2});
    });
  });
  describe('define', function(){
    it('should create new variables in the local scope', function(){
      var tmpEnv = new Environment([{a: 2}, {a: 3}]);
      run('(define b 10)', tmpEnv)
      assert.deepEqual(tmpEnv.scopes, [{a: 2}, {a: 3, b: 10}]);
    });
  });
});

describe("Running code", function(){
  describe('run', function(){
    it("should run code that doesn't contain defns", function(){
      assert.deepEqual(run('1'), 1);
      assert.deepEqual(run('"a"'), "a");
      assert.deepEqual(run('(+ 1 2)', justSum), 3);
    });
  });
  describe('runWithDefn', function(){
    it("should run code that contains defns", function(){
      assert.deepEqual(run.runWithDefn('(do (defn foo 1) (foo))'), 1);
    });
  });
});

describe("Environments", function(){
  describe("without runners", function(){
    it('should do lookup through scopes from right to left', function(){
      var env = new Environment([{a:1}, {a:2}, {}]);
      assert.deepEqual(env.lookup('a'), 2);
    });
    it('should create new environments with scopes', function(){
      var env = new Environment([{a:1}, {a:2}, {}]);
      var newEnv = env.newWithScope({a:3});
      assert.deepEqual(newEnv.lookup('a'), 3);
      assert.deepEqual(env.lookup('a'), 2);
    });
    it('should fail to look up functions if no runner is bound', function(){
      var env = new Environment([{a:1}, {a:2}, {}]);
      assert.throws(function(){ env.lookupFunction('b'); });
    });
  });
  describe("with runners", function(){
    it('should lookup functions and non-functions', function(){
      var runner = new Runner({'b': 'something'});
      var env = new Environment([{a:1}, {a:2}, {}], runner);
      assert.deepEqual(env.lookup('a'), 2);
      assert.deepEqual(env.lookup('b'), new run.NamedFunctionPlaceholder('b', runner));
      assert.throws(function(){ env.lookup('c'); }, /not found in environment/);
      assert.deepEqual(env.retrieveFunction('b'), 'something');
    });
    it('should retrieve actual functions', function(){
      var runner = new Runner({'b': 'something'});
      var env = new Environment([{a:1}, {a:2}, {}]);
      env.runner = runner;
      assert.deepEqual(env.lookup('b'), new run.NamedFunctionPlaceholder('b', runner));
      assert.deepEqual(env.retrieveFunction('b'), 'something');
      assert.deepEqual(env.lookup('a'), 2);
    });
  });
});

describe("Runner object", function(){
  describe('Runs code', function(){
    it('should run code without defns', function(){
      var tmpEnv = new Environment([{'+': function(a, b){return a + b;}}, {a: 1}]);
      var runner = new Runner(null);
      runner.runLibraryCode('(define b 2)', tmpEnv);
      assert.throws(function(){ runner.runLibraryCode('(defn foo 1)');}, /Runner doesn't allow named functions/);
      assert.deepEqual(tmpEnv.scopes[1], {a: 1, b: 2});
      runner.loadUserCode('(defn foo 1)', tmpEnv);
      assert.throws(function(){ runner.value(); }, /Runner doesn't allow named functions/);
      runner.funs = {};
      runner.value();
      assert.deepEqual(runner.funs.foo.body, 1);
      assert.deepEqual(runner.funs.foo.name, 'foo');
      assert.deepEqual(runner.funs.foo.env.scopes, 
                       tmpEnv.scopes);
    });
    it('should load defn code', function(){
      var tmpEnv = new Environment([{'+': function(a, b){return a + b;}}, {a: 1}]);
      var runner = new Runner({});
      runner.loadUserCode('(do (defn foo 1) (foo))', tmpEnv);
      assert.deepEqual(runner.value(), 1);
      assert.deepEqual(runner.value(), 1);
    });
  });
  it("should check if function exists", function(){
    var runner = new Runner({});
    runner.funs.a = "hi";
    assert.deepEqual(runner.functionExists('a'), true);
    assert.deepEqual(runner.functionExists('b'), false);
  });
});
