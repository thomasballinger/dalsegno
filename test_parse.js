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
    })
    it('should tokenize nested structures', function(){
      assert.deepEqual(tokenize('("asdf")'), ["(", '"asdf"', ")"]);
      assert.deepEqual(tokenize('(+ 1 2)'), ["(", "+", "1", "2", ")"]);
      assert.deepEqual(tokenize('(+ (thing 1 2))'), ["(", "+", "(", "thing", "1", "2", ")", ")"]);
      assert.deepEqual(tokenize('(+ (thing 1 2) (other 3 4))'),
                   ['(', '+', '(', 'thing', '1', '2', ')', '(', 'other', '3', '4', ')', ')']);
    })
  });
  describe('parse', function(){
    it('parse nested forms', function(){
      assert.deepEqual(parse('(+ (thing 1 2) (other 3 "4"))'),
                       ['+', ['thing', 1, 2], ['other', 3, '"4"']])
    });
  });
});
