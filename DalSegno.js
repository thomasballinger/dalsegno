// This module only works in the browser
// (potential TODO: move things out of here so they can be tested with node)
'use strict';

var Immutable = require("./Immutable.js");
var parse = require("./src/parse.js");
var Environment = require("./src/Environment.js");
var run = require("./src/run.js");
var bcexec = require("./src/bcexec.js");
var builtins = require("./src/builtins.js");
var MouseTracker = require("./src/MouseTracker.js");
var KeyboardTracker = require("./src/KeyboardTracker.js");
var stdlibcode = require("./src/stdlibcode.js");
var LazyCanvasCtx = require("./LazyCanvasCtx.js");
var DrawHelpers = require("./src/DrawHelpers.js");
var Console = require("./src/Console.js");
var Scrubber = require("./src/Scrubber.js");
var humanize = require("./src/humanize.js");


function State(state, msg){ this.state = state; this.msg = msg; }
State.prototype.toString = function(){ return this.state + ': '+this.msg; };
// Always use object identity to compare these (===)


var PS = {
  Initial: new State('Initial', `mousein to start`),
  Unfinished: new State('Unfinished', `running, or mousein to resume`),
  Finished: new State('Finished', `click to restart`),
  Error: new State('Error', `No handlers needed, editor onChange has got it`),
  History: new State('History', `viewing old history`),

  // TODO create a state for mid-animation?

  //HistoryKeyframe: new State('PausedAtKeyframe', ``),
  HistoryAtEnd: new State('Unfinished, but paused', ``),
  HistoryAtBeginning: new State('Initial, but paused', ``),
  //HistoryBetweenKeyframes: new State('stepping between things'),
};

// Editor messages
var EM = {
  SyntaxError: new State('SyntaxError', `the source code is obviously invalid`),
  SyntacticDifference: new State('SyntacticDifference', `the source code has unimportant changes like more whitespace`),
  SemanticDifference: new State('SemanticDifference', ``),
};


function DalSegno(editorId, canvasContainerId, errorBarId, consoleId, scrubberId, initialProgramId, controlsContainerId){
  //The important state properties are
  //playerState and isActive.
  //All messages should be able to be dealt with
  //in any combination of these states.

  this.editorMessage = null;
  this.mouseMessage = null;
  this.scrubberMessage = null;
  this.controlsMessage = null;

  this.playerState = PS.Initial;
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

  this.runSomeScheduled = false; // on processing an action, if followup is required
                                 // ensureRunSomeScheduled should probably be called.
  this.lastProgram = '';  // string of the currently running program's AST
                          // or an empty string if the program doesn't parse
  this.lastCleanupFunction = undefined; // cleans up message over canvas
  this.speed = 500;  // number of bytecode steps run per this.startRunning()
  this.highlight = false;  // whether to highlight each time an operation happens
  this.badSpot = undefined;  // currently highlighted ace Range of source code for error
  this.curSpot = undefined;  // currently highlighted ace Range of source code for cur
  this.DEBUGMODE = false;  // throw errors properly so we see tracebacks
  this.onChangeIfValid = function(s){};  // called after valid parse with new program
  this.rewindEffectCleared = true;

  this.editorId = editorId;
  this.canvasContainerId = canvasContainerId;
  this.consoleId = consoleId;
  this.errorBarId = errorBarId;
  this.scrubberId = scrubberId;
  this.controlsContainerId = controlsContainerId;

  initialProgramId = initialProgramId || editorId;
  this.initialContent = document.getElementById(initialProgramId);
  if (this.initialContent === null){
    this.initialContent = initialProgramId;
  } else {
    this.initialContent = this.initialContent.textContent;
  }
  this.onChangeIfValid(this.initialContent);

  this.runner = new run.Runner({});
  this.runner.setEnvBuilder( () => this.envBuilder() );

  this.initEditor();
  if (this.consoleId){ this.initConsole(); }
  this.initGraphics();
  this.initTrackers();
  if (this.scrubberId){ this.initScrubber(); }
  if (this.controlsContainerId){
    this.initControls();
  }
  this.updateControls();

  this.runner.registerStateful(this.lazyCanvasCtx);
  this.runner.registerRenderRequester(this.lazyCanvasCtx);

  this.initWindowWatcher();
  this.setMouseinToPlay();

  DalSegno.widgets.push(this);
}
DalSegno.activeWidget = undefined;
DalSegno.widgets = [];
DalSegno.windowWatcherSet = false;
/** User wants to see something */
DalSegno.prototype.go = function(){
  this.isActive = true;
  this.ensureRunSomeScheduled();
};
DalSegno.prototype.link = function(){
  //TODO links to versions without editors or with a console
  var base = 'http://dalsegno.ballingt.com/fullscreen/';
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
    self.effectCanvas.removeEventListener('mouseenter', handler);
    ctx.putImageData(self.savedImage, 0, 0);
    self.lastCleanupFunction = undefined;
  }
  self.lastCleanupFunction = cleanup;
  function handler(){
    self.mouseMessage = true;
    self.ensureRunSomeScheduled();
  }
  this.effectCanvas.addEventListener('mouseenter', handler);
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
    self.effectCanvas.removeEventListener('click', handler);
    ctx.clearRect(0, 0, 10000, 10000);
    self.lastCleanupFunction = undefined;
  }
  self.lastCleanupFunction = cleanup;
  function handler(){
    self.mouseMessage = true;
    self.ensureRunSomeScheduled();
  }
  this.effectCanvas.addEventListener('click', handler);
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

  /* TODO follow this goal structure:
   * Events may be tossed based on current state
   * Events change these intention variables
   * Actions are taken based on intention variables,
   * these actions may change the current playerState
   */

  // Actions a message has requested
  var doUpdate = false;
  var seekTo = false;
  var stepDelta = false;
  var stepToPrevKeyframe = false;
  var stepToNextKeyframe = false;
  var forkTimeline = false;

  // Check Queued Events
  if (this.editorMessage === EM.SyntacticDifference){
    //difference in editor is only syntactic, nothing special to do
    this.editorMessage = null;
    this.isActive = true;
  } else if (this.editorMessage === EM.SemanticDifference){
    this.clearError();
    doUpdate = true;
    this.playerState = PS.Unfinished;  //TODO the action should trigger this instead
    this.editorMessage = null;
    this.isActive = true;
  } else if (this.editorMessage === EM.Error){
    this.playerState = PS.Error;  //TODO the action should trigger this instead
    this.editorMessage = null;
    this.isActive = true;
  } else if (this.mouseMessage){
    if (!this.lastCleanupFunction){
      console.warn('mouse message but no cleanup function');
    } else {
      this.lastCleanupFunction();
    }
    this.mouseMessage = null;
    this.isActive = true;
  } else if (this.scrubberMessage !== null){
    this.clearError();
    this.clearCurSpot();
    this.isActive = true;
    this.playerState = PS.History;  //TODO the action should trigger this instead
    seekTo = this.scrubberMessage;
    this.scrubberMessage = null;
  } else if (this.controlsMessage !== null){
    var [action, arg] = this.controlsMessage;
    this.controlsMessage = null;
    if (action === 'step back'){
      stepDelta = -1 * arg;
    } else if (action === 'step forward'){
      stepDelta = arg;
    } else if (action === 'next keyframe'){
      stepToNextKeyframe = true;
    } else if (action === 'prev keyframe'){
      stepToPrevKeyframe = true;
    } else if (action === 'fork timeline'){
      forkTimeline = true;
    } else {
      throw Error('bad controlsMessage action:', action);
    }

    if (this.playerState == PS.History){
      // For now, all this history steps are only allowed if the slider
      // has already been used.
      //
      //TODO set state once they're finished! Or in their logic.
      //What should playerState be while they're running?
      this.updateControls();
      if (stepDelta){
        if (stepDelta < 0){
          this.stepHistoryBackward(-1 * stepDelta);
        } else {
          this.stepHistoryForward(stepDelta);
        }
        return;
      }

      if (stepToPrevKeyframe){
        this.stepHistoryToPrevKeyframe();
        return;
      }
      if (stepToNextKeyframe){
        this.stepHistoryToNextKeyframe();
        return;
      }
      if (forkTimeline){
        this.forkTimeline();
        return;
      }
    } else if (this.playerState === PS.HistoryAtEnd){
      if (forkTimeline){
        // which is accomplished by just falling through
      } else if (stepDelta){
        if (stepDelta < 0){
          this.stepHistoryBackward(-1 * stepDelta);
        }
        return;
      } else if (stepToPrevKeyframe){
        this.stepHistoryToPrevKeyframe();
        this.updateControls();
        return;
      } else {
        // For now the only thing that can make the program keep running
        // is forkTimeline, so otherise return here.
        return;
      }
    } else if (this.playerState === PS.HistoryAtBeginning){
      if (forkTimeline){
        this.playerState = PS.Initial;
        this.updateControls();
        this.ensureRunSomeScheduled();
        return;
      } else if (stepDelta){
        if (stepDelta > 0){
          this.stepHistoryForward(stepDelta);
        }
        return;
      } else if (stepToNextKeyframe){
        this.stepHistoryToNextKeyframe();
        this.updateControls();
        return;
      } else {
        // For now the only thing that can make the program keep running
        // is forkTimeline, so control is a nop
        return;
      }
    }
  }

  this.updateControls();

  // Determine next action based on state
  if (this.playerState === PS.Initial){
    //May not be syntactically valid, so we have to check.
    var safelyParses = false;
    var s = this.editor.getValue();
    try {
      safelyParses = bcexec.safelyParsesAndCompiles(s, this.DEBUGMODE ? undefined : e => this.onRuntimeOrSyntaxError(e));
    } finally {
      // try/finally so message still sent in debug mode
      if (!safelyParses){
        this.sendMessageFromEditor(EM.SyntaxError);
        return;
      }
    }
    doUpdate = true;
  } else if (this.playerState === PS.Error){
    // nop, and don't schedule this.
    this.runSomeScheduled = false;
    return;
  } else if (this.playerState === PS.Finished){
    this.setClickToRestart();
    this.runSomeScheduled = false;
    return;
  } else if (this.playerState === PS.History){
    if (seekTo !== false){
      if (seekTo === 'first'){
        this.playerState = PS.HistoryAtBeginning;
      } else if (seekTo === 'last'){
        this.playerState = PS.HistoryAtEnd;
      } else {
        //console.log('seeking to', seekTo);
        this.runner.instantSeekToNthKeyframe(seekTo);
        this.drawPauseEffect();
        this.runSomeScheduled = false;
      }
    }
    this.updateControls();
    return;
  }

  if (!this.isActive){
    //Won't reschedule runSome because this widget is inactive
    this.setMouseinToPlay();
    this.runSomeScheduled = false;
    return;
  }
  this.runSomeScheduled = true;

  var run = () => {
    this.clearEffect();
    if (this.highlight){
      this.highlightCurSpot(this.runner.getCurrentAST());
    }
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
        this.updateControls();
        // long-running loop, so use setTimeout to allow other JS to run
        // setTimeout( () => this.runSome(), 16.0);
        window.requestAnimationFrame( () => this.runSome() );
      },
      this.DEBUGMODE ? undefined : e => this.onRuntimeOrSyntaxError(e));
  };

  if (doUpdate){
    var s = this.editor.getValue();
    this.runner.update(s, (change)=>{
      if (!change){ run(); return; }
      if(this.lazyCanvasCtx){
        this.drawPlayEffect();
        setTimeout(()=>{
          this.clearEffect();
          run();
        }, 200);
      } else {
        run();
      }
    });
  } else {
    run();
  }
};

DalSegno.prototype.forkTimeline = function(){
  //todo do this through message passing instead of invoking directly
  this.clearError();
  this.clearCurSpot();

  this.runner.clearBeyond();
  this.scrubber.dropBeyond(()=>{
    this.playerState = PS.Unfinished;
    this.updateControls();
    this.go();
  });
};
DalSegno.prototype.stepHistoryToNextKeyframe = function(){
  var dest = this.runner.nextKeyframeIndex(this.runner.counter+1);
  if (dest === null){
    //TODO should go to last playable frame - this isn't
    //even stored anywhere right now I don't think.
    //HACK: for now, just go to final spot
    this.playerState = PS.HistoryAtEnd;
    this.updateControls();
    return;  // this is actually pretty reasonable behavior, maybe keep it?
    throw Error('Not implemented');
  }
  this.stepHistoryTo(this.runner.keyframeNums[dest]);
};
DalSegno.prototype.stepHistoryToPrevKeyframe = function(){
  var dest = this.runner.prevKeyframeIndex(this.runner.counter-1);
  if (dest === null){
    //TODO should do a reset
    // tmp hack for now: put us at the beginning
    this.playerState = PS.HistoryAtBeginning;
    this.updateControls();
    return;
    throw Error('Not implemented');
  }
  this.stepHistoryTo(this.runner.keyframeNums[dest]);
};
DalSegno.prototype.withStrictCanvas = function(cb){
  var origLazy, origRewindEffect;
  if (this.lazyCanvasCtx){
    origLazy = this.lazyCanvasCtx.lazy;
    origRewindEffect = this.lazyCanvasCtx.rewindEffect;
    this.lazyCanvasCtx.lazy = false;
  }
  try {
    return cb();
  } finally {
    if (this.lazyCanvasCtx){
      this.lazyCanvasCtx.lazy = origLazy;
    }
  }
};
DalSegno.prototype.stepHistoryTo = function(dest){
  if (dest < this.runner.counter){
    this.stepHistoryBackward(this.runner.counter - dest);
  } else if (dest > this.runner.counter){
    this.stepHistoryForward(dest - this.runner.counter);
  }
};
DalSegno.prototype.stepHistoryForward = function(n){
  if (this.runner.atEnd()){
    // one forward from the last step is the special end spot
    this.playerState = PS.HistoryAtEnd;
    this.updateControls();
    return;
  }
  this.playerState = PS.History;
  return this.withStrictCanvas(()=>{
    if (n === undefined){ n = 1; }
    this.highlightCurSpot(this.runner.getCurrentAST(), n === 1);
    this.drawPauseEffect();
    this.runner.runOneStep(true);

    // this means it's a key frame
    var sliderIndex = this.runner.prevKeyframeIndex();
    this.scrubber.setCurrentIndex(sliderIndex);
    if (n > 1){
      setTimeout(()=> this.stepHistoryForward(n-1), 0);
    }
    //TODO check to see if there are no more history frames left!
    // (needs to be saved somewhere: the last counter ever run)
  });
};
DalSegno.prototype.stepHistoryBackward = function(n){
  if (this.runner.atStart()){
    //one back from the beginning is the special start space
    this.playerState = PS.HistoryAtBeginning;
    //TODO update slider too, or put that in updateControls
    return;
  }
  this.playerState = PS.History;
  return this.withStrictCanvas(()=>{
    if (n === undefined){ n = 1; }

    // goes one frame at a time
    var togo = this.runner.instantSeekToKeyframeBeforeBack(1);
    //TODO tmp hack: if magic number, back out
    if (togo == -42){
      this.playerState = PS.HistoryAtBeginning;
      this.updateControls();
      return;
    }
    for (var i=0; i < togo; i++){
      this.runner.runOneStep(true);
    }

    this.highlightCurSpot(this.runner.getCurrentAST(), n === 1);
    this.drawPauseEffect();
    var sliderIndex = this.runner.prevKeyframeIndex();
    this.scrubber.setCurrentIndex(sliderIndex);
    if (n > 1){
      setTimeout(()=> this.stepHistoryBackward(n-1), 0);
    }
    //TODO check to see if there are no more history frames left!
  });
};

/** Invoked only by editor change handler */
DalSegno.prototype.onChange = function(e){
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
    console.log('tab seems inactive');
    DalSegno.activeWidget = undefined;
  });
  DalSegno.windowWatcherSet = true;
};
DalSegno.prototype.onRuntimeOrSyntaxError = function(e){
  console.log(e.stack);
  this.errorbar.innerText = humanize.humanize(e);
  //this.errorbar.innerText = ''+e;
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
DalSegno.prototype.highlightCurSpot = function(spot, scrollTo){
  if (this.curSpot){
    this.editor.getSession().removeMarker(this.curSpot);
  }
  if (scrollTo === undefined){
    scrollTo = false;
  }
  if (!spot){ return; }
  Range = ace.require("ace/range").Range;
  //TODO investigate error annotations instead of markers
  this.curSpot = this.editor.session.addMarker(new Range(
    spot.lineStart-1,
    spot.colStart-2,
    spot.lineEnd-1,
    spot.colEnd), "curSpotHighlight");
  if (scrollTo){
    this.editor.scrollToLine(spot.lineStart-1, true, true, function(){});
  }
};
DalSegno.prototype.clearCurSpot = function(){
  if (this.curSpot){
    this.editor.getSession().removeMarker(this.curSpot);
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
DalSegno.prototype.updateControls = function(){
//TODO I'm not sure all the calls to updateControls are necessary, reason through each of them
  if (this.playerState === this.lastUpdateControlsState){ return; }
  if (!this.controlsContainerId){ return; }

  this.lastUpdateControlsState = this.playerState;

  var allClasses = [
    'dalsegno-rw-1',
    'dalsegno-rw-200',
    'dalsegno-fw-1',
    'dalsegno-fw-200',
    'dalsegno-prev-keyframe',
    'dalsegno-next-keyframe',
    'dalsegno-fork-timeline',
    'dalsegno-scrubber'
  ];
  var allEnabled = {}; allClasses.forEach((prop)=>{ allEnabled[prop] = true; });
  var allDisabled = {}; allClasses.forEach((prop)=>{ allDisabled[prop] = false; });
  //TOM TODO TOMHERE currently working walking through all controls and toggling them as appropriate.

  var forkText = 'run program from here; change the future';
  var isEnabled = {};
  if (this.playerState === PS.Initial){
    isEnabled = allDisabled;
  } else if (this.playerState === PS.Unfinished){
    isEnabled = allDisabled;
    //TODO allow stepping back from here,
    // and make stepping back pause running then step back
    isEnabled['dalsegno-scrubber'] = true;
  } else if (this.playerState === PS.Finished){
    isEnabled = allDisabled;
    isEnabled['dalsegno-rw-1'] = true;
    isEnabled['dalsegno-rw-200'] = true;
    isEnabled['dalsegno-prev-keyframe'] = true;
    isEnabled['dalsegno-scrubber'] = true;
  } else if (this.playerState === PS.HistoryAtEnd){
    this.scrubber.setCurrentIndexToEnd();
    isEnabled = allDisabled;
    isEnabled['dalsegno-rw-1'] = true;
    isEnabled['dalsegno-rw-200'] = true;
    isEnabled['dalsegno-prev-keyframe'] = true;
    isEnabled['dalsegno-fork-timeline'] = true;
    isEnabled['dalsegno-scrubber'] = true;
    forkText = 'continue execution';
  } else if (this.playerState === PS.HistoryAtBeginning){
    isEnabled = allDisabled;
    isEnabled['dalsegno-fw-1'] = true;
    isEnabled['dalsegno-fw-200'] = true;
    isEnabled['dalsegno-next-keyframe'] = true;
    isEnabled['dalsegno-fork-timeline'] = true;
    isEnabled['dalsegno-scrubber'] = true;
  } else if (this.playerState === PS.History){
    isEnabled['dalsegno-scrubber'] = true;
    isEnabled = allEnabled;
  } else if (this.playerState === PS.Error){
    isEnabled = allDisabled;
  } else {
    throw Error('bad player state');
  }

  this.controlsContainer = document.getElementById(this.controlsContainerId);
  for (var el of Array.prototype.slice.call(this.controlsContainer.getElementsByTagName('*'))){
    if (allClasses.indexOf(el.className) != -1){
      var val = isEnabled[el.className];
      el.disabled = !val;
    }
    if (el.className === 'dalsegno-fork-timeline'){
      el.textContent = forkText;
    }
  }
};
DalSegno.prototype.initControls = function(){
  // Look for each control and
  //   * hook it up
  //   * remember to enable/disable it as appropriate
  // Identify their action by class
  //

  var inputClasses = {
    'dalsegno-rw-1': ['step back', 1],
    'dalsegno-rw-200': ['step back', 200],
    'dalsegno-fw-1': ['step forward', 1],
    'dalsegno-fw-200': ['step forward', 200],
    'dalsegno-prev-keyframe': ['prev keyframe', null],
    'dalsegno-next-keyframe': ['next keyframe', null],
    'dalsegno-fork-timeline': ['fork timeline', null],
  };

  this.controlsContainer = document.getElementById(this.controlsContainerId);
  for (var el of Array.prototype.slice.call(this.controlsContainer.getElementsByTagName('*'))){
    if (el.className in inputClasses){
      //console.log('found', el.className);
      el.addEventListener('click', ((classname)=>{
        return ()=>{
          this.controlsMessage = inputClasses[classname];
          this.ensureRunSomeScheduled();
        };
      })(el.className));
    }
  }
};
DalSegno.prototype.initScrubber = function(){
  this.scrubber = new Scrubber(this.scrubberId);
  this.scrubber.update(0, 0);
  var onRender = (nums) => {
    this.scrubber.update(nums.length, nums.length);
  };
  this.runner.registerRenderCallback(onRender);
  this.scrubber.callback = (msg) => {
    this.scrubberMessage = msg;
    this.ensureRunSomeScheduled();
  };
};
DalSegno.prototype.initTrackers = function(){
  this.mouseTracker = new MouseTracker(this.effectCanvasId);
  this.keyboardTracker = new KeyboardTracker(this.effectCanvasId);
};
DalSegno.prototype.initGraphics = function(){
  if (!this.canvasContainerId){ throw Error('No canvas container provided'); }
  this.canvasContainer = document.getElementById(this.canvasContainerId);

  var r = this.canvasContainer.querySelectorAll('canvas');
  [this.canvas, this.effectCanvas] = [r[0], r[1]];
  // hack b/c in Safari nodelist (what querySelectorAll returns) seems not to be destructurable?

  if (!this.canvas || !this.effectCanvas){ throw Error("can't find both canvases"); }
  this.canvas.width = this.canvasContainer.offsetWidth;
  this.canvas.height = this.canvasContainer.offsetHeight;
  this.effectCanvas.width = this.canvasContainer.offsetWidth;
  this.effectCanvas.height = this.canvasContainer.offsetHeight;
  this.canvasId = uniqueId(this.canvas);
  this.effectCanvasId = uniqueId(this.effectCanvas);
  this.effectCanvas.style.backgroundColor = 'transparent';

  this.lazyCanvasCtx = new LazyCanvasCtx(this.canvasId, true, false);
  this.lazyCanvasCtx.drawRewindEffect = ()=>{ this.drawRewindEffect(); };
  this.drawHelpers = new DrawHelpers(this.lazyCanvasCtx, document.getElementById(this.canvasId));

  this.effectCtx = this.effectCanvas.getContext('2d');
  this.effectCtx.clearRect(0, 0, 10000, 10000);
};
DalSegno.prototype.drawRewindEffect = function(){
  this.effectCleared = false;
  var w = this.effectCanvas.width;
  var h = this.effectCanvas.height;
  drawRewindLines(this.effectCtx, w, h);
  drawRewindIcon(this.effectCtx, w, h);
};
DalSegno.prototype.drawPauseEffect = function(){
  this.effectCleared = false;
  var w = this.effectCanvas.width;
  var h = this.effectCanvas.height;
  drawRewindLines(this.effectCtx, w, h);
};
DalSegno.prototype.drawPlayEffect = function(){
  this.effectCleared = false;
  var w = this.effectCanvas.width;
  var h = this.effectCanvas.height;
  drawRewindLines(this.effectCtx, w, h);
  drawPlayIcon(this.effectCtx, w, h);
};
DalSegno.prototype.clearEffect = function(){
  if (this.effectCleared){ return; }
  this.effectCleared = true;
  this.effectCtx.clearRect(0, 0, 10000, 10000);
};
DalSegno.prototype.envBuilder = function(){
  return run.buildEnv(
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

/** If string, passthrough. If element, that element's id */
function uniqueId(element){
  if (!element){ return element; }
  if (typeof element === 'string'){ return element; }
  if (element.id !== ""){
    return element.id;
  }
  var sym = "";
  do {
    sym = "generated-id-" + Math.random().toString(16).slice(2);
  } while (document.getElementById(sym) !== null);
  element.id = sym;
  return sym;
}

function findScriptTags(){
  var tags = Array.prototype.slice.call(document.querySelectorAll('script'));
  var dalSegnoTags = tags.filter((el)=>el.type == 'dalsegno');
  var embeds = dalSegnoTags.forEach((el)=>createEmbed(el));
}

function createEmbed(script){
  var enclosing = script.parentNode;
  if (enclosing.tagName !== "DIV"){
    console.warn('Embed failed, dalsegno script must be inside a div');
  }

  var canvasWidth = parseInt(script.dataset.canvasWidth) || 400;
  var canvasHeight = parseInt(script.dataset.canvasHeight) || 400;

  var leftPanel = document.createElement('div');
  leftPanel.className = 'left-panel';
  var editorDiv = document.createElement('div');
  editorDiv.style.height = enclosing.clientHeight;
  editorDiv.style.width = enclosing.clientWidth - canvasWidth;
  editorDiv.className = 'editor';
  leftPanel.appendChild(editorDiv);
  var textarea = document.createElement('textarea');
  textarea.className = 'console';
  leftPanel.appendChild(textarea);
  var controlsDiv;
  var scrubber;
  if (script.dataset.stepControls){
    controlsDiv = document.createElement('div');
    controlsDiv.className = 'controls';
    leftPanel.appendChild(controlsDiv);
    controlsDiv.innerHTML = CONTROLS_HTML;
    var scrubber = controlsDiv.querySelector('input');
  }
  enclosing.appendChild(leftPanel);

  var canvasContainer = document.createElement('div');
  canvasContainer.className = 'canvas-container';
  var canvas1 = document.createElement('canvas');
  var canvas2 = document.createElement('canvas');
  canvasContainer.style.width = canvasWidth;
  canvasContainer.style.height = canvasHeight;

  var errorDiv = document.createElement('div');
  canvasContainer.appendChild(errorDiv);

  canvasContainer.appendChild(errorDiv);
  canvasContainer.appendChild(canvas1);
  canvasContainer.appendChild(canvas2);
  enclosing.appendChild(canvasContainer);

  enclosing.classList.add('dalsegno-embed');

  if (getComputedStyle(enclosing, null).display === 'none'){
    // If the Dal Segno embed isn't visible, we won't be able to
    // create its canvases anyway, so don't even bother making it.
    return;
  }

  var embed = new DalSegno(uniqueId(editorDiv),
                           uniqueId(canvasContainer),
                           uniqueId(errorDiv),
                           uniqueId(textarea),
                           uniqueId(scrubber),
                           window[script.dataset.program] || '(display "program not found")',
                           uniqueId(controlsDiv)
  );
  embed.scriptId = script.id;
  if (script.dataset.editor === 'read-only'){
    embed.editor.setReadOnly(true);
  }

  embed.speed = 50;  // how many ticks to run at a time, default is 500
  if (script.dataset.speed){
    embed.speed = parseInt(script.dataset.speed);
  }
  if (script.dataset.astHighlight){
    embed.highlight = true;
  }
  var theme = script.dataset.theme || "solarized_light";
  embed.editor.setTheme("ace/theme/"+theme);
    /*
  embed.onChangeIfValid = function(){
    var fullscreen = document.getElementById('fullscreen2');
    fullscreen.setAttribute('href', embed.link());
  };
  embed.onChangeIfValid(embed.initialContent);
  */
  return;
}

var CONTROLS_HTML = `
  <div class="button-row">
    <button
      class="dalsegno-prev-keyframe">|&lt;&lt;</button>
    <button
      class="dalsegno-rw-200">&lt;&lt;</button>
    <button
      class="dalsegno-rw-1">&lt;</button>
    <button id="fw1"
      title="step forward a single bytecode execution"
      class="dalsegno-fw-1">&gt;</button>
    <button
      title="step forward 200 bytecode executions"
      class="dalsegno-fw-200" >&gt;&gt;</button>
    <button id="ffkeyframe"
      title="step through execution until next key frame"
      class="dalsegno-next-keyframe">&gt;&gt;|</button>
  </div>
  <input type="range" class="dalsegno-scrubber" id="scrubber2"/>
  <button id="fork"
    title="fork the timelines"
    class="dalsegno-fork-timeline">kill the future, run from here</button>
    `;

function drawRewindLines(ctx, w, h){
  var fills = ['#666', '#eee', '#888', '#bbb'];
  ctx.clearRect(0, 0, 10000, 10000);
  for (var i=0; i<10; i++){
    ctx.fillStyle = fills[Math.floor(Math.random()*fills.length)];
    ctx.fillRect(0, h/5 + Math.random()*h/12, w, h / 200);
  }
  for (i=0; i<10; i++){
    ctx.fillStyle = fills[Math.floor(Math.random()*fills.length)];
    ctx.fillRect(0, 3*h/5 + Math.random()*h/12, w, h / 200);
  }
}

function drawRewindIcon(ctx, w, h){
  ctx.fillStyle = '#eee';
  ctx.beginPath();
  ctx.moveTo(0.3*w, 0.5*h, 0);
  for (var point of [[0.3, 0.5],
                     [0.5, 0.3],
                     [0.5, 0.7],
                     [0.3, 0.5],
                     [0.5, 0.5],
                     [0.7, 0.3],
                     [0.7, 0.7],
                     [0.5, 0.5],
                    ]){
    ctx.lineTo(point[0]*w, point[1]*h);
  }
  ctx.closePath();
  ctx.fill();
}
function drawPlayIcon(ctx, w, h){
  ctx.fillStyle = '#eee';
  ctx.beginPath();
  ctx.moveTo(0.4*w, 0.5*h, 0);
  for (var point of [[0.4, 0.3],
                     [0.65, 0.5],
                     [0.4, 0.7],
                    ]){
    ctx.lineTo(point[0]*w, point[1]*h);
  }
  ctx.closePath();
  ctx.fill();
}

DalSegno.DalSegno = DalSegno;
DalSegno.findScriptTags = findScriptTags;

module.exports = DalSegno;
