'use strict';
var chai = require('chai');
var assert = chai.assert;

var framesample = require('./framesample.js');

describe('frame samplers', ()=>{
  describe('randomSampler', ()=>{
    it('preserves all frames if target num less that input', ()=>{
      var input = [1, 4, 6, 10, 12, 13];
      var sampler = framesample.makeRandomSampler(10);
      assert.equal(sampler(input).length, input.length);
    });
  });
  describe('acceleratingSampler', ()=>{
    function takeN(input, n, expected){
      var sampler = framesample.makeAcceleratingSampler(n);
      var result = sampler(input);
      assert.deepEqual(result, expected);
    }
    it('uses all frames if target num less that input', ()=>{
      takeN([1, 4, 6, 10, 12, 13], 10, [1, 4, 6, 10, 12, 13]);
      takeN([1, 2, 3, 4, 5, 6, 7], 9, [1, 2, 3, 4, 5, 6, 7]);
      takeN([1, 2, 3, 4, 5, 6, 7], 7, [1, 2, 3, 4, 5, 6, 7]);
    });
    it('skips appropriately for removing triangular numbers', ()=>{
      takeN([1, 2, 3, 4, 5, 6, 7], 6, [1, 2, 3, 4, 5, 7]);
      takeN([1, 2, 3, 4, 5, 6, 7], 4, [1, 2, 4, 7]);
      takeN([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4, [1, 3, 6, 10]);
      takeN([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4, [1, 3, 6, 10]);
    });
    it('skips appropriately for removing non-triangular numbers', ()=>{
      takeN([1, 2, 3, 4, 5, 6, 7], 5, [1, 2, 3, 5, 7]);
    });
  });
  /*
  describe('fastSlowFastSampler', ()=>{
    it('preserves all frames if target num less that input', ()=>{
      var sampler = framesample.makeSlowFastSlowSampler(10);
      var input = [1, 4, 6, 10, 12, 13];
      assert.equal(sampler(input).length, input.length);
    });
    it('tosses the middleish ones', ()=>{
      function takeN(input, n, expected){
        var sampler = framesample.makeSlowFastSlowSampler(n);
        var result = sampler(input);
        assert.deepEqual(result, expected);
      }
      takeN([1, 2, 3, 4, 5, 6, 7], 9, [1, 2, 3, 4, 5, 6, 7]);
      takeN([1, 2, 3, 4, 5, 6, 7], 7, [1, 2, 3, 4, 5, 6, 7]);
      takeN([1, 2, 3, 4, 5, 6, 7], 5, [1, 2, 4, 6, 7]);
      takeN([1, 2, 3, 4, 5, 6, 7], 3, [1, 4, 7]);
      takeN([1, 2, 3, 4, 5, 6, 7], 2, [1, 7]);
      takeN([1, 2, 3, 4, 5, 6, 7], 4, [1, 3, 5, 7]);
    });
  });
  */
});
