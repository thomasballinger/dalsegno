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
var ScopeCheck = require('./ScopeCheck');
var withConsoleLogIgnored = require('./testutils').withConsoleLogIgnored;

var buildEnv = function(runner){
  return bcrun.buildEnv([builtins, stdlibcode, {}], [], runner);
};

function dedent(s){
  function numLeadingSpaces(s){
    return /^[ ]*/.exec(s)[0].length;
  }
  var minIndent = Math.min.apply(null, s.split('\n')
    .filter(x => x.length > 0)
    .map(numLeadingSpaces));
  // might be Infinity if empty, but that works fine
  return s.split('\n').map(x => x.slice(minIndent)).join('\n');
}

describe('main helpers', function(){
  describe('dedent', function(){
    it('leaves unindented code unchanged', function(){
      assert.equal(dedent('hello\nthere'), 'hello\nthere');
      assert.equal(dedent('hello\n\nthere'), 'hello\n\nthere');
      assert.equal(dedent('hello\n  there'), 'hello\n  there');
    });
    it('dedents indented code', function(){
      assert.equal(dedent('  hello\n  there'), 'hello\nthere');
      assert.equal(dedent('  hello\n\n  there'), 'hello\n\nthere');
      assert.equal(dedent('  hello\n  \n  there'), 'hello\n\nthere');
      assert.equal(dedent('  hello\n    there'), 'hello\n  there');
    });
    it('works for empty strings', function(){
      assert.equal(dedent('\n\n\n'), '\n\n\n');
    });
  });
});

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
    run.runWithDefn(dedent(`
      (do
        (defn foo (x) (do x x))
        (foo 1))`),
    buildEnv, false);
  });
  it('global functions', function(){
    run.runWithDefn(dedent(`
      (do
        (defn foo (x) (do x x))
        (defn main () (do
          (foo 1)
          (map foo (list 1 2 3))))
        (main))`),
    buildEnv, false);
  });
  it('browser bug?', function(){
    run.runWithDefn(dedent(`
      (do
      (defn game () (do
        "game" "started"))
      (game))`), buildEnv);
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

describe('reload bugs', function(){
  it('inner defn ok on reload', function(){
    var prog = dedent(`
      (defn terrain (n)
        "hello"
        (defn gradual-slope (x) 1))
      (defn main ()
        (terrain 1)
        (terrain 2)
        (stopRunning)
        (thisNeverRuns))
      (main)`);

    var runner = new Runner({});

    var keepRunning = true;
    function ScopeObj(){}
    ScopeObj.prototype.stopRunning = function(){ keepRunning = false; };
    ScopeObj.prototype.assertion1 = function(){ assert.isTrue(true); };
    ScopeObj.prototype.thisNeverRuns = function(){ assert.fail("this line shouldn't have run"); };

    var lastEnv;
    runner.setEnvBuilder( runner => {
      runner.scopeCheck.log = [];
      lastEnv = bcrun.buildEnv([builtins, stdlibcode, {}], [new ScopeObj()], runner);
      return lastEnv;
    });

    runner.loadUserCode(prog);

    while (keepRunning){
      runner.runOneStep();
    }

    withConsoleLogIgnored(() => {
      runner.update(prog.replace('hello', 'goodbye'));
    });

    keepRunning = true;
    while (keepRunning){
      runner.runOneStep();
    }
  });
  it.only('updating a tail-called function uses the new code immediately', function(){
    var prog = dedent(`
      (define x 0)
      (defn recur ()
        (assert1)
        (stopRunning)
        (assert2)
        (recur))
      (recur)`);

    var runner = new Runner({});
    runner.setEnvBuilder( runner =>
      bcrun.buildEnv([builtins, stdlibcode, {}], [new ScopeObj()], runner));

    var keepRunning = true;
    var timesAssert1Run = 0;
    var timesAssert2Run = 0;
    var timesAssert3Run = 0;
    function ScopeObj(){}
    ScopeObj.prototype.stopRunning = function(){ keepRunning = false; };
    ScopeObj.prototype.assert1 = function(){ timesAssert1Run += 1; };
    ScopeObj.prototype.assert2 = function(){ timesAssert2Run += 1; };
    ScopeObj.prototype.assert3 = function(){ timesAssert3Run += 1; };

    runner.update(prog);
    //runner.debug = prog;

    while (keepRunning){
      runner.runOneStep();
    }
    assert.equal(timesAssert1Run, 1);
    assert.equal(timesAssert2Run, 0);

    var newProg = prog.replace('assert1', 'assert3');
    runner.update(newProg);
    //runner.debug = newProg;
    keepRunning = true;
    while (keepRunning){
      runner.runOneStep();
    }

    assert.equal(timesAssert1Run, 1);
    assert.equal(timesAssert2Run, 0);
    assert.equal(timesAssert3Run, 1);
  });
});

