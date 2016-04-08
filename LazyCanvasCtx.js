;(function() {
  'use strict';

  function LazyCanvasCtx(canvasId, lazy, showFPS){
    if (lazy === undefined){
      lazy = false;
    }
    this.showFPS = showFPS || false;
    // important to give this a name that isn't a property on a ctx (like this.canvas)
    this.canvasElement = document.getElementById(canvasId);
    this.ctx = this.canvasElement.getContext('2d');
    this.lazy = lazy;
    this.operations = [];
    this.testCtx = document.createElement('canvas').getContext('2d');
    this.renderTimes = [];

    var self = this;

    for (var property in this.ctx){
      if (typeof this.ctx[property] === 'function'){
        this[property] = function(property){
          return function(){
            var method = this.ctx[property];
            var args = Array.prototype.slice.call(arguments);
            this.operations.push([method, args]);
            if (this.lazy){
              try {
                method.apply(this.testCtx, args);
              } catch (e) {
                this.operations = [];
                throw e;
              }
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
    if (this.showFPS){
      var t = new Date().getTime();
      this.renderTimes.push(new Date().getTime());
      while (this.renderTimes[0] < t-1000){
        this.renderTimes.shift();
      }
    }

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
    if (this.showFPS){
      var oldFont = this.ctx.font;
      var oldFillStyle = this.ctx.fillStyle;
      this.ctx.fillStyle = 'black';
      this.ctx.fillRect(this.canvasElement.width-100, 0, 100, 25);
      this.ctx.font = "20px sans-serif";
      this.ctx.fillStyle = 'blue';
      var fps = this.renderTimes.length ? this.renderTimes.length - 1 /
                                          (t - this.renderTimes[0] )
                                        : 0;
      this.ctx.fillText("fps: "+this.renderTimes.length,this.canvasElement.width-100, 20);
      this.ctx.font = oldFont;
      this.ctx.fillStyle = oldFillStyle;
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
