// This module only works in the browser
// (potential TODO: move things out of here so they can be tested with node)
'use strict';

var Immutable = require("./Immutable.js");
var parse = require("./parse.js");
var Environment = require("./Environment.js");
var run = require("./run.js");
var bcexec = require("./bcexec.js");
var builtins = require("./builtins.js");
var MouseTracker = require("./MouseTracker.js");
var KeyboardTracker = require("./KeyboardTracker.js");
var stdlibcode = require("./stdlibcode.js");
var LazyCanvasCtx = require("./LazyCanvasCtx.js");
var DrawHelpers = require("./DrawHelpers.js");
var Console = require("./Console.js");
var Scrubber = require("./Scrubber.js");
var humanize = require("./humanize.js");


function State(state){ this.state = state; }
State.prototype.toString = function(){ return this.state + ': '+this.msg; };
// Always use object identity to compare these (===)


var PS = {
  Initial: new State('Initial', `mousein to start`),
  Unfinished: new State('Unfinished', `mousein to resume`),
  Finished: new State('Finished', `click to restart`),
  Error: new State('Error', `No handlers needed, editor onChange has got it`),
  History: new State('History', `viewing old history`),

  // going to expand History into these:

  HistoryKeyframe: new State('PausedAtKeyframe', ``),
  HistoryAtEnd: new State('Unfinished, but paused', ``),
  HistoryAtBeginning: new State('Initial, but paused', ``),
  HistoryBetweenKeyframes: new State('stepping between things'),
};

// Editor messages
var EM = {
  SyntaxError: new State('SyntaxError', `the source code is obviously invalid`),
  SyntacticDifference: new State('SyntacticDifference', `the source code has unimportant changes like more whitespace`),
  SemanticDifference: new State('SemanticDifference', ``),
};

/* message passing rules:
 *
 *
 *
 */

function DalSegno(editorId, canvasContainerId, errorBarId, consoleId, scrubberId, initialProgramId, controlsContainerId){
  //These are the four important state properties
  this.playerState = PS.Initial;
  this.runSomeScheduled = false;
  this.editorMessage = null;
  this.mouseMessage = null;
  this.scrubberMessage = null;
  this.controlsMessage = null;

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
    console.log('calling cleanup function set by setClickToRestart');
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

  var doUpdate = false;
  var seekTo = false;
  var stepDelta = false;
  var stepToPrevKeyframe = false;
  var stepToNextKeyframe = false;
  var forkTimeline = false;

  // Check Queued Events
  if (this.editorMessage === EM.SyntacticDifference){
    console.log('difference in editor is only syntactic, nothing special to do');
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
    }
    this.lastCleanupFunction();
    this.mouseMessage = null;
    this.isActive = true;
  } else if (this.scrubberMessage !== null){
    console.log('scrubber message received:', this.scrubberMessage);
    this.clearError();
    this.isActive = true;
    this.playerState = PS.History;  //TODO the action should trigger this instead
    seekTo = this.scrubberMessage;
    this.scrubberMessage = null;
  } else if (this.controlsMessage !== null){
    console.log('got a controls message:', this.controlsMessage);
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

    //TODO check state before doing these!
    //TODO set state once they're finished! Or in their logic.
    //What should playerState be while they're running?
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
        console.log('special case beginning');
        this.playerState === PS.HistoryAtBeginning;
      } else if (seekTo === 'last'){
        console.log('special case end');
        this.playerState === PS.HistoryAtEnd;
      } else {
        console.log('seeking to', seekTo);
        this.runner.instantSeekToNthKeyframe(seekTo);
        this.drawRewindEffect();
        this.runSomeScheduled = false;
      }
    }
    return;
  }

  if (!this.isActive){
    console.log("Won't reschedule runSome because this widget is inactive!");
    this.setMouseinToPlay();
    this.runSomeScheduled = false;
    return;
  }
  this.runSomeScheduled = true;

  var run = () => {
    this.clearRewindEffect();
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
        // long-running loop, so use setTimeout to allow other JS to run
        setTimeout( () => this.runSome(), 0);
      },
      this.DEBUGMODE ? undefined : e => this.onRuntimeOrSyntaxError(e));
  };

  if (doUpdate){
    var s = this.editor.getValue();
    this.runner.update(s, (change)=>{
      if (!change){ run(); return; }
      if(this.lazyCanvasCtx){
        setTimeout(()=>{
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

  this.runner.clearBeyond();
  this.scrubber.dropBeyond(()=>{
    this.playerState = PS.Unfinished;
    this.go();
  });
};
DalSegno.prototype.stepHistoryToNextKeyframe = function(){
  var dest = this.runner.nextKeyframeIndex(this.runner.counter+1);
  if (dest === null){
    //TODO should go to last playable frame - this isn't
    //even stored anywhere right now I don't think.
    throw Error('Not implemented');
  }
  console.log('current counter:', this.runner.counter);
  console.log('want to step to', dest, this.runner.keyframeNums[dest]);
  this.stepHistoryTo(this.runner.keyframeNums[dest]);
};
DalSegno.prototype.stepHistoryToPrevKeyframe = function(){
  var dest = this.runner.prevKeyframeIndex(this.runner.counter-1);
  if (dest === null){
    //TODO should do a reset
    throw Error('Not implemented');
  }
  console.log('current counter:', this.runner.counter);
  console.log('want to step to', dest, this.runner.keyframeNums[dest]);
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
    //TODO update slider too, or put that in updateControls
    return;
  }
  this.playerState = PS.History;
  return this.withStrictCanvas(()=>{
    if (n === undefined){ n = 1; }
    this.highlightCurSpot(this.runner.getCurrentAST());
    this.drawRewindEffect();
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
    for (var i=0; i < togo; i++){
      this.runner.runOneStep(true);
    }

    this.highlightCurSpot(this.runner.getCurrentAST());
    this.drawRewindEffect();
    var sliderIndex = this.runner.prevKeyframeIndex();
    this.scrubber.setCurrentIndex(sliderIndex);
    if (n > 1){
      setTimeout(()=> this.stepHistoryBackward(n-1), 0);
    }
    //TODO check to see if there are no more history frames left!
    // (needs to be saved somewhere: the last counter ever run)
  });
};

/** Invoked only by editor change handler */
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
  this.errorbar.innerText = humanize.humanize(e);
  this.errorbar.classList.remove('is-hidden');
  if (e.ast){
    console.log('Error has ast selection, should highlight');
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
    spot.colStart-2,
    spot.lineEnd-1,
    spot.colEnd), "curSpotHighlight");
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
  if (this.playerState === this.lastUpdateControlsState){ return; }
  this.lastUpdateControlsState = this.playerState;
  console.log('current state is', this.playerState);
  if (this.playerState === PS.Initial){
    console.log('should disable steppers and KTF');
  } else if (this.playerState === PS.Unfinished){
    console.log('should disable stepping forward and KTF');
  } else if (this.playerState === PS.Finished){
    console.log('should disable stepping forward and KTF');
  } else if (this.playerState === PS.HistoryAtEnd){
    console.log('should disable stepping forward and KTF');
  } else if (this.playerState === PS.HistoryAtBeginning){
    console.log('should disable stepping backwards');
  } else if (this.playerState === PS.History){
    console.log('turn everything on');
  } else if (this.playerState === PS.Error){
    console.log('Error state, I gugess all buttons should be off? I dunno what should happen to buttons.');
  } else {
    throw Error('bad player state');
  }

  //TODO update slider here as well

  //TOMHERE next to do: hook up the buttons! Once they do things it'll be more
  //fun to disable/enable them as appropriate
};
DalSegno.prototype.initControls = function(){
  // Look for each control and
  //   * hook it up
  //   * remember to enable/disable it as appropriate
  // Identify their action by class
  //

  var inputClasses = {
    'dalsegno-rw-1': ['step back', 1],
    'dalsegno-rw-1000': ['step back', 1000],
    'dalsegno-fw-1': ['step forward', 1],
    'dalsegno-fw-1000': ['step forward', 1000],
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
          console.log('clicked control!');
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
  this.lazyCanvasCtx.drawRewindEffect = ()=>{ this.drawRewindEffect(); }
  this.drawHelpers = new DrawHelpers(this.lazyCanvasCtx, document.getElementById(this.canvasId));

  this.effectCtx = this.effectCanvas.getContext('2d');
  this.effectCtx.clearRect(0, 0, 10000, 10000);
};
DalSegno.prototype.drawRewindEffect = function(){
  console.log("drawing rewind effect...");
  this.rewindEffectCleared = false;
  var w = this.effectCanvas.width;
  var h = this.effectCanvas.height;
  var fills = ['#666', '#eee', '#888', '#bbb'];
  this.effectCtx.clearRect(0, 0, 10000, 10000);
  for (var i=0; i<10; i++){
    this.effectCtx.fillStyle = fills[Math.floor(Math.random()*fills.length)];
    this.effectCtx.fillRect(0, h/5 + Math.random()*h/12, w, h / 200);
  }
  for (var i=0; i<10; i++){
    this.effectCtx.fillStyle = fills[Math.floor(Math.random()*fills.length)];
    this.effectCtx.fillRect(0, 3*h/5 + Math.random()*h/12, w, h / 200);
  }
};
DalSegno.prototype.clearRewindEffect = function(){
  if (this.rewindEffectCleared){ return; }
  this.rewindEffectCleared = true;
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
  dalSegnoTags.forEach((el)=>createEmbed(el));
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

  var embed = new DalSegno(uniqueId(editorDiv),
                           uniqueId(canvasContainer),
                           uniqueId(errorDiv),
                           uniqueId(textarea),
                           uniqueId(scrubber),
                           window[script.dataset.program] || '(display "program not found")',
                           uniqueId(controlsDiv)
  );
  if (script.dataset.editor === 'read-only'){
    embed.editor.setReadOnly(true);
    embed.editor
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


}

var CONTROLS_HTML = `
  <button
    class="dalsegno-prev-keyframe">|&lt;&lt;</button>
  <button
    class="dalsegno-rw-1000">&lt;&lt;</button>
  <button
    class="dalsegno-rw-1">&lt;</button>
  <input type="range" id="scrubber2"/>
  <button
    title="step forward 1000 bytecode executions"
    class="dalsegno-fw-1000" >&gt;&gt;</button>
  <button id="fw1"
    title="step forward a single bytecode execution"
    class="dalsegno-fw-1">&gt;</button>
  <button id="ffkeyframe"
    title="step through execution until next key frame"
    class="dalsegno-next-keyframe">&gt;&gt;|</button>
  <br/>
  <button id="fork"
    title="fork the timelines"
    class="dalsegno-fork-timeline">kill the future</button>
  <button id="fork"
    title="advance to the end and continue execution"
    class="dalsegno-fork-timeline">continue from end</button>
    `;

DalSegno.DalSegno = DalSegno;
DalSegno.findScriptTags = findScriptTags;

module.exports = DalSegno;
