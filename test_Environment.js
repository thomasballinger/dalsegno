'use strict';
var chai = require('chai');
var assert = chai.assert;

var Environment = require('./Environment.js');
var ScopeCheck = require('./ScopeCheck.js');

function FakeRunner(funs, scopeCheck){
  // To trick Environment into being ok with this bad runner value
  this.constructor = {name: 'BCRunner'};
  this.funs = funs;
  this.scopeCheck = scopeCheck;
}

describe('Environments', function(){
  describe('instantiated', function(){
    it('with no arguments can define variables but not use defns', function(){
      var env = new Environment();
      env.define('a', 1);
      assert.deepEqual(env.lookup('a'), 1);
      assert.throws( () => env.setFunction('a', "Fake Function") );
    });
    it("can't construct undefined mutable with runner of null", function(){
      assert.throws( () => new Environment(undefined, undefined, null) );
    });
    it("with runner of null can't define variables or use defns", function(){
      var env = new Environment(null, undefined, null);
      assert.throws( () => env.define('a', 1) );
      assert.throws( () => env.lookup('a') );
      assert.throws( () => env.setFunction('a', "Fake Function") );
    });
    it("with a runner with no funs can't use funs", function(){
      var env2 = new Environment(undefined, undefined, new FakeRunner(null, new ScopeCheck()));
      assert.throws( () => env2.setFunction('a', "Fake function") );
    });
    it("with a runner with no scopeCheck can't define variables", function(){
      var env1 = new Environment(null, undefined, new FakeRunner(null, null));
      assert.throws( () => env1.define('a', 1) );

      var env2 = new Environment(null, undefined, new FakeRunner({}, null));
      assert.throws( () => env2.define('a', 1) );
    });
    it("with an object creates a mutable scope", function(){
      var obj = {'+': function(a, b){return a + b; }};
      var justSum = new Environment(obj);
      assert.equal(justSum.lookup('+')(2, 3), 2 + 3);
      justSum.define('a', 1);
      assert.deepEqual(justSum.lookup('a'), 1);
    });
    it("with .newWithScope have access to variables in both scopes", function(){
      var env = new Environment();
      env.define('a', 1);
      var innerEnv = env.newWithScope({'b': 2});
      assert.equal(innerEnv.lookup('b'), 2);
      assert.equal(innerEnv.lookup('a'), 1);

      innerEnv.define('c', 3);
      assert.equal(innerEnv.lookup('c'), 3);
    });
    describe("fromMultipleMutables", function(){
      it('creates scopes from mappings', function(){
        var env = new Environment.fromMultipleMutables([{a: 1, b: 2}, {b: 3}]);
        assert.equal(env.lookup('a'), 1);
        assert.equal(env.lookup('b'), 3);
      });
    });
  });
  it('can set variables', function(){
    var env = new Environment();
    env.define('a', 1);
    env.set('a', 2);
    assert.equal(env.lookup('a'), 2);
  });
  it('can build a mapping from its mutable scope', function(){
    var env1 = new Environment();
    env1.define('a', 1);
    env1.define('b', 2);

    var env2 = new Environment();
    env2.define('a', 10);
    env2.define('c', 20);

    var env3 = env2.newWithScopeFromEnv(env1);
    assert.equal(env3.lookup('a'), 1);
    assert.equal(env3.lookup('b'), 2);
    assert.equal(env3.lookup('c'), 20);
  });
});
