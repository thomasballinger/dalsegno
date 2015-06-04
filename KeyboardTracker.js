;(function() {
  'use strict';

  function KeyboardTracker(canvasId){
    var canvas = document.getElementById(canvasId);
    var keysDown = this.keysDown = {};
    var hasFocus = this.hasFocus = [true];

    document.addEventListener('mousedown', function(e){
      if (e.target === canvas){
        hasFocus[0] = true;
      } else {
        hasFocus[0] = false;
      }
    }, false);
    document.addEventListener('keydown', function(e){
      if (hasFocus[0]){
        keysDown[e.which] = true;
      }
    }, false);
    document.addEventListener('keyup', function(e){
      keysDown[e.which] = false;
    }, false);
  }
  KeyboardTracker.prototype.keyPressed = function(key){
    return this.keysDown[key];
  };

  KeyboardTracker.KeyboardTracker = KeyboardTracker;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = KeyboardTracker;
    }
  } else {
    window.KeyboardTracker = KeyboardTracker;
  }
})();
