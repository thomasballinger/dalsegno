'use strict';
var chai = require('chai');
var assert = chai.assert;

var bytecoderun = require('./bytecoderun');
var evaluate = bytecoderun.evaluate;
var Environment = bytecoderun.Environment;

function checkCompileAgainstEval(s, makeEnv){
  if (makeEnv === undefined){
    makeEnv = function() {
      return new Environment.fromObjects(
        [{'+': function(a, b){ return a + b; }}]);
    };
  }
  var evalResult = evaluate(s, makeEnv());
  var compileResult = bytecoderun(s, makeEnv());
  assert.deepEqual(evalResult, compileResult);
}

describe('compiler and evaluator', ()=>{
  describe('without runner', ()=>{
    it('give the same results', ()=>{
      checkCompileAgainstEval('1');
      checkCompileAgainstEval('(do (define a 1) a)');
      checkCompileAgainstEval('(+ 2 1)');
      checkCompileAgainstEval('(do (define a 2) (+ a 1))');
      checkCompileAgainstEval('(do\n (define a 2)\n (+ a 1))');
      checkCompileAgainstEval(`
        (do
          (define a 1)
          (if a
            (define r 3)
            (define r 4))
          r)`);
      checkCompileAgainstEval('(do (define a 1) (set! a 2) a)');
      checkCompileAgainstEval('(do (define f (lambda x (+ x 1))) (f 2))');
    });
  });
});
