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
        sc.lookup(scopeTicket, 'a');
      }, /.*/);
    });
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
      console.log(sc2);
      var id2 = sc2.new();
      sc2.incref(id2);

      sc1.ingest(sc2);
      assert.equal(sc1.scopes.count(), 2);
    });
  });
});

function defaultMakeEnv(){
  return new Environment.fromObjects(
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
    var env = new Environment.fromObjects([{
      '+': function(a, b){ return a + b; },
      '-': function(a, b){ return a - b; },
      '=': function(a, b){ return a === b; }
    }], null, sc);

    bcexec(s, env, s);
    assert.equal(sc.scopes.count(), 2);
  });
  */
});
