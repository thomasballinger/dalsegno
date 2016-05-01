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
  });
});
