// Copy!
// I'm using the names Oran Looney does in
// http://www.oranlooney.com/deep-copy-javascript/
//
// When we save state we should clear render instructions? Nah, why bother.

;(function() {
  'use strict';

  if (typeof window === 'undefined') {
    var require = module.require;
  } else {
    var require = function(name){
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
      return Immutable.Iterable.isIterable(obj)
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
              copy[property] = innerDeepCopy(obj[property], memo);
            }
          }
        }
      }
    },
    'NamedFunctionPlaceholder': {
      canCopy: function(obj){
        return obj.constructor.name === 'NamedFunctionPlaceholder';
      },
      create: function(obj){
        return new obj.constructor(obj.name);
      },
      populate: function(obj, copy, memo){}
    },
    'Function': {
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
    'EvalObject': {
      canCopy: function(obj){
        return obj.isEvalGen === true;
      },
      create: function(obj){
        return new obj.constructor(null, null);
      },
      populate: function(obj, copy, memo){
        for (var property in obj){
          if (obj.hasOwnProperty(property)){
            if (property === 'ast'){
              copy.ast = obj.ast;
            } else if (property === 'delegate'){
              copy.delegate = innerDeepCopy(obj.delegate, memo);
            } else if (property === 'values'){
              copy.values = innerDeepCopy(obj.values, memo);
            } else if (property === 'env'){
              copy.env = innerDeepCopy(obj.env, memo);
            } else if (property ===  '__obj_id'){
              // nop
            } else {
              throw Error("deepCopying unknown property "+property+" on "+obj);
            }
          }
        }
      }
    },
    'Environment': {
      canCopy: function(obj){
        return obj.constructor.name === 'Environment';
      },
      create: function(obj){
        return new obj.constructor();
      },
      populate: function(obj, copy, memo){
        for (var property in obj){
          if (obj.hasOwnProperty(property)){
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
    }
  };

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

    var copied = false;
    for (var name in copiers){
      var copier = copiers[name];
      if (!copier.canCopy(x)){ continue; }
      copy = copier.create(x);
      memo[id] = copy;
      copier.populate(x, copy, memo);
      copied = true;
      break;
    }
    if (copied){
      return copy;
    }
    throw Error("Can't deep copy "+typeof x + " " + x.constructor + " "+x);
  }

  function deepCopy(x){
    var memo = {};
    var copy = innerDeepCopy(x, memo);
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
