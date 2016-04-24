// Copy!
// I'm using the names Oran Looney does in
// http://www.oranlooney.com/deep-copy-javascript/
//
// When we save state we should clear render instructions? Nah, why bother.

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
  var Immutable = require('./Immutable');

  var _numObjects = 0;
  function objectId(obj) {
    if (typeof obj !== 'object' || obj === null){
      throw Error("objectId called on a non-object or null: "+obj);
    }
    if (obj.__obj_id === undefined){
      objectId.thingsWithIds.push(obj);
      obj.__obj_id = _numObjects++;
    }
    return obj.__obj_id;
  }

  objectId.thingsWithIds = [];
  objectId.deleteIds = function(){
    for (var i = 0; i < objectId.thingsWithIds.length; i++){
      delete objectId.thingsWithIds[i].__obj_id;
    }
    objectId.thingsWithIds = [];
  };

  var passthroughCopier = {
    name: 'Passthrough',
    canCopy: function(obj){
      return (obj === null ||
        typeof obj === 'boolean' ||
        typeof obj === 'undefined' ||
        typeof obj === 'undefined' ||
        typeof obj === 'number' ||
        typeof obj === 'string' ||
        typeof obj === 'function');
    },
    create: function(obj){ return obj; },
    populate: function(obj){ return; }
  };
  var immutableCopier = {
    name: 'Immutable',
    canCopy: function(obj){
      return Immutable.Iterable.isIterable(obj);
    },
    create: function(obj){ return obj; },
    populate: function(obj){ return; }
  };
  var copiers = {
    'Array': {
      canCopy: function(obj){ return Array.isArray(obj); },
      create: function(obj){ return []; },
      populate: function(obj, copy, memo){
        for (var i = 0; i < obj.length; i++){
          //console.log('copying element', i, 'of', obj, ':', obj[i]);
          copy.push(innerDeepCopy(obj[i], memo));
        }
      }
    },
    'Object': {
      canCopy: function(obj){ return obj.constructor === Object; },
      create: function(obj){ return {}; },
      populate: function(obj, copy, memo){
        for (var property in obj){
          if (obj.hasOwnProperty(property)){
            if (property == '__obj_id'){
              // nop
            } else {
              //console.log('copying property', property, 'of', obj, ':', obj[property]);
              copy[property] = innerDeepCopy(obj[property], memo);
            }
          }
        }
      }
    },
    'NamedFunctionPlaceholder': {
      byConstructorName: true,
      canCopy: function(obj){
        return obj.constructor.name === 'NamedFunctionPlaceholder';
      },
      create: function(obj){
        return new obj.constructor(obj.name);
      },
      populate: function(obj, copy, memo){}
    },
    'Function': {
      byConstructorName: true,
      canCopy: function(obj){
        return obj.constructor.name === 'Function';
      },
      create: function(obj){
        return new obj.constructor(null,
                                   null,
                                   null,
                                   null);
      },
      populate: function(obj, copy, memo){
        for (var property in obj){
          //console.log('copying property', property, 'of', obj, ':', obj[property]);
          if (obj.hasOwnProperty(property)){
            if (property === 'name'){
              copy.name = obj.name;
            } else if (property === 'body'){
              copy.body = obj.body; // shallow copy should be ok bc
            } else if (property === 'params'){
              copy.params = obj.params; // should be fine
              if (obj.params === null){
                debugger;
                throw Error('params being null makes no sense');
              }
            } else if (property === 'env'){
              copy.env = innerDeepCopy(obj.env, memo);
            } else if (property ===  '__obj_id'){
              // nop
            } else {
              console.log(obj);
              throw Error("deepCopying unknown property "+property+" on "+obj);
            }
          }
        }
      }
    },
    'CompiledFunctionObject': {
      byConstructorName: true,
      canCopy: function(obj){
        return obj.constructor.name === 'CompiledFunctionObject';
      },
      create: function(obj){
        return new obj.constructor(null, null, null, null);
      },
      populate: function(obj, copy, memo){
        // Although swapping out properties of a CompiledFunctionObject
        // happens regularly, most properties themselves don't change.
        for (var property of Object.keys(obj)){
          //console.log('copying property', property, 'of', obj, ':', obj[property]);
          if (property === 'name'){
            copy.name = obj.name; // string
          } else if (property === 'code'){
            // shallow copy should be ok bc bytecode is frozen
            copy.code = obj.code;
          } else if (property === 'params'){
            // list of strings that shouldn't change
            copy.params = obj.params;
          } else if (property === 'env'){
            copy.env = innerDeepCopy(obj.env, memo);
          } else if (property ===  '__obj_id'){
            // nop
          } else {
            console.log(obj);
            throw Error("deepCopying unknown property "+property+" on "+obj);
          }
        }
      }
    },
    'Context': {
      byConstructorName: true,
      canCopy: function(obj){
        return obj.constructor.name === 'Context';
      },
      create: function(obj){
        return new obj.constructor.fromStacks(null, null, null, null, null);
      },
      populate: function(obj, copy, memo){
        for (var property of Object.keys(obj)){
          //console.log('copying property', property, 'of', obj, ':', obj[property]);
          if (property === 'counterStack'){
            copy.counterStack = obj.counterStack;
          } else if (property === 'bytecodeStack'){
            copy.bytecodeStack = obj.bytecodeStack;
          } else if (property === 'envStack'){
            var environments = obj.envStack.toArray();
            copy.envStack = Immutable.Stack(innerDeepCopy(environments, memo));
          } else if (property === 'valueStack'){
            // entirely immutable values! except maybe some functions...
            //var values = obj.valueStack.toJS();
            //copy.valueStack = Immutable.Stack(innerDeepCopy(values, memo));
            //TODO Why did I think this had to be a deepcopy?
            copy.valueStack = obj.valueStack;
          } else if (property === 'done'){
            copy.done = obj.done;
          } else if (property ===  '__obj_id'){
            // nop
          } else {
            throw Error("deepCopying unknown property "+property+" on "+obj);
          }
        }
      }
    },
    'Environment': {
      byConstructorName: true,
      canCopy: function(obj){
        return obj.constructor.name === 'Environment';
      },
      create: function(obj){
        return new obj.constructor();
      },
      populate: function(obj, copy, memo){
        for (var property of Object.keys(obj)){
          //console.log('copying property', property, 'of', obj, ':', obj[property]);
          if (property === 'scopes'){
            copy.scopes = [];
            for (var i = 0; i < obj.scopes.length; i++){
              if (obj.scopes[i] === undefined){
                throw Error("Scopes probably shouldn't be undefined");
              } else if (obj.scopes[i].constructor === Object){
                throw Error('Environment should not have simple objects as scopes');
              } else if (obj.scopes[i].constructor.name === 'Scope') {
                var scope = obj.scopes[i].copy(); // this should be cheap
              } else {
                // window and other non-object literals
                var scope = obj.scopes[i];
                if (scope.hasOwnProperty('savedScopeState')){
                  // nop
                } else if (typeof scope.saveScopeState !== 'undefined'){
                  scope.savedScopeState = scope.saveScopeState();
                }
              }
              copy.scopes.push(scope);
            }
          } else if (property === 'runner'){
            copy.runner = obj.runner;
          } else if (property ===  '__obj_id'){
            // nop
          } else {
            throw Error("deepCopying unknown property "+property+" on "+obj);
          }
        }
      }
    }
  };
  var copiersByConstructorName = {};
  Object.keys(copiers)
    .filter( name => copiers[name].byConstructorName )
    .forEach( name => copiersByConstructorName[name] = copiers[name]);

  function innerDeepCopy(x, memo){
    if (memo === undefined){
      throw Error("Need to pass second argument to deepCopy");
    }
    if (passthroughCopier.canCopy(x)){ return x; }
    if (immutableCopier.canCopy(x)){ return x; }

    var id = objectId(x);
    var copy = memo[id];
    if (copy !== undefined){
      return copy;
    }

    var constructor = x.constructor;
    var copier;
    if (constructor === Array){
      copier = copiers.Array;
    } else if (constructor === Object){
      copier = copiers.Object;
    } else {
      var constructorName = constructor.name;
      copier = copiersByConstructorName[constructorName];
      if (copier === undefined){
        console.log('looking for copier manually');
        for (var name in copiers){
          var candidateCopier = copiers[name];
          if (copier.canCopy(x)){
            copier = candidateCopier;
            break;
          }
        }
        if (copier === undefined){
          console.log(x);
          throw Error("Can't deep copy "+typeof x + " " + x.constructor + " "+x);
        }
      }
    }

    copy = copier.create(x);
    memo[id] = copy;
    copier.populate(x, copy, memo);
    return copy;
  }

  function deepCopy(x){
    var memo = {};
    var copy = innerDeepCopy(x, memo);
    // This would be cleaner but it's also slower
    //objectId.deleteIds();
    return copy;
  }

  deepCopy.innerDeepCopy = innerDeepCopy;
  deepCopy.copiers = copiers;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = deepCopy;
    }
  } else {
    window.deepCopy = deepCopy;
  }
})();
