'use strict';
var chai = require('chai');
var assert = chai.assert;


var Immutable = require('../Immutable.js');
var parse = require('./parse.js');
var ScopeCheck = require('./ScopeCheck.js').ScopeCheck;
var bcexec = require('./bcexec.js');
var Environment = require('./Environment.js');
var run = require('./run.js');

describe('ScopeCheck', function(){
  it('can be instantiated', function(){
    var sc = new ScopeCheck();
  });
  it('can create new scopes', function(){
    var sc = new ScopeCheck();
    var scopeTicket = sc.new();
  });
  it('can create new scopes with old scope as parent', function(){
    var sc = new ScopeCheck();
    var scopeTicket1 = sc.new();
    var scopeTicket2 = sc.newFromScope(scopeTicket1);
  });
  describe('set, define, and lookup', function(){
    it("can't to find names that aren't there", function(){
      var sc = new ScopeCheck();
      var scopeTicket = sc.new();
      assert.strictEqual(sc.lookup(scopeTicket, 'a'), ScopeCheck.NOTFOUND);
    });
    it("can find stored names", function(){
      var sc = new ScopeCheck();
      var scopeTicket = sc.new();
      sc.define(scopeTicket, 'a', 1);
      assert.equal(sc.lookup(scopeTicket, 'a'), 1);
    });
    it("can find names stored in parent scopes", function(){
      var sc = new ScopeCheck();
      var scopeTicket1 = sc.new();
      sc.define(scopeTicket1, 'a', 1);
      var scopeTicket2 = sc.newFromScope(scopeTicket1);
      assert.equal(sc.lookup(scopeTicket2, 'a'), 1);
    });
    it('can get names in a scope', function(){
      var sc = new ScopeCheck();
      var scopeTicket1 = sc.new();
      sc.define(scopeTicket1, 'a', 1);
      assert.deepEqual(sc.keys(scopeTicket1), ['a']);
    });
  });
  describe("reference counting", function(){
    it('collects scopes decrefed to 0', function(){
      var sc = new ScopeCheck();
      var scopeTicket1 = sc.new();
      sc.decref(scopeTicket1);
      assert.throws(function(){
        sc.lookup(scopeTicket1, 'a');
      }, /bad.*scope.*id/i);
    });
    it('decrefing child to 0 decrefs parent', function(){
      var sc = new ScopeCheck();
      var scopeTicket1 = sc.new();
      var scopeTicket2 = sc.newFromScope(scopeTicket1);
      assert.equal(sc.scopes.count(), 2);
      assert.equal(sc.getCount(scopeTicket1), 2);
      assert.equal(sc.getCount(scopeTicket2), 1);
      sc.decref(scopeTicket1);
      assert.equal(sc.getCount(scopeTicket1), 1);
      assert.equal(sc.getCount(scopeTicket2), 1);
      sc.decref(scopeTicket2);
      assert.equal(sc.scopes.count(), 0);
    });
    it("incref increments scope and parent but not parent's parent", function(){
      var sc = new ScopeCheck();
      var s1 = sc.new();
      var s2 = sc.newFromScope(s1);
      var s3 = sc.newFromScope(s2);
      assert.equal(sc.scopes.count(), 3);
      assert.equal(sc.getCount(s1), 2);
      assert.equal(sc.getCount(s2), 2);
      assert.equal(sc.getCount(s3), 1);
      sc.decref(s1);
      sc.decref(s2);
      assert.equal(sc.getCount(s1), 1);
      assert.equal(sc.getCount(s2), 1);
      assert.equal(sc.scopes.count(), 3);
      sc.decref(s3);
      assert.equal(sc.scopes.count(), 0);
    });
    /*
    it('decrefs when leaving scope', function(){
    });
    it('incref with each closure produced', function(){
    });
    */
  });
  describe("code refcounts", function(){
    beforeEach( () => { ScopeCheck.prototype.alwaysRunGC = true; });
    afterEach( () => { delete ScopeCheck.prototype.alwaysRunGC; });
    it('ends a run with the scope collected', function(){
      var env = new Environment();
      var sc = env.runner.scopeCheck;
      assert.equal(sc.scopes.count(), 1);
      assert.equal(sc.getCount(env.mutableScope), 1);
      bcexec('1', env);
      assert.equal(sc.scopes.count(), 0);
    });
    it('returned lambda increfs', function(){
      var env = new Environment();
      var sc = env.runner.scopeCheck;
      assert.equal(sc.scopes.count(), 1);
      assert.equal(sc.getCount(env.mutableScope), 1);
      bcexec('(lambda () 1)', env);
      assert.equal(sc.scopes.count(), 1);
      assert.equal(sc.getCount(env.mutableScope), 1);
    });
    it('popped lambda decrefs', function(){
      function TestScope(){
        this.assertOneScopeOneRef = function(){
          assert.equal(sc.scopes.count(), 1);
          assert.equal(sc.getCount(env.mutableScope), 1);
        };
      }
      var env = new Environment(undefined, [new TestScope()]);
      var sc = env.runner.scopeCheck;
      assert.equal(sc.scopes.count(), 1);
      assert.equal(sc.scopes.get(env.mutableScope).get('refcount'), 1);
      bcexec(`(lambda () 1)
              (assertOneScopeOneRef)
              1`, env);
      assert.equal(sc.scopes.count(), 0);
    });
    it('leaving scope decrefs that scope', function(){
      //TODO why are lambdas appearing as placeholders on the valueStack?
      var env = new Environment();
      var sc = env.runner.scopeCheck;
      var s = `(define foo (lambda () 1))
             (foo)
             1`;
      bcexec(s, env, false);
      assert.equal(sc.scopes.count(), 0);
    });
    it('leaving scope cleans up closures in that scope', function(){
      function TermScope(){
        this.assertTwoScopes = function(){
          assert.equal(sc.scopes.count(), 2);
          assert.equal(sc.getCount(env.mutableScope), 5);
        };
      }
      var env = new Environment(undefined, [new TermScope()]);
      console.log(env.runner);
      var sc = env.runner.scopeCheck;
      bcexec(`(define foo (lambda ()
                 (define bar (lambda () 1))
                 (assertTwoScopes)
                 1))
              (foo)`, env);
      assert.equal(sc.scopes.count(), 0);
    });
    it('define decrefs when pushed off', function(){
      var env = new Environment();
      var sc = env.runner.scopeCheck;
      bcexec('(define foo (lambda () 1))\n1', env);
      assert.equal(sc.scopes.count(), 0);
    });
    it('closures are saved by define', function(){
      function TermScope(){
        this.assertTwoScopes = function(){
          assert.equal(sc.scopes.count(), 2);
        };
      }
      var env = new Environment(undefined, [new TermScope()]);
      var sc = env.runner.scopeCheck;
      bcexec(`(define foo
                ((lambda ()
                   (define x 1)
                   (lambda () x))))
              (assertTwoScopes)`, env);
      //assert.equal(sc.scopes.count(), 0);
    });
    /*
    it.only('closures are saved by set', function(){ });
    it.only('closures are decrefed by set', function(){ });
    it.only('closuers displaced by define are decrefed', function(){ });
    it.only('looking up a closure increfs it', function(){ });
    */
    it('decrefs when making tail call', function(){
      function TermScope(){
        this.assertTwoScopes = function(){
          assert.equal(sc.scopes.count(), 2);
        };
      }
      var env = new Environment(undefined, [new TermScope()]);
      var sc = env.runner.scopeCheck;
      bcexec(`(define foo (lambda () (bar)))
              (define bar (lambda ()
                (assertTwoScopes)
                1))
              (foo)`, env);
      assert.equal(sc.scopes.count(), 0);
    });
  });
  describe("runner with named funs", function(){
    it("increfs when storing and doesn't decref or gc", function(){
      var runner = new run.Runner({});
      var tmpScope = new function(){
        this.assertion = function(){
          //console.log(runner.funs);
          //console.log(runner.scopeCheck);
          assert.equal(runner.scopeCheck.scopes.count(), 2);
          assert.equal(runner.scopeCheck.getCount(this.childScope), 1);
        };
        this.innerAssertion = function(){
          assert.equal(runner.scopeCheck.scopes.count(), 2);
          this.childScope = runner.currentEnv().mutableScope;
          assert.equal(runner.scopeCheck.getCount(this.childScope), 2);
        };
        this.childScope = undefined;
      };

      runner.setEnvBuilder(function(runner){
        return new Environment(undefined, [tmpScope], runner);
      });
      runner.loadUserCode(`
        ((lambda ()
          (define a 1)
          (defn foo () a)
          (innerAssertion)))
        (assertion)`);
      //runner.debug = true;

      runner.value();
    });
  });
  describe("garbage collection:", function(){
    function closureMaker(sc){
      return (function(){
        var scope = sc.new();
        var funcEnv = new Environment();
        funcEnv.runner.scopeCheck = sc;
        funcEnv.mutableScope = scope;
        return new bcexec.CompiledFunctionObject([], [], funcEnv, null);
      });
    }

    it('context finds scopes in envs', function(){
      var env = new Environment();
      var sc = env.runner.scopeCheck;
      var s = `(blah blah fake source code)`;
      var c = new bcexec.Context(bcexec.compileProgram(parse(s)), env);
      var originalScope = env.mutableScope;
      var notUsedScope = sc.new({});
      var newEnv = env.newWithScope({});
      c.envStack = c.envStack.pop().push(newEnv);
      assert.sameMembers(c.getScopes(), [newEnv.mutableScope]);
    });
    it('finds scopes in context in stack', function(){
      var env = new Environment();
      var sc = env.runner.scopeCheck;
      var s = `(blah blah fake source code)`;
      var c = new bcexec.Context(bcexec.compileProgram(parse(s)), env);

      var unusedScope = sc.new();

      var closure = closureMaker(sc);
      var funcOnStack = closure();
      c.valueStack = c.valueStack.push(funcOnStack);
      var funcInListInListOnStack = closure();
      var funcInListOnStack = closure();
      var list = Immutable.List([0, 1, 2, funcInListOnStack,
                                 Immutable.List([funcInListInListOnStack])]);
      c.valueStack = c.valueStack.push(list);

      assert.sameMembers(c.getScopes(), [env.mutableScope,
                                         funcOnStack.env.mutableScope,
                                         funcInListOnStack.env.mutableScope,
                                         funcInListInListOnStack.env.mutableScope]);
    });
    //TODO what about functions in the process of being constructed on the stack?
    //They're probably fine...
    it("a closure's contents make it in", function(){
      var env = new Environment();
      var sc = env.runner.scopeCheck;
      var closure = closureMaker(sc);

      var f1 = closure();
      var f2 = closure();
      var f3 = closure();

      // circular references
      f1.env.define('a', f2);
      f2.env.define('b', f3);
      f3.env.define('c', f1);

      var expected = [f1.env.mutableScope,
                      f2.env.mutableScope,
                      f3.env.mutableScope];

      assert.sameMembers(sc.getConnectedScopes([f1.env.mutableScope]), expected);
      assert.sameMembers(sc.getConnectedScopes([f2.env.mutableScope]), expected);
      assert.sameMembers(sc.getConnectedScopes([f3.env.mutableScope]), expected);

      var f4 = closure();

      assert.sameMembers(sc.getConnectedScopes([f4.env.mutableScope]), [f4.env.mutableScope]);
    });
    it("a closure's parent scopes make it in", function(){
      var env = new Environment();
      var sc = env.runner.scopeCheck;
      var closure = closureMaker(sc);

      var f1 = closure();
      var parentScope = f1.env.mutableScope;
      var childScope = sc.newFromScope(f1.env.mutableScope);
      f1.env.mutableScope = childScope;

      assert.sameMembers(sc.getConnectedScopes([childScope]), [childScope, parentScope]);
    });
    it('collects scopes that are only accessed by themselves', function(){ });
      var env = new Environment();
      var sc = env.runner.scopeCheck;
      var closure = closureMaker(sc);

      var f1 = closure();
      f1.env.define('foo', f1);
      var parentScope = f1.env.mutableScope;
      var childScope = sc.newFromScope(f1.env.mutableScope);
      f1.env.mutableScope = childScope;

      assert.sameMembers(sc._gc([env.mutableScope]), [childScope, parentScope]);
      assert.sameMembers([env.mutableScope], sc.scopes.keySeq().toArray());
  });
  describe("ingest", function(){
    it('adds scopes', function(){
      var sc1 = new ScopeCheck();
      var id1 = sc1.new();
      sc1.incref(id1);
      sc1.incref(id1);
      assert.equal(sc1.scopes.count(), 1);

      //TODO terrible idea, but quicker to implement than building the new id
      // mapping and recursively fixing them all.
      var sc2 = new ScopeCheck();
      var id2 = sc2.new();
      sc2.incref(id2);

      sc1.ingest(sc2);
      assert.equal(sc1.scopes.count(), 2);
    });
    it('ingesting self is a nop', function(){
      var sc1 = new ScopeCheck();
      var id1 = sc1.new();

      sc1.ingest(sc1);
    });
  });
  describe("copying", function(){
    it('creates isolated scopechecks', function(){
      var sc1 = new ScopeCheck();
      var id1 = sc1.new();
      sc1.define(id1, 'a', 1);
      assert.equal(sc1.lookup(id1, 'a'), 1);

      var sc2 = sc1.copy();
      sc1.set(id1, 'a', 2);
      assert.equal(sc1.lookup(id1, 'a'), 2);
      assert.equal(sc2.lookup(id1, 'a'), 1);
    });
  });
  describe("reflog", function(){
    it('logs creation and new scope', function(){
      var sc1 = new ScopeCheck(1, true);
      var id1 = sc1.new('testing');
      assert.deepEqual(sc1.log, [
        'created, nextId is 1',
        'new scope 1 created because testing',
      ]);
    });
    it('logs increfs and decrefs', function(){
      var sc1 = new ScopeCheck(1, true);
      var id1 = sc1.new('testing');
      sc1.incref(id1, 'test1');
      sc1.decref(id1, 'test2');
      sc1.decref(id1, 'test3');
      assert.deepEqual(sc1.log, [
        'created, nextId is 1',
        'new scope 1 created because testing',
        'increfing 1: from 1 to 2 because test1',
        'decrefing 1: from 2 to 1 because test2',
        'decrefing 1: from 1 to 0 because test3',
        'deleting 1',
      ]);
    });
  });
});

describe('memory leaks', function(){
  beforeEach( () => { ScopeCheck.prototype.alwaysRunGC = true; });
  afterEach( () => { delete ScopeCheck.prototype.alwaysRunGC; });
  it("are prevented in simple recursive functions", function(){
    var s =
`(define foo (lambda (x)
  (if (= x 0)
      "done"
      (foo (- x 1)))))
(foo 10)`;

    var env = Environment.fromMultipleMutables([{
      '+': function(a, b){ return a + b; },
      '-': function(a, b){ return a - b; },
      '=': function(a, b){ return a === b; }
    }]);
    var sc = env.runner.scopeCheck;

    bcexec(s, env, false);
    assert.equal(sc.scopes.count(), 0);
  });
});
