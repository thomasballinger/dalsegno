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

  /**
   * When in lazy mode:
   * Method calls are recorded in this.operations
   * Calling trigger runs all of these method calls
   * Accessing a non-function property also runs these
   *   method calls and returns the property value
   * Method calls are run immediately on the this.testCtx
   *
   * When turning off lazy mode:
   * Queued operations are immediately run
   *
   * It makes sense to turn off lazy when stepping the interpreter,
   * but having it on makes drawing appear smoother.
   */
  function LazyCanvasCtx(canvasId, lazy, showFPS){
    if (lazy === undefined){
      lazy = false;
    }
    this.showFPS = showFPS || false;
    // important to give this a name that isn't a property on a ctx (like this.canvas)
    this.canvasElement = document.getElementById(canvasId);
    this.ctx = this.canvasElement.getContext('2d');
    this.operations = [];
    this.testCtx = document.createElement('canvas').getContext('2d');
    this.renderTimes = [];
    this.savedCanvasImage = undefined;
    this._lazy = lazy;

    var self = this;

    Object.defineProperty(this, 'lazy', {
      get: function(){ return self._lazy; },
      set: function(value){
        if (self._lazy && !value){
          self.trigger();
        }
        self._lazy = value;
      }
    });

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
    this.savedCanvasImage = undefined;
    if (this.showFPS){
      var t = new Date().getTime();
      this.renderTimes.push(new Date().getTime());
      while (this.renderTimes.length > 10){
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
      var fps = this.renderTimes.length > 1 ? (this.renderTimes.length - 1) /
                                          (t - this.renderTimes[0]) * 1000
                                        : 0;
      this.ctx.fillText("fps: "+fps,this.canvasElement.width-100, 20);
      this.ctx.font = oldFont;
      this.ctx.fillStyle = oldFillStyle;
    }
    return returnValue;
  };
  /** Saves the drawing context, queued operations, and current image of canvas */
  LazyCanvasCtx.prototype.saveState = function(){
    //TODO keep last saved image around to use repeatedly
    // noticing it's bad will require setting this.dirty = true when
    // mutating operations occur
    if (this.savedCanvasImage){
      // using cached image state
    } else {
      // taking new canvas snapshot
      this.savedCanvasImage = this.canvasElement.toDataURL("image/jpeg", 0.1);
      //TODO maybe instead of snapshots, save the drawing operations? Should add
      //an explicit clear-screen call if doing this or detect 
    }
    //TODO save everything like fillStyle etc. that the user might have changed (ugh)
    //TODO save queued operations as well as image data
    //var savedOperations = this.operations.slice(0);
    return Immutable.Map({imageData: this.savedCanvasImage});
  };
  LazyCanvasCtx.prototype.restoreState = function(state){
    if (!Immutable.Map.isMap(state)){
      throw Error("Lazy canvas restored with bad state:"+state);
    }
    var img = new Image;
    img.src = state.get('imageData');
    this.ctv.drawImage( img, 0, 0 );
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
