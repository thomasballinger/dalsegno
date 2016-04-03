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


  function err(msg, ast){
    e = Error(msg);
    e.ast = ast;
    throw e;
  }

  function runBytecodeOneStep(counterStack, bytecodeStack, envStack, valueStack){
    var env = envStack.peek();
    var bytecode = bytecodeStack.peek();
    var counter = counterStack.peek();
    if (bytecode.length <= counter){
        throw Error('counter went off the end of bytecode: missing return?');
    }
    var done = false;
    console.log('bytecode: ', bytecode);
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
      default:
        throw Error('unrecognized bytecode: '+bc);
    }
    counterStack = counterStack.pop().push(counter+1);
    return [counterStack, bytecodeStack, envStack, valueStack, done];
  }

  function runBytecode(bytecode, env){
    bytecode.push([BC.Return, null]);
    console.log('after add', bytecode);
    var counterStack  = Immutable.Stack([0]);
    var bytecodeStack = Immutable.Stack([bytecode]);
    var envStack      = Immutable.Stack([env]);

    var valueStack    = Immutable.Stack([]);
    var finished;
    do {
      var x = runBytecodeOneStep(counterStack, bytecodeStack, envStack, valueStack);
      console.log(x);
      counterStack=x[0];bytecodeStack=x[1];envStack=x[2];valueStack=x[3];
      finished=x[4];
    } while (!finished);
    if (valueStack.count() !== 1){
        throw Error('final stack is of wrong length '+valueStack.count()+': '+valueStack);
    }
    return valueStack.peek();
  }

  function bytecoderun(){
    var s = '1';
    var ast = parse(s);
    console.log(ast);
    console.log('eval result:', compile.evaluate(ast,
      new Environment.fromObjects(
        [{'+': function(a, b){ return a + b; }}])));
    var bytecode = compile(ast);
    console.log('from compile:', bytecode);
    console.log(runBytecode(bytecode, new Environment()));
  }
  bytecoderun('1');

  bytecoderun.bytecoderun = bytecoderun;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = bytecoderun;
    }
  } else {
    window.bytecoderun = bytecoderun;
  }
})();
