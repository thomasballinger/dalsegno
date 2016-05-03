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
    this.incref(scopeId);
    for (var name of Object.keys(toAdd)){
      this.define(this.nextId, name, toAdd[name]);
    }
    return this.nextId++;
  };
  ScopeCheck.prototype.incref = function(scopeId){
    if (!this.scopes.has(scopeId)){ throw Error('Bad scopeId!'); }
    //TODO do this mutably
    this.scopes.updateIn([scopeId, 'refcount'], e => e + 1);
    if (this.scopes.getIn([scopeId, 'parent'])){
      this.incref(this.scopes.getIn([scopeId, 'parent']));
    }
  };
  ScopeCheck.prototype.decref = function(scopeId){
    if (!this.scopes.has(scopeId)){ throw Error('Bad scopeId!'); }
    var refcount = this.scopes.getIn([scopeId, 'refcount']);
    if (refcount === 1){
      //TODO don't make many copies in this process
      var parent = this.scopes.getIn([scopeId, 'parent']);
      if (parent !== null){
        this.scopes = this.scopes.delete(scopeId);
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
    if (!this.scopes.has(scopeId)){ throw Error('Bad scopeId: '+scopeId+' when only scopes are '+Object.keys(this.scopes.toObject())); }
    this.scopes = this.scopes.setIn([scopeId, 'data', name], value);
  };
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
      return val;
    }
  };
  ScopeCheck.prototype.set = function(scopeId, name, value){
    if (!this.scopes.has(scopeId)){ throw Error('Bad scopeId!'); }
    if (this.scopes.hasIn([scopeId, 'data', name])){
      this.scopes = this.scopes.setIn([scopeId, 'data', name], value);
      return true;
    } else if (this.scopes.getIn([scopeId, 'parent'])){
      return this.set(this.scopes.getIn([scopeId, 'parent']), name, value);
    } else {
      return false;
    }
  };

  ScopeCheck.prototype.forEachValue = function(cb){
    this.scopes.forEach( (scope, id) => {
      scope.forEach(cb);
    });
  };
  ScopeCheck.prototype.ingest = function(other){
    this.scopes = this.scopes.mergeWith( (us, them) => { throw Error('conflicting scopeIds'); }, other.scopes);
  };
  ScopeCheck.prototype.toObject = function(scopeId){
    if (!this.scopes.has(scopeId)){ throw Error('Bad scopeId!'); }
    return this.scopes.get(scopeId).get('data').toJS();
  };

  ScopeCheck.prototype.toString = function(){
    return 'ScopeCheck';
  };

  ScopeCheck.ScopeCheck = ScopeCheck;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = ScopeCheck;
    }
  } else {
    window.ScopeCheck = ScopeCheck;
  }
})();
