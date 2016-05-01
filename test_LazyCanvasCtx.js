'use strict';
var fs = require('fs');

var chai = require('chai');
var assert = chai.assert;

var LazyCanvasCtx = require('./LazyCanvasCtx.js').LazyCanvasCtx;

function FakeDocument(){
  this.getElementById = function(id){
    var el = new FakeCanvas();
    el.id = id;
    return el;
  };
  this.createElement = function(){
    var el = new FakeCanvas();
    el.id = 'anonymous';
    return el;
  };
}
function FakeCanvas(){
  this.getContext = function(arg){
    var ctx = new FakeCanvasCtx();
    ctx.parent = this;
    return ctx;
  };
  this.width = 20;
  this.height = 10;
}
function FakeCanvasCtx(){
  this.runCB = function(cb){
    // If created by a createElement call then it's the test canvas context
    if (this.parent.id === 'anonymous'){
    } else {
      return cb();
    }
  };
  Object.defineProperty(this, 'justGetter', {
    enumerable: true,
    get: function(){ return 1; }
  });
  this.justSetterValue = 0;
  Object.defineProperty(this, 'justSetter', {
    enumerable: true,
    set: function(value){ this.justSetterValue++; }
  });

  // these are for testing wrappers around them
  // that clear previous drawing operations
  this.fillRect = function(){};

  var fillStyle = '#000000';
  Object.defineProperty(this, 'fillStyle', {
    enumerable: true,
    get: function(){ return fillStyle; },
    set: function(value){ fillStyle = value; }
  });
}

/** Run cb with global[name] set to value */
function patchGlobal(name, value, cb){
  var origValue;
  var hadValue = false;
  if (global.hasOwnProperty(name)){
    hadValue = true;
    origValue = global[name];
  }
  global[name] = value;
  try {
    cb();
  } finally {
    if (hadValue){
      global[name] = origValue;
    } else {
      delete global[name];
    }
  }
}

describe('LazyCanvasCtx', function(){
  it('can be instantiated in node', function(){
    patchGlobal('document', new FakeDocument(), function(){
      new LazyCanvasCtx("doesn't matter", true, false);
    });
  });
  it("doesn't run queued methods if lazy", function(){
    patchGlobal('document', new FakeDocument(), function(){
      var c = new LazyCanvasCtx("doesn't matter", true, false);
      c.runCB(function(){ assert.fail(); });
    });
  });
  it('runs queued methods when triggered', function(){
    patchGlobal('document', new FakeDocument(), function(){
      var c = new LazyCanvasCtx("doesn't matter", true, false);
      var callbackRun = 0;
      c.runCB(function(){ callbackRun++; });
      assert.equal(callbackRun, 0);
      c.trigger();
      assert.equal(callbackRun, 1);
      c.trigger();
      assert.equal(callbackRun, 1);
    });
  });
  it('runs queued operations when lazy is set to false', function(){
    patchGlobal('document', new FakeDocument(), function(){
      var c = new LazyCanvasCtx("doesn't matter", true, false);
      var callbackRun = 0;
      c.runCB(function(){ callbackRun++; });
      assert.equal(callbackRun, 0);
      c.lazy = false;
      assert.equal(callbackRun, 1);
      c.trigger();
      assert.equal(callbackRun, 1);
    });
  });
  it('works with builtin getters and setters', function(){
    patchGlobal('document', new FakeDocument(), function(){
      var c = new LazyCanvasCtx("doesn't matter", true, false);
      var callbackRun = 0;
      c.runCB(function(){ callbackRun++; });
      assert.equal(callbackRun, 0);
      // Getters have to happen now, so they call trigger()
      assert.equal(c.justGetter, 1);
      assert.equal(callbackRun, 1);

      c.justSetter = "doesn't matter";
      assert.equal(c.ctx.justSetterValue, 0);
      c.trigger();
      assert.equal(c.ctx.justSetterValue, 1);
    });
  });
  it('works with ', function(){
    patchGlobal('document', new FakeDocument(), function(){
      var c = new LazyCanvasCtx("doesn't matter", true, false);
      var callbackRun = 0;
      c.runCB(function(){ callbackRun++; });
      assert.equal(callbackRun, 0);
      // Getters have to happen now, so they call trigger()
      assert.equal(c.justGetter, 1);
      assert.equal(callbackRun, 1);

      c.justGetter = 10;
      assert.throws(
        () => c.trigger(),
        /Cannot set property justGetter of .* which has only a getter/);

      c.justSetter = "doesn't matter";
      assert.equal(c.ctx.justSetterValue, 0);
      c.trigger();
      assert.equal(c.ctx.justSetterValue, 1);
    });
  });
  describe('restoring', function(){
    it('plays back already run operations', function(){
      patchGlobal('document', new FakeDocument(), function(){
        var c = new LazyCanvasCtx("doesn't matter", true, false);
        var callbackRun = 0;
        c.runCB(function(){ callbackRun++; });
        assert.equal(c.operationsSinceLastClear.count(), 0);
        c.trigger();
        assert.equal(callbackRun, 1);
        assert.equal(c.operationsSinceLastClear.count(), 1);
        var state = c.saveState();
        c.restoreState(state);
        assert.equal(callbackRun, 2);
      });
    });
    it('throws out saved operations on forget', function(){
      patchGlobal('document', new FakeDocument(), function(){
        var c = new LazyCanvasCtx("doesn't matter", true, false);
        c.runCB(function(){});
        c.trigger();
        var state1 = c.saveState();
        assert.equal(state1.get('operationsSinceLastClear').count(), 1);
        c.forget();
        var state2 = c.saveState();
        assert.equal(state2.get('operationsSinceLastClear').count(), 0);
      });
    });
    it('tosses operations before a fullscreen fillRect', function(){
      patchGlobal('document', new FakeDocument(), function(){
        var c = new LazyCanvasCtx("doesn't matter", true, false);
        c.runCB(function(){});
        c.trigger();
        assert.equal(c.operationsSinceLastClear.count(), 1);
        c.fillRect(0, 0, 1, 1);
        c.trigger();
        assert.equal(c.operationsSinceLastClear.count(), 2);
        c.fillRect(0, 0, 1, 1);
        c.trigger();
        assert.equal(c.operationsSinceLastClear.count(), 3);
        c.fillRect(0, 0, 100, 100);
        c.trigger();
        assert.equal(c.operationsSinceLastClear.count(), 1);
      });
    });
    patchGlobal('document', new FakeDocument(), function(){
      it('sets fillStyle', function(){
        patchGlobal('document', new FakeDocument(), function(){
          var c = new LazyCanvasCtx("doesn't matter", true, false);
          c.fillStyle = '#123456';
          c.trigger();
          var state1 = c.saveState();
          c.fillStyle = '#000000';
          c.restoreState(state1);
          assert.equal(c.fillStyle, '#123456');

          // here we test whether styles at the time of a forget are saved
          c.forget();
          var state2 = c.saveState();
          c.fillStyle = '#000000';
          c.restoreState(state2);
          assert.equal(c.fillStyle, '#123456');
        });
      });
    });
  });
});
