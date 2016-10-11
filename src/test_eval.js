'use strict';
var chai = require('chai');
var assert = chai.assert;

var Immutable = require('../Immutable');
var tokenize = require('./parse.js').tokenize;
var parse = require('./parse.js');
var jc = parse.justContent;
var run = require('./run');
var Runner = run.Runner;
var Environment = require('./Environment.js');
var NamedFunctionPlaceholder = Environment.NamedFunctionPlaceholder;
var compile = require('./compile.js');

// environment with just an arity-2 sum function for testing
var justSumScope = {'+': function(a, b){return a + b; }};
var justSum = function(){ return new Environment(justSumScope); };

var lastAssignedEnv;
var buildJustSum = function(runner){
  var env = new Environment(justSumScope, undefined, runner);
  lastAssignedEnv = env;
  return env;
};

describe('Evaluation with bytecode', function(){
  describe('Lambda', function(){
    it('should work', function(){
      assert.deepEqual(run('((lambda () 1))'), 1);
      assert.deepEqual(run('((lambda (a b) (+ a b)) 1 2)', justSum()), 3);
    });
  });
  describe('NamedFunction', function(){
    it('should work with Runner', function(){
      run.runWithDefn('(defn foo (x y) (+ x y))', buildJustSum);
      assert.isDefined(lastAssignedEnv.runner.funs.foo);
      assert.deepEqual(run.runWithDefn('(do (defn foo (x y) (+ x y)) (foo 1 2))',
                                       buildJustSum), 3);
    });
  });
  describe('Set', function(){
    it('should change the rightmost occurence', function(){
      var tmpScope = new function(){ this.assertion = function(){
          assert.deepEqual(tmpEnv.toObjects(), [{a: 1}, {a: 3}]);
        };
      };
      var tmpEnv = Environment.fromMultipleMutables([{a: 1}, {a: 2}]);
      tmpEnv.libraryScopes = [tmpScope];
      run('(set! a 3)\n(assertion)', tmpEnv);
    });
  });
  describe('If', function(){
    it('should not evaluate the wrong case', function(){
      assert.deepEqual(run('(if 1 2 a)'), 2);
    });
  });
  describe('Begin', function(){
    it('should run stuff in order', function(){
      var tmpScope = new function(){ this.assertion = function(){
        assert.deepEqual(tmpEnv.toObjects(), [{a: 4}]);
      };};
      var tmpEnv = new Environment({a: 2}, [tmpScope]);
      run('(begin (set! a 3) (set! a 4) (assertion))', tmpEnv);
    });
    it('should run all statements', function(){
      var tmpScope = new function(){ this.assertion = function(){
        assert.deepEqual(tmpEnv.toObjects(), [{a: 2, b: 3, c: 4, d: 5}]);
      };};
      var tmpEnv = new Environment({a: 2}, [tmpScope]);
      run('(begin (define b 3) (define c 4) (define d 5) (assertion))', tmpEnv);
    });
    it('should run each statement once', function(){
      var tmpScope = new function(){ this.assertion = function(){
        assert.deepEqual(tmpEnv.toObjects()[1], {a: 2, b: 2, c: 2});
      };};
      var tmpEnv = Environment.fromMultipleMutables([justSumScope, {a: 1, b: 1, c: 1}]);
      tmpEnv.libraryScopes = [tmpScope];
      run('(begin (set! a (+ a 1)) (set! b (+ b 1)) (set! c (+ c 1)) (assertion))', tmpEnv);
    });
  });
  describe('define', function(){
    it('should create new variables in the local scope', function(){
      var tmpScope = new function(){ this.assertion = function(){
        assert.deepEqual(tmpEnv.toObjects(), [{a: 2}, {a: 3, b: 10}]);
      };};
      var tmpEnv = Environment.fromMultipleMutables([{a: 2}, {a: 3}]);
      tmpEnv.libraryScopes = [tmpScope];
      run('(define b 10)\n(assertion)', tmpEnv);
    });
  });
  describe('run', function(){
    it("should run code that doesn't contain defns", function(){
      assert.deepEqual(run('1'), 1);
      assert.deepEqual(run('"a"'), 'a');
      assert.deepEqual(run('(+ 1 2)', justSum()), 3);
    });
  });
  describe('runWithDefn', function(){
    it("should run code that contains defns", function(){
      assert.deepEqual(run.runWithDefn('(do (defn foo () 1) (foo))'), 1);
    });
  });

  describe("Environments", function(){
    describe("without runners", function(){
      it('should do lookup through scopes from right to left', function(){
        var env = Environment.fromMultipleMutables([{a:1}, {a:2}, {}]);
        assert.deepEqual(env.lookup('a'), 2);
      });
      it('should create new environments with scopes', function(){
        var env = Environment.fromMultipleMutables([{a:1}, {a:2}, {}]);
        var newEnv = env.newWithScope({a:3});
        assert.deepEqual(newEnv.lookup('a'), 3);
        assert.deepEqual(env.lookup('a'), 2);
      });
      it('should fail to look up functions if no runner is bound', function(){
        var env = Environment.fromMultipleMutables([{a:1}, {a:2}, {}]);
        assert.throws(function(){ env.lookupFunction('b'); });
      });
    });
    describe("with runners", function(){
      it('should look up functions and non-functions', function(){
        var fakeFunction = {incref: function(){}};
        var runner = new Runner({'b': fakeFunction});
        var env = Environment.fromMultipleMutables([{a:1}, {a:2}, {}], runner);
        assert.deepEqual(env.lookup('a'), 2);
        assert.deepEqual(env.lookup('b'), new NamedFunctionPlaceholder('b', runner));
        assert.throws(function(){ env.lookup('c'); }, /not found in/);
        assert.deepEqual(env.retrieveNamedFunction('b'), fakeFunction);
      });
      it('should retrieve actual functions', function(){
        var fakeFunction = {incref: function(){}};
        var runner = new Runner({'b': fakeFunction});
        var env = Environment.fromMultipleMutables([{a:1}, {a:2}, {}], runner);
        env.runner = runner;
        assert.deepEqual(env.lookup('b'), new NamedFunctionPlaceholder('b', runner));
        assert.deepEqual(env.retrieveNamedFunction('b'), fakeFunction);
        assert.deepEqual(env.lookup('a'), 2);
      });
    });
  });

  describe("Runner object", function(){
    describe('Runs code', function(){
      it('should run code without defns', function(){
        var lastAssignedEnv;
        var tmpEnvBuilder = function(runner){
          var env = Environment.fromMultipleMutables([{'+': function(a, b){return a + b;}}, {a: 1}], runner);
          lastAssignedEnv = env;

          var tmpScope = new function(){
            this.assertion1 = function(){
              assert.deepEqual(env.toObjects()[1], {a: 1, b: 2});
            };
          };
          env.libraryScopes = [tmpScope];
          return env;
        };

        var runner = new Runner(null);

        runner.runLibraryCode('(define b 2)\n(assertion1)', tmpEnvBuilder());
        assert.throws(function(){ runner.runLibraryCode('(defn foo () 1)');}, /defn/);
        runner.setEnvBuilder(tmpEnvBuilder);
        runner.loadUserCode('(defn foo () 1)');
        assert.throws(function(){ runner.value(); }, /Runner doesn't allow named functions/);
        runner.funs = {};
        runner.value();
        assert.deepEqual(runner.funs.foo.name, 'foo');
        //TOMHERE once defn scope increfing is fixed, we're here
        assert.deepEqual(runner.funs.foo.env.toObjects(),
                         lastAssignedEnv.toObjects());
        /*
                         */
      });
      it('should load defn code', function(){
        var lastAssignedEnv;
        var tmpEnvBuilder = function(runner){
          var env = Environment.fromMultipleMutables([{'+': function(a, b){return a + b;}}, {a: 1}], runner);
          lastAssignedEnv = env;
          return env;
        };
        var runner = new Runner({});
        runner.setEnvBuilder(tmpEnvBuilder);
        runner.loadUserCode('(do (defn foo () 1) (foo))');
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

  describe("compilation types: ", function(){
    describe("initialization code", function(){
      it("doesn't decref scope", function(){
        var runner = new Runner({});
        var tmpEnv = new Environment({a: 2}, []);
        runner.runInitializationCode('(define b 2)', tmpEnv);
        assert.equal(runner.scopeCheck.scopes.count(), 1);
        runner.runInitializationCode('(define c 3)', tmpEnv);
        assert.equal(runner.scopeCheck.scopes.count(), 1);
      });
    });
  });
});

