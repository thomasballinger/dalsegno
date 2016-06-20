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
  var bcexec = require("./bcexec.js");
  var builtins = require("./builtins.js");
  var MouseTracker = require("./MouseTracker.js");
  var KeyboardTracker = require("./KeyboardTracker.js");
  var stdlibcode = require("./stdlibcode.js");
  var LazyCanvasCtx = require("./LazyCanvasCtx.js");
  var DrawHelpers = require("./DrawHelpers.js");


  //Player State enums
  function State(state){ this.state = state; }
  State.prototype.toString = function(){ return this.state + ': '+this.msg; };
  // Always use object identity to compare these (===)
  var PS = {
    Initial: new State('Initial', `mousein to start`),
    Unfinished: new State('Unfinished', `mousein to resume`),
    Finished: new State('Finished', `click to restart`),
    Error: new State('Error', `No handlers needed, editor onChange has got it`),
  };

  // Editor messages
  var EM = {
    SyntaxError: new State('SyntaxError', `the source code is obviously invalid`),
    SyntacticDifference: new State('SyntacticDifference', `the source code has unimportant changes like more whitespace`),
    SemanticDifference: new State('SemanticDifference', ``),
  };

  function DalSegno(editorId, canvasId, errorBarId, consoleId, scrubberId, initialProgramId){
    //These are the four important state properties
    this.playerState = PS.Initial;
    this.runSomeScheduled = false;
    this.editorMessage = null;
    this.mouseMessage = null;
    Object.defineProperty(this, "isActive", {
      get: () => DalSegno.activeWidget === this,
      set: (x) => {
        if (x === true){
          DalSegno.activeWidget = this;
        } else if (x === false){
          throw Error("can't unset isActive");
        } else {
          throw Error("bad value for isActive property: "+x); }
      }
    });

    this.lastProgram = '';  // string of the currently running program's AST
                            // or an empty string if the program doesn't parse
    this.lastCleanupFunction = undefined; // cleans up message over canvas
    this.speed = 500;  // number of bytecode steps run per this.startRunning()
    this.badSpot = undefined;  // currently highlighted ace Range of source code for error
    this.curSpot = undefined;  // currently highlighted ace Range of source code for cur
    this.DEBUGMODE = false;  // throw errors properly so we see tracebacks
    this.onChangeIfValid = function(s){};  // called after valid parse with new program

    this.editorId = editorId;
    this.canvasId = canvasId;
    this.consoleId = consoleId;
    this.errorBarId = errorBarId;
    this.scrubberId = scrubberId;

    initialProgramId = initialProgramId || editorId;
    this.initialContent = document.getElementById(initialProgramId);
    if (this.initialContent === null){
      this.initialContent = initialProgramId;
    } else {
      this.initialContent = this.initialContent.textContent;
    }
    this.onChangeIfValid(this.initialContent);

    this.runner = new bcrun.BCRunner({});
    this.runner.setEnvBuilder( () => this.envBuilder() );

    this.initEditor();
    if (this.consoleId){ this.initConsole(); }
    this.initTrackers();
    this.initGraphics();
    if (this.scrubberId){ this.initScrubber(); }

    this.runner.registerStateful(this.lazyCanvasCtx);
    this.runner.registerRenderRequester(this.lazyCanvasCtx);

    this.initWindowWatcher();
    this.setMouseinToPlay();
  }
  DalSegno.activeWidget = undefined;
  DalSegno.windowWatcherSet = false;
  /** User wants to see something */
  DalSegno.prototype.go = function(){
    this.isActive = true;
    this.ensureRunSomeScheduled();
  };
  DalSegno.prototype.link = function(){
    //TODO links to versions without editors or with a console
    var base = 'http://dalsegno.ballingt.com/';
    //var base = './gamelib.html';
    var encoded = encodeURI(this.editor.getValue());
    return base + '?code='+encoded;
  };

  DalSegno.prototype.canvasMessage = function(strings, align){
    align = align || 'center';
    var ctx = this.canvas.getContext("2d");
    ctx.save();

    ctx.fillStyle = 'gray';
    if (align === 'center'){
      ctx.fillRect(
        this.canvas.width/2 - 140,
        this.canvas.height/2 - strings.length*30/2 - 5,
        280,
        strings.length*30+10);
    } else if (align === 'lowerRight') {
      ctx.fillRect(
        this.canvas.width - 280,
        this.canvas.height - strings.length*30 - 10,
        280,
        strings.length*30+10);
    } else {
      throw Error('Bad align value: '+align+' should be "center" or "lowerRight"');
    }
    ctx.font="30px Arial";
    ctx.fillStyle = 'black';
    ctx.textBaseline = 'middle';
    ctx.textAlign = "center";
    if (align === 'center'){
      for (var i=0, heightOffset=-(strings.length-1)/2*30; i < strings.length; i++, heightOffset+=30){
        ctx.fillText(strings[i], this.canvas.width/2, this.canvas.height/2 + heightOffset);
      }
    } else {
      for (var i=0, heightOffset=-(strings.length*2-1)/2*30; i < strings.length; i++, heightOffset+=30){
        ctx.fillText(strings[i], this.canvas.width - 140, this.canvas.height + heightOffset);
      }
    }

    ctx.restore();
  };
  DalSegno.prototype.setMouseinToPlay = function(){
    var ctx = this.canvas.getContext("2d");
    this.savedImage = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    var msg = ['Mouse over canvas', 'or edit source'];
    if (this.playerState === PS.Initial){
      msg.push('to start program.');
    } else if (this.playerState === PS.Finished){
      msg.push('to restart program.');
    } else if (this.playerState === PS.Unfinished){
      msg.push('to resume program.');
    } else {
      throw Error('called in wrong state: '+this.playerState);
    }
    this.canvasMessage(msg);
    var self = this;
    function cleanup(){
      console.log('calling cleanup function set by setMouseinToPlay');
      self.canvas.removeEventListener('mouseenter', handler);
      ctx.putImageData(self.savedImage, 0, 0);
      self.lastCleanupFunction = undefined;
    }
    self.lastCleanupFunction = cleanup;
    function handler(){
      console.log('running handler set by setMouseinToPlay');
      self.mouseMessage = true;
      self.ensureRunSomeScheduled();
    }
    this.canvas.addEventListener('mouseenter', handler);
  };
  DalSegno.prototype.setClickToRestart = function(){
    var ctx = this.canvas.getContext("2d");
    if (this.playerState !== PS.Finished){
      throw Error('called in wrong state: '+this.playerState);
    }
    this.canvasMessage(['Program finished.',
                        'Click canvas or',
                        'edit source',
                        'to run it again.'], 'lowerRight');
    var self = this;
    function cleanup(){
      console.log('calling cleanup function set by setClickToRestart');
      self.canvas.removeEventListener('click', handler);
      ctx.clearRect(0, 0, 10000, 10000);
      self.lastCleanupFunction = undefined;
    }
    self.lastCleanupFunction = cleanup;
    function handler(){
      self.mouseMessage = true;
      self.ensureRunSomeScheduled();
    }
    this.canvas.addEventListener('click', handler);
  };

  DalSegno.prototype.ensureRunSomeScheduled = function(){
    if (!this.runSomeScheduled){
      this.runSome();
    }
  };

  /** Advance the state of the program.
   *
   * This function can be scheduled to be run later,
   * so it must inspect the state of the DalSegno object
   * to determine what to do.
   * */
  DalSegno.prototype.runSome = function(){
    var doUpdate = false;

    // Check Queued Events
    if (this.editorMessage === EM.SyntacticDifference){
      console.log('difference in editor is only syntactic, nothing special to do');
      this.editorMessage = null;
      this.isActive = true;
    } else if (this.editorMessage === EM.SemanticDifference){
      this.clearError();
      doUpdate = true;
      this.playerState = PS.Unfinished;
      this.editorMessage = null;
      this.isActive = true;
    } else if (this.editorMessage === EM.Error){
      this.playerState = PS.Error;
      this.editorMessage = null;
      this.isActive = true;
    } else if (this.mouseMessage){
      if (!this.lastCleanupFunction){
        throw Error('mouse message but no cleanup function');
      }
      this.lastCleanupFunction();
      this.mouseMessage = null;
      this.isActive = true;
    }

    // Determine next action based on state
    if (this.playerState === PS.Initial){
      doUpdate = true;
    } else if (this.playerState === PS.Error){
      // nop, and don't schedule this.
      this.runSomeScheduled = false;
      return;
    } else if (this.playerState === PS.Finished){
      this.setClickToRestart();
      this.runSomeScheduled = false;
      return;
    }

    if (!this.isActive){
      console.log("Won't reschedule runSome because this widget is inactive!");
      this.setMouseinToPlay();
      this.runSomeScheduled = false;
      return;
    }
    this.runSomeScheduled = true;

    var part2 = () => {
      this.runSomeScheduled = true;
      this.runner.runABit(this.speed,
        (moreToRun)=>{
          if (moreToRun === 'error'){
            this.playerState = PS.Error;
          } else if (moreToRun){
            this.playerState = PS.Unfinished;
          } else {
            this.playerState = PS.Finished;
          }
          // long-running loop, so use setTimeout to allow other JS to run
          setTimeout( () => this.runSome(), 0);
        },
        this.DEBUGMODE ? undefined : e => this.onRuntimeOrSyntaxError(e));
    };

    if (doUpdate){
      var s = this.editor.getValue();
      this.runner.update(s, part2);
    } else {
      part2();
    }

  };

  /** Invoked only by change handler */
  DalSegno.prototype.onChange = function(e){
    console.log('onChange running');
    var s = this.editor.getValue();
    var safelyParses = false;
    try {
      safelyParses = bcexec.safelyParsesAndCompiles(s, this.DEBUGMODE ? undefined : e => this.onRuntimeOrSyntaxError(e));
    } finally {
      // try/finally so message still sent in debug mode
      if (!safelyParses){
        this.sendMessageFromEditor(EM.SyntaxError);
        return;
      }
    }

    this.onChangeIfValid(s);

    if (JSON.stringify(parse(s)) === this.lastProgram){
      this.lastProgram = s;
      this.sendMessageFromEditor(EM.SyntacticDifference);
    } else {
      this.lastProgram = s;
      this.sendMessageFromEditor(EM.SemanticDifference);
    }
  };
  DalSegno.prototype.sendMessageFromEditor = function(msg){
    this.isActive = true;
    this.editorMessage = msg;
    if (this.runSomeScheduled){
      return;
    }
    if (msg === EM.SyntaxError){
      this.playerState = PS.Error;
    }
    this.ensureRunSomeScheduled();
  };
  DalSegno.prototype.initWindowWatcher = function(){
    if (DalSegno.windowWatcherSet){ return; }
    window.addEventListener('blur', function(){
      console.log('tab seems inactive!');
      DalSegno.activeWidget = undefined;
    });
    DalSegno.windowWatcherSet = true;
  };
  DalSegno.prototype.onRuntimeOrSyntaxError = function(e){
    console.log(e.stack);
    this.errorbar.innerText = ''+e;
    this.errorbar.classList.remove('is-hidden');
    if (e.ast){
      Range = ace.require("ace/range").Range;
      //TODO investigate error annotations instead of markers
      if (this.badSpot){
        this.editor.getSession().removeMarker(this.badSpot);
      }
      this.badSpot = this.editor.session.addMarker(new Range(
        e.ast.lineStart-1,
        e.ast.colStart-1,
        e.ast.lineEnd-1,
        e.ast.colEnd), "errorHighlight");
      this.editor.resize(true);  // Ace editor bug requires this before nextline
      this.editor.scrollToLine(e.ast.lineStart-1, true, true, function(){});
      //this.editor.gotoLine(e.ast.lineStart-1, e.ast.colEnd-1);
    }
  };
  DalSegno.prototype.clearError = function(){
    this.errorbar.classList.add('is-hidden');
    if (this.badSpot){
      this.editor.getSession().removeMarker(this.badSpot);
      this.badSpot = undefined;
    }
  };
  DalSegno.prototype.highlightCurSpot = function(spot){
    if (this.curSpot){
      this.editor.getSession().removeMarker(this.curSpot);
    }
    if (!spot){ return; }
    Range = ace.require("ace/range").Range;
    //TODO investigate error annotations instead of markers
    this.curSpot = this.editor.session.addMarker(new Range(
      spot.lineStart-1,
      spot.colStart-1,
      spot.lineEnd-1,
      spot.colEnd), "curSpotHighlight");
    console.log('marker added at', spot);
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
    editorContainer.classList.add('dalsegno-editor');

    this.editor.setValue(this.initialContent, -1);

    this.editor.getSession().on('change', e => this.onChange(e));

    this.errorbar = document.getElementById(this.errorBarId);
    this.errorbar.classList.add('dalsegno-errorbar');
    this.clearError();
  };
  DalSegno.prototype.initConsole = function(){
    this.consoleElement = document.getElementById(this.consoleId);
    this.consoleElement.classList.add('dalsegno-console');
    this.consoleElement.readOnly = true;

    function preventScrollIfFullyScrolled(e){
      var d = e.wheelDelta || -e.detail,
          dir = d > 0 ? 'up' : 'down',
          stop = (dir == 'up' && this.scrollTop === 0) ||
                 (dir == 'down' && this.scrollTop === this.scrollHeight - this.offsetHeight);
      if (stop){
        e.preventDefault();
      }
    }
    this.consoleElement.addEventListener('mousewheel',
      preventScrollIfFullyScrolled);
    this.consoleElement.addEventListener('DOMMouseScroll',
      preventScrollIfFullyScrolled);

    this.console = new Console(this.consoleId);
  };
  DalSegno.prototype.initScrubber = function(){
    this.scrubber = document.getElementById(this.scrubberId);
    this.snapshots = [];
  };
  DalSegno.prototype.initTrackers = function(){
    this.mouseTracker = new MouseTracker(this.canvasId);
    this.keyboardTracker = new KeyboardTracker(this.canvasId);
  };
  DalSegno.prototype.initGraphics = function(){
    if (!this.canvasId){ throw Error('No canvas id provided'); }
    if (!document.getElementById(this.canvasId)){ throw Error("can't find canvas from id"); }
    this.canvas = document.getElementById(this.canvasId);
    this.canvas.classList.add('dalsegno-canvas');
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;
    this.lazyCanvasCtx = new LazyCanvasCtx(this.canvasId, true, false);
    this.drawHelpers = new DrawHelpers(this.lazyCanvasCtx, document.getElementById(this.canvasId));
  };
  DalSegno.prototype.envBuilder = function(){
    return bcrun.buildEnv(
      [builtins,
       stdlibcode,
       {}],
      [].concat(
        [window, console],
        this.canvas ? [this.canvas, this.lazyCanvasCtx, this.drawHelpers] : [],
        this.mouseTracker ? [this.mouseTracker] : [],
        this.keyboardTracker ? [this.keyboardTracker] : [],
        this.console ? [this.console] : [backupConsole]),
      this.runner);
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
