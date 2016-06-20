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
});
