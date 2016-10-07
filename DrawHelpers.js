'use strict';
var Immutable = require('./Immutable.js');

var CSS_COLOR_NAMES = ["AliceBlue", "AntiqueWhite", "Aqua", "Aquamarine", "Azure", "Beige", "Bisque", "Black", "BlanchedAlmond", "Blue", "BlueViolet", "Brown", "BurlyWood", "CadetBlue", "Chartreuse", "Chocolate", "Coral", "CornflowerBlue", "Cornsilk", "Crimson", "Cyan", "DarkBlue", "DarkCyan", "DarkGoldenRod", "DarkGray", "DarkGrey", "DarkGreen", "DarkKhaki", "DarkMagenta", "DarkOliveGreen", "Darkorange", "DarkOrchid", "DarkRed", "DarkSalmon", "DarkSeaGreen", "DarkSlateBlue", "DarkSlateGray", "DarkSlateGrey", "DarkTurquoise", "DarkViolet", "DeepPink", "DeepSkyBlue", "DimGray", "DimGrey", "DodgerBlue", "FireBrick", "FloralWhite", "ForestGreen", "Fuchsia", "Gainsboro", "GhostWhite", "Gold", "GoldenRod", "Gray", "Grey", "Green", "GreenYellow", "HoneyDew", "HotPink", "IndianRed", "Indigo", "Ivory", "Khaki", "Lavender", "LavenderBlush", "LawnGreen", "LemonChiffon", "LightBlue", "LightCoral", "LightCyan", "LightGoldenRodYellow", "LightGray", "LightGrey", "LightGreen", "LightPink", "LightSalmon", "LightSeaGreen", "LightSkyBlue", "LightSlateGray", "LightSlateGrey", "LightSteelBlue", "LightYellow", "Lime", "LimeGreen", "Linen", "Magenta", "Maroon", "MediumAquaMarine", "MediumBlue", "MediumOrchid", "MediumPurple", "MediumSeaGreen", "MediumSlateBlue", "MediumSpringGreen", "MediumTurquoise", "MediumVioletRed", "MidnightBlue", "MintCream", "MistyRose", "Moccasin", "NavajoWhite", "Navy", "OldLace", "Olive", "OliveDrab", "Orange", "OrangeRed", "Orchid", "PaleGoldenRod", "PaleGreen", "PaleTurquoise", "PaleVioletRed", "PapayaWhip", "PeachPuff", "Peru", "Pink", "Plum", "PowderBlue", "Purple", "Red", "RosyBrown", "RoyalBlue", "SaddleBrown", "Salmon", "SandyBrown", "SeaGreen", "SeaShell", "Sienna", "Silver", "SkyBlue", "SlateBlue", "SlateGray", "SlateGrey", "Snow", "SpringGreen", "SteelBlue", "Tan", "Teal", "Thistle", "Tomato", "Turquoise", "Violet", "Wheat", "White", "WhiteSmoke", "Yellow", "YellowGreen"];
var CSS_COLOR_NAMES_LOWERCASE = CSS_COLOR_NAMES.map( s => s.toLowerCase() );

function numToHex(n){
  n = parseInt(n);
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
/** works with 1, 2, or 4 arguments */
DrawHelpers.prototype.fillLine = function(){
  var args = Array.prototype.slice.call(arguments);
  var points = [];
  if (args.length === 1){
    args[0].toArray().forEach( l => {
      if (!Immutable.List.isList(l) || l.count() !== 2){
        console.log(Immutable.List.isList(l));
        console.log(l.count());
        throw Error("fillLine takes points, got: "+l);
      }
      points.push([l.get(0), l.get(1)]);
    });
  } else if (typeof args[0] === 'number'){
    if (args.length % 2 !== 0){
      console.log(args);
      throw Error('fillLine needs x, y, x, y... pairs, got an x without a y');
    }
    for (var i=0; i<args.length; i+=2){
      if (typeof args[i] !== 'number' || typeof args[i+1] !== 'number'){
        console.log(args);
        throw Error('fillLine needs numbers as arguments, got non-number');
      }
      points.push([args[i], args[i+1]]);
    }
  } else {
    args.forEach(function(arr, i){
      if (!Immutable.List.isList(arr) || arr.count() !== 2){
        throw Error('argument #'+i+' in drawPoly points is not a 2-element list: '+arr.toJS());
      }
      points.push([arr.get(0), args.get(1)]);
    });
  }
  this.ctx.beginPath();
  this.ctx.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach( point => this.ctx.lineTo(point[0], point[1]) );
  this.ctx.stroke();
};
DrawHelpers.prototype.drawPoly = function(x, y, points, h){
  if (!Immutable.List.isList(points)){
    throw Error('3rd argument to drawPoly should be a list of 2-element lists');
  }
  points.forEach(function(arr, i){
    if (!Immutable.List.isList(arr) || arr.count() !== 2){
      throw Error('argument #'+i+' in drawPoly points is not a 2-element list: '+arr.toJS());
    }
  });
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
  var color;
  if (typeof r === 'string' && g === undefined && b === undefined){
    if (CSS_COLOR_NAMES_LOWERCASE.indexOf(r.toLowerCase()) === -1){
      throw Error(r+" is not a creative color");
    } else {
      color = r;
    }
  } else {
    if (r === undefined || g === undefined || b === undefined){
      throw new Error("not enough arguments for color");
    }
    if (r < 0 || r > 255){
      throw new Error("first argument to color (red)\nshould be between 0 and 255");
    }
    if (g < 0 || g > 255){
      throw new Error("second argument to color (green)\nshould be between 0 and 255");
    }
    if (b < 0 || b > 255){
      throw new Error("third argument to color (blue)\nshould be between 0 and 255");
    }
    color = "#" + numToHex(r) + numToHex(g) + numToHex(b);
  }

  this.ctx.fillStyle = color;
  this.ctx.strokeStyle = color;
};
DrawHelpers.prototype.render = function(){
  //TODO put a fps limit here? Wait for animation frame or something?
  this.ctx.trigger();
};

DrawHelpers.DrawHelpers = DrawHelpers;

module.exports = DrawHelpers;
