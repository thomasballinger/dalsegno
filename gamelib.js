;(function() {
  'use strict';

  function Builtin(){}
  Builtin.prototype.getFunctions = function(){
    var self = this;
    var bind = (function(methodName){
      return (function(){
        var args = Array.prototype.slice.call(arguments);
        return self[methodName].apply(self, args);
      });
    });
    var methods = {};
    for (var m in this) {
      if (typeof this[m] == "function") {
        methods[m] = bind(m);
      }
    }
    return methods;
  };
  function Gamelib(canvasId){
    this.canvas = document.getElementById(canvasId);
    this.ctx = canvas.getContext('2d');
    this.toRender = [];
  }
  Gamelib.prototype = new Builtin();
  Gamelib.prototype.width = function(){
    return this.canvas.width;
  };
  Gamelib.prototype.height = function(){
    return this.canvas.height;
  };
  Gamelib.prototype.drawRect = function(x, y, width, height){
    var doIt = function(x, y, width, height){
      this.ctx.fillRect(x, y, width, height);
    };
    this.toRender.push([doIt, x, y, width, height]);
  };
  Gamelib.prototype.drawCircle = function(x, y, r){
    var doIt = function(x, y, r){
      this.ctx.beginPath();
      this.ctx.arc(x, y, r, 0, Math.PI*2, true); 
      this.ctx.closePath();
      this.ctx.fill();
    };
    this.toRender.push([doIt, x, y, r]);
  };
  Gamelib.prototype.color = function(r, g, b){
    function numToHex(n){
      var s = n.toString(16);
      if (s.length == 1){
        s = '0' + s;
      }
      return s;
    }
    var doIt = function(r, g, b){
      var color = "#" + numToHex(r) + numToHex(g) + numToHex(b);
      this.ctx.fillStyle = color;
      this.ctx.strokeStyle = color;
    };
    this.toRender.push([doIt, r, g, b]);
  };
  Gamelib.prototype.render = function(){
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (var i = 0; i < this.toRender.length; i++){
      var func = this.toRender[i][0];
      var args = this.toRender[i].slice(1);
      func.apply(this, args);
    }
    this.toRender = [];
  };

  Gamelib.Gamelib = Gamelib;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = Gamelib;
    }
  } else {
    window.Gamelib = Gamelib;
  }
})();
