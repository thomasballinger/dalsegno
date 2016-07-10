'use strict';
/**
 * Scope Check is used to refcount immutable scopes.
 * Like this.funs, it'll be held by the runner.
 * Environments will hold a scope ticket to a scope, and
 */

var Immutable = require('./Immutable.js');

function ScopeCheck(nextId, log){
  // start at 1 because 0 would is falsy
  if (nextId === 0){
    throw Error('cannot use 0 for inital nextId');
  }
  nextId = nextId || Math.ceil(Math.random() * Number.MAX_SAFE_INTEGER);
  if (log){
    this.log = ['created, nextId is '+nextId];
  }
  this.scopes = Immutable.Map();
  this.nextId = nextId;
}
ScopeCheck.NOTFOUND = {};

/** Each  */
ScopeCheck.prototype.copy = function(){
  var copy = new ScopeCheck();
  copy.scopes = this.scopes;
  copy.nextId = this.nextId;
  if(this.log){
    copy.log = this.log.concat(['copied! This is the copy.']);
    this.log.push(['copied! This is the original.']);
  }
  return copy;
};
ScopeCheck.prototype.new = function(reason){
  this.scopes = this.scopes.set(this.nextId, Immutable.Map(
    { refcount: 1, data: Immutable.Map(), parent: null }));
  if (this.log){
    this.log.push('new scope '+this.nextId+' created because '+reason);
  }
  return this.nextId++;
};
ScopeCheck.prototype.newFromScope = function(scopeId, toAdd){
  toAdd = toAdd || {};
  if (!this.scopes.has(scopeId)){ throw Error('Bad scopeId!'); }
  this.scopes = this.scopes.set(this.nextId, Immutable.Map(
    { refcount: 1, data: Immutable.Map(), parent: scopeId }));
  this.scopes = this.scopes.updateIn([scopeId, 'refcount'], e => e + 1);
  for (var name of Object.keys(toAdd)){
    this.define(this.nextId, name, toAdd[name]);
  }
  if (this.log){
    this.log.push(['new scope '+this.nextId+' created with mapping '+this.keys(this.nextId)]);
  }
  return this.nextId++;
};
ScopeCheck.prototype.incref = function(scopeId, reason){
  if (!this.scopes.has(scopeId)){ throw Error('Bad scopeId!'); }
  var refcount = this.scopes.getIn([scopeId, 'refcount']);
  if (this.log){
    this.log.push('increfing ' + scopeId + ':' + this.keys(scopeId) + ' from ' + refcount + ' to ' + (refcount+1) + ' because ' + reason);
  }
  //TODO do this mutably
  this.scopes = this.scopes.updateIn([scopeId, 'refcount'], e => e + 1);
  var parent = this.scopes.getIn([scopeId, 'parent']);
  if (parent){
    if (this.log){
      var from = this.scopes.getIn([parent, 'refcount']);
      this.log.push('and increfing its parent ' + parent + ':' + this.keys(parent)+' from ' + from + ' to ' + (from + 1));
    }
    this.scopes = this.scopes.updateIn([parent, 'refcount'], e => e + 1);
  }
};
ScopeCheck.prototype.decref = function(scopeId, reason){
  if (!this.scopes.has(scopeId)){ throw Error('Bad scopeId: '+scopeId); }
  var refcount = this.scopes.getIn([scopeId, 'refcount']);
  if (this.log){
    this.log.push('decrefing ' + scopeId + ':' + this.keys(scopeId) + ' from ' + refcount + ' to ' + (refcount-1) + ' because ' + reason);
  }
  if (refcount === 1){
    //TODO don't make many copies in this process
    var parent = this.scopes.getIn([scopeId, 'parent']);
    this.scopes = this.scopes.delete(scopeId);
    if (this.log){ this.log.push('deleting ' + scopeId); }
    if (parent !== null){
      if (this.log){
        this.log.push('and it has a parent: ' + parent);
      }
      this.decref(parent, 'child scope deleted');
    }
  } else {
    this.scopes = this.scopes.updateIn([scopeId, 'refcount'], e => e - 1);
  }
};
/** Returns a list of keys in a scope */
ScopeCheck.prototype.keys = function(scopeId){
  if (!this.scopes.has(scopeId)){ throw Error('Bad scopeId: '+scopeId); }
  var result = Object.keys(this.scopes.get(scopeId).get('data').toJS());
  return result;
};
ScopeCheck.prototype.values = function(scopeId){
  if (!this.scopes.has(scopeId)){ throw Error('Bad scopeId: '+scopeId); }
  return this.scopes.get(scopeId).get('data').toList().toJS();
};
ScopeCheck.prototype.mapping = function(scopeId){
  if (!this.scopes.has(scopeId)){ throw Error('Bad scopeId: '+scopeId); }
  var immutableScope = this.scopes.get(scopeId).get('data');
  return immutableScope.toObject();
};

ScopeCheck.prototype.define = function(scopeId, name, value){
  if (!this.scopes.has(scopeId)){ throw Error('Bad scopeId: '+scopeId+' when '+this.scopes.count()+' scopes present: '+Object.keys(this.scopes.toObject())); }
  incref(value, 'stored by define');
  decref(this.scopes.getIn([scopeId, 'data', name], undefined), 'displaced by define');
  this.scopes = this.scopes.setIn([scopeId, 'data', name], value);
};
/** Looks up value and increfs it if it's a managed object */
ScopeCheck.prototype.lookup = function(scopeId, name){
  if (!this.scopes.has(scopeId)){ throw Error('Bad scopeId!'); }
  var val = this.scopes.getIn([scopeId, 'data', name], ScopeCheck.NOTFOUND);
  if (val === ScopeCheck.NOTFOUND){
    if (this.scopes.getIn([scopeId, 'parent'])){
      return this.lookup(this.scopes.getIn([scopeId, 'parent']), name);
    } else {
      return ScopeCheck.NOTFOUND;
    }
  } else {
    return increfed(val, 'lookup');
  }
};
ScopeCheck.prototype.set = function(scopeId, name, value){
  if (!this.scopes.has(scopeId)){ throw Error('Bad scopeId!'); }
  if (this.scopes.hasIn([scopeId, 'data', name])){
    decref(this.scopes.getIn([scopeId, 'data', name], undefined), 'displaced by set');
    this.scopes = this.scopes.setIn([scopeId, 'data', name], value);
    incref(value, 'stored by set');
    return true;
  } else if (this.scopes.getIn([scopeId, 'parent'])){
    return this.set(this.scopes.getIn([scopeId, 'parent']), name, value);
  } else {
    return false;
  }
};
/** Returns scope id of parent scope or null is none exists */
ScopeCheck.prototype.getParent = function(scopeId){
  return this.scopes.getIn([scopeId, 'parent']);
};
ScopeCheck.prototype.getCount = function(scopeId){
  return this.scopes.getIn([scopeId, 'refcount']);
};
ScopeCheck.prototype.getNumNames = function(scopeId){
  return this.scopes.getIn([scopeId, 'data']).count();
};
ScopeCheck.prototype.getNames = function(scopeId){
  var names = Array.from(this.scopes.getIn([scopeId, 'data']).keys());
  names.sort();
  return names.join(', ').slice(0, 100);
};
/** Returns the parents of a scope, the scopes contained in a scope,
 * and the scopes contained in those parents */
ScopeCheck.prototype.getScopesInScopeAndParents = function(scopeId, ignoreParents){
  function getScopes(val){
    if (Immutable.Iterable.isIterable(val)){
      return val.flatMap(getScopes).toJS();
    } else if (val === null || val === undefined){
      return [];
    } else if (val.getScopes){
      // functions are the only thing that will have this
      if (val.constructor.name !== 'CompiledFunctionObject'){
        throw Error('found non-CompiledFunctionObject with .getScopes prop: '+val);
      }
      return val.getScopes();
    } else {
      return [];
    }
  }

  if (ignoreParents){
    var tmp = this.scopes.get(scopeId).get('data').toList().flatMap(getScopes).toJS();
    return tmp;
  }
  var lineage = Immutable.List([scopeId].concat(this.getParents(scopeId)));
  var contained = lineage.flatMap(x => this.values(x)).flatMap(getScopes).toJS();
  return lineage.concat(contained).toJS();
};
ScopeCheck.prototype.getScopesInScope = function(scopeId){
  return this.getScopesInScopeAndParents(scopeId, true);
};
ScopeCheck.prototype.getParents = function(scopeId){
  var parents = [];
  var cur = this.scopes.getIn([scopeId, 'parent']);
  while(cur){
    parents.push(cur);
    cur = this.scopes.getIn([cur, 'parent']);
  }
  return parents;
};
ScopeCheck.prototype.getConnectedScopes = function(seen){
  if (seen.length < 1){ return []; }
  var fringe = seen.slice();
  seen = Immutable.Set([]).asMutable();
  while (fringe.length > 0){
    var cur = fringe.pop();
    if (seen.includes(cur)){
      continue;
    }
    seen.add(cur);
    fringe.push.apply(fringe, this.getScopesInScopeAndParents(cur));
  }
  return seen.toArray();
};
/** Collects anything unreachable from reachable array
 * and returns the scopes collected */
//TODO use a technique that actually benefits from reference counting, or
//get rid of reference counting altogether
ScopeCheck.prototype.gc = function(context, runner){
  if (this.alwaysRunGC){
    //pass
  } else if (Math.random() > 0.00002){
    return;
  }
  var reachable = context.getScopes().concat(runner ? runner.getFunScopes() : []);
  this._gc(reachable);
};
ScopeCheck.prototype._gc = function(reachable){
  if (!Array.isArray(reachable)){ throw Error('gc needs an array of reachable scopes'); }
  reachable = Immutable.Set(this.getConnectedScopes(reachable));
  var toRemove = this.scopes.keySeq().toSet().subtract(reachable).toArray();
  toRemove.forEach( scope => {
    this.scopes = this.scopes.remove(scope);
  });
  return toRemove;
};

ScopeCheck.prototype.forEachValue = function(cb){
  this.scopes.forEach( (scope, id) => {
    scope.forEach(cb);
  });
};
ScopeCheck.prototype.ingest = function(other){
  if (this === other){ return; }
  this.scopes = this.scopes.mergeWith( (us, them) => { throw Error('conflicting scopeIds'); }, other.scopes);
};
ScopeCheck.prototype.toObject = function(scopeId){
  if (!this.scopes.has(scopeId)){ throw Error('Bad scopeId!'); }
  return this.scopes.get(scopeId).get('data').toJS();
};

ScopeCheck.prototype.toString = function(){
  var output = 'ScopeCheck with ' + this.scopes.count()+' scopes';
  if (this.scopes.count() === 0){
    return output;
  }
  output += ':';
  this.scopes.forEach( (scope, id) => {
    output += '\n  '+id+' (refcount '+this.getCount(id)+') with '+this.getNumNames(id)+' names' +
      (this.getNumNames(id) === 0 ? '' : (': ' + this.getNames(id)));
  });
  return output;
};

/** Increfs if managed object */
function incref(val, reason){
  if (val && val.incref){
    val.incref(reason);
  }
}
/** Decrefs if managed object */
function decref(val, reason){
  if (val && val.decref){
    val.decref(reason);
  }
}
/** Increfs if managed object and returns either way */
function increfed(val, reason){
  if (val && val.incref){
    val.incref(reason);
  }
  return val;
}
/** Decrefs if managed object and returns either way */
function decrefed(val, reason){
  if (val && val.decref){
    val.decref(reason);
  }
  return val;
}

ScopeCheck.ScopeCheck = ScopeCheck;

module.exports = ScopeCheck;
