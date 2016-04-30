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
});
