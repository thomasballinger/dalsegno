;(function() {
  'use strict';

  function KeyboardTracker(canvasId){
    var canvas = document.getElementById(canvasId);
    var keysDown = this.keysDown = {};
    var hasFocus = this.hasFocus = [true];
    Object.defineProperty(this, '_is_nondeterministic', {
      enumerable: false,
      value: true
    });

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
        if (keysDown[224] ||
            keysDown[91] ||
            keysDown[93] ||
            keysDown[17]){
              // This way cmd-r for refresh etc. stil gets through
        } else {
          e.preventDefault();
        }
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
