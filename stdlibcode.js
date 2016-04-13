;(function() {
  'use strict';

  var stdlibcode = [`
(define reduce (lambda (func arr acc)
  (if (= (length arr) 0)
      acc
      (reduce
        func
        (rest arr)
        (func acc (first arr))))))`, `
(define find (lambda (func arr)
  (if (= (length arr) 0)
      ()
      (if (func (first arr))
          (first arr)
          (find func (rest arr))))))`,

    "(define filter (lambda (func arr)\n"+
    "  (reduce \n"+
    "    (lambda (acc item)\n"+
    "      (if (func item)\n"+
    "         (append acc item)\n"+
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
