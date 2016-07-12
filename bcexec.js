'use strict';

var parse = require('./parse.js');
var deepCopy = require('./deepCopy.js');
var Environment = require('./Environment.js');
var ScopeCheck = require('./ScopeCheck.js');
var NamedFunctionPlaceholder = Environment.NamedFunctionPlaceholder;
var compile = require('./compile.js');
var compileFunctionBody = compile.compileFunctionBody;
var compileProgram = compile.compileProgram;
var compileInitialization = compile.compileInitialization;
var BC = compile.BC;
var Immutable = require('./Immutable.js');

function err(msg, ast){
  var e = Error(msg);
  e.ast = ast;
  throw e;
}

function CompiledFunctionObject(params, code, env, name) {
  this.params = params;
  this.code = code;
  this.env = env;
  this.name = name;
}
CompiledFunctionObject.prototype.decref = function(reason){
  this.env.decref(this.name+': '+reason);
};
CompiledFunctionObject.prototype.incref = function(reason){
  this.env.incref(this.name+': '+reason);
};
CompiledFunctionObject.prototype.getScopes = function(){
  return [this.env.mutableScope];
};
CompiledFunctionObject.prototype.toString = function(){
  return 'λ('+ (this.params ? this.params : '') +'): '+pprint(this.code);
};

//TOMHERE this is the next task:
//TODO Context shouldn't add the return.
//
// Instead, have different compile methods (buildProgram, buildFunction)
// both add this return.
// Check out all the places Contexts are created to see if this is alright.
function Context(bytecode, env){
  //bytecode = [].concat(bytecode, [[BC.Return, null, undefined]]);
  this.counterStack  = Immutable.Stack([0]);
  this.bytecodeStack = Immutable.Stack([bytecode]);
  this.envStack      = Immutable.Stack([env]);
  this.valueStack    = Immutable.Stack([]);
  this.done          = false;
}
Context.fromStacks = function(counterStack, bytecodeStack, envStack, valueStack, done){
  var c = new Context(null, null);
  c.counterStack  = counterStack;
  c.bytecodeStack = bytecodeStack;
  c.envStack      = envStack;
  c.valueStack    = valueStack;
  c.done          = done;
  return c;
};
/** Gets scopes directly referenced in context
 * Does not include parents or contained scopes */
Context.prototype.getScopes = function(){
  var envStackScopes = this.envStack.flatMap( env => env.mutableScope ? [env.mutableScope] : [] ).toJS();

  /** Gets scopes from nested arrays */
  function getScopes(val){
    if (Immutable.Iterable.isIterable(val)){
      return val.flatMap(getScopes).toJS();
    } else if (val && val.getScopes){
      return val.getScopes();
    } else {
      return [];
    }
  }
  var valueStackScopes = this.valueStack.flatMap(getScopes).toJS();
  return envStackScopes.concat(valueStackScopes);
};
Context.prototype.pprint = function(){
  return {
    counterStack: this.counterStack.toJS(),
    bytecodeStack: this.bytecodeStack.toJS(),
    envStack: this.envStack.toJS(),
    valueStack: this.valueStack.toJS(),
    done: this.done
  };
};
Context.prototype.getCurrentAST = function(){
  var bytecode = this.bytecodeStack.peek();
  var counter = this.counterStack.peek();
  return bytecode[counter][2];
};

//TODO Firm up undefined vs null: Null exists in this language, undefined
//does not (so its presence indicates a bug in the language implementation)
//In bytecodes when it doesn't matter what's used (arg isn't used) we use
//null because that's less likely to occur accidentally
//HOWEVER, a bunch of the builtin functions return undefined!
//If there's going to be nice interop, that should be the value that
//gets returned! Environment lookup will need to be fixed to account for this,
//currently a variable set to undefined is though not to exist!
//It sure would be nice to get rid of one of these, and Null sounds easier
//to get rid of in the language.

/** Mutates a context by one bytecode */
function execBytecodeOneStep(c, runnerCount, useNondetCache, nondetCache){
  if (c.counterStack.count() === 0){
    throw Error('bad context');
  }
  var env = c.envStack.peek();
  var bytecode = c.bytecodeStack.peek();
  var counter = c.counterStack.peek();
  if (bytecode.length <= counter){
    console.log('counterStack:', c.counterStack);
    throw Error('counter ('+counter+') went off the end of bytecode: missing return?');
  }
  var [bc, arg, ast] = bytecode[counter];
  switch (bc){
    case BC.LoadConstant:
      c.valueStack = c.valueStack.push(arg);
      break;
    case BC.Return:
      env.decref('returning from '+arg);
      /* falls through */
    case BC.ReturnNoDecref:
      c.bytecodeStack = c.bytecodeStack.pop();
      c.counterStack = c.counterStack.pop();
      c.envStack = c.envStack.pop();
      env.runner.scopeCheck.gc(c, env.runner);

      if (c.bytecodeStack.count() === 0){
        c.done = true;
      } else if (bc === BC.Return){
        counter = c.counterStack.peek();
      } else if (bc === BC.ReturnNoDecref){
        throw Error('ReturnNoDecref encountered, stack should be empty!');
      } else { throw Error('thought that was exhaustive'); }
      break;
    case BC.StoreNew:
      var val = c.valueStack.peek();
      env.define(arg, val);
      break;
    case BC.Store:
      env.set(arg, c.valueStack.peek());
      break;
    case BC.Push:
      if (arg === null){ throw Error('Push arg should not be null but was'); }
      c.valueStack = c.valueStack.push(arg);
      break;
    case BC.Pop:
      if (arg !== null){ throw Error('Pop arg should be null, was '+arg); }
      var val = c.valueStack.peek();
      // if it's a closure being popped off, decref its scopes
      if (val && val.decref){
        val.decref('popping '+val);
      }
      c.valueStack = c.valueStack.pop();
      break;
    case BC.NameLookup:
      c.valueStack = c.valueStack.push(env.lookup(arg, ast));
      break;
    case BC.FunctionLookup:
      // works the same as function(
      c.valueStack = c.valueStack.push(env.lookup(arg, ast));
      break;
    case BC.BuildFunction:
      var name = arg;
      var params = c.valueStack.peek();
      c.valueStack = c.valueStack.pop();
      var code = c.valueStack.peek();
      c.valueStack = c.valueStack.pop();
      var funcObj;
      if (arg === null){  // lambda function
        env.incref('creating lambda function object defined in this scope');
        funcObj = new CompiledFunctionObject(params, code, env, null);
        c.valueStack = c.valueStack.push(funcObj);
      } else {  // defn named function
        // no incref because NamedFunctionPlaceholders are weakrefs.
        // They correspond to whatever is in runner.funs, which has a
        // strong reference to its environment.
        funcObj = new CompiledFunctionObject(params, code, env, arg);
        env.setFunction(arg, funcObj);
        c.valueStack = c.valueStack.push(new NamedFunctionPlaceholder(arg, env.runner));
      }
      break;
    case BC.FunctionTailCall:
      // We're not personally responsible for preserving the environment
      // if the function call is in the tail position
      /* falls through */
    case BC.FunctionCall:
      if (Immutable.List.isList(c.valueStack.get(arg))){
        console.log('looks like a non-function...');
        dis(c);
      }

      var args = [];
      if (c.valueStack.count() < arg+1){
        dis(c);
        throw Error("Not enough values on stack for args ("+arg+") and function!");
      }
      for (var i=0; i<arg; i++){
        args.push(c.valueStack.peek());
        c.valueStack = c.valueStack.pop();
      }
      args.reverse();
      var func = c.valueStack.peek();
      c.valueStack = c.valueStack.pop();
      if (typeof func === 'function'){
        var result;
        if (func.isNondeterministic && useNondetCache){
          result = nondetCache[runnerCount];
          if (result === undefined){
            for (var i=0; i<1000; i++){
              if (nondetCache[runnerCount - i] !== undefined){
                console.log('closest result is before found at', runnerCount - i, ':', nondetCache[runnerCount - i]);
                break;
              }
              if (nondetCache[runnerCount + i] !== undefined){
                console.log('cloest result is after found at', runnerCount + i, ':', nondetCache[runnerCount + i]);
                break;
              }
            }
            throw Error('no cached result for '+runnerCount+'!');
          } else {
            // using cached result
          }
        } else {
          try {
            result = func.apply(null, args);
            if (func.isNondeterministic && nondetCache){
              nondetCache[runnerCount] = result;
            }
          } catch (e){
            e.ast = ast;
            throw e;
          }
        }
        c.valueStack = c.valueStack.push(result);
      } else {
        if (func === null || func === undefined ||
            !(func.constructor === NamedFunctionPlaceholder ||
              func.constructor === CompiledFunctionObject)){
          console.log('nonfunction:', func);
          // Restore state so this bytcode could be executed again
          // and its arguments are still on the stack.
          // TODO a better solution would be just peeking at the stack
          // and then popping these values off once we're sure we can
          // construct the next frame.
          c.valueStack = c.valueStack.push(func);
          for (var i=0; i<arg; i++){
            c.valueStack = c.valueStack.push(args[i]);
          }
          err('first expression in form is not a function: '+func, ast);
        }
        if (func.name !== null){

          // It's important that this happens while the function object
          // and its arguments are still on the stack.
          c.valueStack = c.valueStack.push(func);
          for (var i=0; i<arg; i++){
            c.valueStack = c.valueStack.push(args[i]);
          }
          // call retrieveNamedFunction now so this is the context that gets saved
          func = env.retrieveNamedFunction(func.name);
          // now take them back off
          for (var i=0; i<arg+1; i++){
            c.valueStack = c.valueStack.pop();
          }

        }
        if (func.params.length !== arg){
          err('Function '+func.name+' called with wrong number of arguments! Takes ' +
            func.params.length + ' args, given ' + args.length, ast);
        }
        var scope = {};
        args.forEach((x, i) => scope[func.params[i]] = x);
        var newEnv = func.env.newWithScope(scope, env.runner);

        // done with the function object now that env created
        func.decref('done with func obj '+func);

        // off the top (-1) because counter++ at end of this tick
        counter = -1;
        if (bc === BC.FunctionCall){
          c.bytecodeStack = c.bytecodeStack.push(func.code);
          c.counterStack = c.counterStack.push(counter);
          c.envStack = c.envStack.push(newEnv);
        } else if (bc === BC.FunctionTailCall){
          // throw out current frame
          c.bytecodeStack = c.bytecodeStack.pop().push(func.code);
          c.counterStack = c.counterStack.pop().push(counter);
          c.envStack = c.envStack.pop().push(newEnv);

          newEnv.runner.scopeCheck.gc(c, env.runner);

        } else { throw Error('nonexhaustive match'); }
      }
      break;
    case BC.Jump:
      counter += arg;
      break;
    case BC.JumpIfNot:
      var cond = c.valueStack.peek();
      c.valueStack = c.valueStack.pop();
      if (!cond) {
        counter += arg;
      }
      break;
    default:
      throw Error('unrecognized bytecode: '+bytecodeName(bc));
  }
  c.counterStack = c.counterStack.pop().push(counter+1);
}

function execBytecode(bytecode, env, source){
  source = source || false;
  var context = new Context(bytecode, env);

  do {
    if (source && context.counterStack.count() &&
        context.bytecodeStack.count()){
      dis(context, source);
    }
    execBytecodeOneStep(context);
  } while (!context.done);

  if (context.valueStack.count() !== 1){
      throw Error('final stack is of wrong length '+
                  context.valueStack.count()+': '+context.valueStack);
  }
  return context.valueStack.peek();
}

function bytecodeName(num){
  var index = Object.keys(BC).map( name => BC[name] ).indexOf(num);
  if (index === -1){ return ''+num; }
  return Object.keys(BC)[index];
}

var UNINTERESTING = {};
function pprint(v){
  if (v === UNINTERESTING){
    return '';
  } else if (v === undefined){
    return 'undefined';
  } else if (v === null){
    return 'NULL (how did that get in?)';
  } else if (typeof v === 'string'){
    return v;
  } else if (typeof v === 'function'){
    if (v.name){ return (''+(v.origFunc ? v.origFunc : v)).replace(/\n/g, '⏎'); }
    return 'anon JS function';
  } else if (v.constructor.name === 'Function'){
    return '☠ uncompiled function!'+v;
  } else if (v.constructor.name === 'CompiledFunctionObject'){
    return 'λ'+v.name+' placeholder';
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

function horzCat(s1, s2, pad2FromTop, limitRight){
  limitRight = limitRight || 10000;
  pad2FromTop = pad2FromTop || false;

  var lines1 = s1.split('\n');
  var lines2 = s2.split('\n').map( line => line.length > limitRight ?
                                           line.slice(0, limitRight-3)+'...' : line);
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
  for (var [dist, start, end] of byLength){
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
function dis(context, source){
  var bytecode = context.bytecodeStack.peek();
  var counterStack = context.counterStack;
  var stack = context.valueStack;
  var env = context.envStack.peek();

  //var termWidth = typeof process === undefined ? 1000 : process.stdout.columns;
  var arrows = {};
  bytecode.forEach( (code, i) => {
    if (bytecodeName(code[0]).indexOf('Jump') != -1){
      arrows[i] = code[1];
    }
  });
  var args = bytecode.map( code => code[1]);
  var lines = bytecode.map( code => {
    var instruction = bytecodeName(code[0]);
    var lineno = (code[2] && code[2].lineStart) ? code[2].lineStart.toString() : '';
    return [instruction, lineno];
  });
  var maxInstructionLength = Math.max.apply(null, lines.map( line => line[0].length ));
  var maxLineNumLength     = Math.max.apply(null, lines.map( line => line[1].length ));
  var codeNum = 0;
  var output = '';
  var bytecodeLines = [];
  bytecode.forEach( (b, i)=> {
    if (b[0] === BC.Pop && args[i] === null){ args[i] = UNINTERESTING; }
    if (b[0] === BC.Return && args[i] === null){ args[i] = UNINTERESTING; }
  });
  for (var line of lines){
    var s = ((codeNum === counterStack.peek() ? '--> ' : '    ') +
             ('            '+line[1]).slice(-maxLineNumLength)     + '  ' +
             ('            '+line[0]).slice(-maxInstructionLength));
    bytecodeLines.push(s);
    codeNum++;
  }
  output = bytecodeLines.join('\n');
  output = horzCat(output, format(args, 10, 'left').join('\n'));
  if(Object.keys(arrows).length){
    output = horzCat(arrowsDraw(arrows), output);
  }
  if(stack){
    output = horzCat(output, stackDraw(stack), true);
  }
  var counters = counterStack.toJS();
  counters.reverse();
  var envAndPCStack = 'PC stack:\n'+counters+'\n';
  if(env){
    envAndPCStack += envDraw(env);
  }
  output = horzCat(output, envAndPCStack, true, 30);
  if(source){
    var sourceLines = [];
    source = source.split('\n').forEach( (s, i) => sourceLines.push((i+1+' ').slice(0, 2)+s) );
    output = horzCat(output, sourceLines.join('\n'), true);
  }
  console.log('-'.repeat(Math.max.apply(null, output.split('\n').map( l => l.length ))));
  console.log(output);
}

function execAndVisualize(s, makeEnv){
  if (makeEnv === undefined){
    makeEnv = function() {
      return new Environment.fromMultipleMutables(
        [{'+': function(a, b){ return a + b; }}]);
    };
  }
  (typeof window === 'undefined' ? global : window).program = s; // so parse errors print bad source
  var ast = parse(s);
  console.log('source:', s);
  //console.log('AST:', parse.justContent(ast));
  var bytecode = compileProgram(ast);
  //console.log('bytecode:');
  console.log('compile result:', ''+execBytecode(bytecode, makeEnv(), s));
  console.log('eval result:', ''+compile.evaluateAST(ast, makeEnv()));
}

function safelyParsesAndCompiles(program, errback){
  if (errback === undefined){
    errback = function(msg){console.log(msg);};
  }
  try {
    var ast = parse(program);
    compileProgram(ast);
    return true;
  } catch (e) {
    errback(e);
    return false;
  }
}

function evaluate(s, env){
  var ast = parse(s);
  var result = compile.evaluateAST(ast, env);
  return result;
}

function bcexec(s, env, debugSource){
  if (debugSource === true){ debugSource = s; }
  var ast = parse(s);
  var bytecode = compileProgram(ast);
  var result = execBytecode(bytecode, env, debugSource);
  return result;
}

function example(){
  execAndVisualize(
`(do
(if 1
  (define a 1)
  (define b 2))
4)`);
}

bcexec.bcexec = bcexec;
bcexec.execBytecode = execBytecode;
bcexec.compileFunctionBody = compileFunctionBody;
bcexec.compileProgram = compileProgram;
bcexec.compileInitialization = compileInitialization;
bcexec.safelyParsesAndCompiles = safelyParsesAndCompiles;
bcexec.evaluate = evaluate;
bcexec.Context = Context;
bcexec.execBytecodeOneStep = execBytecodeOneStep;
bcexec.dis = dis;
bcexec.CompiledFunctionObject = CompiledFunctionObject;
//TODO add functions needed by run

module.exports = bcexec;
