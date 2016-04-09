;(function() {
  'use strict';

  function MouseTracker(canvasId){
    var self = this;
    this.canvas = document.getElementById(canvasId);
    var mouse = this.mouse = {x: 0, y: 0};
    var mousedown = this.mousedown = [false];

    this.canvas.addEventListener('mousemove', function(e){
      var rect = self.canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    }, false);
    this.canvas.addEventListener('mousedown', function(e){
      mousedown[0] = true;
    }, false);
    this.canvas.addEventListener('mouseup', function(e){
      mousedown[0] = false;
    }, false);
    this.canvas.addEventListener('touchstart', function(e){
      mousedown[0] = true;
    }, false);
    this.canvas.addEventListener('touchend', function(e){
      mousedown[0] = false;
    }, false);
  }
  MouseTracker.prototype.mousepos = function(){
    return [this.mouse.x, this.mouse.y];
  };
  MouseTracker.prototype.mousex = function(){
    return this.mouse.x;
  };
  MouseTracker.prototype.mousey = function(){
    return this.mouse.y;
  };
  MouseTracker.prototype.clicked = function(){
    return this.mousedown[0];
  };

  MouseTracker.MouseTracker = MouseTracker;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = MouseTracker;
    }
  } else {
    window.MouseTracker = MouseTracker;
  }
})();
