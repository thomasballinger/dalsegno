'use strict';
var fs = require('fs');

var chai = require('chai');
var assert = chai.assert;

var tokenize = require('./parse.js').tokenize;
var parse = require('./parse.js').parse;
var bcrun = require('./bcrun');
var Environment = require('./Environment');
var builtins = require('./builtins.js');
var bcstdlib = require('./bcstdlib.js');

var tests = function(run, Runner, stdlib){
  var buildEnv = function(){
    return new Environment.fromObjects([builtins, stdlib, {}]);
  };

  return function(){
    describe('integration', function(){
      it('store', function(){
        run.runWithDefn("(defn foo () 1)");
      });
      it('store, lookup and retrieve', function(){
        run.runWithDefn("(do (defn foo () 1) (foo))");
      });
      it('and retrieve', function(){
        run.runWithDefn("(do (defn foo () 1) (foo))", buildEnv);
      });
      it('global functions', function(){
        run.runWithDefn("\n"+
            "(do                                   \n"+
            "  (defn foo (x) (do x x))               \n"+
            "  (defn main () (do                      \n"+
            "    (foo 1)                           \n"+
            "    (map foo (list 1 2 3))))          \n"+
            "  (main))",
        buildEnv);
      });
      it('browser bug?', function(){
        run.runWithDefn(
          "(do"+
          "(defn game () (do "+
            '"game" "started"))'+
          "(game))", buildEnv);
      });
    });

    describe('interactive features', function(){
      it('updates functions', function(){
        var env = new Environment.fromObjects([builtins, stdlib, {}]);
        var runner = new Runner({});
      });
      it('deepcopies closed-over state', function(){
        var program = fs.readFileSync('savedscopebug.scm', {encoding: 'utf8'});
        var runner = new Runner({});
        var env = buildEnv();
        var returnEnv = function(){ return env; };
        runner.setEnvBuilder(returnEnv);
        env.define('c', 0);
        runner.loadUserCode(program);
        runner.runABit(100);

        env.set('c', 1);
        runner.runABit(100);
        var save = runner.savesByFunInvoke['on-c'];

        runner.runABit(100);

        var beforeRestore = runner.currentEnv().scopes[3].data.get('x');

        if (runner === bcrun.BCRunner){
          runner.context = save.context;
        } else {
          runner.delegate = save.delegate;
        }
        runner.funs = save.funs;

        runner.delegate = save.delegate;
        runner.funs = save.funs;
        runner.runABit(100);

        assert.isTrue(runner.currentEnv().scopes[3].data.get('x') < beforeRestore);
      });
    });
  };
};

describe('main with bytcode', tests(bcrun, bcrun.BCRunner, bcstdlib));
