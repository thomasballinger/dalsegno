;(function() {
  'use strict';

  var require;
  if (typeof window === 'undefined') {
    require = module.require;
  } else {
    require = function(name){
      var realname = name.match(/(\w+)[.]?j?s?$/)[1];
      return window[realname];
    };
  }
  var parse = require('./parse.js');
  var deepCopy = require('./deepCopy.js');
  var Immutable = require('./Immutable.js');
  var Environment = require('./Environment.js');
  var NamedFunctionPlaceholder = Environment.NamedFunctionPlaceholder;
  var bcexec = require('./bcexec.js');

  function BCRunner(funs){
    if (funs === undefined){
      throw Error("Pass in an empty object for functions dictionary, or null for no defns");
    }

    this.funs = funs;
    this.counter = 0;
    this.savedStates = {};
  }
  //TODO instead of using an envBuilder, pass in an env the runner
  //can make a copy of to be the original
  BCRunner.prototype.setEnvBuilder = function(callback){
    if (callback === undefined){
      callback = function(){ return new Environment(); };
    }
    var self = this;
    this.envBuilder = ()=>{
      var env = callback();
      env.runner = self;
      return env;
    };
  };
  BCRunner.prototype.loadUserCode = function(s){ throw Error("not implemented yet"); };
  BCRunner.prototype.loadCode = function(s, env){ throw Error("not implemented yet"); };
  BCRunner.prototype.copy = function(){ throw Error("not implemented yet"); };
  BCRunner.prototype.update = function(s){ throw Error("not implemented yet"); };

  /** Code will be run in a context where defns are not allowed */
  BCRunner.prototype.runLibraryCode = function(s, env){
    if (this.funs !== null){
      throw Error("Library code can only be run with a runner not allowing defns");
    }
    if (env === undefined){
      env = new Environment();
    }
    //TODO use an interface for this instead
    env.runner = this;

    var ast = parse(s);
    var bytecode = bcexec.compile(ast);
    this.context = bcexec.buildContext(bytecode, env);
    return this.value();
  };
  /** Returns whether it is still running */
  BCRunner.prototype.runABit = function(numIterations, errback){ throw Error("not implemented yet"); };
  BCRunner.prototype.saveState = function(name){ throw Error("not implemented yet"); };
  BCRunner.prototype.restoreState = function(name){ throw Error("not implemented yet"); };
  BCRunner.prototype.getState = function(name){ throw Error("not implemented yet"); };
  BCRunner.prototype.functionExists = function(name){ throw Error("not implemented yet"); };
  BCRunner.prototype.getFunction = function(name){ throw Error("not implemented yet"); };
  BCRunner.prototype.value = function(){
    while(!this.runOneStep()){}
    var valueStack = this.context[3];
    if (valueStack.count() !== 1){
        throw Error('final stack is of wrong length '+valueStack.count()+': '+valueStack);
    }
    return valueStack.peek();
  };
  /** returns true if finished */
  BCRunner.prototype.runOneStep = function(){
    var r = bcexec.execBytecodeOneStep.apply(null, this.context);
    this.context = r.slice(0, 4);
    return r[4];
  };

  function run(s, env){
    var runner = new BCRunner(null);
    return runner.runLibraryCode(s, env);
  }

  function runWithDefn(s, envBuilder){
    var runner = new BCRunner({});
    runner.setEnvBuilder(envBuilder);
    runner.loadUserCode(s);
    return runner.value();
  }

  run.run = run;
  run.BCRunner = BCRunner;
  run.runWithDefn = runWithDefn;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = run;
    }
  } else {
    window.run = run;
  }
})();
