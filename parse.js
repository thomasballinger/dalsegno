// Let's write a lisp!
// But we'll hamstring it to make code reloading easier:
// named functions exist in a global namespace.
//

;(function() {
  'use strict';

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
  Function.prototype.diff = function(other){
    return  (JSON.stringify(this.body) !== JSON.stringify(other.body) ||
             JSON.stringify(this.params) !== JSON.stringify(other.params));
  };

  function tokenize(s) {
    s = s.replace(/[;].*$/mg, '');
    var token = /[()]|[^\s()]+/g;
    return s.match(token);
  }

  function parse(s) {
    if (typeof s === 'string') {
      s = tokenize(s);
    }
    var result = innerParse(s);
    if (s.length !== 0) {
      throw new Error("Didn't finish parse of "+s);
    }
    return result;
  }

  function innerParse(tokens) {
    var cur = tokens.shift();
    if (cur === undefined) {
      throw new Error("forgot to close something?");
    }
    if (cur === '(') {
      var form = [];
      while (true) {
        var f = innerParse(tokens);
        if (f === ')') {
            return form;
        }
        form.push(f);
      }
    } else if (cur === ')') {
      return ')';
    } else if (/^[+-]?\d*[.]?\d+$/.test(cur)) {
      return parseFloat(cur);
    } else {
      return cur; // passthrough for identifiers and keywords
    }
  }

  function findFunctions(ast){
    // Return new Function objects that we'll swap out
    // Function objects will have environments of null
    // If the only thing about a defn ast that has changed is
    //
    var funcs = {};
    if (!Array.isArray(ast)){
      return {};
    }
    if (ast[0] === 'defn'){
      var func = new Function(ast[ast.length-1], ast.slice(2, -1), null, ast[1]);
      funcs[func.name] = func;
    }
    for (var i = 0; i < ast.length; i++){
      var form = ast[i];
      var innerFuncs = findFunctions(form);
      for (var prop in innerFuncs) {
        if (innerFuncs[prop] in funcs){
          throw Error('trying to add function '+prop+' twice!');
        }
        funcs[prop] = innerFuncs[prop];
      }
    }
    return funcs;
  }

  function diffFunctions(oldFuncs, newFuncs){
    // returns an array of functions that have changed
    // doesn't include new functions, because that would have changed the ast of an ourside function.
    // does include deleted functions, which need to be removed
    //
    // TODO don't include outer defn that changed defns are inside!
    var different = {};
    for (var name in oldFuncs){
      if (!(name in newFuncs)){
        different[name] = null;
      } else if (oldFuncs[name].diff(newFuncs[name])){
        different[name] = newFuncs[name];
      }
    }
    return different;
  }

  var safelyParses = function(program, errback){
    if (errback === undefined){
      errback = function(msg){console.log(msg);};
    }
    try {
      parse(program);
      return true;
    } catch (e) {
      errback(e);
      return false;
    }
  };


  parse.parse = parse;
  parse.tokenize = tokenize;
  parse.Function = Function;
  parse.findFunctions = findFunctions;
  parse.diffFunctions = diffFunctions;
  parse.safelyParses = safelyParses;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = parse;
    }
  } else {
    window.parse = parse;
  }
})();
