// Copy!
// I'm using the names Oran Looney does in
// http://www.oranlooney.com/deep-copy-javascript/
//
// When we save state we should clear render instructions? Nah, why bother.

;(function() {
  'use strict';

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
        return new obj.constructor(Symbol.for('deepCopy.dummy'),
                                   Symbol.for('deepCopy.dummy'),
                                   Symbol.for('deepCopy.dummy'),
                                   Symbol.for('deepCopy.dummy'));
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
    'EvalObject': {
      canCopy: function(obj){
        return obj.isEvalGen === true;
      },
      create: function(obj){
        return new obj.constructor(Symbol.for('deepCopy.dummy'), Symbol.for('deepCopy.dummy'));
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
                var scope = {};
                for (var prop in obj.scopes[i]){
                  // values of symbols are never mutated
                  // so a shallow copy should be ok!
                  scope[prop] = obj.scopes[i][prop];
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
