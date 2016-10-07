'use strict';

if (typeof __webpack_require__ === 'function'){
  // we've been bundled by webpack!
  var Immutable = require('./Immutable.js');
} else if (typeof window === 'undefined'){
  // we're in node, apparently unbundled!
  var Immutable = require('./Immutable.js');
} else {
  if (typeof window.Immutable === 'undefined'){
    throw Error("Needs Immutable.js");
  }
  var Immutable = window.Immutable;
}

var ContextPropertiesWithAGetterOrSetter = {
  "canvas": true,
  "globalAlpha": true,
  "globalCompositeOperation": true,
  "filter": true,
  "webkitImageSmoothingEnabled": true,
  "imageSmoothingEnabled": true,
  "strokeStyle": true,
  "fillStyle": true,
  "shadowOffsetX": true,
  "shadowOffsetY": true,
  "shadowBlur": true,
  "shadowColor": true,
  "lineWidth": true,
  "lineCap": true,
  "lineJoin": true,
  "miterLimit": true,
  "lineDashOffset": true,
  "font": true,
  "textAlign": true,
  "textBaseline": true,
};


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
 * It makes sense to turn off lazy when stepping the interpreter:
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
    } else if (property in ContextPropertiesWithAGetterOrSetter) {
      (function(property){
        var descriptors = {};
        descriptors.get = function(){
          self.trigger();
          var simpleGetter = function(){
            return this[property];
          };
          self.operations = self.operations.push([simpleGetter, []]);
          return self.trigger();
        };
        descriptors.set = function(value){
          var simpleSetter = function(value){
            this[property] = value;
            return value;
          };
          self.operations = self.operations.push([simpleSetter, [value]]);
        };
        Object.defineProperty(this, property, descriptors);
      }).call(this, property);
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
  var self = this;
  properties.forEach(function(prop) {
    propState[prop] = self.ctx[prop];
  });
  return propState;
};
LazyCanvasCtx.prototype.trigger = function(){
  if (this.showFPS){
    var t = new Date().getTime();
    this.renderTimes.push(new Date().getTime());
    while (this.renderTimes.length > 30){
      this.renderTimes.shift();
    }
  }

  var returnValue;
  try {
    var self = this;
    this.operations.reverse().forEach( function(operation){
      returnValue = operation[0].apply(self.ctx, operation[1]);
      // ugh this is ugly, and possibly slow?
      if (!operation[0].DONOTRECORDINSINCELASTCLEAR){
        self.operationsSinceLastClear = self.operationsSinceLastClear.push(operation);
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
  var self = this;
  Object.keys(state.get('propState')).forEach(function(prop){
    self.ctx[prop] = state.get('propState')[prop];
  });
  this.propStateAtLastClear = state.get('propState');
  this.operationsSinceLastClear = state.get('operationsSinceLastClear');
  this.operations = state.get('queuedOperations');

  // these operations have successfully been run on this canvas before
  this.operationsSinceLastClear.reverse().forEach(function(operation){
    operation[0].apply(self.ctx, operation[1]);
  });
  if (this.lazy && this.drawRewindEffect){
    this.drawRewindEffect();
  }
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


LazyCanvasCtx.LazyCanvasCtx = LazyCanvasCtx;


if (typeof __webpack_require__ === 'function'){
  module.exports = LazyCanvasCtx;
} else if (typeof window === 'undefined'){
  // we're in node, apparently unbundled!
  module.exports = LazyCanvasCtx;
} else {
  // fine, global LazyCanvasCtx is the only exported thing
}
