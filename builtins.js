;(function() {
  'use strict';

  var require;
  if (typeof window === 'undefined') {
    require = module.require;
  } else {
    require = function(name){
      var realname = name.match(/(\w+)[.]?j?s?$/)[1];
      return window[realname];
    };
  }
  var Immutable = require('./Immutable.js');

  function arityCheck(args, n){
    //TODO add typechecks
    //TODO link to docs for function that was bad
    if (!Array.isArray(n)){
      if (args.length != n){
        throw Error("Wrong number of arguments, expected "+n+" but found "+args.length+".");
      }
      return;
    }
    var minArgs = Math.min.apply(null, n);
    var maxArgs = Math.max.apply(null, n);
    if (args.length < minArgs){
      throw Error("Not enough arguments, at least "+minArgs+" are required.");
    }
    if (args.length > maxArgs){
      throw Error("Too many arguments, expected at most "+maxArgs);
    }
    if (n.indexOf(args.length) === -1){
      throw Error("Wrong number of arguments");
    }
  }

  var builtins = Immutable.Map({
    '+': function(){
      return Array.prototype.slice.call(arguments).reduce(function(a, b){
        return a + b;
      }, 0);
    },
    '-': function(a, b){ arityCheck(arguments, 2); return (a - b); },
    '>': function(a, b){ arityCheck(arguments, 2); return (a > b); },
    '<': function(a, b){ arityCheck(arguments, 2); return (a < b); },
    '=': function(a, b){ arityCheck(arguments, 2); return (a === b); },
    '*': function(a, b){ arityCheck(arguments, 2); return a * b; },
    '/': function(a, b){ arityCheck(arguments, 2); return a / b; },
    '%': function(a, b){
      arityCheck(arguments, 2);
      if (!(a % 1 === 0)){
        throw Error('first modulus argument not an integer: '+a);
      }
      if (!(b % 1 === 0)){
        throw Error('second modulus argument not an integer: '+b);
      }
      while (a < 0){
        a += b;
      }
      return a % b;
    },
    'or': function(a, b){ arityCheck(arguments, 2);  return a || b; },
    'and': function(a, b){ arityCheck(arguments, 2); return a && b; },
    'not': function(x) { arityCheck(arguments, 1); return !x;},
    'list': function(){ return Immutable.List(Array.prototype.slice.call(arguments)); },
    'any': function(arr){
      arityCheck(arguments, 1);
      if(!Immutable.List.isList(arr)){
        throw Error("argument to any is not a list: "+arr);
      }
      for (var i = 0; i < arr.count(); i++){
        if (arr.get(i)){
          return true;
        }
      }
      return false;
    },
    'nth': function(i, arr){
      arityCheck(arguments, 2);
      if(!Immutable.List.isList(arr)){
        throw Error("second argument to any is not a list: "+arr);
      }
      if(i>=arr.count()){
        throw Error("Index error: "+i+" "+array);
      }
      return arr.get(i);
    },
    'first': function(arr){
      arityCheck(arguments, 1);
      if(!Immutable.List.isList(arr)){
        throw Error("argument to first is not a list: "+arr);
      }
      if(arr.count() < 1){
        throw Error("Index error: "+0+" "+array);
      }
      return arr.first();
    },
    'last': function(arr){
      arityCheck(arguments, 1);
      if(!Immutable.List.isList(arr)){
        throw Error("argument to last is not a list: "+arr);
      }
      if(arr.count() < 1){
        throw Error("called last on empty list: "+arr);
      }
      return arr.get(arr.count() - 1);
    },
    'rest': function(arr){
      arityCheck(arguments, 1);
      if(!Immutable.List.isList(arr)){
        throw Error("Index error: "+i+" "+arr);
      }
      return arr.rest();
    },
    'concat': function(){
      var args = Array.prototype.slice.call(arguments);
      for (var i = 0; i++; i<list.count()){
        if (!Immutable.List.isList(list[i])){
          throw Error("Concat arguments are not all lists: "+list[i]);
        }
      }
      var l = Immutable.List();
      return l.concat.apply(l, args);
    },
    'append': function(arr, item){
      arityCheck(arguments, 2);
      if (!Immutable.List.isList(arr)){
        throw Error("append first arg is not a list: "+JSON.stringify(arr));
      }
      return arr.push(item);
    },
    'prepend': function(arr, item){
      arityCheck(arguments, 2);
      if (!Immutable.List.isList(arr)){
        throw Error("prepend second arg is not a list: "+JSON.stringify(arr));
      }
      return arr.unshift(item);
    },
    'cons': function(item, arr){
      arityCheck(arguments, 2);
      if (!Immutable.List.isList(arr)){
        throw Error("prepend second arg is not a list: "+JSON.stringify(arr));
      }
      return arr.unshift(item);
    },

    'zip': function(arr1, arr2){
      arityCheck(arguments, 2);
      if (!Immutable.List.isList(arr1) || !Immutable.List.isList(arr2)){
        throw Error("prepend second arg is not a list: "+JSON.stringify(arr1)+JSON.stringify(arr2));
      }
      var comb = Immutable.List();
      for (var i=0; i<Math.min(arr1.count(), arr2.count()); i++){
        comb = comb.push(Immutable.List([arr1.get(i), arr2.get(i)]));
      }
      return comb;
    },

    // gamey stuff
    'dist': function(p1, p2, x2, y2){
      arityCheck(arguments, [2, 4]);
      // works with 2 or 4 arguments
      var x1, y1;
      if (x2 === undefined && y2 === undefined) {
        x1 = p1.get(0);
        y1 = p1.get(1);
        x2 = p2.get(0);
        y2 = p2.get(1);
      } else {
        x1 = p1;
        y1 = p2;
      }
      return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
    },
    'length': function(arr){
      arityCheck(arguments, 1);
      if (!Immutable.List.isList(arr)){
        throw Error("length arg is not a list: "+arr);
      }
      return arr.count();
    },
    'randint': function(lower, upper){
      arityCheck(arguments, [1, 2]);
      if (upper === undefined){
        upper = lower;
        lower = 0;
      }
      return lower + Math.floor(Math.random() * (upper - lower));
    },
    'range': function(n){
      arityCheck(arguments, 1);
      return Immutable.List(Immutable.Range(0, n));
    },
    'towards': function(p1, p2, x2, y2){
      arityCheck(arguments, [2, 4]);
      // works with 2 or 4 arguments
      var x1, y1;
      if (x2 === undefined && y2 === undefined) {
        x1 = p1.get(0);
        y1 = p1.get(1);
        x2 = p2.get(0);
        y2 = p2.get(1);
      } else {
        x1 = p1;
        y1 = p2;
      }
      var dx = x2 - x1;
      var dy = y2 - y1;
      return ((Math.atan2(dx, -dy) * 180 / Math.PI) + 270 + 360) % 360;
    },
    'x_comp': function(h){
      arityCheck(arguments, 1);
      return Math.cos(h * Math.PI / 180);
    },
    'y_comp': function(h){
      arityCheck(arguments, 1);
      return Math.sin(h * Math.PI / 180);
    },
    'jsSet': function(obj, prop, value){
      arityCheck(arguments, 3);
      if (obj === undefined || prop === undefined || value === undefined){
        throw Error("jsSet needs three arguments");
      }
      obj[prop] = value;
    },
    'jsGet': function(obj, prop){
      arityCheck(arguments, 2);
      if (obj === undefined || prop === undefined){
        throw Error("jsGet needs two arguments");
      }
      var val = obj[prop];
      if (typeof val === 'function'){
        val = val.bind(obj);
      }
      return val;
    }
  });

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = builtins;
    }
  } else {
    window.builtins = builtins;
  }
})();
