'use strict';

function Builtin(){};
Builtin.prototype.getFunctions = function(){
  var self = this;
  var bind = (function(methodName){
    return (function(){
      var args = Array.prototype.slice.call(arguments);
      console.log('calling function')
      console.log(self[methodName]);
      console.log('with')
      console.log(args);
      return self[methodName].apply(self, args);
    })
  });
  var methods = {};
  for (var m in this) {
    if (typeof this[m] == "function") {
      methods[m] = bind(m);
    }
  }
  return methods;
}
function Gamelib(canvasId){
  this.canvas = document.getElementById(canvasId);
  this.ctx = canvas.getContext('2d');
}
Gamelib.prototype = new Builtin();
Gamelib.prototype.width = function(){
  return this.canvas.width;
}
Gamelib.prototype.height = function(){
  return this.canvas.height;
}
Gamelib.prototype.drawRect = function(x, y, width, height){
  this.ctx.fillRect(x, y, width, height);
}
Gamelib.prototype.clear = function(){
  this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
}
Gamelib.prototype.clearDrawRect = function(x, y, width, height){
  this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  this.ctx.fillRect(x, y, width, height);
}
