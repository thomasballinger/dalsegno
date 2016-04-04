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
    CloneTop       : 12,  // push on another of the top of the stack
  };

  function build(ast){
    if (Array.isArray(ast)){
      if (ast[0].length === 0){         return new Null(ast); }
      if (ast[0].content === 'begin'){  return new Begin(ast); }
      if (ast[0].content === 'do'){     return new Begin(ast); }
      if (ast[0].content === 'if'){     return new If(ast); }
      if (ast[0].content === 'set!'){   return new SetBang(ast); }
      if (ast[0].content === 'define'){ return new Define(ast); }
      if (ast[0].content === 'defn'){   return new Defn(ast); }
      if (ast[0].content === 'lambda'){ return new Lambda(ast); }
      return new Invocation(ast);
    } else {
      if (ast.type === 'number'){ return new NumberLiteral(ast); }
      if (ast.type === 'string'){ return new StringLiteral(ast); }
      if (ast.type === 'word'){ return new Lookup(ast); }
    }
    throw Error('what even is this? '+ast);
  }

  function lineInfo(ast){
    if (ast === undefined){ return undefined; }
    return {lineStart : ast.lineStart,
            lineEnd   : ast.lineEnd,
            colStart  : ast.colStart,
            colEnd    : ast.colEnd};
  }

  function Null(ast){
    // Special because ast isn't required
    this.ast = ast;
    if (ast && (ast.length !== 2 || ast[0].content !== '(' || ast[1].content !== ')')){
      throw Error("huh? doesn't look like a null node:", ast);
    }
  }
  Null.prototype.eval = function(env){ return null; };
  Null.prototype.compile = function(){ return [[BC.LoadConstant, null, lineInfo(this.ast)]]; };

  function Begin(ast){
    if (ast[0].content !== 'begin' && ast[0].content !== 'do'){ err('freak out', ast); }
    if (ast.length < 2){ err('do expressions with no statements not yet implemented', ast); }
    this.expressions = ast.slice(1).map( a => build(a) );
  }
  Begin.prototype.eval = function(env){ return this.expressions.map( expr => expr.eval(env)).pop(); };
  Begin.prototype.compile = function(){
    var code = [];
    for (var expr of this.expressions){
      code = [].concat(code, expr.compile(), [[BC.Pop, null, lineInfo(expr.ast)]]);
    }
    code.pop();  // don't need pop for last expression
    return code;
  };

  function If(ast){
    if (ast[0].content !== 'if'){ err('freak out', ast); }
    if (ast.length < 3){ err('Empty if body', ast); }
    if (ast.length > 4){ err('To many bodies for if', ast); }
    this.ast = ast;
    this.condition = build(ast[1]);
    this.ifBody = build(ast[2]);
    this.elseBody = ast[3] ? build(ast[3]) : new Null();
  }
  If.prototype.eval = function(env){
    if (this.condition.eval(env)){
      return this.ifBody.eval(env);
    } else {
      return this.elseBody.eval(env);
    }
  };
  If.prototype.compile = function(env){
    var condition = this.condition.compile();
    var ifBody = this.ifBody.compile();
    var elseBody = this.elseBody === undefined ? [] : this.elseBody.compile();
    var skipFalse = this.elseBody === undefined ? [] : [[BC.Jump, elseBody.length]];
    return [].concat(condition, [[BC.JumpIfNot, ifBody.length+skipFalse.length]],
      ifBody, skipFalse, elseBody);
  };

  function SetBang(ast){
    if (ast[0].content !== 'set!'){ err('freak out', ast); }
    if (ast.length !== 3){ err('set! requires ast two args', ast); }
    if (ast[1].type !== 'word'){ err('first argument to set! should be a name', ast); }
    this.ast = ast;
    this.name = ast[1].content;
    this.body = build(ast[2]);
  }
  SetBang.prototype.eval = function(env){
    var value = this.body.eval(env);
    env.set(this.name, value);
    return value;
  };
  SetBang.prototype.compile = function(){
    var body = this.body.compile(this.ast);
    return [].concat(body, [[BC.Store, this.name, lineInfo(this.ast)]]);
  };

  function Define(ast){
    if (ast[0].content !== 'define'){ err('freak out', ast); }
    if (ast.length < 2){ err('define requires ast least one arg', ast); }
    if (ast.length > 3){ err('define takes two arguments at most', ast); }
    if (ast[1].type !== 'word'){ err('first argument to define should be a name', ast); }
    this.name = ast[1].content;
    this.body = ast.length === 3 ? build(ast[2]) : undefined;
  }
  Define.prototype.eval = function(env){
    return env.define(this.name, this.body === undefined ? undefined : this.body.eval(env));
  };
  Define.prototype.compile = function(){
    var bodyCode = this.body ? this.body.compile(this.body) : new NullNode().compile();
    return [].concat(bodyCode, [[BC.StoreNew, this.name, lineInfo(this.ast)]]);
  };

  function Invocation(ast){
    if (ast[0].type !== 'word'){ err('function calls cannot start with expressions', ast); }
    this.ast = ast;
    this.head = new FunctionLookup(ast[0]);
    this.args = ast.slice(1).map( a => build(a) );
  }
  Invocation.prototype.eval = function(env){
    var func = this.head.eval(env);
    var argValues = this.args.map(node => node.eval(env));
    if (typeof func === 'function'){
      return func.apply(null, argValues);
    } else {
      return func.run(argValues);
    }
  };
  Invocation.prototype.compile = function() {
    var loadfunc = this.head.compile();
    var loadargs = [].concat.apply([], this.args.map( x => x.compile()));
    return [].concat(loadfunc, loadargs, [[BC.FunctionCall, this.args.length, lineInfo(this.ast)]]);
  };


  function NumberLiteral(ast){
    this.ast = ast;
    this.number = ast.content;
  }
  NumberLiteral.prototype.eval = function(env){ return this.number; };
  NumberLiteral.prototype.compile = function(){
    return [[BC.LoadConstant, this.number, lineInfo(this.ast)]];
  };

  function StringLiteral(ast){
    this.ast = ast;
    this.string = ast.content;
  }
  StringLiteral.prototype.eval = function(env){ return this.string; };
  StringLiteral.prototype.compile = function(){
    return [[BC.LoadConstant, this.string, lineInfo(this.ast)]];
  };

  function Lookup(ast){
    this.ast = ast;
    this.name = ast.content;
  }
  Lookup.prototype.eval = function(env){ return env.lookup(this.name); };
  Lookup.prototype.compile = function(){
    return [[BC.NameLookup, this.name, lineInfo(this.ast)]];
  };

  function FunctionLookup(ast){
    this.ast = ast;
    this.name = ast.content;
  }
  FunctionLookup.prototype.eval = function(env){ return env.lookup(this.name); };
  FunctionLookup.prototype.compile = function(){
    return [[BC.FunctionLookup, this.name, lineInfo(this.ast)]];
  };

  function err(msg, ast){
    e = Error(msg);
    e.ast = ast;
    var program = (typeof window === 'undefined' ? global : window).program;
    if (program){
      console.log(program.split('\n').slice(ast.lineStart-1, ast.lineEnd));
    }
    throw e;
  }



  function compile(ast){
    var code = build(ast).compile();
    Object.freeze(code);
    return code;
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
