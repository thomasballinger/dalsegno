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

  var scripts = [
    "deepCopy.js",
    "parse.js",
    "Environment.js",
    "compile.js",
    "bcexec.js",
    "bcrun.js",
    "builtins.js",
    "MouseTracker.js",
    "KeyboardTracker.js",
    "stdlibcode.js",
    "bcstdlib.js",
    "LazyCanvasCtx.js",
    "DrawHelpers.js",
  ];
  //TODO these should be loaded in layers, reflecting dependencies!

  function loadScripts(path, callback){
    if (window.DalSegnoScriptLoaderStatus){
      if (typeof window.DalSegno === 'undefined'){
        // let's load it
      } else if (window.DalSegno === 'in progress'){
        console.log('scripts already loading, trying again in 100ms');
        setTimeout(function(){ loadScripts(path, callback); }, 100);
        return;
      } else if (window.DalSegnoScriptLoaderStatus){
        console.log('scripts already loaded, running callback now');
        callback(window.DalSegno);
        return;
      }
    }
    window.DalSegno = 'in progress';

    var scriptsLoaded = [];
    scripts.forEach( s => {
      var el = document.createElement('script');
      el.setAttribute('src', path+s);
      el.onload = function(){
        scriptsLoaded.push(s);
        if (scriptsLoaded.length === scripts.length){
          var DalSegno = makeDalSegno();
          window.DalSegno = DalSegno;
          console.log('now that everything is loaded, running callback');
          callback(DalSegno);
        } else {
          console.log('not done yet, but got', s);
        }
      };
      document.body.appendChild(el);
    });
  }

  function setUpDalSegno(editorId, canvasId, errorBarId, initialId, callback){
    loadScripts('./', function(DalSegno){
      var embed = new DalSegno(editorId, canvasId, errorBarId, initialId);
      window.a = embed;
      callback(embed);
    });
  }
  function makeDalSegno(){
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
    }
    DalSegno.prototype.go = function(){
      this.currentlyRunning = true;
      this.runABit();
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
      var s = editor.getValue();
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
        console.log('trying to read from ', this.initialProgramId);
        initialContent = document.getElementById(this.initialProgramId).textContent;
      }
      this.editor.setValue(initialContent);

      this.editor.getSession().on('change', e => this.onChange(e));

      this.errorbar = document.getElementById(this.errorBarId);
      this.errorbar.classList.add('errorbar');
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
    return DalSegno;
  }
  window.setUpDalSegno = setUpDalSegno;

})();
