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

  var Immutable = require("./Immutable.js");
  var parse = require("./parse.js");
  var Environment = require("./Environment.js");
  var bcrun = require("./bcrun.js");
  var builtins = require("./builtins.js");
  var MouseTracker = require("./MouseTracker.js");
  var KeyboardTracker = require("./KeyboardTracker.js");
  var stdlibcode = require("./stdlibcode.js");
  var bcstdlib = require("./bcstdlib.js");
  var LazyCanvasCtx = require("./LazyCanvasCtx.js");
  var DrawHelpers = require("./DrawHelpers.js");

  //TODO Was this better as a closure? It feels weird as an object.
  function DalSegno(editorId, canvasId, errorBarId, consoleId, initialProgramId){
    this.shouldReload = true;  // whether the editor has a different AST
                               // than the one last executed
    this.currentlyRunning = false;  // whether there's more of the currently
                                    // loaded program to run
    this.lastProgram = '';  // string of the currently running program's AST
                            // or an empty string if the program doesn't parse
    this.speed = 500;  // number of bytecode steps run per this.runABit()
    this.badSpot;  // currently highlighted ace Range of source code

    this.editorId = editorId;
    this.canvasId = canvasId;
    this.consoleId = consoleId;
    this.errorBarId = errorBarId;

    initialProgramId = initialProgramId || editorId;
    this.initialContent = document.getElementById(initialProgramId);
    if (this.initialContent === null){
      this.initialContent = initialProgramId;
    } else {
      this.initialContent = this.initialContent.textContent;
    }

    this.runner = new bcrun.BCRunner({});
    this.runner.setEnvBuilder( () => this.envBuilder() );

    this.initEditor();
    if (this.consoleId){ this.initConsole(); }
    this.initTrackers();
    this.initGraphics();

    this.initWindowWatcher();
    this.setMouseinToPlay();
  }
  DalSegno.activeWidget = undefined;
  DalSegno.windowWatcherSet = false;
  DalSegno.prototype.go = function(){
    if (this.currentlyRunning && DalSegno.activeWidget === this){ return; }
    DalSegno.activeWidget = this;
    this.currentlyRunning = true;
    this.runABit();
  };
  DalSegno.prototype.setMouseinToPlay = function(){
    var self = this;
    var ctx = this.canvas.getContext("2d");
    var origFillStyle = ctx.fillStyle;
    var origFontStyle = ctx.fontStyle;
    var origTextBaseline = ctx.textBaseline;
    var origTextAlign = ctx.textAlign;

    this.savedImage = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = 'gray';
    ctx.fillRect(canvas.width/2 - 140, canvas.height/2 - 50, 280, 100);
    ctx.font="30px Arial";
    ctx.fillStyle = 'black';
    ctx.textBaseline = 'middle';
    ctx.textAlign = "center";
    ctx.fillText('Mouse over canvas', canvas.width/2, canvas.height/2 - 30);
    ctx.fillText('or edit program', canvas.width/2, canvas.height/2);
    var text = this.currentlyRunning ? 'to resume.' : 'to start';
    ctx.fillText(text, canvas.width/2, canvas.height/2 + 30);

    ctx.fillStyle = origFillStyle;
    ctx.fontStyle = origFontStyle;
    ctx.textBaseline = origTextBaseline;
    ctx.textAlign = origTextAlign;
    function clearAndHideAndGo(){
      self.canvas.removeEventListener('mouseenter', clearAndHideAndGo);
      ctx.putImageData(self.savedImage, 0, 0);
      self.lastClearAndHideAndGo = undefined;
      self.go();
    }
    this.canvas.addEventListener('mouseenter', clearAndHideAndGo);
    this.lastClearAndHideAndGo = clearAndHideAndGo;
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
        this.currentlyRunning = false;
        return;
      }
    }
    if (DalSegno.activeWidget === this) {
      if (this.currentlyRunning){
        this.currentlyRunning = this.runner.runABit(this.speed, e => this.errback(e) );
        if (this.currentlyRunning) {
          setTimeout( () => this.runABit(), 0);
        }
      }
    } else {
      this.setMouseinToPlay();
    }
  };
  DalSegno.prototype.initWindowWatcher = function(){
    if (DalSegno.windowWatcherSet){ return; }
    window.addEventListener('blur', function(){
      console.log('tab seems inactive!');
      DalSegno.activeWidget = undefined;
    });
    DalSegno.windowWatcherSet = true;
  };
  DalSegno.prototype.onChange = function(e){
    DalSegno.activeWidget = this;

    if (this.lastClearAndHideAndGo){
      this.lastClearAndHideAndGo();
    }
    var s = this.editor.getValue();
    if (!parse.safelyParses(s, e => this.errback(e))){
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
    this.errorbar.classList.remove('is-hidden');
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

    this.editor.setValue(this.initialContent, -1);

    this.editor.getSession().on('change', e => this.onChange(e));

    this.errorbar = document.getElementById(this.errorBarId);
    this.errorbar.classList.add('errorbar');
    this.clearError();
  };
  DalSegno.prototype.initConsole = function(){
    this.consoleElement = document.getElementById(this.consoleId);
    this.consoleElement.disabled = true;
    this.console = new Console(this.consoleId);
  };
  DalSegno.prototype.initTrackers = function(){
    this.mouseTracker = new MouseTracker(this.canvasId);
    this.keyboardTracker = new KeyboardTracker(this.canvasId);
  };
  DalSegno.prototype.initGraphics = function(){
    if (!this.canvasId){ throw Error('No canvas id provided'); }
    if (!document.getElementById(this.canvasId)){ throw Error("can't find canvas from id"); }
    this.canvas = document.getElementById(this.canvasId);
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;
    this.lazyCanvasCtx = new LazyCanvasCtx(this.canvasId, true);
    this.drawHelpers = new DrawHelpers(this.lazyCanvasCtx, document.getElementById(this.canvasId));
  };
  DalSegno.prototype.envBuilder = function(){
    return new Environment([].concat(
      [window, console],
      this.canvas ? [this.canvas, this.lazyCanvasCtx, this.drawHelpers] : [],
      this.mouseTracker ? [this.mouseTracker] : [],
      this.keyboardTracker ? [this.keyboardTracker] : [],
      this.console ? [this.console] : [backupConsole],
      [new Environment.Scope(builtins),
       new Environment.Scope(bcstdlib),
       new Environment.Scope()]));
  };

  function BackupConsole(){}
  BackupConsole.prototype.display = function(){
    var args = Array.prototype.slice.call(arguments);
    args = args.map( x => Immutable.List.isList(x) ? x.toJS() : x);
    return console.log.apply(console, args);
  };
  var backupConsole = new BackupConsole();

  DalSegno.DalSegno = DalSegno;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = DalSegno;
    }
  } else {
    window.DalSegno = DalSegno;
  }
})();
