;(function() {
  'use strict';

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

  //TODO pprinting of ordinals for error messages

  function arityCheck(args, n){
    //TODO add typechecks
    //TODO link to docs for function that was bad
    if (!Array.isArray(n)){
      if (args.length != n){
        throw Error("Wrong number of arguments, expected "+n+" but found "+args.length+".");
      }
      return;
    }
    var minArgs = Math.min.apply(null, n);
    var maxArgs = Math.max.apply(null, n);
    if (args.length < minArgs){
      throw Error("Not enough arguments, at least "+minArgs+" are required.");
    }
    if (args.length > maxArgs){
      throw Error("Too many arguments, expected at most "+maxArgs);
    }
    if (n.indexOf(args.length) === -1){
      throw Error("Wrong number of arguments");
    }
  }

  // Pure JavaScript (no Immutable.js) helpers
  function normalize(dx, dy){
    var magnitude = Math.sqrt(dx*dx + dy*dy);
    return [dx / magnitude, dy / magnitude];
  }
  function linesIntersect(p1, p2, p3, p4) {
      function CCW(p1, p2, p3) {
          return (p3[1] - p1[1]) * (p2[0] - p1[0]) > (p2[1] - p1[1]) * (p3[0] - p1[0]);
      }
      return (CCW(p1, p3, p4) != CCW(p2, p3, p4)) && (CCW(p1, p2, p3) != CCW(p1, p2, p4));
  }
  /** Returns x, y, and object of first collision. */
  function circleCollision(x1, y1, x2, y2, r, points){
  // The REAL intersection question is "Did this ball at any point hit a wall?"
  // which includes current arc, the rectangle to the new point, and the new arc.
  // A new bounce function therefore needs initial and final positions and 
  //
  // We can ignore the ball's initial position. If the ball was just placed here,
  // dx and dy will be 0 anyway so we'll catch a bad placement in the next steps.
  // Next a rectangle with width 2*r is checked. We look for lines inter
  // TOMHERE - what do we look for? what about objects floating inside the rectangle?

  }
  /** Distance from p1 to line intersection, or Infinity if they don't intersect */
  function distToLineIntersection(p1, p2, p3, p4){
    if (!linesIntersect(p1, p2, p3, p4)){ return Infinity; }
    var m1 = (p2[1]-p1[1]) / (p2[0]-p1[0]);
    var m2 = (p4[1]-p3[1]) / (p4[0]-p3[0]);
    var k1 = p1[1] - m1*p1[0];
    var k2 = p3[1] - m2*p3[0];
    if (m1 === m2){  // parallel
      if (k1 === k2){ throw Error("Lines are collinear"); }
      return Infinity;  // otherwise they never intersect
    }
    var x = (k2 - k1) / (m1 - m2);
    var y = m1*x + k1;
    var sqr = n => n*n;
    return Math.sqrt(sqr(p1[0]-x)+sqr(p1[1]-y));
  }
  /** Returns closest line or point and distance to it */
  function pointFromLineSegment(p0, p1, p2) {
    function dist2(p1, p2) {
      var sqr = x => x*x;
      return sqr(p1[0] - p2[0]) + sqr(p1[1] - p2[1]);
    }
    var lengthSquared = dist2(p1, p2);
    if (lengthSquared === 0) return [p1, dist2(p0, p1)];
    var t = ((p0[0] - p1[0]) * (p2[0] - p1[0]) +
             (p0[1] - p1[1]) * (p2[1] - p1[1])) / lengthSquared;
    t = Math.max(0, Math.min(1, t));
    var dist = Math.sqrt(dist2(p0, [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])]));
    var obj = t === 0 ? p1 : ( t === 1 ? p2 : [p1, p2]);
    return [obj, dist];
  }

  var builtins = {
    '+': function(){
      return Array.prototype.slice.call(arguments).reduce(function(a, b){
        return a + b;
      }, 0);
    },
    '-': function(a, b){ arityCheck(arguments, 2); return (a - b); },
    '>': function(a, b){ arityCheck(arguments, 2); return (a > b); },
    '<': function(a, b){ arityCheck(arguments, 2); return (a < b); },
    '=': function(a, b){ arityCheck(arguments, 2); return (a === b); },
    '*': function(a, b){ arityCheck(arguments, 2); return a * b; },
    '/': function(a, b){ arityCheck(arguments, 2); return a / b; },
    '//': function(a, b){ arityCheck(arguments, 2); return Math.floor(a / b); },
    'abs': function(a){ arityCheck(arguments, 1); return Math.abs(a); },
    '%': function(a, b){
      arityCheck(arguments, 2);
      if (!(a % 1 === 0)){
        throw Error('first modulus argument not an integer: '+a);
      }
      if (!(b % 1 === 0)){
        throw Error('second modulus argument not an integer: '+b);
      }
      while (a < 0){
        a += b;
      }
      return a % b;
    },
    'max': function(){
      var args = Array.prototype.slice.call(arguments);
      if (args.length === 1 && Immutable.List.isList(args[0])){
        args[0].toArray().forEach(function(x, i){
          if (typeof x !== 'number'){
            throw Error(i+'th element of list is not a number: '+x);
          }
        });
        return Math.max.apply(null, args[0].toArray());
      }
      args.forEach(function(x, i){
        if (typeof x !== 'number'){
          throw Error('argument #'+i+' is not a number: '+x);
        }
      });
      return Math.max.apply(null, args);
    },
    'min': function(){
      var args = Array.prototype.slice.call(arguments);
      if (args.length === 1 && Immutable.List.isList(args[0])){
        args[0].toArray().forEach(function(x, i){
          if (typeof x !== 'number'){
            throw Error(i+'th element of list is not a number: '+x);
          }
        });
        return Math.min.apply(null, args[0].toArray());
      }
      args.forEach(function(x, i){
        if (typeof x !== 'number'){
          throw Error('argument #'+i+' is not a number: '+x);
        }
      });
      return Math.min.apply(null, args);
    },
    'or': function(a, b){ arityCheck(arguments, 2);  return a || b; },
    'and': function(a, b){ arityCheck(arguments, 2); return a && b; },
    'not': function(x) { arityCheck(arguments, 1); return !x;},
    'list': function(){ return Immutable.List(Array.prototype.slice.call(arguments)); },
    'any': function(arr){
      arityCheck(arguments, 1);
      if(!Immutable.List.isList(arr)){
        throw Error("argument to any is not a list: "+arr);
      }
      for (var i = 0; i < arr.count(); i++){
        if (arr.get(i)){
          return true;
        }
      }
      return false;
    },
    'get': function(i, arr){
      arityCheck(arguments, 2);
      if(!Immutable.List.isList(arr)){
        throw Error("second argument to get is not a list: "+arr);
      }
      if(i>=arr.count()){
        throw Error("Index error: "+i+" "+arr);
      }
      return arr.get(i);
    },
    'first': function(arr){
      arityCheck(arguments, 1);
      if(!Immutable.List.isList(arr)){
        console.log(arr);
        throw Error("argument to first is not a list: "+arr);
      }
      if(arr.count() < 1){
        throw Error("Index error: "+0+" "+arr);
      }
      return arr.first();
    },
    'last': function(arr){
      arityCheck(arguments, 1);
      if(!Immutable.List.isList(arr)){
        throw Error("argument to last is not a list: "+arr);
      }
      if(arr.count() < 1){
        throw Error("called last on empty list: "+arr);
      }
      return arr.get(arr.count() - 1);
    },
    'rest': function(arr){
      arityCheck(arguments, 1);
      if(!Immutable.List.isList(arr)){
        throw Error("Index error: "+i+" "+arr);
      }
      return arr.rest();
    },
    'concat': function(){
      var args = Array.prototype.slice.call(arguments);
      for (var i = 0; i++; i<list.count()){
        if (!Immutable.List.isList(list[i])){
          throw Error("Concat arguments are not all lists: "+list[i]);
        }
      }
      var l = Immutable.List();
      return l.concat.apply(l, args);
    },
    'slice': function(arr, first, second){
      arityCheck(arguments, [2, 3]);
      if (!Immutable.List.isList(arr)){
        throw Error("slice first arg is not a list: "+JSON.stringify(arr));
      }
      if (second === undefined){
        return arr.slice(first);
      } else {
        return arr.slice(first, second);
      }
    },
    'append': function(arr, item){
      arityCheck(arguments, 2);
      if (!Immutable.List.isList(arr)){
        throw Error("append first arg is not a list: "+JSON.stringify(arr));
      }
      return arr.push(item);
    },
    'prepend': function(arr, item){
      arityCheck(arguments, 2);
      if (!Immutable.List.isList(arr)){
        throw Error("prepend second arg is not a list: "+JSON.stringify(arr));
      }
      return arr.unshift(item);
    },
    'cons': function(item, arr){
      arityCheck(arguments, 2);
      if (!Immutable.List.isList(arr)){
        throw Error("prepend second arg is not a list: "+JSON.stringify(arr));
      }
      return arr.unshift(item);
    },

    'zip': function(arr1, arr2){
      arityCheck(arguments, 2);
      if (!Immutable.List.isList(arr1) || !Immutable.List.isList(arr2)){
        throw Error("zip arg is not a list: "+JSON.stringify(arr1)+JSON.stringify(arr2));
      }
      var comb = Immutable.List();
      for (var i=0; i<Math.min(arr1.count(), arr2.count()); i++){
        comb = comb.push(Immutable.List([arr1.get(i), arr2.get(i)]));
      }
      return comb;
    },
    'zip3': function(arr1, arr2, arr3){
      arityCheck(arguments, 3);
      var args = Array.prototype.slice.call(arguments);
      args.forEach(function(x, i){
        if (!Immutable.List.isList(x)){
          throw Error('argument #'+i+' of list is not a list: '+x);
        }
      });
      var comb = Immutable.List();
      for (var i=0; i<Math.min(arr1.count(), arr2.count(), arr3.count()); i++){
        comb = comb.push(Immutable.List([arr1.get(i), arr2.get(i), arr3.get(i)]));
      }
      return comb;
    },
    'zip4': function(arr1, arr2, arr3, arr4){
      arityCheck(arguments, 4);
      var args = Array.prototype.slice.call(arguments);
      args.forEach(function(x, i){
        if (!Immutable.List.isList(x)){
          throw Error('argument #'+i+' of list is not a list: '+x);
        }
      });
      var comb = Immutable.List();
      for (var i=0; i<Math.min(arr1.count(), arr2.count(), arr3.count(), arr4.count()); i++){
        comb = comb.push(Immutable.List([arr1.get(i), arr2.get(i), arr3.get(i), arr4.get(i)]));
      }
      return comb;
    },

    // gamey stuff
    'dist': function(p1, p2, x2, y2){
      arityCheck(arguments, [2, 4]);
      // works with 2 or 4 arguments
      var x1, y1;
      if (x2 === undefined && y2 === undefined) {
        x1 = p1.get(0);
        y1 = p1.get(1);
        x2 = p2.get(0);
        y2 = p2.get(1);
      } else {
        x1 = p1;
        y1 = p2;
      }
      return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
    },
    'length': function(arr){
      arityCheck(arguments, 1);
      if (!Immutable.List.isList(arr)){
        throw Error("length arg is not a list: "+arr);
      }
      return arr.count();
    },
    'randint': function(lower, upper){
      arityCheck(arguments, [1, 2]);
      if (upper === undefined){
        upper = lower;
        lower = 0;
      }
      return lower + Math.floor(Math.random() * (upper - lower));
    },
    'random': function(){
      return Math.random();
    },
    'range': function(n){
      arityCheck(arguments, 1);
      return Immutable.List(Immutable.Range(0, n));
    },
    'linspace': function(start, stop, n){
      arityCheck(arguments, [2, 3]);
      if (typeof start !== 'number' || typeof stop !== 'number'){
        throw Error('arguments to linspace should be numbers');
      }
      n = n === undefined ? 11 : n;
      var arr = [];
      var step = (stop - start) / (n-1);
      for (var i=0; i<n; i++){
        arr.push(start+step*i);
      }
      return Immutable.List(arr);
    },
    'towards': function(p1, p2, x2, y2){
      arityCheck(arguments, [2, 4]);
      // works with 2 or 4 arguments
      var x1, y1;
      if (x2 === undefined && y2 === undefined) {
        x1 = p1.get(0);
        y1 = p1.get(1);
        x2 = p2.get(0);
        y2 = p2.get(1);
      } else {
        x1 = p1;
        y1 = p2;
      }
      var dx = x2 - x1;
      var dy = y2 - y1;
      return ((Math.atan2(dx, -dy) * 180 / Math.PI) + 270 + 360) % 360;
    },
    'x_comp': function(h){
      arityCheck(arguments, 1);
      return Math.cos(h * Math.PI / 180);
    },
    'y_comp': function(h){
      arityCheck(arguments, 1);
      return Math.sin(h * Math.PI / 180);
    },
    'heading': function(x, y){
      arityCheck(arguments, 2);
      return Math.atan2(x, y) * 180 / Math.PI;
    },
    'linesIntersect': function(line1OrPoint1, line2OrPoint2, point3, point4){
      arityCheck(arguments, [2, 4]);
      var args = Array.prototype.slice.call(arguments);
      args.map(function(a){
        if (!Immutable.List.isList(a)){
          throw Error('Arguments of linesIntersect should be lists');
        }
      });
      var p1, p2, p3, p4;
      if (point3){
        p1 = line1OrPoint1; p2 = line2OrPoint2; p3 = point3; p4 = point4;
      } else {
        p1 = line1OrPoint1.get(0).get(0);
        p2 = line1OrPoint1.get(0).get(1);
        p3 = line1OrPoint1.get(1).get(0);
        p4 = line1OrPoint1.get(1).get(1);
      }
      return linesIntersect(p1, p2, p3, p4);
    },
    /** really to a line segment */
    'distToLine': function(point, line){
      if (!Immutable.List.isList(point) || point.count() !== 2){
        throw Error("first argument to bounce should be a point");
      }
      if (!Immutable.List.isList(line) || line.count() !== 2){
        throw Error("second argument to bounce should be a line");
      }
      var dist = pointFromLineSegment(point.toJS(), line.get(0).toJS(), line.get(1).toJS())[1];
      return dist;
    },
    'closestPointOrLine': function(point, points, r){
      r = r === undefined ? Infinity : r;
      point = point.toJS();
      var lines = [];
      points.toJS().slice(0, -1).forEach( (_, i) => lines.push([points.get(i).toJS(), points.get(i+1).toJS()]) );
      var minDist = r;
      var closest = null;
      lines.forEach( line => {
        var result = pointFromLineSegment(point, line[0], line[1]);
        var obj = result[0];
        var dist = result[1];
        if (dist < minDist){
          closest = obj;
          minDist = dist;
        }
      });
      if (closest !== null && Array.isArray(closest[0])){
        closest = Immutable.List(closest.map( l => Immutable.List(l) ));
      } else if (closest !== null){
        closest = Immutable.List(closest);
      }
      return Immutable.List([closest, minDist]);
    },
    /** Finds first line or point a circle intersects with, or null if none */
    'firstIntersectingPointOrLine': function(x1, y1, x2, y2, r, points){
      arityCheck([6, 7]);
      if (typeof x !== 'number' || typeof x !== 'number' || typeof dx !== 'number' ||
          typeof dy !== 'number' || typeof r !== 'number'){
        throw Error("First 5 arguments to newbounce should be numbers");
      }
      var lines = [];
      points.toJS().slice(0, -1).forEach( (_, i) => lines.push([points.get(i).toJS(), points.get(i+1).toJS()]) );
      minDistSquared = Infinity;
      obj = null;
      lines.forEach( line => {
        var d = distToLineIntersection([x1, y1], [x2, y2], line[0], line[1]);
        if (minDist > d){
          minDist = d;
          obj = line;
        }
      });
      return obj;
    },
    'distToLineIntersection': function(p1, p2, p3, p4){
      return distToLineIntersection(p1, p2, p3, p4);
    },
    /** Returns (list dx dy) updated to have bounced off of line or point */
    'bounce': function(x, y, dx, dy, lineOrPoint){
      if (!Immutable.List.isList(lineOrPoint) || lineOrPoint.count() !== 2){
        console.log(lineOrPoint);
        throw Error("fifth argument to bounce should be a line or a point");
      }
      var normal;
      if (typeof lineOrPoint.get(0) === 'number'){
        var point = lineOrPoint;
        if (typeof point.get(1) !== 'number'){ throw Error("Second element of point is not a number"); }
        // for bouncing off of a point, normal is from point to ball
        normal = normalize(x - point.get(0), y - point.get(1));

      } else if (Immutable.List.isList(lineOrPoint.get(0))){
        var line = lineOrPoint;
        if (typeof line.get(0).get(0) !== 'number'){ throw Error("line doesn't seem like it's made of numbers"); }
        var xDiff = line.get(1).get(0) - line.get(0).get(0);
        var yDiff = line.get(1).get(1) - line.get(0).get(1);
        normal = normalize(-yDiff, xDiff);
      } else {
        throw Error('bad inputs to bounce');
      }
      var dot = dx*normal[0]+dy*normal[1];
      var reflected = [dx-2*dot*normal[0], dy-2*dot*normal[1]];
      return Immutable.List(reflected);
    },
    'linesFromPoints': function(){
      var args = Array.prototype.slice.call(arguments);
      var lines = points.slice(0, -1).forEach( _, i => [points.get(i), points.get(i+1)] );
      return Immutable.List(list);
    },
    // JS interop
    'jsSet': function(obj, prop, value){
      arityCheck(arguments, 3);
      if (obj === undefined || prop === undefined || value === undefined){
        throw Error("jsSet needs three arguments");
      }
      obj[prop] = value;
    },
    'jsGet': function(obj, prop){
      arityCheck(arguments, 2);
      if (obj === undefined || prop === undefined){
        throw Error("jsGet needs two arguments");
      }
      var val = obj[prop];
      if (typeof val === 'function'){
        val = val.bind(obj);
      }
      return val;
    }
  };

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = builtins;
    }
  } else {
    window.builtins = builtins;
  }
})();
