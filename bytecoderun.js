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

  function CompiledFunctionObject(params, code, env, name) {
    this.params = params;
    this.code = code;
    this.env = env;
    this.name = name;
  }
  CompiledFunctionObject.prototype.toString = function(){
    return 'λ('+this.params+'): '+pprint(this.code);
  };

  //TODO Firm up undefined vs null: Null exists in this language, undefined
  //does not (so its presence indicates a bug in the language implementation)
  //In bytecodes when it doesn't matter what's used (arg isn't used) we use
  //null because that's less likely to occur accidentally

  function runBytecodeOneStep(counterStack, bytecodeStack, envStack, valueStack){
    var env = envStack.peek();
    var bytecode = bytecodeStack.peek();
    var counter = counterStack.peek();
    if (bytecode.length <= counter){
      console.log('counterStack:', counterStack);
      throw Error('counter ('+counter+') went off the end of bytecode: missing return?');
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
      case BC.Store:
        env.set(arg, valueStack.peek());
        break;
      case BC.Push:
        if (arg === null){ throw Error('Push arg should not be null but was'); }
        valueStack = valueStack.push(arg);
        break;
      case BC.Pop:
        if (arg !== null){ throw Error('Pop arg should be null, was '+arg); }
        valueStack = valueStack.pop();
        break;
      case BC.NameLookup:
        valueStack = valueStack.push(env.lookup(arg));
        break;
      case BC.FunctionLookup:
        //TODO use funs on runner for this
        valueStack = valueStack.push(env.lookup(arg));
        break;
      case BC.BuildFunction:
        var name = arg;
        var params = valueStack.peek();
        valueStack = valueStack.pop();
        var code = valueStack.peek();
        valueStack = valueStack.pop();
        var funcObj;
        if (arg === null){ // lambda function
          funcObj = new CompiledFunctionObject(params, code, env, undefined);
        } else {
          funcObj = new CompiledFunctionObject(params, code, env, arg);
        }
        valueStack = valueStack.push(funcObj);
        break;
      case BC.FunctionCall:
        var args = [];
        for (var i=0; i<arg; i++){
          args.push(valueStack.peek());
          valueStack = valueStack.pop();
        }
        args.reverse();
        var func = valueStack.peek();
        valueStack = valueStack.pop();
        if (typeof func === 'function'){
          var result = func.apply(null, args);
          valueStack = valueStack.push(result);
        } else {
          if (func.params.length !== arg){
            throw Error('Function called with wrong arity! Takes ' +
              func.params.length + ' args, given ' + args.length);
          }
          var scope = {};
          args.forEach((x, i) => scope[func.params[i]] = x);
          var newEnv = env.newWithScope(scope);
          bytecodeStack = bytecodeStack.push(func.code);
          // off the top (-1) because counter++ at end of this tick
          counter = -1;
          counterStack = counterStack.push(counter);
          envStack = envStack.push(newEnv);
        }
        break;
      case BC.Jump:
        counter += arg;
        break;
      case BC.JumpIfNot:
        var cond = valueStack.peek();
        valueStack = valueStack.pop();
        if (!cond) {
          counter += arg;
        }
        break;
      default:
        throw Error('unrecognized bytecode: '+bytecodeName(bc));
    }
    counterStack = counterStack.pop().push(counter+1);
    return [counterStack, bytecodeStack, envStack, valueStack, done];
  }

  function runBytecode(bytecode, env, source){
    source = source || false;
    bytecode = [].concat(bytecode, [[BC.Return, null, undefined]]);
    var counterStack  = Immutable.Stack([0]);
    var bytecodeStack = Immutable.Stack([bytecode]);
    var envStack      = Immutable.Stack([env]);

    var valueStack    = Immutable.Stack([]);
    var finished;
    do {
      if (source && counterStack.count() && bytecodeStack.count()){
        dis(bytecodeStack.peek(), counterStack.peek(), valueStack, envStack.peek(), source);
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

  function pprint(v){
    if (v === undefined){
      return '';
    } else if (v === null){
      return 'NULL (how did that get in?)';
    } else if (typeof v === 'string'){
      return v;
    } else if (typeof v === 'function'){
      if (v.name){ return ''+(v.origFunc ? v.origFunc : v); }
      return 'anon JS function';
    } else if (v.constructor.name === 'Function'){
      console.log(v);
      throw Error("TODO write a nice display function for Function objects");
    } else if (v.constructor.name === 'CompiledFunctionObject'){
      return ''+v;
    } else if (Array.isArray(v) && v.length && Array.isArray(v[0]) &&
               v[0].length > 1 && Number.isInteger(v[0][0])){
      // Looks like some bytecode
      return 'BC:'+v.map( code => [code[0], code[1]]);
    } else if (Array.isArray(v) && v.length === 0){
      return '[]';
    } else if (Array.isArray(v) && v.length === 1){
      return ''+v+',';
    } else {
      return ''+v;
    }
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

  function format(values, cutoff, align, atLeast){
    cutoff = cutoff || 40;
    if (align === undefined) { align = 'center'; }
    if (atLeast === undefined){ atLeast = 0; }
    if (values.length === 0){
      return [];
    }
    var lines = values.map(pprint);
    var maxWidth = Math.max(Math.max.apply(null, lines.map( s => s.length )), atLeast);
    maxWidth = Math.min(cutoff, maxWidth);
    lines = lines.map( s => {
      if (s.length > maxWidth){
        return s.slice(0, maxWidth-3) + '...';
      } else {
        if (align === 'center'){
          return ' '.repeat((maxWidth-s.length)/2) + s;
        } else if (align === 'right'){
          return ' '.repeat(maxWidth-s.length) + s;
        } else if (align === 'left'){
          return s + ' '.repeat(maxWidth-s.length);
        } else {
          throw Error('bad align arg:', align);
        }
      }
    });
    return lines;
  }

  function stackDraw(stack, cutoff){
    var label = 'valueStack';
    cutoff = cutoff || 40;
    if (Immutable.Iterable.isIterable(stack)){
      stack = stack.toJS();
    }
    var lines = format(stack, undefined, undefined, label.length);
    var maxWidth = Math.max(label.length, Math.max.apply(null, lines.map( line => line.length )));
    lines.push('-'.repeat(maxWidth));
    lines.push(' '.repeat((maxWidth-label.length)/2)+label);
    return lines.join('\n');
  }

  function envDraw(env){
    return env.toString();
  }

  function arrowsDraw(arrows){
    // ordering by length is a heuristic for less overlapping, not perfect though
    var byLength = Object.keys(arrows).map( a => [arrows[a], parseInt(a), parseInt(a)+arrows[a]+1] );
    byLength.sort();
    var lastLine = Math.max.apply(null, [].concat(byLength.map( x => x[1]),
                                                  byLength.map( x => x[2])));
    var lines = Array.apply(null, Array(lastLine)).map( () => '  ' );
    for (var x of byLength){
      var dist=x[0],start=x[1],end=x[2];
      var top = Math.min(start, start+dist+1);
      var bottom = Math.max(start, start+dist+1);
      var maxConnectorWidth = Math.max.apply(null, lines.slice(top, bottom).map(
        line => line.length ));
      var extraDashes = Math.max(maxConnectorWidth - 2, 0);
      for (var i=top; i<=bottom; i++){
        lines[i] = ('|' + lines[i] + '  ').slice(0, extraDashes + 3);
      }
      lines[start] = '┌--' + '-'.repeat(extraDashes);
      lines[end] = '└' + '-'.repeat(extraDashes) + '->';
    }

    //left-pad all lines
    var maxWidth = Math.max.apply(null, lines.map( line => line.length ));
    for (var i=0; i<lines.length; i++){
      lines[i] = (' '.repeat(maxWidth)+lines[i]).slice(-(maxWidth));
    }
    return lines.join('\n');
  }

  //TODO In order to get line/col numbers correct, we need to be diffing
  //both content and linenums of ASTs. When content changes swap out the code,
  //rewind the interpreter etc. but when only linenumbers change, we need to
  //update the line numbers in all saved named functions. Unnamed functions
  //should be held onto somewhere so their linenums can be changed too.
  function dis(bytecode, counter, stack, env, source){
    var termWidth = typeof process === undefined ? 1000 : process.stdout.columns;
    var arrows = {};
    bytecode.forEach( (code, i) => {
      if (bytecodeName(code[0]).indexOf('Jump') != -1){
        arrows[i] = code[1];
      }
    });
    var args = bytecode.map( code => code[1]);
    var lines = bytecode.map( code => {
      var instruction = bytecodeName(code[0]);
      var lineno = code[2] ? code[2].lineStart.toString() : '';
      return [instruction, lineno];
    });
    var maxInstructionLength = Math.max.apply(null, lines.map( line => line[0].length ));
    var maxLineNumLength     = Math.max.apply(null, lines.map( line => line[1].length ));
    var codeNum = 0;
    var output = '';
    var bytecodeLines = [];
    for (var line of lines){
      var s = ((codeNum === counter ? '--> ' : '    ') +
               ('            '+line[1]).slice(-maxLineNumLength)     + '  ' +
               ('            '+line[0]).slice(-maxInstructionLength));
      bytecodeLines.push(s);
      codeNum++;
    }
    output = bytecodeLines.join('\n');
    output = horzCat(output, format(args.map( v => v === null ? undefined : v ), 10, 'left').join('\n'));
    if(Object.keys(arrows).length){
      output = horzCat(arrowsDraw(arrows), output);
    }
    if(stack){
      output = horzCat(output, stackDraw(stack), true);
    }
    if(env){
      output = horzCat(output, envDraw(env), true);
    }
    if(source){
      output = horzCat(output, source, true);
    }
    console.log('-'.repeat(Math.max.apply(null, output.split('\n').map( l => l.length ))));
    console.log(output);
  }

  function runAndVisualize(s, makeEnv){
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
    console.log('compile result:', ''+runBytecode(bytecode, makeEnv(), s));
    console.log('eval result:', ''+compile.evaluateAST(ast, makeEnv()));
  }

  function evaluate(s, env){
    var ast = parse(s);
    var result = compile.evaluateAST(ast, env);
    return result;
  }

  function bytecoderun(s, env){
    var ast = parse(s);
    var bytecode = compile(ast);
    var result = runBytecode(bytecode, env);
    return result;
  }

  /*
  runAndVisualize(
`(do
  (define f
    (lambda x
      (+ x 1)))
  (f 3))`);
  */

  bytecoderun.bytecoderun = bytecoderun;
  bytecoderun.compile = compile;
  bytecoderun.evaluate = evaluate;
  bytecoderun.Environment = Environment;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = bytecoderun;
    }
  } else {
    window.bytecoderun = bytecoderun;
  }
})();
