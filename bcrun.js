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
    this.statefuls = [];
    this.funs = funs;
    this.counter = 0;
    this.savesByFunInvoke = {};
    this.rewindStates = [];
    this.currentRewindIndex = null;
  }
  /** Add object to be saved and restored with state during saves and restores */
  BCRunner.prototype.registerStateful = function(obj){
    if (typeof obj.saveState === 'undefined'){ throw Error('Stateful object need a saveState method'); }
    if (typeof obj.restoreState === 'undefined'){ throw Error('Stateful object need a restoreState method'); }
    if (Object.keys(this.savesByFunInvoke).length > 0){ throw Error("Stateful objects can't be added once states have been saved"); }
    this.statefuls.push(obj);
  };
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
    this.ast = parse(s);
    this.oldFunctionASTs = parse.findFunctions(this.ast);
    var bytecode = bcexec.compileProgram(this.ast);
    this.context = new bcexec.Context(bytecode, this.envBuilder());
  };
  //TODO shim for testing
  BCRunner.prototype.currentEnv = function(){
    return this.context.envStack.peek();
  };
  //TODO shim for testing, get rid of this
  BCRunner.prototype.loadCode = function(s, env){
    this.ast = parse(s);
    // don't know why we skip finding old functions here
    var bytecode = bcexec.compileProgram(this.ast);
    this.context = new bcexec.Context(bytecode, env);
  };
  BCRunner.prototype.copy = function(){
    //TODO Why do w have to make a copy of funs? Isn't is global
    //to all snapshots? I guess the envs associated with each function
    //need to be preserved but not the bodies?
    //We're going to swap out the bytecode anyway, so no need to save that.
    //It's really just the environments of each function that are important
    //to save.
    var copy = deepCopy([this.context, this.funs]);
    return {counter: this.counter,
            funs: copy[1],
            context: copy[0],
            statefuls: this.statefuls.map( x => x.saveState() )};

  };
  BCRunner.prototype.restart = function(){
    var bytecode = bcexec.compileProgram(this.ast);
    this.context = new bcexec.Context(bytecode, this.envBuilder());
    console.log('Restart!');
  };
  BCRunner.prototype.update = function(s){
    var newAst = parse(s);
    var functionASTs = parse.findFunctions(newAst);
    if (this.ast !== undefined &&
        JSON.stringify(parse.justContent(newAst)) ===
        JSON.stringify(parse.justContent(this.ast)) && !this.context.finished){
      return;
    }

    // the AST changed. We might stay where we are, we might restore.
    // We're definitely going to swap the code for at least one function.
    this.ast = newAst;

    var diff = parse.diffFunctions(this.oldFunctionASTs, functionASTs);
    this.oldFunctionASTs = functionASTs;
    if (Object.keys(diff).length === 0){
      // Since no named functions have changed, this must have been a
      // top-level (global scope) AST change. Do a total reset!
      this.ast = parse(s);
      var bytecode = bcexec.compileProgram(this.ast);
      this.context = new bcexec.Context(bytecode, this.envBuilder());
      this.funs = {};
      console.log('Total reset!');
      return;
    } else {
      console.log('functions changed: ', Object.keys(diff));
    }
    var earliestTime = -1;
    var earliestGen;
    for (var funcName in diff){
      console.log('change detected in function '+funcName);
      console.log('last run at tick '+this.getState(funcName).counter);
      if (this.getState(funcName).counter >= earliestTime){
        earliestGen = funcName;
        earliestTime = this.getState(funcName).counter;
      }
    }
    if (earliestGen === undefined){
      // The only funtions that were changed were functions that had
      // never been run so those changes will take effect on their own!
      return;
    }

    console.log('restoring from last invocation of function', earliestGen);
    // making a copy because we're about to munge it with new defn bodies
    this.restoreState(deepCopy(this.savesByFunInvoke[earliestGen]));

    // For each defn form in the current code
    for (funcName in functionASTs){
      // if there's a saved compiled function for it
      if (funcName in this.funs){
        // then update it with the new code!
        if (funcName in diff){
          console.log('updating code for', funcName);
          this.funs[funcName].code = bcexec.compileFunctionBody(functionASTs[funcName].body);
          this.funs[funcName].params = parse.justContent(functionASTs[funcName].params);
        } else {
          //console.log('updating linenumbers for', funcName);
          this.funs[funcName].code = bcexec.compileFunctionBody(functionASTs[funcName].body);
        }
      }
    }
  };

  /** Run code with no defns allowed */
  BCRunner.prototype.runLibraryCode = function(s, env){
    if (this.funs !== null){
      throw Error("Library code can only be run with a runner not allowing defns");
    }
    if (env === undefined){
      env = new Environment();
    }
    //TODO use an interface for this instead
    env.runner = this;

    this.ast = parse(s);
    var bytecode = bcexec.compileProgram(this.ast);
    this.context = new bcexec.Context(bytecode, env);
    return this.value();
  };
  /** Returns whether it is still running */
  BCRunner.prototype.runABit = function(numIterations, errback){
    if (!this.context){ return false; }
    if (this.context.done){ return !this.context.done; }
    numIterations = numIterations || 1;
    var start = this.counter;
    try{
      while(this.counter < start + numIterations && !this.runOneStep()){}
    }catch(e){
      return errback(e);
    }
    if (this.context.done){
      console.log('finished!', this.value());
    }
    return !this.context.done;
  };
  BCRunner.prototype.saveState = function(name){
    this.savesByFunInvoke[name] = this.copy();
  };
  BCRunner.prototype.restoreState = function(state){
    // copied in one deepCopy call because their
    // object webs are intertwined; functions share environments
    // also on the context.envStack.
    this.counter = state.counter;
    this.context = state.context;  // deepcopied because this mutates
    this.funs = state.funs;  // copied so we can update these
    this.statefuls.forEach( (s, i) => {
      s.restore(state.statefuls[i]);
    });
  };
  BCRunner.prototype.getState = function(name){
    if (name in this.savesByFunInvoke){
      return this.savesByFunInvoke[name];
    }
    // TODO add comment explaining this - it's for something
    // like a fallback for when we didn't have that function
    // saved? When can that occur?
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
    this.rewindStates.push(this.copy());
    bcexec.execBytecodeOneStep(this.context);
    if (this.debug && this.context.counterStack.count() &&
        this.context.bytecodeStack.count()){
      bcexec.dis(this.context,
                 typeof this.debug === 'string' ? this.debug : undefined);
    }
    this.counter += 1;
    return this.context.done;
  };
  /** Step back one step or do nothing if no more to go back*/
  BCRunner.prototype.stepBackOneStep = function(){
    if (this.currentRewindIndex === null){
      this.currentRewindIndex = this.rewindStates.length - 1;
    } else {
      this.currentRewindIndex = Math.max(0, this.currentRewindIndex - 1);
    }
    this.restoreState(this.rewindStates[this.currentRewindState]);

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
