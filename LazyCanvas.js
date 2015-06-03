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
      if (typeof this.ctx[property] === 'function'){
        this[property] = function(property){
          return function(){
            var method = this.ctx[property];
            var args = Array.prototype.slice.call(arguments);
            if (method.length !== args.length){
              throw Error(method+' called with '+args.length+' parameters, expected '+method.length);
            }
            this.operations.push([method, args]);
            if (!this.lazy){
              this.trigger();
            }
          };
        }(property);
      } else if (this.ctx.__lookupSetter__(property) || this.ctx.__lookupGetter__(property)) {
        var getter = this.ctx.__lookupGetter__(property);
        var setter = this.ctx.__lookupSetter__(property);
        (function(getter, setter, property){
          self = this;
          var descriptors = {};
          if (getter){
            descriptors.get = function(){
              self.trigger();
              self.operations.push([getter, []]);
              return self.trigger();
            };
          } else {
            descriptors.get = function(){
              self.trigger();
              var simpleGetter = function(){
                return this[property];
              };
              self.operations.push([simpleGetter, []]);
              return self.trigger();
            };
          }
          if (setter) {
            descriptors.set = function(value){
              self.operations.push([setter, [value]]);
            };
          } else {
            descriptors.set = function(value){
              var simpleSetter = function(value){
                this[property] = value;
                return value;
              };
              self.operations.push(simpleSetter, []);
            };
          }
          Object.defineProperty(this, property, descriptors);
        }).call(this, getter, setter, property);
      }
    }
  }
  LazyCanvas.prototype.trigger = function(){
    var returnValue;
    while (this.operations.length){
      var operation = this.operations.shift();
      returnValue = operation[0].apply(this.ctx, operation[1]);
    }
    return returnValue;
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
