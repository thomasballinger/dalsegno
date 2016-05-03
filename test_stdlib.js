'use strict';
var chai = require('chai');
var assert = chai.assert;

var Environment = require('./Environment.js');
var stdlibcode = require('./stdlibcode.js');
var builtins = require('./builtins');
var bcrun = require('./bcrun');


var run = bcrun;
var stdlibcode = stdlibcode;

var stdlib = Environment(builtins);

describe('stdlib', function(){
  var env = Environment.fromMultipeMutables([builtins, stdlib]);

  describe('integration', function(){
    describe('reduce', function(){
      it('should sum numbers', function(){
        assert.deepEqual(run('(reduce (lambda (a b) (+ a b)) (list 1 2 3) 0)', env), 6);
      });
    });
    describe('filter', function(){
      it('should passthrough', function(){
        assert.deepEqual(run('(filter (lambda (a) 1) (list 1 2 3))', env).toJS(), [1, 2, 3]);
      });
    });
    describe('find', function(){
      it('should return the first for an always predicate', function(){
        assert.deepEqual(run('(find (lambda (a) 1) (list 1 2 3))', env), 1);
      });
      it('should return null for a never predicate', function(){
        assert.deepEqual(run('(find (lambda (a) 0) (list 1 2 3))', env), null);
      });
    });
  });

  describe('builtins', function(){
    describe('get', function(){
      it('should index', function(){
        assert.deepEqual(run('(get 0 (list 1 2 3))', env), 1);
      });
    });
  });
});
