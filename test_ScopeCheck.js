'use strict';
var chai = require('chai');
var assert = chai.assert;


var ScopeCheck = require('./ScopeCheck.js').ScopeCheck;

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
});
