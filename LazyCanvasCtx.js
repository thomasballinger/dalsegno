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
   * Calling forget tosses saved operations (used to
   *   replicate the current onscreen state) because
   *   an upcoming operation will remove all evidence
   *   of them.
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
    this.operations = Immutable.Stack([]);
    this.operationsSinceLastClear = Immutable.Stack([]);
    this.propStateAtLastClear = this.getPropState();
    this.testCtx = document.createElement('canvas').getContext('2d');
    this.renderTimes = [];
    this.requestRender = null;
    this.rewindEffect = true;
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
            if (property === 'fillRect' && args.length >= 4 &&
                args[0] <= 0 && args[1] <= 0 &&
                args[2] >= this.canvasElement.width &&
                args[3] >= this.canvasElement.height){

              // operations are used in two situations:
              // immediately in lazy mode on the this.testCtx to check
              // for errors, and on trigger to run for real on this.ctx.
              // Forgetting old operations should only happen in the
              // second case.
              var forgetIfThisIsRealCanvasContext = function(){
                if (this === self.ctx){
                  self.forget();
                }
              };
              // This prevents the operation from being added
              // to the list that it clears after being run
              forgetIfThisIsRealCanvasContext.DONOTRECORDINSINCELASTCLEAR = true;
              this.operations = this.operations.push([forgetIfThisIsRealCanvasContext, []]);
            }
            this.operations = this.operations.push([method, args]);
            if (this.lazy){
              try {
                method.apply(this.testCtx, args);
              } catch (e) {
                this.operations = this.operations.clear();
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
              self.operations = self.operations.push([getter, []]);
              return self.trigger();
            };
          } else {
            descriptors.get = function(){
              self.trigger();
              var simpleGetter = function(){
                return this[property];
              };
              self.operations = self.operations.push([simpleGetter, []]);
              return self.trigger();
            };
          }
          if (setter) {
            descriptors.set = function(value){
              self.operations = self.operations.push([setter, [value]]);
            };
          } else {
            descriptors.set = function(value){
              var simpleSetter = function(value){
                this[property] = value;
                return value;
              };
              self.operations = self.operations.push([simpleSetter, []]);
            };
          }
          Object.defineProperty(this, property, descriptors);
        }).call(this, getter, setter, property);
      }
    }
  }
  /** Asserts that saved operations no longer need to be remembered
   * because a screen-clearing operation is about to happen.
   */
  LazyCanvasCtx.prototype.forget = function(){
    this.propStateAtLastClear = this.getPropState();
    this.operationsSinceLastClear = this.operationsSinceLastClear.clear();
  };
  LazyCanvasCtx.prototype.setRenderRequester = function(f){
    this.requestRender = f;
  };
  LazyCanvasCtx.prototype.getPropState = function(){
    var properties = ['fillStyle'];
    var propState = {};
    properties.forEach( prop => {
      propState[prop] = this.ctx[prop];
    });
    return propState;
  };
  LazyCanvasCtx.prototype.trigger = function(){
    if (this.showFPS){
      var t = new Date().getTime();
      this.renderTimes.push(new Date().getTime());
      while (this.renderTimes.length > 10){
        this.renderTimes.shift();
      }
    }

    var returnValue;
    try {
      this.operations.reverse().forEach( operation => {
        returnValue = operation[0].apply(this.ctx, operation[1]);
        // ugh this is ugly, and possibly slow?
        if (!operation[0].DONOTRECORDINSINCELASTCLEAR){
          this.operationsSinceLastClear = this.operationsSinceLastClear.push(operation);
        }
      });
    } finally {
      this.operations = this.operations.clear();
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
    if (this.requestRender){
      this.requestRender();
    }

    return returnValue;
  };
  /** Saves the drawing context, queued operations, and current image of canvas */
  LazyCanvasCtx.prototype.saveState = function(){
    //TODO save everything like fillStyle etc. that the user might have changed (ugh)
    //TODO save queued operations as well as image data
    return Immutable.Map({
      // TODO avoid rebuilding this each time by dirtying it on the way in
      propState: this.propStateAtLastClear,
      queuedOperations: this.operations,
      operationsSinceLastClear: this.operationsSinceLastClear,
    });
  };
  LazyCanvasCtx.prototype.restoreState = function(state){
    if (!Immutable.Map.isMap(state)){
      throw Error("Lazy canvas restored with bad state:"+state);
    }
    Object.keys(state.get('propState')).forEach( prop => {
      this.ctx[prop] = state.get('propState')[prop];
    });
    this.propStateAtLastClear = state.get('propState');
    this.operationsSinceLastClear = state.get('operationsSinceLastClear');
    this.operations = state.get('queuedOperations');

    // these operations have successfully been run on this canvas before
    this.operationsSinceLastClear.reverse().forEach( operation => {
      operation[0].apply(this.ctx, operation[1]);
    });
    if (this.rewindEffect){
      this.drawRewindEffect();
    }
  };
  LazyCanvasCtx.prototype.drawRewindEffect = function(){
    this.ctx.save();
    var w = this.canvasElement.width;
    var h = this.canvasElement.height;
    var fills = ['#666', '#eee', '#888', '#bbb'];
    for (var i=0; i<10; i++){
      this.ctx.fillStyle = fills[Math.floor(Math.random()*fills.length)];
      this.ctx.fillRect(0, h/5 + Math.random()*h/12, w, h / 200);
    }
    for (var i=0; i<10; i++){
      this.ctx.fillStyle = fills[Math.floor(Math.random()*fills.length)];
      this.ctx.fillRect(0, 3*h/5 + Math.random()*h/12, w, h / 200);
    }
    this.ctx.restore();
  };
  LazyCanvasCtx.prototype.drawPlayIcon = function(){
    this.ctx.save();
    var w = this.canvasElement.width;
    var h = this.canvasElement.height;

    this.ctx.fillStyle = '#ffffff';
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 15;

    this.ctx.beginPath();
    this.ctx.moveTo(w*0.2, h*0.2);
    this.ctx.lineTo(w*0.8,h*0.5);
    this.ctx.lineTo(w*0.2, h*0.8);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.restore();
  };
  LazyCanvasCtx.prototype.eraseEffect = function(){
    console.log('erasing effect...');
    this.ctx.clearRect(0, 0, 10000, 10000);
    var origRewindEffect = this.rewindEffect;
    this.rewindEffect = false;
    this.restoreState(this.saveState());
    this.rewindEffect = origRewindEffect;
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
