'use strict';

var Immutable = require('./Immutable.js');
var parse = require('./parse.js');
var ScopeCheck = require('./ScopeCheck.js');

/** Different from parse.Function in that body
 * will be a tree of compile objects instead of
 * being AST.
 */
function EvalFunction(body, params, env, name){
  if (name === undefined){
    name = null; // anonymous function
  }
  this.name = name;      // string
  this.body = body;      // ast with linenos
  this.params = params;  // list of tokens with linenos
  this.env = env;
}
EvalFunction.prototype.toString = function(){
  return 'λ('+ ((this.params && this.params.length) ? this.params : '') +'):'+parse.justContent(this.body);
};

/** A simple runner that only provides a scopeCheck */
function ScopeCheckRunner(){
  this.scopeCheck = new ScopeCheck();
}

ScopeCheckRunner.prototype.getFunScopes = function(){
  // ScopeCheckRunner has no funs that need to be accounted for
  // when recording marking scopes to be saved during GC
  return [];
};

/**
 * Environment constructor takes two lists of scope objects and a runner.
 *
 * Mutable scope can be either be a simple objects mapping names to values
 * or a scope ID that reference existing mutable scopes.
 * A scope ID requires that a runner be provided and for it to allow mutable state.
 *
 * Library scopes are objects whose properties will be accessible in
 * the language but whose properties cannot be modified.
 * During lookup, properties which are functions will be bound to the
 * object they were looked up on so `this` can be used in them.
 * These objects should either be stateless or provide the methods
 * saveState and restoreState for rewind. Either way, these non-Scope
 * objects shared between all saved snapshots including Environments
 * currently in use.
 *
 * If no runner is provided a runner will be created for its scopeCheck.
 * If runner argument is null then this won't happen.
 *
 *
 * saveState() should produce a deepcopy-able (preferrably immutable)
 * object that contains sufficient information for restoreState(state) to
 * reset the behavior and visual appearance of the object.
 * restoreState(state) is used to step backwards in execution in such a
 * way that execution could be resumed at any time producing the same results.
 *
 * TODO it's not clear what user input watchers should do: if stepping
 * forward ever becomes possible (distinct from resuming execution) and
 * is implemented by executing one step instead of just loading the next
 * state then both behaviors will be required. For now there's no need
 * to save user input in this way because we're only stepping backwards.
 */
function Environment(mutableScope, libraryScopes, runner){
  //TODO incorporate the fromMultipleMutables stuff into the constructor
  // (but wait until the refactor is over because catchign arrays for now
  // is a convenient notice that code needs to be updated)

  // this.mutableScope
  if (mutableScope === undefined){
    if (runner === null){
      throw Error("can't have mutable scope with no runner");
    } else if (runner && runner.scopeCheck === null) {
      throw Error("can't have mutable scope with a runner with null as scopeCheck");
    } else if (runner === undefined){
      // make a simple runner just for its scopeCheck
      runner = new ScopeCheckRunner();
    } else if (runner) {
      // NOP, we'll use this runner
    } else {
      throw Error("thought that was exhaustive");
    }
    this.mutableScope = runner.scopeCheck.new();
  } else if (mutableScope === null){
    this.mutableScope = mutableScope;
  } else if (mutableScope.constructor === Object){
    if (runner === undefined){
      runner = new ScopeCheckRunner();
    }
    if (runner === null){
      throw Error('mutable scopes not allowed for Environments without a runner of null');
    }
    if (runner.scopeCheck === null){
      throw Error('mutable scopes not allowed for Environments a runner with a scopeCheck of null');
    }
    var scopeId = runner.scopeCheck.new();
    for (var name of Object.keys(mutableScope)){
      runner.scopeCheck.define(scopeId, name, mutableScope[name]);
    }
    this.mutableScope = scopeId;
  } else if (typeof mutableScope === 'number'){
    if (runner === undefined || runner === null || runner.scopeCheck === null){
      throw Error("ScopeID "+mutableScope+" cannot be used without a scopeCheck");
    }
    this.mutableScope = mutableScope;
  } else {
    //TODO temp error for refactoring
    if (Array.isArray(mutableScope)){ throw Error("Environments don't take arrays anymore for first arg"); }
    throw Error('Bad mutableScope: '+mutableScope);
  }

  // this.libraryScope
  if (libraryScopes === undefined){
    libraryScopes = [];
  }
  if (!Array.isArray(libraryScopes)){ throw Error('second arg should be array'); }
  libraryScopes.forEach(scope => {
    // in Chrome Canary 54 console.constructor is Object
    if (scope.constructor === Object && scope !== console){
      throw Error('Environment libraryScopes should not be simple objects: '+scope);
    }
  });
  this.libraryScopes = libraryScopes;

  //runner
  if (runner && runner.constructor.name !== 'ScopeCheckRunner' &&
      runner.constructor.name !== 'Runner'){
    throw Error("Environment constructed with bad runner argument: ", runner);
  }
  this.runner = runner || null;
}

// testing methods
// TODO migrate Environment.fromObjects = function to this
Environment.fromMultipleMutables = function(arr, runner){
  var env = new Environment(arr[0], [], runner);
  for (var scope of arr.slice(1)){
    if (typeof scope === 'object'){

    }
    env = env.newWithScope(scope);
  }
  return env;
};
Environment.prototype.toObjects = function(){
  var scopes = [];
  var cur = this.mutableScope;
  while (cur){
    scopes.unshift(this.runner.scopeCheck.toObject(cur));
    cur = this.runner.scopeCheck.getParent(cur);
  }
  return scopes;
};

Environment.prototype.lookup = function(key, ast, defaultValue){
  var NotFound = {};
  if (this.mutableScope){
    var tmp = this.runner.scopeCheck.lookup(this.mutableScope, key);
    if (tmp !== ScopeCheck.NOTFOUND){
      return tmp;
    }
  }
  for (var i = this.libraryScopes.length - 1; i >= 0; i--){
    var scope = this.libraryScopes[i];
    var val = scope[key];
    // Undefined is a valid value in this language, but it can't be stored
    // in special scopes that aren't represented with Immutable.Maps.
    val = val === undefined ? NotFound : val;
    if (val !== NotFound){
      if (typeof val === 'function'){
        var origName = val.name;
        var newfunc = val.bind(scope);
        newfunc.origName = origName;
        newfunc.origFunc = val;
        newfunc.isNondeterministic = scope._is_nondeterministic ? true : false;
        return newfunc;
      }
      return val;
    }
  }
  if (this.runner && this.runner.funs && this.runner.functionExists(key)){
    return new NamedFunctionPlaceholder(key, this.runner);
  }
  if (defaultValue !== undefined){
    return defaultValue;
  }
  var e = Error("Name '"+key+"' not found in "+this);
  e.ast = ast;
  throw e;
};
Environment.prototype.set = function(key, value){
  if (this.mutableScope){
    if(this.runner.scopeCheck.set(this.mutableScope, key, value)){
      return value;
    }
  }
  for (var i = this.libraryScopes.length - 1; i >= 0; i--){
    var scope = this.libraryScopes[i];
    if (this.libraryScopes[i].hasOwnProperty(key)){
      throw Error("Name '"+key+"' is in a library scope so can't be changed");
    }
  }
  if (this.runner.funs.hasOwnProperty(key)){
    throw Error("Name '"+key+"' is in global functions, so you can't change it");
  }
  throw Error("Name '"+key+"' not found in environment"+this);
};
Environment.prototype.define = function(name, value){
  if (!this.mutableScope){
    throw Error("No mutable scope available");
  }
  this.runner.scopeCheck.define(this.mutableScope, name, value);
  return value;
};
Environment.prototype.setFunction = function(name, func){
  if (this.runner === null){
    throw Error("Environment doesn't have a runner, defn not allowed");
  }
  if (this.runner.funs === null){
    throw Error("Runner doesn't allow named functions");
  }
  func.incref('storing new version of named function '+name);
  if (this.runner.funs[name]){
    this.runner.funs[name].decref('tossing old version of named function '+name);
  }
  this.runner.funs[name] = func;
};
/** Gets the actual fun from the runner */
Environment.prototype.retrieveNamedFunction = function(name){
  if (this.runner === undefined){
    throw Error("Can't look up function because environment doesn't have a runner");
  }
  if (this.runner.funs === null){
    console.log('somehow this.runner.funs is null now!');
    throw Error("Runner doesn't allow named functions");
  }
  if (this.runner.funs[name] === undefined){
    throw Error("Named function "+name+" not found in " + Object.keys(this.funs));
  }
  this.runner.saveStateByDefn(name);
  var func = this.runner.getFunction(name);
  func.incref();
  return func;
};
//TODO rename to newWithMapping or similar
Environment.prototype.newWithScope = function(mapping){
  if (mapping === undefined){
    throw Error('Supply a mapping as first argument! An empty object is fine.');
  }
  if (this.mutableScope){
    var newScope = this.runner.scopeCheck.newFromScope(this.mutableScope, mapping);
    var env = new Environment(newScope, this.libraryScopes, this.runner);
    return env;
  }
  // If not mutable scope, there must not have been a runner or a runner.scopecheck
  throw Error("can't run create new scope to run function because no mutable scope!");
};
Environment.prototype.newWithScopeFromEnv = function(env){
  if (env.constructor !== Environment){ throw Error("not an env"); }
  if (!env.mutableScope){ throw Error("no mutable scope to build mapping with"); }
  var mapping = env.runner.scopeCheck.mapping(env.mutableScope);
  if (env.runner.scopeCheck === this.runner.scopeCheck){
    return this.newWithScope(mapping);
  } else {
    var ourRunner = this.runner;
    //find envs hiding in functions and update runners to point here.
    env.runner.scopeCheck.forEachValue( value => {
      if (value && value.env){
        value.env.runner = ourRunner;
        throw Error("Untested code: this is where envs' runners should be updated");
      }
    });
    // add all scopes in old runner to new runner
    this.runner.scopeCheck.ingest(env.runner.scopeCheck);
    // update all environments in mapping to use our runner
    var newEnv = this.newWithScope(mapping);
    return newEnv;

    //TODO update scope numbers - for now just hoping they don't collide
  }
};

/** Decref mutable scope */
Environment.prototype.decref = function(reason){
  this.runner.scopeCheck.decref(this.mutableScope, reason);
};
Environment.prototype.incref = function(reason){
  this.runner.scopeCheck.incref(this.mutableScope, reason);
};

Environment.prototype.makeEvalLambda = function(body, params, name){
  return new EvalFunction(body, params, this, name);
};
Environment.prototype.makeEvalNamedFunction = function(body, params, name){
  var f = new parse.EvalFunction(body, params, this, name);
  this.setFunction(name, f);
  return new NamedFunctionPlaceholder(f.name);
};

Environment.prototype.toString = function(){
  var s = '<Environment\n';
  if (this.mutableScope){
    s += this.runner.scopeCheck.allKeys(this.mutableScope);
  }
  for (var i = this.libraryScopes.length - 1; i>=0; i--){
    var props = [];
    for (var prop in this.libraryScopes[i]){
      props.push(prop);
    }
    s = s + "\n";
    s = s + props;
  }
  s = s + "\n";
  if (this.runner){
    s += 'with runner ';
    s += this.runner;
    s = s + "\n";
  }
  s = s.slice(0, -1) + '>';
  return s;
};

function NamedFunctionPlaceholder(name, runner){
  this.name = name;
  this.runner = runner;
}
NamedFunctionPlaceholder.prototype.toString = function(){
  return 'λ placeholder '+this.name+'(...?)';
};
//NamedFunctionPlaceholders hold weak references to their closure.
//(or technically, don't hold a reference to their closure at all
//because they're just a reminder saying that there's a corresponding
//function in runner.funs

Environment.Environment = Environment;
Environment.NamedFunctionPlaceholder = NamedFunctionPlaceholder;

module.exports = Environment;
