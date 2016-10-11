'use strict';
var chai = require('chai');
var assert = chai.assert;

var humanize = require('./humanize.js');

describe('humanize', function(){
  describe('helpers', function(){
    describe('range', function(){
      it('work with 1 arg', function(){
        assert.deepEqual(humanize.range(3), [0, 1, 2]);
        assert.deepEqual(humanize.range(0), []);
      });
      it('work with 2 args', function(){
        assert.deepEqual(humanize.range(2, 3), [2]);
        assert.deepEqual(humanize.range(-2, 0), [-2, -1]);
      });
    });
    describe('sorted', function(){
      it('works with default key', function(){
        var orig = [2,1,3];
        assert.deepEqual(humanize.sorted(orig), [1, 2, 3]);
        assert.deepEqual(orig, [2, 1, 3]);
      });
      it('works with custom key', function(){
        var orig = ['asfd','a','asdfasdf'];
        assert.deepEqual(humanize.sorted(orig, x=>x.length),['a', 'asfd',  'asdfasdf']);
        assert.deepEqual(orig, ['asfd', 'a', 'asdfasdf']);
      });
    });
    describe('levenshtein', function(){
      it('calculates edit distance', function(){
        assert.equal(humanize.levenshtein('asdf', 'adf'), 1);
        assert.equal(humanize.levenshtein('asdf', 'aidf'), 1);
        assert.equal(humanize.levenshtein('asdf', 'asxdf'), 1);
        assert.equal(humanize.levenshtein('heighit', 'textarea'), 7);
        assert.equal(humanize.levenshtein('heigiht', 'keysDown'), 7);
      });
    });
  });
});
