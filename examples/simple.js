// vim: set ft=scheme:
window.simpleProgram = `;semicolons make the rest of a line a comment
(define y 10)           ;for JSers, that's var y = 10
(defn recur ()          ;defn creates a global function
  (color 100 200 100)   ;sets the color to be used
                        ;for future draw operations
  (fillRect 0 0 width height) ;this is the canvas
                        ;context drawing operation
  (color 0 0 230)
  (drawArc 150 y 111)   ;queues a circle to be drawn
  (render)              ;actually paints queued drawings
  (set! y (+ y 5))      ;update the value of y
  (if (> y 300)         ;you've got if, set!, define, defn,
      (set! y 0))       ; and lambda for special forms
  (recur))              ;no loops; recurse, recurse!
(recur)`;
