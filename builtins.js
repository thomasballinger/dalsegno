;(function() {
  var builtins = {
    '+': function(){
      return Array.prototype.slice.call(arguments).reduce(function(a, b){
        return a + b}, 0)
    },
    'display': function(){
      return console.log.apply(console, Array.prototype.slice.call(arguments));
    },
    '>': function(a, b){ return (a > b); },
    '<': function(a, b){ return (a < b); },
    '=': function(a, b){ return (a === b); },
    '*': function(a, b){ return a * b; },
    '/': function(a, b){ return a / b; },
    'list': function(){ return Array.prototype.slice.call(arguments); },
    'nth': function(arr, i){
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
        throw Error("append first arg is not an array: "+arr);
      }
      return arr.concat([item]);
    },
    'dist': function(p1, p2, x2, y2){
      // works with 2 or 4 arguments
      if (x2 === undefined && y2 == undefined) {
        var x1 = p1[0];
        var y1 = p1[1];
        var x2 = p2[0];
        var y2 = p2[1];
      } else {
        var x1 = p1;
        var y1 = p2;
      }
      return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
    },
    'length': function(arr){
      if (!Array.isArray(arr)){
        throw Error("append first arg is not an array: "+arr);
      }
      return arr.length;
    }
  }

  builtins.builtins = builtins;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = builtins;
    }
  } else {
    this.builtins = builtins;
  }
})();
