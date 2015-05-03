var builtins = {
  '+': function(){
    return Array.prototype.slice.call(arguments).reduce(function(a, b){
      return a + b}, 0)
  },
  'display': function(){
    return console.log.apply(console, Array.prototype.slice.call(arguments));
  },
  '>': function(a, b){ return (a > b); },
  '<': function(a, b){ return (a < b); },
  '=': function(a, b){ return (a === b); },
  '*': function(a, b){ return a * b; },
  '/': function(a, b){ return a / b; },
}

if (typeof window === 'undefined') {
    exports.builtins = builtins;
}
