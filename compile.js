;(function(){
  'use strict';

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

  function compile(ast){
    return build(ast).compile();
  }
  function evaluate(ast, env){
    return build(ast).eval(env);
  }

  compile.compile = compile;
  compile.evaluate = evaluate;
  compile.BC = BC;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = compile;
    }
  } else {
    window.bytecoderun = compile;
  }
})();
