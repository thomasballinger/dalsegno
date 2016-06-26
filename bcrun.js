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
  var ScopeCheck = require('./ScopeCheck.js');
  var framesample = require('./framesample');

  function BCRunner(funs, scopeCheck, debug){
    if (funs === undefined){
      throw Error("Pass in an empty object for functions dictionary, or null for no defns");
    }
    if (debug){
      this.debug = debug;
    }
    if (scopeCheck === undefined){
      scopeCheck = new ScopeCheck(undefined, this.debug ? true : false);
    } else if (scopeCheck === null){
      // no mutable variables allowed!
    } else if (scopeCheck.constructor !== ScopeCheck){
      throw Error("bad scopeCheck value, use null for no mutable variables");
    }
    this.statefuls = [];
    this.funs = funs;  // map of defn name to state at most recent call
    this.scopeCheck = scopeCheck;
    this.counter = 0;
    this.savesByFunInvoke = {};
    this.rewindStates = [];  // states needed for rewinds
    this.keyframeStates = {};
    this.currentRewindIndex = null;
    this.renderRequested = false;
  }
  /** Add object to be saved and restored with state during saves and restores */
  BCRunner.prototype.registerStateful = function(obj){
    if (typeof obj.saveState === 'undefined'){ throw Error('Stateful object need a saveState method'); }
    if (typeof obj.restoreState === 'undefined'){ throw Error('Stateful object need a restoreState method'); }
    if (Object.keys(this.savesByFunInvoke).length > 0){ throw Error("Stateful objects can't be added once states have been saved"); }
    this.statefuls.push(obj);
  };
  /** Requesting a render causes a setTimeout(0) and a keyframe to be saved */
  BCRunner.prototype.registerRenderRequester = function(obj){
    if (typeof obj.setRenderRequester === 'undefined'){ throw Error('RenderRequester object need a setRenderRequester method'); }
    obj.setRenderRequester( ()=>{
      this.renderRequested = true;
    });
  };
  //TODO instead of using an envBuilder, pass in an env the runner
  //can make a copy of to be the original
  BCRunner.prototype.setEnvBuilder = function(callback){
    if (callback === undefined){
      callback = function(runner){ return new Environment(undefined, undefined, runner); };
    }
    this.envBuilder = () => {
      this.scopeCheck = new ScopeCheck(undefined, this.debug ? true : false);
      var env = callback(this);
      return env;
    };
  };
  /** Load user code, building a new the initial environment with a new scopeCheck */
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
    this.scopeCheck.ingest(env.runner.scopeCheck);
    env.runner = this;
    this.ast = parse(s);
    // don't know why we skip finding old functions here
    var bytecode = bcexec.compileProgram(this.ast);
    this.context = new bcexec.Context(bytecode, env);
  };
  BCRunner.prototype.copy = function(){
    //funs are copied so the envs associated with each function are preserved
    var copy = deepCopy([this.context, this.funs]);
    var c = {counter: this.counter,
             funs: copy[1],
             scopeCheck: this.scopeCheck.copy(),
             context: copy[0],
             statefuls: this.statefuls.map( x => x.saveState() )};
    return c;
  };
  BCRunner.prototype.restart = function(){
    var bytecode = bcexec.compileProgram(this.ast);
    this.context = new bcexec.Context(bytecode, this.envBuilder());
    console.log('Restart!');
  };
  /** Updates running program with new source code.
   * If cb is provided, may behave in nonblocking manner to do fancy animations */
  BCRunner.prototype.update = function(s, cb){
    console.log('update!');
    var newAst = parse(s);
    var functionASTs = parse.findFunctions(newAst);
    if (this.ast !== undefined &&
        (JSON.stringify(parse.justContent(newAst)) ===
         JSON.stringify(parse.justContent(this.ast))) && !this.context.finished){
      return cb ? cb(false) : undefined;
    }

    // the AST changed. We might stay where we are, we might restore.
    // We're definitely going to swap the code for at least one function.
    this.ast = newAst;

    var diff = parse.diffFunctions(this.oldFunctionASTs, functionASTs);
    this.oldFunctionASTs = functionASTs;
    if (Object.keys(diff).length === 0){
      // Since no named functions have changed, this must have been a
      // top-level (global scope) AST change. Do a total reset!
      var reset = () => {
        console.log('Total reset!');
        this.ast = parse(s);
        var bytecode = bcexec.compileProgram(this.ast);
        this.context = new bcexec.Context(bytecode, this.envBuilder());
        this.funs = {};
      };
      if (cb){
        setTimeout(() => {
          console.log("in the function scheduled from update");
          this.visualSeek(0, () => {
            console.log('in the visualSeek callback');
            this.keyframeStates = {};
            reset();
            cb(true);
          }, framesample.makeAccelDecelSampler(300));
        }, 0);
      } else {
        reset();
      }
      return;

    } else {
      console.log('functions changed: ', Object.keys(diff));
    }
    //TODO should these be called "latest-"?
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
      return cb ? cb(false) : undefined;
    }

    console.log('restoring from last invocation of function', earliestGen);

    var restore = () => {
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

    if (cb){
      setTimeout(() => {
        console.log("in the function scheduled from update");
        this.visualSeek(parseInt(earliestTime), () => {
          console.log('in the visualSeek callback');
          var newKeyframeStates = {};
          for (var i of Object.keys(this.keyframeStates)){
            if (parseInt(i) <= earliestTime){
              newKeyframeStates[i] = this.keyframeStates[i];
            }
          }
          this.keyframeStates = newKeyframeStates;
          restore();
          cb();
        }, framesample.makeAccelDecelSampler(200));
      }, 0);
    } else {
      return restore();
    }
  };

  /** Run code with no defns allowed */
  BCRunner.prototype.runLibraryCode = function(s, env){
    if (s.indexOf('defn') !== -1){
      throw Error('looks like there is a defn in this code! '+s);
    }
    if (env === undefined){
      env = new Environment(undefined, undefined, this);
    } else {
      this.scopeCheck.ingest(env.runner.scopeCheck);
      env.runner = this;
    }

    var ast = parse(s);
    var bytecode = bcexec.compileProgram(ast);
    this.context = new bcexec.Context(bytecode, env);
    return this.value();
  };
  /** Run code with no defns allowed, and keep env */
  BCRunner.prototype.runInitializationCode = function(s, env){
    if (s.indexOf('defn') !== -1){
      throw Error('looks like there is a defn in this code! '+s);
    }
    if (env === undefined){
      env = new Environment(undefined, undefined, this);
    } else {
      this.scopeCheck.ingest(env.runner.scopeCheck);
      env.runner = this;
    }

    var ast = parse(s);
    var bytecode = bcexec.compileInitialization(ast);
    this.context = new bcexec.Context(bytecode, env);
    return this.value();
  };
  /** Calls callback with whether it is still running */
  BCRunner.prototype.runABit = function(numIterations, cb, onRuntimeError){
    if (!this.context){
      console.log('no context!');
      return cb(false);
    }
    if (this.context.done){
      console.log('finished');
      return cb(false);
    }
    numIterations = numIterations || 1;
    var start = this.counter;
    var shouldRunCallback = true;
    var errorless = withErrorHandler(onRuntimeError, ()=>{
      while(this.counter < start + numIterations){
        var finished = this.runOneStep();
        if (finished){
          this.saveState();
          break;
        }
        if (this.renderRequested){
          this.saveState();
        }
        if (this.renderRequested && this.counter < start + numIterations){
          var ticksLeft = start + numIterations - this.counter;
          //console.log('breaking early to deal with a renderRequest! '+ticksLeft+' ticks left');
          setTimeout( ()=>{ this.runABit(ticksLeft, cb, onRuntimeError); }, 0);
          shouldRunCallback = false;  // we just scheduled it here
          this.renderRequested = false;
          break;
        }
      }
    });
    this.renderRequested = false;

    if (shouldRunCallback){
      if (!errorless){
        cb('error');
      } else {
        cb(!this.context.done);
      }
    }
  };
  BCRunner.prototype.saveStateByDefn = function(name){
    var copy = this.copy();
    // need to incref closures from this state

    this.savesByFunInvoke[name] = copy;
    this.keyframeStates[this.counter] = copy;
  };
  BCRunner.prototype.saveState = function(){
    if (this.keyframeStates[this.counter]){
      // already saved state this tick
      return;
    }
    var copy = this.copy();
    this.keyframeStates[this.counter] = copy;
  };
  BCRunner.prototype.restoreState = function(state){
    // copied in one deepCopy call because their
    // object webs are intertwined; functions share environments
    // also on the context.envStack.
    this.counter = state.counter;
    this.context = state.context;  // deepcopied because this mutates
    this.funs = state.funs;  // copied so we can update these
    this.scopeCheck = state.scopeCheck;
    this.statefuls.forEach( (s, i) => {
      s.restoreState(state.statefuls[i]);
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
  BCRunner.prototype.getFunScopes = function(){
    if (!this.funs){ return []; }
    return Object.keys(this.funs)
      .filter(name => name !== '__obj_id')
      .map( name => this.funs[name].env.mutableScope);
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
  BCRunner.prototype.getCurrentAST = function(){
    return this.context.getCurrentAST();
  };
  /** returns true if finished */
  BCRunner.prototype.runOneStep = function(){
    /*
    // used for rewind states
    this.rewindStates.push(this.copy());
    if (this.rewindStates.length > 100){
      this.rewindStates.shift();
    }
    */
    bcexec.execBytecodeOneStep(this.context);
    if (this.debug && this.context.counterStack.count() &&
        this.context.bytecodeStack.count()){
      if (this.scopeCheck.log){
        console.log(this.scopeCheck.log.join('\n'));
        this.scopeCheck.log = [];
      }
      bcexec.dis(this.context,
                 typeof this.debug === 'string' ? this.debug : undefined);
    }
    this.counter += 1;
    return this.context.done;
  };


  // Playback stuff
  /** Step back one step or do nothing if no more to go back*/
  BCRunner.prototype.stepBackOneStep = function(){
    if (this.currentRewindIndex === null){
      this.currentRewindIndex = this.rewindStates.length - 1;
    } else {
      this.currentRewindIndex = Math.max(0, this.currentRewindIndex - 1);
    }
    console.log('restoring', this.rewindStates[this.currentRewindIndex]);
    this.restoreState(this.rewindStates[this.currentRewindIndex]);
  };
  BCRunner.prototype.visualSeek = function(dest, cb, frameChooser){
    console.log('visualSeek');
    if (dest > Math.max(Math.max.apply(null, Object.keys(this.keyframeStates)), this.counter)){
      throw Error('destination is beyond the knowable future: '+dest);
    }
    var min = Math.min(dest, this.counter);
    var max = Math.max(dest, this.counter);
    var toShow = Object.keys(this.keyframeStates)
      .map(x => parseInt(x))
      .filter(x => min < x && x < max);
    console.log('found', toShow.length, 'frames to animate');
    toShow.sort(function(a,b){return a - b;});
    if (dest > cb){
      toShow.reverse();
    }

    toShow = frameChooser(toShow);
    var self = this;
    function innerSeek(){
      if (toShow.length){
        // because it's not a deepcopy, important not to run from here
        var index = toShow.pop();
        var state = self.keyframeStates[index];
        //TODO why is this happening?
        if (state === undefined){
          console.log('tried to restore state', index, 'but it was undefined!');
        } else {
          self.restoreState(state);
        }
        setTimeout(innerSeek, 0);
      } else {
        cb();
      }
    }
    innerSeek();
  };


  //TODO temp ship for compatibility with evalGen in tests
  BCRunner.prototype.next = BCRunner.prototype.runOneStep;

  /** Runs cb using errback to handle errors if provided
   *
   * Returns true if no errors occured, otherwise false */
  function withErrorHandler(errorHandler, cb){
    if (errorHandler){
      try{
        cb();
        return true;
      } catch (e) {
        errorHandler(e);
        return false;
      }
    } else {
      cb();
      return true;
    }
  }

  /** Builds an environment from mappings and code */
  function buildEnv(mutableScopes, libraryScopes, runner){
    // If code is being run, a runner is required because
    // code might create functions that have envs that need runners.
    // If this becomes untenable then we'll need to recursively
    // replace runners.
    if (!runner){
      throw Error("runner is required");
    }
    //TODO could allow no runner so long as no code is being run, but
    //that's what Environment.fromMultipleMutables is for.
    if (!Array.isArray(mutableScopes)){
      throw Error('First arg to buildEnv should be an array of code strings or mappings');
    }
    if (mutableScopes.length < 1){
      return new Environment(undefined, libraryScopes);
    }
    var env;
    for (var scope of mutableScopes){
      if (typeof scope === 'object'){
        if (env){
          env = env.newWithScope(scope);
        } else {
          env = new Environment(scope, libraryScopes, runner);
        }
      } else if (typeof scope === 'string'){
        if (env){
          env = env.newWithScope({});
        } else {
          env = new Environment({}, libraryScopes, runner);
        }
        runner.runInitializationCode(scope, env);
      } else {
        throw Error("bad scope value: " + scope);
      }
    }
    return env;
  }

  /** Run code to completion, no defns allowed */
  function bcrun(s, env){
    // Environments have their own scopeChecks via a fake
    // runner property by default
    var runner = new BCRunner(null);
    return runner.runLibraryCode(s, env);
  }

  /** EnvBuilder needs to take a runner arg */
  function runWithoutDefn(s, envBuilder, debug){
    var runner = new BCRunner(null);
    if (debug){ runner.debug = s; }
    runner.setEnvBuilder(envBuilder);
    runner.loadUserCode(s);
    return runner.value();
  }


  /** EnvBuilder needs to take a runner arg */
  function runWithDefn(s, envBuilder, debug){
    var runner = new BCRunner({});
    if (debug){ runner.debug = s; }
    runner.setEnvBuilder(envBuilder);
    runner.loadUserCode(s);
    return runner.value();
  }

  bcrun.bcrun = bcrun;
  bcrun.BCRunner = BCRunner;
  bcrun.runWithDefn = runWithDefn;
  bcrun.buildEnv = buildEnv;


  /** Ways things cna be run:
   *
   *  1. bcrun(s, env): uses env's ScopeCheck
   *     No defns allowed.
   *     
   *
   *
   */

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = bcrun;
    }
  } else {
    window.bcrun = bcrun;
  }
})();
