;(function() {
  'use strict';

  var stdlibcode = [
    "(define reduce (lambda (func arr initial)\n"+
    "  (if (= (length arr) 0)\n"+
    "      initial\n"+
    "      (func (reduce func (rest arr) initial) (first arr)))))",

    "(define filter (lambda (func arr)\n"+
    "  (reduce \n"+
    "    (lambda (acc item)\n"+
    "      (if (func item)\n"+
    "         (cons item acc)\n"+
    "         acc))\n"+
    "    arr (list))))",

    "(define map\n"+
    "  ((lambda ()\n"+
    "    (do\n"+
    "      (define map-acc (lambda (func arr acc)\n"+
    "        (if (= (length arr) 0)\n"+
    "          acc\n"+
    "          (map-acc\n"+
    "            func\n"+
    "            (rest arr)\n"+
    "            (append acc (func (first arr)))))))\n"+
    "      (lambda (func arr)\n"+
    "        (map-acc func arr (list)))))))",
  ];

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = stdlibcode;
    }
  } else {
    window.stdlibcode = stdlibcode;
  }
})();
