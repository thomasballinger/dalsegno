'use strict';
var chai = require('chai');
var assert = chai.assert;

var tokenize = require('./parse.js').tokenize;
var parse = require('./parse.js').parse;

describe('parse', function(){
  describe('tokenize', function(){
    it('should tokenize simple literals', function(){
      assert.deepEqual(tokenize('+'), ['+']);
      assert.deepEqual(tokenize('1.2'), ['1.2']);
      assert.deepEqual(tokenize('2'), ['2']);
      assert.deepEqual(tokenize('"asdf"'), ['"asdf"']);
    });
    it('should tokenize nested structures', function(){
      assert.deepEqual(tokenize('("asdf")'), ["(", '"asdf"', ")"]);
      assert.deepEqual(tokenize('(+ 1 2)'), ["(", "+", "1", "2", ")"]);
      assert.deepEqual(tokenize('(+ (thing 1 2))'), ["(", "+", "(", "thing", "1", "2", ")", ")"]);
      assert.deepEqual(tokenize('(+ (thing 1 2) (other 3 4))'),
                   ['(', '+', '(', 'thing', '1', '2', ')', '(', 'other', '3', '4', ')', ')']);
    });
    /*
    it('should tokenize several words in quotes as one token', function(){
      assert.deepEqual(tokenize('"asdf asdf asdf"'), ['"asfd asdf asdf"']);
    });
    */
  });
  describe('parse', function(){
    it('should parse nested forms', function(){
      assert.deepEqual(parse('(+ (thing 1 2) (other 3 "4"))'),
                       ['+', ['thing', 1, 2], ['other', 3, '"4"']])
    });
    it('should return throw an error when parse fails', function(){
      assert.deepEqual(parse('(+ 1 2)'), ['+', 1, 2]);
      assert.throw(function(){parse('(+ 1 2');}, Error);
      assert.throw(function(){parse('+ 1 2)');}, Error);
    });
  });
  describe('findFunctions', function(){
    it('should build a function object', function(){
      var ast = parse('(defn foo 1)');
      var functions = parse.findFunctions(ast);
      assert.deepEqual(functions, {'foo': new parse.Function(1, [], null, 'foo')});
    });
    it('should return a hash of all defn asts', function(){
      var ast = parse('(do (defn foo 1) (defn bar x (do (defn baz x) (defn qux 2))))');
      var functions = parse.findFunctions(ast);
      assert.deepEqual(functions, {'foo': new parse.Function(1, [], null, 'foo'),
                                   'bar': new parse.Function(
                  ['do',
                    ['defn', 'baz', 'x'],
                    ['defn', 'qux', 2]], ['x'], null, 'bar'),
                                   'baz': new parse.Function('x', [], null, 'baz'),
                                   'qux': new parse.Function(2, [], null, 'qux')});
    });
  });
  describe('diffFunctions', function(){
    it('should identify that functions have changed', function(){
      var ast1 = parse('(do (defn baz x) (defn qux 2))');
      var ast2 = parse('(do (defn baz y) (defn qux 2))');
      var functions1 = parse.findFunctions(ast1);
      var functions2 = parse.findFunctions(ast2);
      var changedFunctions = parse.diffFunctions(functions1, functions2);
      assert.deepEqual(changedFunctions, {'baz': new parse.Function('y', [], null, 'baz')});
    });
    it('should return only functions that have themselves changed', function(){
      var ast1 = parse('(defn bar x (do (defn baz x) (defn qux 2)))');
      var ast2 = parse('(defn bar x (do (defn baz y) (defn qux 2)))');
      var functions1 = parse.findFunctions(ast1);
      var functions2 = parse.findFunctions(ast2);
      assert.isFalse(functions1['bar'].diffExceptDefnBodies(functions2['bar']));
      var changedFunctions = parse.diffFunctions(functions1, functions2);
      assert.deepEqual(changedFunctions, {'baz': new parse.Function('y', [], null, 'baz')});
    });
  });
});
