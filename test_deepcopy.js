'use strict';
var chai = require('chai');
var assert = chai.assert;

var deepCopy = require('./deepcopy.js');
var run = require('./run');
var parse = require('./parse');
var Immutable = require('./Immutable');

function removeIds(obj){
  if (obj === undefined){return;}
  if (obj.__obj_id !== undefined){
    delete obj.__obj_id;
    for (var prop in obj){
      removeIds(obj[prop]);
    }
  }
  return obj;
}

describe('copyable execution trees', function(){
  describe('deepcopy stuff', function(){
    it("works with Oran's example", function(){
      var john = {
          name: 'John Smith',
          hobbies: ['surfing', 'diving'],
          friends: []
      };
      var bob = {
          name: 'Bob Boston',
          hobbies: ['rowing', 'surfing'],
          friends: [ john ]
      };
      john.friends.push(bob);

      var john2 = deepCopy(john);
      var bob2 = john2.friends[0];

      assert.deepEqual(john2.hobbies, removeIds(john.hobbies));
      assert.deepEqual(john2.name, john.name);
      assert.deepEqual(john2, removeIds(john));
      assert.notStrictEqual(john2, removeIds(john));
      assert.notStrictEqual(bob2, removeIds(bob));
      assert.strictEqual(bob2, removeIds(bob2.friends[0].friends[0]));
      assert.deepEqual(bob2, removeIds(bob));
      assert.strictEqual(bob2.friends[0], john2);
    });
  });
  describe('genEval objects', function(){
    it('should retain their prototypes when copied', function(){
      var g = new run.evalGen.StringLiteral('hi');
      var copy = deepCopy(g);
      assert.deepEqual(removeIds(g.delegate), copy.delegate);
      assert.deepEqual(g.ast, copy.ast);
      assert.deepEqual(removeIds(g.values), copy.values);
      assert.deepEqual(removeIds(g.env), copy.env);
      assert.equal(g.__proto__, copy.__proto__);
      assert.deepEqual(removeIds(g), copy);
    });
  });
  describe('copiers', function(){
    it('evalGen co should work', function(){
      var g = new run.evalGen.StringLiteral('hi');
      var test = new g.constructor(null, null);
      var copy = deepCopy.copiers.EvalObject.create(g);
      assert.strictEqual(test.__proto__, g.__proto__);
      assert.strictEqual(copy.__proto__, g.__proto__);
    });
  });
  describe('immutable', function(){
    it('passes immutable.js objects through', function(){
      var a = Immutable.Map({name: 'hi'});
      assert.strictEqual(a, deepCopy(a));
    });
  });
  describe('runner makes copies', function(){
    it('should use different scopes for copies', function(){
      var tmpEnv = new run.Environment([{'+': function(a, b){return a + b;}}, {a: 1, b: 1, c: 1}]);
      var runner = new run.Runner(null);
      runner.loadCode('(begin (set! a (+ a 1)) a)', tmpEnv);
      runner.next();
      runner.next();
      runner.next();
      runner.next();
      runner.next();
      assert.deepEqual(tmpEnv.scopes[1], {a: 1, b: 1, c: 1});
      var old = runner.delegate;
      runner.delegate = runner.copy().delegate;
      runner.next();
      assert.deepEqual(runner.next(), { value: 2, finished: true });
      assert.deepEqual(tmpEnv.scopes[1], {a: 1, b: 1, c: 1});
    });
    it('can be resumed after being cloned', function(){
      var tmpEnv = new run.Environment([{'+': function(a, b){return a + b;}}, {a: 1, b: 1, c: 1}]);
      var tmpEnvBuilder = function(){return tmpEnv;};
      var runner = new run.Runner({});
      runner.setEnvBuilder(tmpEnvBuilder);
      runner.loadUserCode('(begin (defn foo 1) (foo))');
      assert.equal(false, runner.runABit(100));
      assert.deepEqual(runner.getState('foo').delegate.ast, ['foo']);
      runner.update('(begin (defn foo 2) (foo))');
      assert.deepEqual(runner.getState('foo').delegate.env.runner.funs.foo.body, 2);
      assert.deepEqual(runner.funs['foo'].body, 2);
      assert.deepEqual(runner.delegate.env.runner.funs['foo'].body, 2);
      assert.equal(2, runner.value());
      assert.deepEqual(runner.getState('foo').delegate.env.runner.funs.foo.body, 2);
    });
    it('swapping out the delegate with restoreState results in old environment', function(){
      var tmpEnv = new run.Environment([{'+': function(a, b){return a + b;}}, {a: 1}]);
      var tmpEnvBuilder = function(){return tmpEnv;};
      var program = '(begin (defn main (do 1 2 (main))) (main))';
      var runner = new run.Runner({});
      runner.setEnvBuilder(tmpEnvBuilder);
      runner.loadUserCode(program);
      tmpEnv.scopes[1].a = 42;
      var g = runner.copy().delegate;
      tmpEnv.scopes[1].a = 9000;
      assert.deepEqual(g.env.scopes[1].a, 42);
      runner.delegate = g;
      assert.deepEqual(runner.delegate.env.scopes[1].a, 42);
      runner.runABit(100);
      assert.deepEqual(runner.delegate.env.scopes[1].a, 42);
    });
    it('should deepcopy the environment of functions', function(){
      var funs = {};
      var tmpEnv = new run.Environment([{}, {a: 1}]);
      var func = new parse.Function([1], [], tmpEnv, 'main');

      var runner = new run.Runner(funs);
      runner.loadCode('(1)', tmpEnv);
      tmpEnv.runner = runner;
      tmpEnv.setFunction('main', func);

      var newfuns = runner.copy().funs;
      func.env.scopes[1].a = 42;
      assert.deepEqual(newfuns['main'].env.scopes[1].a, 1);
    });
  });
});
