'use strict';
var chai = require('chai');
var assert = chai.assert;

var run = require('./run');
var Environment = run.Environment;
var stdlib = require('./stdlib');
var builtins = require('./builtins');

var env = new Environment([new run.Scope(builtins), new run.Scope(stdlib)]);

describe('stdlib', function(){
  describe('reduce', function(){
    it('should sum numbers', function(){
      assert.deepEqual(run('(reduce (lambda a b (+ a b)) (list 1 2 3) 0)', env), 6);
    });
  });
  describe('filter', function(){
    it('should passthrough', function(){
      assert.deepEqual(run('(filter (lambda a 1) (list 1 2 3))', env).toJS(), [1, 2, 3]);
    });
  });
});

describe('builtins', function(){
  describe('nth', function(){
    it('should index', function(){
      assert.deepEqual(run('(nth 0 (list 1 2 3))', env), 1);
    });
  });
});
