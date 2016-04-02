// Let's write a lisp!
// But we'll hamstring it to make code reloading easier:
// named functions exist in a global namespace.
//

;(function() {
  'use strict';

  function tokenize(s) {
    var lines = s.split('\n');
    var tokens = [];
    var word;
    for (var lineno=1; lineno<=lines.length; lineno++){
      var line = lines[lineno-1];
      word = '';
      for (var col=1; col<=line.length; col++){
        var chr = line[col-1];
        if(chr === ';'){
          tokens.push({type: 'comment', content: line.slice(col-1),
                       lineStart: lineno, lineEnd: lineno,
                       colStart: col, colEnd: line.length});
          break;
        }
        if(/\s|[()]/.test(chr)){
          if (word){
            tokens.push({type: 'word', content: word,
                         lineStart: lineno, lineEnd: lineno,
                         colStart: col-word.length, colEnd: col});
            word = '';
          }
          if (/[()]/.test(chr)){
            tokens.push({type: chr === '(' ? 'lparen' : 'rparen', content: chr,
                         lineStart: lineno, lineEnd: lineno,
                         colStart: col, colEnd: col+1});
          }
        } else {
          word += chr;
          continue;
        }
      }
    }
    if (word){
        // lots of -1's because we're off the edge of the program
        tokens.push({type: 'word', content: word,
                     lineStart: lineno-1, lineEnd: lineno-1,
                     colStart: col-word.length-1, colEnd: col-1});
    }

    return tokens;
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
    var cur;
    do {
      cur = tokens.shift();
      if (cur === undefined) {
        throw new Error("forgot to close something?");
      }
    } while (cur.type === 'comment');
    if (cur.content === '(') {
      var form = [];
      while (true) {
        var f = innerParse(tokens);
        if (f === ')') {
            return form;
        }
        form.push(f);
      }
    } else if (cur.content === ')') {
      return ')';
    } else if (/^[+-]?\d*[.]?\d+$/.test(cur.content)) {
      cur.type = 'number';
      cur.content = parseFloat(cur.content);
      return cur;
    } else {
      return cur; // passthrough for identifiers and keywords
    }
  }

  function justContent(ast){
    if (Array.isArray(ast)){
      return ast.map(justContent);
    }
    if (!ast.hasOwnProperty('content')){
      throw Error('justContent called on non-token: '+ast);
    }
    return ast.content;
  }

  function Function(body, params, env, name){
    if (name === undefined){
      name = null; // anonymous function
    }
    this.name = name;      // string
    this.body = body;      // ast with linenos
    this.params = params;  // list of tokens with linenos
  }
  Function.prototype.diff = function(other){
    return  (JSON.stringify(justContent(this.body)) !== JSON.stringify(justContent(other.body)) ||
             JSON.stringify(justContent(this.params)) !== JSON.stringify(justContent(other.params)));
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
    function isDefn(form){
      return Array.isArray(form) && form[0] === 'defn';
    }
    function formDiff(form1, form2){
      if (isDefn(form1) && isDefn(form2)){
        if (form1[1] !== form2[1]){
          return true;  // name is different
        }
        if (form1.slice(1, -1).length !== form2.slice(1, -1).length){
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

    var isDifferent = formDiff(justContent(this.body), justContent(other.body));
    return isDifferent;
  };

  function findFunctions(ast){
    // Return new Function objects that we'll swap out
    // Function objects will have environments of null
    //
    // By default will count the top level function as its own
    var funcs = {};
    if (!Array.isArray(ast)){
      return {};
    }
    if (ast[0].content === 'defn'){
      var func = new Function(ast[ast.length-1], ast.slice(2, -1), null, ast[1].content);
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
    // doesn't include deleted functions, though eventually should so snapshots can be discarded
    //
    // If the only thing about a defn ast that has changed is
    // another defn ast, don't count it.
    var different = {};
    for (var name in oldFuncs){
      if (!(name in newFuncs)){
        //different[name] = null;
      } else if (oldFuncs[name].diffExceptDefnBodies(newFuncs[name])){
        different[name] = newFuncs[name];
      }
    }
    return different;
  }

  //console.log(tokenize(`;hello\n(+ 123 (- 2 3))`));
  //console.log(justContent(tokenize(`;hello\n(+ 1 (- 2 3))`)));
  //console.log(parse(`;hello\n(+ 123 (- 2 3))`));
  //console.log(justContent(parse(`;hello\n(+ 123 (- 2 3))`)));

  parse.tokenize = tokenize;
  parse.parse = parse;
  parse.justContent = justContent;
  parse.Function = Function;
  parse.diffFunctions = diffFunctions;
  parse.findFunctions = findFunctions;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = parse;
    }
  } else {
    window.parse = parse;
  }
})();
