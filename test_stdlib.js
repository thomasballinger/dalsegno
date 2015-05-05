'use strict';
var chai = require('chai');
var assert = chai.assert;

var run = require('./run')
var Environment = run.Environment;
var stdlib = require('./stdlib');
var builtins = require('./builtins');

var env = new Environment([builtins, stdlib], {});

describe('builtins', function(){
  describe('reduce', function(){
    it('should sum numbers', function(){
      assert.deepEqual(run('(reduce (lambda a b (+ a b)) (list 1 2 3))', env), 6);
    });
  });
});
