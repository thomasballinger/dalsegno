'use strict';
var chai = require('chai');
var assert = chai.assert;

var deepCopy = require('./deepcopy.js');
var run = require('./run');

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
      var test = new g.constructor(Symbol.for('deepcopy.dummy'), Symbol.for('deepcopy.dummy'));
      var copy = deepCopy.copiers.EvalObject.create(g);
      assert.strictEqual(test.__proto__, g.__proto__);
      assert.strictEqual(copy.__proto__, g.__proto__);
    });
  });
  describe('runner makes copies', function(){
    it('should use different scopes for copies', function(){
      var tmpEnv = new run.Environment([{'+': function(a, b){return a + b;}}, {a: 1, b: 1, c: 1}], {});
      var runner = new run.Runner('(begin (set! a (+ a 1)) a)', tmpEnv);
      runner.next();
      runner.next();
      runner.next();
      runner.next();
      runner.next();
      assert.deepEqual(tmpEnv.scopes[1], {a: 1, b: 1, c: 1});
      var old = runner.delegate;
      var toUnpack = runner.copy();
      var g = toUnpack[1];
      runner.delegate = toUnpack[1];
      runner.next();
      assert.deepEqual(runner.next(), { value: 2, finished: true });
      assert.deepEqual(tmpEnv.scopes[1], {a: 1, b: 1, c: 1});
    });
  });
});
