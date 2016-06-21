;(function() {
  'use strict';

  /** Functions which, given a list of numbers, return a subset
   * of those numbers in the same order.
   * (or factories for such functions)
   */

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

  /**  */
  function accelSample(frames, sample){
    var interval = frames.length / triangle(sample);
    var newFrames = [frames[0]];
    var indexFloat = 0;
    var ahead = 0;
    for (var i=1; i<sample; i++){
      var inc = i * interval - ahead;
      if (i * interval < 1){
        ahead = (1 - inc);
        indexFloat += 1;
      } else {
        indexFloat += i * interval;
      }
      var index = Math.floor(indexFloat);
      newFrames.push(frames[Math.floor(indexFloat)]);
    }
    return newFrames;
  }
  function triangle(n){
    var t = 0;
    for (var i=0; i<n+1; i++){ t += i; }
    return t;
  }

  function makeAccelDecelSampler(targetNumFrames){
    return function accelDecelSample(frames){
      if (frames.length <= targetNumFrames){ return frames; }
      if (targetNumFrames === 0){ return []; }
      var n = frames.length;
      var m = targetNumFrames;
      var mid = Math.floor((frames.length - 1)/2);
      var mFront = Math.floor((m-1)/2);
      var mBack = Math.ceil((m-1)/2);

      var front = accelSample(frames.slice(0, mid), mFront);
      var middle = frames[mid];
      var back = frames.slice(mid+1);
      back.reverse();
      back = accelSample(back, mBack);
      back.reverse();

      return front.concat([middle], back);
    };
  }

  // cut in half, special case middle
  //
  // 101 -> 50 frames per half.
  // 100 -> 50 for one half, 49 for the other.
  //
  // How to fit 50 frames into 5 frames?
  //
  // solve t(5) * x = 50
  // 
  // 50 / 15 = interval of 3.33
  // So use frames 0, 3, 9, 19, 32
  //
  //
  /** an accelerating then decelerating effect */
  function makeAcceleratingSampler(targetNumFrames){
    return function(frames){
      if (frames.length <= targetNumFrames){ return frames; }
      if (targetNumFrames === 0){ return []; }
      if (targetNumFrames === 1){ return [frames[0]]; }
      if (targetNumFrames === 2){ return [frames[0], frames[frames.length-1]]; }

      // by this point there are at least 4 frames and we want 3 or more
      if (!(targetNumFrames >= 3 && frames.length >= 4)){ throw Error('assertion error'); }

      var n = frames.length;
      var m = targetNumFrames;
      // using increasing skips,
      // it's easy to remove 0, 1, 3, 6, 10, ... frames
      // (triangular numbers, OEIS A000217)
      // Let's find the largest triangular number t such that
      // n - t >= m
      var t = 0, i = 0;
      while(n - (t+i) >= m){
        t = t+i;
        i++;
      }
      var largestSkip = i-1;

      frames.reverse();
      var newFrames = [];
      var index = 0;
      for (i=largestSkip+1; i>0; i--){
        newFrames.push(frames[index]);
        index += i;
      }
      newFrames = newFrames.concat(frames.slice(index));
      //TODO now we should take every other from the front or something
      //until we have the target number
      newFrames.reverse();
      return newFrames;
    };
  }

  makeAcceleratingSampler(3)([1,2,3,4,5,6,7,8,9]);

  var samplers = {};
  samplers.makeRandomSampler = makeRandomSampler;
  samplers.makeAcceleratingSampler = makeAcceleratingSampler;
  samplers.makeAccelDecelSampler = makeAccelDecelSampler;
  samplers.accelSample = accelSample;


  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = samplers;
    }
  } else {
    window.framesample = samplers;
  }
})();
