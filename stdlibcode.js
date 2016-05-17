;(function() {
  'use strict';
  // code written in the language so it can be stepped through

  var stdlibcode =
`(define reduce (lambda (func arr acc)
  (if (= (length arr) 0)
      acc
      (reduce
        func
        (rest arr)
        (func acc (first arr))))))
(define find (lambda (func arr)
  (if (= (length arr) 0)
      ()
      (if (func (first arr))
          (first arr)
          (find func (rest arr))))))

(define filter (lambda (func arr)
  (reduce
    (lambda (acc item)
      (if (func item)
         (append acc item)
         acc))
    arr (list))))

(define map
  ((lambda ()
    (do
      (define map-acc (lambda (func arr acc)
        (if (= (length arr) 0)
          acc
          (map-acc
            func
            (rest arr)
            (append acc (func (first arr)))))))
      (lambda (func arr)
        (map-acc func arr (list)))))))`;

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = stdlibcode;
    }
  } else {
    window.stdlibcode = stdlibcode;
  }
})();
