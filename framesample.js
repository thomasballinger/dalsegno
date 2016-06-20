;(function() {
  'use strict';

  function makeRandomSampler(targetNumFrames){
    return function(frames){
      var targetNumFrames = 100;
      var newFrames = [];
      for (var i = 0; i < frames.length; i++){
        if (Math.random() < targetNumFrames / frames.length){
          newFrames.push(frames[i]);
        }
      }
      return newFrames;
    };
  }

  function makeSlowFastSlowSampler(targetNumFrames){
    return function(frames){
    };
  }

  var samplers = {};
  samplers.makeRandomSampler = makeRandomSampler;
  samplers.makeSlowFastSlowSampler = makeSlowFastSlowSampler;


  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = samplers;
    }
  } else {
    window.framesample = samplers;
  }
})();
