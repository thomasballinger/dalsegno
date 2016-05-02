'use strict';
var chai = require('chai');
var assert = chai.assert;

var Environment = require('./Environment.js');
var ScopeCheck = require('./ScopeCheck.js');


describe('Environments', function(){
  it('can be instantiated without args', function(){
    var env = new Environment();
    env.define('a', 1);
    assert.deepEqual(env.lookup('a'), 1);
  });
  it("can be instantiated with objects", function(){
    var obj = {'+': function(a, b){return a + b; }};
    var justSum = Environment.fromObjects([obj]);
    assert.equal(justSum.lookup('+')(2, 3), 2 + 3);
  });
  it("can create a new nested env", function(){
    var env = new Environment();
    env.define('a', 1);
    var innerEnv = env.newWithScope({'b': 2});
    assert.equal(innerEnv.lookup('b'), 2);
    assert.equal(innerEnv.lookup('a'), 1);
  });
});
