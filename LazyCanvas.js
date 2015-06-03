;(function() {
  'use strict';

  function LazyCanvas(canvasId){
    this.canvas = document.getElementById(canvasId);
    this.ctx = canvas.getContext('2d');
    this.lazy = false;
    this.operations = [];

    for (var property in this.ctx){
      this[property] = function(property){
        return function(){
          this.operations.push([this.ctx[property], Array.prototype.slice.call(arguments)]);
        };
      }(property);
    }
  }
  LazyCanvas.prototype.trigger = function(){
    while (this.operations.length){
      var operation = this.operations.shift();
      console.log("running", operation);
      operation[0].apply(this.ctx, operation[1])
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
