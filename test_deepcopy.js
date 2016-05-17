'use strict';
var chai = require('chai');
var assert = chai.assert;

var deepCopy = require('./deepcopy.js');
var Environment = require('./Environment.js');
var parse = require('./parse');
var jc = parse.justContent;
var bcrun = require('./bcrun');
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
    it('passes immutable.js objects through', function(){
      var a = Immutable.Map({name: 'hi'});
      assert.strictEqual(a, deepCopy(a));
    });

    describe('bytecode specific', function(){
      describe('runnner', function(){
        it('can be resumed after being cloned', function(){
          var runner = new bcrun.BCRunner({});
          var origScopeCheck = runner.scopeCheck;
          var tmpEnv = Environment.fromMultipleMutables([{'+': function(a, b){return a + b;}}, {a: 1, b: 1, c: 1}], runner);

          // So we can hold onto an environment and check in on it, creating a new environment
          // preserves the old scopeCheck (the runner using a new one would invalidate the old
          // stored env which holds a reference to this runner
          var tmpEnvBuilder = function(){
            runner.scopeCheck = origScopeCheck;
            return tmpEnv;
          };
          runner.setEnvBuilder(tmpEnvBuilder);

          runner.loadUserCode('(begin (defn foo () 1) (foo))');
          assert.equal(false, runner.runABit(100));
          console.log('foo:', runner.getState('foo'));
          assert.equal(runner.getState('foo').context.counterStack.peek(), 6);
          runner.update('(begin (defn foo () 2) (foo))');
          /*
          assert.deepEqual(jc(runner.getState('foo').delegate.env.runner.funs.foo.body), 2);
          assert.deepEqual(jc(runner.funs['foo'].body), 2);
          assert.deepEqual(jc(runner.delegate.env.runner.funs['foo'].body), 2);
          assert.equal(2, runner.value());
          assert.deepEqual(jc(runner.getState('foo').delegate.env.runner.funs.foo.body), 2);
          */
        });
      });
    });
  });
  var tests = function(run, Runner){
    return function(){
      describe('runner makes copies', function(){
        it('should use different scopes for copies', function(){
          var tmpEnv = Environment.fromMultipleMutables([{'+': function(a, b){return a + b;}}, {a: 1, b: 1, c: 1}]);
          var runner = new Runner(null);
          runner.loadCode('(begin (set! a (+ a 1)) a)', tmpEnv);
          runner.next();
          runner.next();
          runner.next();
          runner.next();
          assert.deepEqual(tmpEnv.toObjects()[1], {a: 1, b: 1, c: 1});
          var copy = runner.copy();
          runner.next();
          assert.deepEqual(tmpEnv.toObjects()[1], {a: 2, b: 1, c: 1});
          runner.context = copy.context;
          runner.scopeCheck = copy.scopeCheck;
          assert.deepEqual(tmpEnv.toObjects()[1], {a: 1, b: 1, c: 1});
        });
        it('should deepcopy the environment of functions', function(){
          var funs = {};
          var tmpEnv = Environment.fromMultipleMutables([{}, {a: 1}]);
          var func = new parse.Function([1], [], tmpEnv, 'main');

          /*
           * TODO
          var runner = new Runner(funs);
          runner.loadCode('(1)', tmpEnv);
          tmpEnv.setFunction('main', func);

          var newfuns = runner.copy().funs;
          func.env.set('a', 42)scopes[1].data = func.env.scopes[1].data.set('a', 42);
          assert.deepEqual(newfuns['main'].env.scopes[1].data.get('a'), 1);
          */
        });
      });
    };
  };
  describe('with bytcode', tests(bcrun, bcrun.BCRunner));
});
