;(function() {
  'use strict';

  function numToHex(n){
    var s = n.toString(16);
    if (s.length == 1){
      s = '0' + s;
    }
    return s;
  }

  var DrawHelpers = function(canvasContext, canvas){
    this.ctx = canvasContext;
    this.canvas = canvas;
  };
  DrawHelpers.prototype.drawInverseCircle = function(x, y, r){
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, 2 * Math.PI);
    this.ctx.rect(this.canvas.width, 0, -(this.canvas.width), this.canvas.height);
    this.ctx.fill();
  };
  DrawHelpers.prototype.drawArc = function(x, y, r, start, end){
    if (start === undefined){
      start = 0;
    }
    if (end === undefined){
      end = 2 * Math.PI;
    }
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, start * Math.PI / 180, end * Math.PI / 180, true);
    this.ctx.closePath();
    this.ctx.fill();
  };
  DrawHelpers.prototype.drawPoly = function(x, y, points, h){
    points = points.map(function(arr){
      var dx = arr.get(0), dy = arr.get(1);
      return [x + dx * Math.cos(h * Math.PI / 180) - dy * Math.sin(h * Math.PI / 180),
              y + dx * Math.sin(h * Math.PI / 180) + dy * Math.cos(h * Math.PI / 180)];
    }).toArray();
    this.ctx.beginPath();
    this.ctx.moveTo(points[0][0], points[0][1]);
    for (var i = 1; i < points.length; i++){
      this.ctx.lineTo(points[i][0], points[i][1]);
    }
    this.ctx.closePath();
    this.ctx.fill();
  };
  DrawHelpers.prototype.drawText = function(x, y){
    var args = Array.prototype.slice.call(arguments, 2);
    var text = args.join(" ");
    var oldFill = this.ctx.fillStyle;
    this.ctx.fillStyle = '#808080';
    this.ctx.font="30px Verdana";
    this.ctx.fillText(text, x, y);
    this.ctx.fillStyle = oldFill;
  };
  DrawHelpers.prototype.color = function(r, g, b){
    if (r === undefined || g === undefined || b === undefined){
      throw new Error("not enough arguments to color");
    }
    var color = "#" + numToHex(r) + numToHex(g) + numToHex(b);
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = color;
  };
  DrawHelpers.prototype.render = function(){
    //TODO put a fps limit here? Wait for animation frame or something?
    this.ctx.trigger();
  };

  DrawHelpers.DrawHelpers = DrawHelpers;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = DrawHelpers;
    }
  } else {
    window.DrawHelpers = DrawHelpers;
  }
})();
