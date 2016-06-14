'use strict';
var fs = require('fs');

var chai = require('chai');
var assert = chai.assert;

var tokenize = require('./parse.js').tokenize;
var parse = require('./parse.js').parse;
var bcrun = require('./bcrun');
var Environment = require('./Environment');
var builtins = require('./builtins.js');
var stdlibcode = require('./stdlibcode.js');

var buildEnv = function(runner){
  return bcrun.buildEnv([builtins, stdlibcode, {}], [], runner);
};

var run = bcrun;
var Runner = bcrun.BCRunner;

describe('building environments with buildEnv', function(){
  it('works with mappings', function(){
    var env = bcrun.buildEnv([{a:1, b:2}, {b:3}], [], new Runner(null));
    assert.equal(env.lookup('a'), 1);
    assert.equal(env.lookup('b'), 3);
  });
  it('works with code', function(){
    var env = bcrun.buildEnv(['(define a 1)'], [], new Runner(null));
    assert.equal(env.lookup('a'), 1);
  });
  it('works with code that references scopes', function(){
    var env = bcrun.buildEnv([{a:1}, '(define b a)'], [], new Runner(null));
    assert.equal(env.lookup('b'), 1);
  });
  it('works with code that references library scopes', function(){
    var libScope = new (function Foo(){ this.a = 1; });
    var env = bcrun.buildEnv(['(define b a)'], [libScope], new Runner(null));
    assert.equal(env.lookup('b'), 1);
  });
});

describe('integration', function(){
  it('store', function(){
    run.runWithDefn("(defn foo () 1)");
  });
  it('store, lookup and retrieve', function(){
    run.runWithDefn("(do (defn foo () 1) (foo))");
  });
  it('and retrieve', function(){
    run.runWithDefn("(do (defn foo () 1) (foo))", buildEnv);
  });
  it('global functions simple', function(){
    run.runWithDefn("\n"+
        "(do                                   \n"+
        "  (defn foo (x) (do x x))               \n"+
        "  (foo 1))",
    buildEnv, false);
  });
  it('global functions', function(){
    run.runWithDefn("\n"+
        "(do                                   \n"+
        "  (defn foo (x) (do x x))               \n"+
        "  (defn main () (do                      \n"+
        "    (foo 1)                           \n"+
        "    (map foo (list 1 2 3))))          \n"+
        "  (main))",
    buildEnv, false);
  });
  it('browser bug?', function(){
    run.runWithDefn(
      "(do"+
      "(defn game () (do "+
        '"game" "started"))'+
      "(game))", buildEnv);
  });
});

describe('interactive features', function(){
  /* TODO
  it('updates functions', function(){
    var env = bcrun.buildEnv([builtins, stdlibcode, {}]);
    var runner = new Runner({});
  }); */
  it('deepcopies closed-over state', function(){
    var program = `
(do
  (defn game () (do
    (define x 100)
    (define vx 1)
    (define counter 0)
    (defn on-c ()
      (set! vx (+ vx 1)))
    (defn main () (do
      (set! counter (+ counter 1))
      (if c
          (do
            (set! c 0)
            (on-c)))
      (set! x (+ x vx))
      (main)))
    (main)))
  (game))`;

    var runner = new Runner({});
    var env = buildEnv(runner);
    var origScopeCheck = runner.scopeCheck;

    // So we can hold onto an environment and check in on it, creating a new environment
    // preserves the old scopeCheck (the runner using a new one would invalidate the old
    // stored env which holds a reference to this runner
    var returnEnv = function(){
      runner.scopeCheck = origScopeCheck;
      return env;
    };
    runner.setEnvBuilder(returnEnv);

    env.define('c', 0);
    runner.loadUserCode(program);
    runner.runABit(100);

    env.set('c', 1);
    runner.runABit(100);
    var save = runner.savesByFunInvoke['on-c'];

    runner.runABit(100);

    var beforeRestore = runner.currentEnv().lookup('x');

    runner.context = save.context;
    runner.funs = save.funs;
    runner.scopeCheck = save.scopeCheck;

    runner.runABit(100);

    assert.isTrue(runner.currentEnv().lookup('x') < beforeRestore);
  });
});

describe('reload bug', function(){
  it.only('inner defn ok on reload', function(){
    var prog = `
(defn terrain (n)
  "hello"
  (defn gradual-slope (x) 1))
(defn main ()
  (terrain 1)
  (terrain 2)
  (stopRunning))
(main)`;

    var runner = new Runner({});

    var keepRunning = true;
    function scopeObj(){
      this.stopRunning = function(){
        keepRunning = false;
      };
      this.assertion1 = function(){
        assert.isTrue(true);
      };
    }

    var lastEnv;
    runner.setEnvBuilder( runner => {
      lastEnv = bcrun.buildEnv([builtins, stdlibcode, {}], [new scopeObj()], runner);
      return lastEnv;
    });
    runner.loadUserCode(prog);
    runner.debug = prog;

    while (keepRunning){
      runner.runOneStep();
    }
    runner.update(prog.replace('hello', 'goodbye'));
    keepRunning = true;
    while (keepRunning){
      runner.runOneStep();
    }
  });
});

