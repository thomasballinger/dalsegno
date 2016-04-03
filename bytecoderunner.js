;(function() {
  'use strict';

  var require;
  if (typeof window === 'undefined') {
    require = module.require;
  } else {
    require = function(name){
      var realname = name.match(/(\w+)[.]?j?s?$/)[1];
      return window[realname];
    };
  }
  var parse = require('./parse.js');
  var deepCopy = require('./deepCopy.js');
  var run = require('./run.js');
  var Environment = run.Environment;
  var Scope = run.Scope;
  var compile = require('./compile.js');
  var BC = compile.BC;
  var Immutable = require('./Immutable.js');


  function runBytecodeOneStep(counterStack, bytecodeStack, envStack, valueStack){
    var env = envStack.peek();
    var bytecode = bytecodeStack.peek();
    var counter = counterStack.peek();
    if (bytecode.length <= counter){
        throw Error('counter went off the end of bytecode: missing return?');
    }
    var done = false;
    var x = bytecode[counter];
    var bc=x[0], arg=x[1];
    switch (bc){
      case BC.LoadConstant:
        valueStack = valueStack.push(arg);
        break;
      case BC.Return:
        bytecodeStack = bytecodeStack.pop();
        counterStack = counterStack.pop();
        envStack = envStack.pop();
        if (bytecodeStack.count() === 0){
          done = true;
        } else {
          counter = counterStack.peek();
        }
        break;
      case BC.StoreNew:
        env.define(arg, valueStack.peek());
        break;
      case BC.Pop:
        if (arg !== null){ throw Error('Pop arg should be null, was '+arg); }
        valueStack = valueStack.pop();
        break;
      case BC.NameLookup:
        valueStack = valueStack.push(env.lookup(arg));
        break;
      default:
        throw Error('unrecognized bytecode: '+bytecodeName(bc));
    }
    counterStack = counterStack.pop().push(counter+1);
    return [counterStack, bytecodeStack, envStack, valueStack, done];
  }

  function runBytecode(bytecode, env, showSteps){
    showSteps = showSteps || false;
    bytecode = [].concat(bytecode, [[BC.Return, null, undefined]]);
    var counterStack  = Immutable.Stack([0]);
    var bytecodeStack = Immutable.Stack([bytecode]);
    var envStack      = Immutable.Stack([env]);

    var valueStack    = Immutable.Stack([]);
    var finished;
    do {
      if (showSteps && counterStack.count() && bytecodeStack.count()){
        dis(bytecodeStack.peek(), counterStack.peek(), valueStack, envStack.peek());
      }
      var x = runBytecodeOneStep(counterStack, bytecodeStack, envStack, valueStack);
      counterStack=x[0];bytecodeStack=x[1];envStack=x[2];valueStack=x[3];
      finished=x[4];
    } while (!finished);
    if (valueStack.count() !== 1){
        throw Error('final stack is of wrong length '+valueStack.count()+': '+valueStack);
    }
    return valueStack.peek();
  }

  function bytecodeName(num){
    var index = Object.keys(BC).map( name => BC[name] ).indexOf(num);
    if (index === -1){ return ''+num; }
    return Object.keys(BC)[index];
  }

  function horzCat(s1, s2, pad2FromTop){
    pad2FromTop = pad2FromTop || false;

    var lines1 = s1.split('\n');
    var lines2 = s2.split('\n');
    while (lines1.length < lines2.length){ lines1.push(''); }
    while (lines2.length < lines1.length){
      if (pad2FromTop){ lines2.unshift(''); } else { lines2.push(''); }
    }
    var maxLines1Length = Math.max.apply(null, lines1.map( line => line.length ));
    var lines1Width = maxLines1Length + 3;  // padding
    lines1 = lines1.map( line => (line + ' '.repeat(lines1Width)).slice(0, lines1Width));

    var outputLines = [];
    for (var i = 0; i<lines1.length; i++){
      outputLines.push(lines1[i] + lines2[i]);
    }
    return outputLines.join('\n');
  }

  function stackDraw(stack, label){
    if (Immutable.Iterable.isIterable(stack)){
      stack = stack.toJS();
    }
    var lines = stack.map( v => ''+v );
    var maxWidth = Math.max.apply(null, [label ? label.length : 0].concat(
      lines.map( s => s.length )));
    lines.push('-'.repeat(maxWidth));
    lines = lines.map( s => ' '.repeat((maxWidth-s.length)/2)+s );
    if (label){ lines.push(label); }
    return lines.join('\n');
  }

  function envDraw(env){
    return env.toString();
  }

  //TODO In order to get line/col numbers correct, we need to be diffing
  //both content and linenums of ASTs. When content changes swap out the code,
  //rewind the interpreter etc. but when only linenumbers change, we need to
  //update the line numbers in all saved named functions. Unnamed functions
  //should be held onto somewhere so their linenums can be changed too.
  function dis(bytecode, counter, stack, env){
    //TODO if there are jumps, add labels
    var termWidth = typeof process === undefined ? 1000 : process.stdout.columns;
    var lines = bytecode.map( code => {
      var instruction = bytecodeName(code[0]);
      var arg = code[1] === null ? '' : ''+code[1];
      var lineno = code[2] ? code[2].lineStart.toString() : '';
      return [instruction, arg, lineno];
    });
    var maxInstructionLength = Math.max.apply(null, lines.map( line => line[0].length ));
    var maxArgLength         = Math.max.apply(null, lines.map( line => line[1].length ));
    var maxLineNumLength     = Math.max.apply(null, lines.map( line => line[1].length ));
    var codeNum = 0;
    var output = '';
    var bytecodeLines = [];
    for (var line of lines){
      var s = ((codeNum === counter ? '--> ' : '    ') +
               ('            '+line[2]).slice(-maxLineNumLength)     + '  ' +
               ('            '+line[0]).slice(-maxInstructionLength) + '  ' +
               ('            '+line[1]).slice(-maxArgLength));
      bytecodeLines.push(s);
      codeNum++;
    }
    output = bytecodeLines.join('\n');
    if(stack){
      output = horzCat(output, stackDraw(stack, 'valueStack'), true);
    }
    if(env){
      output = horzCat(output, envDraw(env), true);
    }
    console.log('-'.repeat(Math.max.apply(null, output.split('\n').map( l => l.length ))));
    console.log(output);
  }

  function bytecoderun(s, makeEnv){
    if (makeEnv === undefined){
      makeEnv = function() {
        return new Environment.fromObjects(
          [{'+': function(a, b){ return a + b; }}]);
      };
    }
    (typeof window === 'undefined' ? global : window).program = s; // so parse errors print bad source
    var ast = parse(s);
    console.log('source:', s);
    //console.log('AST:', parse.justContent(ast));
    var bytecode = compile(ast);
    //console.log('bytecode:');
    console.log('compile result:', runBytecode(bytecode, makeEnv(), true));
    console.log('eval result:', compile.evaluate(ast, makeEnv()));
  }
  //bytecoderun('1');
  bytecoderun('(do (define a 1) a)');

  bytecoderun.bytecoderun = bytecoderun;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = bytecoderun;
    }
  } else {
    window.bytecoderun = bytecoderun;
  }
})();
