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

  function pprint(x){
    if (Immutable.List.isList(x)){
      return pprint(x.toJS());
    } else if (Array.isArray(x)){
      return '['+x.map(pprint).join(', ')+']';
    } else {
      return ''+x;
    }
  }

  function Console(textareaId){
    this.textarea = document.getElementById(textareaId);
    this.textarea.addEventListener('mousedown', function(e){ e.preventDefault(); }, false);
  }
  Console.prototype.display = function(){
    var args = Array.prototype.slice.call(arguments);
    var output = args.map( pprint ).join(' ');
    if (this.textarea.value === ''){
      this.textarea.value += output;
    } else {
      this.textarea.value += '\n'+output;
    }
    this.textarea.classList.remove('dalsegno-console-animate');
    this.textarea.classList.add('dalsegno-console-active');
    setTimeout(() => {
      this.textarea.classList.remove('dalsegno-console-active');
      this.textarea.classList.add('dalsegno-console-animate');
    }, 100);
    this.textarea.scrollTop = this.textarea.scrollHeight;
  };

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = Console;
    }
  } else {
    window.Console = Console;
  }
})();
