'use strict';
var chai = require('chai');
var assert = chai.assert;


var ScopeCheck = require('./ScopeCheck.js').ScopeCheck;
var bcexec = require('./bcexec.js');
var Environment = require('./Environment.js');

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
    it('collects scopes decreffed to 0', function(){
      var sc = new ScopeCheck();
      var scopeTicket1 = sc.new();
      sc.decref(scopeTicket1);
      assert.throws(function(){
        sc.lookup(scopeTicket1, 'a');
      }, /bad.*scope.*id/i);
    });
    it('decreffing child to 0 decrefs parent', function(){
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
    it('lambda increfs', function(){
      var env = new Environment();
      var sc = env.runner.scopeCheck;
      assert.equal(sc.scopes.count(), 1);
      assert.equal(sc.getCount(env.mutableScope), 1);
      bcexec('(lambda () 1)', env);
      assert.equal(sc.scopes.count(), 1);
      assert.equal(sc.getCount(env.mutableScope), 2);
    });
    it('popped lambda decrefs', function(){
      var env = new Environment();
      var sc = env.runner.scopeCheck;
      assert.equal(sc.scopes.count(), 1);
      assert.equal(sc.scopes.get(env.mutableScope).get('refcount'), 1);
      bcexec('(lambda () 1)\n1', env);
      assert.equal(sc.scopes.count(), 1);
      assert.equal(sc.getCount(env.mutableScope), 1);
    });
    it.only('leaving scope decrefs that scope', function(){
      var env = new Environment();
      var sc = env.runner.scopeCheck;
      assert.equal(sc.scopes.count(), 1);
      assert.equal(sc.getCount(env.mutableScope), 1);
      bcexec(`(define foo (lambda () 1))
              (foo)`, env);
      console.log(''+sc);
      assert.equal(sc.scopes.count(), 1);
      assert.equal(sc.getCount(env.mutableScope), 2);
    });
    /*
    it('leaving scope cleans up closures in that scope', function(){
      var env = new Environment();
      var sc = env.runner.scopeCheck;
      assert.equal(sc.scopes.count(), 1);
      assert.equal(sc.scopes.get(env.mutableScope).get('refcount'), 1);
      bcexec(`(define foo (lambda ()
                 (define bar (lambda () 1))
                 1))
              (foo)`, env);
      assert.equal(sc.scopes.count(), 2);
      assert.equal(sc.getCount(env.mutableScope), 2);
    });
    */
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
});

function defaultMakeEnv(){
  return Environment.fromMultipleMutable(
    [{'+': function(a, b){ return a + b; }}]);
}
describe('memory leaks', function(){
  //TODO once everything is working, start decreffing in appropriate places
  /*
  it("are prevented by bytecode remembering to decref", function(){
    var s =
`(define foo (lambda (x)
  (if (= x 0)
      "done"
      (foo (- x 1)))))
(foo 10)`;

    var sc = new ScopeCheck();
    var env = new Environment.fromMultipleMutable([{
      '+': function(a, b){ return a + b; },
      '-': function(a, b){ return a - b; },
      '=': function(a, b){ return a === b; }
    }], null, sc);

    bcexec(s, env, s);
    assert.equal(sc.scopes.count(), 2);
  });
  */
});
