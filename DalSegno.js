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
  var bcstdlib = require("./bcstdlib.js");
  var LazyCanvasCtx = require("./LazyCanvasCtx.js");
  var DrawHelpers = require("./DrawHelpers.js");

  //TODO Was this better as a closure? It feels weird as an object.
  function DalSegno(editorId, canvasId, errorBarId, consoleId, funsId, initialProgramId){
    this.shouldReload = true;  // whether the editor has a different AST
                               // than the one last executed
    this.shouldRestart = false;  // despite same source code, run again
    this.currentlyRunning = false;  // whether there's more of the currently
                                    // loaded program to run
    this.inErrorState = false;  // in error state the only way to restart is to edit
    this.lastProgram = '';  // string of the currently running program's AST
                            // or an empty string if the program doesn't parse
    this.speed = 500;  // number of bytecode steps run per this.runABit()
    this.badSpot = undefined;  // currently highlighted ace Range of source code
    this.DEBUGMODE = true;  // throw errors properly so we see tracebacks
    this.onChangeIfValid = function(s){};  // called after valid parse with new program

    this.editorId = editorId;
    this.canvasId = canvasId;
    this.consoleId = consoleId;
    this.errorBarId = errorBarId;
    this.funsId = funsId;

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
    if (this.funsId){ this.initFunsWatcher(); }

    this.runner.registerStateful(this.lazyCanvasCtx);

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
    this.canvasMessage(['Mouse over canvas',
                        'or edit source',
                        this.currentlyRunning ? 'to resume program.' : 'to start program.']);
    var self = this;
    function cleanup(){
      self.canvas.removeEventListener('mouseenter', clearAndHideAndGo);
      ctx.putImageData(self.savedImage, 0, 0);
    }
    function clearAndHideAndGo(){
      cleanup();
      self.lastResumeCleanupFunction = undefined;
      self.go();
    }
    this.canvas.addEventListener('mouseenter', clearAndHideAndGo);
    this.lastResumeCleanupFunction = cleanup;
  };
  DalSegno.prototype.setClickToRestart = function(){
    var ctx = this.canvas.getContext("2d");
    this.canvasMessage(['Program finished.',
                        'Click canvas or',
                        'edit source',
                        'to run it again.'], 'lowerRight');
    var self = this;
    function cleanup(){
      self.canvas.removeEventListener('click', clearAndGo);
      ctx.clearRect(0, 0, 10000, 10000);
    }
    function clearAndGo(){
      cleanup();
      self.lastResumeCleanupFunction = undefined;
      self.shouldRestart = true;
      self.go();
    }
    this.canvas.addEventListener('click', clearAndGo);
    this.lastResumeCleanupFunction = cleanup;
  };
  DalSegno.prototype.runABit = function(){
    this.updateFunsWatcher();
    var s = this.editor.getValue();
    if (this.shouldReload){
      this.clearError();
      this.shouldReload = false;
      // in case the editor source changed when a restart was intended
      this.shouldRestart = false;
      if (bcexec.safelyParsesAndCompiles(s, e => this.errback(e))){
        this.runner.update(s);
        this.currentlyRunning = this.runner.runABit(1, e => this.errback(e));
      } else {
        this.currentlyRunning = false;
        return;
      }
    } else if (this.shouldRestart){
      // for the case when the program finished successfully and we want to run it again
      this.shouldRestart = false;
      this.runner.restart();
      this.currentlyRunning = true;
    } else if (this.inErrorState){
      return;  // don't do anything until enough change is made that shouldReload is triggered.
    }
    if (DalSegno.activeWidget === this) {
      if (this.currentlyRunning){
        this.currentlyRunning = this.runner.runABit(this.speed, e => this.errback(e) );
        if (this.currentlyRunning) {
          setTimeout( () => this.runABit(), 0);
        } else if (!this.inErrorState){
          this.setClickToRestart();
        }
      }
    } else {
      this.setMouseinToPlay();
    }
  };
  DalSegno.prototype.initFunsWatcher = function(){
    this.funsWatcherDiv = document.getElementById(this.funsId);
  };
  DalSegno.prototype.updateFunsWatcher = function(){
    if (!this.funsWatcherDiv){ return; }
    var whenCalled = Object.keys(this.runner.funs)
      .map( name => [this.runner.savedStates[name] ?
                       this.runner.savedStates[name].counter : -1,
                     name,
                     this.runner.savedStates[name] ?
                       this.runner.savedStates[name].statefuls[0].get('imageData') :
                      "data:image/gif;base64,R0lGODlhAQABAIAAAP7//wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw=="
      ] )
      .filter( pair => pair[0] > -1 );
    whenCalled.sort( (a, b) => a[0]-b[0] );
    whenCalled.reverse();
    var lastURI = '';
    function funcDiv(name, im){
      var div = `<div style:"border:solid;border:1px;border:red;width:100%">
      ${name}
      <br>` +
      (im === lastURI ? '' : `<img width="100" height="100" alt="saved" src="${im}" />`) +
      `</div>`;
      lastURI = im;
      return div;
    }
    scrubber = document.getElementById('scrubber2');

    var s = whenCalled.map( pair => funcDiv(pair[1], pair[2]) ).join('\n');
    //this.funsWatcherDiv.innerHTML = 'Most recently executed functions:\n'+s;
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
    console.log('onChange running');
    DalSegno.activeWidget = this;

    var s = this.editor.getValue();
    if (!bcexec.safelyParsesAndCompiles(s, e => this.errback(e))){
      if (this.lastResumeCleanupFunction){ this.lastResumeCleanupFunction(); }
      this.lastProgram = '';
      this.currentlyRunning = false;
      return;
    }

    var newProgram = JSON.stringify(parse(s));
    if (newProgram === this.lastProgram){
      return;
    }
    if (this.lastResumeCleanupFunction){ this.lastResumeCleanupFunction(); }
    this.onChangeIfValid(s);
    this.lastProgram = newProgram;
    this.shouldReload = true;
    if (!this.currentlyRunning){
      this.currentlyRunning = true;
      this.runABit();
    }
  };
  DalSegno.prototype.errback = function(e){
    console.log(e.stack);
    this.currentlyRunning = false;
    this.inErrorState = true;
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
    this.inErrorState = false;
    this.errorbar.classList.add('is-hidden');
    if (this.badSpot){
      this.editor.getSession().removeMarker(this.badSpot);
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
