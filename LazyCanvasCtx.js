;(function() {
  'use strict';

  function LazyCanvasCtx(canvasId, lazy){
    if (lazy === undefined){
      lazy = false;
    }
    this.ctx = canvas.getContext('2d');
    this.lazy = lazy;
    this.operations = [];
    this.testCtx = document.createElement('canvas').getContext('2d');

    var self = this;

    for (var property in this.ctx){
      if (typeof this.ctx[property] === 'function'){
        this[property] = function(property){
          return function(){
            var method = this.ctx[property];
            var args = Array.prototype.slice.call(arguments);
            this.operations.push([method, args]);
            if (this.lazy){
              method.apply(this.testCtx, args);
            } else {
              this.trigger();
            }
          };
        }(property);
      } else if (this.ctx.__lookupSetter__(property) || this.ctx.__lookupGetter__(property)) {
        var getter = this.ctx.__lookupGetter__(property);
        var setter = this.ctx.__lookupSetter__(property);
        (function(getter, setter, property){
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
  LazyCanvasCtx.prototype.trigger = function(){
    var returnValue;
    try {
      while (this.operations.length){
        var operation = this.operations.shift();
        returnValue = operation[0].apply(this.ctx, operation[1]);
      }
    } catch (e) {
      this.operations = [];
      throw e;
    }
    return returnValue;
  };

  LazyCanvasCtx.LazyCanvasCtx = LazyCanvasCtx;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = LazyCanvasCtx;
    }
  } else {
    window.LazyCanvasCtx = LazyCanvasCtx;
  }
})();
