'use strict';
var chai = require('chai');
var assert = chai.assert;

var deepCopy = require('./deepcopy.js');
var Environment = require('./Environment.js');
var parse = require('./parse');
var jc = parse.justContent;
var evalgenrun = require('./run');
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

    //TODO write analogous tests for bytecode implementation
    describe('genEval specific', function(){
      describe('genEval objects', function(){
        it('should retain their prototypes when copied', function(){
          var g = new evalgenrun.evalGen.StringLiteral('hi');
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
          var g = new evalgenrun.evalGen.StringLiteral('hi');
          var test = new g.constructor(null, null);
          var copy = deepCopy.copiers.EvalObject.create(g);
          assert.strictEqual(test.__proto__, g.__proto__);
          assert.strictEqual(copy.__proto__, g.__proto__);
        });
      });
      describe('runnner', function(){
        it('can be resumed after being cloned', function(){
          var tmpEnv = new Environment.fromObjects([{'+': function(a, b){return a + b;}}, {a: 1, b: 1, c: 1}]);
          var tmpEnvBuilder = function(){return tmpEnv;};
          var runner = new evalgenrun.Runner({});
          runner.setEnvBuilder(tmpEnvBuilder);
          runner.loadUserCode('(begin (defn foo 1) (foo))');
          assert.equal(false, runner.runABit(100));
          assert.deepEqual(jc(runner.getState('foo').delegate.ast), ['foo']);
          runner.update('(begin (defn foo 2) (foo))');
          assert.deepEqual(jc(runner.getState('foo').delegate.env.runner.funs.foo.body), 2);
          assert.deepEqual(jc(runner.funs['foo'].body), 2);
          assert.deepEqual(jc(runner.delegate.env.runner.funs['foo'].body), 2);
          assert.equal(2, runner.value());
          assert.deepEqual(jc(runner.getState('foo').delegate.env.runner.funs.foo.body), 2);
        });
        it('swapping out the delegate with restoreState results in old environment', function(){
          var tmpEnv = new Environment.fromObjects([{'+': function(a, b){return a + b;}}, {a: 1}]);
          var tmpEnvBuilder = function(){return tmpEnv;};
          var program = '(begin (defn main (do 1 2 (main))) (main))';
          var runner = new evalgenrun.Runner({});
          runner.setEnvBuilder(tmpEnvBuilder);
          runner.loadUserCode(program);
          tmpEnv.scopes[1].data = tmpEnv.scopes[1].data.set('a', 42);
          var g = runner.copy().delegate;
          tmpEnv.scopes[1].a = 9000;
          assert.deepEqual(g.env.scopes[1].data.get('a'), 42);
          runner.delegate = g;
          assert.deepEqual(runner.delegate.env.scopes[1].data.get('a'), 42);
          runner.runABit(100);
          assert.deepEqual(runner.delegate.env.scopes[1].data.get('a'), 42);
        });
      });
    });
  });
  var tests = function(run, Runner){
    return function(){
      describe('runner makes copies', function(){
        it('should use different scopes for copies', function(){
          var tmpEnv = new Environment.fromObjects([{'+': function(a, b){return a + b;}}, {a: 1, b: 1, c: 1}]);
          var runner = new Runner(null);
          runner.loadCode('(begin (set! a (+ a 1)) a)', tmpEnv);
          runner.next();
          runner.next();
          runner.next();
          runner.next();
          assert.deepEqual(tmpEnv.toObjects()[1], {a: 1, b: 1, c: 1});
          var copy = runner.copy();
          if (Runner.name === 'BCRunner'){
            var newRunner = new Runner(null);
            newRunner.context = copy.context;
            newRunner.next();
          } else {
            var old = runner.delegate;
            runner.delegate = runner.copy().delegate;
            runner.next();
            runner.next();
            assert.deepEqual(runner.next(), { value: 2, finished: true });
          }
          assert.deepEqual(tmpEnv.toObjects()[1], {a: 1, b: 1, c: 1});
          //TODO I don't think this is testing anything
        });
        it('should deepcopy the environment of functions', function(){
          var funs = {};
          var tmpEnv = new Environment.fromObjects([{}, {a: 1}]);
          var func = new parse.Function([1], [], tmpEnv, 'main');

          var runner = new Runner(funs);
          runner.loadCode('(1)', tmpEnv);
          tmpEnv.runner = runner;
          tmpEnv.setFunction('main', func);

          var newfuns = runner.copy().funs;
          func.env.scopes[1].data = func.env.scopes[1].data.set('a', 42);
          assert.deepEqual(newfuns['main'].env.scopes[1].data.get('a'), 1);
        });
      });
    };
  };
  describe('with evalgen', tests(evalgenrun, evalgenrun.Runner));
  describe('with bytcode', tests(bcrun, bcrun.BCRunner));
});
