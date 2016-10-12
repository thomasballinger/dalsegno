'use strict';
var fs = require('fs');

var chai = require('chai');
var assert = chai.assert;

var tokenize = require('./parse.js').tokenize;
var parse = require('./parse.js').parse;
var run = require('./run');
var Environment = require('./Environment');
var builtins = require('./builtins.js');
var stdlibcode = require('./stdlibcode.js');
var ScopeCheck = require('./ScopeCheck');
var withConsoleLogIgnored = require('./testutils').withConsoleLogIgnored;
var deepCopy = require('./deepCopy.js');

var buildEnv = function(runner){
  return run.buildEnv([builtins, stdlibcode, {}], [], runner);
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

var run = run;
var Runner = run.Runner;

describe('building environments with buildEnv', function(){
  it('works with mappings', function(){
    var env = run.buildEnv([{a:1, b:2}, {b:3}], [], new Runner(null));
    assert.equal(env.lookup('a'), 1);
    assert.equal(env.lookup('b'), 3);
  });
  it('works with code', function(){
    var env = run.buildEnv(['(define a 1)'], [], new Runner(null));
    assert.equal(env.lookup('a'), 1);
  });
  it('works with code that references scopes', function(){
    var env = run.buildEnv([{a:1}, '(define b a)'], [], new Runner(null));
    assert.equal(env.lookup('b'), 1);
  });
  it('works with code that references library scopes', function(){
    var libScope = new (function Foo(){ this.a = 1; });
    var env = run.buildEnv(['(define b a)'], [libScope], new Runner(null));
    assert.equal(env.lookup('b'), 1);
  });
});

describe('runner frame searching:', function(){
  it('finds prev frame index', function(){
    var runner = new Runner({});
    runner.keyframeNums = [1, 2, 3, 4, 10, 11, 12, 13];
    assert.equal(runner.prevKeyframeIndex(0), null);
    assert.equal(runner.prevKeyframeIndex(1), 0);
    assert.equal(runner.prevKeyframeIndex(3), 2);
    assert.equal(runner.prevKeyframeIndex(6), 3);
    assert.equal(runner.prevKeyframeIndex(11), 5);
    assert.equal(runner.prevKeyframeIndex(15), 7);
  });
  it('finds next from index', function(){
    var runner = new Runner({});
    runner.keyframeNums = [1, 2, 3, 4, 10, 11, 12, 13];
    assert.equal(runner.nextKeyframeIndex(0), 0);
    assert.equal(runner.nextKeyframeIndex(1), 0);
    assert.equal(runner.nextKeyframeIndex(2), 1);
    assert.equal(runner.nextKeyframeIndex(6), 4);
    assert.equal(runner.nextKeyframeIndex(15), null);
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

describe('cached nondeterministic results', function(){
  function NonDetScope(){
    Object.defineProperty(this, '_is_nondeterministic', {
      enumerable: false,
      value: true
    });
    this.value = 1;
    this.timesMethodCalled = 0;
  }
  NonDetScope.prototype.method = function(){
    this.timesMethodCalled++;
    if (typeof this.cb !== "undefined"){
      this.cb();
    }
    return this.value;
  };
  var prog = dedent(`
    "a"
    (method)
    "b"`);

  it('caches results of nondet functions', function(){
    var runner = new Runner({});
    var nds = new NonDetScope();
    runner.setEnvBuilder( runner => {
      return run.buildEnv([builtins, stdlibcode, {}], [nds], runner);
    });

    var i;
    runner.loadUserCode(prog);
    while (!runner.runOneStep(false)){}
    assert.equal(nds.timesMethodCalled, 1);

    runner.loadUserCode(prog);
    while (!runner.runOneStep(true)){}
    assert.equal(nds.timesMethodCalled, 1);

    runner.loadUserCode(prog);
    while (!runner.runOneStep(false)){}
    assert.equal(nds.timesMethodCalled, 2);
  });
  it('cached results work with restored states', function(){
    var runner = new Runner({});
    var nds = new NonDetScope();
    runner.setEnvBuilder( runner => {
      return run.buildEnv([builtins, stdlibcode, {}], [nds], runner);
    });

    runner.loadUserCode(prog);
    runner.runOneStep(false);
    var state = runner.copy();
    while (!runner.runOneStep(false)){}
    runner.restoreState(deepCopy(state));
    while (!runner.runOneStep(true)){}
    runner.restoreState(state);
    while (!runner.runOneStep(true)){}
    assert.equal(nds.timesMethodCalled, 1);
  });
  it('cached results work with instantSeekToKeyframeBeforeBack', function(){
    var runner = new Runner({});
    var nds = new NonDetScope();
    runner.setEnvBuilder( runner => {
      return run.buildEnv([builtins, stdlibcode, {}], [nds], runner);
    });

    runner.loadUserCode(prog);
    runner.runOneStep(false);
    runner.saveKeyframe();
    while (!runner.runOneStep(false)){}
    runner.instantSeekToKeyframeBeforeBack(5);
    while (!runner.runOneStep(true)){}
    runner.instantSeekToKeyframeBeforeBack(5);
    while (!runner.runOneStep(true)){}
    assert.equal(nds.timesMethodCalled, 1);
  });
  it('cache gets cleared when executed from a previous point', function(){
    var runner = new Runner({});
    var nds = new NonDetScope();
    runner.setEnvBuilder( runner => {
      return run.buildEnv([builtins, stdlibcode, {}], [nds], runner);
    });

    runner.loadUserCode(prog);
    runner.runOneStep(false);
    runner.saveKeyframe();
    while (!runner.runOneStep(false)){}
    assert.deepEqual(runner.cachedNondetResults, {3: 1});
    runner.instantSeekToKeyframeBeforeBack(5);
    assert.deepEqual(runner.cachedNondetResults, {3: 1});
    runner.clearCachedNondetsBeyond(2);
    assert.deepEqual(runner.cachedNondetResults, {});
  });
});
describe('when executed from a previous point', function(){
  var prog = '1\n2\n3\n4\n5\n6';
  var envBuilder = runner => {
    return run.buildEnv([builtins, stdlibcode, {}], [], runner);
  };

  it('keyframes get cleared', function(){
    var runner = new Runner({});
    runner.setEnvBuilder(envBuilder);
    runner.loadUserCode(prog);
    runner.saveKeyframe();
    runner.runOneStep();
    runner.saveKeyframe();
    assert.deepEqual(runner.keyframeNums, [0, 1]);
    runner.clearKeyframesBeyond(0);
    assert.deepEqual(runner.keyframeNums, [0]);
  });
  it('future defn saves get cleared', function(){
    var runner = new Runner({});
    runner.setEnvBuilder(envBuilder);
    runner.loadUserCode(prog);
    runner.runOneStep();
    runner.saveStateByDefn('a');
    runner.runOneStep();
    runner.saveStateByDefn('b');
    assert.sameMembers(Object.keys(runner.savesByFunInvoke), ['a', 'b']);
    runner.clearDefnsBeyond(1);
    assert.sameMembers(Object.keys(runner.savesByFunInvoke), ['a']);
  });
  it('everything gets cleared', function(){
    var runner = new Runner({});
    runner.setEnvBuilder(envBuilder);
    runner.loadUserCode(prog);
    runner.runOneStep();
    runner.runOneStep();
    assert.equal(runner.counterMax, 2);
    assert.equal(runner.counter, 2);
    runner.clearBeyond();
    assert.equal(runner.counterMax, 2);
    runner.clearBeyond(1);
    assert.equal(runner.counterMax, 1);
  });
});

describe('interactive features', function(){
  /* TODO
  it('updates functions', function(){
    var env = run.buildEnv([builtins, stdlibcode, {}]);
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

    function assertNotDone(unfinished){
      assert.equal(unfinished, true);
    }

    env.define('c', 0);
    runner.loadUserCode(program);
    runner.runABit(100, assertNotDone);

    env.set('c', 1);
    runner.runABit(100, assertNotDone);
    var save = runner.savesByFunInvoke['on-c'];

    runner.runABit(100, assertNotDone);

    var beforeRestore = runner.currentEnv().lookup('x');

    runner.context = save.context;
    runner.funs = save.funs;
    runner.scopeCheck = save.scopeCheck;

    runner.runABit(100, assertNotDone);

    assert.isTrue(runner.currentEnv().lookup('x') < beforeRestore);
  });
});

describe('reload bugs:', function(){
  var scopeObj;
  var runner;
  var lastEnv;
  function ScopeObj(){
    this._keepRunning = true;
    this._timesAssert1Run = 0;
    this._timesAssert2Run = 0;
    this._timesAssert3Run = 0;
  }
  ScopeObj.prototype.stopRunning = function(){ this._keepRunning = false; };
  ScopeObj.prototype.assert1 = function(){ this._timesAssert1Run += 1; };
  ScopeObj.prototype.assert2 = function(){ this._timesAssert2Run += 1; };
  ScopeObj.prototype.assert3 = function(){ this._timesAssert3Run += 1; };
  ScopeObj.prototype.thisNeverRuns = function(){ assert.fail("this line shouldn't have run"); };

  function runUntilStop(){
    scopeObj._keepRunning = true;
    while (scopeObj._keepRunning){
      runner.runOneStep();
    }
  }

  beforeEach(function(){
    scopeObj = undefined;
    lastEnv = undefined;
    runner = new Runner({});

    runner.setEnvBuilder( runner => {
      runner.scopeCheck.log = [];
      scopeObj = new ScopeObj();
      lastEnv = run.buildEnv([builtins, stdlibcode, {}], [scopeObj], runner);
      return lastEnv;
    });
  });

  it('nonexistant future snapshot problem', function(){
    var prog = dedent(`
      (defn f1 () 1)
      (stopRunning)
      (defn f2 () 2)
      (stopRunning)
      1`);

    runner.loadUserCode(prog);
  });
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

    runner.loadUserCode(prog);
    runUntilStop();
    runner.update(prog.replace('hello', 'goodbye'));
    runUntilStop();
  });
  it('updating a tail-called function uses the new code immediately', function(){
    var prog = dedent(`
      (define x 0)
      (defn recur ()
        (assert1)
        (stopRunning)
        (assert2)
        (recur))
      (recur)`);

    runner.update(prog);
    //runner.debug = prog;

    runUntilStop();
    assert.equal(scopeObj._timesAssert1Run, 1);
    assert.equal(scopeObj._timesAssert2Run, 0);

    runner.update(prog.replace('assert1', 'assert3'));
    runUntilStop();

    assert.equal(scopeObj._timesAssert1Run, 1);
    assert.equal(scopeObj._timesAssert2Run, 0);
    assert.equal(scopeObj._timesAssert3Run, 1);
  });
});
