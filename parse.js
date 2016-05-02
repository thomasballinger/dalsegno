// Let's write a lisp!
// But we'll hamstring it to make code reloading easier:
// named functions exist in a global namespace.
//

;(function() {
  'use strict';

  function err(msg, ast){
    console.log('error ast:', ast);
    var e = Error(msg);
    e.ast = ast;
    throw e;
  }

  function tokenize(s) {
    var lines = s.split('\n');
    var tokens = [];
    var word;
    var inString = false;
    for (var lineno=1; lineno<=lines.length; lineno++){
      var line = lines[lineno-1];

      word = '';
      for (var col=1; col<=line.length; col++){
        var chr = line[col-1];
        if(inString){
          if (chr === '"'){
            word += chr;
            tokens.push({type: 'string', content: word.slice(1, -1),
                         linesStart: lineno, lineEnd: lineno,
                         colStart: col-word.length, colEnd: col});
            inString = false;
            word = '';
          } else {
            word += chr;
          }
          continue;
        }
        if(chr === '"' && word === ''){
          inString = true;
          word += chr;
          continue;
        }
        if(chr === ';'){
          tokens.push({type: 'comment', content: line.slice(col-1),
                       lineStart: lineno, lineEnd: lineno,
                       colStart: col, colEnd: line.length});
          break;
        }
        if(chr === '"'){
          inString = true;
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
                         colStart: col, colEnd: col});
          }
        } else {
          word += chr;
          continue;
        }
      }
      if (inString){
        // unclosed string
        err("unclosed string literal!", {lineStart: lineno, lineEnd: lineno,
                                         colStart: col-1, colEnd: col});
      }
      if (word){
          // some -1's because we're off the edge of the line
          tokens.push({type: 'word', content: word,
                       lineStart: lineno, lineEnd: lineno,
                       colStart: col-word.length, colEnd: col-1});
          word = '';
      }
      tokens.push({type: 'newline', content: '\n',
                   lineStart: lineno, lineEnd: lineno+1,
                   colStart: col, colEnd: 0});
    }
    if (word){
        // lots of -1's because we're off the edge of the program
        tokens.push({type: 'word', content: word,
                     lineStart: lineno-1, lineEnd: lineno-1,
                     colStart: col-word.length-1, colEnd: col-1});
    }
    // initial and final newlines are not required
    while (tokens.length > 0 && tokens[tokens.length - 1].type === 'newline'){ tokens.pop(); }
    while (tokens.length > 0 && tokens[0].type === 'newline'){ tokens.shift(); }

    return tokens;
  }

  function parse(s) {
    if (typeof s !== 'string') {
      throw Error("pass a string to parse, not tokens");
    }
    var tokensLeft = tokenize(s);
    var allTokens = tokenize(s);
    Object.freeze(allTokens);
    var programExpressions = [];
    maybeConsumeNewlines(tokensLeft);
    while (true){
      var expression = innerParse(tokensLeft, allTokens);
      programExpressions.push(expression);
      if (tokensLeft.length === 0){ break; }
      maybeConsumeComment(tokensLeft);
      consumeNewline(tokensLeft);
      maybeConsumeNewlines(tokensLeft);
      if (tokensLeft.length === 0){ break; }
    }
    if (tokensLeft.length !== 0) {
      err("Didn't finish parse, leftover: "+justContent(s));
    }
    return programExpressions;
  }

  function consumeNewline(s){
    var cur = s.shift();
    if (cur.type === 'newline'){
      return;
    }
    console.log(s);
    throw err("expected newline between expressions", cur);
  }

  function maybeConsumeNewlines(s){
    while (s.length > 0){
      var cur = s.shift();
      if (cur.type !== 'newline'){
        s.unshift(cur);
        break;
      }
    }
  }

  function maybeConsumeComment(s){
    if (s[0].type === 'comment'){
      s.shift();
    }
  }

  /** mutates tokens, should be given a copy */
  function firstUnclosedParenFromBack(tokens){
    var level = 0;
    var t;
    while (level >= 0){
      t = tokens.pop();
      if (t === undefined){
        throw Error('unclosed paren not found');
      }
      if (t.type === 'rparen'){ level++; }
      if (t.type === 'lparen'){ level--; }
    }
    return t;
  }

  function innerParse(tokens, allTokens) {
    var cur;
    do {
      cur = tokens.shift();
      if (cur === undefined) {
        //TODO find unclosed paren to highlight
        err("unmatched parenthesis", firstUnclosedParenFromBack(allTokens.slice(0)));
      }
    } while (cur.type === 'comment' || cur.type === 'newline');
    if (cur.type === 'lparen') {
      var form = [];
      while (true) {
        var f = innerParse(tokens, allTokens);
        if (f.type === 'rparen') {
          if (form.length !== 0){
            form.lineStart = form[0].lineStart;
            form.lineEnd = f.lineEnd;
            form.colStart = form[0].colStart;
            form.colEnd = f.colEnd;
          }
          return form;
        }
        form.push(f);
      }
    } else if (cur.type === 'rparen') {
      return cur;
    } else if (cur.type === 'word' && /^[+-]?\d*[.]?\d+$/.test(cur.content)) {
      cur.type = 'number';
      cur.content = parseFloat(cur.content);
      return cur;
    } else {
      return cur; // passthrough for identifiers and keywords
    }
  }

  /** Returns the content fields of something*/
  function justContent(ast){
    if (ast === undefined){ return undefined; }
    if (Array.isArray(ast)){
      return ast.map(justContent);
    }
    if (!ast.hasOwnProperty('content')){
      console.log(ast);
      throw Error('justContent called on non-token (no content property): '+ast);
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
    this.env = env;
  }
  Function.prototype.toString = function(){
    console.log('the scary thing to print:', this.body);
    return 'λ('+this.params+'): '+justContent(this.body);
  };
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
        if (form1[2].length !== form2[2].length){
          return true;  // number of parameters is different
        }
        for (var i = 0; i < form1[2].length; i++){
          if (form1[2][i] !== form2[2][i]){
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
  Function.prototype.buildScope = function(args){
    if (this.params.length != args.length){
      throw Error("Calling function "+this.name+" with wrong arity! Expected " +
             this.params.length + " params but got " + args.length);
    }
    var scope = {};
    for (var i = 0; i < args.length; i++){
      if (!this.params[i].hasOwnProperty('content')){
        debugger;
      }
      scope[this.params[i].content] = args[i];
    }
    return scope;
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
    if (ast.length > 0 && ast[0].content === 'defn'){
      var func = new Function(ast.slice(3), ast[2], null, ast[1].content);
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
  parse.safelyParses = safelyParses;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = parse;
    }
  } else {
    window.parse = parse;
  }
})();
