;(function() {
  'use strict';

  var stdlibcode = [
    "(define reduce (lambda func arr initial\n"+
    "  (if (= (length arr) 0)\n"+
    "      initial\n"+
    "      (func (reduce func (rest arr) initial) (first arr)))))",

    "(define filter (lambda func arr\n"+
    "  (reduce \n"+
    "    (lambda acc item (if (func item)\n"+
    "                     (prepend item acc)\n"+
    "                     acc))\n"+
    "    arr (list))))",

    "(define map (lambda func arr\n"+
    "  (if (= (length arr) 0)\n"+
    "      (list)\n"+
    "      (prepend (func (first arr)) (map func (rest arr))))))",
  ];

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = stdlibcode;
    }
  } else {
    window.stdlibcode = stdlibcode;
  }
})();
