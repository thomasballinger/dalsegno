// vim: set ft=scheme:
window.simpleProgram = `;semicolons make the rest of a line a comment
(define y 10)           ;define y and set it to 10
(defn recur ()          ;defn defines a global function
  (color 100 200 100)   ;sets the color to be used
                        ;for future draw operations
  (fillRect 0 0 width height) ;this is the canvas
                        ;context drawing operation
  (color 0 0 230)
  (drawArc 150 y 111)   ;queues a circle to be drawn
  (render)              ;actually paints queued drawings
  (set! y (+ y 5))      ;update the value of y
  (if (> y 300)         ;if, set!, define, defn, and
      (set! y 0))       ; lambda are special forms
  (recur))              ;no loops; recurse, recurse!
(recur)`;
