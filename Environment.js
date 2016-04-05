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

  function Environment(scopes, runner){
    if (scopes === undefined){
      scopes = [new Scope()];
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
  }

  // testing methods
  Environment.fromObjects = function(arr, runner){
    var scopes = arr.map(function(x){
      if (x.constructor === Scope){
        return x;
      }
      return new Scope(Immutable.Map(x));
    });
    return new Environment(scopes, runner);
  };
  Environment.prototype.toObjects = function(){
    return this.scopes.map(function(x){
      return x.data.toJS();
    });
  };

  Environment.prototype.lookup = function(key, ast){
    for (var i = this.scopes.length - 1; i >= 0; i--){
      var val;
      if (this.scopes[i].constructor === Scope){
        val = this.scopes[i].data.get(key);
      } else {
        val = this.scopes[i][key];
      }
      if (val !== undefined){
        if (typeof val === 'function'){
          var origName = val.name;
          var newfunc = val.bind(this.scopes[i]);
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
    var e = Error("Name '"+key+"' not found in "+this);
    e.ast = ast;
    throw e;
  };
  Environment.prototype.set = function(key, value){
    for (var i = this.scopes.length - 1; i >= 0; i--){
      if (this.scopes[i].constructor === Scope){
        if (this.scopes[i].data.has(key)){
          this.scopes[i].data = this.scopes[i].data.set(key, value);
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
    if (scope.constructor !== Scope){
      console.log(this.scopes);
      console.log(scope.toJS());
      throw Error("Innermost scope isn't an immutable map somehow:"+typeof scope + ':');
    }
    scope.data = scope.data.set(name, value);
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
      throw Error("Runner doesn't allow named functions");
    }
    if (this.runner.funs[name] === undefined){
      throw Error("Named function "+name+" not found in " + Object.keys(this.funs));
    }
    this.runner.saveState(name);
    return this.runner.getFunction(name);
  };
  Environment.prototype.newWithScope = function(scope){
    if (scope === undefined){
      throw Error('Supply a scope!');
    }
    if (Object.keys(scope)[0] === 'undefined'){
      debugger;
      throw Error('wtf');
    }
    var env = new Environment(this.scopes.concat([new Scope(Immutable.Map(scope))]), this.runner);
    return env;
  };
  Environment.prototype.makeEvalLambda = function(body, params, name){
    return new parse.Function(body, params, this, name);
  };
  Environment.prototype.makeEvalNamedFunction = function(body, params, name){
    var f = new parse.Function(body, params, this, name);
    this.define(this.name, func);
    return new NamedFunctionPlaceholder(f.name);
  };
  Environment.prototype.toString = function(){
    var s = '<Environment\n';
    for (var i = this.scopes.length - 1; i>=0; i--){
      s = s + JSON.stringify(this.scopes[i].hasOwnProperty('data') ?
                             Object.keys(this.scopes[i].data.toJS()) :
                             Object.keys(this.scopes[i]));
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

  function Scope(im){
    if (im === undefined){
      im = Immutable.Map();
    }
    if (!Immutable.Map.isMap(im)){
      console.log(im);
      throw Error('Scopes should be made with immutable maps');
    }
    this.data = im;
  }
  Scope.prototype.fromObject = function(obj){
    return new Scope(Immutable.Map(obj));
  };
  Scope.prototype.copy = function(){
    var s = new Scope(this.data);
    return s;
  };

  function NamedFunctionPlaceholder(name){
    this.name = name;
  }

  Environment.Environment = Environment;
  Environment.Scope = Scope;
  Environment.NamedFunctionPlaceholder = NamedFunctionPlaceholder;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = Environment;
    }
  } else {
    window.Environment = Environment;
  }
})();
