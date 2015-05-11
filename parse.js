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

  function tokenize(s) {
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
    // Returns a map of names to {name, ast, params}
    //
    // Return new Function objects that we'll swap out
  }

  parse.parse = parse;
  parse.tokenize = tokenize;
  parse.Function = Function

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = parse;
    }
  } else {
    window.parse = parse;
  }
})();
