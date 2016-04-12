'use strict';
var chai = require('chai');
var assert = chai.assert;


var parse = require('./parse.js').parse;
var tokenize = parse.tokenize;
var jc = parse.justContent;

describe('parse', function(){
  describe('tokenize', function(){
    it('should tokenize simple literals', function(){
      assert.deepEqual(jc(tokenize('+')), ['+']);
      assert.deepEqual(jc(tokenize('1.2')), ['1.2']);
      assert.deepEqual(jc(tokenize('2')), ['2']);
      assert.deepEqual(jc(tokenize('"asdf"')), ['asdf']);
      assert.deepEqual(jc(tokenize('"asdf"\n"asdf"')), ['asdf', '\n', 'asdf']);
    });
    it('should tokenize nested structures', function(){
      assert.deepEqual(jc(tokenize('("asdf")')), ["(", 'asdf', ")"]);
      assert.deepEqual(jc(tokenize('(+ 1 2)')), ["(", "+", "1", "2", ")"]);
      assert.deepEqual(jc(tokenize('(+ (thing 1 2))')), ["(", "+", "(", "thing", "1", "2", ")", ")"]);
      assert.deepEqual(jc(tokenize('(+ (thing 1 2) (other 3 4))')),
                   ['(', '+', '(', 'thing', '1', '2', ')', '(', 'other', '3', '4', ')', ')']);
    });
    it('should tokenize strings without quotes', function(){
      assert.deepEqual(jc(tokenize('"asdf"')), ['asdf']);
    });
    it('should tokenize several words in quotes as one token', function(){
      assert.deepEqual(jc(tokenize('"asdf asdf asdf"')), ['asdf asdf asdf']);
    });
  });
  describe('parse', function(){
    it('should parse nested forms', function(){
      assert.deepEqual(jc(parse('(+ (thing 1 2) (other 3 "4"))')),
                       [['+', ['thing', 1, 2], ['other', 3, '4']]]);
    });
    it('should parse newlines right', function(){
      var s = `
        (defn init-world
          (map (lambda i
                 (list
                   (list (randint 200) (randint 200))
                   (list (randint -5 6) (randint -5 6))))
               (range 10)))`;
      assert.equal(jc(parse(s))[0].length, 3);
    });
    it('should return throw an error when parse fails', function(){
      assert.deepEqual(jc(parse('(+ 1 2)')), [['+', 1, 2]]);
      assert.throw(function(){parse('(+ 1 2');}, Error);
      assert.throw(function(){parse('+ 1 2)');}, Error);
    });
  });
  describe('findFunctions', function(){
    it('should build a function object', function(){
      var ast = parse('(defn foo () 1)');
      var functions = parse.findFunctions(ast);
      Object.keys(functions).forEach(function(name){
        functions[name].body = jc(functions[name].body);
        functions[name].params = jc(functions[name].params);
      });
      assert.deepEqual(functions, {'foo': new parse.Function([1], [], null, 'foo')});
    });
    it('should return a hash of all defn asts', function(){
      var ast = parse('(do (defn foo () 1) (defn bar (x) (do (defn baz () x) (defn qux () 2))))');
      var functions = parse.findFunctions(ast);
      Object.keys(functions).forEach(function(name){
        functions[name].body = jc(functions[name].body);
        functions[name].params = jc(functions[name].params);
      });
      assert.deepEqual(functions, {'foo': new parse.Function([1], [], null, 'foo'),
                                   'bar': new parse.Function(
                  [['do',
                     ['defn', 'baz', [], 'x'],
                     ['defn', 'qux', [], 2]]], ['x'], null, 'bar'),
                                   'baz': new parse.Function(['x'], [], null, 'baz'),
                                   'qux': new parse.Function([2], [], null, 'qux')});
    });
  });
  describe('diffFunctions', function(){
    it('should identify that functions have changed', function(){
      var ast1 = parse('(do (defn baz () x) (defn qux () 2))');
      var ast2 = parse('(do (defn baz () y) (defn qux () 2))');
      var functions1 = parse.findFunctions(ast1);
      var functions2 = parse.findFunctions(ast2);
      var changedFunctions = parse.diffFunctions(functions1, functions2);
      assert.deepEqual(Object.keys(changedFunctions), ['baz']);
      assert.deepEqual(jc(changedFunctions['baz'].body), ['y']);
    });
    it('should return only functions that have themselves changed', function(){
      var ast1 = parse('(defn bar (x) (do (defn baz () x) (defn qux () 2)))');
      var ast2 = parse('(defn bar (x) (do (defn baz () y) (defn qux () 2)))');
      var functions1 = parse.findFunctions(ast1);
      var functions2 = parse.findFunctions(ast2);
      assert.isFalse(functions1['bar'].diffExceptDefnBodies(functions2['bar']));
      var changedFunctions = parse.diffFunctions(functions1, functions2);
      assert.deepEqual(Object.keys(changedFunctions), ['baz']);
      assert.deepEqual(jc(changedFunctions['baz'].body), ['y']);
    });
  });
});
