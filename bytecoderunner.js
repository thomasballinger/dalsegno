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
  var run = require('./run.js');
  var Environment = run.Environment;
  var Scope = run.Scope;
  var Immutable = require('./Immutable.js');


  function err(msg, ast){
    e = Error(msg);
    e.ast = ast;
    throw e;
  }

  var BC = {
    LoadConstant   : 0,
    FunctionLookup : 1,
    FunctionCall   : 2,
    NameLookup     : 3,
    JumpIfNot      : 4,
    Jump           : 5,
    Pop            : 6,   // arg always null
    BuildFunction  : 7,   // arg is null for lambda, name otherwise
    Push           : 8,
    StoreNew       : 9,   // arg is variable name, saves TOS
    Store          : 10,  // arg is variable name, saves TOS
    Return         : 11,  // done with this bytecode
    Yield          : 12,  // done for now, please continue when callback is true
    CloneTop       : 13,  // push on another of the top of the stack
  };

  function build(ast){
    if (Array.isArray(ast)){
      if (ast[0].length === 0){         return new Null(ast); }
      if (ast[0].content === 'begin'){  return new Begin(ast); }
      if (ast[0].content === 'do'){     return new Begin(ast); }
      if (ast[0].content === 'if'){     return new If(ast); }
      if (ast[0].content === 'set!'){   return new Set(ast); }
      if (ast[0].content === 'define'){ return new Define(ast); }
      if (ast[0].content === 'defn'){   return new Defn(ast); }
      if (ast[0].content === 'lambda'){ return new Lambda(ast); }
      return new Invocation(ast);
    } else {
      if (ast.type === 'number'){ return new NumberLiteral(ast); }
      if (ast.type === 'word'){ return new Lookup(ast); }
      if (ast.type === 'string'){ return new StringLiteral(ast); }
    }
    throw Error('wtf is this?'+ast);
  }

  function Null(ast){
    // Special because ast isn't required
    if (ast && (ast.length !== 2 || ast[0].content !== '(' || ast[1].content !== ')')){
      throw Error("huh? doesn't look like a null node:", ast);
    }
  }
  Null.prototype.eval = function(env){ return null; };
  Null.prototype.compile = function(){ return [[BC.LoadConstant, null]]; };

  function NumberLiteral(ast){
    this.number = ast.content;
  }
  NumberLiteral.prototype.eval = function(env){ return this.number; };
  NumberLiteral.prototype.compile = function(){
    return [[BC.LoadConstant, this.number]];
  };

  function Define(ast){
    if (ast[0] !== 'define'){ err('freak out', ast); }
    if (ast.length < 2){ throw err('define requires ast least two args', ast); }
    if (ast.length > 3){ throw err('define takes two arguments at most', ast); }
    if (ast[1].type !== 'word'){ err('first argument to define should be a name', ast); }
    this.name = ast[1].content;
    this.body = ast.length === 3 ? build(ast[2].content) : undefined;
  }
  Define.prototype.eval = function(env){
    return env.define(this.name, this.body === undefined ? undefined : this.body.eval(env));
  };
  Define.prototype.compile = function(){
    var bodyCode = this.body ? this.body.compile(this.body) : new NullNode().compile();
    return [].concat(bodyCode, [[BC.StoreNew, this.name]]);
  };

  function runBytecodeOneStep(counterStack, bytecodeStack, envStack, valueStack){
    var env = envStack.peek();
    var bytecode = bytecodeStack.peek();
    var counter = counterStack.peek();
    if (bytecode.length <= counter){
        throw Error('counter went off the end of bytecode: missing return?');
    }
    var done = false;
    console.log('bytecode: ', bytecode);
    var x = bytecode[counter];
    var bc=x[0], arg=x[1];
    switch (bc){
      case BC.LoadConstant:
        valueStack = valueStack.push(arg);
        break;
      case BC.Return:
        bytecodeStack = bytecodeStack.pop();
        counterStack = counterStack.pop();
        envStack = envStack.pop();
        if (bytecodeStack.count() === 0){
          done = true;
        } else {
          counter = counterStack.peek();
        }
        break;
      default:
        throw Error('unrecognized bytecode: '+bc);
    }
    counterStack = counterStack.pop().push(counter+1);
    return [counterStack, bytecodeStack, envStack, valueStack, done];
  }

  function runBytecode(bytecode, env){
    bytecode.push([BC.Return, null]);
    console.log('after add', bytecode);
    var counterStack  = Immutable.Stack([0]);
    var bytecodeStack = Immutable.Stack([bytecode]);
    var envStack      = Immutable.Stack([env]);

    var valueStack    = Immutable.Stack([]);
    var finished;
    do {
      var x = runBytecodeOneStep(counterStack, bytecodeStack, envStack, valueStack);
      console.log(x);
      counterStack=x[0];bytecodeStack=x[1];envStack=x[2];valueStack=x[3];
      finished=x[4];
    } while (!finished);
    if (valueStack.count() !== 1){
        throw Error('final stack is of wrong length '+valueStack.count()+': '+valueStack);
    }
    return valueStack.peek();
  }

  function bytecoderun(){
    var s = '1';
    var ast = parse(s);
    console.log(ast);
    var stuff = build(ast);
    console.log('eval result:', stuff.eval(new Environment.fromObjects(
      [{'+': function(a, b){ return a + b; }}])));
    var bytecode = stuff.compile();
    console.log('from compile:', bytecode);
    console.log(runBytecode(bytecode, new Environment()));
  }
  bytecoderun('1');

  bytecoderun.bytecoderun = bytecoderun;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = bytecoderun;
    }
  } else {
    window.bytecoderun = bytecoderun;
  }
})();
