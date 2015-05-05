// Let's write a lisp!
// But we'll hamstring it to make code reloading easier:
// named functions exist in a global namespace.
//

;(function() {
  'use strict';

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

  parse.parse = parse;
  parse.tokenize = tokenize;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = parse;
    }
  } else {
    window.parse = parse;
  }
})();
