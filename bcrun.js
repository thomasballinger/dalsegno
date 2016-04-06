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
  BCRunner.prototype.loadUserCode = function(s){
    if (this.funs === null){
      console.log('warning: maybe you wanted to set up a function dictionary on the runner before running user code?');
    }
    var ast = parse(s);
    this.oldFunctions = parse.findFunctions(ast);
    var bytecode = bcexec.compile(ast);
    this.context = new bcexec.Context(bytecode, this.envBuilder());
  };
  //TODO shim for testing
  BCRunner.prototype.currentEnv = function(){
    return this.context.envStack.peek();
  };
  //TODO shim for testing, get rid of this
  BCRunner.prototype.loadCode = function(s, env){
    var ast = parse(s);
    // don't know why we skip finding old functions here
    var bytecode = bcexec.compile(ast);
    this.context = new bcexec.Context(bytecode, env);
  };
  BCRunner.prototype.copy = function(){
    var copy = deepCopy([this.context, this.funs]);
    return {counter: this.counter,
            funs: copy[1],
            context: copy[0]};

  };
  BCRunner.prototype.update = function(s){ throw Error("not implemented yet"); };

  /** Code will be run with no defns allowed */
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
    this.context = new bcexec.Context(bytecode, env);
    return this.value();
  };
  /** Returns whether it is still running */
  BCRunner.prototype.runABit = function(numIterations, errback){
    numIterations = numIterations || 1;
    var start = this.counter;
    while(this.counter < start + numIterations && !this.runOneStep()){}
    if (this.context.done){
      console.log('finished!', this.value());
    }
    return !this.context.done;
  };
  BCRunner.prototype.saveState = function(name){
    this.savedStates[name] = this.copy();
  };
  BCRunner.prototype.restoreState = function(name){
    var state = deepCopy(this.savedStates[name]);
    this.counter = state.counter;
    this.context = state.context;
    this.funs = state.funs;
  };
  BCRunner.prototype.getState = function(name){
    if (name in this.savedState){
      return this.savedStates[name];
    } else {
      throw Error("What is this for?");
    }
    return [-2, null];
  };
  BCRunner.prototype.functionExists = function(name){
    return ((this.funs !== null) && this.funs.hasOwnProperty(name));
  };
  BCRunner.prototype.getFunction = function(name){
    if (this.funs === null){
      throw Error("Runner doesn't allow named functions");
    }
    return this.funs[name];
  };
  BCRunner.prototype.value = function(){
    if (!this.context.done){
      while(!this.runOneStep()){}
    }
    var values = this.context.valueStack;
    if (values.count() !== 1){
        throw Error('final stack is of wrong length '+ values.count()+': '+values);
    }
    return values.peek();
  };
  /** returns true if finished */
  BCRunner.prototype.runOneStep = function(){
    bcexec.execBytecodeOneStep(this.context);
    if (this.debug && this.context.counterStack.count() &&
        this.context.bytecodeStack.count()){
      bcexec.dis(this.context,
                 typeof this.debug === 'string' ? this.debug : undefined);
    }
    this.counter += 1;
    return this.context.done;
  };
  //TODO temp ship for compatibility with evalGen in tests
  BCRunner.prototype.next = BCRunner.prototype.runOneStep;

  function bcrun(s, env){
    var runner = new BCRunner(null);
    return runner.runLibraryCode(s, env);
  }

  function runWithDefn(s, envBuilder, debug){
    var runner = new BCRunner({});
    if (debug){
      runner.debug = s;
    }
    runner.setEnvBuilder(envBuilder);
    runner.loadUserCode(s);
    return runner.value();
  }

  bcrun.bcrun = bcrun;
  bcrun.BCRunner = BCRunner;
  bcrun.runWithDefn = runWithDefn;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = bcrun;
    }
  } else {
    window.bcrun = bcrun;
  }
})();
