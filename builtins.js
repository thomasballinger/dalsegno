;(function() {
  'use strict';

  var builtins = {
    '+': function(){
      return Array.prototype.slice.call(arguments).reduce(function(a, b){
        return a + b;
      }, 0);
    },
    '-': function(a, b){ return (a - b); },
    'display': function(){
      return console.log.apply(console, Array.prototype.slice.call(arguments));
    },
    '>': function(a, b){ return (a > b); },
    '<': function(a, b){ return (a < b); },
    '=': function(a, b){ return (a === b); },
    '*': function(a, b){ return a * b; },
    '/': function(a, b){ return a / b; },
    '%': function(a, b){
      if (!(a % 1 === 0)){
        throw Error('first modulus argument not an integer: '+b);
      }
      if (!(b % 1 === 0)){
        throw Error('second modulus argument not an integer: '+b);
      }
      while (a < 0){
        a += b;
      }
      return a % b;
    },
    'or': function(a, b){ return a || b; },
    'not': function(x){return !x;},
    'list': function(){ return Array.prototype.slice.call(arguments); },
    'nth': function(i, arr){
      if(!Array.isArray(arr)){
        throw Error("second argument to nth is not an array: "+array);
      }
      if(i>=arr.length){
        throw Error("Index error: "+i+" "+array);
      }
      return arr[i];
    },
    'first': function(arr){
      if(!Array.isArray(arr)){
        throw Error("argument to first is not an array: "+array);
      }
      if(arr.length < 1){
        throw Error("Index error: "+0+" "+array);
      }
      return arr[0];
    },
    'last': function(arr){
      if(!Array.isArray(arr)){
        throw Error("argument to last is not an array: "+array);
      }
      if(arr.length < 1){
        throw Error("called last on empty list: "+array);
      }
      return arr[arr.length - 1];
    },
    'rest': function(arr){
      if(!Array.isArray(arr)){
        throw Error("Index error: "+i+" "+array);
      }
      return arr.slice(1);
    },
    'concat': function(){
      var args = Array.prototype.slice.call(arguments);
      for (var i = 0; i++; i<list.length){
        if (!Array.isArray(list[i])){
          throw Error("Concat arguments are not all arrays: "+list[i]);
        }
      }
      return [].concat.apply([], args);
    },
    'append': function(arr, item){
      if (!Array.isArray(arr)){
        throw Error("append first arg is not an array: "+JSON.stringify(arr));
      }
      return arr.concat([item]);
    },
    'prepend': function(item, arr){
      if (!Array.isArray(arr)){
        throw Error("prepend second arg is not an array: "+JSON.stringify(arr));
      }
      return [item].concat(arr);
    },
    'dist': function(p1, p2, x2, y2){
      // works with 2 or 4 arguments
      var x1, y1;
      if (x2 === undefined && y2 === undefined) {
        x1 = p1[0];
        y1 = p1[1];
        x2 = p2[0];
        y2 = p2[1];
      } else {
        x1 = p1;
        y1 = p2;
      }
      return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
    },
    'length': function(arr){
      if (!Array.isArray(arr)){
        throw Error("length arg is not an array: "+arr);
      }
      return arr.length;
    },
    'randint': function(lower, upper){
      if (lower === undefined){
        throw Error("randint called with no arguments");
      }
      if (upper === undefined){
        upper = lower;
        lower = 0;
      }
      return lower + Math.floor(Math.random() * (upper - lower));
    },
    'range': function(n){
      if (n === undefined){
        throw Error("range called with no arguments");
      }
      var arr = [];
      for (var i = 0; i < n; i++){
        arr.push(i);
      }
      return arr;
    },
    'towards': function(p1, p2, x2, y2){
      // works with 2 or 4 arguments
      var x1, y1;
      if (x2 === undefined && y2 === undefined) {
        x1 = p1[0];
        y1 = p1[1];
        x2 = p2[0];
        y2 = p2[1];
      } else {
        x1 = p1;
        y1 = p2;
      }
      var dx = x2 - x1;
      var dy = y2 - y1;
      return ((Math.atan2(dx, -dy) * 180 / Math.PI) + 270 + 360) % 360;
    },
    'x_comp': function(h){
        return Math.cos(h * Math.PI / 180);
    },
    'y_comp': function(h){
        return Math.sin(h * Math.PI / 180);
    },
  };

  builtins.builtins = builtins;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = builtins;
    }
  } else {
    window.builtins = builtins;
  }
})();
