;(function() {
  'use strict';
  /**
   * Scope Check is used to refcount immutable scopes.
   * Like this.funs, it'll be held by the runner.
   * Environments will hold a scope ticket to a scope, and
   * 
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

  function ScopeCheck(){
    this.scopes = Immutable.Map();
    this.nextId = 1; // start at 1 because 0 would is falsy
  }
  ScopeCheck.NOTFOUND = {};
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
  ScopeCheck.prototype.newFromScope = function(scopeId){
    if (!this.scopes.has(scopeId)){ throw Error('Bad scopeId!'); }
    this.scopes = this.scopes.set(this.nextId, Immutable.Map(
      { refcount: 1, data: Immutable.Map(), parent: scopeId }));
    this.incref(scopeId);
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

  ScopeCheck.prototype.define = function(scopeId, name, value){
    if (!this.scopes.has(scopeId)){ throw Error('Bad scopeId!'); }
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
    if (this.scopes.hasIn([scopesId, 'data', name])){
      this.scopes = this.scopes.setIn([scopesId, 'data', name], value);
    } else if (this.scopes.getIn([scopeId, 'parent'])){
      this.set(this.scopes.getIn([scopeId, 'parent']), name, value);
    } else {
      throw Error("can't find binding to modify for variable "+name);
    }
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
