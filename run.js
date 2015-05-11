;(function() {
  'use strict';

  if (typeof window === 'undefined') {
    var require = module.require;
  } else {
    var require = function(name){ 
      var realname = name.match(/(\w+)[.]?j?s?$/)[1];
      return window[realname];
    };
  }
  var parse = require('./parse.js');
  var deepcopy = require('./deepcopy.js');

  function Runner(s, env){
    if (env === undefined){
      env = new Environment([{}]);
    }

    this.ast = parse(s);
    this.delegate = evalGen(this.ast, env);
    this.counter = 0;
    this.values = [];
  }
  Runner.prototype = new BaseEval();
  Runner.prototype.constructor = Runner;
  Runner.prototype.next = function(){
    if (this.isFinished(this.delegate)) {
      return {value: this.values[0], finished:true};
    }
    return {value: null, finished: false};
  };
  Runner.prototype.copy = function(){
    return [this.counter, deepcopy(this.delegate)];
  };

  function run(s, env){
    var runner = new Runner(s, env);
    var value = runner.next();
    while (!value.finished){
      value = runner.next();
    }
    return value.value;
  }

  function runAtInterval(s, env, timeout, numIterations, callback, errback){
    // If callback returns false, will stop running
    // errback called when a runtime error occurs with the error
    if (timeout === undefined){
      timeout = 0.001;
    }
    if (numIterations === undefined){
      numIterations = 1;
    }
    if (callback === undefined){
      callback = function(){return true;};
    }
    if (!callback()){
      return false;
    }
    var runner = new Runner(s, env);

    var runABit = function(){
      var result = callback();
      if (result === false){
        return;
      }

      try {
        var value = runner.next();
      } catch (ex) {
        errback(ex);
        return;
      }
      for (var i=0; i<numIterations-1; i++){
        if (value.finished){
          console.log(value.value);
          return;
        } else {
          try {
            value = runner.next();
          } catch (ex) {
            errback(ex);
            return;
          }
        }
      }
      if (value.finished){
        console.log('finished!', value.value);
      } else {
        setTimeout(runABit, timeout);
      }
    };

    runABit();
  }

  function Environment(scopes, funs){
    if (scopes === undefined){
      scopes = [{}];
    }
    if (funs === undefined){
      funs = {};
    }
    this.scopes = scopes;
    this.funs = funs;
  }

  Environment.prototype.lookup = function(key){
    for (var i = this.scopes.length - 1; i >= 0; i--){
      if (this.scopes[i].hasOwnProperty(key)){
        return this.scopes[i][key];
      }
    }
    if (this.funs.hasOwnProperty(key)){
      return new NamedFunctionPlaceholder(key);
    }
    throw Error("Name '"+key+"' not found in environment"+this);
  };
  Environment.prototype.set = function(key, value){
    for (var i = this.scopes.length - 1; i >= 0; i--){
      if (this.scopes[i].hasOwnProperty(key)){
        this.scopes[i][key] = value;
        return value;
      }
    }
    if (this.funs.hasOwnProperty(key)){
      throw Error("Name '"+key+"' is in global functions, so can't change it");
    }
    throw Error("Name '"+key+"' not found in environment"+this);
  };
  Environment.prototype.define = function(name, value){
    this.scopes[this.scopes.length - 1][name] = value;
  };
  Environment.prototype.setFunction = function(name, func){
    this.funs[name] = func;
  };
  Environment.prototype.lookupFunction = function(name){
    if (this.funs[name] === undefined){
      throw Error("Named function "+name+" not found in " + Object.keys(this.funs));
    }
    return this.funs[name];
  };
  Environment.prototype.newWithScopeAndFuns = function(scope, funs){
    if (scope === undefined || funs === undefined){
      throw Error('Supply both scope and funs please!'+scope+' '+funs);
    }
    return new Environment(this.scopes.concat([scope]), funs);
  };
  Environment.prototype.toString = function(){
    var s = '<Environment: ';
    for (var i = this.scopes.length - 1; i>=0; i--){
      s = s + JSON.stringify(Object.keys(this.scopes[i]));
      s = s + "\n";
    }
    s += 'with funs';
    s += JSON.stringify(Object.keys(this.funs));
    s = s + "\n";
    s = s + '>';
    return s;
  };

  function evalGen(ast, env){
    // Returns an iterable which will evaluate this ast
    if (typeof ast === 'number'){
        return new NumberLiteral(ast);
    }

    if (typeof ast === 'string'){
        var start = ast.slice(0, 1);
        var end = ast.slice(-1);
        if (start === end && (start === '"' || start === "'")){
            return new StringLiteral(ast.slice(1, -1));
        } else {
            return new Lookup(ast, env);
        }
    }

    if (!Array.isArray(ast)){
        throw Error('What even is this: '+ast);
    }

    // special forms go here once we have those

    if (ast[0] === 'begin' || ast[0] === 'do'){
      return new Begin(ast, env);
    }
    if (ast[0] === 'if'){ 
      if (ast.length > 4 || ast.length < 3){
        throw Error("wrong number of argumentsi for if: "+ast);
      }
      return new If(ast, env);
    }
    if (ast[0] === 'set!'){
      if (ast.length != 3){ throw Error("wrong number of arguments for set: "+ast); }
        return new SetBang(ast, env);
    }
    if (ast[0] === 'define'){
      return new Define(ast, env);
    }
    if (ast[0] === 'defn'){
      if (ast.length < 3){ throw Error("Not enough arguments for defn: "+ast); }
      return new NamedFunction(ast, env);
    }
    if (ast[0] === 'lambda'){
      if (ast.length < 2){ throw Error("Not enough arguments for lambda: "+ast); }
      return new LambdaExpression(ast, env);
    }

    return new Invocation(ast, env);
  }

  function BaseEval(){}
  // you better have a values property if you inherit from this
  // all child classes should be constructable with
  // new Thing(ast, env)
  BaseEval.prototype.tostring = function(){
    return this.constructor.toString();
  };
  BaseEval.prototype[Symbol.iterator] = function(){return this;};
  BaseEval.prototype.isEvalGen = true;
  BaseEval.prototype.isFinished = function(g){
    // Calls next on a generator, adds result to this.values if finished
    // Returns true if complete, else false
    var r = g.next();
    if (!r.hasOwnProperty('finished')){
      throw "Result isn't a iterator-like result: "+r;
    }
    if (!r.finished){
      return false;
    } else if (r.value && r.value.isEvalGen) {
      this.delegate = r.value;
      return false;
    } else {
      this.values.push(r.value);
      return true;
    }
  };

  function StringLiteral(ast){ this.ast = ast; }
  StringLiteral.prototype = new BaseEval();
  StringLiteral.prototype.constructor = StringLiteral;
  StringLiteral.prototype.next = function(){ return {value: this.ast, finished: true}; };

  function NumberLiteral(ast){ this.ast = ast; }
  NumberLiteral.prototype = new BaseEval();
  NumberLiteral.prototype.constructor = NumberLiteral;
  NumberLiteral.prototype.next = function(){ return {value: this.ast, finished: true}; };

  function LambdaExpression(ast, env){ this.ast = ast; this.env = env; }
  LambdaExpression.prototype = new BaseEval();
  LambdaExpression.prototype.constructor = LambdaExpression;
  LambdaExpression.prototype.next = function(){
    var f = new Function(this.ast[this.ast.length - 1], this.ast.slice(1, -1), this.env);
    return {value: f, finished: true};
  };

  function NamedFunction(ast, env){ this.ast = ast; this.env=env; }
  NamedFunction.prototype = new BaseEval();
  NamedFunction.prototype.constructor = NamedFunction;
  NamedFunction.prototype.next = function(){
    var f = new Function(this.ast[this.ast.length - 1], this.ast.slice(2, -1), this.env, this.ast[1]);
    this.env.setFunction(f.name, f);
    return {value: new NamedFunctionPlaceholder(f.name), finished: true};
  };

  function Lookup(ast, env){ this.ast = ast; this.env = env;}
  Lookup.prototype = new BaseEval();
  Lookup.prototype.constructor = Lookup;
  Lookup.prototype.next = function(){
    return {value: this.env.lookup(this.ast), finished: true}
  };

  function SetBang(ast, env){
    this.ast = ast;
    this.env = env;
    this.delegate = null;
    this.values = [];
  }
  SetBang.prototype = new BaseEval();
  SetBang.prototype.constructor = SetBang;
  SetBang.prototype.next = function(){
    if (this.delegate === null){
      this.delegate = evalGen(this.ast[2], this.env);
      return {value: null, finished: false}
    } else {
      if (this.isFinished(this.delegate)) {
        this.env.set(this.ast[1], this.values[0]);
        return {value: this.values[0], finished: true};
      } else {
        return {value: null, finished: false};
      }
    }
  };

  function Define(ast, env){
    this.ast = ast;
    this.env = env;
    this.delegate = null;
    this.values = [];
  }
  Define.prototype = new BaseEval();
  Define.prototype.constructor = Define;
  Define.prototype.next = function(){
    if (this.delegate === null){
      this.delegate = evalGen(this.ast[2], this.env);
      return {value: null, finished: false};
    } else {
      if (this.isFinished(this.delegate)) {
        this.env.define(this.ast[1], this.values[0]);
        return {value: this.values[0], finished: true};
      } else {
        return {value: null, finished: false};
      }
    }
  };

  function If(ast, env){
    this.ast = ast;
    this.env = env;
    this.delegate = null;
    this.values = [];
  }
  If.prototype = new BaseEval();
  If.prototype.constructor = If;
  If.prototype.next = function(){
    if (this.delegate === null){
      this.delegate = evalGen(this.ast[1], this.env);
      return {value: null, finished: false}
    } else {
      if (this.isFinished(this.delegate)) {
        if (this.ast.length === 3 && !this.values[0]){
          return {value: null, finished: true}
        } else {
          var g = evalGen(this.ast[this.values[0] ? 2 : 3], this.env);
          return {value: g, finished: true}
        }
      } else {
        return {value: null, finished: false}
      }
    }
  }

  function Begin(ast, env){
    this.ast = ast;
    this.env = env;
    this.delegate = null;
    this.values = [];
  }
  Begin.prototype = new BaseEval();
  Begin.prototype.constructor = Begin;
  Begin.prototype.next = function(){
    if (this.delegate === null){
      if (this.ast.length == 1){
        return {value: null, finished: true};
      } else if (this.ast.length == 2){
        var g = evalGen(this.ast[1], this.env);
        return {value: g, finished: true};
      } else {
        this.delegate = evalGen(this.ast[1], this.env);
        return {value: null, finished: false};
      }
    } else {
      if (this.isFinished(this.delegate)) {
        var g = evalGen(this.ast[this.values.length + 1], this.env);
        if (this.values.length < this.ast.length - 2){
          this.delegate = g;
          return {value: null, finished: false};
        } else {
          return {value: g, finished: true}
        }
      } else {
        return {value: null, finished: false};
      }
    }
  };


  function Invocation(ast, env){
    this.ast = ast;
    this.env = env;
    this.delegate = null;
    this.values = [];
  }
  Invocation.prototype = new BaseEval();
  Invocation.prototype.constructor = Invocation;
  Invocation.prototype.next = function(){
    if (this.delegate === null){
      if (this.ast.length === 0){ throw Error("can't evaluate empty form"); }
      this.delegate = evalGen(this.ast[0], this.env);
      return {value: null, finished: false};
    } else {
      if (this.isFinished(this.delegate)) {
        if (this.values.length < this.ast.length){
          this.delegate = evalGen(this.ast[this.values.length], this.env);
          if (this.values.length === this.ast.length && this.values[0].constructor === NamedFunctionPlaceholder) {
            //console.log('should make a copy now because on next iteration will run named function '+this.values[0].name);
          }
          return {value: null, finished: false};
        } else {
          if (typeof this.values[0] === 'function'){
            var value = this.values[0].apply(null, this.values.slice(1));
            return {value: value, finished: true};
          } else if (this.values[0].constructor === NamedFunctionPlaceholder || this.values[0].constructor === Function) {
            if (this.values[0].constructor === NamedFunctionPlaceholder){
              this.values[0] = this.env.lookupFunction(this.values[0].name);
            }
            var callScope = this.values[0].buildScope(this.values.slice(1));
            var callEnv = this.values[0].env.newWithScopeAndFuns(callScope, this.env.funs);
            var value = evalGen(this.values[0].body, callEnv);
            return {value: value, finished: true};
          } else {
            throw Error("don't know how to call non-function "+this.values[0]+' with constructor '+this.values[0].constructor);
          }
        }
      } else {
        return {value: null, finished: false};
      }
    }
  };

  function Function(body, params, env, name){
    if (name === undefined){
      name = null; // anonymous function
    }
    this.name = name;
    this.body = body;
    this.params = params;
    this.env = env;
  }
  Function.prototype.buildScope = function(args){
    if (this.params.length != args.length){
      throw Error("Calling function "+this.name+" with wrong arity! Expected " +
             this.params.length + " params but got " + args.length);
    }
    var scope = {};
    for (var i = 0; i < args.length; i++){
      scope[this.params[i]] = args[i];
    }
    return scope;
  };

  function NamedFunctionPlaceholder(name){this.name = name;}

  run.run = run;
  run.Runner = Runner;
  run.Environment = Environment;
  run.evalGen = evalGen;
  run.runAtInterval = runAtInterval;

  run.NamedFunctionPlaceholder = NamedFunctionPlaceholder;
  run.Function = NamedFunctionPlaceholder;

  run.evalGen.StringLiteral = StringLiteral;
  run.evalGen.NumberLiteral = NumberLiteral;
  run.evalGen.Begin = Begin;
  run.evalGen.If = If;
  run.evalGen.SetBang = SetBang;
  run.evalGen.Define = Define;
  run.evalGen.NamedFunction = NamedFunction;
  run.evalGen.LambdaExpression = LambdaExpression;
  run.evalGen.Invocation = Invocation;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = run;
    }
  } else {
    window.run = run;
  }
})();
