'use strict';
var chai = require('chai');
var assert = chai.assert;

var framesample = require('./framesample.js');

function range(start, end){
  if (end === undefined){
    end = start;
    start = 0;
  }
  var l = [];
  for (var i=start; i<end; i++){
    l.push(i);
  }
  return l;
}

function ordinals(n){
  return range(1, n+1);
}

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
  });
  describe('accelSample', ()=>{
    assert.deepEqual(framesample.accelSample(range(6), 3), [0, 1, 3]);
  });
  describe('accelDecelSampler', ()=>{
    function takeN(input, n, expected){
      var sampler = framesample.makeAccelDecelSampler(n);
      var result = sampler(input);
      assert.deepEqual(result, expected);
    }
    it('uses all frames if target num less that input', ()=>{
      takeN([1, 4, 6, 10, 12, 13], 10, [1, 4, 6, 10, 12, 13]);
      takeN(ordinals(7), 9, ordinals(7));
      takeN(ordinals(7), 7, ordinals(7));
    });
    it('skips appropriately for simple cases', ()=>{
      takeN(ordinals(1), 1, [1]);
      takeN(ordinals(7), 5, [1, 2, 4, 6, 7]);
      takeN(ordinals(13), 7, [1, 2, 4, 7, 10, 12, 13]);
    });
    it('respects length', ()=>{
      var sampler = framesample.makeAccelDecelSampler(10);
      assert.equal(sampler(range(100)).length, 10);
    });
  });
});
