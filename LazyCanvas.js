;(function() {
  'use strict';

  function LazyCanvas(canvasId, lazy){
    if (lazy === undefined){
      lazy = false;
    }
    this.canvas = document.getElementById(canvasId);
    this.ctx = canvas.getContext('2d');
    this.lazy = lazy;
    this.operations = [];

    for (var property in this.ctx){
      this[property] = function(property){
        return function(){
          var method = this.ctx[property];
          var args = Array.prototype.slice.call(arguments);
          if (method.length !== args.length){
            throw Error(method+' called with '+args.length+' parameters, expected '+method.length);
          }
          this.operations.push([method, args]);
          if (this.lazy){
            this.trigger();
          }
        };
      }(property);
    }
  }
  LazyCanvas.prototype.trigger = function(){
    while (this.operations.length){
      var operation = this.operations.shift();
      console.log("running", operation);
      operation[0].apply(this.ctx, operation[1]);
    }
  };

  LazyCanvas.LazyCanvas = LazyCanvas;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = LazyCanvas;
    }
  } else {
    window.LazyCanvas = LazyCanvas;
  }
})();
