'use strict';
var chai = require('chai');
var assert = chai.assert;

var Environment = require('./Environment.js');
var bcstdlib = require('./bcstdlib.js');
var builtins = require('./builtins');
var bcrun = require('./bcrun');


describe('stdlib', function(){
  var tests = function(run, stdlib){
    return function(){
      var env = new Environment([new Environment.Scope(builtins), new Environment.Scope(stdlib)]);

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
      });

      describe('builtins', function(){
        describe('get', function(){
          it('should index', function(){
            assert.deepEqual(run('(get 0 (list 1 2 3))', env), 1);
          });
        });
      });
    };
  };
  describe('with bytcode', tests(bcrun, bcstdlib));
});
