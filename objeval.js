if (typeof window === 'undefined') {
    var parse = require('./parse.js').parse
}

function Function(body, params){
  this.body = body;
  this.params = params;
}
Function.buildScope = function(args){
  if (this.params.length != args.length){
    throw Error("Calling function "+this+" with wrong arity! Expected " +
           this.params.length + " params but got " + args.length);
  }
  var scope = {};
  for (var i = 0; i < args.length; i++){
    scope[this.params[i]] = args[i];
  }
  return scope;
}

function Runner(s, env){
  if (env === undefined){
    env = [builtins, {}];
  }

  this.ast = parse(s);
  this.env = env;
  this.state = Eval(this.ast, this.env);
}

Runner.prototype[Symbol.iterator] = function(){
  return this;
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
  throw Error("Key "+key+" not found in environment"+this);
};
Environment.prototype.newWithScope = function(scope){
  return new Environment(this.scopes.concat([scope]), this.funs);
};
Environment.prototype.toString = function(){
  var s = '<Environment: ';
  for (var i = this.scopes.length - 1; i>=0; i--){
    s = s + JSON.stringify(this.scopes[i]);
    s = s + "\n";
  }
  s = s + '>';
  return s;
}

function evalGen(ast, env){
  // Returns an iterable which will evaluate this ast
  if (typeof ast === 'number'){
      return new NumberLiteral(ast);
  }

  if (typeof ast === 'string'){
      start = ast.slice(0, 1);
      end = ast.slice(-1);
      if (start === end && (start === '"' || start === "'")){
          return new StringLiteral(ast.slice(1, -1))
      } else {
          return new Lookup(ast, env);
      }
  }

  if (!Array.isArray(ast)){
      throw Error('What even is this: '+ast)
  }

  // special forms go here once we have those

  if (ast[0] === 'do'){ throw "special form do not implemented yet" }
  if (ast[0] === 'if'){ throw "special form do not implemented yet" }
  if (ast[0] === 'set'){ throw "special form do not implemented yet" }
  if (ast[0] === 'lambda'){ throw "special form do not implemented yet" }
  if (ast[0] === 'defn'){ throw "special form do not implemented yet" }

  return new Invocation(ast, env);
}

function BaseEval(){
  this.values = [];
};
BaseEval.prototype.tostring = function(){return this.constructor.toString() }
BaseEval.prototype[Symbol.iterator] = function(){return this;};
BaseEval.prototype.isEvalGen = true;
BaseEval.prototype.isFinished = function(g){
  // Calls next on a generator, adds result to this.values if finished
  // Returns true if complete, else false
  var r = g.next();
  if (!r.finished){
    return false;
  } else if (r.value.isEvalGen) {
    this.delegate = r.value;
    return false;
  } else {
    this.values.push(r.value);
    return true;
  }
}

function StringLiteral(ast){ this.ast = ast; }
StringLiteral.prototype = new BaseEval();
StringLiteral.prototype.next = function(){ return {value: this.ast, finished: true} }

function NumberLiteral(ast){ this.ast = ast; }
NumberLiteral.prototype = new BaseEval();
NumberLiteral.prototype.next = function(){ return {value: this.ast, finished: true} }

function Lookup(ast, env){ this.ast = ast; this.env = env;}
Lookup.prototype = new BaseEval();
Lookup.prototype.next = function(){
  return {value: this.env.lookup(this.ast), finished: true}
}

function Invocation(ast, env){
  this.ast = ast;
  this.env = env;
  this.values = [];
  this.delegate = null;
}
Invocation.prototype = new BaseEval();
Invocation.prototype.next = function(){
  if (this.delegate === null){
    if (this.ast.length === 0){ throw Error("can't evaluate empty form") }
    this.delegate = evalGen(this.ast[0], this.env);
    return {value: null, finished: false};
  } else {
    if (this.isFinished(this.delegate)) {
      if (this.values.length < this.ast.length){
        this.delegate = evalGen(this.ast[this.values.length], this.env);
        return {value: null, finished: false};
      } else {
        if (typeof this.values[0] === 'function'){
          var value = this.values[0].apply(null, this.values.slice(1));
          return {value: value, finished: true}
        } else if (this.values[0].constructor === Function) {
          var callScope = this.values[0].buildScope(this.values.slice(1));
          var callEnv = this.env.newWithScope(callScope);
          var value = evalGen(this.values[0].ast, callEnv);
          return {value: value, finished: true}
        } else {
          throw Error("don't know how to call non-function "+this.values[0])
        }
      }
    } else {
      return {value: null, finished: false};
    }
  }
}

builtins = {
  '+': function(){
    return Array.prototype.slice.call(arguments).reduce(function(a, b){
      return a + b}, 0)
  },
}

if (typeof window === 'undefined') {
    exports.Runner = Runner;
    exports.Environment = Environment;
    exports.evalGen = evalGen;
    exports.builtins = builtins;
}
