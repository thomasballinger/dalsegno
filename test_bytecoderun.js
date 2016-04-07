'use strict';
var chai = require('chai');
var assert = chai.assert;

var parse = require('./parse.js');
var bcexec = require('./bcexec');
var evaluate = bcexec.evaluate;
var Environment = require('./Environment.js');
var builtins = require('./builtins.js');


function defaultMakeEnv(){
  return new Environment.fromObjects(
    [{'+': function(a, b){ return a + b; }}]);
}

function checkCompileAgainstEval(s, makeEnv, debug){
  if (makeEnv === undefined){
    makeEnv = defaultMakeEnv;
  }
  var evalResult = evaluate(s, makeEnv());
  var compileResult = bcexec(s, makeEnv(), debug ? s : undefined);
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
    it('should do closures', ()=>{
      checkCompileAgainstEval(`(do
  (define one
    ((lambda (do
      (define a 1)
      (lambda a)))))
  (one)
      )`, undefined);
    });
    describe("map using builtins", function(){
      var buildEnv = function(){
        return new Environment.fromObjects([builtins, {}]);
      };
      var s = "(do\n"+
      "  (define map\n"+
      "    ((lambda\n"+
      "      (do\n"+
      "        (define map-acc (lambda func arr acc\n"+
      "          (if (= (length arr) 0)\n"+
      "            acc\n"+
      "            (map-acc\n"+
      "              func\n"+
      "              (rest arr)\n"+
      "              (append acc (func (first arr)))))))\n"+
      "        (lambda func arr\n"+
      "          (map-acc func arr (list)))))))\n"+
      "\n"+
      "  (define foo (lambda x (+ x 1)))     \n"+
      "  (define main (lambda (do            \n"+
      "    (map foo (list 1 2 3 4)))))       \n"+
      "  (main))";
      it('should work', () => {
        checkCompileAgainstEval(s, buildEnv);
      });
      it('should be tail call optimized', function(){
        var bytecode = bcexec.compile(parse(s));
        var context = new bcexec.Context(bytecode, buildEnv());
        do {
          assert(context.counterStack.count() < 5, 'stack size does not exceed 5 frames');
          if (false && context.counterStack.count() &&
              context.bytecodeStack.count()){
            bcexec.dis(context, s);
          }
          bcexec.execBytecodeOneStep(context);
        } while (!context.done);
        assert.equal(context.valueStack.count(), 1);
        assert.deepEqual(context.valueStack.peek().toJS(), [2, 3, 4, 5]);
      });
    });
  });
});
