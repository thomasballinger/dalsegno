// This module only works in the browser
// (potential TODO: move things out of here so they can be tested with node)
;(function() {
  'use strict';

  var require;
  if (typeof window === 'undefined') {
    require = module.require;
  } else {
    // This require is different that the others, it has an existence check
    require = function(name){
      var realname = name.match(/(\w+)[.]?j?s?$/)[1];
      var lib = window[realname];
      if (lib === undefined){
        throw Error('Library '+name+' not loaded - please add it in a script tag');
      }
      return lib;
    };
  }

  var parse = require("parse.js");
  var Environment = require("./Environment.js");
  var bcrun = require("bcrun.js");
  var builtins = require("builtins.js");
  var MouseTracker = require("MouseTracker.js");
  var KeyboardTracker = require("KeyboardTracker.js");
  var stdlibcode = require("stdlibcode.js");
  var bcstdlib = require("./bcstdlib.js");
  var LazyCanvasCtx = require("./LazyCanvasCtx.js");
  var DrawHelpers = require("./DrawHelpers.js");

  //TODO Was this better as a closure? It feels weird as an object.
  function DalSegno(editorId, canvasId, errorBarId, initialProgramId){
    this.shouldReload = true;
    this.currentlyRunning = false;
    this.lastProgram = '';
    this.speed = 500;
    this.badSpot;

    this.editorId = editorId;
    this.canvasId = canvasId;
    this.errorBarId = errorBarId;
    this.initialProgramId = initialProgramId;

    this.runner = new bcrun.BCRunner({});
    this.runner.setEnvBuilder( () => this.envBuilder() );

    this.initEditor();
    this.initTrackers();
    this.initGraphics();

    this.setClickToPlay();
  }
  DalSegno.prototype.go = function(){
    if (this.currentlyRunning){ return; }
    this.currentlyRunning = true;
    this.runABit();
  };
  DalSegno.prototype.setClickToPlay = function(){
    console.log('setting up handler');
    var self = this;
    var ctx = this.canvas.getContext("2d");
    var origFillStyle = ctx.fillStyle;
    var origFontStyle = ctx.fontStyle;
    var origTextBaseline = ctx.textBaseline;
    var origTextAlign = ctx.textAlign;

    ctx.font="30px Arial";
    ctx.fillStyle = 'black';
    ctx.textBaseline = 'middle';
    ctx.textAlign = "center";
    ctx.fillText('Click canvas', canvas.width/2, canvas.height/2 - 30);
    ctx.fillText('or edit program', canvas.width/2, canvas.height/2);
    ctx.fillText('to start.', canvas.width/2, canvas.height/2 + 30);

    ctx.fillStyle = origFillStyle;
    ctx.fontStyle = origFontStyle;
    ctx.textBaseline = origTextBaseline;
    ctx.textAlign = origTextAlign;
    function clearAndHideAndGo(){
      console.log('running handler');
      ctx.clearRect(0, 0, 10000, 10000);
      self.canvas.removeEventListener('click', clearAndHideAndGo);
      self.go();
    }
    this.canvas.addEventListener('click', clearAndHideAndGo);
  };
  DalSegno.prototype.runABit = function(){
    var s = this.editor.getValue();
    if (this.shouldReload){
      this.clearError();
      this.shouldReload = false;
      if (parse.safelyParses(s, e => this.errback(e))){
        this.runner.update(s);
        this.currentlyRunning = this.runner.runABit(1, e => this.errback(e));
      } else {
        currentlyRunning = false;
        return;
      }
    }
    if (this.currentlyRunning) {
      this.currentlyRunning = this.runner.runABit(this.speed, e => this.errback(e) );
      if (this.currentlyRunning) {
        setTimeout( () => this.runABit(), 0);
      }
    }
  };
  DalSegno.prototype.onChange = function(e){
    var s = this.editor.getValue();
    if (!parse.safelyParses(s, e => errback(e))){
      this.lastProgram = '';
      this.currentlyRunning = false;
      return;
    }

    var newProgram = JSON.stringify(parse(s));
    if (newProgram === this.lastProgram){
      return;
    }
    this.lastProgram = newProgram;
    this.shouldReload = true;
    if (!this.currentlyRunning){
      this.currentlyRunning = true;
      this.runABit();
    }
  };
  DalSegno.prototype.errback = function(e){
    this.errorbar.innerText = ''+e;
    errorbar.classList.remove('is-hidden');
    if (e.ast){
      Range = ace.require("ace/range").Range;
      badSpot = editor.session.addMarker(new Range(
        e.ast.lineStart-1,
        e.ast.colStart-1,
        e.ast.lineEnd-1,
        e.ast.colEnd-1), "errorHighlight");
    }
  };
  DalSegno.prototype.clearError = function(){
    this.errorbar.classList.add('is-hidden');
    if (this.badSpot){
      editor.getSession().removeMarker(this.badSpot);
      this.badSpot = undefined;
    }
  };
  DalSegno.prototype.initEditor = function(){
    this.editor = ace.edit(this.editorId);
    this.editor.setTheme("ace/theme/monokai");
    this.editor.getSession().setMode("ace/mode/scheme");
    this.editor.commands.removeCommand('gotoline'); // bound to command-L which selects the url in osx chrome
    this.editor.getSession().setTabSize(2);
    this.editor.getSession().setUseSoftTabs(true);
    this.editor.$blockScrolling = Infinity;

    var editorContainer = document.getElementById(this.editorId);
    editorContainer.classList.remove('is-hidden');

    var initialContent = '(display (+ 1 1))';
    if (this.initialProgramId){
      initialContent = document.getElementById(this.initialProgramId).textContent;
    }
    this.editor.setValue(initialContent, -1);

    this.editor.getSession().on('change', e => this.onChange(e));

    this.errorbar = document.getElementById(this.errorBarId);
    this.errorbar.classList.add('errorbar');
    this.clearError();
  };
  DalSegno.prototype.initTrackers = function(){
    this.mouseTracker = new MouseTracker('canvas');
    this.keyboardTracker = new KeyboardTracker('canvas');
  };
  DalSegno.prototype.initGraphics = function(){
    if (!this.canvasId){ throw Error('No canvas id provided'); }
    if (!document.getElementById(this.canvasId)){ throw Error("can't find canvas from id"); }
    this.canvas = document.getElementById(this.canvasId);
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;
    this.lazyCanvasCtx = new LazyCanvasCtx(this.canvasId, true, true);
    this.drawHelpers = new DrawHelpers(this.lazyCanvasCtx, document.getElementById(this.canvasId));
  };
  DalSegno.prototype.envBuilder = function(){
    return new Environment([].concat(
      [window, console],
      this.canvas ? [this.canvas, this.lazyCanvasCtx, this.drawHelpers] : [],
      this.mouseTracker ? [this.mouseTracker] : [],
      this.keyboardTracker ? [this.keyboardTracker] : [],
      [new Environment.Scope(builtins),
       new Environment.Scope(bcstdlib),
       new Environment.Scope()]));
  };

  DalSegno.DalSegno = DalSegno;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = DalSegno;
    }
  } else {
    window.DalSegno = DalSegno;
  }
})();
