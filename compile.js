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
    FunctionTailCall : 13,
  };

  /** Construct a program builder for a list of expressions */
  function buildProgram(ast){
    return new Program(ast);
  }

  /** Construct a builder for an ast, with whether in tail position */
  function build(ast, itp){
    if (itp === undefined){
      throw Error('build needs two arguments');
    }

    if (Array.isArray(ast)){
      if (ast.length === 0){            return new Null(ast, itp); }
      if (ast[0].content === 'begin'){  return new Begin(ast, itp); }
      if (ast[0].content === 'do'){     return new Begin(ast, itp); }
      if (ast[0].content === 'if'){     return new If(ast, itp); }
      if (ast[0].content === 'set!'){   return new SetBang(ast, itp); }
      if (ast[0].content === 'define'){ return new Define(ast, itp); }
      if (ast[0].content === 'defn'){   return new Defn(ast, itp); }
      if (ast[0].content === 'lambda'){ return new Lambda(ast, itp); }
      return new Invocation(ast, itp);
    } else {
      // these don't care about being in the tail position
      if (ast.type === 'number'){ return new NumberLiteral(ast, itp); }
      if (ast.type === 'string'){ return new StringLiteral(ast, itp); }
      if (ast.type === 'word'){ return new Lookup(ast, itp); }
    }
    console.log(ast);
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
    if (ast && ast.length !== 0){
      throw Error("huh? doesn't look like a null node:", ast);
    }
  }
  Null.prototype.eval = function(env){ return null; };
  Null.prototype.compile = function(){ return [[BC.LoadConstant, null, lineInfo(this.ast)]]; };

  function Program(ast){
    if (!Array.isArray(ast)){ throw Error("Program consists of a list of expressions"); }
    this.ast = ast;
    this.expressions = [].concat(ast.slice(0, -1).map( a => build(a, false) ),
                                 ast.slice(-1   ).map( a => build(a, true ) ));
  }
  Program.prototype.eval = function(env){ return this.expressions.map( expr => expr.eval(env)).pop(); };
  Program.prototype.compile = function(){
    var code = [];
    for (var expr of this.expressions){
      code = [].concat(code, expr.compile(), [[BC.Pop, null, lineInfo(expr.ast)]]);
    }
    code.pop();  // don't need pop for last expression
    return code;
  };

  function Begin(ast, itp){
    if (ast[0].content !== 'begin' && ast[0].content !== 'do'){ err('freak out', ast); }
    if (ast.length < 2){ err('do expressions with no statements not yet implemented', ast); }
    this.ast = ast;
    this.itp = itp;
    this.expressions = [].concat(ast.slice(1, -1).map( a => build(a, false) ),
                                 ast.slice(-1   ).map( a => build(a, this.itp ) ));
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

  function If(ast, itp){
    if (ast[0].content !== 'if'){ err('freak out', ast); }
    if (ast.length < 3){ err('Empty if body', ast); }
    if (ast.length > 4){ err('To many bodies for if', ast); }
    this.ast = ast;
    this.itp = itp;
    this.condition = build(ast[1], false);
    this.ifBody = build(ast[2], itp);
    this.elseBody = ast[3] ? build(ast[3], itp) : new Null();
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
    return [].concat(condition, [[BC.JumpIfNot, ifBody.length+skipFalse.length, lineInfo(this.ast[0])]],
      ifBody, skipFalse, elseBody);
  };

  function SetBang(ast, itp){
    if (ast[0].content !== 'set!'){ err('freak out', ast); }
    if (ast.length !== 3){ err('set! requires ast two args', ast); }
    if (ast[1].type !== 'word'){ err('first argument to set! should be a name', ast); }
    this.ast = ast;
    this.itp = itp; // but this won't propagate
    this.name = ast[1].content;
    this.body = build(ast[2], false);
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

  function Define(ast, itp){
    if (ast[0].content !== 'define'){ err('freak out', ast); }
    if (ast.length < 2){ err('define requires at least one arg', ast); }
    if (ast.length > 3){ err('define takes two arguments at most', ast); }
    if (ast[1].type !== 'word'){ err('first argument to define should be a name', ast); }
    this.ast = ast;
    this.itp = itp; // but this won't propagate
    this.name = ast[1].content;
    this.body = ast.length === 3 ? build(ast[2], false) : undefined;
  }
  Define.prototype.eval = function(env){
    var value = this.body === undefined ? undefined : this.body.eval(env);
    env.define(this.name, value);
    return value;
  };
  Define.prototype.compile = function(){
    var bodyCode = this.body ? this.body.compile(this.body) : new Null().compile();
    return [].concat(bodyCode, [[BC.StoreNew, this.name, lineInfo(this.ast)]]);
  };

  function Defn(ast, itp){
    if (ast[0].content !== 'defn'){ err('freak out', ast); }
    if (ast.length < 4){ err('defn needs params and at least one body expression', ast); }
    if (ast[1].type !== 'word'){ err('first arg to defn should be a name', ast); }
    if (!Array.isArray(ast[2])){ err('defn needs parameters (or empty ())', ast); }
    ast[2].forEach( x => {
      if (x.type !== 'word'){
        err('arguments should be symbols, not expressions', ast);
      }
    });
    this.ast = ast;
    this.itp = itp; // but this won't propagate
    this.name = ast[1].content;
    this.params = ast[2].map( x => x.content );
    // body of a function is always in tail position
    this.bodyAST = ast.slice(2);
    this.expressions = [].concat(ast.slice(3, -1).map( a => build(a, false) ),
                                 ast.slice(-1   ).map( a => build(a, true ) ));
  }
  Defn.prototype.eval = function(env){
      return env.makeEvalNamedFunction(this.expressions, this.params, env);
  };
  Defn.prototype.compile = function(){
    var code = [];
    for (var expr of this.expressions){
      code = [].concat(code, expr.compile(), [[BC.Pop, null, lineInfo(expr.ast)]]);
    }
    code.pop();  // don't need pop for last expression
    code.push([BC.Return, null, lineInfo(this.ast)]);
    return [
        [BC.Push, code, lineInfo(this.ast)],
        [BC.Push, this.params, lineInfo(this.ast)],
        [BC.BuildFunction, this.name, lineInfo(this.ast)],
        [BC.StoreNew, this.name, lineInfo(this.ast)]
    ];
  };

  function Lambda(ast, itp){
    if (ast[0].content !== 'lambda'){ err('freak out', ast); }
    if (ast.length < 3){ err('lambda needs params and at least one body expressions', ast); }
    if (!Array.isArray(ast[1])){ err('lambda needs parameters (or empty ())', ast); }
    ast[1].forEach( x => {
      if (x.type !== 'word'){
        err('arguments should be symbols, not expressions', ast);
      }
    });
    this.ast = ast;
    this.itp = itp;  // but this won't propagate
    this.params = ast[1].map( x => x.content );
    this.bodyAST = ast.slice(2);
    // function body is always in tail position
    this.expressions = [].concat(ast.slice(2, -1).map( a => build(a, false) ),
                                 ast.slice(-1   ).map( a => build(a, true ) ));
  }
  Lambda.prototype.eval = function(env){
    return env.makeEvalLambda(this.expressions, this.params, null);
  };
  Lambda.prototype.compile = function(env){
    var code = [];
    for (var expr of this.expressions){
      code = [].concat(code, expr.compile(), [[BC.Pop, null, lineInfo(expr.ast)]]);
    }
    code.pop();  // don't need BC.Pop for last expression
    code.push([BC.Return, null, lineInfo(this.ast)]);
    return [
      [BC.Push, code, lineInfo(this.bodyAST)],
      [BC.Push, this.params, lineInfo(this.ast)],
      [BC.BuildFunction, null, lineInfo(this.ast)]];
  };

  function Invocation(ast, itp){
    if (ast[0].type === 'word'){
      this.head = new FunctionLookup(ast[0], false);
    } else {
      this.head = build(ast[0], false);
    }
    this.ast = ast;
    this.itp = itp;
    this.args = ast.slice(1).map( a => build(a, false) );
  }
  Invocation.prototype.eval = function(env){
    var func = this.head.eval(env);
    var argValues = this.args.map(node => node.eval(env));
    if (typeof func === 'function'){
      return func.apply(null, argValues);
    } else {
      if (this.args.length !== func.params.length){
          throw Error('Function called with wrong arity! Takes ' +
                       func.params.length + ' args, given ' + this.args.length);
      }
      var scope = {};
      this.args.forEach( (_, i) => { scope[func.params[i]] = argValues[i]; });
      var invocationEnv = func.env.newWithScope(scope);
      return func.body.map( expr => expr.eval(invocationEnv)).pop();
      //TODO do TCO in interpreter as well
    }
  };
  Invocation.prototype.compile = function() {
    var loadfunc = this.head.compile();
    var loadargs = [].concat.apply([], this.args.map( x => x.compile()));
    var CallBC = this.itp ? BC.FunctionTailCall : BC.FunctionCall;
    return [].concat(loadfunc, loadargs, [[CallBC, this.args.length, lineInfo(this.ast)]]);
  };


  function NumberLiteral(ast, itp){
    this.ast = ast;
    this.itp = itp; // but this won't propagate
    this.number = ast.content;
  }
  NumberLiteral.prototype.eval = function(env){ return this.number; };
  NumberLiteral.prototype.compile = function(){
    return [[BC.LoadConstant, this.number, lineInfo(this.ast)]];
  };

  function StringLiteral(ast, itp){
    this.ast = ast;
    this.itp = itp; // but this won't propagate
    this.string = ast.content;
  }
  StringLiteral.prototype.eval = function(env){ return this.string; };
  StringLiteral.prototype.compile = function(){
    return [[BC.LoadConstant, this.string, lineInfo(this.ast)]];
  };

  function Lookup(ast, itp){
    this.ast = ast;
    this.itp = itp; // but this won't propagate
    this.name = ast.content;
  }
  Lookup.prototype.eval = function(env){ return env.lookup(this.name); };
  Lookup.prototype.compile = function(){
    return [[BC.NameLookup, this.name, lineInfo(this.ast)]];
  };

  function FunctionLookup(ast, itp){
    this.ast = ast;
    this.itp = itp; // but this won't propagate
    this.name = ast.content;
  }
  FunctionLookup.prototype.eval = function(env){ return env.lookup(this.name); };
  FunctionLookup.prototype.compile = function(){
    return [[BC.FunctionLookup, this.name, lineInfo(this.ast)]];
  };

  function err(msg, ast){
    var e = Error(msg);
    e.ast = ast;
    var program = (typeof window === 'undefined' ? global : window).program;
    if (program){
      console.log(program.split('\n').slice(ast.lineStart-1, ast.lineEnd));
    }
    throw e;
  }

  /** Compiles a program which expects to be run with an environment
   * and will decref that environment once finished */
  function compileProgram(ast){
    var code = buildProgram(ast).compile();
    console.log('compile program output:', code);
    Object.freeze(code);
    return code;
  }

  function compileFunctionBody(ast){
    if (!Array.isArray(ast)){ throw Error("function ast should be a list of expressions"); }
    var code = [];

    var expressions = [].concat(ast.slice(0, -1).map( a => build(a, false) ),
                                ast.slice(-1   ).map( a => build(a, true ) ));
    for (var expr of expressions){
      code = [].concat(code, expr.compile(), [[BC.Pop, null, lineInfo(expr.ast)]]);
    }
    code.pop();  // don't need pop for last expression
    code.push([BC.Return, null, {
      lineStart: ast[0].lineStart, lineEnd: ast[ast.length-1].lineEnd,
      colStart:  ast[0].colStart,  colEnd: ast[ast.length-1].colEnd}]);
    Object.freeze(code);
    return code;
  }

  function evaluateAST(ast, env){
    return buildProgram(ast).eval(env);
  }

  compile.compileProgram = compileProgram;
  compile.compileFunctionBody = compileFunctionBody;
  compile.evaluateAST = evaluateAST;
  compile.BC = BC;
  compile.build = build;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = compile;
    }
  } else {
    window.compile = compile;
  }
})();
