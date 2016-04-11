'use strict';
var chai = require('chai');
var assert = chai.assert;
var fs = require('fs');

var parse = require('./parse.js');
var compile = require('./compile.js');
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

describe('compile', ()=>{
  it('correctly identifies tail position', ()=>{
    var program = fs.readFileSync('savedscopebug.scm', {encoding: 'utf8'});
    var begin = compile.build(parse(program)[0]);
    assert.equal(begin.expressions[0].itp, false);
    assert.equal(begin.expressions[1].itp, true);
    assert.equal(begin.expressions[0].expressions[0].itp, true);
    assert.equal(begin.expressions[0].expressions[0].expressions[0].itp, false);
    assert.equal(begin.expressions[0].expressions[0].expressions[4].itp, false);
    assert.equal(begin.expressions[0].expressions[0].expressions[5].itp, true);
    assert.equal(begin.expressions[0].expressions[0].expressions[4].expressions[0].itp, true);
    //assert.equal(begin.expressions[0].body.expressions[4].body.expressions[0].itp, false);
    assert.equal(begin.expressions[0].expressions[0].expressions[4].expressions[0].expressions[0].itp, false);
    assert.equal(begin.expressions[0].expressions[0].expressions[4].expressions[0].expressions[1].itp, false);
    assert.equal(begin.expressions[0].expressions[0].expressions[4].expressions[0].expressions[1].ifBody.itp, false);
    var ifBody = begin.expressions[0].expressions[0].expressions[4].expressions[0].expressions[1].ifBody;
    assert.equal(ifBody.expressions[0].itp, false);
    assert.equal(ifBody.expressions[1].itp, false);
  });
});

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
      checkCompileAgainstEval('(do (define f (lambda (x) (+ x 1))) (f 2))');
      checkCompileAgainstEval('(do (define f (lambda (x) (+ x 1) 2)) (f 2))');
    });
    it('give the same results for syntax changes', ()=>{
      checkCompileAgainstEval('(define a 1)\n(set! a 2)\na');
    });
    it('should do closures', ()=>{
      checkCompileAgainstEval(
  `(define one
    ((lambda ()
      (define a 1)
      (lambda () a))))
  (one)`, undefined);
    });
    describe("map using builtins", function(){
      var buildEnv = function(){
        return new Environment.fromObjects([builtins, {}]);
      };
      var s = "(do\n"+
      "  (define map\n"+
      "    ((lambda ()\n"+
      "      (do\n"+
      "        (define map-acc (lambda (func arr acc)\n"+
      "          (if (= (length arr) 0)\n"+
      "            acc\n"+
      "            (map-acc\n"+
      "              func\n"+
      "              (rest arr)\n"+
      "              (append acc (func (first arr)))))))\n"+
      "        (lambda (func arr)\n"+
      "          (map-acc func arr (list)))))))\n"+
      "\n"+
      "  (define foo (lambda (x) (+ x 1)))     \n"+
      "  (define main (lambda () (do            \n"+
      "    (map foo (list 1 2 3 4)))))       \n"+
      "  (main))";
      it('should work', () => {
        checkCompileAgainstEval(s, buildEnv);
      });
      it('should be tail call optimized', function(){
        var bytecode = bcexec.compileProgram(parse(s));
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
