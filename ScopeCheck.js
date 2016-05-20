;(function() {
  'use strict';
  /**
   * Scope Check is used to refcount immutable scopes.
   * Like this.funs, it'll be held by the runner.
   * Environments will hold a scope ticket to a scope, and
   */

  var require;
  if (typeof window === 'undefined') {
    require = module.require;
  } else {
    require = function(name){
      var realname = name.match(/(\w+)[.]?j?s?$/)[1];
      return window[realname];
    };
  }
  var Immutable = require('./Immutable.js');

  function ScopeCheck(nextId){
    // start at 1 because 0 would is falsy
    nextId = nextId || Math.ceil(Math.random() * Number.MAX_SAFE_INTEGER);
    this.scopes = Immutable.Map();
    this.nextId = nextId;
  }
  ScopeCheck.NOTFOUND = {};

  /** Each  */
  ScopeCheck.prototype.copy = function(){
    var copy = new ScopeCheck();
    copy.scopes = this.scopes;
    copy.nextId = this.nextId;
    return copy;
  };
  ScopeCheck.prototype.new = function(){
    this.scopes = this.scopes.set(this.nextId, Immutable.Map(
      { refcount: 1, data: Immutable.Map(), parent: null }));
    return this.nextId++;
  };
  ScopeCheck.prototype.newFromScope = function(scopeId, toAdd){
    toAdd = toAdd || {};
    if (!this.scopes.has(scopeId)){ throw Error('Bad scopeId!'); }
    this.scopes = this.scopes.set(this.nextId, Immutable.Map(
      { refcount: 1, data: Immutable.Map(), parent: scopeId }));
    console.log('increfing', scopeId, 'because parent of new scope');
    this.scopes = this.scopes.updateIn([scopeId, 'refcount'], e => e + 1);
    for (var name of Object.keys(toAdd)){
      this.define(this.nextId, name, toAdd[name]);
    }
    return this.nextId++;
  };
  ScopeCheck.prototype.incref = function(scopeId){
    if (!this.scopes.has(scopeId)){ throw Error('Bad scopeId!'); }
    var refcount = this.scopes.getIn([scopeId, 'refcount']);
    console.log('increfing', scopeId, ':', this.keys(scopeId), 'from', refcount, 'to', refcount+1);
    //TODO do this mutably
    this.scopes = this.scopes.updateIn([scopeId, 'refcount'], e => e + 1);
    var parent = this.scopes.getIn([scopeId, 'parent']);
    if (parent){
      this.scopes = this.scopes.updateIn([parent, 'refcount'], e => e + 1);
    }
  };
  ScopeCheck.prototype.decref = function(scopeId){
    if (!this.scopes.has(scopeId)){ throw Error('Bad scopeId!'); }
    var refcount = this.scopes.getIn([scopeId, 'refcount']);
    console.log('decrefing', scopeId, ':', this.keys(scopeId), 'from', refcount, 'to', refcount-1);
    if (refcount === 1){
      //TODO don't make many copies in this process
      var parent = this.scopes.getIn([scopeId, 'parent']);
      this.scopes = this.scopes.delete(scopeId);
      if (parent !== null){
        console.log('and its parent', parent);
        this.decref(parent);
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
  ScopeCheck.prototype.getScopes = function(scopeId){
    return [scopeId].concat(this.getParents(scopeId));
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
  scopeCheck.prototype.getConnectedScopes = function(seen){
    seen = seen.slice();
    return seen;
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
      val.incref();
      console.log('because', reason);
    }
  }
  /** Decrefs if managed object */
  function decref(val, reason){
    if (val && val.decref){
      val.decref();
      console.log('because', reason);
    }
  }
  /** Increfs if managed object and returns either way */
  function increfed(val, reason){
    if (val && val.incref){
      val.incref();
      console.log('because', reason);
    }
    return val;
  }
  /** Decrefs if managed object and returns either way */
  function decrefed(val, reason){
    if (val && val.decref){
      val.decref();
      console.log('because', reason);
    }
    return val;
  }

  ScopeCheck.ScopeCheck = ScopeCheck;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = ScopeCheck;
    }
  } else {
    window.ScopeCheck = ScopeCheck;
  }
})();
