'use strict';

var Immutable = require('../Immutable.js');

function MouseTracker(canvasId){
  var self = this;
  this.canvas = document.getElementById(canvasId);
  var mouse = this.mouse = {x: 0, y: 0};
  var mousedown = this.mousedown = [false];
  var lastClick = this.lastClick = [0];

  Object.defineProperty(this, '_is_nondeterministic', {
    enumerable: false,
    value: true
  });

  this.canvas.addEventListener('mousemove', function(e){
    var rect = self.canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  }, false);
  this.canvas.addEventListener('mousedown', function(e){
    mousedown[0] = true;
    lastClick[0] = (new Date()).getTime();
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
//TODO save and restore mouse position for rewinds
MouseTracker.prototype.mousepos = function(){
  return Immutable.List([this.mouse.x, this.mouse.y]);
};
MouseTracker.prototype.mousex = function(){
  return this.mouse.x;
};
MouseTracker.prototype.mousey = function(){
  return this.mouse.y;
};
MouseTracker.prototype.clicked = function(){
  if (this.mousedown[0]){
    return true;
  }
  // This way even at 20 FPS a click is certain to be picked up
  var now = (new Date()).getTime();
  if (now - this.lastClick[0] < 50){
    this.lastClick[0] = 0;
    return true;
  }
  return false;
};

MouseTracker.MouseTracker = MouseTracker;

module.exports = MouseTracker;
