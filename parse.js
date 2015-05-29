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
  Function.prototype.diffExceptDefnBodies = function(other){
    // Whether two functions differ other than in internal function bodies
    // both functions must have the same name
    if (this.name !== other.name){
      throw new Error("Tried to diff two functions with different names: "+this.name+" and "+other.name);
    }
    if (!this.diff(other)){
      return false;
    }
    if (JSON.stringify(this.params) !== JSON.stringify(other.params)){
      return true;
    }

    function isDefn(form){
      return Array.isArray(form) && form[0] === 'defn';
    }

    function formDiff(form1, form2){
      if (isDefn(form1) && isDefn(form2)){
        if (form1[1] !== form2[1]){
          return true;  // name is different
        }
        if (form1.slice(1, -1).length !== form2.slice(1, -1)){
          return true;  // number of parameters is different
        }
        for (var i = 0; i < form1.slice(1, -1).length; i++){
          if (form1.slice(1, -1)[i] !== form2.slice(1, -1)[i]){
            return true;  // name of parameter is different
          }
        }
        return false;  // only the named function bodies are different!
      } else if (Array.isArray(form1) && Array.isArray(form2)) {
        if (form1.length !== form2.length){
          return true;
        }
        for (var i = 0; i < form1.length; i++){
          if (formDiff(form1[i], form2[i])){
            return true;
          }
        }
        return false;
      } else {
        return form1 !== form2;
      }
    }

    var isDifferent = formDiff(this.body, other.body);
    return isDifferent;
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
    // 
    // By default will count the top level function as its own
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
    // If the only thing about a defn ast that has changed is
    // another defn ast, don't count it.
    var different = {};
    for (var name in oldFuncs){
      if (!(name in newFuncs)){
        different[name] = null;
      } else if (oldFuncs[name].diffExceptDefnBodies(newFuncs[name])){
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
