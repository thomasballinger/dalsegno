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
  Function.prototype.toString = function(){
    return 'λ('+this.params+'): (stuff)';
  };

  /**
   * Environment constructor take a list of scope objects.
   * These can be ScopeId strings from the ScopeCheck
   * (which store bindings to values in the interpreted language)
   * or other objects whose properties will be accessible in the language.
   * During lookup, properties which are functions will be bound to the
   * object they were looked up on so `this` can be used in them.
   * These objects should either be stateless or provide the methods
   * saveState and restoreState for rewind. Either way, these non-Scope
   * objects shared between all saved snapshots including Environments
   * currently in use.
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
  function Environment(scopes, runner, scopeCheck){
    if (scopes === undefined){
      if (scopeCheck === undefined){
        scopeCheck = new ScopeCheck();
      }
      scopes = [scopeCheck.new()];
    }
    for (var scope of scopes){
      if (scope.constructor === Object){
        console.log(scope);
        throw Error('Environment constructed with non-scope args!');
      }
    }
    if (runner && runner.constructor.name !== 'Runner' &&
        runner.constructor.name !== 'BCRunner'){
      throw Error("Environment constructed with bad runner argument: ", runner);
    }
    this.scopes = scopes;
    this.runner = runner || null;
    this.scopeCheck = scopeCheck || null;
  }

  // testing methods
  Environment.fromObjects = function(arr, runner, scopeCheck){
    //TODO enforce only a single scopeId per Environment
    //(put off because tests will have to be fixed)
    if (scopeCheck === undefined){
      scopeCheck = new ScopeCheck();
    }
    var scopes = [];
    arr.forEach(function(x){
      if (Immutable.Iterable.isIterable(x)){
        throw Error("Environment.fromObjects called on stuff", arr);
      }
      var scopeId = scopes.length ? scopeCheck.newFromScope(scopes[scopes.length-1]) : scopeCheck.new();
      for (var name of Object.keys(x)){
        scopeCheck.define(scopeId, name, x[name]);
      }
      scopes.push(scopeId);
    });
    return new Environment(scopes, runner, scopeCheck);
  };
  Environment.prototype.toObjects = function(){
    return this.scopes.map(function(x){
      return this.scopeCheck.toObject(x);
    });
  };

  Environment.prototype.lookup = function(key, ast, defaultValue){
    var NotFound = {};
    for (var i = this.scopes.length - 1; i >= 0; i--){
      var scope = this.scopes[i];
      var val;
      if (typeof scope === 'number'){
        var tmp = this.scopeCheck.lookup(scope, key);
        val = tmp === ScopeCheck.NOTFOUND ? NotFound : tmp;
      } else {
        val = scope[key];
        // Undefined is a valid value in this language, but it can't be stored
        // in special scopes that aren't represented with Immutable.Maps.
        val = val === undefined ? NotFound : val;
      }
      if (val !== NotFound){
        if (typeof val === 'function'){
          var origName = val.name;
          var newfunc = val.bind(scope);
          newfunc.origName = origName;
          newfunc.origFunc = val;
          return newfunc;
        }
        return val;
      }
    }
    if (this.runner && this.runner.functionExists(key)){
      return new NamedFunctionPlaceholder(key);
    }
    if (defaultValue !== undefined){
      return defaultValue;
    }
    var e = Error("Name '"+key+"' not found in "+this);
    e.ast = ast;
    throw e;
  };
  Environment.prototype.set = function(key, value){
    for (var i = this.scopes.length - 1; i >= 0; i--){
      if (typeof this.scopes[i] === 'number'){
        if(this.scopeCheck.set(this.scopes[i], key, value)){
          return value;
        }
      } else if (this.scopes[i].hasOwnProperty(key)){
        throw Error("Name '"+key+"' is in a special scope, so you can't change it");
      }
    }
    if (this.funs.hasOwnProperty(key)){
      throw Error("Name '"+key+"' is in global functions, so you can't change it");
    }
    throw Error("Name '"+key+"' not found in environment"+this);
  };
  Environment.prototype.define = function(name, value){
    var scope = this.scopes[this.scopes.length - 1];
    if (typeof scope === 'number'){
      this.scopeCheck.define(scope, name, value);
    } else {
      console.log(this.scopes);
      console.log(scope.toJS());
      throw Error("Innermost scope isn't an normal scopeId somehow:"+typeof scope + ':');
    }
    return value;
  };
  Environment.prototype.setFunction = function(name, func){
    if (this.runner === null){
      throw Error("Environment doesn't have a runner, defn not allowed");
    }
    if (this.runner.funs === null){
      throw Error("Runner doesn't allow named functions");
    }
    this.runner.funs[name] = func;
  };
  Environment.prototype.retrieveFunction = function(name){
    if (this.runner === undefined){
      throw Error("Can't look up function because environment doesn't have a runner");
    }
    if (this.runner.funs === null){
      console.log(this.runner);
      throw Error("Runner doesn't allow named functions");
    }
    if (this.runner.funs[name] === undefined){
      throw Error("Named function "+name+" not found in " + Object.keys(this.funs));
    }
    this.runner.saveState(name);
    return this.runner.getFunction(name);
  };
  //TOMHERE TODO  next up: fixing NewWithScope to work with new thing
  Environment.prototype.newWithScope = function(mapping, runner){
    //TODO get rid of runner argument, why would that change?
    if (mapping === undefined){
      throw Error('Supply a mapping!');
    }
    if (runner === undefined){
      runner = this.runner;
    }
    //TODO What is this about?
    if (Object.keys(mapping)[0] === 'undefined'){
      throw Error('huh?');
    }
    var oldScope = this.scopes[this.scopes.length-1];
    if (typeof oldScope === 'number'){
      var newScope = this.scopeCheck.newFromScope(oldScope, mapping);
      //TODO enforce no other scopes being numbers here
      //because if there are we should be increffing them
      var env = new Environment(this.scopes.slice(0, -1).concat([newScope]), runner, this.scopeCheck);
    } else {
      var newScope = this.scopeCheck.new();
      var env = new Environment(this.scopes.concat([newScope]), runner, this.scopeCheck);
    }
    return env;
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
    for (var i = this.scopes.length - 1; i>=0; i--){
      var obj = (typeof this.scopes[i] === 'number' ?
                 this.scopeCheck.keys(this.scopes[i]) :
                 Object.keys(this.scopes[i]));
      console.log('this line of Env toString will be the toString of:', obj);
      s = s + obj;
      s = s + "\n";
    }
    if (this.runner){
      s += 'with runner ';
      s += this.runner;
      s = s + "\n";
    }
    s = s.slice(0, -1) + '>';
    return s;
  };

  function NamedFunctionPlaceholder(name){
    this.name = name;
  }
  NamedFunctionPlaceholder.prototype.toString = function(){
    return 'λ placeholder '+this.name+'(...?)';
  };

  Environment.Environment = Environment;
  Environment.NamedFunctionPlaceholder = NamedFunctionPlaceholder;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = Environment;
    }
  } else {
    window.Environment = Environment;
  }
})();
